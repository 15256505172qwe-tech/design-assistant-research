# V9_CHANGELOG

## 核心流程变更

- Formal 不再从 V2 开始，改为从 **V1 正式测试**开始。
- 原生支持 1 或 2 轮正式 AI 迭代，后台 `formal_round_count` 默认 2。
- Round 1：V1证据 → AI前独立判断锁定 → AI讨论 → 统一最终作答锁定 → 其他方案事实记录 → V1→V2实际修改 → 可选自主验证 → V2标准化复测 → 短反思。
- Round 2：自动继承 V2 复测证据 → 第二次AI前独立判断锁定 → 同一 condition 进入第二轮AI → 统一最终作答锁定 → 其他方案事实记录 → V2→V3实际修改 → 可选自主验证 → V3标准化复测 → 最终反思。
- Formal Round 使用同一套动态组件与服务逻辑，不复制两套业务代码。

## Practice

- 只保留 Shopping Bag Failure Practice。
- Practice 只保留两个 AI 前开放问题：修改想法与依据。
- Practice AI 为所有学生相同的普通 AI 体验，不训练 G/C/E，不进入正式统计。
- Practice 数据与 Formal 数据使用独立 v9 存储路径。

## 正式 AI

- 正式 condition 改为 `scaffold / regular / unassigned`。
- 学生端不显示 condition、实验组/对照组、Structured/Autonomous 等研究词。
- 两组共用完全相同的页面、证据、时间窗口和交互控件。
- 唯一差异是服务器选择的 Coze Bot ID：
  - scaffold → `COZE_STRUCTURED_BOT_ID`
  - regular → `COZE_AUTONOMOUS_BOT_ID`
- Round 2 沿用 Round 1 的同一个 condition，不重新随机。
- AI 会在进入聊天后主动读取已锁定证据与初始判断并开始讨论。
- 删除任何固定轮数/8轮结束逻辑；唯一硬结束条件为 `max_chat_minutes`。
- 保留 `user_turn_count`、`assistant_turn_count`、`chat_duration_seconds` 作为过程/干预保真度数据。

## 最终决定与修改记录

- AI结束后进入统一最终作答页：最终问题、证据、原因、修改决定、修改理由，五项一起锁定。
- “是否考虑过其他修改办法”只在最终决定锁定后出现，避免反向提示学生必须生成多个方案。
- 实际修改记录简化为新版本照片、实际改了什么、是否与原决定不同。
- 不新增复杂 Design Diary。

## 测试与反思

- V1/V2/V3 都使用同一套标准化下降测试结构。
- `test_repeat_count` 后台可设 2 或 3；保存每次原始数据并提供平均值基础展示。
- 不把观察项合成为总质量分。
- `enable_self_verification` 默认 true，可由后台关闭。
- Round 1 保留短反思；Round 2 使用完整最终反思。

## 管理后台

- 创建/补齐 P01–P28。
- 创建 `DEMO-S` / `DEMO-R` 两个导师演示参与者。
- Demo 自动标记 `is_demo=true`，正式导出默认排除。
- 管理 condition、grade、Practice/Round1/Round2 开放、轮数、聊天时长、测试重复次数、自主验证开关。
- 查看每位参与者完整证据、锁定回答、照片、聊天、复测与反思。
- 正式 CSV/JSON 导出默认排除 demo，可单独导出 demo 或使用 include_demo=1。

## 数据与兼容

- 新 v9 正式数据写入 `v9/...` 版本化路径，避免与 v8 旧 Formal V2 数据混写。
- v8 旧数据不删除，管理端单人详情中以 `legacy_v8` 只读保留，并进入完整 JSON 导出。
- 新部署空存储默认使用 v9 流程。
- 不生成 Q 产品质量表、GEHI 总分、matching_score、baseline_total 或自动 AI 评分。

## 界面

- 统一暖灰背景、低饱和蓝灰、圆角卡片、自然课堂语言。
- iPad/电脑自适应。
- 正式聊天继续使用左证据、右聊天布局。
- 每一阶段只突出当前主要任务，锁定状态以中性提示显示。
