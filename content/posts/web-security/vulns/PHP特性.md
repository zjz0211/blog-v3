---
title: PHP特性
date: 2026-07-15
categories: [web安全, 常见漏洞]
recommend: 96
type: tech
---

# 1. PHP 特性

PHP有很多反直觉的设计。弱比较会把'admin'==0判定为true，strcmp在PHP8之前和数组比较会返回0。理解这些特性是绕过PHP题目的关键。

PHP 在 CTF Web 题目中出现频率极高，不同版本的 PHP 在函数行为、语法特性、安全机制上存在显著差异。掌握这些差异是快速解题的关键。

---

**场景：** 题目要求 `$_GET['password'] == $secret` 相等才返回 flag，但不知道 `$secret` 的值。
**原理：** PHP 的 `==` 弱比较会进行类型转换。如果 `$secret` 是字符串 `"0"` 或以数字开头的字符串，传入 `0` 可能相等。
**实战：** 传入 `?password=0`，如果 `$secret` 是 PHP 7 及之前版本中的 `"abc"`，`"abc" == 0` 为 `true`，绕过成功。
**避坑：** PHP 8 改变了字符串与数字的比较规则，`"abc" == 0` 为 `false`。如果题目是 PHP 8，弱比较绕不过来，需要换思路（如数组绕过、类型声明等）。

---

## 1.1 PHP 类型弱比较（Type Juggling）

PHP 使用 `==` 进行弱比较时，会自动进行类型转换。这是 CTF 中最常考到的 PHP 特性之一。

**核心规则：**

PHP 在比较不同类型时会按比较规则进行类型转换；具体规则取决于两侧类型，并不是统一"都转成同一种类型"。尤其是 PHP 8.0 修改了数字与非数字字符串的比较规则。

### 1.1.1 PHP 弱比较核心规则表

| 表达式 | PHP 7.x 结果 | PHP 8.x 结果 | 原因分析 |
| ----------------------- | :----------: | :----------: | -------- |
| `"admin" == 0` | `true` | `false` | PHP 8 不再把非数字字符串按 `0` 与数字比较 |
| `"123abc" == 123` | `true` | `false` | PHP 7 会取前导数字，PHP 8 将其视为非数字字符串 |
| `"abc123" == 0` | `true` | `false` | 无前导数字时 PHP 7 转成 `0`，PHP 8 不再转换 |
| `"0e123456" == "0e999"` | `true` | `true` | 两边都是合法科学计数法数字字符串，数值都为 `0` |
| `null == 0` | `true` | `true` | 两者在弱比较中等价 |
| `null == false` | `true` | `true` | 同上 |
| `null == ""` | `true` | `true` | 同上 |
| `[] == false` | `true` | `true` | 空数组转布尔为 `false` |
| `[] == 0` | `true`（Warning） | `true`（Warning） | 空数组转数字为 `0` |
| `[] == ""` | `true` | `true` | 空数组转字符串为 `""` |
| `true == 1` | `true` | `true` | 布尔值 `true` 与任何值比较，另一侧转为布尔 |
| `true == "admin"` | `true` | `true` | 字符串 `"admin"` 转布尔为 `true` |
| `"1" == 1` | `true` | `true` | 字符串转数字 1 |
| `"1abc" == 1` | `true` | `false` | PHP 8 不再取前导数字 |
| `"0" == false` | `true` | `true` | 字符串 `"0"` 转布尔为 `false` |

 **新手避坑：** 表格中最需要注意的是 `"123abc" == 123` 在 PHP 7 为 `true`，PHP 8 为 `false`。这意味着很多基于弱比较的 payload 在 PHP 8 下会失效。考试或 CTF 中如果遇到 PHP 8 环境，**不要再依赖非数字字符串与数字的弱比较绕过**。

### 1.1.2 `strcmp()` 绕过

