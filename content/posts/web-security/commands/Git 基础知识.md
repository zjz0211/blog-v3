---
title: Git 基础知识
date: 2026-07-15
categories: [web安全, 常用命令]
type: tech
permalink: /web-security/commands/git
---

# Git 基础知识（CTF 实战版）

> CTF 中 Git 的核心用途：** 从 `.git` 泄露中恢复完整源码和历史记录**。开发者把整个项目目录部署上线，忘了删 `.git` 文件夹——你的机会来了。

---

## 场景：发现 .git 泄露后怎么办？

```
第1步：确认泄露
  访问 http://target.com/.git/HEAD
  返回 ref: refs/heads/master →  确认泄露！

第2步：用工具拉取整个仓库
  python GitHack.py http://target.com/.git/
  或 ./git-dumper http://target.com/.git/ output/

第3步：挖掘历史
  git log                    → 看看提交过什么
  git show <commit_id>       → 看看某次提交的内容
  git diff <old> <new>       → 看看两次提交之间改了什么
  → flag 经常藏在"删除敏感信息"的那次提交里！
```

---

## 一、.git 目录结构

```
.git/
├── HEAD          → 当前分支指针（访问它确认泄露存在）
├── config        → 仓库配置（可能有远程地址等）
├── index         → 暂存区（记录文件列表和状态）
├── logs/
│   └── HEAD      → 操作历史（比 git log 更全）
├── objects/      → Git 对象数据库（所有文件的所有版本都在这里！）
└── refs/
    └── heads/    → 分支引用
```

**确认泄露的关键 URL：**

| 路径 | 正常返回值 | 说明 |
|------|-----------|------|
| `/.git/HEAD` | `ref: refs/heads/master` |  最常用的确认方式 |
| `/.git/config` | `[core]` 等配置内容 | 查看仓库配置 |
| `/.git/index` | 二进制数据 | 文件索引 |
| `/.git/logs/HEAD` | 提交记录 | 操作历史 |

---

## 二、恢复工具

```bash
# 方式1：GitHack（最简单，推荐新手）
python GitHack.py http://target.com/.git/

# 方式2：git-dumper（更稳定，重建完整 git 仓库）
./git-dumper http://target.com/.git/ output_dir/

# 方式3：GitTools 三件套
bash gitdumper.sh http://target.com/.git/ output_dir/

# 特殊情况处理：
# - 目录列不出来但文件能访问 → 工具通常能自动处理
# - 只有 objects 可读没有 index → 用 git cat-file 逐个解析
```

---

## 三、拉下来后怎么挖 flag

### 3.1 查看提交历史

```bash
git log                        # 完整历史，每次提交的 hash、作者、时间、说明
git log --oneline              # 简洁版（一行一条）
git log --all --oneline        # 包括其他分支
git reflog                     # 更全的历史（包括 reset、rebase 等操作）
```

### 3.2 查看具体内容

```bash
git show <commit_id>                    # 查看某次提交的完整变更
git show <commit_id>:path/to/file.php   # 查看某次提交时某个文件的内容
git diff <commit1> <commit2>            # 比较两次提交的差异
git diff HEAD~1 HEAD                   # 比较最新提交和上一次
```

### 3.3 切换版本

```bash
git checkout <commit_id>        # 切换到某个历史版本
git checkout master             # 回到最新版本
git checkout -b test <commit>   # 从历史版本创建新分支
```

---
## 四、CTF 常见场景

### 场景1：flag 在历史提交中被删除

```bash
# 开发者曾经提交过 flag 或密码，后来删掉了
# 但 Git 记录了所有历史！

git log --all -p | grep -A 5 -B 5 "flag{"
# -p 显示每次提交的具体改动
# grep 筛选包含 flag{ 的行及其上下文
```

### 场景2：敏感信息在 commit message 中

```bash
# 开发者可能把密码写在提交说明里
git log --all | grep -i -E "password|secret|key|flag|token"
```

### 场景3：flag 藏在其他分支

```bash
git branch -a                  # 列出所有分支（本地+远程）
git checkout dev-branch        # 切换到 dev 分支看看
git log --all --oneline        # 查看所有分支的提交
```

### 场景4：flag 在 git stash 里

```bash
git stash list                 # 查看暂存列表
git stash show -p              # 查看暂存内容
```

### 场景5：找某个文件的所有历史版本

```bash
# 找到删除过 flag 相关文件的提交
git log --all --diff-filter=D --summary | grep -E "flag|secret|password"

# 查看那个文件在删除前的内容
git show <commit_before_delete>:path/to/file
```

---

## 五、Git 命令速查

| 命令 | 作用 | CTF 使用时机 |
|------|------|------------|
| `git log` | 查看提交历史 | 了解项目演变 |
| `git log -p` | 查看历史+详细改动 |  搜索 flag |
| `git reflog` | 完整操作历史 | 发现被隐藏的操作 |
| `git show <id>` | 查看某次提交 | 看具体改了什么 |
| `git diff A B` | 比较差异 | 看两次提交间的变化 |
| `git branch -a` | 所有分支 | flag 可能在别的分支 |
| `git checkout <id>` | 切换版本 | 恢复到历史版本 |
| `git stash list` | 暂存列表 | 可能藏有未提交的代码 |
| `git stash show -p` | 查看暂存 | 同上 |

---

## 知识总结

| 阶段 | 关键操作 |
|------|---------|
|**确认泄露**| 访问 `/.git/HEAD`，看是否返回 `ref: refs/heads/…` |
|**恢复源码**| GitHack / git-dumper / GitTools |
|**查看历史**| `git log --all -p` |
|**搜索 flag**| `git log --all -p \| grep "flag{"` |
|**切换版本**| `git checkout <commit_id>` |
|**搜 commit 信息**| `git log --all \| grep -i password` |

>**新手避坑：** `git log` 不会显示被 `git reset` 撤销的提交。用 `git reflog` 可以看到更完整的历史，包括那些"消失"的提交。另外，不是所有返回 200 的 `/.git/HEAD` 都能完整拉取——有些服务器禁止目录列表但不禁止直接访问已知文件，工具通常能自动处理这种情况。
