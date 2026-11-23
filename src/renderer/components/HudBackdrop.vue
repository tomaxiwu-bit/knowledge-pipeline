<script setup lang="ts">
/**
 * 环境网格层：点阵底纹、缓慢下移的扫描光带、四周暗角。
 * 全部压在内容之下（z-index -1），只在留白区域显形，不干扰任何文字。
 */
</script>

<template>
  <div class="hud" aria-hidden="true">
    <div class="hud-grid"></div>
    <div class="hud-vignette"></div>
    <div class="hud-scan"></div>
  </div>
</template>

<style scoped>
.hud {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}

.hud-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, var(--grid-line) 1px, transparent 1.3px);
  background-size: 28px 28px;
}

.hud-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(128% 96% at 50% 44%, transparent 38%, var(--vignette) 100%);
}

.hud-scan {
  position: absolute;
  left: 0;
  right: 0;
  top: -200px;
  height: 200px;
  background: linear-gradient(180deg, transparent, var(--scan-color) 52%, transparent);
  animation: hud-scan 18s linear infinite;
}

@keyframes hud-scan {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(calc(100vh + 400px));
  }
}
</style>
