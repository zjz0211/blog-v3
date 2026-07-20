---

title: Basic
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1. Basic

Basic是Web安全的最基础操作——查看网页源码、修改请求参数、绕过前端验证。这些技能是所有Web题目的基本功。

## 1.1 查看网页源码

做 CTF WEB 时常见的第一步，可能会塞有作为出题人的提示的 HTML 注释，也可能泄露某些关键的 JS 文件路径，或者直接泄露题目核心逻辑。

**常用方法：**

1. 使用 `Ctrl + U` 查看页面源代码。

2. 使用 `F12` 打开开发者工具。

3. 使用 `Ctrl + Shift + I` 打开开发者工具。

4. 右键页面，选择"查看网页源代码"。

页面脚本可以拦截右键、快捷键或覆盖菜单，但不能阻止用户查看已经下载到浏览器的响应内容和前端资源。

**替代方法：**

1. 在 URL 前加上 `view-source:` 后访问，例如：`view-source:http://example.com`。

2. 点击浏览器右上角三个点，选择"更多工具"，再选择"开发者工具"。

3. 在别的页面中先打开开发者工具，然后使用 HackBar 访问靶机页面。

## 1.2 请求和响应分析

在 CTF 中，很多 flag 或线索藏在 HTTP 请求和响应的细节里，不会直接显示在页面上。每次浏览器和服务器通信，都会发送一个**请求**（Request），服务器返回一个**响应**（Response），这两者都可能包含有价值的信息。

**常见的查看方法**

1. `F12` → Network（网络）标签 → 刷新页面 → 点击任意一条请求
2. BurpSuite 抓包查看（最完整的方式）
3. `curl -v` 在命令行查看完整请求和响应头

**响应里重点看什么：**

- **响应头（Response Headers）**：出题人可能在自定义头里藏 flag，比如 `X-Flag: flag{...}` 或 `Hint: ...`
- **响应体（Response Body）**：隐藏在 HTML 注释、JS 代码或不可见元素中的信息。有时候 flag 就藏在返回的 JSON 数据中
- **状态码**：`200` 正常，`301/302` 重定向（可能指向敏感路径），`403` 禁止访问（可能是权限控制、WAF 或统一拦截），`500` 服务器报错（可能泄露路径或代码信息）。状态码只能作为线索，不能单独证明资源是否真实存在

**请求里重点看什么：**

- **Cookie**：可能包含 base64 编码的数据、JWT token 或序列化对象
- **请求参数**：URL 里的 `?id=1`、POST 表单数据，尝试修改可能触发不同行为
- **请求头**：`User-Agent`、`Referer`、`X-Forwarded-For` 等，有些题目要求伪造特定值才能看到 flag

**快速上手：** 打开 F12 的 Network 标签，刷新页面，逐条点击请求，先看 Response Headers 有没有奇怪的自定义字段，再看 Response Body 有没有注释或隐藏内容。

## 1.3 参数修改

CTF 中最常见的套路之一：修改 URL 或表单里的参数值，观察服务器返回的变化。

**GET 参数：**

URL 中 `?` 后面的部分就是 GET 参数，键值对用 `&` 分隔：

```
http://example.com/page?is_admin=0&name=guest
```

直接在浏览器地址栏里改值、回车即可。比如 `is_admin=0` 改成 `is_admin=1`，`name=guest` 改成 `name=admin`，看返回内容有没有变化。

**POST 参数：**

POST 参数在请求体里，不显示在 URL 中。用以下方式修改：

1. `F12` → Network → 找到请求 → 右键 → "Edit and Resend"（Firefox）或复制为 fetch/cURL 手动改
2. BurpSuite 抓包 → 在 Repeater 中修改 → 重放
3. 写 Python 脚本用 `requests` 库发送

**常见考点：**

- **越权**：`userid=1` 改成 `userid=2`，可能看到其他人的数据
- **价格篡改**：`price=999` 改成 `price=1`，总价就变了
- **负数/溢出**：`num=1` 改成 `num=-1` 或极大值，触发异常逻辑
- **隐藏参数**：页面上看不到的参数，手动加上去可能有特殊效果（如 `&admin=true`）
- **参数污染**：传两个同名参数 `?id=1&id=2`，看后端取哪个

