# 架构、接口与开发参考

[返回项目首页](../README.md) · [安装与服务配置](SETUP.md)

## 架构设计

### 插件化适配器注册表

项目最大的设计亮点 — 每个后端是一个**自注册适配器**，新增后端只需写一个文件：

```ts
// src/services/your-backend.ts
import { registerAdapter } from './registry'
import type { RSSClient } from './types'

class YourBackendClient implements RSSClient {
  // ... 实现接口
}

registerAdapter(
  { id: 'your-backend', kind: 'rss', displayName: 'Your Backend', configFields: [...] },
  () => new YourBackendClient()
)

// src/services/index.ts 里加一行
import './your-backend'
```

前端代码、设置页、搜索页会**自动识别**新后端，无需改动任何核心代码。

| 环节 | 接口 | 默认后端 | 可扩展 |
|------|------|---------|--------|
| RSS 发现 | `RSSClient` | FreshRSS | Miniflux、Tiny Tiny RSS 等（待实现） |
| 链接收藏 | `BookmarkClient` | Karakeep | Wallabag、Linkwarden 等（待实现） |
| 速记笔记 | `MemoClient` | Memos | Joplin Server、Trilium 等（待实现） |
| AI 摘要与作答 | `AIClient` | OpenAI / Codex Responses、Claude、DeepSeek、OpenAI 兼容 / Ollama | 其他专用适配器 |

### 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── index.ts       # 窗口创建 + 受限 IPC + 凭据保护 + 安全
│   └── preload.ts     # 预加载脚本（contextBridge）
├── renderer/          # Vue 3 渲染进程
│   ├── components/    # 组件
│   │   ├── SidebarNav.vue       # 侧栏导航
│   │   ├── PanelLayout.vue      # 面板公共布局
│   │   ├── ArticleOutline.vue   # 文章大纲导航
│   │   ├── CommandPalette.vue   # 全局命令面板
│   │   ├── TagFilter.vue        # 标签过滤器
│   │   ├── TagTreeNode.vue      # 标签树递归节点
│   │   ├── BacklinkPanel.vue    # 反向链接面板
│   │   ├── TemplatePicker.vue   # 模板选择器
│   │   ├── RSSPanel.vue
│   │   ├── BookmarkPanel.vue    # 收藏 + 稍后读
│   │   └── NotesPanel.vue
│   ├── views/         # 页面视图
│   │   ├── HomeView.vue         # 三栏首页
│   │   ├── SearchView.vue       # 全局搜索 + 标签 + 智能集合
│   │   ├── DailyView.vue        # 每日笔记
│   │   ├── GraphView.vue        # 知识图谱
│   │   ├── ReaderView.vue       # 阅读 + AI + 划重点 + 反向链接
│   │   ├── EditorView.vue       # Markdown 编辑器
│   │   └── SettingsView.vue     # 动态后端管理
│   ├── stores/        # Pinia 状态管理
│   │   ├── settings.ts          # 设置 + 主题 + 客户端管理
│   │   ├── search.ts            # 跨源搜索
│   │   ├── tags.ts              # 标签聚合 + 层级树
│   │   ├── relations.ts         # 关系存储 + 反向链接
│   │   ├── savedSearches.ts     # 智能集合
│   │   └── templates.ts         # 模板系统
│   ├── composables/   # 组合式函数
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useCommandRegistry.ts
│   └── styles/        # 全局样式（CSS 变量 + 亮/暗主题）
├── lib/              # 纯逻辑库（零 Vue 依赖，可独立测试）
│   ├── markdown.ts             # Markdown 渲染引擎（marked + KaTeX + Mermaid）
│   ├── export.ts               # 数据导出（MD + HTML + frontmatter）
│   └── graph.ts                # 力导向布局算法（零依赖自研）
└── services/          # API 适配层（插件化）
    ├── types.ts       # TypeScript 接口契约
    ├── registry.ts    # 适配器注册表
    ├── index.ts       # 统一入口
    ├── freshrss.ts    # FreshRSS 适配器
    ├── karakeep.ts    # Karakeep 适配器
    ├── memos.ts       # Memos 适配器
    └── ai.ts          # AI 摘要适配器（OpenAI 兼容）
