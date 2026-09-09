# V9 首次部署检查

1. 解压 v9 ZIP，完整覆盖 GitHub 项目文件。
2. 确认仓库根目录直接存在 `public/`、`src/`、`cloud-functions/`、`package.json`、`edgeone.json`。
3. 腾讯云继续使用原项目环境变量；新增 `COZE_MODEL_NAME` 可选。
4. `ALLOWED_PARTICIPANTS` 推荐填 P01–P28。v9 默认原生允许 P01–P28；只有 `STRICT_PARTICIPANT_ALLOWLIST=1` 才严格按环境变量白名单限制。
5. EdgeOne：Root `./`；Output `public`；Install `npm install`；Build 可留空或 `npm run build`。
6. 部署后管理员先设置：Practice、Round1、Round2 开关；formal_round_count；test_repeat_count；max_chat_minutes；enable_self_verification。
7. 点击“创建/补齐 P01–P28”。
8. 正式研究前分配每人的 condition：scaffold / regular。
9. 导师演示时点击“创建 DEMO-S / DEMO-R”；正式导出默认排除 demo。
10. 用 P01 完整跑 Round1；若 formal_round_count=2，再开放 Round2 测试。
11. 确认 Round2 自动读取 V2 复测证据，不要求重新录入。
12. 确认聊天没有固定轮数上限；时间到后才停止继续输入。
13. 确认学生端不出现 condition、实验组/对照组、G/E/H/I、IDTLM 等研究术语。
14. 检查管理员可查看：图片、锁定回答、完整聊天、实际修改、复测、反思。
15. 下载 CSV/JSON，确认默认不含 DEMO-S / DEMO-R。
