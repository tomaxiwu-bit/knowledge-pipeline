// 关系与反向链接 Store
// 借鉴 Anytype 的 Relation 一等公民设计 + Trilium 的 Inverse Relation 自动维护
// 跨适配器建立知识条目间的连接，支持反向链接查询

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/** 条目类型（跨适配器统一） */
export type ItemType = 'rss' | 'bookmark' | 'memo' | 'note' | 'ai-summary'

/** 关系类型 */
export type RelationKind =
  | 'references'    // 引用（A 引用了 B）
  | 'summarizes'    // 摘要（A 是 B 的摘要）
  | 'derived-from'  // 衍生（A 从 B 衍生而来，如笔记来自文章）
  | 'related-to'    // 相关（A 与 B 主题相关）
  | 'bookmark-of'   // 收藏（A 收藏了 B）

/** 一条关系记录 */
export interface Relation {
  id: string
  sourceType: ItemType
  sourceId: string
  sourceTitle: string
  targetType: ItemType
  targetId: string
  targetTitle: string
  kind: RelationKind
  createdAt: string
}

/** 反向关系名称映射（借鉴 Trilium 的 Inverse Relation） */
const INVERSE_NAMES: Record<RelationKind, string> = {
  'references': '被引用',
  'summarizes': '被摘要',
  'derived-from': '衍生出',
  'related-to': '相关',
  'bookmark-of': '被收藏'
}

/** 关系类型的中文标签 */
const KIND_LABELS: Record<RelationKind, string> = {
  'references': '引用',
  'summarizes': '摘要',
  'derived-from': '衍生自',
  'related-to': '相关',
  'bookmark-of': '收藏了'
}

export interface BacklinkEntry {
  relation: Relation
  fromType: ItemType
  fromId: string
  fromTitle: string
  kindLabel: string
  inverseLabel: string
}

export const useRelationStore = defineStore('relations', () => {
  const relations = ref<Relation[]>([])
  const loaded = ref(false)

  /** 从 electron-store 加载 */
  async function load() {
    if (loaded.value) return
    try {
      const data = await window.kpAPI.settings.get('relations')
      if (Array.isArray(data)) {
        relations.value = data
      }
      loaded.value = true
    } catch (e) {
      console.error('加载关系失败', e)
    }
  }

  /** 持久化到 electron-store */
  async function persist() {
    try {
      await window.kpAPI.settings.set('relations', relations.value)
    } catch (e) {
      console.error('保存关系失败', e)
    }
  }

  /** 生成唯一 ID */
  function genId(): string {
    return `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** 添加一条关系（自动去重） */
  async function addRelation(params: {
    sourceType: ItemType
    sourceId: string
    sourceTitle: string
    targetType: ItemType
    targetId: string
    targetTitle: string
    kind: RelationKind
  }): Promise<string> {
    // 去重：相同 source + target + kind 不重复添加
    const exists = relations.value.find(
      (r) =>
        r.sourceId === params.sourceId &&
        r.targetId === params.targetId &&
        r.kind === params.kind
    )
    if (exists) return exists.id

    const rel: Relation = {
      id: genId(),
      ...params,
      createdAt: new Date().toISOString()
    }
    relations.value.push(rel)
    await persist()
    return rel.id
  }

  /** 删除一条关系 */
  async function removeRelation(id: string) {
    relations.value = relations.value.filter((r) => r.id !== id)
    await persist()
  }

  /** 删除与某个条目相关的所有关系 */
  async function removeRelationsForItem(itemId: string) {
    relations.value = relations.value.filter(
      (r) => r.sourceId !== itemId && r.targetId !== itemId
    )
    await persist()
  }

  /** 获取某个条目的反向链接（谁指向了它） */
  const getBacklinks = computed(() => {
    return (itemId: string): BacklinkEntry[] => {
      return relations.value
        .filter((r) => r.targetId === itemId)
        .map((r) => ({
          relation: r,
          fromType: r.sourceType,
          fromId: r.sourceId,
          fromTitle: r.sourceTitle,
          kindLabel: KIND_LABELS[r.kind] || r.kind,
          inverseLabel: INVERSE_NAMES[r.kind] || ''
        }))
    }
  })

  /** 获取某个条目的正向链接（它指向了谁） */
  const getForwardLinks = computed(() => {
    return (itemId: string): Relation[] => {
      return relations.value.filter((r) => r.sourceId === itemId)
    }
  })

  /** 获取与某个条目相关的所有关系（正向 + 反向） */
  const getAllLinks = computed(() => {
    return (itemId: string): Relation[] => {
      return relations.value.filter(
        (r) => r.sourceId === itemId || r.targetId === itemId
      )
    }
  })

  /** 获取所有有关系的条目 ID 集合（用于图谱视图） */
  const connectedItemIds = computed(() => {
    const ids = new Set<string>()
    for (const r of relations.value) {
      ids.add(r.sourceId)
      ids.add(r.targetId)
    }
    return ids
  })

  /** 关系总数 */
  const relationCount = computed(() => relations.value.length)

  /** 获取关系的中文标签 */
  function getKindLabel(kind: RelationKind): string {
    return KIND_LABELS[kind] || kind
  }

  /** 获取反向关系的中文标签 */
  function getInverseLabel(kind: RelationKind): string {
    return INVERSE_NAMES[kind] || ''
  }

  return {
    relations,
    loaded,
    relationCount,
    connectedItemIds,
    getBacklinks,
    getForwardLinks,
    getAllLinks,
    load,
    addRelation,
    removeRelation,
    removeRelationsForItem,
    getKindLabel,
    getInverseLabel
  }
})
