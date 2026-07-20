const COOKIE_SECRET = 'blog-zjz-web-security-2026'

export default defineEventHandler((event) => {
  const token = getCookie(event, 'ws_auth')
  if (!token) {
    return { ok: false }
  }

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
    if (decoded.ok && decoded.hash === COOKIE_SECRET) {
      // 检查是否过期（1小时）
      if (Date.now() - decoded.time < 3600_000) {
        return { ok: true }
      }
    }
  } catch {
    // token 无效
  }

  return { ok: false }
})
