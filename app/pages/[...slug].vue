<script setup lang="ts">
const route = useRoute()

const { data: post } = await useAsyncData(
    `content:${route.path}`,
    () => queryCollection('content').path(route.path).first(),
)

const excerpt = computed(() => post.value?.description || '')

if (post.value) {
    useSeoMeta({ title: post.value.title, ogType: '', ogImage: post.value.image, description: post.value.description })
} else {
    const event = useRequestEvent()
    if (event) setResponseStatus(event, 404)
    useHead({ title: '404 - Page Not Found' })
    route.meta.title = '404'
}

onMounted(() => {
    if (!post.value && !route.path.startsWith('/404-page')) {
        window.location.replace('/404-page/')
    }
})

// 文章页侧边栏：显示目录（TOC）
const { widgets } = useWidgets(post.value ? ['toc'] : [])
</script>

<template>
    <!-- aside 透传到 app.vue 的 NuxtLayout（不再嵌套第二层 NuxtLayout，避免页面重合） -->
    <template #aside>
        <component :is="widget.comp" v-for="widget in widgets" :key="widget.name" />
    </template>

    <div v-if="post">
        <PostHeader v-bind="post" />
        <PostExcerpt v-if="excerpt" :excerpt />
        <ContentRenderer class="article" :class="getPostTypeClassName(post?.type, { prefix: 'md' })" :value="post" tag="article" />
        <PostFooter v-bind="post" />
        <PostSurround />
        <PostComment />
    </div>

    <div v-else class="w-full h-screen flex items-center justify-center" style="background: #1a1a2e;">
        <p class="text-white/60 text-lg" style="font-family: system-ui, sans-serif;">Loading...</p>
    </div>
</template>