```php
// PHP 7 及之前：传入数组通常产生 Warning 并返回 NULL，NULL == 0 成立
// PHP 8：参数类型不匹配会抛出 TypeError
if (strcmp($_GET['password'], $secret) == 0) {
    echo $flag;
}
```

在受影响的 PHP 7 及之前环境中，传入 `?password[]=1` 可能绕过；PHP 8 中会中断，除非应用捕获并错误处理 `TypeError`。

**场景：** 题目用 `strcmp($input, $flag)` 比较，并且用 `== 0` 判断相等。
**原理：** `strcmp()` 在 PHP 7 及之前传入数组时返回 `NULL`，`NULL == 0` 为 `true`。
**实战：** 把参数从 `?password=xxx` 改成 `?password[]=xxx`（数组格式）。
**避坑：** PHP 8 下数组参数抛出 `TypeError`，脚本直接终止，不会进入 `if` 分支。检查 PHP 版本再决定是否使用数组绕过。

### 1.1.3 `preg_match()` 绕过

```php
// 危险点：把"匹配失败/参数错误"和"没有匹配到非法字符"都按 == 0 处理
if (preg_match('/[^0-9]/', $_GET['id']) == 0) {
    echo $flag;
}
```

PHP 7 及之前传入 `?id[]=1` 时，参数错误可能返回 `false` / `NULL`，弱比较下等于 `0`，从而进入分支。原先写成 `if (!preg_match('/^[0-9]+$/', ...)) die(...)` 会把错误结果也拒绝掉，不能用数组绕过。PHP 8 对数组参数会抛出 `TypeError`。

### 1.1.4 `in_array()` 弱比较绕过

```php
// in_array() 默认使用 == 弱比较
$whitelist = [1, 2, 3];
if (in_array($_GET['id'], $whitelist)) {
    // 传入 ?id=1' union select ... 可以绕过
    // 因为 "1' union select ..." == 1 为 true
}
```

`in_array()` 的第三个参数 `strict` 早已存在，并非 PHP 8 新增；应显式使用 `in_array($value, $whitelist, true)`。PHP 8 同时修改了数字与非数字字符串的弱比较规则，因此上面的非数字尾缀 Payload 主要影响 PHP 7 及之前。

 **新手避坑：** `in_array()` 的绕过让很多人翻车。常见的白名单检测 `if (in_array($id, [1,2,3]))` 看起来安全，但如果传 `?id=1 union select...`，PHP 7 下 `"1 union select..." == 1` 为 `true`，直接绕过白名单。解决方案永远是加第三个参数 `true`。

### 1.1.5 `is_numeric()` 的边界

```php
// 科学计数法字符串会被 is_numeric() 视为数字
if (is_numeric($_GET['id'])) {
    $sql = "SELECT * FROM users WHERE id = " . $_GET['id'];
}
```

例如 `?id=1e3` 会通过并在数值上下文表示 `1000`。但 HTTP 参数中的字符串 `0x539` 并不会被 `is_numeric()` 识别为数字，不能用所谓"十六进制字符串编码 SQL"绕过。`is_numeric()` 也不是 SQL 注入防护；查询仍应使用参数化语句。

 **新手避坑：** `is_numeric()` 通过不代表安全。它只检查"是不是数字字符串"，但科学计数法 `1e3`、八进制 `0777`、浮点数 `1.5` 都会通过，在 SQL 拼接中可能造成意外行为。

### 1.1.6 switch 语句弱比较

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

**switch 弱比较总结表：**

| 输入值 | 类型 | case 'admin' 是否匹配（PHP 7） | case 'admin' 是否匹配（PHP 8） |
| ------ | ---- | :---: | :---: |
| `"admin"` | 字符串 | 是 | 是 |
| `"0"`（GET 参数） | 字符串 | 否（字符串 vs 字符串） | 否 |
| `0`（JSON 数字） | 整数 |**是**（PHP 7 弱比较） |**否**（PHP 8 不再 `0 == "admin"`） |
| `true`（JSON 布尔） | 布尔 | 是 | 是 |
| `null`（JSON null） | null | 否 | 否 |

