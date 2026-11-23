<script setup lang="ts">
import AppIcon from '@/renderer/components/AppIcon.vue'
import { useTilt } from '@/renderer/composables/useTilt'

defineProps<{
  title: string
  icon?: string
  loading?: boolean
  error?: string
  empty?: boolean
  emptyIcon?: string
  emptyText?: string
}>()

defineEmits<{
  (e: 'refresh'): void
  (e: 'goto-settings'): void
}>()

const { el: panelRef, style: tiltStyle, onMove, onLeave } = useTilt({ max: 1.6 })
</script>

<template>
  <div
    ref="panelRef"
    class="panel"
    :style="tiltStyle"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <div class="panel-header">
      <h2 class="panel-title">
        <AppIcon v-if="icon" :name="icon" :size="16" class="panel-icon" />
        {{ title }}
      </h2>
      <div class="panel-actions">
        <slot name="actions" />
        <button class="btn btn-ghost panel-refresh" @click="$emit('refresh')" :disabled="loading">
          <AppIcon name="refresh" :size="14" />
          {{ loading ? '加载中' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="$slots.toolbar" class="panel-toolbar">
      <slot name="toolbar" />
    </div>

    <div class="panel-body">
      <div v-if="error" class="empty-state">
        <AppIcon name="inbox" :size="26" class="empty-state-icon" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" style="margin-top: 12px" @click="$emit('goto-settings')">
          去配置
        </button>
      </div>

      <div v-else-if="empty && !loading" class="empty-state">
        <AppIcon :name="emptyIcon || 'inbox'" :size="26" class="empty-state-icon" />
        <p>{{ emptyText || '暂无内容' }}</p>
      </div>

      <slot v-else />
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* 半透明压在全局光斑上：三栏既有分隔，又能透出一点环境光 */
  background: var(--panel-veil);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 18px 40px -28px rgba(0, 0, 0, 0.9);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  color: var(--accent);
  opacity: 0.9;
  filter: drop-shadow(0 0 7px var(--accent-soft));
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-toolbar {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-surface);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
</style>
