/**
 * Inquiry Threads are a pipeline-native unit of thinking. They preserve the
 * question, the selected evidence, the current interpretation, and the next
 * move rather than only displaying a network of links.
 */
export type InquirySourceType = 'rss' | 'bookmark' | 'memo'
export type InquirySourceRole = 'evidence' | 'counterpoint' | 'context' | 'reflection'

export interface InquirySource {
  id: string
  sourceType: InquirySourceType
  sourceId: string
  title: string
  url?: string
  role: InquirySourceRole
  note: string
  addedAt: string
}

export interface InquiryThread {
  id: string
  title: string
  question: string
  workingConclusion: string
  nextAction: string
  createdAt: string
  updatedAt: string
  sources: InquirySource[]
}

export const INQUIRY_ROLE_LABELS: Record<InquirySourceRole, string> = {
  evidence: '支持证据',
  counterpoint: '反例 / 保留意见',
  context: '背景材料',
  reflection: '自己的想法'
}

const SOURCE_TYPES = new Set<InquirySourceType>(['rss', 'bookmark', 'memo'])
const SOURCE_ROLES = new Set<InquirySourceRole>(['evidence', 'counterpoint', 'context', 'reflection'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Migrates persisted thread data defensively. Invalid entries are ignored,
 * allowing an app update or an edited backup to remain recoverable.
 */
export function normalizeInquiryThreads(value: unknown): InquiryThread[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  const threads: InquiryThread[] = []

  for (const candidate of value.slice(0, 100)) {
    const record = asRecord(candidate)
    const id = text(record?.id, 160)
    const title = text(record?.title, 140)
    if (!record || !id || !title || ids.has(id)) continue
    ids.add(id)

    const sourceIds = new Set<string>()
    const sources: InquirySource[] = []
    const rawSources = Array.isArray(record.sources) ? record.sources : []
    for (const rawSource of rawSources.slice(0, 200)) {
      const source = asRecord(rawSource)
      const sourceId = text(source?.id, 160)
      const sourceType = source?.sourceType
      const role = source?.role
      if (
        !source || !sourceId || sourceIds.has(sourceId) ||
        typeof sourceType !== 'string' || !SOURCE_TYPES.has(sourceType as InquirySourceType) ||
        typeof role !== 'string' || !SOURCE_ROLES.has(role as InquirySourceRole)
      ) continue
      const referencedId = text(source.sourceId, 160)
      const sourceTitle = text(source.title, 240)
      if (!referencedId || !sourceTitle) continue
      sourceIds.add(sourceId)
      sources.push({
        id: sourceId,
        sourceType: sourceType as InquirySourceType,
        sourceId: referencedId,
        title: sourceTitle,
        url: text(source.url, 2048) || undefined,
        role: role as InquirySourceRole,
        note: text(source.note, 2000),
        addedAt: text(source.addedAt, 80) || new Date().toISOString()
      })
    }

    threads.push({
      id,
      title,
      question: text(record.question, 2000),
      workingConclusion: text(record.workingConclusion, 6000),
      nextAction: text(record.nextAction, 2000),
      createdAt: text(record.createdAt, 80) || new Date().toISOString(),
      updatedAt: text(record.updatedAt, 80) || new Date().toISOString(),
      sources
    })
  }
  return threads
}

function textOrPlaceholder(value: string, placeholder: string): string {
  return value.trim() || `*${placeholder}*`
}

function safeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/([\\\[\]])/g, '\\$1')
}

function formatSource(source: InquirySource): string[] {
  const heading = `### ${INQUIRY_ROLE_LABELS[source.role]}`
  const url = safeHttpUrl(source.url)
  const reference = url
    ? `- [${escapeMarkdownLinkText(source.title)}](${url})`
    : `- ${source.title}`
  const note = source.note.trim() ? `- 说明：${source.note.trim()}` : ''
  const addedAt = `- 收入时间：${source.addedAt}`
  return [heading, reference, note, addedAt].filter(Boolean)
}

/** Build a portable Markdown brief from a question-led set of knowledge. */
export function buildInquiryBrief(thread: InquiryThread): string {
  const lines = [
    `# ${thread.title}`,
    '',
    '## 探究问题',
    textOrPlaceholder(thread.question, '尚未写下问题'),
    '',
    '## 当前判断',
    textOrPlaceholder(thread.workingConclusion, '证据仍在收集，暂不下结论'),
    '',
    '## 证据与想法'
  ]

  if (thread.sources.length === 0) {
    lines.push('*尚未加入材料*')
  } else {
    for (const source of thread.sources) {
      lines.push('', ...formatSource(source))
    }
  }

  lines.push(
    '',
    '## 下一步',
    textOrPlaceholder(thread.nextAction, '决定下一条要验证、阅读或写下的内容'),
    '',
    `> 由知识流水线的探究线导出 · 最后更新：${thread.updatedAt}`
  )

  return lines.join('\n')
}
