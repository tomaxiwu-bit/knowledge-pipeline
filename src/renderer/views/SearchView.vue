<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/renderer/stores/search'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useTagStore } from '@/renderer/stores/tags'
import { useSavedSearchStore } from '@/renderer/stores/savedSearches'
import TagFilter from '@/renderer/components/TagFilter.vue'
import AppIcon from '@/renderer/components/AppIcon.vue'

const searchStore = useSearchStore()
const settingsStore = useSettingsStore()
const tagStore = useTagStore()
const savedSearchStore = useSavedSearchStore()
const router = useRouter()

const showSaveDialog = ref(false)
const newSearchName = ref('')

const typeLabel: Record<string, string> = {
  rss: 'RSS',
  bookmark: '收藏',
  memo: '笔记'
}

function openResult(result: { type: string; id: string }) {
  if (result.type === 'rss') router.push(`/reader/rss/${encodeURIComponent(result.id)}`)
  else if (result.type === 'bookmark') router.push(`/reader/bookmark/${encodeURIComponent(result.id)}`)
  else if (result.type === 'memo') router.push('/')
}

const hasAnySource = computed(() => {
  return settingsStore.services.some((s) => s.kind !== 'ai')
})

// 根据选中的标签过滤搜索结果
const filteredResults = computed(() => {
  if (tagStore.selectedTags.length === 0) return searchStore.results
  const selectedIds = tagStore.getItemIdsBySelectedTags()
  return searchStore.results.filter((r) => selectedIds.has(r.id))
})

// 是否可以保存当前搜索
const canSaveSearch = computed(() => {
  return searchStore.query.trim().length > 0 || tagStore.selectedTags.length > 0
})

// 监听标签选择变化
watch(() => tagStore.selectedTags, () => {
  // 标签变化时不需要重新搜索，只需过滤已有结果
}, { deep: true })

/** 保存当前搜索 */
async function saveCurrentSearch() {
  if (!canSaveSearch.value) return
  const name = newSearchName.value.trim() || generateDefaultName()
  await savedSearchStore.addSearch({
    name,
    query: searchStore.query,
    tags: [...tagStore.selectedTags]
  })
  newSearchName.value = ''
  showSaveDialog.value = false
}

/** 生成默认名称 */
function generateDefaultName(): string {
  const parts: string[] = []
  if (searchStore.query.trim()) parts.push(`"${searchStore.query.trim()}"`)
  if (tagStore.selectedTags.length > 0) parts.push(`#${tagStore.selectedTags.join(' #')}`)
  return parts.join(' + ') || '未命名搜索'
}

/** 执行保存的搜索 */
async function executeSavedSearch(id: string) {
  const search = savedSearchStore.searches.find((s) => s.id === id)
  if (!search) return
  // 恢复搜索条件
  searchStore.query = search.query
  tagStore.clearSelection()
  for (const tag of search.tags) {
    tagStore.toggleTag(tag)
  }
  // 执行搜索
  await searchStore.search()
  await savedSearchStore.markExecuted(id)
  savedSearchStore.setActive(id)
}

/** 删除保存的搜索 */
async function deleteSavedSearch(id: string, event: Event) {
  event.stopPropagation()
  await savedSearchStore.removeSearch(id)
}

/** 处理命令面板的保存搜索事件 */
function handleSaveSearchEvent() {
  if (canSaveSearch.value) {
    showSaveDialog.value = true
  }
}

onMounted(async () => {
  await settingsStore.load()
  await tagStore.loadAllTags()
  await savedSearchStore.load()
  window.addEventListener('kp:save-search', handleSaveSearchEvent)
})

onUnmounted(() => {
  window.removeEventListener('kp:save-search', handleSaveSearchEvent)
})
</script>

