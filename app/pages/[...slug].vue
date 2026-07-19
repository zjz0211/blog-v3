<script setup lang="ts">
const route = useRoute()

const { data: post } = await useAsyncData(
    `content:${route.path}`,
    () => queryCollection('content').path(route.path).first(),
)

const excerpt = computed(() => post.value?.description || '')
const menuOpen = ref(false)
const scaleY = ref(1)
const textRef = ref()

function recalcScale() {
    if (!textRef.value) return
    const prev = textRef.value.style.transform
    textRef.value.style.transform = 'none'
    const h = textRef.value.offsetHeight
    textRef.value.style.transform = prev
    if (h > 0) scaleY.value = (window.innerHeight / h) * 1.4
}

onMounted(() => { recalcScale(); window.addEventListener('resize', recalcScale) })
onUnmounted(() => window.removeEventListener('resize', recalcScale))

watch(menuOpen, (open) => { if (import.meta.client) document.body.style.overflow = open ? 'hidden' : '' })

function closeMenu() { menuOpen.value = false }
const navItems = ['About Us', 'Programs', 'Reviews', 'FAQ', 'Contacts']

if (post.value) {
    useSeoMeta({ title: post.value.title, ogType: '', ogImage: post.value.image, description: post.value.description })
} else {
    const event = useRequestEvent()
    event && setResponseStatus(event, 404)
    useHead({
        title: '404 - Page Not Found',
        link: [
            { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
            { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
            { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap' }
        ]
    })
    route.meta.title = '404'
}
</script>

<template>
<NuxtLayout>
    <template #aside>
        <component :is="widget.comp" v-for="widget in widgets" :key="widget.name" />
    </template>

    <template v-if="post">
        <PostHeader v-bind="post" />
        <PostExcerpt v-if="excerpt" :excerpt />
        <ContentRenderer class="article" :class="getPostTypeClassName(post?.type, { prefix: 'md' })" :value="post" tag="article" />
        <PostFooter v-bind="post" />
        <PostSurround />
        <PostComment />
    </template>

    <div v-else class="w-full h-screen overflow-hidden flex flex-col relative" style="background: linear-gradient(to bottom, #FF8233 0%, #FDAC55 100%); font-family: 'Inter', system-ui, sans-serif;">
    <div class="absolute inset-0 pointer-events-none flex items-center justify-center" style="opacity: 0.8; mask-image: linear-gradient(to bottom, black 40%, transparent 95%); -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 95%);">
        <div class="relative flex items-center justify-center">
            <div ref="textRef" class="text-white font-black leading-none tracking-tighter whitespace-nowrap select-none" style="font-size: clamp(200px, 48vw, 800px);" :style="{ transform: `scale(1.15, ${scaleY * 1.4})` }">404</div>
            <div class="absolute rounded-full bg-white h-[22vh] sm:h-[26vh] md:h-[50vh]" style="width: clamp(120px, 20vw, 400px); transform-origin: center;" :style="{ transform: `scaleY(${scaleY})` }"></div>
        </div>
    </div>

    <nav class="relative z-20 flex items-center justify-between px-4 sm:px-6 md:px-12 py-4 sm:py-5">
        <div class="flex items-center">
            <div class="grid grid-cols-2 gap-0.5">
                <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
            </div>
            <span class="text-white font-bold text-lg sm:text-xl ml-1">TinyTrails</span>
        </div>
        <div class="hidden md:flex flex-row gap-1">
            <a v-for="item in navItems" :key="item" href="/" class="px-4 py-1.5 text-sm font-medium rounded-full bg-white hover:opacity-90 transition-colors" style="color: #F16524;">{{ item }}</a>
        </div>
        <button type="button" class="flex md:hidden items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-white hover:opacity-90 transition-colors" style="background-color: #F16524;" @click="menuOpen = true">
            <Icon name="tabler:menu" class="w-4 h-4" />
            <span class="text-sm font-medium hidden sm:inline">Menu</span>
        </button>
    </nav>

    <div class="fixed inset-0 z-50 transition-all duration-500" style="transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);" :class="menuOpen ? 'visible' : 'invisible'">
        <button type="button" aria-label="Close menu" class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500" :class="menuOpen ? 'opacity-100' : 'opacity-0'" @click="closeMenu" />
        <div class="absolute top-0 right-0 h-full w-full sm:w-[380px] transition-transform duration-500" style="background: linear-gradient(135deg, #FF6B1A 0%, #FF9642 100%); transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);" :class="menuOpen ? 'translate-x-0' : 'translate-x-full'">
            <div class="flex items-center justify-between px-6 py-5">
                <div class="flex items-center">
                    <div class="grid grid-cols-2 gap-0.5">
                        <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                        <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                        <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                        <div class="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full" />
                    </div>
                    <span class="text-white font-bold text-lg sm:text-xl ml-1">TinyTrails</span>
                </div>
                <button type="button" class="w-10 h-10 rounded-full text-white hover:bg-white/30 flex items-center justify-center transition-colors" style="background-color: rgba(255,255,255,0.2);" @click="closeMenu"><Icon name="tabler:x" class="w-5 h-5" /></button>
            </div>
            <div class="px-6 py-4 flex flex-col gap-3">
                <a v-for="(item, i) in navItems" :key="item" href="/" class="px-6 py-4 text-lg font-semibold text-white rounded-2xl transition-all duration-300" style="background-color: rgba(255,255,255,0.1);" :class="menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'" :style="{ transitionDelay: menuOpen ? `${150 + i * 60}ms` : '0ms' }" @click="closeMenu">{{ item }}</a>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-6 transition-all duration-500" :style="{ transitionDelay: menuOpen ? '450ms' : '0ms', opacity: menuOpen ? 1 : 0 }">
                <a href="/" class="w-full py-4 rounded-full bg-white font-semibold text-base flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform" style="color: #F16524;" @click="closeMenu">
                    <Icon name="tabler:arrow-left" class="w-5 h-5" />
                    Back to Home
                </a>
            </div>
        </div>
    </div>

    <div class="absolute inset-0 flex items-center justify-center pointer-events-none" style="margin-top: calc(-6vh - 40px);">
        <div class="w-[120vw] h-[85vh] sm:w-[70vw] sm:h-[70vh] md:w-[62vw] md:h-[78vh]">
            <video autoplay loop muted playsinline preload="none" class="w-full h-full object-contain pointer-events-none" style="mix-blend-mode: darken;">
                <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260713_234424_b1332b69-2e69-4302-8dbc-40f86846afbd.mp4" type="video/mp4">
            </video>
        </div>
    </div>

    <div class="relative z-30 mt-auto pb-8 sm:pb-16 flex flex-col items-center text-center px-4">
        <h2 class="text-white text-lg sm:text-xl md:text-2xl font-medium mb-3 sm:mb-4">Oops, something went wrong!</h2>
        <button type="button" class="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full text-white font-semibold text-sm sm:text-base hover:scale-105 hover:shadow-lg transition-all" style="background-color: #F16524;" @click="navigateTo('/')">
            <Icon name="tabler:arrow-left" class="w-4 h-4 sm:w-5 sm:h-5" />
            Back to Home
        </button>
    </div>
</div>
</NuxtLayout>
</template>
