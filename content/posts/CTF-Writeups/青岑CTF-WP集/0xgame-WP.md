---

title: 0xgame-WP
date: 2026-07-21
categories: ["CTF-Writeups","青岑CTF-WP集"]
permalink: /ctf-writeups-ctf-wp/0xgame-wp
---


# 1.Http的真理，我已解明
#### 摘要：
本题模拟了一个多阶段 HTTP 请求构造挑战，要求参与者依次完成以下操作：
- 通过 GET 方法传递 `hello=web`
- 通过 POST 方法传递 `http=good`
- 携带 Cookie `Sean=god`
- 设置 Referer 为 `http://mihoyo.com`
- 使用 Safari 浏览器（User-Agent 伪造）
- 使用 Clash 代理并添加 `Via: clash` 头
这些操作可能分别在多次请求中完成，也可能在同一请求中合并，具体取决于题目服务器对每一步的校验方式。
#### 解：
本人觉得使用HackBar v2这个插件很方便，
首先是使用GET传递 hello=web
```http
http://docker.qingcen.net:47548/?hello=web
```
其次用POST传递 http=good
```http
http=good
```
然后设置cookie
```http
Cookie:Sean=god
```
使用Safari浏览器访问，我们可以使用User-Agent来伪造
```http
User-Agent:Safari
```
请从www.mihoyo.com访问本页面,否则你的原石啊这些全都别想要了,是说需要从www.mihoyo.com进入该网页，而**Referer** 是 HTTP 请求头中的一个字段，意思是 **“来源页面”**
所以
```http
Referer:www.mihoyo.com
```
请使用clash这只猫猫来代理一下,这里需要了解http协议中哪些标准请求/响应头可以来添加代理标识。`Via` 是 HTTP 协议中的一个**标准请求/响应头**，用于记录消息经过的代理服务器路径。
最后我们可以在 Custom headers里面添加标准请求/响应头
![](/images/20260507110218.webp)
我们就能拿到flag啦！！！！