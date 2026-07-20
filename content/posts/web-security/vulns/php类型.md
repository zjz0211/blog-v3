---

title: php类型
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1.哈希绕过

哈希绕过不是破解哈希，而是利用PHP比较规则的坑。比如MD5('240610708')=='0'，因为PHP把0e开头的字符串当成了科学计数法的0。

## 1.1 哈希基础

### 1.1.1 什么是哈希

哈希函数会把任意长度的数据映射成固定长度的摘要。

```text
任意长度输入
      ↓
哈希函数
      ↓
固定长度摘要
```

例如：

```php
echo md5('hello');
```

输出：

```text
5d41402abc4b2a76b9719d911017c592
```

同一个输入会得到同一个摘要；输入只改变一个字节，输出通常也会发生明显变化。

### 1.1.2 常见哈希算法与输出

| 算法或函数 | 十六进制长度 | 二进制长度 | 常见用途 |
|---|---:|---:|---|
| MD5 | 32 个字符 | 128 bit | 旧式完整性校验、CTF |
| SHA-1 | 40 个字符 | 160 bit | 旧式完整性校验、Git 历史对象 |
| SHA-256 | 64 个字符 | 256 bit | 完整性校验、HMAC |
| SHA-512 | 128 个字符 | 512 bit | 完整性校验、HMAC |
| CRC32 | 通常 8 个十六进制字符 | 32 bit | 差错检测，不是密码学哈希 |
| bcrypt | 变长编码字符串 | 内含参数、盐和结果 | 密码存储 |
| Argon2id | 变长编码字符串 | 内含参数、盐和结果 | 密码存储 |

PHP 示例：

```php
echo md5('hello');
echo sha1('hello');
echo hash('sha256', 'hello');
echo hash('sha512', 'hello');
```

### 1.1.3 十六进制摘要与原始二进制摘要

PHP 默认返回十六进制字符串：

```php
$hex = md5('hello');
var_dump($hex);
```

结果是 32 个十六进制字符；在 ASCII 兼容编码中占 32 字节：

```text
string(32) "5d41402abc4b2a76b9719d911017c592"
```

如果第二个参数为 `true`：

```php
$raw = md5('hello', true);
var_dump(strlen($raw));
```

结果是 16 字节原始二进制数据。

| 写法 | 返回内容 |
|---|---|
| `md5($data)` | 32 个十六进制字符 |
| `md5($data, true)` | 16 字节原始二进制 |
| `hash('sha256', $data)` | 64 个十六进制字符 |
| `hash('sha256', $data, true)` | 32 字节原始二进制 |

**重要：**

常见 `0e` Magic Hash 表针对的是十六进制字符串输出，不能直接套到 `raw=true` 的二进制输出上。

### 1.1.4 哈希的三个安全目标

1. **原像抗性**

   已知摘要 `h`，难以找到输入 `m`，使：

   ```text
   H(m) = h
   ```

2. **第二原像抗性**

   已知一个输入 `m1`，难以找到另一个不同输入 `m2`，使：

   ```text
   H(m1) = H(m2)
   ```

3. **碰撞抗性**

   难以找到任意两个不同输入 `m1`、`m2`，使：

   ```text
   H(m1) = H(m2)
   ```

### 1.1.5 碰撞不等于破解

这几个概念不能混用：

| 类型 | 已知条件 | 目标 |
|---|---|---|
| 密码爆破 | 已知哈希 | 找到一个符合业务的明文 |
| 原像攻击 | 已知指定哈希 | 找到任意输入命中该哈希 |
| 第二原像 | 已知指定明文 | 找另一个同哈希明文 |
| 碰撞攻击 | 不指定哈希 | 找任意两个不同但同哈希的输入 |
| Magic Hash | PHP 弱比较 | 让两个不同哈希被当成数字 0 |
| 数组绕过 | PHP 类型错误 | 让两个错误返回值相同 |
| 长度扩展 | 已知前缀 MAC | 继续计算追加数据后的合法摘要 |

发现一对 MD5 碰撞，不代表可以反推出任意 MD5 密码，也不代表能为一个指定文件随意找到第二原像。

### 1.1.6 盐与 Pepper

盐是每个密码独立的随机值：

```text
hash(password + salt)
```

它主要防止：

- 相同密码产生相同哈希；
- 直接使用预计算彩虹表；
- 一次计算同时命中大量用户。

盐不阻止攻击者针对单个弱密码进行离线猜测。

Pepper 是服务端额外保存的全局秘密，通常放在配置或密钥管理系统中，而不是数据库中。

现代 PHP 密码存储应优先使用：

```php
$hash = password_hash($password, PASSWORD_DEFAULT);
```

`password_hash()` 会自动生成随机盐，不应自己手写固定盐代替它。

---

## 1.2 哈希攻击模型

### 1.2.1 先判断题目真正考什么

看到 `md5()`、`sha1()` 或 `hash()` 后，先不要直接套 `0e`。

按顺序判断：

