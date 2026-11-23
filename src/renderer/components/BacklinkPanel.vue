<script setup lang="ts">
// 反向链接面板
// 借鉴 Trilium 的 Link Map 侧边栏 + Obsidian 的 backlinks 面板
// 显示当前条目被哪些其他条目引用

import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRelationStore } from '@/renderer/stores/relations'
import type { ItemType } from '@/renderer/stores/relations'

const props = defineProps<{
  itemId: string
  itemType: ItemType
}>()

const router = useRouter()
const relationStore = useRelationStore()

const backlinks = computed(() => relationStore.getBacklinks(props.itemId))
const forwardLinks = computed(() => relationStore.getForwardLinks(props.itemId))

const typeIcon: Record<ItemType, string> = {
  'rss': 'R',
  'bookmark': 'B',
  'memo': 'M',
  'note': 'D',
  'ai-summary': 'AI'
}

function navigateTo(type: ItemType, id: string) {
  if (type === 'rss' || type === 'bookmark') {
    router.push(`/reader/${type}/${encodeURIComponent(id)}`)
  }
  // memo/note/ai-summary 目前没有独立阅读页，留在当前页
}

function removeRelation(id: string) {
  relationStore.removeRelation(id)
}
</script>

<template>
  <div class="backlink-panel">
    <!-- 反向链接 -->
    <div class="link-section" v-if="backlinks.length > 0">
      <h4 class="section-title">
        
        反向链接 ({{ backlinks.length }})
      </h4>
      <div class="link-list">
        <div
          v-for="bl in backlinks"
          :key="bl.relation.id"
          class="link-item"
          @click="navigateTo(bl.fromType, bl.fromId)"
        >
          <span class="link-icon">{{ typeIcon[bl.fromType] }}</span>
          <div class="link-content">
            <span class="link-title">{{ bl.fromTitle }}</span>
            <span class="link-kind">{{ bl.inverseLabel }}</span>
          </div>
          <button
            class="link-remove"
            @click.stop="removeRelation(bl.relation.id)"
            title="移除此链接"
          >×</button>
        </div>
      </div>
    </div>

    <!-- 正向链接 -->
    <div class="link-section" v-if="forwardLinks.length > 0">
      <h4 class="section-title">
        
        正向链接 ({{ forwardLinks.length }})
      </h4>
      <div class="link-list">
        <div
          v-for="fl in forwardLinks"
          :key="fl.id"
          class="link-item"
          @click="navigateTo(fl.targetType, fl.targetId)"
        >
          <span class="link-icon">{{ typeIcon[fl.targetType] }}</span>
          <div class="link-content">
            <span class="link-title">{{ fl.targetTitle }}</span>
            <span class="link-kind">{{ relationStore.getKindLabel(fl.kind) }}</span>
          </div>
          <button
            class="link-remove"
            @click.stop="removeRelation(fl.id)"
            title="移除此链接"
          >×</button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="backlinks.length === 0 && forwardLinks.length === 0" class="empty-links">
      <span class="empty-icon">R</span>
      <p>暂无关联链接</p>
      <p class="empty-hint">保存笔记、收藏、生成摘要时会自动建立关联</p>
    </div>
  </div>
</template>

<style scoped>
.backlink-panel {
  padding: 12px;
}

.link-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-icon {
  font-size: 13px;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.link-item:hover {
  background: var(--bg-surface-hover);
}

.link-icon {
  width: 15px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
}

.link-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-kind {
  font-size: 11px;
  color: var(--text-muted);
}

.link-remove {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.link-item:hover .link-remove {
  opacity: 1;
}

.link-remove:hover {
  background: var(--danger);
  color: white;
}

.empty-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 12px;
  color: var(--text-muted);
  text-align: center;
}

.empty-icon {
  font-size: 28px;
  opacity: 0.4;
  margin-bottom: 8px;
}

.empty-links p {
  font-size: 13px;
}

.empty-hint {
  font-size: 11px !important;
  margin-top: 4px;
  opacity: 0.7;
}
</style>
