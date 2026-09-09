# V9 交付检查报告

检查日期：2026-09-09

## 已通过

- `npm run check`：通过；25 个 JS/MJS 文件全部通过 Node 语法检查。
- `npm run build`：通过；本项目无前端编译步骤，build 脚本执行完整静态/业务约束检查。
- `npm test`：通过。
- Smoke test 已完整覆盖：Practice → Round1 V1证据 → AI前锁定 → 10个学生发言轮次记录 → AI结束 → 最终决定 → alternative → V2修改 → 自主验证 → V2复测 → Round1反思 → Round2自动继承V2证据 → 第二轮AI → V3修改 → V3复测 → 最终反思 → 完成。
- Smoke test 明确模拟 10 个学生发言轮次，验证不存在“8轮上限”或固定轮次结束条件。
- Demo：DEMO-S=scaffold、DEMO-R=regular 通过。
- Round2 沿用 participant.condition，不存在第二次随机。
- v9 新数据使用 `v9/...` 版本化存储路径；v8 数据保留为 `legacy_v8`，不会粗暴覆盖。
- V1/V2/V3 照片只支持图片，1–3张，上传路由支持 JPG/PNG/WEBP，单张10MB。
- 正式导出逻辑默认排除 demo。
- 学生前台扫描未发现 Structured、Autonomous、实验组、对照组、G0/E0/H0/I0、IDTLM、Troubleshoot 等研究术语。
- 未发现 `max_chat_turns`、`turn_limit`、`matching_score`、`baseline_total`、`GEHI_total`。

## npm install

在当前隔离执行环境中两次执行 `npm install --no-audit --no-fund` 均因外部 npm 网络访问超时，无法完成真实依赖下载。这不是代码报错。仓库依赖声明保持 v8 已使用的 Express/Axios/Multer/EdgeOne Blob 组合；部署环境仍需正常联网执行 `npm install`。

## 无法在本环境替代的真实联调

以下项目依赖你的腾讯云/Coze账户，必须部署后做最后一次线上验收：

- 真实 Coze SAT 是否有效；
- 两个已发布 Bot ID 是否可调用；
- 两只正式 Bot 是否确实配置同一底层模型与共同知识；
- EdgeOne Blob 真实写入/图片读取；
- EdgeOne Node Function 线上请求时限。

代码级与 Mock 集成测试均已通过，但不能把 Mock 结果表述成真实 Coze/EdgeOne 联调成功。
