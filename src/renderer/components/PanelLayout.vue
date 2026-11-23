<script setup lang="ts">
import AppIcon from '@/renderer/components/AppIcon.vue'

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
</script>

<template>
  <div class="panel">
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
  background: var(--bg-primary);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 8px;
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
  color: var(--text-muted);
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
