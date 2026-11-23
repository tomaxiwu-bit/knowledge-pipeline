<script setup lang="ts">
// 知识图谱视图
// 借鉴 Anytype 的 Graph 可视化 + Trilium 的 Relation Map
// 将 RSS/收藏/笔记条目及其关系可视化为力导向图

import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/renderer/stores/settings'
import { useRelationStore } from '@/renderer/stores/relations'
import { runForceLayout, TYPE_COLORS, TYPE_ICONS, EDGE_COLORS } from '@/lib/graph'
import type { GraphNode, GraphEdge } from '@/lib/graph'
import type { RSSItem, Bookmark, Memo, RSSClient, BookmarkClient, MemoClient } from '@/services/types'
import type { ItemType } from '@/renderer/stores/relations'
import AppIcon from '@/renderer/components/AppIcon.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const relationStore = useRelationStore()

const loading = ref(true)
const graphNodes = ref<GraphNode[]>([])
const graphEdges = ref<GraphEdge[]>([])
const selectedNode = ref<GraphNode | null>(null)
const hoveredNode = ref<GraphNode | null>(null)

// 视口控制
const viewBox = ref({ x: 0, y: 0, w: 1200, h: 800 })
const svgRef = ref<SVGSVGElement | null>(null)

// 图谱数据：{ id -> { type, title } }
const itemRegistry = ref<Map<string, { type: ItemType; title: string }>>(new Map())

const hasData = computed(() => graphNodes.value.length > 0)

async function loadGraphData() {
  loading.value = true
  await relationStore.load()

  const registry = new Map<string, { type: ItemType; title: string }>()

  // 从关系记录中收集节点信息
  for (const rel of relationStore.relations) {
    registry.set(rel.sourceId, { type: rel.sourceType, title: rel.sourceTitle })
    registry.set(rel.targetId, { type: rel.targetType, title: rel.targetTitle })
  }

  // 从各适配器加载更多条目元信息（用于丰富图谱）
  const tasks: Promise<void>[] = []

  const rssClient = settingsStore.getClientByKind('rss') as RSSClient | null
  if (rssClient && rssClient.isConfigured()) {
    tasks.push((async () => {
      try {
        const items: RSSItem[] = await rssClient.getUnreadItems(50)
        for (const item of items) {
          if (registry.has(item.id)) {
            registry.set(item.id, { type: 'rss', title: item.title })
          }
        }
      } catch {}
    })())
  }

  const bookmarkClient = settingsStore.getClientByKind('bookmark') as BookmarkClient | null
  if (bookmarkClient && bookmarkClient.isConfigured()) {
    tasks.push((async () => {
      try {
        const items: Bookmark[] = await bookmarkClient.getBookmarks(50)
        for (const item of items) {
          if (registry.has(item.id)) {
            registry.set(item.id, { type: 'bookmark', title: item.title })
          }
        }
      } catch {}
    })())
  }

  const memoClient = settingsStore.getClientByKind('memo') as MemoClient | null
  if (memoClient && memoClient.isConfigured()) {
    tasks.push((async () => {
      try {
        const items: Memo[] = await memoClient.getMemos(50)
        for (const item of items) {
          if (registry.has(item.id)) {
            registry.set(item.id, { type: 'memo', title: item.content.slice(0, 40) })
          }
        }
      } catch {}
    })())
  }

  await Promise.all(tasks)
  itemRegistry.value = registry

  // 只显示有关系连接的节点
  const connectedIds = relationStore.connectedItemIds
  const nodes: GraphNode[] = []
  for (const id of connectedIds) {
    const info = registry.get(id)
    if (!info) continue
    nodes.push({
      id,
      title: info.title,
      type: info.type,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 20
    })
  }

  const edges: GraphEdge[] = relationStore.relations
    .filter((r) => registry.has(r.sourceId) && registry.has(r.targetId))
    .map((r) => ({
      source: r.sourceId,
      target: r.targetId,
      kind: r.kind
    }))

  // 运行力导向布局（异步分批执行，不阻塞 UI）
  const width = viewBox.value.w
  const height = viewBox.value.h
  await runForceLayout(nodes, edges, { width, height, iterations: 400 })

  // 收窄视口到节点群范围并按画布比例扩展，让节点充满画布而不是缩在角落
  if (nodes.length > 0) {
    const minX = Math.min(...nodes.map((n) => n.x - n.radius))
    const maxX = Math.max(...nodes.map((n) => n.x + n.radius))
    const minY = Math.min(...nodes.map((n) => n.y - n.radius))
    const maxY = Math.max(...nodes.map((n) => n.y + n.radius + 22))
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const padding = 80
    let boxW = Math.max(maxX - minX + padding * 2, 900)
    let boxH = Math.max(maxY - minY + padding * 2, 540)
    const ratio = 1.62
    if (boxW / boxH < ratio) boxW = boxH * ratio
    else boxH = boxW / ratio
    viewBox.value = { x: centerX - boxW / 2, y: centerY - boxH / 2, w: boxW, h: boxH }
  }

  graphNodes.value = nodes
  graphEdges.value = edges
  loading.value = false
}

