---

title: PHP特性
date: 2026-07-15
categories: [web安全, 常见漏洞]
recommend: 96
type: tech
---




# 1.PHP 特性

PHP有很多反直觉的设计。弱比较会把'admin'==0判定为true，strcmp在PHP8之前和数组比较会返回0。理解这些特性是绕过PHP题目的关键。

PHP 在 CTF Web 题目中出现频率极高，不同版本的 PHP 在函数行为、语法特性、安全机制上存在显著差异。掌握这些差异是快速解题的关键。

---


## 1.1 PHP 类型弱比较（Type Juggling）

PHP 使用 `==` 进行弱比较时，会自动进行类型转换。这是 CTF 中最常考到的 PHP 特性之一。

**核心规则：**

PHP 在比较不同类型时会按比较规则进行类型转换；具体规则取决于两侧类型，并不是统一"都转成同一种类型"。尤其是 PHP 8.0 修改了数字与非数字字符串的比较规则。

常见转换规律：

| 表达式 | 结果 / 版本 | 原因 |
| ----------------------- | ----------- | ------------------------------------------------------- |
| `"admin" == 0` | PHP 7 及之前为 `true`；PHP 8 为 `false` | PHP 8 不再把非数字字符串按 `0` 与数字比较 |
| `"123abc" == 123` | PHP 7 及之前为 `true`；PHP 8 为 `false` | PHP 7 会取前导数字，PHP 8 将其视为非数字字符串 |
| `"abc123" == 0` | PHP 7 及之前为 `true`；PHP 8 为 `false` | 同上 |
| `"0e123456" == "0e999"` | `true` | 两边都是合法数字字符串，数值都为 `0` |
| `null == false` | `true` | 两者在弱比较中等价 |
| `[] == false` | `true` | 空数组转布尔为 `false` |
| `true == 1` | `true` | 与布尔值比较时另一侧转为布尔值 |

### 1.1.1 `strcmp()` 绕过

```php
// PHP 7 及之前：传入数组通常产生 Warning 并返回 NULL，NULL == 0 成立
// PHP 8：参数类型不匹配会抛出 TypeError
if (strcmp($_GET['password'], $secret) == 0) {
    echo $flag;
}
```

在受影响的 PHP 7 及之前环境中，传入 `?password[]=1` 可能绕过；PHP 8 中会中断，除非应用捕获并错误处理 `TypeError`。

### 1.1.2 `preg_match()` 绕过

```php
// 危险点：把"匹配失败/参数错误"和"没有匹配到非法字符"都按 == 0 处理
if (preg_match('/[^0-9]/', $_GET['id']) == 0) {
    echo $flag;
}
```

PHP 7 及之前传入 `?id[]=1` 时，参数错误可能返回 `false` / `NULL`，弱比较下等于 `0`，从而进入分支。原先写成 `if (!preg_match('/^[0-9]+$/', ...)) die(...)` 会把错误结果也拒绝掉，不能用数组绕过。PHP 8 对数组参数会抛出 `TypeError`。

### 1.1.3 `in_array()` 弱比较绕过

```php
// in_array() 默认使用 == 弱比较
$whitelist = [1, 2, 3];
if (in_array($_GET['id'], $whitelist)) {
    // 传入 ?id=1' union select ... 可以绕过
    // 因为 "1' union select ..." == 1 为 true
}
```

`in_array()` 的第三个参数 `strict` 早已存在，并非 PHP 8 新增；应显式使用 `in_array($value, $whitelist, true)`。PHP 8 同时修改了数字与非数字字符串的弱比较规则，因此上面的非数字尾缀 Payload 主要影响 PHP 7 及之前。

### 1.1.4 `is_numeric()` 的边界

```php
// 科学计数法字符串会被 is_numeric() 视为数字
if (is_numeric($_GET['id'])) {
    $sql = "SELECT * FROM users WHERE id = " . $_GET['id'];
}
```

例如 `?id=1e3` 会通过并在数值上下文表示 `1000`。但 HTTP 参数中的字符串 `0x539` 并不会被 `is_numeric()` 识别为数字，不能用所谓"十六进制字符串编码 SQL"绕过。`is_numeric()` 也不是 SQL 注入防护；查询仍应使用参数化语句。

### 1.1.5 switch 语句弱比较

```php
$role = json_decode(file_get_contents('php://input'), true)['role'];
switch ($role) {
    case 'admin':
        echo $flag;
        break;
}
// PHP 7 及之前，JSON 数字 0 可能与非数字字符串 'admin' 弱比较相等
```

