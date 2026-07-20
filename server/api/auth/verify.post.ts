const ANSWER_MAP: Record<number, string[]> = {
  1: ['张锦洲'],
  2: ['刘颖'],
  3: ['熊瑛1'],
  4: ['看我雄姿英发', '你的暗恋男友'],
  5: ['0211'],
  6: ['安徽省无为第一中学'],
  7: ['鹤毛初级中学'],
  8: ['滁州学院'],
  9: ['青岑'],
  10: ['方志伟', '李尔冉'],
  11: ['张锦洲'],
}

const COOKIE_SECRET = 'blog-zjz-web-security-2026'

export default defineEventHandler(async (event) => {
  // 读原始文本并手动解析，确保UTF-8正确处理
  const rawText = await readRawBody(event)
  if (!rawText) {
    throw createError({ statusCode: 400, statusMessage: '请求体为空' })
  }

  let body: any
  try {
    body = JSON.parse(rawText)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'JSON 解析失败' })
  }

  if (!body?.answers || !Array.isArray(body.answers) || body.answers.length !== 2) {
    throw createError({ statusCode: 400, statusMessage: '请回答两个问题' })
  }

  let correct = 0
  for (const a of body.answers) {
    const validAnswers = ANSWER_MAP[Number(a.id)]
    if (!validAnswers) continue
    const userAnswer = String(a.answer || '').trim()
    if (validAnswers.some(va => va === userAnswer)) {
      correct++
    }
  }

  if (correct === 2) {
    const token = Buffer.from(JSON.stringify({
      ok: true,
      time: Date.now(),
      hash: COOKIE_SECRET,
    })).toString('base64')

    setCookie(event, 'ws_auth', token, {
      maxAge: 3600,
      httpOnly: false, // 客户端需要读此 cookie 判断认证状态
      sameSite: 'lax',
      path: '/',
    })

    return { ok: true }
  }

  throw createError({ statusCode: 403, statusMessage: `答对了 ${correct}/2 题，请重试` })
})
