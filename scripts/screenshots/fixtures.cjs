/**
 * 截图用的虚构演示数据。
 *
 * 这里的标题、正文、笔记与关系全部为演示编写，与任何真实用户的订阅或
 * 收藏无关。修改这里即可调整 README 截图里出现的内容。
 */

const PORT = 4787
const ORIGIN = `http://127.0.0.1:${PORT}`

const feeds = [
  { id: 'feed-1', title: '少数派' },
  { id: 'feed-2', title: 'Research Log' },
  { id: 'feed-3', title: '技术笔记' }
]

const body = (paragraphs) => paragraphs.map((text) => `<p>${text}</p>`).join('')

const rssItems = [
    {
    id: 'demo-rss-1',
    title: '本地优先的笔记系统，为什么又被重新讨论',
    feedTitle: '少数派',
    author: '编辑组',
    publishedAt: '2026-11-18T09:10:00+08:00',
    summary: '云端笔记把同步做成了默认能力，也把导出、迁移和长期可读性变成了附加项。',
    content: `<h2>同步不是全部</h2>${body([
      '过去几年，笔记工具竞争的重点是同步速度与协作体验。但当材料积累到一定规模，用户开始关心另一组问题：文件存在哪里、能导出成什么格式、服务停止后还能不能读。',
      '本地优先并不意味着拒绝云，而是把本地副本当作事实来源，云端承担同步与备份。这样做的直接好处是检索、备份和迁移都可以在自己掌握的环境里完成。',
      '代价也很明确：索引、备份、冲突处理都要自己承担一部分，工具必须把这些环节做得足够可见。'
    ])}<h2>真正的门槛在迁移</h2>${body([
      '一个笔记系统是否可靠，往往不是看第一次导入有多顺，而是看第三次迁移是否还能保持结构。标签层级、双向链接、附件路径，任何一项丢失都会让旧材料变成一次性内容。'
    ])}`
  },
  {
    id: 'demo-rss-2',
    title: '检索质量的上限，由切分方式决定',
    feedTitle: 'Research Log',
    author: '维护者',
    publishedAt: '2026-11-16T21:30:00+08:00',
    summary: '重排只能锦上添花；切分粒度错了，后面的模型再强也补不回来。',
    content: `<h2>切分先于模型</h2>${body([
      '检索链路的顺序是切分、索引、召回、重排、生成。很多人把注意力放在最后的生成模型上，但决定能不能召回的是最前面的切分。',
      '如果一段材料被切成跨越两个论点的片段，向量会落在两个主题之间，关键词也会被稀释，这类片段在任何排序下都很难排到前面。',
      '对个人知识库而言，按段落与小标题切分通常比固定字符长度更稳，代价是片段长度不均，需要索引时记录层级信息。'
    ])}<h2>小语料的表现不同</h2>${body([
      '材料规模只有几十到几百篇时，语料的分布不足以训练出可靠的向量空间，同义表述的召回优势并不明显，专有名词反而更依赖精确匹配。',
      '因此小语料更合理的配置是关键词检索作为基线，向量检索用来补召回，最后加一层轻量重排，而不是直接用向量替换全文索引。',
      '这套配置的代价是两条链路都要维护：全文索引需要处理分词与中文短语，向量索引需要处理嵌入模型版本变化后的重建。维护成本应当在动手之前就算清楚。'
    ])}`
  },
  {
    id: 'demo-rss-3',
    title: '把读过的文章变成可核对的证据',
    feedTitle: '技术笔记',
    author: '维护者',
    publishedAt: '2026-11-15T08:05:00+08:00',
    summary: '阅读记录只有带上来源、片段和判断，才能在写作时被真正引用。',
    content: `<h2>三层记录</h2>${body([
      '第一层是原文入口：标题、链接、抓取时间。第二层是片段：真正支撑判断的那几句话，而不是整篇文章。第三层是自己的标注：为什么这段话重要，它支持还是反驳当前结论。',
      '缺少第三层时，收藏会退化成待办清单：数量在增长，理解没有增加。'
    ])}<h2>引用的可核对性</h2>${body([
      '一条可核对的引用需要能回到原文的确定位置。只保留摘要的引用在几个月后往往无法验证，因为摘要本身就是解释。',
      '所以证据卡片应同时保存原文片段与出处链接，并允许在原文更新后标记过期。'
    ])}`
  },
  {
    id: 'demo-rss-4',
    title: '全云笔记的便利与代价',
    feedTitle: '少数派',
    author: '编辑组',
    publishedAt: '2026-11-13T19:40:00+08:00',
    summary: '搜索和协作体验确实领先，但导出能力长期停留在能把文字拿出来的程度。',
    content: `<h2>领先的部分</h2>${body([
      '云端服务的索引规模、搜索排序与移动端体验通常明显好于自建方案，跨设备一致性也几乎不需要维护。',
      '对多数用户来说，这些优势足以抵消可迁移性的损失，尤其是在材料量还小的时候。'
    ])}<h2>代价的部分</h2>${body([
      '导出通常是纯文本或单层 HTML，标签层级、链接关系、附件结构会在这条路径上退化。一旦决定迁移，实际成本远高于界面上看到的“导出”按钮。',
      '一个折中做法是：日常使用云端工具，同时把关键材料定期落到本地文本，保留结构和出处。'
    ])}`
  },
  {
    id: 'demo-rss-5',
    title: '小语料里，重排到底值不值',
    feedTitle: 'Research Log',
    author: '维护者',
    publishedAt: '2026-11-11T12:20:00+08:00',
    summary: '在几十篇材料的规模上，重排带来的提升常常小于切分和查询改写带来的提升。',
    content: `<h2>先量化再优化</h2>${body([
      '重排模型的作用是把候选里真正相关的片段排到前面。它依赖候选集合本身包含正确答案，如果召回阶段漏掉了，重排无能为力。',
      '在小语料上做过一组对比：同一批问题，改动切分方式带来的首位命中率变化，明显大于替换重排模型。'
    ])}<h2>成本</h2>${body([
      '重排会引入额外的延迟与模型依赖，对本机部署意味着常驻内存和首次加载时间。只有在候选质量已经稳定之后，这笔开销才值得支付。'
    ])}`
  },
  {
    id: 'demo-rss-6',
    title: '离线优先不等于数据主权',
    feedTitle: '技术笔记',
    author: '维护者',
    publishedAt: '2026-11-09T07:55:00+08:00',
    summary: '能离线打开，和能完整取回结构，是两件不同的事。',
    content: `<h2>两个容易混淆的概念</h2>${body([
      '离线优先描述的是可用性：没有网络时仍能读写。数据主权描述的是控制权：能完整导出、能在别处重建、能不依赖原服务继续使用。',
      '一个应用可以完全离线运行，同时把数据存在专有格式的单一文件里，这种情况下数据主权仍然是缺失的。'
    ])}<h2>可检验的指标</h2>${body([
      '判断控制权最直接的方式是做一次完整迁移演练：导出、在另一个工具导入、核对条目数量、标签与链接关系。演练失败说明备份只是心理安慰。'
    ])}`
  }
]

