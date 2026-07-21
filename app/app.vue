<script setup lang="ts">
// Cloudflare Web Analytics — 零性能开销，不追踪个人，无需 Cookie 横幅
useHead({
  script: [
    {
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      'data-cf-beacon': JSON.stringify({ token: '977c1fa25e5544149ab917fbf26b3bab' }),
      defer: true,
    },
  ],
})

// 只在客户端加载当前主题对应的视频，避免同时加载两个视频导致卡顿
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
</script>

<template>
	<!-- 视频背景：仅客户端渲染，按主题只加载当前需要的那一个 -->
	<ClientOnly>
		<div v-if="isDark" id="bg-video-dark">
			<video autoplay loop muted playsinline preload="metadata">
				<source
					src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411.mp4"
					type="video/mp4"
				/>
			</video>
		</div>
		<div v-else id="bg-video-light">
			<video autoplay loop muted playsinline preload="metadata">
				<source
					src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_131941_d136af49-e243-493a-be14-6ff3f24e09e6.mp4"
					type="video/mp4"
				/>
			</video>
		</div>
	</ClientOnly>
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
