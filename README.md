# 设计助手｜硕士论文研究实验平台 v5.0

研究主题：**《生成式AI支架对初中生原型迭代的影响研究》**。

## 研究流程

- 第1课 `Shopping Bag Failure Practice`：只做平台与AI流程练习，不评分、不随机分组、不进入正式研究统计。学生端始终显示“AI学习助手”，Practice 只是后台复用普通 GenAI 配置，不是第三个研究条件。
- 正式任务：学生在线下已完成 V1→V2 无AI自主迭代；平台正式数据从 **V2证据** 开始。
- 正式AI只发生一次：**V2证据 → AI前独立判断并锁定 → AI多轮讨论 → AI后学生自己作最终决定 → V3 → V3复测与反思**。
- 正式两组：`structured` / `autonomous`。学生端界面、共同知识、时间窗口和功能完全一致，唯一差异是服务器选择的 Coze Bot ID / 对应人设。

## 最新正式匹配逻辑

学生完成 V2 后，`group` 初始仍为 `unassigned`。匹配顺序为：

1. **Q2**：V2产品设计质量，首要匹配变量，由研究者人工评分；只允许 `0 / 2.5 / 5 / 7.5 / 10`。
2. **P2_mean**：V2标准化下降任务表现的平均下降时间，由平台根据 `test_1/test_2/test_3` 自动计算并保存，同时保留每次原始时间。
3. **G0/E0/H0/I0**：仅当 Q2、P2 接近时用于辅助平衡。

平台**不会**计算：

- Q+P总分
- GEHI总分
- baseline_total
- matching_score
- weighted_score
- 任何自动综合匹配分

研究者完成匹配后，可在后台录入 `match_pair_id` 和 `group`；也可批量导入 `student_id / match_pair_id / group`。后台还提供可选“匹配对内随机”：仅在一个 `match_pair_id` 正好对应2人时，将两人随机分到 structured / autonomous。

**group=unassigned 的学生即使 AI Stage 已开放，也不能进入正式AI聊天页。** 学生端不会显示组别或匹配变量。

## 干预保真度

Formal chat session 持续记录：

- `chat_duration`（秒）
- `chat_duration_seconds`
- `user_turn_count`
- `assistant_turn_count`
- `conversation_id`
- `session_id`

刷新页面后仍恢复同一会话和已有消息。

## 页面

- `/` 学生登录
- `/home.html` 当前任务
- `/practice.html` Shopping Bag Practice
- `/formal.html` V2证据 + AI前判断
- `/chat.html?scope=formal` 正式AI聊天（左证据栏/右聊天）
- `/decision.html` AI后最终决定
- `/v3.html` V3实际修改、测试和反思
- `/complete.html` 完成页
- `/admin.html` 教师/研究者后台

## 数据结构

平台使用 EdgeOne Blob（本地调试时使用 `data/`）并按对象拆分：

- `students/`（含 group / match_pair_id）
- `practice_sessions/`
- `formal_sessions/`（含 Q2、GEHI研究评分）
- `prototype_tests/`（V2同时保存原始时间、`mean_descent_time` 与 `P2_mean`）
- `judgments/`
- `chat_sessions/`
- `chat_messages/`
- `final_decisions/`
- `reflections/`
- `uploads/`
- `settings/`
- `group-assignment-log/`

## 环境变量

复制 `.env.example` 为 `.env`（本地）或在 EdgeOne 项目设置中添加：

```text
COZE_API_TOKEN=
STRUCTURED_BOT_ID=
AUTONOMOUS_BOT_ID=
ADMIN_PASSWORD=
ALLOWED_PARTICIPANTS=S001,S002,S003
BLOB_STORE_NAME=design-assistant-research-data
EXPERIMENT_RUN_ID=pilot01
NODE_ENV=production
```

长期部署建议使用 Coze 服务访问令牌 SAT。Token 只能放在服务器环境变量，不能写入前端或 GitHub。

兼容旧变量名：`COZE_ACCESS_TOKEN`、`COZE_STRUCTURED_BOT_ID`、`COZE_AUTONOMOUS_BOT_ID`。

## 本地运行

Node.js 20+：

```bash
npm install
cp .env.example .env
npm start
```

无需真实 Coze 联调时可使用：

```text
COZE_MOCK=1
USE_LOCAL_STORAGE=1
```

## EdgeOne 部署

GitHub → EdgeOne：

- Framework：Other
- Root：`./`
- Output：`public`
- Install：`npm install`
- Build：留空
- Node：20.x
- Function 入口：`cloud-functions/express/[[default]].js`

前端统一调用 `/express/api/...`。

## 管理后台

后台可：

- 开关 Practice / Formal V2 / 正式AI / V3提交
- 设置测试次数 2/3、最大聊天时间、Shared Rules of Thumb
- 查看学生匹配列表：`student_id / Q2 / P2_mean / G0 / E0 / H0 / I0 / match_pair_id / group`
- 按 Q2 或 P2_mean 排序
- 人工录入 Q2 和 GEHI（学生不可见）
- 手工录入 `match_pair_id` 与 group
- 批量导入 `student_id / match_pair_id / group`
- 可选匹配对内随机
- 查看单个学生完整过程链、AI逐轮消息、V2/V3图片
- 查看 `chat_duration / user_turn_count / assistant_turn_count`
- 导出单个学生JSON或全部数据

## 数据导出

后台提供：

- `students.csv`
- `matching.csv`
- `practice.csv`
- `practice_chat_messages.csv`
- `V2_evidence.csv`（含 `P2_mean` 与原始测试时间）
- `judgment_before.csv`
- `chat_messages.csv`
- `chat_sessions.csv`（含聊天时长与轮次数）
- `decision_after.csv`
- `V3_results.csv`
- `reflection.csv`
- `research_scores.csv`
- `research_all.json`
- 单个学生 JSON

## 图片

V2/V3各要求至少1张、最多3张 JPG/JPEG/PNG/WEBP，单张最大10MB。图片写入 Blob / 本地存储，不只保留浏览器临时URL。

## 连续AI多轮

同一个 Practice 或 Formal AI 会话只创建一次 Coze `conversation_id`，后续消息继续使用同一 conversation。Formal 聊天前服务器根据 group 选择对应 Bot；Practice 复用普通/自主 GenAI Bot，但学生端只显示“AI学习助手”。
