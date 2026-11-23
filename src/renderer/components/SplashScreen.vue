<script setup lang="ts">
/**
 * 启动开场：约 11 秒的叙事，五段。
 *   唤醒 → 碎片收拢成一个标 → 长出检索网络 → 自检反问 → 就绪
 *
 * 右上角常驻 ESC，键盘 Esc 与点击都能立即退场。
 * 时间轴集中在 STAGES / LEAVES 里，要整体加速就改这几个数。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/renderer/components/AppIcon.vue'

interface Stage {
  step: string
  code: string
  line: string
  sub: string
}

/** 每一段开始的毫秒数，与 STAGES 一一对应。 */
const AT = [0, 1000, 4400, 7400, 8600, 9400]
const LEAVE_AT = 10600
const DISMISS_AT = 10900

const STAGES: Stage[] = [
  { step: '001', code: 'BOOT', line: '正在唤醒本地索引', sub: 'LOCAL INDEX · WAKING' },
  { step: '002', code: 'RECONSTRUCT', line: '把散落的材料，收成一条线。', sub: 'GATHERING · 002' },
  { step: '003', code: 'COGNITION', line: '检索。重排。作答。', sub: 'RETRIEVE · RERANK · ANSWER' },
  { step: '004', code: 'SELF-CHECK', line: '还缺少什么？', sub: 'SELF-CHECK · 98%' },
  { step: '004', code: 'SELF-CHECK', line: '你的问题。', sub: 'AWAITING INPUT' },
  { step: '005', code: 'READY', line: '知识流水线', sub: 'KNOWLEDGE PIPELINE' }
]

/** 碎片起飞、到达、消失，以及标志亮起的时刻。 */
const FRAG_START = 1000
const FRAG_HIT = 4000
const FRAG_END = 4200
/** 网络长出与收拢的时刻。 */
const NET_START = 4400
const NET_COLLAPSE = 7400
const NET_END = 8200

const visible = ref(true)
const leaving = ref(false)
const index = ref(0)
const count = ref(0)
/** 标志在碎片收拢到一半时就该开始成形，不能等它们全部消失 */
const markOn = ref(false)

const fx = ref<HTMLCanvasElement | null>(null)
const mark = ref<HTMLElement | null>(null)

const stage = computed(() => STAGES[index.value])
const pad = computed(() => String(count.value).padStart(3, '0'))

const timers: number[] = []
let raf = 0
let teardownFx: (() => void) | null = null
let leavingStarted = false

const TINTS = ['208, 224, 255', '90, 169, 255', '98, 232, 216']

interface Fragment {
  angle: number
  from: number
  to: number
  len: number
  wide: number
  spin: number
  tint: string
  alpha: number
  delay: number
}

interface Node {
  angle: number
  radius: number
  delay: number
  chain: number
}

