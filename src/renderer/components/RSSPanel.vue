<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import PanelLayout from '@/renderer/components/PanelLayout.vue'
import type { RSSItem, RSSClient } from '@/services/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const items = ref<RSSItem[]>([])
const loading = ref(false)
const error = ref('')
const cacheStatus = ref('')

function getClient(): RSSClient | null {
  return settingsStore.getClientByKind('rss') as RSSClient | null
}

async function loadItems() {
  const client = getClient()
  if (!client || !client.isConfigured()) {
    error.value = '未配置 RSS 服务，请前往设置页'
    items.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    items.value = await client.getUnreadItems(50)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openItem(item: RSSItem) {
  router.push(`/reader/rss/${encodeURIComponent(item.id)}`)
}

function onServiceResponse(event: Event) {
  const detail = (event as CustomEvent<{ method?: string; source?: string; storedAt?: string }>).detail
  if (detail?.method !== 'getUnreadItems') return
  cacheStatus.value = detail.source === 'cache' && detail.storedAt
    ? `离线缓存 · ${new Date(detail.storedAt).toLocaleString('zh-CN')}`
    : ''
}

const isEmpty = computed(() => items.value.length === 0 && !loading.value && !error.value)

onMounted(async () => {
  await settingsStore.load()
  window.addEventListener('kp:service-response', onServiceResponse)
  await loadItems()
})

onUnmounted(() => {
  window.removeEventListener('kp:service-response', onServiceResponse)
})
</script>

<template>
  <PanelLayout
    title="RSS 订阅"
    icon="📰"
    :loading="loading"
    :error="error"
    :empty="isEmpty"
    empty-icon="📭"
    empty-text="暂无未读文章"
    @refresh="loadItems"
    @goto-settings="router.push('/settings')"
  >
    <template #actions>
      <span class="unread-count" v-if="items.length > 0">{{ items.length }} 篇未读</span>
      <span v-if="cacheStatus" class="cache-status">{{ cacheStatus }}</span>
    </template>

    <div class="item-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="list-item"
        @click="openItem(item)"
      >
        <div class="item-meta">
          <span v-if="item.feedTitle" class="item-source">{{ item.feedTitle }}</span>
          <span class="item-date">{{ new Date(item.publishedAt).toLocaleDateString('zh-CN') }}</span>
        </div>
        <h3 class="item-title">{{ item.title }}</h3>
        <p class="item-summary">{{ item.summary }}</p>
      </div>
    </div>
  </PanelLayout>
</template>

<style scoped>
.unread-count {
  font-size: 12px;
  color: var(--text-muted);
  margin-right: 4px;
}

.cache-status {
  font-size: 11px;
  color: var(--warning);
  margin-right: 4px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.item-source {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 6px;
  border-radius: 4px;
}

.item-date {
  font-size: 12px;
  color: var(--text-muted);
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  line-height: 1.4;
}

.item-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
