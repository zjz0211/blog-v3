// 全站访问计数：首次打开和客户端路由切换时记录一次访问
export default defineNuxtPlugin((nuxtApp) => {
	const { countVisit } = useVisitStats()
	const router = useRouter()

	nuxtApp.hook('app:mounted', () => countVisit())
	router.afterEach(() => countVisit())
})