### 1.1.7 `md5()` / `sha1()` 数组绕过

```php
// PHP 7 及之前：md5(数组) 返回 NULL，NULL == 0? 看上下文
// 但通常的绕过是双 md5 相等
if (md5($_GET['a']) == md5($_GET['b'])) {
    echo $flag;
}
```

传入 `?a[]=1&b[]=2`，两个 `md5()` 都返回 `NULL`，`NULL == NULL` 为 `true`。PHP 8 中 `md5([])` 抛出 `TypeError`，不能继续。

**特殊 MD5 碰撞字符串：**

以下字符串的 MD5 值以 `0e` 开头，与另一个 `0e` 开头的 MD5 字符串弱比较时都为 `0`，所以相等：

| 字符串 | MD5 值 |
| ------ | ------ |
| `QNKCDZO` | `0e830400451993494058024219903391` |
| `240610708` | `0e462097431907509062004940111347` |
| `s878926199a` | `0e545993274517709034328855841020` |
| `s155964671a` | `0e342768416822451524974117254469` |
| `s214587387a` | `0e848240445830720675705301396456` |
| `s878926199a` | `0e545993274517709034328855841020` |

使用方式：`?a=QNKCDZO&b=240610708`，两个 `0e` MD5 弱比较都为 `0`，`0 == 0` 成立。

 **新手避坑：** `0e` 碰撞只适用于弱比较 `==`，强比较 `===` 无效（因为两个字符串不完全相同）。如果题目用 `===` 判断 MD5，需要真正的 MD5 碰撞（难度很大），或者使用数组绕过（PHP 7 及之前）。

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

| `zend.assertions` | 含义 | 是否执行字符串代码 |
| ----------------- | -------------------------- | :---: |
| `1` | 生成并执行代码（开发模式） | 是（PHP 7.x） |
| `0` | 生成但不执行代码 | 否 |
| `-1` | 完全不生成代码（生产模式） | 否 |

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

| 表达式 | PHP 7.x | PHP 8.x | 对 CTF 的影响 |
| ------------ | ------- | ------- | ------------- |
| `0 == ""` | `true` | `false` | 依赖此特性的绕过全部失效 |
| `0 == "foo"` | `true` | `false` | `"admin" == 0` 不再为 true |
| `"" == false` | `true` | `true` | 布尔比较未变 |
| `"123abc" == 123` | `true` | `false` | 前导数字截断不再生效 |
| `"abc123" == 0` | `true` | `false` | 无前导数字的字符串不再等于 0 |
| `null == ""` | `true` | `true` | null 和空字符串的比较未变 |
| `null == 0` | `true` | `true` | null 和 0 的比较未变 |

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

 **新手避坑：** `match` 和 `switch` 的行为完全不同。`switch` 使用 `==` 弱比较，`match` 使用 `===` 强比较。PHP 8 环境下，如果看到 `match` 而不是 `switch`，弱比较绕过不再有效。

### 1.4.3 命名参数（PHP 8.0）

```php
function login($username, $password) { ... }
// 调用时可以直接指定参数名：
// login(password: '123456', username: 'admin');
```

 **新手避坑：** 命名参数在 CTF 中可能被用来绕过参数顺序限制。例如函数 `check($a, $b)` 要求 `$a` 为数字，`$b` 为 SQL 语句，但路由限制了第一个参数必须为字符串。使用命名参数可以调换传入顺序。

### 1.4.4 PHP 8 新增/移除函数速查表

