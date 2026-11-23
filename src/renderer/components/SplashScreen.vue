<script setup lang="ts">
/**
 * 启动开场：只在应用首次挂载时出现不到一秒，给窗口一个「亮起来」的瞬间。
 * 时长刻意压得很短，避免每次切页面都重新看一遍。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/renderer/components/AppIcon.vue'

const visible = ref(true)
const leaving = ref(false)
const timers: number[] = []

onMounted(() => {
  if ((window as unknown as { __KP_NO_SPLASH__?: boolean }).__KP_NO_SPLASH__) {
    visible.value = false
    return
  }
  timers.push(window.setTimeout(() => { leaving.value = true }, 380))
  timers.push(window.setTimeout(() => { visible.value = false }, 760))
})

onBeforeUnmount(() => {
  timers.forEach((id) => window.clearTimeout(id))
})
</script>

<template>
  <div v-if="visible" class="splash" :class="{ leaving }">
    <div class="splash-core">
      <div class="splash-mark">
        <span class="splash-ring"></span>
        <span class="splash-logo"><AppIcon name="layers" :size="26" /></span>
      </div>
      <h1 class="splash-title">知识流水线</h1>
      <p class="splash-sub">KNOWLEDGE PIPELINE</p>
      <span class="splash-bar"><i></i></span>
    </div>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  background:
    radial-gradient(60% 50% at 50% 40%, var(--mesh-a), transparent 70%),
    var(--bg-primary);
}

.splash.leaving {
  animation: splash-out 0.34s ease forwards;
}

@keyframes splash-out {
  to {
    opacity: 0;
    transform: scale(1.02);
  }
}

.splash-core {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: splash-in 0.4s var(--ease-out-expo) both;
}

@keyframes splash-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.splash-mark {
  position: relative;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
}

.splash-ring {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: conic-gradient(from 0deg, transparent 0deg, var(--accent) 90deg, transparent 220deg);
  animation: splash-spin 1.6s linear infinite;
  opacity: 0.55;
  filter: blur(1px);
}

@keyframes splash-spin {
  to { transform: rotate(360deg); }
}

.splash-logo {
  position: relative;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: var(--accent-contrast);
  background: var(--gradient-brand);
  box-shadow: 0 0 34px -6px var(--accent), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.splash-title {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.splash-sub {
  margin-top: 5px;
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.splash-bar {
  display: block;
  width: 120px;
  height: 2px;
  margin-top: 20px;
  border-radius: 2px;
  background: var(--border-color);
  overflow: hidden;
}

.splash-bar i {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: left;
  background: var(--gradient-brand);
  animation: splash-load 0.72s var(--ease-out-expo) both;
}

@keyframes splash-load {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
</style>