<template>
  <div class="search-view">
    <div class="search-layout">
      <!-- 左侧：标签过滤 + 保存的搜索 -->
      <aside class="search-sidebar">
        <TagFilter />

        <!-- 保存的搜索列表 -->
        <div class="saved-searches-section">
          <div class="saved-header">
            <h4 class="saved-title">智能集合</h4>
            <span class="saved-count" v-if="savedSearchStore.searchCount > 0">
              {{ savedSearchStore.searchCount }}
            </span>
          </div>
          <div class="saved-list" v-if="savedSearchStore.searches.length > 0">
            <div
              v-for="search in savedSearchStore.searches"
              :key="search.id"
              class="saved-item"
              :class="{ active: savedSearchStore.activeSearchId === search.id }"
              @click="executeSavedSearch(search.id)"
            >
              <div class="saved-item-content">
                <span class="saved-item-name">{{ search.name }}</span>
                <div class="saved-item-meta">
                  <span v-if="search.query" class="saved-item-query">{{ search.query }}</span>
                  <span v-if="search.tags.length > 0" class="saved-item-tags">
                    {{ search.tags.map(t => '#' + t).join(' ') }}
                  </span>
                </div>
              </div>
              <button
                class="saved-item-delete"
                @click="deleteSavedSearch(search.id, $event)"
                title="删除"
              >×</button>
            </div>
          </div>
          <div v-else class="saved-empty">
            <p>保存常用搜索条件，一键重复执行</p>
          </div>
        </div>
      </aside>

      <!-- 右侧：搜索 + 结果 -->
      <div class="search-container">
        <div class="search-header">
          <h1>全局搜索</h1>
          <p class="search-desc">同时搜索 RSS 文章、链接收藏、速记笔记三个来源</p>
        </div>

        <div class="search-box">
          <input
            v-model="searchStore.query"
            type="text"
            placeholder="输入关键词，回车搜索..."
            class="search-input"
            @keydown.enter="searchStore.search()"
            autofocus
          />
          <button class="btn btn-primary" @click="searchStore.search()" :disabled="searchStore.loading || !searchStore.query.trim()">
            {{ searchStore.loading ? '搜索中...' : '搜索' }}
          </button>
          <button v-if="searchStore.searched" class="btn btn-secondary" @click="searchStore.clear">
            清除
          </button>
          <button
            v-if="canSaveSearch"
            class="btn btn-secondary"
            @click="showSaveDialog = true"
            title="保存当前搜索条件"
          >
            保存
          </button>
        </div>

        <div v-if="tagStore.selectedTags.length > 0" class="active-tags-bar">
          <span class="active-tags-label">按标签过滤：</span>
          <span v-for="tag in tagStore.selectedTags" :key="tag" class="active-tag">
            {{ tag }}
            <button class="tag-remove" @click="tagStore.toggleTag(tag)">×</button>
          </span>
        </div>

        <!-- 当前激活的智能集合提示 -->
        <div v-if="savedSearchStore.activeSearch" class="active-smart-collection">
          <span class="smart-badge">智能集合</span>
          <span class="smart-name">{{ savedSearchStore.activeSearch.name }}</span>
          <button class="smart-clear" @click="savedSearchStore.setActive(null)">×</button>
        </div>

        <div v-if="!hasAnySource" class="empty-state">
          <AppIcon name="alert" :size="26" class="empty-state-icon" />
          <p>尚未配置任何数据源，请先去设置页配置</p>
          <button class="btn btn-primary" style="margin-top: 12px" @click="router.push('/settings')">
            去配置
          </button>
        </div>

        <div v-else-if="searchStore.searched && !searchStore.loading && filteredResults.length === 0" class="empty-state">
          <AppIcon name="search" :size="26" class="empty-state-icon" />
          <p v-if="tagStore.selectedTags.length > 0">
            未找到匹配 "{{ searchStore.query }}" 且带选中标签的结果
          </p>
          <p v-else>未找到匹配 "{{ searchStore.query }}" 的结果</p>
        </div>

        <div v-else-if="filteredResults.length > 0" class="results-list">
          <div class="results-meta">
            共找到 {{ filteredResults.length }} 条结果
            <span v-if="tagStore.selectedTags.length > 0" class="filtered-hint">
              （已按标签过滤，共 {{ searchStore.results.length }} 条匹配）
            </span>
          </div>
          <div
            v-for="result in filteredResults"
            :key="result.type + result.id"
            class="result-item"
            @click="openResult(result)"
          >
            <div class="result-header">
              <span class="result-type" :class="result.type">{{ typeLabel[result.type] }}</span>
              <span class="result-date">{{ new Date(result.date).toLocaleDateString('zh-CN') }}</span>
            </div>
            <h3 class="result-title">{{ result.title }}</h3>
            <p class="result-snippet">{{ result.snippet }}</p>
            <a v-if="result.url" :href="result.url" target="_blank" class="result-url" @click.stop>
              {{ result.url }}
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存搜索对话框 -->
    <div v-if="showSaveDialog" class="save-modal" @click.self="showSaveDialog = false">
      <div class="save-card">
        <h3>保存为智能集合</h3>
        <div class="save-form">
          <label class="save-label">名称</label>
          <input
            v-model="newSearchName"
            type="text"
            :placeholder="generateDefaultName()"
            class="save-input"
            autofocus
            @keydown.enter="saveCurrentSearch"
          />
          <div class="save-preview">
            <div class="preview-row" v-if="searchStore.query">
              <span class="preview-label">关键词：</span>
              <span class="preview-value">{{ searchStore.query }}</span>
            </div>
            <div class="preview-row" v-if="tagStore.selectedTags.length > 0">
              <span class="preview-label">标签：</span>
              <span class="preview-value">{{ tagStore.selectedTags.map(t => '#' + t).join(' ') }}</span>
            </div>
          </div>
        </div>
        <div class="save-actions">
          <button class="btn btn-secondary" @click="showSaveDialog = false">取消</button>
          <button class="btn btn-primary" @click="saveCurrentSearch">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-view {
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.search-layout {
  display: flex;
  height: 100%;
}

.search-sidebar {
  width: 240px;
  min-width: 240px;
  border-right: 1px solid var(--border-color);
  padding: 20px 16px;
  overflow-y: auto;
}

.search-container {
  flex: 1;
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px;
  overflow-y: auto;
}

.search-header {
  margin-bottom: 24px;
}

.search-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.search-desc {
  color: var(--text-secondary);
  font-size: 14px;
}

.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 15px;
}

