<script setup lang="ts">
const route = useRoute()
const isWebSecurity = computed(() => route.path.startsWith('/web-security/'))

// 认证检查：SSR 和客户端都读 cookie，保持 needGate 一致
const wsAuthCookie = useCookie<string>('ws_auth')
let needGate = isWebSecurity.value
if (isWebSecurity.value) {
  const token = wsAuthCookie.value
  if (token) {
    try {
      const decStr = import.meta.server ? Buffer.from(token, 'base64').toString('utf8') : atob(token)
      const decoded = JSON.parse(decStr)
      if (decoded.ok && decoded.hash === 'blog-zjz-web-security-2026' && Date.now() - decoded.time < 3600_000) {
        needGate = false
      }
    } catch {}
  }
}

const { data: post } = await useAsyncData(
    `content:${route.path}${needGate ? ':gated' : ''}`,
    () => {
      if (needGate) return null
      return queryCollection('content').path(route.path).first()
    },
)

const excerpt = computed(() => post.value?.description || '')

if (post.value) {
    useSeoMeta({ title: post.value.title, ogType: '', ogImage: post.value.image, description: post.value.description })
} else if (!isWebSecurity.value) {
    const event = useRequestEvent()
    if (event) setResponseStatus(event, 404)
    useHead({ title: '404 - Page Not Found' })
    route.meta.title = '404'
}

// 文章内容防复制+截屏保护
const articleRef = ref<HTMLElement>()
const isBlurred = ref(false)
const devToolsOpen = ref(false)
let debuggerTimer: ReturnType<typeof setInterval> | null = null
let detectTimer: ReturnType<typeof setInterval> | null = null

function blockCopy(e: ClipboardEvent) {
	e.preventDefault()
	e.clipboardData?.setData('text/plain', '禁止复制本文内容')
}

function blockKeys(e: KeyboardEvent) {
	const blocked = ['c', 'v', 's', 'u', 'p', 'x']
	if (e.ctrlKey && blocked.includes(e.key.toLowerCase())) e.preventDefault()
	if (e.key === 'F12' || e.key === 'PrintScreen') e.preventDefault()
	if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) e.preventDefault()
}

function onBlur() {
  // 焦点进入评论区 iframe（Giscus）时不触发模糊保护
  const active = document.activeElement
  if (active?.tagName === 'IFRAME') return
  isBlurred.value = true
}
function onFocus() { isBlurred.value = false }

// DevTools 检测：窗口尺寸差 + console 耗时 + debugger 暂停三重检测
function detectDevTools() {
	// 方法1: DevTools 停靠时窗口内外的尺寸差（最可靠，即时生效）
	const widthDiff = window.outerWidth - window.innerWidth
	const heightDiff = window.outerHeight - window.innerHeight
	if (widthDiff > 160 || heightDiff > 160) {
		devToolsOpen.value = true
		return
	}

	// 方法2: debugger 耗时——DevTools 打开会暂停，恢复后已过很长时间
	const t0 = performance.now()
	// 使用 eval 包装防止被静态分析跳过
	// eslint-disable-next-line no-eval
	eval('debugger')
	const dt = performance.now() - t0
	if (dt > 200) {
		devToolsOpen.value = true
	}
}

// debugger 循环：打开 DevTools 后让调试器不断暂停
function startDebuggerTrap() {
	debuggerTimer = setInterval(() => {
		debugger // eslint-disable-line no-debugger
	}, 50)
}

onMounted(() => {
	if (!post.value && !isWebSecurity.value && !route.path.startsWith('/404-page')) {
		window.location.replace('/404-page/')
		return
	}

	const el = articleRef.value
	if (!el) return
	el.addEventListener('copy', blockCopy)
	el.addEventListener('cut', blockCopy)
	el.addEventListener('contextmenu', (e) => e.preventDefault())
	document.addEventListener('keydown', blockKeys)
	window.addEventListener('blur', onBlur)
	window.addEventListener('focus', onFocus)

	// DevTools 检测 + debugger 陷阱
	detectTimer = setInterval(detectDevTools, 500)
	startDebuggerTrap()
})

