# 接入 OpenAI / Codex、Claude 或 DeepSeek

在桌面应用的「设置 → AI 摘要 → 添加后端」选择服务，填写 API Key 和账号可用的模型 ID，保存后点「测试连接」。测试连接会发送一条简短请求，按服务商规则计费。服务地址支持带 `/v1` 或不带 `/v1`，不会重复拼接。

| 选项 | 默认地址 | 使用的接口 |
|---|---|---|
| OpenAI / Codex | `https://api.openai.com` | Responses API |
| Claude | `https://api.anthropic.com` | Anthropic Messages API |
| DeepSeek | `https://api.deepseek.com` | OpenAI 兼容 Chat Completions |
| OpenAI 兼容 | `https://api.openai.com` | 保留原有 Chat Completions 接口，也可填本机 Ollama 地址 |

模型 ID 以各自控制台实际可用的列表为准。DeepSeek 示例为 `deepseek-flash`。OpenAI / Codex 选项需要支持 Responses 的模型；这里接入 API，不读取 Codex、ChatGPT 或 Claude 客户端的登录凭据。远端 API 必须使用 HTTPS，本机服务可使用 HTTP。切换服务类型会清空尚未保存的密钥。

可以保存多个服务，在目标服务卡片点击「用于摘要和问答」即可切换默认服务，不必删除其他配置。列表中第一个已配置的 AI 服务用于文章摘要和知识库作答。

## 知识库问答

本地知识服务仍负责索引和检索，需按 README 启动。配置 AI API 后，桌面主进程先查询本机的检索接口，再将问题和检索片段交给所选 API 作答，保留原引用编号和来源。没有检索到证据时不会调用付费 API；API 返回错误、空文本或截断输出时会明确报错。

未配置 AI API 时保持原来的本地 Ollama 问答路径；Ollama 不可用时后端可以返回检索证据。本次新增的云端 API 不替代嵌入模型；没有本地嵌入服务时由后端按原有规则降级到关键词检索。

**数据边界：** 选择云端 API 后，摘要原文以及问答的问题、检索片段会发送到所选服务商。索引仍保留本机。不要提交未经授权外传的材料。密钥使用桌面主进程的系统安全存储，保存后只向渲染进程返回脱敏配置，备份不包含密钥。

## 验证命令

`npm test` 覆盖三种 HTTP 协议、四个服务入口、鉴权头、Responses 文本解析、DeepSeek 地址、空/截断响应、拒绝重定向及本地检索到云端回答的接线。测试只访问本机模拟服务，使用虚构密钥。

先运行 `npm run build`，再运行 `npm run test:desktop`，可在隔离的空白用户目录验证真实桌面预加载和设置 IPC；不会读取已有账号设置。真实服务还需用户填入自己的有效密钥后测试。

接口依据：[OpenAI Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses)、[Claude API](https://platform.claude.com/docs/en/api/overview)、[DeepSeek API](https://api-docs.deepseek.com/quick_start/agent_integrations/)。