普通 GET 的 `?role=0` 得到字符串 `"0"`，与字符串 `"admin"` 比较时不会命中。只有输入通道真的产生整数 `0` 或布尔值 `true`（例如 JSON 解析结果）时，才适用相应跨类型规则；PHP 8 中整数 `0` 与非数字字符串的比较规则已改变。

---

## 1.2 PHP 5.x 特有的安全特性

### 1.2.1 `register_globals`（PHP 4.2+ 默认关闭，PHP 5.4 移除）

`register_globals = On` 时，GET、POST、Cookie 中的参数会自动注册为全局变量。

```php
// register_globals = On 时
// 访问 ?username=admin
echo $username; // 输出 admin，无需 $_GET['username']
```

**CTF 中的应用：**

```php
<?php
// 题目逻辑：验证通过才会设置 $authorized = true
if ($password === 'secret') {
    $authorized = true;
}
if ($authorized) {
    echo $flag;
}
?>
```

当 `register_globals = On` 时，直接访问 `?authorized=1` 即可绕过验证。`$authorized` 会被自动赋值为字符串 `"1"`，在 `if` 中属于真值。

### 1.2.2 `magic_quotes_gpc`（PHP 5.4 移除）

`magic_quotes_gpc = On` 时，所有 GET、POST、Cookie 中的 `'`、`"`、`\`、`NULL` 字符会自动加上反斜杠转义。

```php
// magic_quotes_gpc = On
// 输入: ' OR '1'='1
// 实际 $_GET['id'] = \' OR \'1\'=\'1
```

这是早期 PHP 防御 SQL 注入的措施，但并不可靠。CTF 中遇到老版本时需要注意 payload 是否被自动转义。

**绕过思路：**
- 使用宽字节注入（GBK 编码下 `%df'` → `運'`，反斜杠被吃掉）
- 不依赖引号的注入方式（数字型注入）

### 1.2.3 `safe_mode`（PHP 5.4 移除）

`safe_mode` 曾按脚本与目标文件的 UID/GID 等条件限制部分文件操作和命令执行函数，但它不是可靠的沙箱，也不等同于"只能操作当前目录"。

CTF 老题目中可能遇到，现代 CTF 中基本不出现。

### 1.2.4 `%00` 截断（PHP 5.3.4 及之前）

`%00`（NULL 字节）可以截断字符串，是 PHP 5.3.x 及更早版本的经典漏洞。

**文件上传截断：**

```php
// PHP < 5.3.4, magic_quotes_gpc = Off
// 上传 1.php%00.jpg → $filename = "1.php"（后面的被截断）
```

**文件包含截断：**

```php
<?php
include($_GET['page'] . ".php");
// 访问 ?page=../../../etc/passwd%00
// 实际 include: ../../../etc/passwd\0.php → 等价于 ../../../etc/passwd
```

PHP 5.3.4 之后修复了 `%00` 截断，需要 `magic_quotes_gpc = Off` 且允许可控路径。

---

## 1.3 PHP 7.x 的关键变化

### 1.3.1 `preg_replace()` 的 `/e` 修饰符移除（PHP 7.0）

`/e` 修饰符会对替换内容执行 `eval()`，在 PHP 5.x 中是一个经典 RCE 点。

```php
// PHP 5.x，存在 /e 修饰符
// preg_replace('/test/e', 'strtoupper("\\1")', $_GET['input']);

// CTF 中如果遇到 PHP 5.x + preg_replace，可以尝试：
// ?input=test 时触发代码执行
// 利用方式：preg_replace('/.*/e', $_GET['code'], 'test');
// ?code=system('cat /flag');
```

PHP 7.0 起 `/e` 修饰符被移除，遇到需要使用 `/e` 的题目说明是 PHP 5.x。

### 1.3.2 `assert()` 行为变化

PHP 8.0 之前，`assert()` 的字符串参数会作为 PHP 代码通过 `eval()` 执行；PHP 7.2 起这一行为弃用，PHP 8.0 起字符串只按普通断言值处理：

```php
// PHP 5.x / 7.x（断言功能已启用时）
assert("system('ls')"); // 旧行为：执行字符串代码；PHP 7.2 起 Deprecated
// PHP 8.x
assert("system('ls')"); // 非空字符串为真，不执行其中代码
```

PHP 7.2 至 7.4 中，字符串断言会触发 `Deprecated`；PHP 8 已移除此代码执行行为。

从 PHP 7.0 开始，可以通过 `zend.assertions` 配置项控制 `assert()` 行为：

| `zend.assertions` | 含义 |
| ----------------- | -------------------------- |
| `1` | 生成并执行代码（开发模式） |
| `0` | 生成但不执行代码 |
| `-1` | 完全不生成代码（生产模式） |

在 CTF 中，如果遇到 `eval(assert(...))` 的组合或者可控的 `assert()` 参数，需要注意 PHP 版本。

### 1.3.3 `create_function()` 弃用（PHP 7.2）

`create_function()` 底层使用 `eval()`，可以用来构造匿名函数：

```php
// PHP 7.2 之前
$func = create_function('$a, $b', 'return $a + $b;');
echo $func(1, 2); // 3