.search-input:focus {
  outline: none;
  border-color: var(--border-active);
}

.active-tags-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.active-tags-label {
  font-size: 12px;
  color: var(--text-muted);
}

.active-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 999px;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
}

.filtered-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.results-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.result-item:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-active);
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-type {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
}

.result-type.rss {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.result-type.bookmark {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}

.result-type.memo {
  background: var(--accent-soft);
  color: var(--accent);
}

.result-date {
  font-size: 12px;
  color: var(--text-muted);
}

.result-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  line-height: 1.4;
}

.result-snippet {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
}

.result-url {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  word-break: break-all;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 20px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

/* === 保存的搜索 / 智能集合 === */

.saved-searches-section {
  margin-top: 24px;
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.saved-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.saved-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.saved-count {
  font-size: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.saved-item:hover {
  background: var(--bg-surface-hover);
}

.saved-item.active {
  background: var(--accent-soft);
  border-left: 3px solid var(--accent);
}

.saved-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.saved-item-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.saved-item-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.saved-item-query {
  font-size: 11px;
  color: var(--text-muted);
}

.saved-item-tags {
  font-size: 11px;
  color: var(--accent);
}

.saved-item-delete {
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
  flex-shrink: 0;
}

.saved-item:hover .saved-item-delete {
  opacity: 1;
}

.saved-item-delete:hover {
  background: var(--danger);
  color: white;
}

.saved-empty {
  padding: 12px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  line-height: 1.5;
}

/* === 激活的智能集合提示 === */

.active-smart-collection {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--accent-soft);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.smart-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.smart-name {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
}

.smart-clear {
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.smart-clear:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

/* === 保存搜索对话框 === */

.save-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.save-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 440px;
  max-width: 90%;
  box-shadow: var(--shadow-lg);
}

.save-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.save-form {
  margin-bottom: 16px;
}

.save-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.save-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: 12px;
}

.save-input:focus {
  outline: none;
  border-color: var(--border-active);
}

.save-preview {
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.preview-row {
  display: flex;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 4px;
}

.preview-row:last-child {
  margin-bottom: 0;
}

.preview-label {
  color: var(--text-muted);
  flex-shrink: 0;
}

.preview-value {
  color: var(--text-secondary);
  word-break: break-all;
}

.save-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