function getNodeColor(type: string): string {
  return TYPE_COLORS[type] || '#6b7280'
}

function getNodeIcon(type: string): string {
  return TYPE_ICONS[type] || 'D'
}

function getEdgeColor(kind: string): string {
  return EDGE_COLORS[kind] || '#6b7280'
}

function onNodeClick(node: GraphNode) {
  selectedNode.value = node
}

function onNodeDoubleClick(node: GraphNode) {
  const type = node.type as ItemType
  if (type === 'rss' || type === 'bookmark') {
    router.push(`/reader/${type}/${encodeURIComponent(node.id)}`)
  }
}

function onNodeHover(node: GraphNode | null) {
  hoveredNode.value = node
}

function navigateToSelected() {
  if (!selectedNode.value) return
  onNodeDoubleClick(selectedNode.value)
}

// 图例数据
const legendItems = computed(() => {
  const types = new Set(graphNodes.value.map((n) => n.type))
  return Array.from(types).map((type) => ({
    type,
    color: getNodeColor(type),
    icon: getNodeIcon(type),
    label: { 'rss': 'RSS 文章', 'bookmark': '收藏', 'memo': '笔记', 'note': '文档', 'ai-summary': 'AI 摘要' }[type] || type
  }))
})

onMounted(() => {
  loadGraphData()
})
</script>

<template>
  <div class="graph-view">
    <div class="graph-header">
      <div class="graph-title">
        <h2>知识图谱</h2>
        <span class="graph-stats" v-if="hasData">
          {{ graphNodes.length }} 节点 · {{ graphEdges.length }} 关系
        </span>
      </div>
      <button class="btn btn-secondary" @click="loadGraphData" :disabled="loading">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>

    <div class="graph-canvas" v-if="!loading && hasData">
      <svg
        ref="svgRef"
        :viewBox="`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`"
        class="graph-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- 边 -->
        <g class="edges">
          <line
            v-for="(edge, i) in graphEdges"
            :key="`edge-${i}`"
            :x1="graphNodes.find(n => n.id === edge.source)?.x || 0"
            :y1="graphNodes.find(n => n.id === edge.source)?.y || 0"
            :x2="graphNodes.find(n => n.id === edge.target)?.x || 0"
            :y2="graphNodes.find(n => n.id === edge.target)?.y || 0"
            :stroke="getEdgeColor(edge.kind)"
            :stroke-width="hoveredNode && (hoveredNode.id === edge.source || hoveredNode.id === edge.target) ? 2.5 : 1.2"
            :opacity="hoveredNode && (hoveredNode.id === edge.source || hoveredNode.id === edge.target) ? 0.9 : 0.4"
            stroke-linecap="round"
          />
        </g>

        <!-- 节点 -->
        <g class="nodes">
          <g
            v-for="node in graphNodes"
            :key="node.id"
            :transform="`translate(${node.x}, ${node.y})`"
            class="node-group"
            :class="{ selected: selectedNode?.id === node.id, hovered: hoveredNode?.id === node.id }"
            @click.stop="onNodeClick(node)"
            @dblclick.stop="onNodeDoubleClick(node)"
            @mouseenter="onNodeHover(node)"
            @mouseleave="onNodeHover(null)"
          >
            <circle
              :r="node.radius"
              :fill="getNodeColor(node.type)"
              :stroke="selectedNode?.id === node.id ? '#fff' : 'rgba(255,255,255,0.3)'"
              :stroke-width="selectedNode?.id === node.id ? 3 : 1.5"
              class="node-circle"
            />
            <text
              text-anchor="middle"
              dy="0.35em"
              font-size="16"
              class="node-icon"
            >{{ getNodeIcon(node.type) }}</text>
            <!-- 标签 -->
            <text
              text-anchor="middle"
              :y="node.radius + 14"
              font-size="11"
              fill="var(--text-secondary)"
              class="node-label"
            >{{ node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title }}</text>
          </g>
        </g>
      </svg>

      <!-- 图例 -->
      <div class="graph-legend">
        <div v-for="item in legendItems" :key="item.type" class="legend-item">
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-label">{{ item.label }}</span>
        </div>
      </div>

      <!-- 节点详情面板 -->
      <div v-if="selectedNode" class="node-detail">
        <div class="detail-header">
          <span
            class="detail-icon"
            :style="{ color: getNodeColor(selectedNode.type), borderColor: getNodeColor(selectedNode.type) }"
          >{{ getNodeIcon(selectedNode.type) }}</span>
          <div class="detail-title">
            <h4>{{ selectedNode.title }}</h4>
            <span class="detail-type">{{ legendItems.find(l => l.type === selectedNode?.type)?.label || selectedNode?.type }}</span>
          </div>
          <button class="detail-close" @click="selectedNode = null">×</button>
        </div>
        <div class="detail-relations">
          <div class="relation-count">
            <span class="count-label">反向链接</span>
            <span class="count-value">{{ relationStore.getBacklinks(selectedNode.id).length }}</span>
          </div>
          <div class="relation-count">
            <span class="count-label">正向链接</span>
            <span class="count-value">{{ relationStore.getForwardLinks(selectedNode.id).length }}</span>
          </div>
        </div>
        <button
          v-if="selectedNode.type === 'rss' || selectedNode.type === 'bookmark'"
          class="btn btn-primary btn-detail-nav"
          @click="navigateToSelected"
        >打开阅读 →</button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && !hasData" class="empty-graph">
      <AppIcon name="graph" :size="26" class="empty-icon" />
      <h3>暂无知识图谱</h3>
      <p>阅读文章时保存笔记、收藏链接、生成 AI 摘要，</p>
      <p>系统会自动建立条目间的关联，在此可视化展示。</p>
      <button class="btn btn-primary" @click="router.push('/')">去首页发现内容</button>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="graph-loading">
      <span class="loading-spinner"></span>
      <p>正在构建知识图谱...</p>
    </div>
  </div>