1. 比较符是 `==` 还是 `===`？
2. 比较的是摘要字符串，还是原始二进制？
3. 用户能否控制比较两边？
4. 输入来自查询参数、表单、JSON 还是文件？
5. PHP 版本是多少？
6. 能否把字符串变成数组、整数、布尔值或 `null`？
7. 目标是找明文、找碰撞，还是伪造签名？
8. 摘要是否被截断？
9. 是否加盐？
10. 是否使用 `H(secret || message)` 充当 MAC？

### 1.2.2 常见题目类型

| 源码特征 | 优先思路 |
|---|---|
| `md5($a) == md5($b)` | Magic Hash |
| `md5($a) === md5($b)` | 真碰撞或旧版数组错误 |
| `md5($a) == $knownHash` | 已知哈希是否为 Magic Hash、弱比较版本 |
| `md5($a) === $knownHash` | 爆破或原像，不是普通碰撞 |
| `md5($a) == $a` | 自身 Magic Hash |
| `md5($a, true)` 拼进 SQL | 原始二进制注入 |
| `hash(secret . data)` | 长度扩展 |
| `hash_hmac(...)` | 一般不受长度扩展 |
| `substr(hash(...), 0, n)` | 截断哈希爆破 |
| `crc32(data)` 作为签名 | CRC 碰撞或线性性质 |
| `md5_file(file1) === md5_file(file2)` | 文件碰撞 |
| `password_hash/password_verify` | 字典、弱密码、参数或业务逻辑问题 |

### 1.2.3 先确认数据类型

PHP 常见输入类型：

| 输入方式 | 常见类型 |
|---|---|
| `?a=123` | 字符串 `"123"` |
| `a[]=123` | 数组 |
| 普通表单 `a=123` | 字符串 `"123"` |
| JSON `{"a":"123"}` | 字符串 |
| JSON `{"a":123}` | 整数 |
| JSON `{"a":false}` | 布尔值 |
| JSON `{"a":null}` | `null` |
| 文件上传 | `$_FILES` 数组与临时文件 |

所以"提交数字 0"要区分：

```text
GET 中的 0：字符串 "0"
JSON 中的 0：整数 0
```

---

## 1.3 哈希识别与爆破

### 1.3.1 根据长度只能做初步判断

| 形式 | 可能算法 |
|---|---|
| 32 位十六进制 | MD5、NTLM、其他 128-bit 摘要 |
| 40 位十六进制 | SHA-1、RIPEMD-160 |
| 64 位十六进制 | SHA-256、BLAKE2s 等 |
| 128 位十六进制 | SHA-512、其他 512-bit 摘要 |
| `$2y$...` | bcrypt |
| `$argon2id$...` | Argon2id |

仅凭长度不能唯一确定算法，还要结合：

- 源码函数；
- 数据库字段；
- 前缀格式；
- 盐的位置；
- 应用语言；
- 题目提示。

### 1.3.2 常见识别工具

```bash
hashid '5f4dcc3b5aa765d61d8327deb882cf99'
hashcat --identify '5f4dcc3b5aa765d61d8327deb882cf99'
```

识别工具只提供候选，最终应回到源码验证。

### 1.3.3 在线爆破与离线爆破

**在线爆破：**

```text
候选密码
   ↓
发送登录请求
   ↓
服务器判断
```

受网络、验证码、限速和锁定策略影响。

**离线爆破：**

```text
得到哈希和盐
   ↓
本地计算候选摘要
   ↓
与目标比较
```

不受在线限速影响，速度取决于算法和硬件。

### 1.3.4 常见攻击方式

| 方法 | 适用场景 |
|---|---|
| 字典攻击 | 用户常用弱密码 |
| 规则攻击 | `password` → `Password123!` 等变形 |
| 掩码攻击 | 已知长度与字符结构 |
| 暴力穷举 | 搜索空间较小 |
| 组合攻击 | 两个词表拼接 |
| 彩虹表 | 无盐、固定算法的预计算结果 |
| 业务字典 | 用户名、生日、公司名、题目名 |
| 泄露密码复用 | 用户重复使用旧密码 |

### 1.3.5 Hashcat 基础

常见模式：

| 算法 | Hashcat 模式 |
|---|---:|
| MD5 | `0` |
| SHA-1 | `100` |
| SHA-256 | `1400` |
| bcrypt | `3200` |

字典攻击：

```bash
hashcat -m 0 -a 0 hash.txt rockyou.txt
```

字典加规则：

```bash
hashcat -m 0 -a 0 hash.txt rockyou.txt -r rules/best64.rule
```

六位数字掩码：

```bash
hashcat -m 0 -a 3 hash.txt '?d?d?d?d?d?d'
```

查看结果：

```bash
hashcat -m 0 hash.txt --show
```

模式编号和支持情况应以当前 Hashcat 版本为准。

### 1.3.6 简单 Python 穷举

已知目标是六位数字的 MD5：