server/
├── app/
│   ├── main.py         # FastAPI 路由与健康检查
│   ├── storage.py      # SQLite 文档库 + FTS5
│   ├── vector.py       # Chroma 持久化向量适配器
│   ├── retrieval.py    # RRF 混合检索 + 可选本地重排
│   └── service.py      # 入库、检索与有来源作答
├── tests/              # 纯逻辑检索/分块测试
└── Dockerfile
data/                   # 运行时 SQLite + Chroma 数据（默认忽略，不入库）
```

### 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | Electron 30 + Vue 3 + TypeScript | 跨平台桌面 + 响应式 UI |
| 状态 | Pinia + Vue Router | 全局状态 + SPA 路由 |
| 渲染 | marked + KaTeX + Mermaid + DOMPurify | Markdown + 数学 + 图表 + 安全 |
| 工作流设置 | electron-store + OS 安全存储 | 主题、服务元数据；凭据不离开主进程 |
| 知识库 | FastAPI + SQLite FTS5 + Chroma | 正文块、关键词检索、持久化向量 |
| 本地模型 | Ollama | 嵌入、基于检索证据的作答 |

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + K` | 命令面板（搜索命令 + 内容） |
| `Ctrl/Cmd + 1~5` | 切换页面（首页/搜索/写作/设置/图谱） |
| `Ctrl/Cmd + D` | 今日笔记 |
| `Ctrl/Cmd + N` | 新建笔记 |
| `Esc` | 返回 / 关闭面板 |

## 安全设计

- **进程隔离**：`contextIsolation: true` + `nodeIntegration: false` + sandbox
- **网络安全**：后端请求只在主进程执行，不需要关闭或绕过浏览器 CORS
- **内容安全**：Markdown、Mermaid SVG 和 HTML 导出均经 DOMPurify 过滤；Mermaid 使用严格安全模式
- **数据安全**：服务元数据与 API Key 分离；凭据使用操作系统安全存储加密，安全存储不可用时拒绝保存新凭据
- **备份边界**：本地备份可迁移工作流元数据，但会主动剔除 API Key、Token 与密码；恢复后的凭据必须重新配置
- **链接安全**：`setWindowOpenHandler` 和 `will-navigate` 只放行 `http/https` 外部链接，拦截 `file://`、`javascript:` 等危险协议
- **导航拦截**：`will-navigate` 阻止应用内跳转到外部域名，自动转交系统浏览器
- **启动安全**：窗口 `show: false` + `ready-to-show` + 5 秒超时兜底
- **RAG 边界**：桌面端只允许连接 `127.0.0.1` / `localhost` 本地智能服务；所有 RAG 请求由主进程验证字段、限时并代理
- **FTS 边界**：用户查询先被拆成长度受限的允许词元，再由服务器拼接固定的 FTS5 语法并以参数绑定传入 SQLite；不会将原始 MATCH 语法交给 FTS5 解析
- **配置边界**：`.env` 中的未知键会令服务启动失败，防止拼写错误静默回退到默认模型、目录或地址

## 配置参考

所有运行时配置通过环境变量设置（默认值开箱即用）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama 服务地址 |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | 嵌入模型名称 |
| `OLLAMA_CHAT_MODEL` | `qwen3:4b` | 对话模型名称 |
| `RERANKER_MODE` | `lexical` | 重排模式：`lexical`（内置词法，零依赖）或 `cross_encoder` |
| `RERANKER_MODEL` | `BAAI/bge-reranker-base` | Cross-Encoder 模型（仅在 `cross_encoder` 模式使用） |
| `REQUEST_TIMEOUT_SECONDS` | `60.0` | Ollama 请求超时秒数 |
| `APP_DATA_DIR` | `./data` | SQLite + Chroma 数据存储目录 |

> 未知变量会导致启动失败（`extra='forbid'`），防止拼写错误静默回退。

## API 文档

智能服务启动后，自动交互式文档可在 `http://localhost:8787/docs` 查看。以下为主要端点：

### `GET /health`
服务健康检查，返回各组件状态、文档/向量计数。

### `POST /api/v1/knowledge/documents`
入库一篇文章（分块 + 向量化）。
**请求体**：
```json
{
  "source_type": "rss",
  "source_id": "entry-123",
  "title": "文章标题",
  "url": "https://example.com/article",
  "tags": ["tech", "AI"],
  "content": "文章正文内容……"
}
```

### `DELETE /api/v1/knowledge/documents/{document_id}`
删除文档及其所有分块和向量。`document_id` 须匹配 `doc_[a-f0-9]{24}` 格式。

### `POST /api/v1/knowledge/search`
混合检索（FTS5 + 向量语义 + RRF 融合），返回匹配分块。
**请求体**：
```json
{
  "query": "搜索关键词",
  "limit": 10
}
```

### `POST /api/v1/knowledge/ask`
基于检索证据生成有来源回答。Ollama 不可用时降级为纯证据检索。
**请求体**：
```json
{
  "query": "你的问题",
  "limit": 10,
  "include_context": true
}
```
