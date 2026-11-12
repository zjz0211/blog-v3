import type { FeedGroup } from '../app/types/feed'

export default [
	{
		name: '友链',
		desc: '网络上认识的朋友们，各自记录着各自的折腾',
		entries: [
			{
				author: 'A1right',
				sitenick: 'A1right的小窝',
				title: 'A1right的小窝',
				desc: 'A1right 的网络安全博客，聚焦 Web 安全、CTF 题解和 WEB 渗透测试。',
				link: 'https://itsa1right.ink/',
				icon: 'https://itsa1right.ink/favicon.ico',
				avatar: 'https://itsa1right.ink/images/a1right-avatar-icon.png',
				archs: ['Astro'],
				date: '2026-11-12',
			},
			{
				author: '黄景豪',
				sitenick: '凝核 Nucleus',
				title: '凝核 Nucleus',
				desc: '技术博客、趁手工具与摸鱼小游戏，凝而聚之，核而生光。',
				link: 'https://blog.poachedegg.cn/',
				feed: 'https://blog.poachedegg.cn/rss.xml',
				icon: 'https://blog.poachedegg.cn/favicon.svg',
				avatar: 'https://oss.poachedegg.cn/nucleus-public/images/2026/92453756-a32b-4212-97d8-d71e09ce9661.webp',
				archs: ['Nuxt'],
				date: '2026-11-12',
			},
		],
	},
] satisfies FeedGroup[]
