<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/renderer/stores/settings'
import { listAllAdapters, KIND_LABELS, KIND_ICONS, getAdapterMeta } from '@/services/registry'
import { createBackup, parseBackup, fetchKnowledgeBaseForBackup } from '@/lib/backup'
import '@/services'
import type { ServiceKind, ServiceInstance, AdapterMeta, ConnectionResult } from '@/services/types'

const settingsStore = useSettingsStore()

const allAdapters = listAllAdapters()
const showAddDialog = ref(false)
const selectedKind = ref<ServiceKind | null>(null)
const testing = ref<string | null>(null) // instance.id
const testingAll = ref(false)
const testResults = ref<Record<string, ConnectionResult>>({})
const backupInput = ref<HTMLInputElement | null>(null)
const backupStatus = ref('')
const restoringBackup = ref(false)
const ragBaseUrl = ref('http://127.0.0.1:8787')
const ragStatus = ref('')
const savingRag = ref(false)
const testingRag = ref(false)

// 添加后端的表单
const addForm = ref({
  clientId: '',
  name: '',
  config: {} as Record<string, string>
})

function startAdd(kind: ServiceKind) {
  selectedKind.value = kind
  const adapters = allAdapters[kind]
  addForm.value = {
    clientId: adapters[0]?.id ?? '',
    name: '',
    config: {}
  }
  // 初始化配置字段为空
  const meta = adapters[0]
  if (meta) {
    for (const field of meta.configFields) {
      addForm.value.config[field.key] = field.defaultValue ?? ''
    }
  }
  showAddDialog.value = true
}

function onAdapterChange() {
  const meta = getAdapterMeta(addForm.value.clientId)
  if (meta) {
    const newConfig: Record<string, string> = {}
    for (const field of meta.configFields) {
      newConfig[field.key] = field.defaultValue ?? ''
    }
    addForm.value.config = newConfig
  }
}

function getSelectedAdapterMeta(): AdapterMeta | undefined {
  return getAdapterMeta(addForm.value.clientId)
}

async function confirmAdd() {
  const meta = getSelectedAdapterMeta()
  if (!meta || !selectedKind.value) return

  // 校验必填
  for (const field of meta.configFields) {
    if (field.required && !addForm.value.config[field.key]) {
      return
    }
  }

  await settingsStore.addService({
    name: addForm.value.name || meta.displayName,
    kind: selectedKind.value,
    clientId: addForm.value.clientId,
    config: addForm.value.config as any
  })

  showAddDialog.value = false
  selectedKind.value = null
}

async function removeInstance(id: string) {
  if (confirm('确定删除这个后端配置吗？')) {
    await settingsStore.removeService(id)
  }
}

async function useAIService(svc: ServiceInstance) {
  settingsStore.services = [svc, ...settingsStore.services.filter((item) => item.id !== svc.id)]
  await settingsStore.save()
}

async function testInstance(svc: ServiceInstance) {
  testing.value = svc.id
  try {
    const result = await settingsStore.testService(svc.id)
    testResults.value[svc.id] = result
  } catch (e: any) {
    testResults.value[svc.id] = { success: false, message: e.message }
    settingsStore.setInstanceStatus(svc.id, 'error')
  } finally {
    testing.value = null
  }
}

async function testAllConnections() {
  testingAll.value = true
  try {
    const results = await settingsStore.testAllServices()
    testResults.value = { ...testResults.value, ...results }
  } finally {
    testingAll.value = false
  }
}

function setBackupStatus(message: string) {
  backupStatus.value = message
}

