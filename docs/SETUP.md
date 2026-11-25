# 安装与服务配置

### 前置条件

- Node.js >= 20.19
- Docker Desktop（容器运行本地知识问答服务），或 [uv](https://docs.astral.sh/uv/getting-started/installation/) 与 Python 3.12（本机运行该服务）
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
> ```powershell
> $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
> npm install
> ```

### 启动本地知识问答服务

未配置云端 AI API 时，知识问答默认使用本机 [Ollama](https://ollama.com/) 做嵌入和作答。配置 API 后，问题与检索片段会发送到所选服务商，本地索引仍由 FastAPI、SQLite 与 Chroma 维护；本地服务可用 Docker 一起启动：

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
cd server
uv sync --locked --group test
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8787
```

> `server/uv.lock` 是受版本控制的完整依赖图；`requirements.txt` 由它导出供 Docker 构建使用。Linux Docker 用户通常可使用随附的 `host-gateway` 映射访问宿主机 Ollama；如环境不支持，请把 `OLLAMA_BASE_URL` 改成宿主机可达地址，或直接在主机运行 FastAPI。若 Ollama/嵌入模型暂不可用，SQLite FTS5 仍可索引和检索材料，但不会生成向量。要启用本地 Cross-Encoder 重排，请运行 `uv sync --locked --group rerank`，然后设置 `RERANKER_MODE=cross_encoder`。

### 配置后端

1. 打开应用 → 左下角 **设置**
2. 在对应环节点击「添加后端」→ 选择类型 → 填写地址和凭据 → 测试连接
3. 同一环节可配置多个后端实例，应用按列表顺序使用已配置实例
4. 也可以使用设置页右上角的「测试全部连接」快速检查整条流水线

### 迁移与备份

设置页的「数据迁移与备份」可导出关系、智能集合、自定义模板、探究线和服务地址。备份**不会**包含 API Key、Token、密码或 RAG 索引数据；索引数据始终位于本地 `data/` 卷，可按基础设施策略单独备份。恢复到新设备后，请在设置中重新填写凭据并测试连接。发布前的完整验收步骤见 [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md)。

### AI 摘要配置

| 提供商 | baseUrl | model | apiKey |
|--------|---------|-------|--------|
| OpenAI 官方 | `https://api.openai.com` | `gpt-4o-mini` | 你的 API Key |
| OpenAI 兼容服务 | 支持 `/v1/chat/completions` 的服务地址 | 按服务商文档填写 | 服务 API Key |
| 本地 Ollama | `http://localhost:11434` | `qwen2.5:7b` | 任意值（Ollama 忽略） |


## 常见问题（FAQ）

### Electron 窗口白屏 / 启动后无反应
确认终端中的构建与启动日志。运行 `npm run electron:dev` 重建渲染进程与预加载脚本，再检查是否仍有报错。

### `docker compose up` 后智能服务连不上
确认 `server/.env` 存在且 `OLLAMA_BASE_URL` 正确。Linux 上默认使用 `host.docker.internal` 访问宿主机 Ollama；若 Docker 版本不支持，改为宿主机局域网 IP 或直接在主机运行 Python 服务。

### 知识问答返回空结果
确认已通过「同步已连接来源」或阅读页「🧠 加入知识库」导入数据。搜索时注意关键词匹配：FTS5 使用 unicode61 分词器，中文按单字拆分，英文按空格分词。向量检索在文档数少于 5 篇时效果有限。

### 提示「服务不可用」但 Ollama 在运行
检查 FastAPI 服务能否访问 Ollama。若智能服务运行在 Docker 容器内，按随附配置使用 `OLLAMA_BASE_URL=http://host.docker.internal:11434`；无法连通时，先在宿主机运行 FastAPI 排查。桌面浏览器的跨域设置不能修复服务端连通问题。

[返回项目首页](../README.md) · [AI API 配置](AI_API_SETUP.md)
