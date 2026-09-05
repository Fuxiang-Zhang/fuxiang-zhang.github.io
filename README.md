# Fuxiang’s research homepage

TypeScript 驱动的个人主页，保留原生 HTML/CSS，不使用前端框架。聊天暂为随机模拟回复，无 API 费用。

## 开发

需要 Node.js 22+。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:3000 。修改源码后会自动编译，刷新浏览器即可查看。`PORT`、`HOST` 可调整本地服务地址。

```sh
npm run check  # TypeScript 严格类型检查
npm test       # 构建并运行测试
npm start      # 构建并启动服务，不监听文件变化
```

## 代码结构

| 文件 | 用途 |
| --- | --- |
| `src/app.ts` | 导航、页面交互和对话状态 |
| `src/content.ts` | 中英文文案、教育、工作、学术服务和奖励 |
| `src/render.ts` | 共用的 HTML 渲染与转义 |
| `src/chat.ts` | 前后端共用的模拟回复及请求接口 |
| `src/config.ts` | 聊天后端地址与主页统计配置 |
| `src/types.ts` | 数据类型和论文数据校验 |
| `data/publications.json` | 完整论文数据 |
| `server.ts` | 静态文件服务与 `POST /api/chat` |
| `scripts/` | 构建和开发监听 |

五个 tab：Overview → Research → Work → Publication → Miscellaneous。各自保留本次访问的输入和对话；刷新后清空消息。只有语言和主题偏好写入本机存储。阅读版由同一份内容自动生成。

## 构建与 GitHub Pages

```sh
npm run build
```

TypeScript 编译到 `.build/`，公开文件输出到 `dist/`。现有 GitHub Actions 会安装锁定的依赖、检查、测试，并将 `dist/` 部署到 GitHub Pages。无需提交生成的 JavaScript 或阅读版文件。

浏览器执行的是编译后的 JavaScript；GitHub Pages 不运行 TypeScript 源码或 Node 后端。`reading.html`、图片、论文链接与现有重定向仍可正常访问。

## 聊天接口

在 `src/config.ts` 修改 `chatEndpoint`：本地默认 `/api/chat`，静态部署默认 `null`，使用明确标记的模拟回复。

请求字段：`message`、`language`、`topic`、`paperId`；响应字段：`id`、`text`、`mode`。完整类型见 `src/types.ts`。

接入真实模型时需单独部署后端，并补充会话上下文、知识检索、额度控制及相应响应类型。密钥保留在后端。远程服务需允许主页来源的 CORS 请求。
