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
| `src/app.ts` | DOM 更新、事件与聊天请求调度 |
| `src/state.ts` | 会话、草稿、内容回复、论文链接来源和筛选逻辑 |
| `src/content.ts` | 界面文案（按钮、提示、标题等），不含任何主页事实内容 |
| `src/render.ts` | 会话开场消息、侧边栏、消息与内容回复、论文详情以及阅读版的纯 HTML 渲染 |
| `src/stream.ts` | 回复的逐 token 渲染动画，接入真实后端流式输出时复用 |
| `src/chat.ts` | 前后端共用的模拟回复及请求接口 |
| `src/config.ts` | 聊天后端地址与主页统计配置 |
| `src/types.ts` | 站点数据结构 `SiteData`、加载合并 `loadSiteData` 与校验 `parseSiteData` |
| `data/profile.json` | 基本信息与研究方向 |
| `data/publications.json` | 论文列表 |
| `data/cv.json` | 工作经历、教育经历、学术服务、荣誉奖励 |
| `server.ts` | 静态文件服务与 `POST /api/chat` |
| `scripts/build.mjs` | 启动 TS 编译，成功后替换构建输出 |
| `scripts/build.ts` / `scripts/dev.ts` | 静态导出 / 开发监听 |
| `assets/fonts/` | 自托管的 Inter 与 Source Serif 4（SIL Open Font License），正文用 Inter，问候语、名字和论文标题用衬线 |

主页以对话为中心。侧边栏列出五个固定会话 Bio → Research → Publications → Experiences → Miscellaneous 以及访客新开的对话；每个会话的第一条消息由站点数据渲染：Bio、Research、Experiences（工作与教育经历）、Miscellaneous（学术服务、荣誉）直接展示全部内容，Publications 按类别以卡片形式列出全部论文（完整作者、发表信息与链接）；点击消息中的按钮或论文标题，会把研究兴趣、论文列表或论文详情作为新的回复追加到对话末尾，像聊天回复一样逐 token 渲染并跟随滚动（系统开启减少动态效果时直接显示），重复点击复用上一条。直接访问 `#paper/<id>` 链接会在 Publications 会话中以回复形式打开该论文。在五个固定会话里输入的问题，发送后都会开启并跳转到新的对话，固定会话本身只保留站点内容；只有点击 New chat 开启的对话才显示问候语和建议问题，没有发送过消息也没有草稿的对话在离开后自动丢弃；「Ask about this paper」只是把论文放进输入框作为上下文，发送后新对话以该论文命名。旧的 `#overview`、`#journey`、`#work` 链接会重定向。各会话保留本次访问的输入和对话；刷新后清空消息。只有主题偏好写入本机存储。重试失败回复保留尚未发送的新草稿。

## 站点数据

`data/` 目录是主页的唯一数据源。聊天版在浏览器中读取这些文件渲染各个会话和内容回复，阅读版 `reading.html`（经典单页样式）在构建时由同一份数据生成。`loadSiteData` 把三个文件合并为一个 `SiteData` 对象，渲染代码只面对这一个结构。内容分为七类，按格式存放在三个文件里：

| 文件 | 字段 | 内容 | 主要字段 |
| --- | --- | --- | --- |
| `profile.json` | `profile` | 基本信息 | `name`、`position`、`photo`、`email`、`links`、`bio`（段落数组） |
| `profile.json` | `research` | 论文主题（筛选与标注用） | `id`（`llm` / `rl` / `marl`）、`name`、`shortName`、`description` |
| `profile.json` | `interests` | Research 会话的研究兴趣 | `title`、`description`、可选 `topic`（关联论文筛选）、可选 `points`（`title`、`description`、可选 `topic`） |
| `publications.json` | （数组） | 论文发表 | `id`、`title`、`authors`、`venue`、`venueShort`、`year`、`category`、`topic`、`links` |
| `cv.json` | `experience` | 工作与研究经历 | `organization`、`role`、`location`、`period`、`description`、`links`、`contributions` |
| `cv.json` | `education` | 教育经历 | `institution`、`degree`、`location`、`period`、`description`、`links` |
| `cv.json` | `service` | 学术服务 | `venue`、`role`、`period` |
| `cv.json` | `awards` | 荣誉奖励 | `title`、`issuer`、`period` |

约定：

- 论文 `category` 取 `reports` / `conference` / `journal`，`topic` 取研究方向 id。
- 工作经历的 `contributions` 可通过 `paperId` 关联论文，聊天版会把论文详情作为回复追加到对话，阅读版会跳转到对应条目。
- 文本字段可用 `[显示文字](https://…)` 写内联链接，其余内容一律按纯文本转义；只允许 http(s) 链接。
- 构建时会校验数据结构、论文 id 唯一性、`paperId` 引用有效性以及三个研究方向齐全，校验失败则保留上一版构建。完整类型见 `src/types.ts`。

测试只约束内容显示与数据准确性：

- `tests/data.test.ts`：数据读取无丢失、字段类型、论文 id 唯一性及引用有效性。
- `tests/render.test.ts`：基本资料、研究兴趣、履历和论文内容与 `data/` 一致，链接准确，缺失数据不冒充有效资料，文本正确转义。
- `tests/state.test.ts`：论文筛选结果准确、问题与论文上下文不串用、逐步输出不丢字。
- `tests/server.test.ts`：实际提供的数据和照片与源文件一致，导出阅读页保留论文资料，模拟回复明确标识。

不锁定 CSS 类名、HTML 嵌套、图标、版式、资料所在分区、导航顺序、开场方式、对话清理策略或动画节奏；也不测试构建回滚、临时文件清理、服务器路径防护等基础设施行为。内容断言检查生成 HTML 的文字和链接，不代替浏览器对遮挡、溢出等实际显示问题的检查。

`data/` 是这些测试的比对依据。测试通过表示渲染与资料一致、结构和引用有效，不代表其中的学术经历、论文或成绩已由外部来源核实；修改事实仍需核对原始资料。

## 构建与 GitHub Pages

```sh
npm run build
```

构建先在独立临时目录完成 TS 编译、内容校验和静态导出，全部成功后再替换 `.build/` 与 `dist/`。删除或重命名的源码不会遗留旧 JS；失败时保留上一版预览。静态服务仅访问 `dist/` 内的文件，新增资源无需登记文件名。现有 GitHub Actions 会安装锁定的依赖、检查、测试，并将 `dist/` 部署到 GitHub Pages。无需提交生成的 JavaScript。

浏览器执行的是编译后的 JavaScript；GitHub Pages 不运行 TypeScript 源码或 Node 后端。`reading.html`、图片、论文链接与现有重定向仍可正常访问。

## 聊天接口

在 `src/config.ts` 修改 `chatEndpoint`：本地默认 `/api/chat`，静态部署默认 `null`，使用明确标记的模拟回复。

请求字段：`message`、`topic`、`paperId`；响应字段：`id`、`text`、`mode`。完整类型见 `src/types.ts`。

接入真实模型时需单独部署后端，并补充会话上下文、知识检索、额度控制及相应响应类型。密钥保留在后端。远程服务需允许主页来源的 CORS 请求。
