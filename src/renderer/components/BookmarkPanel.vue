<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import PanelLayout from '@/renderer/components/PanelLayout.vue'
import type { Bookmark, BookmarkClient } from '@/services/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const items = ref<Bookmark[]>([])
const loading = ref(false)
const error = ref('')
const cacheStatus = ref('')
const showReadLaterDialog = ref(false)
const readLaterUrl = ref('')
const readLaterTitle = ref('')
const readLaterDays = ref(7)

function getClient(): BookmarkClient | null {
  return settingsStore.getClientByKind('bookmark') as BookmarkClient | null
}

/** 过滤掉已过期的稍后读项 */
function filterExpired(list: Bookmark[]): Bookmark[] {
  const now = Date.now()
  return list.filter((b) => {
    if (!b.readLaterUntil) return true
    return new Date(b.readLaterUntil).getTime() > now
  })
}

async function loadItems() {
  const client = getClient()
  if (!client || !client.isConfigured()) {
    error.value = '未配置收藏服务，请前往设置页'
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const all = await client.getBookmarks(50)
    items.value = filterExpired(all)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openBookmark(item: Bookmark) {
  router.push(`/reader/bookmark/${encodeURIComponent(item.id)}`)
}

async function quickSaveFromClipboard() {
  const client = getClient()
  if (!client) return
  try {
    const text = await navigator.clipboard.readText()
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      await client.createBookmark(text)
      await loadItems()
    }
  } catch {}
}

function openReadLaterDialog() {
  readLaterUrl.value = ''
  readLaterTitle.value = ''
  readLaterDays.value = 7
  showReadLaterDialog.value = true
}

async function saveReadLater() {
  const client = getClient()
  if (!client || !readLaterUrl.value.trim()) return
  const expires = new Date(Date.now() + readLaterDays.value * 86400000).toISOString()
  await client.createBookmark(readLaterUrl.value, readLaterTitle.value || undefined, {
    readLaterUntil: expires
  })
  showReadLaterDialog.value = false
  await loadItems()
}

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return '已过期'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}天后过期`
  if (hours > 0) return `${hours}小时后过期`
  return '即将过期'
}

function onServiceResponse(event: Event) {
  const detail = (event as CustomEvent<{ method?: string; source?: string; storedAt?: string }>).detail
  if (detail?.method !== 'getBookmarks') return
  cacheStatus.value = detail.source === 'cache' && detail.storedAt
    ? `离线缓存 · ${new Date(detail.storedAt).toLocaleString('zh-CN')}`
    : ''
}

const isEmpty = computed(() => items.value.length === 0 && !loading.value && !error.value)

onMounted(async () => {
  await settingsStore.load()
  window.addEventListener('kp:open-read-later', openReadLaterDialog)
  window.addEventListener('kp:service-response', onServiceResponse)
  await loadItems()
})

onUnmounted(() => {
  window.removeEventListener('kp:open-read-later', openReadLaterDialog)
  window.removeEventListener('kp:service-response', onServiceResponse)
})
</script>

<template>
  <PanelLayout
    title="链接收藏"
    icon="🔖"
    :loading="loading"
    :error="error"
    :empty="isEmpty"
    empty-icon="📭"
    empty-text="暂无收藏"
    @refresh="loadItems"
    @goto-settings="router.push('/settings')"
  >
    <template #actions>
      <button class="btn btn-secondary" @click="openReadLaterDialog" title="添加稍后读链接，支持过期时间">
        ⏰ 稍后读
      </button>
      <button class="btn btn-secondary" @click="quickSaveFromClipboard" title="从剪贴板添加链接">
        + 粘贴
      </button>
      <span v-if="cacheStatus" class="cache-status">{{ cacheStatus }}</span>
    </template>

    <div class="item-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="list-item"
        :class="{ 'read-later': item.readLaterUntil }"
        @click="openBookmark(item)"
      >
        <div class="item-row">
          <img v-if="item.coverImage" :src="item.coverImage" class="item-cover" alt="" />
          <div class="item-content">
            <div class="item-title-row">
              <h3 class="item-title">{{ item.title }}</h3>
              <span v-if="item.readLaterUntil" class="expiry-badge">{{ formatExpiry(item.readLaterUntil) }}</span>
            </div>
            <p v-if="item.description" class="item-desc">{{ item.description }}</p>
            <div class="item-tags">
              <span v-if="item.sourceType === 'rss'" class="source-tag">RSS</span>
              <span v-else class="source-tag external">外部</span>
              <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 稍后读对话框 -->
    <div v-if="showReadLaterDialog" class="rl-modal" @click.self="showReadLaterDialog = false">
      <div class="rl-card">
        <h3>⏰ 添加稍后读</h3>
        <div class="rl-form">
          <input v-model="readLaterUrl" type="url" placeholder="https:// 链接地址" class="rl-input" />
          <input v-model="readLaterTitle" type="text" placeholder="标题（可选）" class="rl-input" />
          <div class="rl-expiry">
            <span class="rl-label">过期时间：</span>
            <select v-model="readLaterDays" class="rl-select">
              <option :value="1">1 天后</option>
              <option :value="3">3 天后</option>
              <option :value="7">1 周后</option>
              <option :value="14">2 周后</option>
              <option :value="30">1 个月后</option>
            </select>
          </div>
        </div>
        <div class="rl-actions">
          <button class="btn btn-secondary" @click="showReadLaterDialog = false">取消</button>
          <button class="btn btn-primary" @click="saveReadLater" :disabled="!readLaterUrl.trim()">添加</button>
        </div>
      </div>
    </div>
  </PanelLayout>
</template>

<style scoped>
.item-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cache-status {
  font-size: 11px;
  color: var(--warning);
}

.list-item {
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.15s;
}

.list-item:hover {
  background: var(--bg-surface-hover);
}

.item-row {
  display: flex;
  gap: 12px;
}

.item-cover {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  line-height: 1.4;
}

.item-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
}
</style>