onUnmounted(() => {
	document.removeEventListener('keydown', blockKeys)
	window.removeEventListener('blur', onBlur)
	window.removeEventListener('focus', onFocus)
	if (debuggerTimer) { clearInterval(debuggerTimer); debuggerTimer = null }
	if (detectTimer) { clearInterval(detectTimer); detectTimer = null }
})

const { widgets } = useWidgets(post.value ? ['toc'] : [])

// ====== 内联密码门逻辑 ======
interface GateQuestion { id: number; text: string }
const gateQuestions = ref<GateQuestion[] | null>(null)
const gateAnswer1 = ref('')
const gateAnswer2 = ref('')
const gateError = ref('')
const gateLoading = ref(false)
const gateChecking = ref(true)

onMounted(async () => {
  if (!isWebSecurity.value) return
  // 如果 SSR 已经认证通过（内容已加载），不再检查
  if (post.value) return

  try {
    const check = await $fetch<{ ok: boolean }>('/api/auth/check')
    if (check?.ok) {
      window.location.reload()
      return
    }
  } catch {}
  gateChecking.value = false

  // 加载问题
  try {
    gateQuestions.value = await $fetch<GateQuestion[]>('/api/auth/questions')
  } catch (e) {
    console.error('加载问题失败', e)
  }
})

async function gateSubmit() {
  gateError.value = ''
  if (!gateAnswer1.value.trim() || !gateAnswer2.value.trim()) {
    gateError.value = '请回答所有问题'
    return
  }
  if (!gateQuestions.value || gateQuestions.value.length < 2) {
    gateError.value = '问题加载失败，请刷新重试'
    return
  }
  gateLoading.value = true
  try {
    await $fetch('/api/auth/verify', {
      method: 'POST',
      body: { answers: [
        { id: gateQuestions.value[0].id, answer: gateAnswer1.value },
        { id: gateQuestions.value[1].id, answer: gateAnswer2.value },
      ]},
    })
    window.location.reload()
  } catch (e: any) {
    gateError.value = e?.data?.message || '答案不正确，请重试'
    gateAnswer1.value = ''
    gateAnswer2.value = ''
  }
  gateLoading.value = false
}

const showGate = computed(() => isWebSecurity.value && !post.value && !gateChecking.value)
</script>

<template>
    <template #aside>
        <WidgetBlogFolderTree />
        <component :is="widget.comp" v-for="widget in widgets" :key="widget.name" />
    </template>

    <!-- DevTools 检测遮罩 -->
    <div v-if="devToolsOpen" class="devtools-block">
        <Icon name="tabler:shield-lock" />
        <h2>请关闭开发者工具</h2>
        <p>检测到您打开了开发者工具(F12)，请关闭后继续浏览</p>
    </div>

    <div v-if="post" ref="articleRef" class="article-protect" :class="{ blurred: isBlurred }">
        <div class="blur-overlay">
            <Icon name="tabler:shield-lock" />
            <span>请勿截屏传播</span>
        </div>
        <PostHeader v-bind="post" />
        <PostExcerpt v-if="excerpt" :excerpt />
        <ContentRenderer class="article" :class="getPostTypeClassName(post?.type, { prefix: 'md' })" :value="post" tag="article" />
        <PostFooter v-bind="post" />
        <PostSurround />
        <PostComment />
    </div>

    <!-- 密码门 -->
    <div v-else-if="showGate" class="gate-wrap">
      <div class="gate-card">
        <div class="gate-icon"><Icon name="tabler:shield-lock" /></div>
        <h2 class="gate-title">身份验证</h2>
        <p class="gate-desc">此处内容需要验证身份后才能访问，请回答以下问题：</p>

        <div v-if="!gateQuestions" class="gate-loading">
          <Icon name="tabler:loader-2" class="animate-spin" /> 加载问题…
        </div>

        <div v-else class="gate-form">
          <div class="gate-field">
            <label>{{ gateQuestions[0]?.text }}</label>
            <input v-model="gateAnswer1" type="text" placeholder="请输入答案" @keyup.enter="gateSubmit" />
          </div>
          <div class="gate-field">
            <label>{{ gateQuestions[1]?.text }}</label>
            <input v-model="gateAnswer2" type="text" placeholder="请输入答案" @keyup.enter="gateSubmit" />
          </div>
        </div>

        <div v-if="gateError" class="gate-err">{{ gateError }}</div>

        <button v-if="gateQuestions" class="gate-btn" :disabled="gateLoading" @click="gateSubmit">
          <Icon v-if="gateLoading" name="tabler:loader-2" class="animate-spin" />
          <Icon v-else name="tabler:key" />
          {{ gateLoading ? '验证中…' : '验证' }}
        </button>
      </div>
    </div>

    <!-- 检查中 -->
    <div v-else-if="isWebSecurity" class="gate-wrap">
      <div class="gate-card">
        <Icon name="tabler:loader-2" class="animate-spin" style="font-size:2rem;color:var(--c-primary);" />
      </div>
    </div>

    <div v-else class="w-full h-screen flex items-center justify-center" style="background: #1a1a2e;">
        <p class="text-white/60 text-lg" style="font-family: system-ui, sans-serif;">Loading...</p>
    </div>
