<script setup lang="ts">
// 全局命令面板
// 借鉴 AppFlowy 的命令面板：Ctrl+K 唤起，统一入口包含导航命令 + 内容搜索
// 上半部分显示匹配的命令，下半部分显示内容搜索结果（RSS/收藏/笔记）

import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCommandRegistry, type Command } from '@/renderer/composables/useCommandRegistry'
import { useSearchStore } from '@/renderer/stores/search'
import AppIcon from '@/renderer/components/AppIcon.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const { searchCommands } = useCommandRegistry()
const searchStore = useSearchStore()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const mode = ref<'commands' | 'results'>('commands')

// 命令列表
const filteredCommands = computed(() => {
  return searchCommands(query.value)
})

// 搜索结果
const searchResults = computed(() => searchStore.results)

// 合并列表：命令 + 搜索结果
const displayList = computed(() => {
  const items: Array<{ type: 'command'; data: Command } | { type: 'result'; data: typeof searchResults.value[0] }> = []
  if (filteredCommands.value.length > 0) {
    filteredCommands.value.forEach((cmd) => items.push({ type: 'command', data: cmd }))
  }
  if (searchResults.value.length > 0) {
    searchResults.value.forEach((r) => items.push({ type: 'result', data: r }))
  }
  return items
})

const categoryLabel: Record<Command['category'], string> = {
  navigate: '导航',
  create: '创建',
  action: '操作',
  settings: '设置'
}

const typeLabel: Record<string, string> = {
  rss: 'RSS',
  bookmark: '收藏',
  memo: '笔记'
}

const typeIcon: Record<string, string> = {
  rss: 'rss',
  bookmark: 'bookmark',
  memo: 'note'
}

// 监听查询变化
let searchTimer: number | null = null
watch(query, (val) => {
  selectedIndex.value = 0
  // 当查询词长度 >= 2 时触发内容搜索
  if (val.trim().length >= 2) {
    mode.value = 'results'
    if (searchTimer) window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      searchStore.query = val
      searchStore.search()
    }, 300)
  } else {
    mode.value = 'commands'
    searchStore.clear()
  }
})

// 面板打开时聚焦输入框
watch(() => props.visible, async (val) => {
  if (val) {
    query.value = ''
    selectedIndex.value = 0
    mode.value = 'commands'
    searchStore.clear()
    await nextTick()
    inputRef.value?.focus()
  }
})

function selectItem(index: number) {
  const item = displayList.value[index]
  if (!item) return
  if (item.type === 'command') {
    item.data.handler()
  } else {
    const r = item.data
    if (r.type === 'rss') router.push(`/reader/rss/${encodeURIComponent(r.id)}`)
    else if (r.type === 'bookmark') router.push(`/reader/bookmark/${encodeURIComponent(r.id)}`)
    else if (r.type === 'memo') router.push('/')
  }
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (!props.visible) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, displayList.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    selectItem(selectedIndex.value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <transition name="palette-fade">
    <div v-if="visible" class="palette-overlay" @click.self="emit('close')">
      <div class="palette-panel">
        <div class="palette-input-wrap">
          <span class="palette-icon">⌘</span>
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            placeholder="搜索命令或内容... (↑↓ 选择，回车执行)"
            class="palette-input"
          />
          <kbd class="palette-esc">ESC</kbd>
        </div>

        <div class="palette-list" v-if="displayList.length > 0">
          <!-- 命令分组 -->
          <template v-for="(item, idx) in displayList" :key="idx">
            <div v-if="item.type === 'command' && (idx === 0 || displayList[idx - 1]?.type !== 'command')"
                 class="palette-group-label">
              命令
            </div>
            <div v-if="item.type === 'result' && (idx === 0 || displayList[idx - 1]?.type !== 'result')"
                 class="palette-group-label">
              内容搜索结果
            </div>
            <button
              class="palette-item"
              :class="{ selected: idx === selectedIndex, 'is-command': item.type === 'command' }"
              @click="selectItem(idx)"
              @mouseenter="selectedIndex = idx"
            >
              <template v-if="item.type === 'command'">
                <span class="item-icon"><AppIcon :name="item.data.icon ?? 'dot'" :size="15" /></span>
                <div class="item-body">
                  <span class="item-title">{{ item.data.title }}</span>
                  <span v-if="item.data.description" class="item-desc">{{ item.data.description }}</span>
                </div>
                <span class="item-category">{{ categoryLabel[item.data.category] }}</span>
                <kbd v-if="item.data.shortcut" class="item-shortcut">{{ item.data.shortcut }}</kbd>
              </template>
              <template v-else>
                <span class="item-icon"><AppIcon :name="typeIcon[item.data.type] ?? 'file'" :size="15" /></span>
                <div class="item-body">
                  <span class="item-title">{{ item.data.title }}</span>
                  <span class="item-desc">{{ item.data.snippet }}</span>
                </div>
                <span class="item-category">{{ typeLabel[item.data.type] }}</span>
              </template>
            </button>
          </template>
        </div>

        <div v-else class="palette-empty">
          <AppIcon name="search" :size="26" class="empty-icon" />
          <p v-if="query.trim().length >= 2 && searchStore.loading">搜索中...</p>
          <p v-else-if="query.trim().length >= 2">未找到匹配 "{{ query }}" 的内容</p>
          <p v-else>输入命令名或关键词开始</p>
        </div>

        <div class="palette-footer">
          <span class="footer-hint"><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
          <span class="footer-hint"><kbd>↵</kbd> 执行</span>
          <span class="footer-hint"><kbd>ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.palette-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(60% 50% at 50% 0%, var(--mesh-a), transparent 70%),
    rgba(6, 8, 12, 0.62);
  backdrop-filter: blur(10px) saturate(1.1);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  z-index: 200;
  animation: kp-fade-in 0.2s ease both;
}

.palette-panel {
  width: 620px;
  max-width: 90%;
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow:
    0 32px 80px -32px rgba(0, 0, 0, 0.85),
    0 0 40px -18px var(--accent),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  animation: kp-pop 0.32s var(--ease-out-expo) both;
}

.palette-input-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.palette-icon {
  font-size: 18px;
  color: var(--text-muted);
}

.palette-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 16px;
}

.palette-input::placeholder {
  color: var(--text-muted);
}

.palette-esc {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--bg-surface-hover);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}

.palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.palette-group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px 4px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.palette-item.selected {
  background: var(--accent-soft);
}

.palette-item.is-command.selected {
  background: var(--accent-soft);
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.palette-item.selected .item-icon {
  color: var(--accent);
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.item-title {
  font-size: 13.5px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-desc {
  font-size: 11.5px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-category {
  font-size: 10.5px;
  padding: 1px 7px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  flex-shrink: 0;
}

.item-shortcut {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--bg-surface-hover);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  flex-shrink: 0;
}

.palette-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
}

.empty-icon {
  display: block;
  margin: 0 auto 8px;
}

.palette-footer {
  display: flex;
  gap: 16px;
  padding: 10px 20px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-muted);
}

.footer-hint {
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-hint kbd {
  padding: 1px 5px;
  background: var(--bg-surface-hover);
  border-radius: 3px;
  font-size: 10px;
}

.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity 0.15s;
}

.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
}
</style>