const bookmarks = [
  {
    id: 'demo-bm-1',
    title: '卡片盒笔记法的三个常见误解',
    url: 'https://example.org/notes/zettelkasten-misreadings',
    description: '把卡片盒当成收藏夹、把编号当成分类法、把数量当成进展。',
    tags: ['#笔记方法', '#阅读'],
    createdAt: '2026-11-17T10:12:00+08:00'
  },
  {
    id: 'demo-bm-2',
    title: 'SQLite FTS5 与向量检索的分工',
    url: 'https://example.org/tech/fts5-and-vectors',
    description: '全文索引负责精确匹配与短语，向量索引负责同义表述，融合排序需要归一化分数。',
    tags: ['#检索', '#SQLite'],
    createdAt: '2026-11-16T22:40:00+08:00'
  },
  {
    id: 'demo-bm-3',
    title: '自托管 Memos 的备份策略',
    url: 'https://example.org/selfhost/memos-backup',
    description: '数据库快照加附件目录，两者必须同时保留，否则恢复后图片全部失效。',
    tags: ['#自托管', '#备份'],
    createdAt: '2026-11-14T16:05:00+08:00'
  },
  {
    id: 'demo-bm-4',
    title: '证据卡片界面设计记录',
    url: 'https://example.org/design/evidence-card',
    description: '卡片需要同时容纳原文片段、出处与自己的判断，三者缺一就会退化成摘要。',
    tags: ['#设计', '#写作'],
    createdAt: '2026-11-12T09:30:00+08:00'
  },
  {
    id: 'demo-bm-5',
    title: '本地优先软件清单',
    url: 'https://example.org/lists/local-first-tools',
    description: '按存储格式、导出能力、同步方式三个维度整理的一份清单。',
    tags: ['#本地优先', '#工具'],
    createdAt: '2026-11-08T20:15:00+08:00'
  }
]

