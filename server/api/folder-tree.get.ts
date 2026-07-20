import { queryCollection } from '@nuxt/content/nitro'

interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  url?: string
  children?: TreeNode[]
}

const COOKIE_SECRET = 'blog-zjz-web-security-2026'

function isWebSecurityAuthed(event: any): boolean {
  const token = getCookie(event, 'ws_auth')
  if (!token) return false
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    return decoded.ok && decoded.hash === COOKIE_SECRET && Date.now() - decoded.time < 3600_000
  } catch { return false }
}

function buildTreeFromStems(items: { stem: string; path: string }[], authed: boolean): TreeNode[] {
  const root: Record<string, any> = {}

  for (const item of items) {
    let stem = item.stem || ''
    if (stem.startsWith('posts/')) stem = stem.slice(6)
    if (!stem) continue

    if (!authed && stem.startsWith('web-security')) continue

    const parts = stem.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1

      if (isLast) {
        const name = part.replace(/\.md$/, '')
        if (!current._files) current._files = []
        current._files.push({ name, url: item.path, stem })
      } else {
        if (!current[part]) current[part] = {}
        current = current[part]
      }
    }
  }

  function toTree(obj: Record<string, any>): TreeNode[] {
    const result: TreeNode[] = []

    for (const [key, value] of Object.entries(obj)) {
      if (key === '_files') continue
      const children = toTree(value)
      if (children.length > 0) {
        result.push({ name: key, path: '', type: 'folder', children })
      }
    }

    if (obj._files) {
      for (const f of obj._files) {
        result.push({ name: f.name, path: '', type: 'file', url: f.url })
      }
    }

    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-Hans-CN')
    })

    return result
  }

  return toTree(root)
}

export default defineEventHandler(async (event): Promise<TreeNode[]> => {
  const authed = isWebSecurityAuthed(event)

  const items = await queryCollection(event, 'content')
    .where('stem', 'LIKE', 'posts/%')
    .select('stem', 'path')
    .all()

  const tree = buildTreeFromStems(items as any[], authed)

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