**关键思路：** 看到参数就尝试修改一下——改数字、改布尔值、加单引号、删参数、加同名参数，观察响应变化就是信息收集的过程。

## 1.4 Cookie 和 Session 修改

Cookie 是服务器让浏览器保存的一小段数据，每次请求浏览器会自动带上。CTF 中很多身份验证和权限控制依赖 Cookie，修改它可能导致越权、登录其他账号或触发隐藏逻辑。

**常见的修改方法：**

1. `F12` → Application（应用程序）→ Cookies → 双击值直接改
2. BurpSuite 抓包 → 在请求头中找到 `Cookie:` 行，修改后重放
3. 浏览器插件 HackBar → 点击 Cookes 就可以直接修改
4. `curl -H "Cookie: key=value"` 在命令行中指定

**常见考点：**

- **明文信息泄露**：Cookie 值直接用 base64 编码了用户名、角色等信息，解码后修改再编码回去就能伪装成他人。例如 `user=guest` 编码为 `dXNlcj1ndWVzdA==`，改成 `user=admin` 编码为 `dXNlcj1hZG1pbg==`
- **权限标志**：`isAdmin=0` 改成 `isAdmin=1`，或者 `role=user` 改成 `role=admin`
- **Session 固定**：服务器返回 `Set-Cookie: session=abc123`，尝试改成已知的其他 session ID
- **Cookie 注入**：Cookie 值被拼接进 SQL 语句或模板中，存在注入点
- **缺失校验**：直接删除 Cookie，看目标请求是否仍返回相同的受保护数据。页面"看起来正常"也可能只是进入游客态、命中缓存，或身份放在其他 Cookie / Authorization 头中，不能据此直接断言服务器没有鉴权；应比较具体数据和权限操作

## 1.5 请求方法修改

HTTP 请求有不同的方法（Method），最常见的是 `GET`（获取数据）和 `POST`（提交数据）。但同一个 URL 用不同方法访问，后端行为可能完全不同。

**常见请求方法：**

| 方法 | 含义 | CTF 中的价值 |
|------|------|-------------|
| GET | 获取资源 | 默认方法，通常用于查看页面 |
| POST | 提交数据 | 提交表单、登录、传参 |
| PUT | 上传/替换 | 可能绕过限制直接上传文件 |
| DELETE | 删除 | 可能触发管理操作 |
| OPTIONS | 查询支持的方法 | 探测哪些方法可用 |
| HEAD | 只获取响应头 | 快速探测资源是否存在 |

**怎么改：**

1. **BurpSuite**：抓包后右键 → "Change request method"，GET 变 POST 自动转换参数位置
2. **curl**：`-X` 参数直接指定方法
   ```bash
   curl -X POST "http://example.com/admin" -d "key=value"
   curl -X PUT "http://example.com/file" --upload-file payload.txt
   curl -X OPTIONS "http://example.com/api" -v
   ```
3. **浏览器**：F12 → Console → `fetch(url, {method: 'POST', body: 'data'})`

**常见考点：**

- **GET 改 POST 绕过**：有些 WAF 只检查 GET 参数，改成 POST 提交同样的 payload 就能绕过
- **OPTIONS 探路**：先 `OPTIONS` 看返回头里 `Allow` 字段列了哪些方法，再用对应方法尝试
- **PUT 上传**：遇到 `PUT` 方法开放，可能直接把 webshell 文件 PUT 上去
- **参数位置变化**：GET 参数在 URL 里（`?key=value`），POST 参数在请求体里，改方法时注意参数放对位置

## 1.6 前端验证绕过

很多页面用 JavaScript 在浏览器端检查输入是否合法——比如必须填邮箱格式、密码长度>=8、不能为空等。但这些校验只在前端生效，后端不一定有同样的校验。

**绕过方式：**
1. 用 BurpSuite 抓包，直接在请求体中改数据，绕过 JS 校验
2. F12 → Console → 直接调用表单提交函数，跳过页面上的校验逻辑
3. 写 Python 脚本用 `requests` 发请求，完全不经过前端

**核心思路：** 前端看到的限制都不算真正的限制——所有从浏览器发出的数据都可以被修改。后端是否做了同名校验才是关键。

## 1.7 重定向处理

