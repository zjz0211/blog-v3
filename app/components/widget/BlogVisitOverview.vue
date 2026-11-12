<script setup lang="ts">
const { todayCount, totalCount, status, startAutoRefresh, stopAutoRefresh } = useVisitStats()

const numberFormat = new Intl.NumberFormat('zh-CN')

const statusText = computed(() => ({
	loading: '连接中',
	live: '实时更新',
	offline: '服务不可用',
}[status.value]))

const statusTip = computed(() => status.value === 'offline'
	? '访问统计服务暂时不可用，不影响博客正常浏览'
	: '每 30 秒自动刷新，有访客打开页面时计数会更新')

function display(value: number | null) {
	return value === null ? '--' : numberFormat.format(value)
}

onMounted(startAutoRefresh)
onUnmounted(stopAutoRefresh)
</script>

<template>
<BlogWidget card title="访问概览">
	<template #action>
		<span class="visit-status" :class="status" :title="statusTip">
			<span class="visit-status__dot" aria-hidden="true" />
			{{ statusText }}
		</span>
	</template>

	<div class="visit-grid">
		<div class="visit-metric visit-metric--daily">
			<Icon name="tabler:calendar-stats" class="visit-metric__icon" aria-hidden="true" />
			<p class="visit-metric__label">
				今日访问
			</p>
			<strong class="visit-metric__value" aria-live="polite">{{ display(todayCount) }}</strong>
		</div>
		<div class="visit-metric">
			<Icon name="tabler:eye" class="visit-metric__icon" aria-hidden="true" />
			<p class="visit-metric__label">
				累计访问
			</p>
			<strong class="visit-metric__value" aria-live="polite">{{ display(totalCount) }}</strong>
		</div>
	</div>

	<p class="visit-hint">
		有访客打开页面时，统计会自动刷新。
	</p>
</BlogWidget>
</template>

<style lang="scss" scoped>
.visit-status {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	font-size: 0.8em;
	white-space: nowrap;

	&__dot {
		width: 0.45em;
		height: 0.45em;
		border-radius: 50%;
		background-color: var(--c-success);
		animation: visit-status-blink 2s ease-in-out infinite;

		@media (prefers-reduced-motion: reduce) {
			animation: none;
		}
	}

	&.loading &__dot {
		background-color: var(--c-text-3);
		animation: none;
	}

	&.offline &__dot {
		background-color: var(--c-error);
		animation: none;
	}
}

.visit-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.5rem;
}

.visit-metric {
	min-width: 0;
	padding: 0.5rem 0.6rem;
	border-radius: 0.6rem;
	background-color: var(--c-bg-soft);

	&--daily {
		background: linear-gradient(135deg, var(--c-primary-soft), transparent 85%);
	}

	&__icon {
		font-size: 1.05em;
		color: var(--c-primary);
	}

	&__label {
		margin: 0.15rem 0 0;
		font-size: 0.78em;
		color: var(--c-text-2);
	}

	&__value {
		display: block;
		margin-top: 0.05rem;
		font-size: 1.35em;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
		color: var(--c-text-1);
	}
}

.visit-hint {
	margin: 0.5rem 0 0;
	font-size: 0.75em;
	line-height: 1.4;
	color: var(--c-text-3);
}

@keyframes visit-status-blink {
	50% {
		opacity: 0.35;
	}
}
</style>