```python
import hashlib

target = "e10adc3949ba59abbe56e057f20f883e"

for number in range(1_000_000):
    candidate = f"{number:06d}"
    digest = hashlib.md5(candidate.encode()).hexdigest()

    if digest == target:
        print("found:", candidate)
        break
```

输出：

```text
found: 123456
```

### 1.3.7 盐对爆破的影响

错误理解：

> 加盐后就无法爆破。

实际情况：

```text
已知 password 与 salt 的组合方式
        ↓
每个候选都带上同一个 salt 重新计算
        ↓
仍然可以验证猜测
```

盐主要阻止预计算与批量复用，不会把弱密码变强。

---

## 1.4 PHP 比较规则

### 1.4.1 弱比较与强比较

| 运算符 | 是否转换类型 |
|---|---|
| `==` | 会进行类型转换 |
| `!=` | 会进行类型转换 |
| `===` | 类型和值都必须相同 |
| `!==` | 类型或值不同即成立 |

示例：

```php
var_dump('1' == 1);
var_dump('1' === 1);
```

结果：

```text
bool(true)
bool(false)
```

### 1.4.2 数字字符串

这些属于数字字符串：

```text
0
123
-10
1.5
1e3
0e123456
```

`0e123456` 会被解释为：

```text
0 × 10^123456 = 0
```

因此：

```php
var_dump('0e123' == '0e999');
```

结果为：

```text
bool(true)
```

因为两边都是数字字符串，数值都是 0。

### 1.4.3 PHP 7 与 PHP 8 的关键差异

| 表达式 | PHP 7 | PHP 8 |
|---|---:|---:|
| `0 == "foo"` | `true` | `false` |
| `0 == ""` | `true` | `false` |
| `0 == "0"` | `true` | `true` |
| `"10" == "1e1"` | `true` | `true` |
| `"0e123" == "0e456"` | `true` | `true` |

PHP 8 改变的是"数字和非数字字符串"的比较。

Magic Hash 两边都是数字字符串，所以经典的两个 `0e...` 摘要弱比较在 PHP 8 中仍然成立。

### 1.4.4 "万能 0"为什么依赖版本

危险代码：

```php
if (md5($input) == $userHash) {
    echo 'success';
}
```

在旧版 PHP 中，如果 `$userHash` 是数字 0，而真实摘要是非数字字符串，弱比较可能把真实摘要转换为 0。

但是：

- GET 中 `hash=0` 通常是字符串 `"0"`；
- JSON 中 `{"hash":0}` 才是整数 `0`；
- PHP 8 对数字与非数字字符串的比较规则已经改变；
- 不能把"提交 0"当成跨版本通用 payload。

### 1.4.5 其他会进行弱比较的位置

`in_array()` 默认第三个参数为 `false`：

```php
if (in_array($role, ['guest', 'admin'])) {
    // 非严格比较
}
```

安全写法：

```php
if (in_array($role, ['guest', 'admin'], true)) {
    // 严格比较
}
```

`switch` 的匹配也受非严格比较规则影响。

审计时还要关注：

```text
array_search
switch
sort / unique 类函数
用户自定义比较逻辑
数据库取出后的字符串与 JSON 数字比较
```

---

## 1.5 Magic Hash

### 1.5.1 Magic Hash 的条件

十六进制摘要满足：

```regex
^0+e[0-9]+$
```

也就是：

1. 开头是一个或多个 `0`；
2. 接着是 `e`；
3. 后面全部为十进制数字；
4. 不能出现 `a` 到 `f`。

下面是 Magic Hash：

```text
0e462097431906509019562988736854
```

下面不是：

```text
0e3a5f2a80db371d4610b8f940d296af
```

因为 `e` 后出现了 `a`、`f` 等字母，它不是合法的数字字符串。

### 1.5.2 MD5 Magic Hash 完整表

| 明文 | MD5 |
|---|---|
| `QNKCDZO` | `0e830400451993494058024219903391` |
| `240610708` | `0e462097431906509019562988736854` |
| `s878926199a` | `0e545993274517709034328855841020` |
| `s155964671a` | `0e342768416822451524974117254469` |

验证：

```php
$a = md5('QNKCDZO');
$b = md5('240610708');

var_dump($a);
var_dump($b);
var_dump($a == $b);
var_dump($a === $b);
```

结果：

```text
string(32) "0e830400451993494058024219903391"
string(32) "0e462097431906509019562988736854"
bool(true)
bool(false)
```

### 1.5.3 SHA-1 Magic Hash 完整表

| 明文 | SHA-1 |
|---|---|
| `10932435112` | `0e07766915004133176347055865026311692244` |
| `aaroZmOk` | `0e66507019969427134894567494305185566735` |
| `aaK1STfY` | `0e76658526655756207688271159624026011393` |

验证：

```php
$a = sha1('10932435112');
$b = sha1('aaroZmOk');

var_dump($a == $b);
var_dump($a === $b);
```

### 1.5.4 典型双输入题

源码：

```php
if (
    $a !== $b
    && md5($a) == md5($b)
) {
    echo $flag;
}
```

