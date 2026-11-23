<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useCommandRegistry } from '@/renderer/composables/useCommandRegistry'
import AppIcon from '@/renderer/components/AppIcon.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const { openPalette } = useCommandRegistry()

const navItems = [
  { name: 'home', label: '流水线', icon: 'home', path: '/' },
  { name: 'daily', label: '每日笔记', icon: 'calendar', path: '/daily' },
  { name: 'search', label: '搜索', icon: 'search', path: '/search' },
  { name: 'inquiry', label: '探究线', icon: 'compass', path: '/inquiry' },
  { name: 'knowledge', label: '知识问答', icon: 'brain', path: '/knowledge' },
  { name: 'graph', label: '知识图谱', icon: 'graph', path: '/graph' },
  { name: 'editor', label: '写作', icon: 'pen', path: '/editor' },
  { name: 'settings', label: '设置', icon: 'settings', path: '/settings' }
]
</script>

<template>
  <nav class="sidebar">
    <div class="sidebar-header">
      <span class="logo-mark"><AppIcon name="layers" :size="16" /></span>
      <div class="brand">
        <span class="sidebar-title">知识流水线</span>
        <span class="sidebar-sub">Knowledge Pipeline</span>
      </div>
    </div>

    <div class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.name"
        class="nav-item"
        :class="{ active: $route.name === item.name }"
        @click="router.push(item.path)"
      >
        <AppIcon :name="item.icon" :size="17" class="nav-icon" />
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>

    <button class="palette-btn" @click="openPalette" title="打开命令面板 (Ctrl+K)">
      <span class="palette-btn-icon">⌘</span>
      <span class="palette-btn-text">命令面板</span>
      <kbd class="palette-btn-kbd">Ctrl K</kbd>
    </button>

    <div class="sidebar-footer">
      <button
        class="theme-toggle"
        @click="settingsStore.toggleTheme"
        :title="settingsStore.theme === 'dark' ? '切换到亮色' : '切换到暗色'"
      >
        <AppIcon :name="settingsStore.theme === 'dark' ? 'sun' : 'moon'" :size="15" />
        <span class="theme-label">{{ settingsStore.theme === 'dark' ? '亮色' : '暗色' }}</span>
      </button>
      <span class="version">v0.3.1</span>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: 216px;
  min-width: 216px;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
}

.sidebar-header {
  padding: 18px 16px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--accent-contrast);
  background: linear-gradient(145deg, var(--accent), var(--accent-hover));
  box-shadow: var(--shadow-sm);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.sidebar-sub {
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sidebar-nav {
  flex: 1;
  padding: 4px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
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
  font-weight: 500;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 18px;
  border-radius: 2px;
  background: var(--accent);
}

.nav-icon {
  opacity: 0.9;
}

.nav-item.active .nav-icon {
  opacity: 1;
}

.sidebar-footer {
  padding: 10px 14px 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.palette-btn {
  margin: 0 10px 8px;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 12px;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.palette-btn:hover {
  background: var(--bg-surface-hover);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.palette-btn-icon {
  font-size: 13px;
  line-height: 1;
  color: var(--text-secondary);
}

.palette-btn-text {
  flex: 1;
  text-align: left;
}

.palette-btn-kbd {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
}

.theme-toggle:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.version {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-muted);
}
</style>