function startFx() {
  const canvas = fx.value
  const anchor = mark.value
  if (!canvas || !anchor) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const rect = anchor.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const short = Math.min(width, height)

  // 两层碎片：近层快而亮，远层慢而淡，叠出景深
  const frags: Fragment[] = []
  for (let i = 0; i < 96; i += 1) {
    const far = i % 3 === 0
    frags.push({
      angle: (i / 96) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      from: (far ? 300 : 200) + Math.random() * short * (far ? 0.5 : 0.36),
      to: 24 + Math.random() * 16,
      len: (far ? 5 : 8) + Math.random() * (far ? 10 : 16),
      wide: 1.2 + Math.random() * 2.1,
      spin: (Math.random() - 0.5) * 0.7,
      tint: TINTS[i % TINTS.length],
      alpha: (far ? 0.14 : 0.26) + Math.random() * (far ? 0.3 : 0.52),
      delay: far ? 260 : 0
    })
  }

  // 检索网络：三条链，链内节点相邻相连
  const nodes: Node[] = []
  const chains = [4, 5, 5]
  let cursor = 0
  chains.forEach((size, chain) => {
    for (let i = 0; i < size; i += 1) {
      const angle = (cursor + i) * (Math.PI * 2 / 14) + chain * 0.42
      // 往下长的节点收一收，别压到文案上
      const low = Math.sin(angle) > 0.55
      nodes.push({
        angle,
        radius: (low ? 54 : 74) + (i % 2 === 0 ? 24 : 0) + Math.random() * (low ? 24 : 42),
        delay: chain * 90 + i * 46,
        chain
      })
    }
    cursor += size
  })

  const clear = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
  }

  const drawFragments = (t: number) => {
    const p = Math.min(1, Math.max(0, (t - FRAG_START) / (FRAG_HIT - FRAG_START)))
    const fade = p < 0.05 ? p / 0.05 : p > 0.9 ? Math.max(0, 1 - (p - 0.9) / 0.1) : 1

    for (const f of frags) {
      const fp = Math.min(1, Math.max(0, (t - FRAG_START - f.delay) / (FRAG_HIT - FRAG_START)))
      if (fp <= 0) continue
      const fe = fp * fp
      const r = f.from - (f.from - f.to) * fe
      const x = cx + Math.cos(f.angle) * r
      const y = cy + Math.sin(f.angle) * r
      const rot = f.angle + Math.PI + f.spin + fp * 0.9

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.fillStyle = `rgba(${f.tint}, ${(f.alpha * fade).toFixed(3)})`
      ctx.beginPath()
      const len = f.len * (1 + 0.4 * fp * fp * fp)
      const hw = (f.wide * (1 - 0.4 * fp)) / 2
      ctx.moveTo(len / 2, 0)
      ctx.lineTo(-len / 2, -hw)
      ctx.lineTo(-len / 2, hw)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  const nodeAt = (node: Node, grown: number) => {
    const r = node.radius * grown
    return [cx + Math.cos(node.angle) * r, cy + Math.sin(node.angle) * r] as const
  }

  const drawNetwork = (elapsed: number, collapse: boolean) => {
    const grow = (node: Node) => {
      const g = Math.min(1, Math.max(0, (elapsed - node.delay) / 620))
      return g < 1 ? 1 - Math.pow(1 - g, 3) : 1
    }

    let shrink = 1
    if (collapse) {
      shrink = Math.max(0, 1 - elapsed / 760)
    }

    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(120, 170, 255, 0.55)'

    for (let i = 1; i < nodes.length; i += 1) {
      const a = nodes[i - 1]
      const b = nodes[i]
      if (a.chain !== b.chain) continue
      const ga = grow(a) * shrink
      const gb = grow(b) * shrink
      if (ga <= 0 || gb <= 0) continue
      const [ax, ay] = nodeAt(a, ga)
      const [bx, by] = nodeAt(b, gb)
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const mxo = mx + (mx - cx) * 0.22
      const myo = my + (my - cy) * 0.22
      ctx.globalAlpha = Math.min(ga, gb) * 0.5
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo(mxo, myo, bx, by)
      ctx.stroke()
    }

    for (const node of nodes) {
      const g = grow(node) * shrink
      if (g <= 0) continue
      const [x, y] = nodeAt(node, g)
      const rad = 2.2 * g
      ctx.globalAlpha = g * 0.9
      ctx.shadowColor = 'rgba(90, 169, 255, 0.9)'
      ctx.shadowBlur = 12
      ctx.fillStyle = 'rgb(190, 214, 255)'
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }

  let origin = 0
  let lastPaint = 0
  const loop = (now: number) => {
    if (!origin) origin = now
    const t = now - origin
    // 30fps 节流：碎片与网络的位移在这个帧率下看不出差别，但省一半渲染
    if (now - lastPaint < 28) {
      raf = window.requestAnimationFrame(loop)
      return
    }
    lastPaint = now

    clear()
    if (t >= FRAG_START && t < FRAG_END + 40) {
      drawFragments(t)
    } else if (t >= NET_START && t < NET_END + 40) {
      drawNetwork(t - NET_START, t >= NET_COLLAPSE)
    }

    const progress = Math.min(1, Math.max(0, (t - FRAG_START) / (FRAG_HIT - FRAG_START)))
    count.value = Math.round(progress * 100)

    if (t < DISMISS_AT) raf = window.requestAnimationFrame(loop)
  }
  raf = window.requestAnimationFrame(loop)

  teardownFx = () => {
    window.cancelAnimationFrame(raf)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

function beginLeave() {
  if (leavingStarted) return
  leavingStarted = true
  timers.forEach((id) => window.clearTimeout(id))
  leaving.value = true
  timers.push(window.setTimeout(() => { visible.value = false }, 320))
}

function skip() {
  beginLeave()
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  beginLeave()
}

onMounted(() => {
  if ((window as unknown as { __KP_NO_SPLASH__?: boolean }).__KP_NO_SPLASH__) {
    visible.value = false
    return
  }
  // 系统要求减少动效时直接跳过，不给任何人上一段十几秒的动画
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    visible.value = false
    return
  }
  // 截图脚本用它把「开场已挂载」当作时间零点
  ;(window as unknown as { __KP_SPLASH_AT__?: number }).__KP_SPLASH_AT__ = performance.now()
  nextTick(() => startFx())

  AT.forEach((at, i) => {
    if (i === 0) return
    timers.push(window.setTimeout(() => { index.value = i }, at))
  })
  timers.push(window.setTimeout(() => { markOn.value = true }, 3700))
  timers.push(window.setTimeout(beginLeave, LEAVE_AT))
  timers.push(window.setTimeout(() => { visible.value = false }, DISMISS_AT))
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  timers.forEach((id) => window.clearTimeout(id))
  window.removeEventListener('keydown', onKey)
  teardownFx?.()
})
</script>

<template>
  <div v-if="visible" class="splash" :class="{ leaving }">
    <div class="splash-grid"></div>
    <div class="splash-glow" :class="{ lit: markOn }"></div>
    <canvas ref="fx" class="splash-fx"></canvas>

    <button class="skip" type="button" @click="skip">
      <kbd>ESC</kbd><span>跳过</span>
    </button>

    <!-- 读数挪到左上角，别让网络长出来时被横线穿过 -->
    <div class="splash-ruler">
      <span class="ruler-line"></span>
      <span class="ruler-label">{{ stage.code }} / {{ stage.step }}</span>
    </div>

    <div class="splash-core">
      <div ref="mark" class="splash-mark" :class="{ shown: markOn }">
        <span class="mark-ring"></span>
        <span class="splash-logo"><AppIcon name="layers" :size="26" /></span>
      </div>

      <transition name="copy" mode="out-in">
        <div class="splash-copy" :key="stage.line">
          <h1 class="splash-line">{{ stage.line }}</h1>
          <p class="splash-sub">{{ stage.sub }}</p>
        </div>
      </transition>

      <div class="splash-meter">
        <span class="meter-track"><i class="meter-fill" :style="{ width: `${count}%` }"></i></span>
        <span class="meter-num">{{ pad }}</span>
      </div>

      <p class="splash-status" :class="{ shown: index >= STAGES.length - 1 }">
        <span class="pulse"></span>本地索引已就绪
      </p>
    </div>

    <span class="corner tl"></span>
    <span class="corner tr"></span>
    <span class="corner bl"></span>
    <span class="corner br"></span>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--bg-primary);
}

.splash.leaving {
  animation: splash-out 0.34s ease forwards;
}

@keyframes splash-out {
  to {
    opacity: 0;
    transform: scale(1.015);
  }
}

.splash-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, var(--grid-line) 1px, transparent 1.4px);
  background-size: 28px 28px;
  animation: grid-in 0.6s var(--ease-out-expo) both;
}