| 函数 | 变更 | 版本 | CTF 影响 |
| ---- | ---- | ---- | -------- |
| `create_function()` |**移除**| 8.0 | 无法再用此函数注入 |
| `assert()` 字符串执行 |**移除**| 8.0 | 字符串断言不再执行代码 |
| `each()` |**移除**| 8.0 | 无影响 |
| `strcmp()` 数组参数 | 抛出 TypeError | 8.0 | 数组绕过失效 |
| `preg_match()` 数组参数 | 抛出 TypeError | 8.0 | 数组绕过失效 |
| `md5()` 数组参数 | 抛出 TypeError | 8.0 | 数组绕过失效 |
| `intdiv()` | 新增 | 8.0 | 无安全影响 |
| `str_contains()` | 新增 | 8.0 | 无安全影响 |
| `str_starts_with()` | 新增 | 8.0 | 无安全影响 |
| `str_ends_with()` | 新增 | 8.0 | 无安全影响 |
| `match` 表达式 | 新增 | 8.0 | 替代 switch，严格比较 |
| 命名参数 | 新增 | 8.0 | 可改变调用参数顺序 |
| JIT 编译 | 新增 | 8.0 | 性能提升，无直接安全影响 |
| `Fibers` | 新增 | 8.1 | 无直接安全影响 |
| `readonly` 属性 | 新增 | 8.1 | 无直接安全影响 |
| 枚举类型 | 新增 | 8.1 | 无直接安全影响 |

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

### 1.5.2 `$GLOBALS` 超全局变量

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

### 1.5.3 变量覆盖方法大全表

| 方法 | 函数/特性 | 影响范围 | PHP 版本 | 示例 |
| ---- | --------- | -------- | -------- | ---- |
| `extract()` | 数组键→变量 | 当前作用域 | 全部 | `extract($_GET)` 后 `$auth` 被覆盖 |
| `parse_str()` | 查询字符串→变量 | 当前作用域 | 第二参数必填(PHP 8+) | `parse_str("auth=1")` 覆盖 `$auth` |
| `import_request_variables()` | GET/POST/Cookie→变量 | 全局 | PHP < 5.4 已移除 | `import_request_variables("gpc")` |
| `foreach + $$` | 遍历赋值 | 当前作用域 | 全部 | `foreach($_POST as $k=>$v) $$k=$v` |
| 可变变量 `$$` | 动态变量名 | 当前作用域 | 全部 | `$$key = $value` |
| `register_globals` | 自动全局注册 | 全局 | PHP < 5.4 移除 | `?auth=1` 自动设 `$auth=1` |
| `$GLOBALS` 直接赋值 | 全局变量数组 | 全局 | 全部 | `$GLOBALS['flag'] = 'xxx'` |
| `get_defined_vars()` | 获取所有变量 | 只读信息 | 全部 | 遍历所有变量的值 |

### 1.5.4 `extract()` 变量覆盖

`extract()` 将数组中的键名作为变量名、键值作为变量值导入当前作用域：

```php
$auth = false;
extract($_GET);
// 访问 ?auth=1 → $auth 被覆盖为 1
if ($auth) {
    echo $flag;
}
```

**场景：** 题目开头 `$auth = false;`，然后 `extract($_GET);`，之后 `if ($auth) { echo $flag; }`。
**原理：** `extract()` 把 GET 参数的键值对展开成变量，覆盖了已有的 `$auth`。
**实战：** 直接访问 `?auth=1`，`$auth` 被覆盖为字符串 `"1"`，条件为真，输出 flag。
**避坑：** 如果 `extract()` 带了 `EXTR_SKIP` 标志，不会覆盖已有变量。但 CTF 中通常是不带参数的默认行为 `EXTR_OVERWRITE`。

### 1.5.5 `parse_str()` 变量覆盖

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

| 标签 | 是否始终可用 | 说明 | CTF 应用 |
| ------------------- | ------------ | ----------------------- | -------- |
| `<?php ?>` | 是 | 标准标签，始终可用 | 最常用 |
| `<?= ?>` | 是 (5.4+) | echo 简写，`<?= $var ?>` 等效 `<?php echo $var; ?>` | 绕过 `php` 关键字过滤 |
| `<? ?>`（短标签） | 否 需配置 | `short_open_tag = On` | 绕过 `php` 关键字过滤 |
| `<% %>`（ASP 标签） | 否 旧版需 `asp_tags` | PHP 7.0 起移除 | 旧版绕过 |
| `<script language="php">` | 否 仅旧版 | PHP 7.0 起移除 | 旧版绕过 |

