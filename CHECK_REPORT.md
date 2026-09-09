# 最终检查报告｜v5.0 匹配逻辑更新版

本包基于上一版 checked 项目，仅更新正式匹配/分组逻辑及相关后台与导出；两个 Coze 智能体调用逻辑、人设入口、共同上下文和学生端同构界面未改。

## 本次已落实

- Q2 为首要匹配变量，研究者后台人工录入；仅允许 `0 / 2.5 / 5 / 7.5 / 10`。
- P2_mean 由 V2 原始下降时间自动计算并保存；原始 `test_1/test_2/test_3` 继续保留。
- G0/E0/H0/I0 仅作为后台辅助平衡信息。
- 不存在 Q+P 总分、GEHI 总分、baseline_total、matching_score、weighted_score 等综合匹配分。
- 新学生 group 默认 `unassigned`。
- 后台支持 `match_pair_id` + group 手工录入。
- 后台支持批量导入 `student_id / match_pair_id / group`。
- 后台提供可选“匹配对内随机”，仅在同一 match_pair_id 正好2人时进行 structured/autonomous 随机分配。
- 管理员列表显示 `student_id / Q2 / P2_mean / G0 / E0 / H0 / I0 / match_pair_id / group`，支持 Q2、P2_mean 排序。
- group 未分配时，即使 AI Stage Open，学生端不会提供正式AI入口；直接访问正式聊天页也会被重定向/服务器拒绝。
- 学生 API 不返回 structured/autonomous 组别值，只返回是否具备正式AI资格的布尔状态；学生界面不显示组别、Q2、P2、GEHI 或匹配信息。
- 第1课学生端统一称“AI学习助手”；没有“Base AI”名称。Practice 后台复用普通/自主 GenAI 配置，但不是第三个研究条件。
- Formal chat session 保留并验证：`chat_duration`、`chat_duration_seconds`、`user_turn_count`、`assistant_turn_count`。
- 新增 `matching.csv` 与 `chat_sessions.csv` 导出；V2_evidence.csv 明确保留 `P2_mean` 和全部原始测试时间。
- 静态资源版本号提升至 `v5.0`，降低 EdgeOne/CDN 继续加载旧 JS/CSS 的风险。

## 已执行检查

- `npm run check`：**通过**。25 个 JS/MJS 文件语法与关键研究约束检查通过。
- `npm test`：**通过**。本地存储 + Mock Coze 完整跑通：Practice → V2 → Q2/P2匹配 → AI前锁定 → 连续两轮正式AI → AI后决定 → V3 → 反思。
- Smoke test 验证：
  - P2_mean = V2原始测试平均值；
  - 非法 Q2（如6）会被拒绝；
  - `match_pair_id` 与正式 group 正常保存；
  - Formal conversation_id 多轮保持不变；
  - user_turn_count / assistant_turn_count 正确累计；
  - chat_duration 正常保存；
  - Structured / Autonomous Bot 路由正确；
  - Practice 复用 Autonomous/普通 GenAI Bot 路由。
- 两个正式智能体的 `cozeService.js` **未修改**。

## 线上仍需最终验证

离线环境无法代替你的真实账号完成：

1. EdgeOne 实际部署与 Blob 权限；
2. Coze SAT 权限；
3. 两个已发布 Bot ID 的真实调用；
4. 管理后台“匹配对内随机”在线接口与 UI；
5. 用至少两个测试编号完成一次：V2 → Q2录入 → match_pair_id → 分组 → 正式AI → 导出 `matching.csv` / `chat_sessions.csv`。

尝试执行 `npm install` 时当前容器网络超时，因此未完成真实依赖下载；但 `npm run check` 与不依赖在线 Coze/外部包的 Mock smoke 测试均已通过。EdgeOne 部署会按 `npm install` 安装依赖。