async function exportBackup() {
  try {
    const [relations, savedSearches, customTemplates, inquiryThreads, rag] = await Promise.all([
      window.kpAPI.settings.get('relations'),
      window.kpAPI.settings.get('savedSearches'),
      window.kpAPI.settings.get('customTemplates'),
      window.kpAPI.settings.get('inquiryThreads'),
      window.kpAPI.settings.get('rag')
    ])
    const knowledgeBase = await fetchKnowledgeBaseForBackup(window.kpAPI.rag.invoke)
    const backup = createBackup({
      theme: settingsStore.theme,
      services: settingsStore.services,
      rag,
      local: {
        relations: Array.isArray(relations) ? relations : [],
        savedSearches: Array.isArray(savedSearches) ? savedSearches : [],
        customTemplates: Array.isArray(customTemplates) ? customTemplates : [],
        inquiryThreads: Array.isArray(inquiryThreads) ? inquiryThreads : []
      },
      knowledgeBase
    })
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `knowledge-pipeline-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(url), 100)
    setBackupStatus('本地工作流备份已导出。服务地址和知识库文档列表会保留，凭据和知识库正文不会包含在文件中。')
  } catch (error) {
    setBackupStatus(error instanceof Error ? `导出失败：${error.message}` : '导出失败')
  }
}

function chooseBackupFile() {
  backupInput.value?.click()
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    setBackupStatus('备份文件超过 5 MB，已拒绝导入。')
    return
  }
  if (!confirm('恢复会替换本机的服务元数据、关系、智能集合、模板和探究线。API Key 不会从备份导入。继续吗？')) return

  restoringBackup.value = true
  try {
    const backup = parseBackup(JSON.parse(await file.text()))
    await window.kpAPI.settings.set('services', backup.settings.services)
    await window.kpAPI.settings.set('theme', backup.settings.theme)
    await window.kpAPI.settings.set('rag', backup.settings.rag)
    await window.kpAPI.settings.set('relations', backup.local.relations)
    await window.kpAPI.settings.set('savedSearches', backup.local.savedSearches)
    await window.kpAPI.settings.set('customTemplates', backup.local.customTemplates)
    await window.kpAPI.settings.set('inquiryThreads', backup.local.inquiryThreads)
    await settingsStore.load(true)
    setBackupStatus('恢复完成，正在重新加载应用…')
    window.setTimeout(() => window.location.reload(), 700)
  } catch (error) {
    setBackupStatus(error instanceof Error ? `恢复失败：${error.message}` : '恢复失败')
  } finally {
    restoringBackup.value = false
  }
}

function getStatusBadge(svc: ServiceInstance): { text: string; cls: string } {
  const entry = settingsStore.clientMap.get(svc.id)
  const status = entry?.status ?? 'unconfigured'
  const result = testResults.value[svc.id]
  if (result) {
    return {
      text: result.success ? '已连接' : '连接失败',
      cls: result.success ? 'connected' : 'error'
    }
  }
  return {
    text: status === 'connected' ? '已连接' : status === 'error' ? '连接失败' : status === 'unconfigured' ? '未配置' : '未测试',
    cls: status === 'connected' ? 'connected' : status === 'error' ? 'error' : ''
  }
}

async function loadRagSettings() {
  try {
    const rag = await window.kpAPI.settings.get('rag') as { baseUrl?: string }
    if (typeof rag?.baseUrl === 'string') ragBaseUrl.value = rag.baseUrl
  } catch (error) {
    ragStatus.value = error instanceof Error ? error.message : '无法读取本地知识服务配置'
  }
}

async function saveRagSettings() {
  savingRag.value = true
  ragStatus.value = ''
  try {
    const saved = await window.kpAPI.settings.set('rag', { baseUrl: ragBaseUrl.value }) as { baseUrl?: string }
    if (typeof saved?.baseUrl === 'string') ragBaseUrl.value = saved.baseUrl
    ragStatus.value = '本地知识服务地址已保存。'
  } catch (error) {
    ragStatus.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    savingRag.value = false
  }
}

async function testRagService() {
  testingRag.value = true
  ragStatus.value = ''
  try {
    await saveRagSettings()
    const health = await window.kpAPI.rag.invoke('health') as { storage?: { documents?: number; chunks?: number } }
    ragStatus.value = `连接成功：${health.storage?.documents ?? 0} 篇材料，${health.storage?.chunks ?? 0} 个知识片段。`
  } catch (error) {
    ragStatus.value = error instanceof Error ? error.message : '连接失败'
  } finally {
    testingRag.value = false
  }
}

onMounted(loadRagSettings)

const kinds: ServiceKind[] = ['rss', 'bookmark', 'memo', 'ai']
</script>

<template>
  <div class="settings-view">
    <div class="settings-container">
      <header class="settings-header">
        <div class="settings-title-row">
          <div>
            <h1>设置</h1>
            <p class="settings-desc">
              按环节添加后端服务。同一环节可配多个后端，应用按列表顺序使用已配置实例。
            </p>
          </div>
          <button class="btn btn-secondary" @click="testAllConnections" :disabled="testingAll || settingsStore.services.length === 0">
            {{ testingAll ? '测试中...' : '测试全部连接' }}
          </button>
        </div>
      </header>

      <!-- 按环节分组展示 -->
      <section v-for="kind in kinds" :key="kind" class="kind-section">
        <p v-if="kind === 'ai'" class="field-help">摘要和知识库问答使用列表中第一个已配置的 AI 服务。摘要原文、问题及检索片段会发送到该 API；索引仍保存在本机。切换服务类型会清空表单密钥。</p>
        <div class="kind-header">
          <h2>
            <span class="kind-icon">{{ KIND_ICONS[kind] }}</span>
            {{ KIND_LABELS[kind] }}
          </h2>
          <button class="btn btn-primary btn-sm" @click="startAdd(kind)">
            + 添加{{ KIND_LABELS[kind] }}后端
          </button>
        </div>

        <div v-if="settingsStore.servicesByKind[kind].length === 0" class="kind-empty">
          尚未配置{{ KIND_LABELS[kind] }}后端
        </div>

        <div
          v-for="svc in settingsStore.servicesByKind[kind]"
          :key="svc.id"
          class="service-card"
        >
          <div class="service-header">
            <div>
              <h3 class="service-title">{{ svc.name }}</h3>
              <p class="service-desc">{{ getAdapterMeta(svc.clientId)?.displayName || svc.clientId }}</p>
            </div>
            <span class="status-badge" :class="getStatusBadge(svc).cls">
              {{ getStatusBadge(svc).text }}
            </span>
          </div>

          <div class="service-config">
            <div v-for="field in getAdapterMeta(svc.clientId)?.configFields ?? []" :key="field.key" class="config-row">
              <span class="config-label">{{ field.label }}</span>
              <span class="config-value">
                {{ field.type === 'password' ? '••••••••' : (svc.config as any)[field.key] || '—' }}
              </span>
            </div>
          </div>

          <div class="service-actions">
            <button v-if="kind === 'ai'" class="btn btn-secondary btn-sm" :disabled="!svc.configured || settingsStore.services.find(item => item.kind === 'ai' && item.configured)?.id === svc.id" @click="useAIService(svc)">用于摘要和问答</button>
            <button class="btn btn-secondary btn-sm" @click="testInstance(svc)" :disabled="testing === svc.id">
              {{ testing === svc.id ? '测试中...' : '测试连接' }}
            </button>
            <button class="btn btn-secondary btn-sm" @click="removeInstance(svc.id)">
              删除
            </button>
            <span v-if="testResults[svc.id]" class="test-result" :class="{ success: testResults[svc.id].success, fail: !testResults[svc.id].success }">
              {{ testResults[svc.id].message }}
            </span>
          </div>
        </div>
      </section>

      <section class="rag-section">
        <div>
          <h3>🧠 本地知识问答服务</h3>
          <p>桌面应用通过受限的主进程代理连接本机 FastAPI 服务；知识正文保存在 SQLite，向量索引保存在 Chroma。默认地址无需修改。</p>
        </div>
        <div class="rag-controls">
          <label for="rag-base-url">服务地址</label>
          <div class="rag-input-row">
            <input id="rag-base-url" v-model="ragBaseUrl" type="url" class="form-input" placeholder="http://127.0.0.1:8787" />
            <button class="btn btn-secondary" :disabled="savingRag || testingRag" @click="saveRagSettings">保存</button>
            <button class="btn btn-primary" :disabled="testingRag" @click="testRagService">{{ testingRag ? '检查中...' : '测试服务' }}</button>
          </div>
          <p class="field-help">出于安全和本地优先设计，仅接受本机 HTTP 地址。启动方法见 README 的「本地知识问答」部分。</p>
          <p v-if="ragStatus" class="rag-status">{{ ragStatus }}</p>
        </div>
      </section>

      <section class="data-section">
        <div>
          <h3>数据迁移与备份</h3>
          <p>导出本机的关系、智能集合、自定义模板、探究线、服务地址和知识库文档列表。API Key、Token、密码与知识库正文始终不会被导出或导入。</p>
        </div>
        <div class="data-actions">
          <button class="btn btn-secondary" @click="exportBackup">导出本地备份</button>
          <button class="btn btn-secondary" :disabled="restoringBackup" @click="chooseBackupFile">
            {{ restoringBackup ? '恢复中...' : '恢复本地备份' }}
          </button>
          <input ref="backupInput" type="file" accept="application/json,.json" class="visually-hidden" @change="importBackup" />
        </div>
        <p v-if="backupStatus" class="backup-status">{{ backupStatus }}</p>
      </section>

      <div class="help-section">
        <h3>使用说明</h3>
        <ol>
          <li>每个环节都可以添加一个或多个后端实例</li>
          <li>当前已实现 FreshRSS（RSS）、Karakeep（收藏）和 Memos（笔记）适配器</li>
          <li>AI 摘要支持 OpenAI 兼容接口与本地 Ollama</li>
          <li>应用会按列表顺序使用第一个已配置的后端实例</li>
          <li>所有配置存在本地，不上传任何服务器</li>
        </ol>
      </div>
    </div>

    <!-- 添加后端对话框 -->
    <div v-if="showAddDialog && selectedKind" class="modal-overlay" @click.self="showAddDialog = false">
      <div class="modal-card">
        <div class="modal-header">
          <h3>添加{{ KIND_LABELS[selectedKind] }}后端</h3>
          <button class="btn btn-secondary btn-sm" @click="showAddDialog = false">关闭</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>后端类型</label>
            <select v-model="addForm.clientId" class="form-select" @change="onAdapterChange">
              <option v-for="a in allAdapters[selectedKind]" :key="a.id" :value="a.id">
                {{ a.displayName }} — {{ a.description }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>实例名称（可选）</label>
            <input
              v-model="addForm.name"
              type="text"
              :placeholder="getSelectedAdapterMeta()?.displayName || '起个好记的名字'"
              class="form-input"
            />
          </div>

          <div v-for="field in getSelectedAdapterMeta()?.configFields ?? []" :key="field.key" class="form-group">
            <label>
              {{ field.label }}
              <span v-if="field.required" class="required">*</span>
            </label>
            <input
              v-model="addForm.config[field.key]"
              :type="field.type === 'password' ? 'password' : field.type === 'url' ? 'url' : 'text'"
              :placeholder="field.placeholder"
              class="form-input"
            />
            <p v-if="field.help" class="field-help">{{ field.help }}</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddDialog = false">取消</button>
          <button class="btn btn-primary" @click="confirmAdd">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  overflow-y: auto;
  background: var(--bg-primary);
}

.settings-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px;
}

.settings-header {
  margin-bottom: 32px;
}

.settings-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.settings-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.settings-desc {
  color: var(--text-secondary);
  font-size: 14px;
}

.kind-section {
  margin-bottom: 32px;
}

.kind-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.kind-header h2 {
  font-size: 17px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.kind-icon {
  font-size: 20px;
}

.kind-empty {
  padding: 16px;
  background: var(--bg-surface);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.service-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 12px;
}

.service-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.service-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 2px;
}

.service-desc {
  font-size: 12px;
  color: var(--text-muted);
}

.status-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  white-space: nowrap;
}

.status-badge.connected {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.service-config {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  margin-bottom: 12px;
}

.config-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.config-label {
  color: var(--text-secondary);
}

.config-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.test-result {
  font-size: 12px;
}

.test-result.success {
  color: var(--success);
}

.test-result.fail {
  color: var(--danger);
}

.help-section {
  margin-top: 40px;
  padding: 20px;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

.rag-section {
  display: grid;
  grid-template-columns: minmax(190px, .9fr) minmax(300px, 1.4fr);
  gap: 20px;
  align-items: start;
  margin: 12px 0 32px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.rag-section h3 { margin-bottom: 6px; font-size: 15px; }
.rag-section > div > p { color: var(--text-secondary); font-size: 12px; line-height: 1.6; }
.rag-controls label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 12px; }
.rag-input-row { display: flex; gap: 8px; }
.rag-input-row .form-input { min-width: 0; flex: 1; }
.rag-status { margin-top: 8px; color: var(--success) !important; }

.data-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
  margin: 12px 0 32px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}

.data-section h3 {
  margin-bottom: 5px;
  font-size: 15px;
}

.data-section p {
  max-width: 480px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.data-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.backup-status {
  flex-basis: 100%;
  color: var(--success) !important;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 680px) {
  .data-section {
    align-items: stretch;
    flex-direction: column;
  }

  .data-actions {
    justify-content: flex-start;
  }

  .rag-section { grid-template-columns: 1fr; }
  .rag-input-row { flex-wrap: wrap; }
}

.help-section h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.help-section ol {
  padding-left: 20px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 2;
}

/* 对话框 */
.modal-overlay {
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

.modal-card {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  width: 520px;
  max-width: 90%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.required {
  color: var(--danger);
  margin-left: 2px;
}

.form-input,
.form-select {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  color: var(--text-primary);
  font-size: 14px;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--border-active);
}

.field-help {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
