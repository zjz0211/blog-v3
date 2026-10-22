---
title: Thinkphp rce-5.0.23
date: '2026-10-22 22:40:38'
tags: []
categories:
  - CTF-Writeups
  - CVE复现
slug: Thinkphp rce-5.0.23
permalink: /thinkphp-rce-5-0-23
draft: false
---

## 1、漏洞描述
- **影响版本**：ThinkPHP 5.0.0 至 5.0.23（不含 5.0.24）。[](https://jvndb.jvn.jp/ja/contents/2026/JVNDB-2026-013335.html)

- **成因**：框架在获取请求 method 时没有正确处理方法名，攻击者可以覆盖 `_method` 变量，调用 `Request` 类的 `__construct` 方法，并配合 `filter` 参数篡改过滤规则，最终通过 `server[REQUEST_METHOD]` 将命令传入 `system` 等函数执行。
- **危害**：无需认证即可远程执行任意代码。
## 2、漏洞成因
ThinkPHP 5.0.23 的 RCE 漏洞，成因可以归结为一句话：**框架在处理请求方法（method）时，对用户可控的输入过滤不严，导致攻击者能够覆盖 `Request` 类的内部属性，并利用框架的路由机制调用任意方法，最终通过 `call_user_func_array` 执行系统命令。**
**直接成因**：`Request` 类的 `method` 方法过滤不严。ThinkPHP 5.0.23 在获取当前请求的 HTTP 方法时，处理逻辑存在缺陷，允许攻击者通过参数覆盖来干扰 `Request` 类的正常行为。
攻击者提交的 `_method=__construct` 参数，使得框架错误地调用了 `Request` 类的构造函数。同时，配合 `filter[]=system`，攻击者可以篡改该类用于过滤请求数据的规则，将过滤器设置为 `system` 函数。最后，通过`server[REQUEST_METHOD]=id` 将待执行的命令 `id` 写入 `REQUEST_METHOD` 这个本应只读的服务端变量中。当框架后续使用被污染的 `filter` 规则去处理这个被污染的 `REQUEST_METHOD` 时，`system('id')` 就被执行了。
**根本成因**：路由解析对控制器名缺乏过滤
如果只停留在 `Request` 类，还不足以解释命令为何能被执行。更深层的根本原因在于，框架的路由调度机制允许攻击者将任意类名和方法名作为“控制器”和“操作”传入。
ThinkPHP 5 在解析 `pathinfo` 时（例如 `s=index/\think\app/invokefunction`），会用 `/` 分割路径并提取控制器名。关键问题在于，它没有对提取出的控制器名做严格的安全检查。当控制器名中包含反斜杠 `\` 时，框架会直接将其当作一个完整的类名来实例化。
这给了攻击者调用框架内部任意类的机会。攻击者可以将控制器指定为 `\think\app`，将操作指定为 `invokefunction`。`invokefunction` 是 `think\app` 类中的一个方法，它的作用就是通过反射机制来调用指定的函数。攻击者通过 URL 参数 `function=call_user_func_array` 以及 `vars[0]=system&vars[1][]=id`，最终让框架执行了 `call_user_func_array('system', ['id'])`，从而完成命令执行。

## 3、复现

![](/images/20261022224044.png)

Poc：
```http
POST /index.php?s=captcha HTTP/1.1
Host: your-target-ip
Content-Type: application/x-www-form-urlencoded

_method=__construct&filter[]=system&method=get&server[REQUEST_METHOD]=id
```
这样就能够RCE了

## 4、构造过程
**构造起点**：变量覆盖污染 `Request` 对象
漏洞的入口在 `Request` 类的 `method()` 方法。当 POST 数据中存在 `_method` 参数时，框架会执行 `$this->{$this->method}($_POST)`。如果传入 `_method=__construct`，就等于强制调用了 `Request::__construct`。
在构造函数中，框架会用传入的 POST 数组去覆盖对象的属性。于是，攻击者可以通过 POST 参数控制 `$this->filter` 和 `$this->method` 等关键属性：
- `filter[]=system`：把请求数据的过滤器设为 `system`。
- `method=get`：将内部请求方法设为 get。
- `server[REQUEST_METHOD]=id`：把系统命令塞进 `server` 属性数组里。
至此，`Request` 对象被“污染”，它内部持有了一个会执行系统命令的过滤器，以及一个待执行的命令字符串。
**触发点**：`param()` 方法调用过滤器
污染本身不会执行代码，需要找到一个会调用被污染过滤器的地方。在路由解析过程中，框架会调用 `Request::param()` 来获取请求参数。`param()` 内部会调用 `method(true)` 来确认请求类型，而 `method(true)` 会读取 `$this->server['REQUEST_METHOD']`。
因为 `REQUEST_METHOD` 已被覆盖为 `id`，这个值会被送入 `filterValue()` 处理。`filterValue()` 遍历 `$this->filter`（此时是 `system`），对值执行 `call_user_func('system', 'id')`，命令就此执行。

## 5、安全加固
**寻找Thinkphp的安装目录**
```bash
# 查找ThinkPHP的Request.php文件绝对路径
find / -name "Request.php" -path "*think*" 2>/dev/null
```
**备份**
```bash
cp /找到的路径/thinkphp/library/think/Request.php /找到的路径/thinkphp/library/think/Request.php.bak
```
**编辑文件**
```bash
vi /找到的路径/thinkphp/library/think/Request.php
```
**定位并修改代码**
```php
if (isset($_POST[Config::get('var_method')])) {
    $this->method = strtoupper($_POST[Config::get('var_method')]);
    $this->{$this->method}($_POST);
}
```
**替换为带白名单校验的代码**
```php
if (isset($_POST[Config::get('var_method')])) {
    $method = strtoupper($_POST[Config::get('var_method')]);
    if (in_array($method, ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'])) {
        $this->method = $method;
        $this->{$this->method}($_POST);
    } else {
        $this->method = 'POST';
    }
    unset($_POST[Config::get('var_method')]);
}
```
