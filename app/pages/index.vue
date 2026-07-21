<script setup lang="ts">
import { orderBy } from 'es-toolkit/array'

const appConfig = useAppConfig()
useSeoMeta({
	description: appConfig.description,
	ogImage: appConfig.author.avatar,
})

const { data: listRaw } = await useAsyncData('posts:index', () => getArticleIndexOptions(), { default: () => [] })

// web-security 认证：未登录时从首页列表隐藏 web-security 文章
const wsAuth = useCookie<string>('ws_auth')
const isWsAuthed = computed(() => {
  if (!wsAuth.value) return false
  try {
    const decStr = import.meta.server ? Buffer.from(wsAuth.value, 'base64').toString('utf8') : atob(wsAuth.value)
    const decoded = JSON.parse(decStr)
    return decoded.ok && decoded.hash === 'blog-zjz-web-security-2026' && Date.now() - decoded.time < 3600_000
  } catch { return false }
})
const listFiltered = computed(() => {
  if (isWsAuthed.value) return listRaw.value
  return listRaw.value.filter((item: any) => {
    const p = item.path || item.stem || ''
    return !p.includes('web-security')
  })
})

const { listSorted, isAscending, sortOrder } = useArticleSort(listFiltered, { bindDirectionQuery: 'asc', bindOrderQuery: 'sort' })
const { category, categories, listCategorized } = useCategory(listSorted, { bindQuery: 'category' })
const { page, totalPages, listPaged } = usePagination(listCategorized, { bindQuery: 'page' })

watch(category, () => {
	page.value = 1
})

useSeoMeta({ title: () => (page.value > 1 ? `第${page.value}页` : '') })

const listRecommended = computed(() => orderBy(
	listRaw.value.filter(item => item.recommend !== null && !item.path?.includes('web-security')),
	['recommend', 'date'],
	['desc'],
))

const { data: previewCount } = useAsyncData(
	'previews:count',
	() => queryCollection('content').where('stem', 'LIKE', 'previews/%').count(),
)
</script>

<template>
<template #aside>
	<WidgetBlogStats />
	<WidgetBlogTech />
	<WidgetDouyin />
</template>

<BlogHeader class="mobile-only" to="/" tag="h1" />

<UtilHydrateSafe>
	<PostSlide v-if="listRecommended.length && !category" :list="listRecommended" />

		<WidgetBlogFolderTree v-if="page === 1 && !category" />

	<div class="post-list">
		<PostOrderToggle
			v-model:is-ascending="isAscending"
			v-model:sort-order="sortOrder"
			v-model:category="category"
			:categories
		>
			<ZSecret>
				<UtilLink v-if="previewCount" to="/preview" class="preview-entrance">
					<Icon name="tabler:shield-lock" />
					查看预览文章
				</UtilLink>
			</ZSecret>
		</PostOrderToggle>

		<TransitionGroup tag="menu" class="proper-height" name="float-in">
			<PostArticle
				v-for="article, index in listPaged"
				:key="article.path"
				v-bind="article"
				:to="article.path"
				:use-updated="sortOrder === 'updated'"
				:style="getFixedDelay(index * 0.05)"
			/>
		</TransitionGroup>

		<ZPagination v-model="page" sticky avoid :total-pages="totalPages" />
	</div>
</UtilHydrateSafe>
</template>

<style lang="scss" scoped>
.post-list {
	margin: 1rem;
}

.float-in-leave-to {
	position: absolute;
}
</style>