Payload：

```text
a=QNKCDZO&b=240610708
```

分析：

```text
a !== b
成立
        ↓
md5(a) 与 md5(b) 都是 0e + 全数字
        ↓
弱比较时都转换为数字 0
        ↓
md5(a) == md5(b)
成立
```

### 1.5.5 已知摘要比较

源码：

```php
$known = '0e830400451993494058024219903391';

if (md5($password) == $known) {
    echo 'login success';
}
```

只要提交另一个 MD5 Magic Hash 明文，例如：

```text
240610708
```

即使两个摘要字符串不同，弱比较仍可能相等。

### 1.5.6 MD5 自身弱比较

源码：

```php
if ($a == md5($a)) {
    echo $flag;
}
```

Payload：

```text
a=0e215962017
```

因为：

```text
a      = 0e215962017
md5(a) = 0e291242476940776845150308577824
```

两边作为数字字符串比较时都等于 0。

### 1.5.7 双重哈希不能只看 `0e` 前缀

源码：

```php
if (md5(md5($a)) == md5(md5($b))) {
    echo $flag;
}
```

此时必须检查**最终一次 MD5** 是否完整满足：

```regex
^0+e[0-9]+$
```

例如：

```text
0e3a5f2a80db371d4610b8f940d296af
```

虽然以 `0e` 开头，但后面含有字母，不是 Magic Hash。

验证候选脚本：

```python
import hashlib
import re

magic = re.compile(r"^0+e[0-9]+$", re.I)

candidates = [
    "CbDLytmyGm2xQyaLNhWn",
    "770hQgrBOjrcqftrlaZk",
]

for value in candidates:
    first = hashlib.md5(value.encode()).hexdigest()
    second = hashlib.md5(first.encode()).hexdigest()

    print(
        value,
        first,
        second,
        bool(magic.fullmatch(second))
    )
```

不要仅凭别人整理的 payload 表，必须在本地按题目相同的编码和哈希顺序验证。

### 1.5.8 搜索 Magic Hash

```python
import hashlib
import itertools
import re

magic = re.compile(r"^0+e[0-9]+$", re.I)

for number in itertools.count():
    value = str(number)
    digest = hashlib.md5(value.encode()).hexdigest()

    if magic.fullmatch(digest):
        print(value, digest)
        break
```

纯 CPU 搜索可能很慢，实际可使用 GPU 或已公开的候选表。

### 1.5.9 Magic Hash 的限制

必须同时满足：

- 比较使用 `==` 或其他弱比较；
- 摘要为可打印十六进制字符串；
- 摘要满足完整数字字符串格式；
- 输入可以构造出对应摘要；
- 中间没有额外前缀、后缀、盐或编码改变结果；
- 业务没有先做严格类型检查。

只要使用 `===`，Magic Hash 就无法让两个不同摘要相等。

---

## 1.6 类型混淆与数组绕过

### 1.6.1 数组参数

普通参数：

```text
?a=test
```

PHP 中：

```php
$a = 'test';
```

数组参数：

```text
?a[]=test
```

PHP 中：

```php
$a = ['test'];
```

### 1.6.2 旧版 PHP 的哈希数组绕过

典型源码：

```php
if (
    $a != $b
    && md5($a) === md5($b)
) {
    echo $flag;
}
```

旧版部分 PHP 环境中，把数组传给需要字符串的内部函数会产生警告并返回 `NULL`。

Payload：

```text
a[]=1&b[]=2
```

可能形成：

```text
a != b
成立

md5(a) → NULL
md5(b) → NULL

NULL === NULL
成立
```

### 1.6.3 PHP 8 的变化

PHP 8 对内部函数非法参数类型采用更一致的错误行为。

数组传给：

```php
md5($array);
sha1($array);
strcmp($array, 'test');
```

通常会抛出 `TypeError`，程序中断，而不是返回可比较的 `NULL`。

所以数组绕过必须标明：

> 主要针对旧版 PHP 行为，PHP 8 默认通常不成立。

如果应用自己捕获 `TypeError` 并把多个失败都转成同一个值，则要重新分析自定义错误处理逻辑。

### 1.6.4 `strcmp()` 数组绕过

危险代码：

```php
if (!strcmp($_POST['password'], $secret)) {
    echo $flag;
}
```

旧版环境中：

```text
password[]=x
```

可能让 `strcmp()` 返回 `NULL`。

随后：

```text
!NULL
```

为真，从而进入分支。

PHP 8 通常会直接抛出 `TypeError`。

### 1.6.5 JSON 类型混淆

源码：

```php
$data = json_decode(file_get_contents('php://input'), true);

if ($data['token'] == $expected) {
    echo 'success';
}
```

请求：

```json
{"token":0}
```

这里的 token 是整数，不是字符串。

是否能绕过取决于：

- `$expected` 的类型与内容；
- PHP 版本；
- 是否为数字字符串；
- 是否使用严格比较。

PHP 7 中 `0 == "non-numeric"` 的旧行为不能直接套到 PHP 8。

