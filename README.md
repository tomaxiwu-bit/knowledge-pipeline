<p align="center">
  <img src="docs/logo.svg" alt="知识流水线" width="120" /><br/>
  <strong>知识流水线 Knowledge Pipeline</strong><br/>
  <em>本地优先的全栈个人知识工作台</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-43-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Vue_3-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/SQLite-FTS5-003B57?logo=sqlite" alt="SQLite FTS5" />
  <img src="https://img.shields.io/badge/Chroma-Hybrid_RAG-7C3AED" alt="Chroma Hybrid RAG" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

---

## 这是什么

**知识流水线** 是一款本地优先的全栈知识工作台。它把日常知识管理的四个自然环节，以及一个可追溯的本地问答层，整合到一个界面：

```
RSS 发现 → 链接收藏 → 速记笔记 → Markdown 写作
   ①            ②            ③             ④
                                  ↓
                     SQLite FTS5 + Chroma → 有来源的知识问答
```

每个环节都有优秀的开源项目（FreshRSS、Karakeep、Memos……），但它们彼此独立，用户要在多个网页间切换、手动复制粘贴。知识流水线通过**插件化适配层**连接你自建的后端，一个界面跑完整条流水线。你的数据始终留在自己的服务器上，不被任何第三方锁定。

它的差异不在于再造一个笔记库：**探究线**保存“证据如何改变判断”的过程；**知识问答**只从你已同步的材料中取证，并把回答中的每一条结论连回原始条目。

## 核心特性

### 信息聚合

- **引导式首次配置** — 首页明确显示 RSS、收藏、速记三个核心环节的连接进度，避免空白首页造成困惑
- **三栏首页** — 左侧 RSS 未读列表、中间链接收藏、右侧速记笔记，一屏掌握全局
- **探究线（独有）** — 从一个问题出发，把 RSS/收藏材料区分为支持证据、反例或背景；沉淀自己的想法、当前判断与下一步，并导出为 Markdown 思考简报
- **全局搜索** — 一次搜索同时查询 RSS 文章、链接收藏、速记笔记三个来源，支持标签过滤
- **稍后读 + 过期清理** — 添加链接时可选 1/3/7/14/30 天后过期，到期自动从列表过滤
- **智能集合** — 保存常用搜索条件为可重复执行的虚拟视图，一键恢复关键词 + 标签过滤

### 阅读体验

- **统一阅读视图** — 阅读文章时可划重点存笔记、一键收藏、AI 生成摘要
- **文章大纲导航** — 自动提取 H1-H4 标题生成可点击大纲，滚动时高亮当前章节
- **阅读优化排版** — 衬线字体（Crimson Pro / Noto Serif SC）、1.85 行高、段落间距
- **反向链接面板** — 阅读时侧边栏实时显示当前条目被哪些笔记/收藏引用

### 写作工具

- **Markdown 编辑器** — 左右分栏实时预览，光标处插入引用笔记
- **模板系统** — 内置每日笔记/阅读笔记/会议纪要/RSS 摘要四类模板，`{{date}}` `{{title}}` 等变量自动替换
- **渲染增强** — `==高亮==` 语法、KaTeX 数学公式、Mermaid 图表、脚注引用
- **数据导出** — 一键导出 Markdown（带 YAML frontmatter）或 HTML（含内联样式）

### 知识网络

- **反向链接与关系** — 阅读时保存笔记/收藏/生成摘要自动建立 5 种类型关系（衍生/摘要/收藏/引用/相关）
- **知识图谱** — 力导向图可视化所有条目及其关系网络，节点按类型着色，双击跳转
- **层级标签系统** — 从收藏和笔记聚合标签，支持 `/` 分隔的层级标签树

### 本地知识问答（RAG）

- **全栈本地服务** — FastAPI 提供受版本化 API，SQLite 保存规范化文档和 FTS5 全文索引，Chroma 保存本地持久化向量
- **混合检索 + 重排** — 把 FTS5 关键词结果与向量近邻以 Reciprocal Rank Fusion 融合；内置轻量词法重排，可选本地 Cross-Encoder 重排
- **可追溯作答** — 每个回答都返回编号证据卡、片段摘要和原始条目入口；本地对话模型不可用时明确降级为“证据检索”而非虚构答案
- **受控同步** — 可从已连接的 RSS、收藏、速记批量建立索引，也可以从阅读页单篇入库；凭据仍只停留在 Electron 主进程

### 效率与安全

- **连接健康检查** — 设置页可一次测试全部已配置服务，并保留每个实例的状态与诊断结果
- **短期离线回退** — 成功读取的列表和文章会在本地保留 7 天；服务暂时不可达时明确标记为离线缓存，不会伪装成实时结果
- **命令面板** — `Ctrl+K` 唤起，统一入口搜索命令和内容
- **每日笔记** — 按日期组织笔记的时间线视图，日期导航 + 当日统计
- **亮/暗主题** — 一键切换，记忆选择
- **键盘快捷键** — 高频操作全覆盖
- **AI 摘要** — 支持 OpenAI 兼容接口与本地 Ollama
- **本地优先部署** — `docker compose` 可单独运行智能服务；数据库和向量索引映射到本机 `data/` 目录