CTF 中上传 WebShell 时，如果 `<?php` 被过滤，PHP 7 之前的老环境才可能尝试 `<script language="php">`；短标签 `<?` 始终取决于 `short_open_tag` 配置，而 `<?=` 从 PHP 5.4 起始终可用。

 **新手避坑：** 如果 Webshell 上传时 `<?php` 被 WAF 拦截，先试试 `<?= system('ls'); ?>`（等价的 echo 简写）。如果不行再试 `<? system('ls'); ?>`（需要 `short_open_tag=On`），最后考虑大小写混合 `<?PHP`。

### 1.6.4 字符串与数字的自动转换

```php
// PHP 7 及之前
echo "123" + 1;     // 124（字符串转数字做加法）
echo "abc" + 1;     // 1（"abc" 转数字为 0，0+1=1）
echo "123abc" + 1;  // 124（PHP 7 取前导数字 123）
echo "abc123" + 1;  // 1（PHP 7 无前导数字，转 0）

// PHP 8
echo "123abc" + 1;  // 124（PHP 8 也取前导数字，与 == 不同）
```

 **新手避坑：** 注意数字 `+` 加法和 `==` 弱比较在 PHP 8 中的行为**不完全一致**。`"123abc" + 1` 在 PHP 8 中仍然是 `124`（+ 运算符会取前导数字），但 `"123abc" == 123` 在 PHP 8 中是 `false`（== 不再取前导数字）。两者逻辑不同，不要混淆。

### 1.6.5 字母和数字的递增行为

```php
// PHP 的递增运算符（++）对字符串有特殊行为
$x = 'a';
echo ++$x; // 'b'

$x = 'z';
echo ++$x; // 'aa'

$x = 'A';
echo ++$x; // 'B'

$x = 'Z';
echo ++$x; // 'AA'
```

这个特性在 CTF 中不常见，但在某些需要构造字符串的场景下可能有用。

---

## 1.7 PHP 函数绕过特性速查

| 绕过目标 | 方法 | 适用版本 | 注意事项 |
| ----------------- | --------------------------- | --------------------- | -------- |
| `strcmp()` | 数组参数使旧版返回 `NULL`，再利用弱比较 | PHP 7 及之前；PHP 8 抛 `TypeError` | PHP 8 下失效 |
| `preg_match()` | 仅当代码把错误返回值当作"未匹配" | PHP 7 及之前；PHP 8 抛 `TypeError` | PHP 8 下失效 |
| `in_array()` | 第三个参数缺省或为 `false` 时利用弱比较 | 具体 Payload 取决于 PHP 比较规则；传 `true` 可避免 | 加 `true` 即可防御 |
| `is_numeric()` | 科学计数法等合法数字格式边界 | 全部 | 不是通用绕过；十六进制 HTTP 字符串不通过 |
| `md5()`/`sha1()` | 传入数组返回 `NULL` 或使用 `0e` 碰撞 | PHP 7.x 及之前 | PHP 8 抛 TypeError |
| `intval()` | 只有 `base=0` 等特定调用才识别字符串 `0x...` | 取决于第二个参数和输入格式 | 需查阅文档确认 base 参数 |
| `preg_replace()` | `/e` 修饰符代码执行 | PHP 5.x 专属 | PHP 7+ 已移除 |
| `create_function()` | 闭合 `}` 注入代码 | PHP 7.1 及之前 | PHP 8 彻底移除 |
| `assert()` | 字符串参数按代码执行 | PHP 8 之前且断言启用；PHP 7.2 起弃用 | PHP 8 字符串按普通断言值处理 |
| `filter_var()` | 检查 URL 解析与业务校验之间的差异 | 依赖 PHP 版本、过滤器和选项，不是通用绕过 | 需要具体分析 filter 行为 |
| `trim()` | 过滤空格等字符时，可用制表符 `%09`、换行 `%0a` 等绕过 | 全部 | 取决于具体过滤的字符集合 |
| `str_replace()` | 只替换一次，可能嵌套绕过 | 全部 | 例如过滤 `php` 时 `pphphp` 替换后成为 `php` |
| `urldecode()` | 双重解码绕过 | 全部 | 检查是否有多层解码逻辑 |