</template>

<style lang="scss" scoped>
.gate-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 2rem;
}
.gate-card {
  width: 100%;
  max-width: 420px;
  padding: 2rem;
  border-radius: 1rem;
  background-color: var(--ld-bg-card);
  box-shadow: var(--box-shadow-2);
  border: 1px solid var(--c-border);
  text-align: center;
}
.gate-icon { font-size: 2.5rem; color: var(--c-primary); margin-bottom: 0.5rem; }
.gate-title { font-size: 1.25rem; font-weight: 600; color: var(--c-text-1); margin-bottom: 0.5rem; }
.gate-desc { font-size: 0.85rem; color: var(--c-text-3); margin-bottom: 1.5rem; line-height: 1.5; }
.gate-loading { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 2rem 0; color: var(--c-text-3); font-size: 0.9rem; }
.gate-form { display: flex; flex-direction: column; gap: 1rem; text-align: left; }
.gate-field {
  label { display: block; font-size: 0.85rem; font-weight: 500; color: var(--c-text-2); margin-bottom: 0.35rem; }
  input {
    width: 100%; padding: 0.6rem 0.75rem; border-radius: 0.5rem;
    border: 1px solid var(--c-border); background-color: var(--c-bg-2);
    color: var(--c-text-1); font-size: 0.9rem;
    &:focus { outline: none; border-color: var(--c-primary); }
    &::placeholder { color: var(--c-text-3); }
  }
}
.gate-err { margin-top: 1rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background-color: var(--c-error-soft); color: var(--c-error); font-size: 0.85rem; }
.gate-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  margin-top: 1.25rem; padding: 0.6rem 2rem; border-radius: 0.5rem;
  border: none; background-color: var(--c-primary); color: #fff;
  font-size: 0.9rem; font-weight: 500; cursor: pointer;
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

// 截屏保护：窗口失焦时模糊 + 蒙层
.article-protect {
  position: relative;
}
.blur-overlay {
  display: none;
  position: absolute;
  inset: 0;
  z-index: 9999;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 1rem;
  font-size: 1rem;
  color: #fff;
  pointer-events: none;
}
.blurred {
  .blur-overlay { display: flex; }
  > :not(.blur-overlay) { filter: blur(8px); pointer-events: none; }
}

// DevTools 检测遮罩
.devtools-block {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.92);
  color: #fff;
  text-align: center;
  font-size: 1.2rem;
  h2 { font-size: 2rem; color: #ff4444; }
  p { color: #aaa; }
  .iconify { font-size: 4rem; color: #ff4444; }
}

// 打印保护：隐藏文章内容
@media print {
  .article-protect > :not(.blur-overlay) {
    display: none !important;
  }
  .blur-overlay {
    display: flex !important;
    position: fixed;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
