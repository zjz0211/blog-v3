<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
	error: NuxtError & { url?: string }
}>()

const scaleY = ref(1)
const textRef = ref<HTMLElement>()
const route = useRoute()

function recalc() {
	if (!textRef.value) return
	const prev = textRef.value.style.transform
	textRef.value.style.transform = 'none'
	const h = textRef.value.offsetHeight
	textRef.value.style.transform = prev
	if (h > 0) scaleY.value = (window.innerHeight / h) * 1.4
}

onMounted(() => {
	recalc()
	window.addEventListener('resize', recalc)
})

onUnmounted(() => window.removeEventListener('resize', recalc))

function goHome() {
	clearError({ redirect: '/' })
}
</script>

<template>
<div class="w-full h-screen overflow-hidden flex flex-col relative bg-gradient-to-b from-[#FF8233] to-[#FDAC55]">
	<!-- Background "404" + Oval -->
	<div
		class="absolute inset-0 pointer-events-none flex items-center justify-center opacity-80"
		style="mask-image: linear-gradient(to bottom, black 40%, transparent 95%); -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 95%);"
	>
		<div class="relative flex items-center justify-center">
			<div
				ref="textRef"
				class="text-white font-black leading-none tracking-tighter whitespace-nowrap select-none"
				:style="{ fontSize: 'clamp(200px, 48vw, 800px)', transform: `scale(1.15, ${scaleY * 1.4})` }"
			>
				{{ error.statusCode || 404 }}
			</div>
			<div
				class="absolute rounded-full bg-white h-[22vh] sm:h-[26vh] md:h-[50vh]"
				:style="{ width: 'clamp(120px, 20vw, 400px)', transform: `scaleY(${scaleY})`, transformOrigin: 'center' }"
			/>
		</div>
	</div>

	<!-- Navigation Bar -->
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
			<a href="/" class="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-[#F16524] hover:opacity-90 transition-colors">About Us</a>
			<a href="/" class="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-[#F16524] hover:opacity-90 transition-colors">Programs</a>
			<a href="/" class="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-[#F16524] hover:opacity-90 transition-colors">Reviews</a>
			<a href="/" class="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-[#F16524] hover:opacity-90 transition-colors">FAQ</a>
			<a href="/" class="px-4 py-1.5 text-sm font-medium rounded-full bg-white text-[#F16524] hover:opacity-90 transition-colors">Contacts</a>
		</div>
	</nav>

	<!-- Center Video -->
	<div
		class="absolute inset-0 flex items-center justify-center pointer-events-none"
		style="margin-top: calc(-6vh - 40px);"
	>
		<div class="w-[120vw] h-[85vh] sm:w-[70vw] sm:h-[70vh] md:w-[62vw] md:h-[78vh]">
			<video
				autoplay
				loop
				muted
				playsinline
				class="w-full h-full object-contain pointer-events-none mix-blend-darken"
			>
				<source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260713_234424_b1332b69-2e69-4302-8dbc-40f86846afbd.mp4" type="video/mp4">
			</video>
		</div>
	</div>

	<!-- Bottom Content -->
	<div class="relative z-30 mt-auto pb-8 sm:pb-16 flex flex-col items-center text-center px-4">
		<h2 class="text-white text-lg sm:text-xl md:text-2xl font-medium mb-3 sm:mb-4">
			Oops, something went wrong!
		</h2>
		<button
			class="inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full text-white font-semibold text-sm sm:text-base hover:scale-105 hover:shadow-lg transition-all"
			style="background-color: #F16524;"
			@click="goHome"
		>
			<svg class="w-4 h-4 sm:w-5 sm:h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
			Back to Home
		</button>
	</div>
</div>
</template>