服务器返回 `3xx` 状态码和一个 `Location` 头，告诉浏览器"去别的地方"。常见场景：登录成功后跳转到首页、访问 `/admin` 被重定向到登录页。

**为什么 CTF 要关注重定向：**

浏览器默认会自动跟随重定向，所以你看到的往往是最终页面，中间跳转过程的响应体可能藏着 flag 或敏感信息。

**两种关键操作：**

**1. 不让浏览器自动跳转，看中间的响应：**

- BurpSuite：在 Proxy 的 HTTP history 中直接查看每一跳的 3xx 响应；若送到 Repeater，按当前版本把 Follow redirections 设为 Never
- curl：不加 `-L` 就直接看重定向响应；`curl -v` 能看到 `Location` 头
- F12：Network 标签 → 勾选 "Preserve log"，每个重定向请求都能逐条查看

**2. 控制是否跟随重定向：**

```bash
# 不跟随重定向，看 3xx 响应体
curl "http://example.com/admin" -v

# 跟随重定向，拿到最终页面
curl "http://example.com/admin" -L
```

**常见考点：**

- **中间页面藏 flag**：重定向之前的页面可能在 HTML 注释或响应头里放了信息
- **重定向到内网**：拿到一个 SSRF 漏洞后，你请求 `http://题服务器/fetch?url=内网地址`，但 SSRF 可能做了域名白名单只允许外网。这时可以在自己 VPS 上写一个 302 重定向页面，让 SSRF 先请求你的 VPS（合法外网地址），然后你的 VPS 返回 `Location: http://127.0.0.1:6379`（本地 Redis），SSRF 跟着跳过去就打到了内网。

## 1.8 HTTP Basic 认证

HTTP Basic 认证是最简单的 HTTP 身份验证方式，核心流程只有两步：

1. 浏览器访问一个需要认证的页面，服务器返回 `401 Unauthorized`，并在响应头里加一行 `WWW-Authenticate: Basic realm="提示文字"`，浏览器看到这个头就弹出登录对话框。
2. 用户输入用户名和密码后，浏览器把两者用冒号拼成 `用户名:密码`，做一次 base64 编码，放到 `Authorization` 头里发给服务器：

```
Authorization: Basic YWRtaW46MTIzNDU2
```

服务器收到后解码，跟自己的密码文件（如 `.htpasswd`）比对，匹配就返回页面内容，不匹配继续 `401`。

**为什么 base64 不安全：**

base64 是**编码**，不是**加密**——它只是把二进制数据转成可打印字符，解码不需要任何密钥。等于把密码写在明信片上，只是换了种写法。

**利用方式：**

**场景一：题目给了流量包（pcap）**

流量包里别人的请求直接带着 `Authorization` 头，解码即得用户名密码：

```python
import base64
base64.b64decode("YWRtaW46MTIzNDU2").decode()
# 'admin:123456'
```

也可以用 Linux 命令行：
```bash
echo "YWRtaW46MTIzNDU2" | base64 -d
```

**场景二：没有流量包，直接碰到了认证弹窗**

那就是弱口令爆破。HTTP Basic 认证的爆破跟普通登录表单本质一样，只是要把用户名和密码组合先做 base64 编码再发送。

用 BurpSuite Intruder 操作步骤：

1. 先正常访问一次目标页面，在 BurpSuite 的 Proxy → HTTP history 里找到那个带 `Authorization: Basic xxx` 的请求
2. 右键 → Send to Intruder → Positions 标签 → 选中 base64 编码部分 → 点击 "Add §" 把它标记为变量
3. 切到 Payloads 标签 → Payload type 选 "Custom iterator" → 位置1填用户名列表，位置2填冒号 `:`，位置3填密码列表。这样它会自动生成 `admin:123456`、`admin:password` 等组合
4. 在 Payload Processing 里添加 "Base64-encode" 规则——Intruder 会把每组合成的字符串编码后再填入请求
5. 切到 Payload Encoding 区域，**取消勾选** "URL-encode these characters"（不然 base64 末尾的 `=` 会被编码成 `%3d`，导致认证失败）
6. Start Attack → 按响应长度过滤：爆破成功的请求返回状态码是 `200`，失败的仍是 `401`，长度也明显不同