---

## 1.8 PHP 版本差异速查

### 1.8.1 版本差异完整表

| 版本 | 发布时间 | CTF 中需要关注的关键变化 |
| ------ | -------- | -------------------------------------------------------------- |
| PHP 5.2 | 2006 | 支持 `%00` 截断（< 5.3.4）；路径长度截断（< 5.2.8） |
| PHP 5.3 | 2009 | `magic_quotes_gpc` 弃用；`%00` 截断修复（5.3.4）；命名空间引入 |
| PHP 5.4 | 2012 | `register_globals`、`safe_mode`、`magic_quotes_gpc` 移除；`<?=` 始终可用 |
| PHP 5.5 | 2013 | `preg_replace` 的 `/e` 修饰符弃用（7.0 移除） |
| PHP 5.6 | 2014 | 引入 `...` 变长参数；`hash_equals()` 防止时序攻击 |
| PHP 7.0 | 2015 | `preg_replace` 的 `/e` 移除；标量/返回类型声明；引入 `zend.assertions` |
| PHP 7.1 | 2016 | 可空类型、`void` 返回类型等语法变化 |
| PHP 7.2 | 2017 | `create_function()` 弃用；`each()` 弃用 |
| PHP 7.3 | 2018 | `JSON_THROW_ON_ERROR` 常量；`list()` 引用赋值 |
| PHP 7.4 | 2019 | 短箭头函数 `fn() =>`；`mb_strrpos()` 严格类型检查 |
| PHP 8.0 | 2020 |**`create_function()` 移除**；**`match` 表达式**；**命名参数**；**非数字字符串与数字比较改变**；**数组参数 TypeError**；JIT 编译器 |
| PHP 8.1 | 2021 | Fibers；枚举类型；`never` 返回类型；`readonly` 属性 |
| PHP 8.2 | 2022 | `readonly` 类；独立类型 `true`/`null`/`false`；敏感参数红act |
| PHP 8.3 | 2023 | `json_validate()` 函数；类常量类型声明 |

### 1.8.2 PHP 版本决定的关键绕过策略

| 目标绕过 | PHP 5.x | PHP 7.x | PHP 8.x |
| -------- | ------- | ------- | ------- |
| 弱比较 `"admin" == 0` | 有效（true） | 有效（true） |**无效**（false） |
| `strcmp()` 数组绕过 | 有效（NULL == 0） | 有效（同上） |**无效**（TypeError） |
| `md5()` 数组绕过 | 有效（NULL） | 有效（Warning） |**无效**（TypeError） |
| `preg_replace()` `/e` |**有效（RCE）**| 已移除 | 已移除 |
| `create_function()` 闭合 | 有效 | 7.2 起弃用 |**已移除**|
| `assert()` 字符串代码 |**有效**| 7.2 起弃用 | 已移除 |
| `%00` 截断 | 5.3.4 前有效 | 无效 | 无效 |
| 路径长度截断 | 5.2.8 前有效 | 无效 | 无效 |
| `register_globals` | 5.4 前有效 | 无效 | 无效 |

### 1.8.3 PHP 弱比较变化：5.x → 7.x → 8.x 对比表

