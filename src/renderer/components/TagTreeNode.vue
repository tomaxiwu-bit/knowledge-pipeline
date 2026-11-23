<script setup lang="ts">
// 标签树递归节点组件
// 用于在 TagFilter 中渲染层级标签树

import type { TagNode } from '@/renderer/stores/tags'

const props = defineProps<{
  node: TagNode
  selectedTags: string[]
  depth?: number
}>()

const emit = defineEmits<{
  toggle: [tag: string]
}>()

const isSelected = (tag: string) => props.selectedTags.includes(tag)
const depth = props.depth ?? 0
</script>

<template>
  <div class="tree-node">
    <button
      class="tree-tag-btn"
      :class="{ selected: isSelected(node.name) }"
      :style="{ paddingLeft: `${12 + depth * 16}px` }"
      @click="emit('toggle', node.name)"
    >
      <span class="tree-tag-icon">{{ node.children.length > 0 ? '▸' : '#' }}</span>
      <span class="tree-tag-name">{{ node.shortName }}</span>
      <span class="tree-tag-count">{{ node.count }}</span>
    </button>
    <div v-if="node.children.length > 0" class="tree-children">
      <TagTreeNode
        v-for="child in node.children"
        :key="child.name"
        :node="child"
        :selected-tags="selectedTags"
        :depth="depth + 1"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'TagTreeNode'
}
</script>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
}

.tree-tag-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius-sm);
  transition: background 0.1s;
}

.tree-tag-btn:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.tree-tag-btn.selected {
  background: var(--accent-soft);
  color: var(--accent);
}

.tree-tag-icon {
  font-size: 13px;
  width: 16px;
}

.tree-tag-name {
  flex: 1;
}

.tree-tag-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-surface-hover);
  padding: 1px 6px;
  border-radius: 999px;
}

.tree-children {
  display: flex;
  flex-direction: column;
}
</style>
