// 访问统计：基于 CountAPI 的免后端计数器，与 itsa1right.ink 的访问概览同源
// 接口文档：https://countapi.mileshilliard.com/api/v1/get/{key}
const COUNT_API_BASE = 'https://countapi.mileshilliard.com/api/v1'
const COUNTER_PREFIX = 'zjz946649-top'
const COUNTED_SESSION_PREFIX = 'blog-visit-counted'
const COUNTABLE_HOST = 'zjz946649.top'
const REFRESH_INTERVAL = 30_000

type CounterKind = 'site-total' | 'site-daily'
type CounterStatus = 'loading' | 'live' | 'offline'

const todayCount = ref<number | null>(null)
const totalCount = ref<number | null>(null)
const status = ref<CounterStatus>('loading')

let refreshTimer: ReturnType<typeof setInterval> | undefined

/** 以博客时区计算日期，保证跨时区访客的“今日”一致 */
function today() {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

function buildKey(kind: CounterKind) {
	return kind === 'site-total'
		? `${COUNTER_PREFIX}__site-total`
		: `${COUNTER_PREFIX}__site-daily__${today()}`
}

async function requestCounter(kind: CounterKind, hit = false): Promise<number | null> {
	try {
		const endpoint = hit ? 'hit' : 'get'
		const response = await fetch(`${COUNT_API_BASE}/${endpoint}/${encodeURIComponent(buildKey(kind))}`, {
			mode: 'cors',
			cache: 'no-store',
		})
		if (response.status === 404)
			return 0
		if (!response.ok)
			return null
		const payload = await response.json()
		const value = Number(payload?.value)
		return Number.isFinite(value) ? value : null
	}
	catch {
		return null
	}
}

function applyCounts(daily: number | null, total: number | null) {
	if (daily !== null)
		todayCount.value = daily
	if (total !== null)
		totalCount.value = total
	if (daily !== null || total !== null)
		status.value = 'live'
	else
		status.value = 'offline'
}

/** 拉取当前计数，不增加计数 */
async function refresh() {
	const [daily, total] = await Promise.all([
		requestCounter('site-daily'),
		requestCounter('site-total'),
	])
	applyCounts(daily, total)
}

/**
 * 记录一次页面访问。
 * 同一会话内同一路径只计一次，避免刷新页面把数据刷高。
 * 开发环境和预览域名不计数，防止污染正式数据。
 */
async function countVisit() {
	if (import.meta.dev || typeof window === 'undefined')
		return
	if (!window.location.hostname.endsWith(COUNTABLE_HOST))
		return

	const path = window.location.pathname.replace(/\/+$/, '') || '/'
	const sessionKey = `${COUNTED_SESSION_PREFIX}:${today()}:${path}`
	if (window.sessionStorage.getItem(sessionKey))
		return
	// 先占位，避免同一页面的并发请求重复计数
	window.sessionStorage.setItem(sessionKey, '1')

	const [daily, total] = await Promise.all([
		requestCounter('site-daily', true),
		requestCounter('site-total', true),
	])
	applyCounts(daily, total)
}

function onVisibilityChange() {
	if (document.visibilityState === 'visible')
		refresh()
}

/** 组件挂载时启动：立即拉取一次，之后定时“实时”刷新 */
function startAutoRefresh() {
	refresh()
	stopAutoRefresh()
	refreshTimer = setInterval(() => {
		if (document.visibilityState === 'visible')
			refresh()
	}, REFRESH_INTERVAL)
	document.addEventListener('visibilitychange', onVisibilityChange)
}

function stopAutoRefresh() {
	if (refreshTimer)
		clearInterval(refreshTimer)
	refreshTimer = undefined
	document.removeEventListener('visibilitychange', onVisibilityChange)
}

export function useVisitStats() {
	return {
		todayCount,
		totalCount,
		status,
		countVisit,
		refresh,
		startAutoRefresh,
		stopAutoRefresh,
	}
}