@keyframes grid-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.splash-glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: radial-gradient(44% 38% at 50% 44%, var(--mesh-a), transparent 74%);
  transition: opacity 1.6s ease;
}

.splash-glow.lit {
  opacity: 1;
}

.splash-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* === 跳过 === */

.skip {
  position: absolute;
  top: 30px;
  right: 76px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  cursor: pointer;
  opacity: 0;
  animation: skip-in 0.4s ease 1.4s both;
  transition: color 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease;
}

.skip:hover,
.skip:focus-visible {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 18px -6px var(--accent);
  outline: none;
}

.skip kbd {
  padding: 1px 5px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: inherit;
  font-size: 8.5px;
  letter-spacing: 0.1em;
}

.skip:hover kbd {
  border-color: var(--accent);
}

@keyframes skip-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* === 主体 === */

.splash-core {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.splash-ruler {
  position: absolute;
  top: 84px;
  left: 62px;
  width: 220px;
  height: 26px;
}

.ruler-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  transform: scaleX(0);
  transform-origin: center;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.42) 14%,
    rgba(255, 255, 255, 0.42) 86%,
    transparent
  );
  animation: ruler-in 0.42s var(--ease-out-expo) both;
}

.ruler-label {
  position: absolute;
  left: 0;
  bottom: 9px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  animation: label-in 0.3s ease 0.12s both;
}

