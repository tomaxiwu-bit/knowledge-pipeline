<script setup lang="ts">
import RSSPanel from '@/renderer/components/RSSPanel.vue'
import BookmarkPanel from '@/renderer/components/BookmarkPanel.vue'
import NotesPanel from '@/renderer/components/NotesPanel.vue'
import SetupAssistant from '@/renderer/components/SetupAssistant.vue'
</script>

<template>
  <div class="home-view">
    <SetupAssistant />
    <div class="pipeline-panels">
      <RSSPanel />
      <BookmarkPanel />
      <NotesPanel />
    </div>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.pipeline-panels {
  display: flex;
  min-height: 0;
  flex: 1;
  margin-top: 20px;
}

.pipeline-panels > * {
  flex: 1;
  border-right: 1px solid var(--border-color);
}

.pipeline-panels > *:last-child {
  border-right: none;
}

@media (max-width: 900px) {
  .home-view {
    overflow: auto;
  }

  .pipeline-panels {
    min-height: 600px;
  }
}
</style>