<!-- 截图占位
## 截图

| 三栏首页 | 阅读视图 | 知识图谱 |
|:---------:|:-------:|:-------:|
| ![首页](docs/screenshot-home.png) | ![阅读](docs/screenshot-reader.png) | ![图谱](docs/screenshot-graph.png) |
-->

## 快速开始

### 前置条件

- Node.js >= 20.19
- Docker Desktop（推荐，用于本地知识问答服务）或 Python 3.12+
- 一个或多个已实现的自建后端（至少配一个才有内容可看）：
  - RSS：[FreshRSS](https://www.freshrss.com/)
  - 收藏：[Karakeep](https://github.com/karakeep-app/karakeep)
  - 笔记：[Memos](https://github.com/usememos/memos)
  - AI：OpenAI 兼容接口 / [Ollama](https://ollama.ai/)（可选）

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/tomaxiwu-bit/knowledge-pipeline.git
cd knowledge-pipeline

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建桌面安装包
npm run electron:build
```

当前发布配置生成 Windows NSIS 安装包。

> 国内用户如果 Electron 下载慢：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> npm install
> ```

### 启动本地知识问答服务

知识问答不需要把材料发到第三方。默认使用本机 [Ollama](https://ollama.com/) 做嵌入和作答，FastAPI、SQLite 与 Chroma 可用 Docker 一起启动：

```bash
# 1. 准备本地模型（首次下载）
ollama pull nomic-embed-text
ollama pull qwen3:4b

# 2. 配置并启动智能服务
cp server/.env.example server/.env
docker compose up --build
```

随后打开桌面应用：**设置 → 本地知识问答服务 → 测试服务**，确认连接后进入左侧 **知识问答**，点击「同步已连接来源」。也可以在任一阅读页用「🧠 加入知识库」单篇建立索引。

不使用 Docker 时，可直接运行：

```bash
python -m venv server/.venv
source server/.venv/bin/activate  # Windows: server\.venv\Scripts\activate
pip install -r server/requirements.txt
uvicorn app.main:app --app-dir server --host 127.0.0.1 --port 8787
```

> Linux Docker 用户通常可使用随附的 `host-gateway` 映射访问宿主机 Ollama；如环境不支持，请把 `OLLAMA_BASE_URL` 改成宿主机可达地址，或直接在主机运行 FastAPI。若 Ollama/嵌入模型暂不可用，SQLite FTS5 仍可索引和检索材料，但不会生成向量。

### 配置后端

1. 打开应用 → 左下角 **设置**
2. 在对应环节点击「添加后端」→ 选择类型 → 填写地址和凭据 → 测试连接
3. 同一环节可配置多个后端实例，应用按列表顺序使用已配置实例
4. 也可以使用设置页右上角的「测试全部连接」快速检查整条流水线

### 迁移与备份

设置页的「数据迁移与备份」可导出关系、智能集合、自定义模板、探究线和服务地址。备份**不会**包含 API Key、Token、密码或 RAG 索引数据；索引数据始终位于本地 `data/` 卷，可按基础设施策略单独备份。恢复到新设备后，请在设置中重新填写凭据并测试连接。发布前的完整验收步骤见 [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)。

### AI 摘要配置

| 提供商 | baseUrl | model | apiKey |
|--------|---------|-------|--------|
| OpenAI 官方 | `https://api.openai.com` | `gpt-4o-mini` | 你的 API Key |
| OpenAI 兼容服务 | 支持 `/v1/chat/completions` 的服务地址 | 按服务商文档填写 | 服务 API Key |
| 本地 Ollama | `http://localhost:11434` | `qwen2.5:7b` | 任意值（Ollama 忽略） |

### 演示视频

仓库内包含一份可直接录制的 [2–3 分钟演示脚本](docs/DEMO_SCRIPT.md)：从启动服务、同步材料、基于证据提问，到回到探究线形成判断。发布前按脚本录屏，并把公开视频或 MP4 链接替换到这里；不要把无真实功能演示的占位视频当作发布材料。

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
| AI 摘要 | `AIClient` | OpenAI 兼容 / Ollama | 专用 Azure 适配器等（待实现） |

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
- **答案边界**：没有可用本地对话模型时返回检索证据，不把摘要式猜测伪装成已验证答案

## 灵感来源

本项目系统性地学习了 10 个优秀的开源知识管理项目，借鉴其设计精华并轻量化落地：

| 轮次 | 学习项目 | 借鉴的核心设计 |
|------|---------|---------------|
| 第 1 轮 | [Glean](https://github.com/Crossl-l/glean) | 三栏布局、文章大纲、衬线字体、收藏双来源、防白屏启动 |
| 第 2 轮 | [SiYuan](https://github.com/siyuan-note/siyuan)、[Logseq](https://github.com/logseq/logseq)、[AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | 标签系统、每日笔记、命令面板 |
| 第 3 轮 | [Obsidian](https://obsidian.md)、[Joplin](https://github.com/laurent22/joplin)、[Outline](https://github.com/outline/outline) | 模板系统、KaTeX/Mermaid 渲染、数据导出 |
| 第 4 轮 | [AFFiNE](https://github.com/toeverything/AFFiNE)、[Anytype](https://github.com/anyproto/anytype-ts)、[Trilium](https://github.com/zadam/trilium) | 关系网络、知识图谱、智能集合 |

每个特性都经过「研究→提炼→轻量化实现」的流程，保持项目自身的架构简洁性。

### 0.1.2 体验与可靠性迭代

本轮围绕“连接自己的工具后，如何立刻得到可靠反馈”进行收敛，而不是照搬其它产品的功能表：

| 参考项目 | 提炼出的产品原则 | 本项目的轻量化落地 |
|---------|----------------|------------------|
| [Memos](https://github.com/usememos/memos) | 捕获入口必须足够直接 | 首页用三步进度卡把首次连接路径讲清楚 |
| [Linkwarden](https://github.com/linkwarden/linkwarden) | 收藏内容应尽量可回看、可保留 | 为读取操作增加有时限、可识别的离线缓存回退 |
| [Karakeep](https://github.com/karakeep-app/karakeep) | 链接、笔记和知识条目应能成为可检索的长期资产 | 将本地全文索引列为下一步，而不是把缓存误当成归档 |
| [AFFiNE](https://github.com/toeverything/affine) | 本地优先体验应从可用性和可见性开始 | 先实现 7 天读缓存与来源标记，后续再扩展为完整本地库 |
| [SiYuan](https://github.com/siyuan-note/siyuan) | 知识工具需要可迁移的内容边界 | 维持 Markdown 导出，并将完整备份列入路线图 |

这些参考是设计推断，不表示与上述项目存在集成、认证或功能等价关系。完整取舍见 [PRODUCT_REFINEMENT_NOTES.md](PRODUCT_REFINEMENT_NOTES.md)。

### 0.2.0：从“收集”到“形成判断”

这一版进一步研究了 [Readeck](https://readeck.org/)、[SilverBullet](https://github.com/silverbulletmd/silverbullet)、[Trilium](https://github.com/TriliumNext/trilium)、[Zotero](https://github.com/zotero/zotero) 和 [Obsidian](https://obsidian.md/)：它们分别强调可回看的网页、可编程私有知识库、大型个人知识库、研究来源管理，以及笔记间连接。

**知识流水线没有复制这些应用的文件夹、画布、插件系统或文献库。** 它的独有工作流是“探究线”：

1. 先写出一个待回答的问题，而不是先建分类；
2. 从阅读和收藏中将材料标记为支持证据、反例或背景；
3. 把自己的想法单独保存为速记，避免把来源与判断混在一起；
4. 用“当前判断 + 下一步”使收集自然通向行动；
5. 一键导出便携的 Markdown 简报，保留来源和思考过程。

它的目标不是取代任何一个后端，而是把它们之间通常丢失的**判断过程**保留在用户自己的桌面端。

### 0.3.0：从“收集”到“可验证地问答”

这一版吸收了本地优先知识工具对数据主权的坚持，也参考了现代 RAG 系统“检索、重排、引用”的可靠性边界，但没有把知识问答做成脱离工作流的聊天框。

知识流水线的独有闭环是：**材料同步 → 证据检索 → 有来源回答 → 回到阅读/探究线形成判断**。它用 SQLite 保存可审计的文本事实，用 Chroma 做语义召回，用 RRF 和本地重排减少单一检索器的盲区；如果模型不在，用户仍能看到原始证据而不是被一个看似流畅的回答误导。

## 反馈与贡献

- **Bug 反馈 / 功能建议**：请提交 [GitHub Issue](https://github.com/tomaxiwu-bit/knowledge-pipeline/issues)，选择对应标签（`bug` / `feature` / `question`）
- **邮件联系**：[tomaxiwu@gmail.com](mailto:tomaxiwu@gmail.com)
- **Pull Request**：欢迎！请先在 Issue 中讨论你的改动方案

## 路线图

- [x] 7 天只读离线回退缓存（RSS、收藏、速记；明确标记缓存来源）
- [ ] 工作流本地数据缓存（SQLite / IndexedDB）实现真正的离线可用与完整备份
- [x] SQLite FTS5 + Chroma 的本地混合检索和有来源知识问答
- [ ] 探究线的本地全文检索、可选标签和按主题的时间线
- [ ] 探究线的“证据缺口”提示（只提出问题，不替用户下结论）
- [ ] 浏览器扩展快速捕获（右键发送到知识流水线）
- [ ] 虚拟滚动（大量 RSS/笔记列表性能优化）
- [ ] 编辑器图片粘贴与附件支持
- [ ] 定时任务与自动化规则
- [ ] 数据导入/导出完整备份
- [ ] 多窗口实时同步（BroadcastChannel）

## 许可证

[MIT](LICENSE) &copy; 2025 knowledge-pipeline
