import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, createBackup, parseBackup } from '../src/lib/backup'

describe('local backups', () => {
  const local = { relations: [], savedSearches: [], customTemplates: [], inquiryThreads: [] }

  it('removes credentials while retaining service metadata', () => {
    const backup = createBackup({
      theme: 'dark',
      services: [{
        id: 'svc-rss', name: 'My FreshRSS', kind: 'rss', clientId: 'freshrss',
        config: { baseUrl: 'https://rss.example.com', apiKey: 'should-not-export', token: 'also-not-export' }
      }],
      rag: { baseUrl: 'http://localhost:8787' },
      local
    })

    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.settings.services[0].config).toEqual({ baseUrl: 'https://rss.example.com' })
    expect(backup.settings.rag).toEqual({ baseUrl: 'http://localhost:8787' })
    expect(JSON.stringify(backup)).not.toContain('should-not-export')
  })

  it('accepts a valid backup and rejects unsupported shapes', () => {
    const backup = createBackup({ theme: 'light', services: [], local })

    expect(parseBackup(backup).settings.theme).toBe('light')
    expect(parseBackup(backup).settings.rag).toEqual({ baseUrl: 'http://127.0.0.1:8787' })
    expect(() => parseBackup({ format: BACKUP_FORMAT, version: 99 })).toThrow('不是受支持的知识流水线备份文件')
  })
})
