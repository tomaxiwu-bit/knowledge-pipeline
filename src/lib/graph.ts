// 轻量力导向布局算法
// 借鉴 d3-force 的设计理念，但零依赖纯实现
// 用于知识图谱视图的节点布局计算

export interface GraphNode {
  id: string
  title: string
  type: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

export interface GraphEdge {
  source: string
  target: string
  kind: string
}

export interface LayoutOptions {
  width: number
  height: number
  repulsion: number       // 节点间斥力强度（越大节点越分散）
  springLength: number    // 弹簧自然长度（边的理想长度）
  springStrength: number  // 弹簧强度
  damping: number         // 阻尼
  centerGravity: number   // 中心引力
  iterations: number      // 迭代次数
}

const DEFAULT_OPTIONS: LayoutOptions = {
  width: 800,
  height: 600,
  repulsion: 3000,
  springLength: 120,
  springStrength: 0.05,
  damping: 0.85,
  centerGravity: 0.01,
  iterations: 300
}

/** 初始化节点位置（圆形随机分布） */
function initPositions(nodes: GraphNode[], width: number, height: number): void {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.35
  for (let i = 0; i < nodes.length; i++) {
    const angle = (i / nodes.length) * Math.PI * 2
    const r = radius + (Math.random() - 0.5) * 40
    nodes[i].x = cx + Math.cos(angle) * r
    nodes[i].y = cy + Math.sin(angle) * r
    nodes[i].vx = 0
    nodes[i].vy = 0
  }
}

/** 让出主线程一帧，防止长时间阻塞 UI */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * 运行力导向布局模拟（异步，分批执行防止阻塞 UI）
 *
 * 迭代被切分为多个批次，每批之间通过 setTimeout(0) 让出主线程，
 * 确保即使节点数较多也不会造成界面卡顿。
 * 节点数少时（< 30）一批即可跑完，无额外开销。
 */
export async function runForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: Partial<LayoutOptions> = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  if (nodes.length === 0) return

  initPositions(nodes, opts.width, opts.height)

  const nodeMap = new Map<string, GraphNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  const cx = opts.width / 2
  const cy = opts.height / 2

  // 自适应批次大小：节点越多每批迭代越少，保证单批耗时可控
  // 节点数 < 30：一批跑完；30-100：每批 50 次；> 100：每批 20 次
  const batchSize = nodes.length < 30
    ? opts.iterations
    : nodes.length < 100
      ? 50
      : 20

  let iter = 0
  while (iter < opts.iterations) {
    const end = Math.min(iter + batchSize, opts.iterations)

    for (; iter < end; iter++) {
      // 1. 节点间斥力（O(n²)）
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const distSq = dx * dx + dy * dy + 0.01
          const dist = Math.sqrt(distSq)
          const force = opts.repulsion / distSq
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx -= fx
          a.vy -= fy
          b.vx += fx
          b.vy += fy
        }
      }

      // 2. 边的弹簧吸引力
      for (const edge of edges) {
        const s = nodeMap.get(edge.source)
        const t = nodeMap.get(edge.target)
        if (!s || !t) continue
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01
        const displacement = dist - opts.springLength
        const force = displacement * opts.springStrength
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        s.vx += fx
        s.vy += fy
        t.vx -= fx
        t.vy -= fy
      }

      // 3. 中心引力 + 速度更新 + 位置更新
      for (const node of nodes) {
        node.vx += (cx - node.x) * opts.centerGravity
        node.vy += (cy - node.y) * opts.centerGravity
        node.vx *= opts.damping
        node.vy *= opts.damping

        const maxSpeed = 30
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy)
        if (speed > maxSpeed) {
          node.vx = (node.vx / speed) * maxSpeed
          node.vy = (node.vy / speed) * maxSpeed
        }

        node.x += node.vx
        node.y += node.vy

        const margin = node.radius + 10
        node.x = Math.max(margin, Math.min(opts.width - margin, node.x))
        node.y = Math.max(margin, Math.min(opts.height - margin, node.y))
      }
    }

    // 批次间让出主线程，防止 UI 卡顿
    if (iter < opts.iterations) {
      await nextFrame()
    }
  }
}

/** 节点类型颜色映射 */
export const TYPE_COLORS: Record<string, string> = {
  'rss': '#3b82f6',        // 蓝色
  'bookmark': '#10b981',   // 绿色
  'memo': '#f59e0b',       // 橙色
  'note': '#8b5cf6',       // 紫色
  'ai-summary': '#ec4899'  // 粉色
}

/** 节点类型标记（单字母，在 SVG 节点内以无衬线字体呈现，避免彩色 emoji） */
export const TYPE_ICONS: Record<string, string> = {
  'rss': 'R',
  'bookmark': 'B',
  'memo': 'M',
  'note': 'D',
  'ai-summary': 'AI'
}

/** 边类型颜色映射 */
export const EDGE_COLORS: Record<string, string> = {
  'references': '#6b7280',
  'summarizes': '#ec4899',
  'derived-from': '#f59e0b',
  'related-to': '#3b82f6',
  'bookmark-of': '#10b981'
}
