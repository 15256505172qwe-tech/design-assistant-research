# 第一次部署/替换步骤
> **第1课 Practice 必须使用 AI**：Shopping Bag 流程为“案例证据 → 学生独立判断并锁定 → 复用 Autonomous Bot 讨论 → 学生再次判断 → 最终决定”。Practice `formal_data=false`，不进入正式效果统计。

1. 将本项目上传到 GitHub 分支，建议先用 Preview 分支验证。
2. EdgeOne 构建目录保持项目根目录，输出目录为 `public`。
3. 不要移动 `cloud-functions/express/[[default]].js`。
4. 在 EdgeOne 配置以下环境变量：
   - `COZE_ACCESS_TOKEN`
   - `COZE_STRUCTURED_BOT_ID`
   - `COZE_AUTONOMOUS_BOT_ID`
   - `ADMIN_PASSWORD`
   - `ALLOWED_PARTICIPANTS`（例如 `P01,P02,P03`）
   - `BLOB_STORE_NAME`
   - `EXPERIMENT_RUN_ID`
   - `NODE_ENV=production`
5. 环境变量修改后重新部署。
6. Preview 验收顺序：
   - 管理员原密码可以登录
   - P01可以通过 `/express/api/validate`
   - Practice 不要求正式group
   - 正式AI阶段未分组学生会收到 `Participant group not assigned`
   - 给P01分组后，structured/autonomous 能分别调用对应Bot
   - AI前提交后不能修改；刷新后记录仍在
   - AI聊天刷新后恢复同一正式conversation
   - AI后最终决定提交后聊天关闭
   - `research_records.csv` 不包含 Practice
7. Preview全部通过后再合并到 `main`。
