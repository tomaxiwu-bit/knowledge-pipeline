<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import type { ServiceKind } from '@/services/types'

const router = useRouter()
const settingsStore = useSettingsStore()

const stages: Array<{ kind: ServiceKind; icon: string; title: string; description: string }> = [
  { kind: 'rss', icon: '📰', title: '连接信息源', description: '导入待阅读文章' },
  { kind: 'bookmark', icon: '🔖', title: '连接收藏夹', description: '保留值得回看的链接' },
  { kind: 'memo', icon: '📝', title: '连接速记本', description: '把想法沉淀为笔记' }
]

const progress = computed(() => stages.map((stage) => ({
  ...stage,
  complete: settingsStore.services.some((service) => service.kind === stage.kind && service.configured)
})))

const completeCount = computed(() => progress.value.filter((stage) => stage.complete).length)
const isComplete = computed(() => completeCount.value === stages.length)
</script>

<template>
  <section v-if="!isComplete" class="setup-assistant" aria-labelledby="setup-title">
    <div class="setup-copy">
      <p class="eyebrow">开始使用</p>
      <h1 id="setup-title">完成第一条知识流水线</h1>
      <p>连接一个或多个自建服务，把发现、收藏和记录集中在一个桌面工作台。</p>
    </div>

    <div class="setup-steps" aria-label="配置进度">
      <div v-for="stage in progress" :key="stage.kind" class="setup-step" :class="{ complete: stage.complete }">
        <span class="setup-icon" aria-hidden="true">{{ stage.complete ? '✓' : stage.icon }}</span>
        <div>
          <strong>{{ stage.title }}</strong>
          <span>{{ stage.complete ? '已连接' : stage.description }}</span>
        </div>
      </div>
    </div>

    <div class="setup-footer">
      <span>{{ completeCount }}/{{ stages.length }} 个核心环节已连接</span>
      <button class="btn btn-primary" @click="router.push('/settings')">前往设置</button>
    </div>
  </section>
</template>

<style scoped>
.setup-assistant {
  margin: 20px 20px 0;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border-color));
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--accent-soft), var(--bg-surface) 58%);
}

.eyebrow {
  margin-bottom: 5px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.setup-copy h1 {
  margin-bottom: 6px;
  font-size: 19px;
}

.setup-copy p:last-child {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.setup-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.setup-step {
  display: flex;
  gap: 9px;
  align-items: center;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-surface) 85%, transparent);
}

.setup-step.complete {
  border-color: color-mix(in srgb, var(--success) 55%, var(--border-color));
}

.setup-icon {
  display: grid;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--bg-elevated);
  font-size: 13px;
}

.complete .setup-icon {
  background: color-mix(in srgb, var(--success) 18%, var(--bg-surface));
  color: var(--success);
  font-weight: 700;
}

.setup-step strong,
.setup-step span:not(.setup-icon) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setup-step strong {
  font-size: 13px;
}

.setup-step span:not(.setup-icon) {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
}

.setup-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
  color: var(--text-secondary);
  font-size: 12px;
}

@media (max-width: 760px) {
  .setup-steps {
    grid-template-columns: 1fr;
  }
}
</style>