// CTF 中的注入场景：
// $func = create_function('', $_GET['code']);
// ?code=}system('cat /flag');//
// 通过闭合大括号进行代码注入
```

利用原理：`create_function()` 内部生成类似这样的代码：

```php
function __lambda_func() { return $a + $b; }
```

如果第二个参数（函数体）可控，可以通过 `}` 闭合函数体，注入任意代码。

PHP 7.2 起 `create_function()` 触发弃用警告，PHP 8.0 中彻底移除；调用不存在的函数会抛出 `Error`，不是 `TypeError`。

### 1.3.4 类型声明（PHP 7.0 引入）

PHP 7.0 起支持方法参数和返回值的类型声明：

```php
function sum(int $a, int $b): int {
    return $a + $b;
}
sum(1, 2);   // OK
sum('1', 2); // PHP 7.x 默认会强制转换为 int，结果为 3
```

CTF 中可能遇到利用严格类型声明绕过检查的题目。注意 `declare(strict_types=1)` 下强制类型检查，不匹配则报错。

---

## 1.4 PHP 8.x 的关键变化

### 1.4.1 比较行为变得严格

PHP 8.0 中 `0 == ""` 从 `true` 变成了 `false`：

| 表达式 | PHP 7.x | PHP 8.x |
| ------------ | ------- | ------- |
| `0 == ""` | `true` | `false` |
| `0 == "foo"` | `true` | `false` |
| `"" == false` | `true` | `true` |

这会影响依赖"数字与非数字字符串"弱比较的 EXP。`strcmp()` 数组绕过在 PHP 8 失效的直接原因则是参数类型错误改为抛出 `TypeError`，两者不要混为一谈。

### 1.4.2 `match` 表达式（PHP 8.0）

`match` 是 `switch` 的替代语法，使用严格比较（`===`）：

```php
// match 使用 ===，弱比较不成立
$result = match ($_GET['role']) {
    'admin' => $flag,
    default => 'nope',
};
// ?role=0 不能绕过（与 switch 不同）
```

### 1.4.3 命名参数（PHP 8.0）

```php
function login($username, $password) { ... }
// 调用时可以直接指定参数名：
// login(password: '123456', username: 'admin');
```

---

## 1.5 PHP 变量相关特性

### 1.5.1 可变变量

PHP 中可以用变量的值作为另一个变量的名称：

```php
$a = 'hello';
$$a = 'world';
echo $hello; // 输出 world

// CTF 中常见的利用：
// ${$_GET['var']} = $_GET['value'];
// ?var=flag&value=1 → 等效于 $flag = 1;
```

如果存在变量覆盖漏洞，可以通过可变变量修改任意全局变量。

### 1.5.2 `GLOBALS` 超全局变量

`$GLOBALS` 包含了所有全局变量：

```php
$flag = 'flag{test}';
echo $GLOBALS['flag']; // 输出 flag{test}

// 遍历 GLOBALS 获取 flag
foreach ($GLOBALS as $key => $value) {
    echo "$key => $value\n";
}
```

CTF 中常见于需要读取 `$flag` 变量但无法直接访问的场景。

### 1.5.3 `extract()` 变量覆盖

`extract()` 将数组中的键名作为变量名、键值作为变量值导入当前作用域：

```php
$auth = false;
extract($_GET);
// 访问 ?auth=1 → $auth 被覆盖为 1
if ($auth) {
    echo $flag;
}
```

### 1.5.4 `parse_str()` 变量覆盖

`parse_str()` 与 `extract()` 类似，可以将 URL 查询字符串解析为变量：

```php
$user = 'guest';
parse_str($_SERVER['QUERY_STRING']); // 仅 PHP 7 及之前可省略第二个参数
// 访问 ?user=admin → $user 被覆盖为 'admin'
```

省略结果参数的用法从 PHP 7.2 起弃用，PHP 8.0 起第二个参数必填；现代写法 `parse_str($query, $result)` 只填充 `$result` 数组，不会直接覆盖当前作用域变量。

---

## 1.6 PHP 字符串处理特性

### 1.6.1 字符串中变量解析

PHP 双引号字符串会自动解析变量：

```php
$name = 'admin';
echo "hello $name";   // hello admin
echo 'hello $name';   // hello $name（单引号不解析）
```

CTF 中需要注意双引号字符串可能造成意料之外的变量解析或代码执行。

### 1.6.2 Heredoc 和 Nowdoc

```php
// Heredoc（类似双引号，解析变量）
$str = <<<EOT
hello $name
EOT;

