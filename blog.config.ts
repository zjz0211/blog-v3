import type { FeedEntry } from './app/types/feed'

const basicConfig = {
	title: 'chzu老张的小白之路',
	subtitle: '记录学习网络安全之路，从入门到退出',
	// 长 description 利好于 SEO
	description: '张锦洲的个人博客，记录学习网络安全技术的点滴。一名初学者从入门到退出的折腾之路，分享 CTF、渗透、开发的技术笔记与思考。',
	author: {
		name: '张锦洲',
		avatar: '/avatar.jpg',
		email: '3084295605@qq.com',
		homepage: 'https://zjz946649.top',
	},
	copyright: {
		abbr: 'CC BY-NC-SA 4.0',
		name: '署名-非商业性使用-相同方式共享 4.0 国际',
		url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans',
	},
	favicon: '/favicon.svg',
	language: 'zh-CN',
	timeEstablished: '2026-07-19',
	timeZone: 'Asia/Shanghai',
	url: 'https://zjz946649.top/',
	defaultCategory: '未分类',
}

// 存储 nuxt.config 和 app.config 共用的配置
// 此处为启动时需要的配置，启动后可变配置位于 app/app.config.ts
// @keep-sorted
const blogConfig = {
	...basicConfig,

	article: {
		categories: {
			[basicConfig.defaultCategory]: { icon: 'tabler:circle-dashed' },
			/** 编程：代码实现/工程实践/开发方法 */
			技术: { icon: 'tabler:mouse', color: '#33aaff' },
			/** CTF：Capture The Flag 比赛与刷题记录 */
			CTF: { icon: 'tabler:flag', color: '#ff7733' },
			/** 安全：漏洞/渗透/安全事件分析 */
			安全: { icon: 'tabler:shield', color: '#33bbaa' },
			/** 生活随笔与日常 */
			随笔: { icon: 'tabler:feather', color: '#ff7777' },
		},
		/** 文章版式，首个为默认版式 */
		types: {
			tech: {},
			story: {},
		},
		/** 分类排序方式，键为排序字段，值为显示名称 */
		order: {
			date: '创建日期',
			updated: '更新日期',
			// title: '标题',
		},
		/** 使用 pnpm new 新建文章时自动生成自定义链接（permalink/abbrlink） */
		useRandomPremalink: false,
		/** 隐藏基于文件路由（不是自定义链接）的 URL /post 路径前缀 */
		hidePostPrefix: true,
		/** 禁止搜索引擎收录的路径 */
		robotsNotIndex: ['/preview', '/previews/*'],
	},

	/** 博客 Atom 订阅源 */
	feed: {
		/** 订阅源最大文章数量 */
		limit: 50,
		/** 订阅源是否启用XSLT样式 */
		enableStyle: true,
	},

	/** 向 <head> 中添加脚本 */
	scripts: [
		// 不蒜子博客计数：https://busuanzi.ibruce.info/
		{ src: 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js', defer: true },
		// Cloudflare Web Analytics — 零性能开销，不追踪个人，无需 Cookie 横幅
		{ src: 'https://static.cloudflareinsights.com/beacon.min.js', defer: true, 'data-cf-beacon': '{"token":"977c1fa25e5544149ab917fbf26b3bab"}' },
		// Giscus 评论区脚本已移至 Comment.vue 中按需加载，避免全局加载与组件内重复
	],
}

/** 用于生成 OPML 和友链页面配置 */
export const myFeed: FeedEntry = {
	author: blogConfig.author.name,
	sitenick: '小白之路',
	title: blogConfig.title,
	desc: blogConfig.subtitle || blogConfig.description,
	link: blogConfig.url,
	feed: new URL('/atom.xml', blogConfig.url).toString(),
	icon: blogConfig.favicon,
	avatar: blogConfig.author.avatar,
	archs: ['Nuxt', 'Cloudflare Pages'],
	date: blogConfig.timeEstablished,
	comment: '这是我自己',
}

export default blogConfig
