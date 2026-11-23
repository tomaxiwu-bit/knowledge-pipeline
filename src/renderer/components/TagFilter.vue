<script setup lang="ts">
// 标签过滤器组件
// 借鉴 SiYuan 的标签系统：层级标签树展示，点击过滤，多选
// 可嵌入到搜索页、首页侧栏等位置

import { computed } from 'vue'
import { useTagStore } from '@/renderer/stores/tags'
import TagTreeNode from '@/renderer/components/TagTreeNode.vue'

const tagStore = useTagStore()

const props = defineProps<{
  compact?: boolean  // 紧凑模式：只展示平铺列表
}>()

const isSelected = (tag: string) => tagStore.selectedTags.includes(tag)

function toggle(tag: string) {
  tagStore.toggleTag(tag)
}

// 紧凑模式：只展示 Top 20 标签
const topTags = computed(() => {
  return tagStore.tagCounts.slice(0, 20)
})
</script>

<template>
  <div class="tag-filter" :class="{ compact }">
    <div class="tag-filter-header">
      <h3 class="filter-title">标签</h3>
      <button
        v-if="tagStore.selectedTags.length > 0"
        class="btn btn-secondary btn-sm"
        @click="tagStore.clearSelection()"
      >
        清除 ({{ tagStore.selectedTags.length }})
      </button>
    </div>

    <div v-if="tagStore.loading" class="filter-loading">加载中...</div>

    <div v-else-if="tagStore.tagCounts.length === 0" class="filter-empty">
      暂无标签
    </div>

    <!-- 紧凑模式：平铺标签云 -->
    <div v-else-if="compact" class="tag-cloud">
      <button
        v-for="item in topTags"
        :key="item.tag"
        class="tag-chip"
        :class="{ selected: isSelected(item.tag) }"
        @click="toggle(item.tag)"
        :title="`${item.tag} (${item.count})`"
      >
        {{ item.tag }}
        <span class="chip-count">{{ item.count }}</span>
      </button>
    </div>

    <!-- 完整模式：层级树 -->
    <div v-else class="tag-tree">
      <TagTreeNode
        v-for="node in tagStore.tagTree"
        :key="node.name"
        :node="node"
        :selected-tags="tagStore.selectedTags"
        @toggle="toggle"
      />
    </div>
  </div>
</template>

<style scoped>
.tag-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-sm {
  padding: 3px 8px;
  font-size: 11px;
}

.filter-loading,
.filter-empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 12px;
  text-align: center;
}

/* 标签云模式 */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.tag-chip:hover {
  border-color: var(--border-active);
  color: var(--text-primary);
}

.tag-chip.selected {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.chip-count {
  font-size: 10px;
  opacity: 0.7;
}

/* 树形模式 */
.tag-tree {
  display: flex;
  flex-direction: column;
}
</style>