### 1.6.6 防御类型混淆的第一步

在哈希之前先验证类型：

```php
if (!is_string($input)) {
    die('invalid input type');
}
```

对 JSON：

```php
if (
    !array_key_exists('token', $data)
    || !is_string($data['token'])
) {
    die('invalid token');
}
```

---

## 1.7 强比较与真实碰撞

### 1.7.1 强比较为什么挡住 Magic Hash

```php
var_dump(
    '0e123' === '0e456'
);
```

结果：

```text
bool(false)
```

`===` 不会把字符串转换成数字。

如果题目要求：

```php
$a !== $b
&& md5($a) === md5($b)
```

需要的是：

- 真正的 MD5 碰撞；
- 或旧版 PHP 的错误返回值绕过；
- 或题目其他业务逻辑漏洞。

### 1.7.2 MD5 碰撞示例（完整 hex payload）

下面两段 128 字节数据不同，但 MD5 相同。

```python
import hashlib
from urllib.parse import quote_from_bytes

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

print(a != b)
print(hashlib.md5(a).hexdigest())
print(hashlib.md5(b).hexdigest())

print("a=" + quote_from_bytes(a, safe=""))
print("b=" + quote_from_bytes(b, safe=""))
```

输出摘要：

```text
79054025255fb1a26e4bc422aef54eb4
79054025255fb1a26e4bc422aef54eb4
```

### 1.7.3 二进制数据传输

碰撞块不是普通文本。

可能需要：

- 百分号编码；
- `multipart/form-data` 文件上传；
- 十六进制传输后服务端 `hex2bin()`；
- Base64 传输后服务端解码；
- BurpSuite 直接编辑原始请求；
- 脚本发送原始字节。

如果数据经过：

```text
字符集转换
换行转换
JSON Unicode 转义
字符串 trim
Base64 解码差异
```

碰撞可能被破坏。

### 1.7.4 文件碰撞场景

源码：

```php
if (
    file_get_contents($file1) !== file_get_contents($file2)
    && md5_file($file1) === md5_file($file2)
) {
    echo $flag;
}
```

此时可以提交两个不同的碰撞文件。

如果应用还会解析文件内容，就要继续确认：

- 两个文件都能通过格式检查；
- 解析器是否允许碰撞块；
- 文件后缀和 MIME 是否符合要求；
- 服务器是否会重编码文件；
- 哈希的是原始上传文件还是处理后的文件。

### 1.7.5 相同前缀与选择前缀碰撞

**相同前缀碰撞：**

```text
相同前缀 P
   + 不同碰撞块 A / B
   + 相同后缀 S
```

得到：

```text
H(P || A || S) = H(P || B || S)
```

**选择前缀碰撞：**

```text
不同前缀 P1 / P2
   + 分别构造的补偿块
```

最终摘要相同。

选择前缀碰撞更灵活，也通常更复杂、更昂贵。

### 1.7.6 SHA-1 SHAttered

SHAttered 公布了两个不同的 PDF 文件，它们具有相同 SHA-1：

```text
38762cf7f55934b34d179ae6a4c80cadccbb7f0a
```

验证：

```bash
sha1sum shattered-1.pdf shattered-2.pdf
sha256sum shattered-1.pdf shattered-2.pdf
```

预期：

- SHA-1 相同；
- SHA-256 不同；
- 文件内容不同。

这是一对固定的公开碰撞文件，不能把它理解成"对任意目标 PDF 都能瞬间生成第二个同 SHA-1 文件"。

### 1.7.7 SHA-256 怎么办

对完整 SHA-256，目前不应期待像 MD5 那样直接使用公开实用碰撞。

看到：

```php
hash('sha256', $a) === hash('sha256', $b)
```

优先检查：

- 数组和异常处理；
- 摘要是否截断；
- 输入是否被规范化；
- 哈希前后是否存在解析差异；
- 是否只比较前几个字符；
- 是否存在长度扩展；
- 是否有业务逻辑漏洞。

不要把 MD5 碰撞块直接套到 SHA-256。

### 1.7.8 碰撞并不总能绕过指定哈希

源码：

```php
if (md5($input) === '5f4dcc3b5aa765d61d8327deb882cf99') {
    echo $flag;
}
```

这里要求命中一个指定摘要。

普通"找任意一对 MD5 碰撞"没有直接帮助。更接近的任务是原像或第二原像。

---

## 1.8 哈希长度扩展攻击

### 1.8.1 漏洞模式

危险 MAC：

```text
MAC = Hash(secret || message)
```

常见：

```php
$mac = hash(
    'sha256',
    $secret . $message
);
```

如果攻击者知道：

- 原始 `message`；
- `Hash(secret || message)`；
- 或能猜测 secret 长度；

就可能构造：

```text
message || padding || extension
```

以及对应的新摘要。

### 1.8.2 为什么可以继续算

MD5、SHA-1、SHA-256 等常见 Merkle–Damgard 结构会按块更新内部状态。