| 表达式 | PHP 5.x | PHP 7.x | PHP 8.x |
| ------- | :-----: | :-----: | :-----: |
| `"admin" == 0` | `true` | `true` |**`false`**|
| `"123abc" == 123` | `true` | `true` |**`false`**|
| `"" == 0` | `true` | `true` |**`false`**|
| `"0" == false` | `true` | `true` | `true` |
| `null == 0` | `true` | `true` | `true` |
| `null == ""` | `true` | `true` | `true` |
| `[] == false` | `true` | `true` | `true` |
| `"0e123" == "0e456"` | `true` | `true` | `true` |
| `0 == "foo"` | `true` | `true` |**`false`**|
| `"1" == 1` | `true` | `true` | `true` |
| `"abc" == "abc"` | `true` | `true` | `true` |
| `strcmp([], "x")` | `NULL` + Warning | `NULL` + Warning |**TypeError**|
| `md5([])` | `NULL` | `NULL` + Warning |**TypeError**|

---

## 1.9 PHP 数组与哈希相关绕过

### 1.9.1 数组操作的安全边界

```php
// array_search() 和 array_key_exists() 的区别
$arr = ['id' => 1, 'role' => 'admin'];

// array_search() 默认使用 == 弱比较
$key = array_search('admin', $arr);  // 返回 'role'

// array_key_exists() 只检查键名
$exists = array_key_exists('admin', $arr);  // false（'admin' 是值，不是键）
```

### 1.9.2 isset() 和 empty() 的陷阱

```php
// isset() 检查变量是否存在且不为 NULL
$var = 0;
var_dump(isset($var));     // true
var_dump(empty($var));     // true（0 被视为空）

// empty() 将以下值视为空：
// "", 0, "0", NULL, false, array()
// 如果变量值恰好是这些之一，empty() 返回 true

// CTF 中的利用场景：
// if (!empty($_GET['role']) && $_GET['role'] == 'admin')
// 传入 ?role=0 可能绕过 empty 检查，但 PHP 8 下 "0" == "admin" 为 false
```

### 1.9.3 intval() 的边界行为

```php
// intval() 的不同 base 参数
echo intval('0x1A');    // 0（不指定 base 时，不会自动识别十六进制）
echo intval('0x1A', 0); // 26（base=0 时自动识别进制）
echo intval('42');      // 42
echo intval('42abc');   // 42（取前导数字）
echo intval('abc42');   // 0（无前导数字）

// CTF 中的绕过场景：
// if (intval($_GET['id']) > 0 && $_GET['id'] == 'admin')
// 传入 ?id=0 时 intval('0') == 0，不满足 > 0
// 传入 ?id=1 时 intval('1') == 1，但 "1" == "admin" 在 PHP 8 为 false
```

---

## 1.10 其他 PHP 函数陷阱

### 1.10.1 `serialize()` / `unserialize()` 类型差异

```php
// 序列化字符串中 i 表示整数，s 表示字符串，b 表示布尔
echo serialize("123");   // s:3:"123";
echo serialize(123);     // i:123;
echo serialize(true);    // b:1;

// 反序列化时的类型差异
// 如果把 s:3:"123" 改成 s:3:"123" 不影响
// 但修改长度值可能导致截断或溢出
```

### 1.10.2 `strpos()` 和 `===` 的使用

```php
$email = 'admin@example.com';

// 错误用法：strpos() 返回 0（匹配在开头）时，== false 被误判
if (strpos($email, 'admin') == false) {
    // 这里不会执行，因为 strpos 返回 0，0 == false 为 true
}

// 正确用法：使用 ===
if (strpos($email, 'admin') === false) {
    // 只在真正没找到时执行
}
```

 **新手避坑：** `strpos()` 返回 `0` 表示在字符串开头找到了目标。`0 == false` 在 PHP 7 及之前为 `true`，所以如果把 `if (strpos($str, $key))` 当成"找到了"的判断条件，当目标在开头时就判断错误。**必须使用 `=== false` 来判断是否找到。**

