<script setup lang="tsx">
import type { TippyComponent } from 'vue-tippy'

interface WindowWithGiscus extends Window {
	giscus?: any
}

const appConfig = useAppConfig()

const commentEl = useTemplateRef('comment')
const popoverEl = useTemplateRef<TippyComponent>('popover')
const popoverJumpTo = ref('')
const popoverInputEl = useTemplateRef('popover-input')
const showUndo = ref(false)

const giscusContainer = ref<HTMLDivElement>()
const giscusLang = appConfig.language.replace('-', '_')

const popoverBind = ref<TippyComponent['$props']>({})

/** 评论区链接守卫 */
useEventListener(commentEl, 'click', (e) => {
	if (!(e.target instanceof Element))
		return

	if (e.target.matches('.tk-avatar-img'))
		e.stopPropagation()

	const popoverTarget = e.target.closest('a[target="_blank"]')
	if (!(popoverTarget instanceof HTMLAnchorElement))
		return

	e.preventDefault()
	popoverEl.value?.hide()

	popoverJumpTo.value = safelyDecodeUriComponent(popoverTarget.href)
	popoverBind.value = {
		getReferenceClientRect: () => popoverTarget.getBoundingClientRect(),
		triggerTarget: popoverTarget,
	}

	nextTick(checkUndoable)
	popoverEl.value?.show()
}, { capture: true })

function checkUndoable() {
	showUndo.value = popoverInputEl.value?.textContent !== popoverJumpTo.value
}

function undo() {
	if (!popoverInputEl.value)
		return
	popoverInputEl.value.textContent = popoverJumpTo.value
	checkUndoable()
}

function confirmOpen() {
	window.open(popoverInputEl.value?.textContent, '_blank')
}

const giscusLoaded = ref(false)
useEventListener(window, 'message', (event: MessageEvent) => {
	if (event.origin === 'https://giscus.app' && event.data) {
		try {
			const data = JSON.parse(event.data)
			if (data?.giscus) {
				giscusLoaded.value = true
			}
		} catch {}
	}
})

// Giscus 评论区：onMounted 中动态加载，避免 SSR/水合导致重复注入
// 配置数据来自 https://giscus.app/zh-CN
const GISCUS_CONFIG = {
	src: 'https://giscus.app/client.js',
	'data-repo': 'zjz0211/blog-v3',
	'data-repo-id': 'R_kgDOTdK1IA',
	'data-category': 'Announcements',
	'data-category-id': 'DIC_kwDOTdK1IM4DBhFP',
	'data-mapping': 'pathname',
	'data-strict': '0',
	'data-reactions-enabled': '1',
	'data-emit-metadata': '0',
	'data-input-position': 'top',
	'data-theme': 'preferred_color_scheme',
	'data-lang': 'zh-CN',
	crossOrigin: 'anonymous',
} as const

onMounted(() => {
	// 动态创建 script 标签，确保只加载一次且能找到 .giscus 容器
	if (document.querySelector('script[src="https://giscus.app/client.js"]')) return
	const script = document.createElement('script')
	script.src = GISCUS_CONFIG.src
	Object.entries(GISCUS_CONFIG).forEach(([key, val]) => {
		if (key !== 'src') script.setAttribute(key, String(val))
	})
	script.async = true
	document.head.appendChild(script)
})
</script>

<template>
<section ref="comment" class="z-comment">
	<h3 class="text-creative">
		评论区
	</h3>

	<!-- interactive 默认会把气泡移动到 triggerTarget 的父元素上 -->
	<Tooltip
		ref="popover"
		v-bind="popoverBind"
		:append-to="() => commentEl!"
		interactive
		:aria="{ expanded: false }"
		trigger="focusin"
	>
		<template #content>
			<div class="popover-confirm">
				<span
					ref="popover-input"
					class="input"
					contenteditable="plaintext-only"
					spellcheck="false"
					@input="checkUndoable"
					@keydown.enter.prevent="confirmOpen"
					v-text="popoverJumpTo"
				/>

				<button
					v-if="showUndo"
					aria-label="恢复原始内容"
					@click="undo()"
				>
					<Icon name="tabler:arrow-back-up" />
				</button>

				<ZButton
					primary
					text="访问"
					@click="confirmOpen"
				/>
			</div>
		</template>
	</Tooltip>

	<div class="giscus" ref="giscusContainer" />
	<p v-if="!giscusLoaded" class="giscus-loading">评论加载中...</p>
</section>
</template>

<style lang="scss" scoped>
.z-comment {
	margin: 3rem 1rem;

	> h3 {
		margin-top: 3rem;
		font-size: 1.25rem;
	}
}

:deep() > [data-tippy-root] > .tippy-box {
	padding: 0;
}

.popover-confirm {
	display: flex;
	align-items: center;
	overflow-wrap: anywhere;

	> .input {
		min-width: 0;
		padding: 0.3em 0.6em;
		outline: none;
	}

	> button {
		flex-shrink: 0;
		align-self: stretch;
		padding: 0.3em;
		border-radius: 0 0.5em 0.5em 0;
	}
}

:deep(#twikoo) {
	margin: 2em 0;

	.tk-admin-container {
		position: fixed;
		z-index: calc(var(--z-index-popover) + 1);
	}

	.tk-input {
		font-family: var(--font-monospace);
	}

	.tk-avatar {
		border-radius: 50%;

		@supports (corner-shape: squircle) {
			corner-shape: superellipse(1.2);
		}

		&.tk-clickable {
			cursor: auto;
		}
	}

	.tk-time {
		color: var(--c-text-3);
	}

	.tk-content {
		margin-top: 0;
	}

	.tk-comments-title, .tk-nick {
		font-family: var(--font-creative);
	}

	.tk-owo-emotion {
		width: auto;
		height: 1.4em;
		vertical-align: text-bottom;
	}

	.tk-extras, .tk-footer {
		font-size: 0.7em;
		color: var(--c-text-3);
	}

	.tk-replies:not(.tk-replies-expand) {
		mask-image: linear-gradient(to top, transparent, #FFF 4em);
	}

	.tk-expand {
		border-radius: 0.5em;
		transition: background-color 0.1s;
	}

	.tippy-svg-arrow > svg {
		fill: inherit;
		width: auto;
		height: auto;
	}
}

:deep(:where(.tk-preview-container,.tk-content)) {
	pre {
		overflow: auto;
		border-radius: 0.5em;
		font-size: 0.85em;
	}

	a {
		margin: -0.1em -0.2em;
		padding: 0.1em 0.2em;
		background: linear-gradient(var(--c-primary-soft), var(--c-primary-soft)) no-repeat center bottom / 100% 0.1em;
		color: var(--c-primary);
		transition: all 0.2s;

		&:hover {
			border-radius: 0.3em;
			background-size: 100% 100%;
		}
	}

	p {
		margin: 0.2em 0;
	}

	img {
		border-radius: 0.5em;
	}

	menu, ol, ul {
		margin: 0.5em 0;
		padding-inline-start: 1.5em;
		font-size: 0.9rem;
		list-style: revert;

		> li {
			margin: 0.2em 0;

			&::marker {
				color: var(--c-primary);
			}
		}
	}

	blockquote {
		margin: 0.5em 0;
		padding: 0.2em 0.5em;
		border-inline-start: 4px solid var(--c-border);
		border-radius: 4px;
		background-color: var(--c-bg-2);
		font-size: 0.9em;
	}
}
</style>