```text
secret || message
        ↓
分块压缩
        ↓
最终内部状态
        ↓
输出摘要
```

摘要暴露了足够的最终状态信息，使攻击者能够从该状态继续处理额外数据。

攻击者不知道 secret 的内容，但需要知道或猜测：

```text
len(secret)
```

因为填充内容包含原始消息总长度。

### 1.8.3 能扩展成什么

已知：

```text
message = user=guest&admin=0
mac     = SHA256(secret || message)
```

想追加：

```text
&admin=1
```

构造：

```text
user=guest&admin=0
+ SHA-256 padding
+ &admin=1
```

得到：

```text
new_message
new_mac
```

服务器重新计算：

```text
SHA256(secret || new_message)
```

可能与攻击者生成的 `new_mac` 相同。

### 1.8.4 解析器语义很重要

追加：

```text
&admin=1
```

能否覆盖原来的 `admin=0`，取决于服务器如何处理重复参数。

| 解析策略 | 可能结果 |
|---|---|
| 第一个值生效 | `admin=0` |
| 最后一个值生效 | `admin=1` |
| 形成数组 | `["0...", "1"]` |
| 直接拒绝重复参数 | 攻击失败 |

长度扩展只解决签名问题，业务解析必须另外分析。

### 1.8.5 HashPump

示意：

```bash
hashpump \
  --keylength 16 \
  --signature '<原始摘要>' \
  --data 'user=guest&admin=0' \
  --additional '&admin=1'
```

工具通常输出：

- 新摘要；
- 带原始 padding 的新消息。

如果 secret 长度未知，可以尝试一个合理范围：

```text
1
2
3
...
64
```

每个长度会生成不同 padding 和新摘要。

### 1.8.6 Python 调用 HashPump 类库（完整示例）

```python
import hashpumpy

original_hash = "0123456789abcdef" * 4
original_data = b"user=guest&admin=0"
append_data = b"&admin=1"
secret_length = 16

new_hash, new_data = hashpumpy.hashpump(
    original_hash,
    original_data,
    append_data,
    secret_length,
)

print(new_hash)
print(new_data.hex())
```

不同版本的 Python 与扩展可能存在兼容性问题，工具报错时可改用独立 `hash_extender` 或命令行 HashPump。

### 1.8.7 完整易受攻击源码

```php
<?php
$secret = 'hidden-secret';
$dataHex = $_GET['data'] ?? '';
$userMac = $_GET['mac'] ?? '';

$data = hex2bin($dataHex);

if ($data === false) {
    die('bad data');
}

$serverMac = hash(
    'sha256',
    $secret . $data
);

if (!hash_equals($serverMac, $userMac)) {
    die('bad mac');
}

parse_str($data, $params);

if (
    isset($params['admin'])
    && $params['admin'] === '1'
) {
    echo $flag;
}
```

即使比较使用了 `hash_equals()`，MAC 构造本身仍然错误。

`hash_equals()` 防止比较问题和部分计时泄漏，但不能修复 `Hash(secret || message)` 的长度扩展结构。

### 1.8.8 哪些情况通常不适用

长度扩展一般不能直接用于：

```text
Hash(message || secret)
HMAC(secret, message)
bcrypt
Argon2
SHA-3
只知道 hash(message) 而不知道 message
```

正确 MAC：

```php
$mac = hash_hmac(
    'sha256',
    $message,
    $secret
);
```

验证：

```php
if (hash_equals($expectedMac, $userMac)) {
    echo 'valid';
}
```

---

## 1.9 特殊哈希场景

### 1.9.1 原始 MD5 二进制导致 SQL 注入

危险代码：

```php
$digest = md5($password, true);

$sql = "
    SELECT *
    FROM users
    WHERE password = '$digest'
";
```

已知输入：

```text
ffifdyop
```

其原始 MD5 十六进制为：

```text
276f722736c95d99e921722cf9ed621c
```

开头字节对应：

```text
'or'6
```

Python 验证：

```python
import hashlib

digest = hashlib.md5(b"ffifdyop").digest()

print(digest.hex())
print(repr(digest))
```

如果原始二进制被直接拼接进 SQL，可能改变 SQL 语句结构。

这不是 Magic Hash，也不是真碰撞，而是：

> 原始二进制摘要包含了对下游解析器有特殊意义的字节。

正确做法是参数化查询，不能拼接任何二进制摘要。

### 1.9.2 截断哈希

危险代码：

```php
$short = substr(
    hash('sha256', $data),
    0,
    6
);
```

只保留 6 个十六进制字符，相当于只保留 24 bit。

可能搜索空间：

```text
16^6 = 2^24
```

远小于完整 SHA-256。

Python 演示：

```python
import hashlib
import itertools

target = hashlib.sha256(
    b"secret-value"
).hexdigest()[:6]

for number in itertools.count():
    candidate = str(number).encode()
    short = hashlib.sha256(candidate).hexdigest()[:6]

    if short == target:
        print(candidate.decode(), short)
        break
```