### 1.10.3 `compact()` 和 `list()` 的变量行为

```php
// compact() 创建包含变量的数组
$name = 'admin';
$role = 'user';
$result = compact('name', 'role');
// $result = ['name' => 'admin', 'role' => 'user']

// list() 将数组元素赋值给变量
list($a, $b) = [1, 2];
// $a = 1, $b = 2
```

---

## 知识总结表

### PHP 版本选择指南

| 场景 | 推荐的绕过思路 | 需注意 |
| ---- | ------------- | ------ |
| PHP 5.x | `register_globals`、`preg_replace` `/e`、`%00` 截断 | 版本越多兼容性越好 |
| PHP 7.x | 弱比较、数组绕过、`create_function()` 闭合 | 7.2+ 后弃用函数增多 |
| PHP 8.x | 命名参数、严格类型、新函数特性 | 经典弱比较和数组绕过失效 |

### 弱比较核心记忆表

| 口诀 | 含义 |
| ---- | ---- |
| `"数字开头" == 数字` | PHP 7 取前导数字，PHP 8 不再取 |
| `"纯字母" == 0` | PHP 7 为 true，PHP 8 为 false |
| `0e开头 == 0e开头` | 永远为 true（科学计数法） |
| `数组参数` | PHP 7 返回 NULL，PHP 8 抛出 TypeError |

### 变量覆盖方法速查

| 函数 | 触发条件 | 防御 |
| ---- | -------- | ---- |
| `extract()` | 默认覆盖已有变量 | 使用 `EXTR_SKIP` 标志 |
| `parse_str()` | 省略第二参数（PHP 7.2 起弃用） | 始终使用第二参数 |
| `$$` 可变变量 | 遍历用户输入并赋值 | 禁止将用户输入作为变量名 |
| `import_request_variables()` | PHP < 5.4 | 已移除 |

### 函数绕过速查

| 函数 | PHP 7 及之前绕过 | PHP 8 绕过 |
| ---- | ---------------- | ---------- |
| `strcmp($a, $b) == 0` | `$a[]=1`（返回 NULL） | 无效（TypeError） |
| `preg_match($p, $s) == 0` | `$s[]=1`（返回 false） | 无效（TypeError） |
| `md5($a) == md5($b)` | `$a[]=1&$b[]=2` 或 0e 碰撞 | 0e 碰撞仍有效；数组无效 |
| `in_array($v, $list)` | `?v=1 union...` 弱比较 | 依赖具体比较规则 |
| `strpos($h, $n) == 0` | `$n` 在开头时 | 同上（需 `===` 判断） |

### 新手避坑终极汇总

1.**PHP 版本决定一切。**看到题目先判断 PHP 版本，再决定用哪种绕过。
2.**`==` 和 `===` 完全不同。**弱比较靠类型转换，强比较靠严格相等。
3.**`"admin" == 0` 只在 PHP 7 之前成立。**PHP 8 下这是 false。
4.**数组绕过在 PHP 8 全部失效。**TypeError 抛出后脚本终止。
5.**`0e` MD5 碰撞只在 `==` 下有效。**`===` 下两个字符串不同。
6.**`strpos()` 返回 0 不是 false。**永远用 `=== false` 判断。
7.**`extract()` 默认覆盖已有变量。**这是最常见的变量覆盖入口。
8.**`<?=` 从 PHP 5.4 起始终可用。**绕过 `php` 关键字过滤首选。
9.**科学计数法 `1e3` 是数字。**`is_numeric("1e3")` 为 true，但 `intval("1e3")` 为 1。
10.**`create_function()` 在 PHP 8 已移除。**新的 PHP 环境无法使用。
11.**`match` 使用 `===` 严格比较。**不要拿 `switch` 的 `==` 套路测试 `match`。
12.**`GLOBALS` 可以遍历所有全局变量。**包括 flag。
