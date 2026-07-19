<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useCommandRegistry } from '@/renderer/composables/useCommandRegistry'

const router = useRouter()
const settingsStore = useSettingsStore()
const { openPalette } = useCommandRegistry()

const navItems = [
  { name: 'home', label: '流水线', icon: '🏠', path: '/' },
  { name: 'daily', label: '每日笔记', icon: '📅', path: '/daily' },
  { name: 'search', label: '搜索', icon: '🔍', path: '/search' },
  { name: 'inquiry', label: '探究线', icon: '🧭', path: '/inquiry' },
  { name: 'graph', label: '知识图谱', icon: '🕸️', path: '/graph' },
  { name: 'editor', label: '写作', icon: '✏️', path: '/editor' },
  { name: 'settings', label: '设置', icon: '⚙️', path: '/settings' }
]
</script>

<template>
  <nav class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-logo">📚</span>
      <span class="sidebar-title">知识流水线</span>
    </div>

    <div class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ active: $route.name === item.name }"
        @click="router.push(item.path)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>

    <button class="palette-btn" @click="openPalette" title="打开命令面板 (Ctrl+K)">
      <span class="palette-btn-icon">⌘</span>
      <span class="palette-btn-text">命令面板</span>
      <kbd class="palette-btn-kbd">Ctrl+K</kbd>
    </button>

    <div class="sidebar-footer">
      <button
        class="theme-toggle"
        @click="settingsStore.toggleTheme"
        :title="settingsStore.theme === 'dark' ? '切换到亮色' : '切换到暗色'"
      >
        <span class="theme-icon">{{ settingsStore.theme === 'dark' ? '☀️' : '🌙' }}</span>
        <span class="theme-label">{{ settingsStore.theme === 'dark' ? '亮色' : '暗色' }}</span>
      </button>
      <span class="version">v0.2.1</span>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: 200px;
  min-width: 200px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

.sidebar-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-logo {
  font-size: 20px;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: left;
  width: 100%;
}

.nav-item:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.palette-btn {
  margin: 0 8px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  width: calc(100% - 16px);
}

.palette-btn:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-active);
  color: var(--text-primary);
}

.palette-btn-icon {
  font-size: 14px;
}

.palette-btn-text {
  flex: 1;
  text-align: left;
}

.palette-btn-kbd {
  font-size: 10px;
  padding: 2px 5px;
  background: var(--bg-surface-hover);
  border-radius: 3px;
  color: var(--text-muted);
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
}

.theme-toggle:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.theme-icon {
  font-size: 14px;
}

.version {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