</template>

<style scoped>
.graph-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
}

.graph-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.graph-title h2 {
  font-size: 18px;
  font-weight: 600;
}

.graph-stats {
  font-size: 13px;
  color: var(--text-muted);
}

.graph-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.graph-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
}

.graph-svg:active {
  cursor: grabbing;
}

.node-group {
  cursor: pointer;
  transition: opacity 0.2s;
}

.node-group.hovered .node-circle {
  filter: brightness(1.2);
}

.node-group.selected .node-circle {
  filter: brightness(1.3) drop-shadow(0 0 8px rgba(255, 255, 255, 0.5));
}

.node-label {
  pointer-events: none;
  user-select: none;
  opacity: 0;
  paint-order: stroke;
  stroke: var(--bg-primary);
  stroke-width: 3px;
  stroke-linejoin: round;
  transition: opacity 0.2s;
}

/* 节点标签平时隐藏，悬停或选中时才展开，避免密集图谱里文字互相压住 */
.node-group:hover .node-label,
.node-group.selected .node-label {
  opacity: 1;
}

.node-icon {
  fill: rgba(255, 255, 255, 0.94);
  font-family: var(--font-sans);
  font-weight: 600;
  pointer-events: none;
  user-select: none;
}

.node-group:hover .node-label {
  opacity: 1;
  font-weight: 600;
}

.graph-legend {
  position: absolute;
  top: 12px;
  left: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: var(--shadow-sm);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-icon {
  font-size: 13px;
}

.node-detail {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 280px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-lg);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.detail-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.detail-title {
  flex: 1;
  min-width: 0;
}

.detail-title h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
  word-break: break-word;
}

.detail-type {
  font-size: 11px;
  color: var(--text-muted);
}

.detail-close {
  background: transparent;
  color: var(--text-muted);
  font-size: 20px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

.detail-close:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.detail-relations {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.relation-count {
  flex: 1;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 8px;
  text-align: center;
}

.count-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.count-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
}

.btn-detail-nav {
  width: 100%;
}

.empty-graph {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  padding: 48px 24px;
}

.empty-graph .empty-icon {
  font-size: 48px;
  opacity: 0.4;
  margin-bottom: 16px;
}

.empty-graph h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.empty-graph p {
  font-size: 14px;
  margin-bottom: 4px;
  line-height: 1.6;
}

.empty-graph .btn {
  margin-top: 20px;
}

.graph-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
