---

title: Dirsearch Sqlmap(Windows)
date: 2026-07-21
categories: ["web-tools"]
permalink: /web-tools/dirsearch-sqlmapwindows
---



# 一、Dirsearch
## 1. 安装
**1.访问 Dirsearch 的 GitHub 页面：**`https://github.com/maurosoria/dirsearch`
**2.点击绿色的 “Code”** 按钮，选择 **“Download ZIP”**。
## 2. 作用
### 2.1 找到隐藏的“入口点”
- **找到 `robots.txt` 或 `sitemap.xml`**：虽然这些是公开的，但 Dirsearch 能帮你快速确认它们的存在，里面有时会直接提示目录。
- **找到 `www.zip`、`backup.rar`、`web.rar`**：这是 CTF 的“经典操作”。出题人经常把网站源码打包放在根目录，忘记删除。用 Dirsearch 扫出 `.zip` 文件，下载下来就能**进行代码审计（白盒审计）**，直接读到 Flag 或找到漏洞点。
- **找到后台登录界面（Admin Panel）**：比如 `/admin`、`/login`、`/manage`。找到了后台，你就可以尝试弱口令、SQL 注入或越权访问。
### 2.2 发现“信息泄露”的敏感文件
- **`.git/` 或 `.svn/` 目录**：如果网站用了版本控制但配置不当，Dirsearch 能扫出来。你可以用 `GitHack` 等工具还原源码，Flag 经常就硬编码在源码的注释里。
- **`.env` 或 `.aws/` 文件**：这些环境变量文件里可能泄露数据库密码、Secret Key（密钥）或 Token（令牌）。
- **`swagger-ui` 或 `api-docs`**：如果扫出 API 接口文档，你就能直接知道所有接口的请求方式，省去大量手工摸索的时间。
## 3. 使用
使用dirsearch之前需要安装它所需要的依赖(即特定的第三方库)，确保解压的.zip里面有**requirements.txt**文件。
#### (1)**输入命令安装依赖**
在解压的文件夹下打开CMD
```
默认源：pip install -r requirements.txt
清华源(大陆用这个)：pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```
#### (2)快速命令帮助
```
python3 dirsearch.py -h
```
![](/images/20260719143945.webp)
#### (3)对网址`<url>`进行目录扫描
```
python3 dirsearch.py -u <目标网址>
```
#### (4)对网址`<url>`进行目录扫描，扫描到的目录自动进行`递归扫描`
```
python3 dirsearch.py -u <目标网址> -r
```
#### (5)使用自己的字典扫描
这个工具需要自己手机一些常用的字典(比如：自带的缺少phps)
```
python3 dirsearch -u <目标网址> -w 自己字典的地址
```


# 二、Sqlmap
## 1. 安装
**1.访问 Sqlmap 的 GitHub 页面：`https://github.com/sqlmapproject/sqlmap`
**2.点击绿色的 “Code”** 按钮，选择 **“Download ZIP”**。
## 2. 作用
**sqlmap 是 Web 方向最强大的“自动化 SQL 注入利用工具”**。它的核心作用就是帮你**发现注入点并直接拿到数据库里的 Flag**。
**sqlmap支持的数据库有**
```
MySQL, Oracle, PostgreSQL, Microsoft SQL Server, Microsoft Access, IBM DB2, SQLite, Firebird, Sybase和SAP MaxDB
```
**sqlmap支持五种不同的注入模式：**
- 1、基于布尔的盲注，即可以根据返回页面判断条件真假的注入。
- 2、基于时间的盲注，即不能根据页面返回内容判断任何信息，用条件语句查看时间延迟语句是否执行（即页面返回时间是否增加）来判断。
- 3、基于报错注入，即页面会返回错误信息，或者把注入的语句的结果直接返回在页面中。
- 4、联合查询注入，可以使用union的情况下的注入。
- 5、堆查询注入，可以同时执行多条语句的执行时的注入。
## 3. 使用
![](/images/20260719152831.webp|688)
### 3.1常见命令
#### (1) 输入命令安装依赖
使用Sqlmap之前需要安装它所需要的依赖(即特定的第三方库)，确保解压的.zip里面有**requirements.txt**文件。
在解压的文件夹下打开CMD
```
默认源：pip install -r requirements.txt
清华源(大陆用这个)：pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```
#### (2) 快速命令帮助
```
python3 sqlmap.py -h // 查看基础帮助选项
```
![](/images/20260719152332.webp)
```
python3 sqlmap.py -hh // 查看完整参数说明
```
![](/images/20260719152605.webp)
#### (3) 检测目标 URL 是否存在注入漏洞
```
python3 sqlmap.py -u "目标网址"
```
#### (2) 查看所有「数据库」
```
python3 sqlmap.py -u "目标网址" --dbs
```
#### (3) 查看当前使用的数据库
```
python3 sqlmap.py -u "目标网址" --current-db
```
#### (4) 查看「数据表」
```
python3 sqlmap.py -u "目标网址" -D '数据表' --tables
```
#### (5) 查看「字段」
```
python3 sqlmap.py -u "目标网址" -D '数据表' -T '字段' --tables
```
#### (6) 查看「数据」
```
python3 sqlmap.py -u "目标网址" -D '数据表' -T '字段' --dump
```
#### (7) 批量测试指定文件
准备一个.txt文本，写上需要检测的多个url，必须一行一个
用`-m`来指定文件，可以「批量扫描」文件中的url。
```
python3 sqlmap.py -m xxx.txt
```
#### (8) POST请求
之前都是针对GET请求，如果检测「post请求」的注入点，使用BP等工具「抓包」，将http请求内容保存到txt文件中。
`-r` 指定需要检测的文件，SQLmap会通过post请求方式检测目标。
```
python3 sqlmap.py -r xxx.txt
```