const memos = [
  {
    id: 'demo-memo-1',
    content: '#阅读 全云笔记的搜索确实强，但导出永远是二等公民。真正的成本在第三次迁移时才出现。',
    createdAt: '2026-11-18T11:20:00+08:00',
    pinned: true
  },
  {
    id: 'demo-memo-2',
    content: '#想法 检索的尽头是重排，重排的尽头是判断力。工具能给出候选，选不选得对还是自己的事。',
    createdAt: '2026-11-17T09:05:00+08:00',
    pinned: false
  },
  {
    id: 'demo-memo-3',
    content: '#待验证 小语料下向量检索的召回是否真的优于 BM25？二十个问题对比一下，记录漏召回的类型。',
    createdAt: '2026-11-16T23:50:00+08:00',
    pinned: false
  },
  {
    id: 'demo-memo-4',
    content: '#摘录 收藏只是把理解延迟，不是完成了理解。',
    createdAt: '2026-11-10T08:40:00+08:00',
    pinned: false
  }
]

const relations = [
  {
    id: 'rel-1',
    sourceType: 'memo', sourceId: 'demo-memo-2', sourceTitle: '#想法 检索的尽头是重排',
    targetType: 'rss', targetId: 'demo-rss-2', targetTitle: '检索质量的上限',
    kind: 'derived-from', createdAt: '2026-11-17T09:08:00+08:00'
  },
  {
    id: 'rel-2',
    sourceType: 'rss', sourceId: 'demo-rss-2', sourceTitle: '检索质量的上限',
    targetType: 'bookmark', targetId: 'demo-bm-2', targetTitle: 'FTS5 与向量检索',
    kind: 'related-to', createdAt: '2026-11-16T22:45:00+08:00'
  },
  {
    id: 'rel-3',
    sourceType: 'memo', sourceId: 'demo-memo-3', sourceTitle: '#待验证 向量检索召回',
    targetType: 'rss', targetId: 'demo-rss-2', targetTitle: '检索质量的上限',
    kind: 'references', createdAt: '2026-11-16T23:52:00+08:00'
  },
  {
    id: 'rel-4',
    sourceType: 'memo', sourceId: 'demo-memo-1', sourceTitle: '#阅读 云端导出是二等公民',
    targetType: 'rss', targetId: 'demo-rss-4', targetTitle: '全云笔记的代价',
    kind: 'derived-from', createdAt: '2026-11-18T11:22:00+08:00'
  },
  {
    id: 'rel-5',
    sourceType: 'rss', sourceId: 'demo-rss-3', sourceTitle: '把阅读变成证据',
    targetType: 'bookmark', targetId: 'demo-bm-4', targetTitle: '证据卡片设计',
    kind: 'references', createdAt: '2026-11-15T08:20:00+08:00'
  },
  {
    id: 'rel-6',
    sourceType: 'bookmark', sourceId: 'demo-bm-4', sourceTitle: '证据卡片设计',
    targetType: 'bookmark', targetId: 'demo-bm-2', targetTitle: 'FTS5 与向量检索',
    kind: 'related-to', createdAt: '2026-11-15T08:25:00+08:00'
  },
  {
    id: 'rel-7',
    sourceType: 'bookmark', sourceId: 'demo-bm-2', sourceTitle: 'FTS5 与向量检索',
    targetType: 'memo', targetId: 'demo-memo-3', targetTitle: '#待验证 向量检索召回',
    kind: 'related-to', createdAt: '2026-11-16T22:50:00+08:00'
  }
]

