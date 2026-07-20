<template>
	<BlogWidget card title="关注我抖音">
		<div class="douyin-qr">
			<img
				src="/douyin-qr.jpg"
				alt="抖音关注码"
				class="qr-img"
			>
			<p class="qr-text">扫码关注我的抖音</p>
		</div>
	</BlogWidget>
</template>

<style lang="scss" scoped>
.douyin-qr {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5em;
}

.qr-img {
	width: 100%;
	max-width: 200px;
	border-radius: 8px;
}

.qr-text {
	margin: 0;
	font-size: 0.9em;
	color: var(--c-text-2);
}
</style>
