import { describe, expect, it } from 'vitest'
import { buildInquiryBrief, normalizeInquiryThreads, type InquiryThread } from '../src/lib/inquiry'

describe('buildInquiryBrief', () => {
  it('keeps the question, source role, provenance and next move together', () => {
    const thread: InquiryThread = {
      id: 'inquiry-1',
      title: '缓存是否应该默认开启？',
      question: '离线回退如何不掩盖陈旧数据？',
      workingConclusion: '只在实时请求失败后使用缓存。',
      nextAction: '验证缓存时间戳是否足够明显。',
      createdAt: '2026-07-18T10:00:00.000Z',
      updatedAt: '2026-07-18T10:05:00.000Z',
      sources: [{
        id: 'source-1',
        sourceType: 'rss',
        sourceId: 'rss-1',
        title: 'Offline-first UI patterns',
        url: 'https://example.com/offline',
        role: 'counterpoint',
        note: '要显示数据的年龄。',
        addedAt: '2026-07-18T10:03:00.000Z'
      }]
    }

    const brief = buildInquiryBrief(thread)

    expect(brief).toContain('## 探究问题')
    expect(brief).toContain('反例 / 保留意见')
    expect(brief).toContain('[Offline-first UI patterns](https://example.com/offline)')
    expect(brief).toContain('## 下一步')
  })

  it('does not place unsafe source protocols into an exported link', () => {
    const brief = buildInquiryBrief({
      id: 'inquiry-2', title: '安全导出', question: '', workingConclusion: '', nextAction: '',
      createdAt: '2026-07-18T10:00:00.000Z', updatedAt: '2026-07-18T10:00:00.000Z',
      sources: [{
        id: 'source-2', sourceType: 'bookmark', sourceId: 'bookmark-1', title: '不安全链接',
        url: 'javascript:alert(1)', role: 'context', note: '', addedAt: '2026-07-18T10:00:00.000Z'
      }]
    })

    expect(brief).toContain('- 不安全链接')
    expect(brief).not.toContain('javascript:')
  })

  it('drops malformed persisted entries while retaining valid thread data', () => {
    const threads = normalizeInquiryThreads([
      { id: 'valid', title: '有效探究线', sources: [] },
      { id: 'missing-title', sources: [] },
      { id: 'valid', title: '重复 ID', sources: [] }
    ])

    expect(threads).toHaveLength(1)
    expect(threads[0].title).toBe('有效探究线')
  })
})
