# 在线预览方案

Knowledge Pipeline 是 Electron 桌面应用，无法像 Web 应用那样直接提供在线 Demo。
以下方案让招聘方/客户在不安装应用的情况下，充分了解项目能力。

## 方案一：截图 + 架构图（已完成）

`docs/screenshots/` 下的六张截图由脚本自动生成，不需要手工截屏：

```powershell
npm run screenshots
```

脚本 `scripts/screenshots/capture.cjs` 会用临时 userData 目录启动桌面端（不读写本机真实配置），在进程内起一个本地 mock 后端（`scripts/screenshots/mock-server.cjs`，端口 4787），把 `fixtures.cjs` 里的虚构数据挂到 FreshRSS、Karakeep、Memos、RAG 与 Chat Completions 接口上，然后逐页截图。

| 截图 | 文件名 | 说明 |
|------|--------|------|
| 三栏首页 | `home.png` | RSS + 收藏 + 速记三栏布局 |
| 阅读视图 | `reader.png` | 文章大纲 + 反向链接 |
| 知识图谱 | `graph.png` | 力导向图 + 节点关系 |
| 知识问答 | `qa.png` | 答案 + 证据卡与出处 |
| 探究线 | `inquiry.png` | 证据角色 + 当前判断 + 下一步 |
| 设置页 | `settings.png` | 多后端管理 + 连接健康检查 |

截图内容是虚构的演示数据，改 `fixtures.cjs` 后重跑即可换题材。README 的「界面」段落已引用这六张图。

## 方案二：录屏视频（强烈推荐）

按 `docs/DEMO_SCRIPT.md` 脚本录制 2-3 分钟功能演示。

- 工具：OBS Studio（免费开源）或 Win+G 游戏栏
- 格式：MP4，1080p
- 托管：B 站 / YouTube / GitHub Release 附件（<100MB）
- README「演示视频」段落填入链接

## 方案三：后端 API 在线 Demo（进阶，可选）

FastAPI 后端可独立部署到云端，提供交互式 API 文档：

```bash
# 部署到 Railway / Render / Fly.io（免费额度够用）
# 环境变量配置同 server/.env.example，但 OLLAMA_BASE_URL 需指向云模型
```

部署后，README 补充：
- API 文档链接：`https://your-app.up.railway.app/docs`
- 可交互测试 `/health`、`/api/v1/knowledge/search` 等端点
- 注意：云部署需自己承担模型调用成本，建议只做只读演示

## 方案四：GitHub Release 安装包（必须做）

```bash
npm run electron:build
# 产物在 release/ 目录，生成 NSIS 安装包
```

打 Release 时把安装包作为附件上传：
```bash
gh release create v0.3.1 release/*.exe --title "v0.3.1" --notes-from-tag
```

用户下载安装包即可本地试用，无需 clone 源码。

## 优先级

1. **已完成**：截图 6 张（`npm run screenshots` 自动生成）+ README「界面」段落
2. **强烈推荐**：录屏视频
3. **推荐**：GitHub Release + 安装包附件
4. **可选**：后端 API 云端 Demo
