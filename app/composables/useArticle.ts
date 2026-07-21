import type { ContentCollectionItem } from '@nuxt/content'
import type { MetaSlotsTree } from '~~/remark-plugins/rehype-meta-slots'
import type { ArticleOrderType, ArticleProps } from '~/types/article'
import { orderBy } from 'es-toolkit/array'

/** 获取已加载的文章内容/元信息 */
export function useArticle(path?: MaybeRefOrGetter<string | undefined>) {
	const route = useRoute()
	const dataKey = computed(() => `content:${toValue(path) ?? route.path}`)
	const post = computed(() => useNuxtData<ContentCollectionItem | null | undefined>(dataKey.value).data.value)

	return {
		dataKey,
		post,
		toc: computed(() => post.value?.body.toc),
		metaSlots: computed(() => post.value?.meta.slots as Record<string, MetaSlotsTree>),
	}
}

/**
	 * 封面池：所有文章默认从这里随机选取封面
	 */
	const COVER_POOL = [
		'/images/covers/1.jpeg', '/images/covers/12.gif', '/images/covers/13.gif', '/images/covers/14.gif', '/images/covers/15.gif', '/images/covers/16.gif', '/images/covers/17.gif', '/images/covers/18.gif', '/images/covers/19.gif', '/images/covers/20.gif', '/images/covers/21.gif', '/images/covers/22.gif', '/images/covers/23.gif', '/images/covers/24.gif', '/images/covers/25.gif',
		'/images/covers/2.jpg',
		'/images/covers/3.jpg',
		'/images/covers/4.jpg',
		'/images/covers/5.jpg',
		'/images/covers/6.jpg',
		'/images/covers/7.jpg',
		'/images/covers/8.jpg',
		'/images/covers/9.jpg',
		'/images/covers/10.jpg',
		'/images/covers/11.jpeg',
	]

	/** 根据文件名哈希选取稳定封面 */
	function getDefaultCover(path: string) {
		let hash = 0
		for (let i = 0; i < path.length; i++)
			hash = ((hash << 5) - hash + path.charCodeAt(i)) | 0
		return COVER_POOL[Math.abs(hash) % COVER_POOL.length]
	}

	/**
	 * 生成文章查询参数，完全包装 useAsyncData 会使 SSR 行为异常，缓存 key 需要暴露
	 * @see https://nuxt.com/docs/4.x/api/composables/use-async-data#usage
	 * @see https://github.com/nuxt/nuxt/issues/14736
	 * @todo 支持分页/分类筛选
	 */
	export async function getArticleIndexOptions(path = 'posts/%') {
		const list = await queryCollection('content')
			.where('stem', 'LIKE', path)
			.select('categories', 'date', 'description', 'image', 'path', 'readingTime', 'recommend', 'tags', 'title', 'type', 'updated')
			.all()

		// 为没有封面的文章自动分配随机封面
		for (const item of list) {
			if (!item.image)
				item.image = getDefaultCover(item.path || '')
		}

		return list
	}

interface UseCategoryOptions {
	bindQuery?: string
}

export function useCategory(list: MaybeRefOrGetter<ArticleProps[]>, options?: UseCategoryOptions) {
	const { bindQuery } = options || {}

	const category = bindQuery
		? useRouteQuery(bindQuery, undefined)
		: ref<string | undefined>()

	const categories = computed(() => [...new Set(toValue(list).map(item => item.categories?.[0]))])

	const listCategorized = computed(
		() => toValue(list).filter(
			item => !category.value || item.categories?.[0] === category.value,
		),
	)

	return {
		category,
		categories,
		listCategorized,
	}
}

interface UseArticleSortOptions {
	bindDirectionQuery?: string
	bindOrderQuery?: string
	initialAscend?: boolean
	initialOrder?: ArticleOrderType
}

export function useArticleSort(list: MaybeRefOrGetter<ArticleProps[]>, options?: UseArticleSortOptions) {
	const appConfig = useAppConfig()
	const {
		bindDirectionQuery,
		bindOrderQuery,
		initialAscend = false,
		initialOrder = appConfig.pagination.sortOrder || 'date',
	} = options || {}

	const sortOrder = bindOrderQuery
		? useRouteQuery(bindOrderQuery, initialOrder)
		: ref<ArticleOrderType>(initialOrder)

	const booleanQueryTransformer = {
		get: (val: string) => val === 'true',
		set: (val: boolean) => val.toString(),
	}

	const isAscending = bindDirectionQuery
		? useRouteQuery(bindDirectionQuery, initialAscend.toString(), { transform: booleanQueryTransformer })
		: ref<boolean>(initialAscend)

	const listSorted = computed(() => orderBy(
		toValue(list),
		[sortOrder.value, 'date'],
		[isAscending.value ? 'asc' : 'desc'],
	))

	return {
		sortOrder,
		isAscending,
		listSorted,
	}
}

export function getCategoryIcon(category?: string) {
	const appConfig = useAppConfig()
	return appConfig.article.categories[category!]?.icon ?? 'tabler:folder'
}

export function getCategoryColor(category?: string) {
	const appConfig = useAppConfig()
	return appConfig.article.categories[category!]?.color
}

interface GetPostTypeClassNameOptions {
	prefix?: string
}

export function getPostTypeClassName(type = 'tech', options?: GetPostTypeClassNameOptions) {
	const { prefix = 'text' } = options || {}
	return `${prefix}-${type}`
}
