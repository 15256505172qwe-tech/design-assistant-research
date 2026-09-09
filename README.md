# Design Assistant Research Platform v9

用于《生成式AI支架对初中生原型迭代的影响研究》的课堂实验与数据采集平台。

## 1. 技术结构

沿用 v8：

- 前端：HTML / CSS / JavaScript
- 后端：Node.js 20 + Express
- 部署：GitHub → Tencent EdgeOne Pages / Node Functions
- 数据与图片：EdgeOne Blob（本地测试可使用文件存储）
- AI：Coze API

没有改成新的前端框架，也没有把 Token 放到浏览器。

## 2. v9 正式流程

默认 `formal_round_count=2`：

- Round 1：V1证据 → 初始判断锁定 → AI → 最终作答锁定 → 其他方案事实记录 → V2修改 → 可选自主验证 → V2复测 → 反思
- Round 2：自动继承V2证据 → 初始判断锁定 → 同一condition AI → 最终作答锁定 → 其他方案事实记录 → V3修改 → 可选自主验证 → V3复测 → 最终反思

若后台把 `formal_round_count` 设为 1，Round 2 不显示。

## 3. Practice

只有 Shopping Bag Failure Practice。

学生先填写：

1. 下一版准备怎么改及理由；
2. 主要依据什么测试现象或信息。

锁定后进入所有学生相同的普通 AI 体验。Practice 不进入正式统计。

## 4. 参与者编号与 condition

正式编号：`P01`–`P28`。

数据库主字段：`participant_id`。

正式 condition：

- `scaffold`
- `regular`
- `unassigned`

学生端永远不显示 condition。

导师演示：

- `DEMO-S`：scaffold
- `DEMO-R`：regular

Demo 数据默认不进入正式导出。

## 5. Coze 环境变量

腾讯云需要配置：

```text
COZE_ACCESS_TOKEN=
COZE_STRUCTURED_BOT_ID=
COZE_AUTONOMOUS_BOT_ID=
COZE_MODEL_NAME=
ADMIN_PASSWORD=
ALLOWED_PARTICIPANTS=P01,...,P28
BLOB_STORE_NAME=design-assistant-research-data
EXPERIMENT_RUN_ID=pilot-v9
NODE_ENV=production
STRICT_PARTICIPANT_ALLOWLIST=0
```

### Bot 对应

- `COZE_STRUCTURED_BOT_ID` → scaffold 条件
- `COZE_AUTONOMOUS_BOT_ID` → regular 条件，同时用于 Practice 普通 AI

两个正式 Bot 必须在 Coze 端使用相同底层模型、共同知识、时间条件和工具权限；平台无法从外部强制修改 Bot 内部模型，所以请在 Coze 发布前人工核对。

`COZE_MODEL_NAME` 仅用于把当前统一模型名称写入研究日志，可留空。

## 6. 本地运行

```bash
npm install
npm run build
npm start
```

打开：`http://localhost:3000`

管理员：`http://localhost:3000/admin.html`

## 7. EdgeOne 部署

- Framework Preset：Other
- Root Directory：`./`
- Output Directory：`public`
- Install Command：`npm install`
- Build Command：可留空，或 `npm run build`
- Node：20.x（仓库 `edgeone.json` 指定 20.18.0）

Node Function 保持：

`cloud-functions/express/[[default]].js`

前端请求后端使用 `/express/api/...`。

## 8. 数据存储

v9 新研究数据使用版本化路径：

```text
runs/<EXPERIMENT_RUN_ID>/v9/...
```

包括：

- Practice
- V1/V2/V3 证据和照片
- Round1 / Round2 初始判断
- Round1 / Round2 聊天 session 与逐条 message
- 最终作答
- alternative fact record
- 实际修改
- 自主验证
- 复测与反思

v8 原数据仍保留在旧路径，不会被 v9 粗暴覆盖；完整 JSON 中提供 `legacy_v8` 只读字段。

## 9. 图片

只允许 JPG / JPEG / PNG / WEBP，单张最大 10MB。V1、V2、V3 每个版本 1–3 张。

没有视频上传功能。

## 10. 数据导出

管理员后台支持：

- participants.csv
- formal_rounds.csv
- chat_messages.csv
- practice.csv
- 全部正式 JSON
- 单个参与者 JSON

默认排除 `is_demo=true` 的导师演示数据。

## 11. 聊天控制

- 无固定轮数限制；超过 8 次学生发言也不会被平台截断。
- 唯一硬时间上限：`max_chat_minutes`。
- 保存 `user_turn_count`、`assistant_turn_count`、`chat_duration_seconds`，仅作过程/干预保真度记录。
- 同一轮保持同一个 Coze `conversation_id`，刷新后平台聊天记录可恢复。

## 12. 安全

`.env`、Token、真实 Bot ID、管理员密码不得上传 GitHub。

`.gitignore` 已排除：`.env`、`node_modules`、本地 data/uploads、SQLite/db 文件。