### 1.9.3 只比较摘要前缀

危险代码：

```php
if (
    substr($userHash, 0, 8)
    === substr($realHash, 0, 8)
) {
    echo 'valid';
}
```

8 个十六进制字符只有 32 bit。

如果攻击者能自由尝试，前缀碰撞或目标前缀搜索可能变得可行。

### 1.9.4 数据库字段截断

如果数据库字段只保存前 16 个字符：

```sql
hash varchar(16)
```

而程序计算完整 MD5：

```php
$hash = md5($password);
```

最终验证可能只依赖半个摘要。

审计时要同时检查：

- 代码中的算法；
- 数据库字段长度；
- ORM 是否截断；
- 是否忽略写入错误。

### 1.9.5 CRC32 不是安全签名

CRC32 设计用于发现传输错误，不具备密码学碰撞抗性。

危险代码：

```php
$signature = crc32(
    $secret . $data
);
```

不能把 CRC32 当成 MAC。

可能问题：

- 碰撞容易；
- 结构具有线性性质；
- 输出只有 32 bit；
- 不同平台的整数显示形式可能不同；
- 暴力搜索空间较小。

### 1.9.6 签名对象和解析对象不一致

危险流程：

```text
对原始字符串做哈希
        ↓
验证通过
        ↓
URL 解码 / JSON 解析 / 参数合并
        ↓
执行业务逻辑
```

重点检查：

- 重复参数谁生效；
- `+` 与 `%20` 是否等价；
- 大小写规范化；
- Unicode 规范化；
- JSON 键顺序；
- 重复 JSON 键；
- 尾随空白；
- 换行差异；
- Base64 是否允许无效字符；
- 签名的是编码前还是解码后数据。

安全原则：

> 签名和业务解析必须针对同一组规范化后的精确字节。

### 1.9.7 文件哈希与 TOCTOU

危险流程：

```text
第一次打开文件计算哈希
        ↓
文件路径可被替换
        ↓
第二次重新打开文件解析
```

如果两次打开之间文件可被替换，就可能出现条件竞争。

防御：

- 对同一个已打开文件描述符操作；
- 校验后移动到不可变位置；
- 避免再次按用户可控路径打开；
- 哈希不能代替原子文件处理。

### 1.9.8 低熵 Token

危险代码：

```php
$token = md5(
    $username . time()
);
```

即使 MD5 输出看起来很长，输入空间可能只有：

- 已知用户名；
- 几秒范围的时间戳。

攻击者可以枚举输入而不是攻击哈希本身。

安全 Token 应使用：

```php
$token = bin2hex(
    random_bytes(32)
);
```

---

## 1.10 完整例题一：Magic Hash

### 1.10.1 题目源码

```php
<?php
$a = $_GET['a'] ?? '';
$b = $_GET['b'] ?? '';

if (!is_string($a) || !is_string($b)) {
    die('string only');
}

if (
    $a !== $b
    && md5($a) == md5($b)
) {
    echo 'flag{example_flag}';
} else {
    echo 'failed';
}
```

### 1.10.2 分析第一层条件

```php
$a !== $b
```

要求两个输入不同。

所以不能提交完全相同的明文。

### 1.10.3 分析第二层条件

```php
md5($a) == md5($b)
```

这里使用 `==`，存在类型转换。

选择：

```text
a = QNKCDZO
b = 240610708
```

计算：

```text
md5(a) = 0e830400451993494058024219903391
md5(b) = 0e462097431906509019562988736854
```

### 1.10.4 构造请求

```http
GET /challenge.php?a=QNKCDZO&b=240610708 HTTP/1.1
Host: target
Connection: close
```

### 1.10.5 为什么成功

```text
QNKCDZO !== 240610708
成立
        ↓
两个摘要都是数字字符串
        ↓
0e... == 0e...
按数字比较
        ↓
0 == 0
成立
```

### 1.10.6 如果改成强比较

```php
md5($a) === md5($b)
```

当前 payload 失败，因为两个摘要的文本并不相同。

这时应转向：

- 真 MD5 碰撞；
- 旧版数组绕过；
- 其他业务逻辑。

---

## 1.11 完整例题二：MD5 强碰撞

### 1.11.1 题目源码

```php
<?php
$a = hex2bin($_POST['a'] ?? '');
$b = hex2bin($_POST['b'] ?? '');

if ($a === false || $b === false) {
    die('bad hex');
}

if (
    $a !== $b
    && md5($a) === md5($b)
) {
    echo 'flag{example_flag}';
}
```

### 1.11.2 条件分析

要求：

```text
a 与 b 原始字节不同
MD5 十六进制摘要完全相同
```

Magic Hash 不适用，因为使用 `===`。

### 1.11.3 生成提交数据

使用 11.7.2 的两个碰撞块：

```python
import requests

url = "http://target/challenge.php"

data = {
    "a": a.hex(),
    "b": b.hex(),
}

response = requests.post(
    url,
    data=data,
    timeout=10,
)

print(response.text)
```

