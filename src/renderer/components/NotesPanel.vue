<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import PanelLayout from '@/renderer/components/PanelLayout.vue'
import type { Memo, MemoClient } from '@/services/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const items = ref<Memo[]>([])
const loading = ref(false)
const error = ref('')
const cacheStatus = ref('')
const newMemoContent = ref('')
const showInput = ref(false)

function getClient(): MemoClient | null {
  return settingsStore.getClientByKind('memo') as MemoClient | null
}

function onNewMemo() {
  showInput.value = true
  setTimeout(() => {
    const ta = document.querySelector('.memo-input') as HTMLTextAreaElement | null
    ta?.focus()
  }, 50)
}

async function loadItems() {
  const client = getClient()
  if (!client || !client.isConfigured()) {
    error.value = '未配置笔记服务，请前往设置页'
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    items.value = await client.getMemos(50)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function createMemo() {
  if (!newMemoContent.value.trim()) return
  const client = getClient()
  if (!client) return
  const memo = await client.createMemo(newMemoContent.value)
  if (memo) {
    items.value.unshift(memo)
    newMemoContent.value = ''
    showInput.value = false
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

function onServiceResponse(event: Event) {
  const detail = (event as CustomEvent<{ method?: string; source?: string; storedAt?: string }>).detail
  if (detail?.method !== 'getMemos') return
  cacheStatus.value = detail.source === 'cache' && detail.storedAt
    ? `离线缓存 · ${new Date(detail.storedAt).toLocaleString('zh-CN')}`
    : ''
}

const isEmpty = computed(() => items.value.length === 0 && !loading.value && !error.value)

onMounted(async () => {
  await settingsStore.load()
  window.addEventListener('kp:new-memo', onNewMemo)
  window.addEventListener('kp:service-response', onServiceResponse)
  await loadItems()
})

onUnmounted(() => {
  window.removeEventListener('kp:new-memo', onNewMemo)
  window.removeEventListener('kp:service-response', onServiceResponse)
})
</script>

<template>
  <PanelLayout
    title="速记笔记"
    type="note"
    :loading="loading"
    :error="error"
    :empty="isEmpty"
    empty-icon="inbox"
    empty-text="还没有笔记，开始记录第一条吧"
    @refresh="loadItems"
    @goto-settings="router.push('/settings')"
  >
    <template #actions>
      <button class="btn btn-primary" @click="showInput = !showInput">
        {{ showInput ? '取消' : '新笔记' }}
      </button>
      <span v-if="cacheStatus" class="cache-status">{{ cacheStatus }}</span>
    </template>

    <template #toolbar v-if="showInput">
      <div class="memo-input-area">
        <textarea
          v-model="newMemoContent"
          class="memo-input"
          placeholder="记点什么... 支持 #标签"
          rows="3"
          @keydown.ctrl.enter="createMemo"
        ></textarea>
        <button class="btn btn-primary" @click="createMemo" :disabled="!newMemoContent.trim()">
          保存
        </button>
      </div>
    </template>

    <div class="memo-list">
      <div v-for="memo in items" :key="memo.id" class="memo-card">
        <div class="memo-content">{{ memo.content }}</div>
        <div class="memo-footer">
          <span class="memo-date">{{ formatDate(memo.createdAt) }}</span>
          <div class="memo-tags">
            <span v-for="tag in memo.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>
  </PanelLayout>
</template>

<style scoped>
.memo-input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cache-status {
  font-size: 11px;
  color: var(--warning);
}

.memo-input {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px;
  color: var(--text-primary);
  resize: vertical;
}

.memo-input:focus {
  outline: none;
  border-color: var(--border-active);
}

.memo-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.memo-card {
  background: transparent;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  transition: background 0.15s;
}

.memo-card:hover {
  background: var(--bg-surface-hover);
}

.memo-content {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.memo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 7px;
}

.memo-date {
  font-size: 11px;
  color: var(--text-muted);
}

.memo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