const inquiryThreads = [
  {
    id: 'inquiry-demo-1',
    title: '小语料下，向量检索是否真的优于关键词检索？',
    question: '在一个只有几十篇材料的个人知识库里，向量检索的召回是否稳定超过 FTS5/BM25？我的材料规模是否根本不足以体现向量检索的优势？',
    workingConclusion: '从手头材料看，两种检索在小语料上的差距并不稳定：向量检索更容易召回同义表述，但在专有名词、缩写和精确短语上反而更弱。更可能的结论是保留全文索引作为基线，用向量检索补召回，再加一层轻量重排，而不是二选一。',
    nextAction: '用同一组 20 个问题，分别跑纯关键词、纯向量和融合三种配置，记录漏召回属于哪一类：同义表述、专有名词、跨段落论点。',
    createdAt: '2026-11-16T23:58:00+08:00',
    updatedAt: '2026-11-18T12:04:00+08:00',
    sources: [
      {
        id: 'source-demo-1',
        sourceType: 'rss',
        sourceId: 'demo-rss-2',
        title: '检索质量的上限，由切分方式决定',
        url: `${ORIGIN}/freshrss/demo/demo-rss-2`,
        role: 'evidence',
        note: '明确指出小语料上向量空间不可靠，专有名词更依赖精确匹配。',
        addedAt: '2026-11-17T00:02:00+08:00'
      },
      {
        id: 'source-demo-2',
        sourceType: 'rss',
        sourceId: 'demo-rss-5',
        title: '小语料里，重排到底值不值',
        url: `${ORIGIN}/freshrss/demo/demo-rss-5`,
        role: 'counterpoint',
        note: '反例：真正带来提升的是切分与查询改写，重排的边际收益有限。',
        addedAt: '2026-11-17T00:05:00+08:00'
      },
      {
        id: 'source-demo-3',
        sourceType: 'bookmark',
        sourceId: 'demo-bm-2',
        title: 'SQLite FTS5 与向量检索的分工',
        url: `${ORIGIN}/karakeep/demo/demo-bm-2`,
        role: 'context',
        note: '融合排序需要先做分数归一化，否则两路结果不可比。',
        addedAt: '2026-11-17T00:09:00+08:00'
      },
      {
        id: 'source-demo-4',
        sourceType: 'memo',
        sourceId: 'demo-memo-3',
        title: '#待验证 小语料下向量检索的召回是否真的优于 BM25？',
        role: 'reflection',
        note: '我自己的验证计划：二十个问题，记录漏召回类型。',
        addedAt: '2026-11-17T00:11:00+08:00'
      }
    ]
  }
]

const ragDocuments = [
  {
    source_type: 'rss',
    source_id: 'demo-rss-2',
    title: '检索质量的上限，由切分方式决定',
    content: '检索链路的顺序是切分、索引、召回、重排、生成。决定能不能召回的是切分。小语料上向量空间不可靠，专有名词更依赖精确匹配。',
    url: `${ORIGIN}/freshrss/demo/demo-rss-2`,
    tags: ['Research Log']
  }
]

