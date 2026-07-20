import { readdir, stat, readFile } from 'node:fs/promises'
import { join, basename, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'

interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  url?: string
  children?: TreeNode[]
}

const EXCLUDE_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules', '图片', '.smart-env'])

// 从 frontmatter 获取 permalink
async function getBlogUrl(filePath: string, relPath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf8')
    if (!content.startsWith('---')) {
      // 无 frontmatter → 用文件路径生成 URL
      return generatePathUrl(relPath)
    }

    const endIdx = content.indexOf('---', 3)
    if (endIdx <= 0) return generatePathUrl(relPath)

    const fm = parseYaml(content.slice(3, endIdx))

    // 优先 permalink
    if (fm?.permalink && typeof fm.permalink === 'string') {
      return fm.permalink
    }

    return generatePathUrl(relPath)
  } catch {
    return null
  }
}

// 从文件路径生成博客 URL（Nuxt Content 路径规则）
function generatePathUrl(relPath: string): string {
  // 去掉 .md 后缀
  let url = relPath.replace(/\.md$/, '')
  // 统一用 / 分隔
  url = url.replace(/\\/g, '/')
  // 确保以 / 开头
  if (!url.startsWith('/')) url = '/' + url
  return url
}

const COOKIE_SECRET = 'blog-zjz-web-security-2026'

// 检查 web-security 认证状态
function isWebSecurityAuthed(event: any): boolean {
  const token = getCookie(event, 'ws_auth')
  if (!token) return false
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    return decoded.ok && decoded.hash === COOKIE_SECRET && Date.now() - decoded.time < 3600_000
  } catch { return false }
}

export default defineEventHandler(async (event): Promise<TreeNode[]> => {
  const postsDir = join(process.cwd(), 'content', 'posts')
  const authed = isWebSecurityAuthed(event)
  const tree = await buildTree(postsDir, '', authed)

  // 未认证时，在树末尾追加一个锁住的入口，点击跳转密码门
  if (!authed) {
    tree.push({
      name: '🔒 web-security（需验证）',
      path: '/web-security',
      type: 'file',
      url: '/web-security/vulns/xss',
    })
  }

  return tree
})

async function buildTree(dirPath: string, relDir: string, authed: boolean): Promise<TreeNode[]> {
  const result: TreeNode[] = []

  let entries: string[]
  try {
    entries = await readdir(dirPath)
  } catch {
    return result
  }

  for (const entry of entries) {
    if (entry.startsWith('.') || EXCLUDE_DIRS.has(entry)) continue

    // 未认证时跳过 web-security 目录内容
    if (!authed && entry === 'web-security') continue

    const fullPath = join(dirPath, entry)
    let entryStat
    try {
      entryStat = await stat(fullPath)
    } catch {
      continue
    }

    if (entryStat.isDirectory()) {
      const children = await buildTree(fullPath, relDir ? relDir + '/' + entry : entry, authed)
      if (children.length > 0) {
        result.push({ name: entry, path: fullPath, type: 'folder', children })
      }
    } else if (entryStat.isFile() && entry.endsWith('.md')) {
      const relFilePath = relDir ? relDir + '/' + entry : entry
      const url = await getBlogUrl(fullPath, relFilePath)

      result.push({
        name: entry.replace(/\.md$/, ''),
        path: fullPath,
        type: 'file',
        url,
      })
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  return result
}