这里题目先 `hex2bin()`，避免二进制字节在表单传输中被破坏。

### 1.11.4 为什么成功

```text
a !== b
        ↓
md5(a) 与 md5(b) 的文本完全相同
        ↓
=== 强比较也成立
```

---

## 1.12 完整例题三：长度扩展

### 1.12.1 已知信息

客户端得到：

```text
data = user=guest&admin=0
mac  = SHA256(secret || data)
```

目标：

```text
追加 &admin=1
```

### 1.12.2 分析前提

确认：

- 摘要算法为 SHA-256；
- MAC 构造是 `secret || data`；
- 原始 data 已知；
- secret 内容未知；
- secret 长度可以猜测；
- data 可以携带原始 padding 字节；
- 参数解析采用最后一个同名值。

### 1.12.3 枚举 secret 长度

```python
import requests
import hashpumpy

url = "http://target/check.php"

original_mac = "<known_sha256>"
original_data = b"user=guest&admin=0"
append_data = b"&admin=1"

for secret_length in range(1, 65):
    new_mac, new_data = hashpumpy.hashpump(
        original_mac,
        original_data,
        append_data,
        secret_length,
    )

    response = requests.get(
        url,
        params={
            "data": new_data.hex(),
            "mac": new_mac,
        },
        timeout=5,
    )

    if "flag{" in response.text:
        print("secret length:", secret_length)
        print(response.text)
        break
```

### 1.12.4 失败时检查

- 工具是否支持目标算法；
- 原始数据是否完全一致；
- 空格和编码是否一致；
- secret 在前还是在后；
- 服务端是否对数据做 Base64、hex 或 URL 解码；
- 重复参数谁生效；
- secret 长度范围；
- MAC 是否其实是 HMAC；
- 签名是否覆盖额外字段。

---

## 1.13 源码审计

### 1.13.1 搜索关键词

```text
md5(
md5_file(
sha1(
sha1_file(
hash(
hash_file(
hash_hmac(
hash_equals(
password_hash(
password_verify(
crc32(
strcmp(
strncmp(
substr(
in_array(
array_search(
== 
!=
=== 
!==
```

### 1.13.2 审计数据流

```text
用户输入
   ↓
类型转换
   ↓
编码 / 解码 / 规范化
   ↓
哈希或 MAC
   ↓
摘要截断或存储
   ↓
比较
   ↓
业务解析
   ↓
权限判断
```

每一层都要确认使用的是同一份数据。

### 1.13.3 审计检查表

- [ ] 用户输入实际类型是什么？
- [ ] PHP 版本是什么？
- [ ] 比较使用 `==` 还是 `===`？
- [ ] 是否存在数字字符串？
- [ ] 是否能提交数组参数？
- [ ] 是否接受 JSON 数字、布尔值或 `null`？
- [ ] 内部函数错误会返回值还是抛出异常？
- [ ] 摘要是十六进制还是原始二进制？
- [ ] 是否只比较摘要的一部分？
- [ ] 数据库字段是否存得下完整摘要？
- [ ] 密码是否使用快速哈希？
- [ ] 盐是否随机且每个用户独立？
- [ ] 签名是否使用 `Hash(secret || data)`？
- [ ] 是否使用 HMAC？
- [ ] 签名对象与业务解析对象是否相同？
- [ ] 文件校验后是否重新打开？
- [ ] 是否使用 CRC32 作为安全校验？
- [ ] 是否存在可预测 Token？
- [ ] 是否直接把原始摘要拼入 SQL？
- [ ] 错误信息是否泄露算法、盐或格式？

---

## 1.14 工具与验证方法

### 1.14.1 常见工具

| 工具 | 用途 |
|---|---|
| Hashcat | GPU 密码爆破 |
| John the Ripper | 字典、规则与多种密码格式 |
| hashid | 哈希类型初步识别 |
| HashPump / hashpumpy | 长度扩展 |
| hash_extender | 多算法长度扩展 |
| HashClash / FastColl | MD5 碰撞构造 |
| SHAttered 样本 | SHA-1 碰撞验证 |
| BurpSuite | 修改参数类型与原始字节 |
| Python hashlib | 本地快速验证 |

### 1.14.2 每个 payload 都先本地验证

Magic Hash：

```php
var_dump(
    md5('QNKCDZO')
    == md5('240610708')
);
```

强碰撞：

```python
assert a != b
assert hashlib.md5(a).digest() == hashlib.md5(b).digest()
```

长度扩展：

先在本地写出相同验证逻辑，固定一个已知 secret，确认工具输出能通过，再请求题目。

### 1.14.3 确认 PHP 版本

```bash
php -v
```

或源码：

```php
echo PHP_VERSION;
```

同一 payload 在 PHP 7 与 PHP 8 上可能得到完全不同的结果。

### 1.14.4 枚举运行时支持的算法

```php
print_r(hash_algos());
print_r(hash_hmac_algos());
```

不要仅根据笔记假设目标一定支持某个算法。