@keyframes ruler-in {
  to { transform: scaleX(1); }
}

@keyframes label-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.splash-mark {
  position: relative;
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
}

.mark-ring {
  position: absolute;
  inset: 0;
  border: 1px solid var(--accent);
  border-radius: 50%;
  opacity: 0;
}

.splash-mark.shown .mark-ring {
  animation: ring-burst 1.1s var(--ease-out-expo) forwards;
}

@keyframes ring-burst {
  0% {
    transform: scale(0.5);
    opacity: 0.85;
  }
  100% {
    transform: scale(1.62);
    opacity: 0;
  }
}

.splash-logo {
  position: relative;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: var(--accent-contrast);
  background: var(--gradient-brand);
  box-shadow:
    0 0 42px -4px var(--accent),
    0 0 0 1px rgba(255, 255, 255, 0.16) inset,
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  opacity: 0;
  transform: scale(0.74);
  transition: opacity 0.6s var(--ease-out-expo), transform 0.7s var(--ease-spring);
}

.splash-mark.shown .splash-logo {
  opacity: 1;
  transform: scale(1);
}

/* === 文案 === */

.splash-copy {
  min-height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
}

.splash-line {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--text-primary);
}

.splash-sub {
  margin-top: 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--text-muted);
}

.copy-enter-active {
  animation: copy-in 0.34s var(--ease-out-expo) both;
}

.copy-leave-active {
  animation: copy-out 0.2s ease both;
}

@keyframes copy-in {
  from {
    opacity: 0;
    transform: translateY(11px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes copy-out {
  to {
    opacity: 0;
    transform: translateY(-7px);
  }
}

/* === 计数与进度 === */

.splash-meter {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 178px;
  margin-top: 24px;
}

.meter-track {
  position: relative;
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.09);
}

.meter-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--accent);
  box-shadow:
    0 0 9px var(--accent),
    0 0 20px rgba(90, 169, 255, 0.45);
}

.meter-num {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.splash-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 13px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.5s ease;
}

.splash-status.shown {
  opacity: 0.92;
}

.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow:
    0 0 10px var(--accent),
    0 0 3px rgba(255, 255, 255, 0.9) inset;
  animation: pulse-blink 1.2s ease-in-out infinite;
}

@keyframes pulse-blink {
  50% { opacity: 0.55; }
}

/* === 四角定位角标 === */

.corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border-color: rgba(255, 255, 255, 0.22);
  border-style: solid;
  border-width: 0;
}

.corner.tl {
  top: 34px;
  left: 40px;
  border-top-width: 1px;
  border-left-width: 1px;
}

.corner.tr {
  top: 34px;
  right: 40px;
  border-top-width: 1px;
  border-right-width: 1px;
}

.corner.bl {
  bottom: 34px;
  left: 40px;
  border-bottom-width: 1px;
  border-left-width: 1px;
}

.corner.br {
  bottom: 34px;
  right: 40px;
  border-bottom-width: 1px;
  border-right-width: 1px;
}
</style>