const citations = [
  {
    index: 1,
    chunk_id: 'demo-chunk-1',
    document_id: 'doc_0123456789abcdef01234567',
    source_type: 'rss',
    source_id: 'demo-rss-2',
    title: '检索质量的上限，由切分方式决定',
    url: `${ORIGIN}/freshrss/demo/demo-rss-2`,
    excerpt: '小语料上向量空间不可靠，专有名词更依赖精确匹配；更合理的配置是关键词检索作为基线，向量检索用来补召回。',
    score: 0.82
  },
  {
    index: 2,
    chunk_id: 'demo-chunk-2',
    document_id: 'doc_abcdef0123456789abcdef01',
    source_type: 'bookmark',
    source_id: 'demo-bm-2',
    title: 'SQLite FTS5 与向量检索的分工',
    url: `${ORIGIN}/karakeep/demo/demo-bm-2`,
    excerpt: '全文索引负责精确匹配与短语，向量索引负责同义表述，融合排序需要归一化分数。',
    score: 0.74
  },
  {
    index: 3,
    chunk_id: 'demo-chunk-3',
    document_id: 'doc_0123456789abcdef01234568',
    source_type: 'rss',
    source_id: 'demo-rss-4',
    title: '全云笔记的便利与代价',
    url: `${ORIGIN}/freshrss/demo/demo-rss-4`,
    excerpt: '导出通常是纯文本或单层 HTML，标签层级、链接关系、附件结构会在这条路径上退化。',
    score: 0.69
  },
  {
    index: 4,
    chunk_id: 'demo-chunk-4',
    document_id: 'doc_0123456789abcdef01234569',
    source_type: 'rss',
    source_id: 'demo-rss-5',
    title: '小语料里，重排到底值不值',
    url: `${ORIGIN}/freshrss/demo/demo-rss-5`,
    excerpt: '在几十篇材料的规模上，改动切分方式带来的首位命中率变化，明显大于替换重排模型。',
    score: 0.63
  }
]

const retrieval = { keyword_candidates: 14, vector_candidates: 22, reranker: 'local-cross-encoder' }

const demoQuestion = '我的材料里，本地检索和云端检索各自的问题是什么？'

const demoAnswer = [
  '材料里的共识是：云端检索的强项在于索引规模与开箱即用的排序质量 [1][2]，代价是原文导出与长期可迁移性始终是次要能力 [3]。',
  '本地检索的优势是数据不出机器、可以离线复核 [2]，但在小语料上向量召回并不稳定，精确短语和专有名词反而更依赖关键词检索 [1]。因此更稳妥的做法是保留全文索引作为基线，把向量检索当作召回补充，再加一层轻量重排 [1][4]。'
].join('\n')

const ragHealth = {
  status: 'ok',
  storage: { documents: 15, chunks: 46 },
  vectors: 46,
  reranker_mode: 'local-cross-encoder'
}

const services = [
  {
    id: 'demo-freshrss',
    name: 'FreshRSS · 本地实例',
    kind: 'rss',
    clientId: 'freshrss',
    config: { baseUrl: `${ORIGIN}/freshrss`, apiKey: 'demo-freshrss-token' }
  },
  {
    id: 'demo-karakeep',
    name: 'Karakeep · 本地实例',
    kind: 'bookmark',
    clientId: 'karakeep',
    config: { baseUrl: `${ORIGIN}/karakeep`, apiKey: 'demo-karakeep-token' }
  },
  {
    id: 'demo-memos',
    name: 'Memos · 本地实例',
    kind: 'memo',
    clientId: 'memos',
    config: { baseUrl: `${ORIGIN}/memos`, apiKey: 'demo-memos-token' }
  },
  {
    id: 'demo-ai',
    name: '本地 Ollama · qwen2.5',
    kind: 'ai',
    clientId: 'openai',
    config: {
      baseUrl: `${ORIGIN}/ai`,
      apiKey: 'demo-local-model',
      model: 'qwen2.5:7b-instruct'
    }
  }
]

module.exports = {
  PORT,
  ORIGIN,
  feeds,
  rssItems,
  bookmarks,
  memos,
  relations,
  inquiryThreads,
  ragDocuments,
  ragHealth,
  citations,
  retrieval,
  demoQuestion,
  demoAnswer,
  services
}
