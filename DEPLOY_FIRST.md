# 首次部署检查（v5.0）

1. GitHub 根目录直接包含 `cloud-functions/`、`public/`、`src/`、`package.json`、`edgeone.json`。
2. EdgeOne：Other / `./` / `public` / `npm install` / 构建命令留空 / Node 20。
3. 配置 `.env.example` 中的环境变量；测试可先放 `S001,S002,S003`。
4. 管理员进入 `/admin.html`：
   - Practice Open：第1课打开
   - Formal V2 Evidence：V2录入时打开
   - AI Stage Open：只在正式AI课打开
   - V3 Submission Open：制作V3后打开
5. Practice 后台复用普通/自主 GenAI 配置，学生端统一显示“AI学习助手”；Practice 数据与 Formal 分开。
6. 正式匹配：先录入/完成 Q2 与 V2测试，核对 P2_mean；Q2优先、P2其次，GEHI只辅助平衡。
7. 匹配完成后录入 `match_pair_id` 和 `group`。group 未分配时学生不能进入正式AI聊天。
8. 可在后台批量导入：`S001 pair01 structured` / `S002 pair01 autonomous`；也可先给两人同一 `match_pair_id` 再点“匹配对内随机”。
9. 正式实验前把 `EXPERIMENT_RUN_ID` 换成新的正式批次名，避免 pilot 数据混入论文数据。
10. 用真实 Coze 环境至少完成一次 S001 全流程联调，并确认 `chat_duration / user_turn_count / assistant_turn_count` 正常记录。
