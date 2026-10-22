---
title: Thinkphp in-sqlinjection
date: '2026-10-22 22:40:38'
tags: []
categories:
  - CTF-Writeups
  - CVE复现
slug: Thinkphp in-sqlinjection
permalink: /thinkphp-in-sqlinjection
draft: false
---

## 1、漏洞描述
这是一个存在于 ThinkPHP 5.0.x的高危 SQL 注入漏洞。攻击者可以通过构造恶意的 `ids` 数组参数，将非法的 SQL 语句（如 `updatexml` 报错注入载荷）注入到数据库查询中，从而在特定条件下获取数据库的敏感信息（如当前用户、数据库名等）。
## 2、漏洞成因
该漏洞的根本成因在于 **ThinkPHP 框架底层在处理数组形式的查询条件时，未对数组的“键名”（Key）进行充分的过滤与校验**。
具体而言，当开发者使用类似 `where('id', 'in', $ids)` 的查询构造器，且 `$ids` 来源于用户可控的数组输入时，框架的 `Builder` 类（如 `parseWhereItem` 方法）在解析该数组时，会将数组的键名直接拼接到 SQL 语句的 `IN` 条件中，而未能识别并拦截其中夹带的恶意 SQL 片段（例如 `0,updatexml(...)` 这种利用逗号闭合并执行函数的 Payload）。这就导致攻击者可以绕过常规的参数值过滤，通过操纵数组的“键”来实现注入。此外，若生产环境未关闭 `DEBUG` 模式，该注入点还会伴随报错信息泄露，直接暴露数据库的账号密码等敏感凭据。
## 3、复现

**验证注入存在**
```
/index.php?ids[0,updatexml(0,concat(0xa,user()),0)]=1
```
回显
![](/images/20261022224040.png)
