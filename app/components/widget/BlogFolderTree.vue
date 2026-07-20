<script setup lang="ts">
interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  url?: string | null
  children?: TreeNode[]
}

interface FlatNode {
  node: TreeNode
  depth: number
}

const route = useRoute()
const isArticlePage = computed(() => route.path !== '/')

const { data: tree, pending, error } = await useFetch<TreeNode[]>('/api/folder-tree')

const expanded = ref<Set<string>>(new Set())

function toggle(path: string) {
  if (expanded.value.has(path)) {
    expanded.value.delete(path)
  } else {
    expanded.value.add(path)
  }
  expanded.value = new Set(expanded.value)
}

function isExpanded(path: string) {
  return expanded.value.has(path)
}

const flatList = computed<FlatNode[]>(() => {
  const result: FlatNode[] = []
  function walk(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      result.push({ node, depth })
      if (node.type === 'folder' && node.children?.length && isExpanded(node.path)) {
        walk(node.children, depth + 1)
      }
    }
  }
  if (tree.value) walk(tree.value, 0)
  return result
})

function countFiles(node: TreeNode): number {
  if (!node.children) return 0
  let count = 0
  for (const child of node.children) {
    if (child.type === 'file') count++
    else if (child.type === 'folder') count += countFiles(child)
  }
  return count
}
</script>

<template>
  <div class="folder-tree-widget">
    <!-- 文章页返回主页按钮 -->
    <NuxtLink v-if="isArticlePage" to="/" class="tree-back-home">
      <Icon name="tabler:arrow-left" />
      返回主页
    </NuxtLink>

    <h3 class="tree-title">
      <Icon name="tabler:folders" />
      知识库导航
    </h3>

    <div v-if="pending" class="tree-loading">
      <Icon name="tabler:loader-2" class="animate-spin" />
      加载目录结构…
    </div>

    <div v-else-if="error" class="tree-error">
      目录加载失败
    </div>

    <ul v-else class="tree-root">
      <li
        v-for="item in flatList"
        :key="item.node.path"
        class="tree-node"
        :style="{ '--depth': item.depth }"
      >
        <!-- 文件夹：可展开/折叠 -->
        <button
          v-if="item.node.type === 'folder'"
          class="tree-node-btn is-folder"
          :class="{ 'is-open': isExpanded(item.node.path) }"
          @click="toggle(item.node.path)"
        >
          <span class="tree-arrow">
            <Icon :name="isExpanded(item.node.path) ? 'tabler:chevron-down' : 'tabler:chevron-right'" class="arrow-icon" />
          </span>
          <span class="tree-icon">
            <Icon v-if="isExpanded(item.node.path)" name="tabler:folder-open" />
            <Icon v-else name="tabler:folder" />
          </span>
          <span class="tree-name">{{ item.node.name }}</span>
          <span v-if="item.node.children?.length" class="tree-count">{{ countFiles(item.node) }}</span>
        </button>

        <!-- 文件有链接：NuxtLink 跳转 -->
        <NuxtLink
          v-else-if="item.node.url"
          :to="item.node.url"
          class="tree-node-btn is-file"
        >
          <span class="tree-arrow file-dot" />
          <span class="tree-icon"><Icon name="tabler:file-text" /></span>
          <span class="tree-name">{{ item.node.name }}</span>
        </NuxtLink>

        <!-- 文件无链接：纯展示 -->
        <span v-else class="tree-node-btn is-file no-link">
          <span class="tree-arrow file-dot" />
          <span class="tree-icon"><Icon name="tabler:file-text" /></span>
          <span class="tree-name">{{ item.node.name }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style lang="scss" scoped>
.folder-tree-widget {
  margin: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 0.75rem;
  background-color: var(--ld-bg-card);
  box-shadow: var(--box-shadow-1);
  border: 1px solid var(--c-border);
}

.tree-back-home {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--c-primary);
  text-decoration: none;
  background: var(--c-primary-soft);
  transition: background-color 0.15s;

  &:hover {
    background: var(--c-bg-soft);
  }
}

.tree-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--c-text-1);
}

.tree-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 0;
  font-size: 0.85rem;
  color: var(--c-text-3);
  justify-content: center;
}

.tree-error {
  padding: 1rem 0;
  font-size: 0.85rem;
  color: var(--c-error);
  text-align: center;
}

.tree-root {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tree-node {
  list-style: none;
  user-select: none;
}

.tree-node-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.3rem 0.4rem;
  padding-left: calc(var(--depth, 0) * 1.2rem + 0.4rem);
  border-radius: 0.35rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.15s;
  color: var(--c-text-2);
  background: none;
  border: none;
  text-align: left;
  text-decoration: none;

  &:hover {
    background-color: var(--c-bg-soft);
  }

  &.is-file:hover {
    color: var(--c-primary);
  }

  &.is-open {
    color: var(--c-text-1);
  }

  &.no-link {
    opacity: 0.5;
    cursor: default;

    &:hover {
      color: var(--c-text-2);
      background-color: transparent;
    }
  }
}

.tree-arrow {
  flex-shrink: 0;
  width: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-3);

  .arrow-icon {
    font-size: 0.75rem;
    transition: transform 0.2s;
  }
}

.file-dot {
  visibility: hidden;
}

.tree-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 1rem;

  .is-file & {
    color: var(--c-text-3);
  }

  .is-folder & {
    color: var(--c-primary);
  }
}

.tree-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-count {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--c-text-3);
  background: var(--c-bg-soft);
  padding: 0.05rem 0.4rem;
  border-radius: 1em;
}
</style>