// Nowdoc（类似单引号，不解析变量）
$str = <<<'EOT'
hello $name
EOT;
```

### 1.6.3 PHP 标签格式

| 标签 | 是否始终可用 | 说明 |
| ------------------- | ------------ | ----------------------- |
| `<?php ?>` | 是 | 标准标签，始终可用 |
| `<?= ?>` | 是 (5.4+) | echo 简写 |
| `<? ?>`（短标签） | 否 需配置 | `short_open_tag = On` |
| `<% %>`（ASP 标签） | 否 旧版需 `asp_tags` | PHP 7.0 起移除 |
| `<script language="php">` | 否 仅旧版 | PHP 7.0 起移除 |

CTF 中上传 WebShell 时，如果 `<?php` 被过滤，PHP 7 之前的老环境才可能尝试 `<script language="php">`；短标签 `<?` 始终取决于 `short_open_tag` 配置，而 `<?=` 从 PHP 5.4 起始终可用。

---

## 1.7 PHP 函数绕过特性速查

| 绕过目标 | 方法 | 适用版本 |
| ----------------- | --------------------------- | --------------------- |
| `strcmp()` | 数组参数使旧版返回 `NULL`，再利用弱比较 | PHP 7 及之前；PHP 8 抛 `TypeError` |
| `preg_match()` | 仅当代码把错误返回值当作"未匹配" | PHP 7 及之前；PHP 8 抛 `TypeError` |
| `in_array()` | 第三个参数缺省或为 `false` 时利用弱比较 | 具体 Payload 取决于 PHP 比较规则；传 `true` 可避免 |
| `is_numeric()` | 科学计数法等合法数字格式边界 | 不是通用绕过；十六进制 HTTP 字符串不通过 |
| `md5()`/`sha1()` | 传入数组返回 `NULL` | PHP 7.x 及之前 |
| `intval()` | 只有 `base=0` 等特定调用才识别字符串 `0x...` | 取决于第二个参数和输入格式 |
| `preg_replace()` | `/e` 修饰符代码执行 | PHP 5.x 专属 |
| `create_function()` | 闭合 `}` 注入代码 | PHP 7.1 及之前 |
| `assert()` | 字符串参数按代码执行 | PHP 8 之前且断言启用；PHP 7.2 起弃用 |
| `filter_var()` | 检查 URL 解析与业务校验之间的差异 | 依赖 PHP 版本、过滤器和选项，不是通用绕过 |

---

## 1.8 PHP 版本差异速查

| 版本 | 发布时间 | CTF 中需要关注的关键变化 |
| ------ | -------- | -------------------------------------------------------------- |
| PHP 5.3 | 2009 | `register_globals`、`magic_quotes_gpc`、`safe_mode` 仍可配置但已不应依赖 |
| PHP 5.4 | 2012 | `register_globals`、`safe_mode`、`magic_quotes_gpc` 移除；`<?=` 始终可用 |
| PHP 5.5 | 2013 | `preg_replace` 的 `/e` 修饰符弃用 |
| PHP 5.6 | 2014 | 引入 `...` 变长参数；`hash_equals()` 防止时序攻击 |
| PHP 7.0 | 2015 | `preg_replace` 的 `/e` 移除；标量/返回类型声明；引入 `zend.assertions` |
| PHP 7.1 | 2016 | 可空类型、`void` 返回类型等语法变化 |
| PHP 7.2 | 2017 | `create_function()` 弃用；`each()` 弃用 |
| PHP 7.4 | 2019 | 短箭头函数 `fn() =>`；`mb_strrpos()` 严格类型检查 |
| PHP 8.0 | 2020 | `create_function()` 移除；`match` 表达式；命名参数；JIT 编译器 |
| PHP 8.1 | 2021 | Fibers；枚举类型；`never` 返回类型 |
