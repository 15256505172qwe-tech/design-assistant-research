# 设计助手（Model Parachute 研究版）
> **第1课 Practice 必须使用 AI**：Shopping Bag 流程为“案例证据 → 学生独立判断并锁定 → 复用 Autonomous Bot 讨论 → 学生再次判断 → 最终决定”。Practice `formal_data=false`，不进入正式效果统计。

这是基于已验证可工作的 EdgeOne/Express 架构重建的研究平台版本。核心原则是：**不改动稳定的 EdgeOne Functions 入口，只在其上增加研究业务逻辑。**

## 当前研究流程

- 第1课：Shopping Bag Practice（`formal_data=false`）
  - 独立判断 → 锁定 → 普通/自主AI → 再判断 → 最终自己决定
  - 不进入正式 `research_records.csv`
- 正式任务：Model Parachute
  - V1 → V2：无AI自主迭代
  - 完成初始表现评分后，由管理员将 P01 等中性编号随机分配为 `structured` / `autonomous`
  - V2 → V3：**唯一一次正式AI迭代**
  - 无第二轮AI、无V4、无撤架任务

## 两个正式Bot

- `structured` → `COZE_STRUCTURED_BOT_ID`
- `autonomous` → `COZE_AUTONOMOUS_BOT_ID`
- Practice 复用 `COZE_AUTONOMOUS_BOT_ID`

没有第三个Bot fallback。

## 必须配置的 EdgeOne 环境变量

```text
COZE_ACCESS_TOKEN=...
COZE_STRUCTURED_BOT_ID=...
COZE_AUTONOMOUS_BOT_ID=...
ADMIN_PASSWORD=...
ALLOWED_PARTICIPANTS=P01,P02,P03,...
BLOB_STORE_NAME=...
EXPERIMENT_RUN_ID=pilot01
NODE_ENV=production
```

`ALLOWED_PARTICIPANTS` 必须使用英文半角逗号分隔。修改任何环境变量后，需要重新部署。

## EdgeOne 关键部署约束

请保留下面的稳定入口，不要移动：

```text
cloud-functions/express/[[default]].js
```

因此浏览器端API路径是：

```text
/express/api/validate
/express/api/chat
/express/api/research/...
/express/api/admin/...
```

课程阶段配置现在是 `src/config/researchConfig.js` 的**静态JavaScript模块**，不再通过 `fs` 读取 JSON，因此不会出现 `/task-configs/course-stages.json` 的 EdgeOne 运行时路径错误。

## 管理后台

首页右上方“管理”进入 `/admin.html`。后台支持：

- 切换12课时对应课程阶段
- P01等中性编号的 `structured` / `autonomous` 分组
- V1/V2/V3照片上传
- V1/V2/V3标准化测试数据补录
- V1→V2自主迭代资料补录
- AI前锁定记录、AI后最终决定查看/补录
- G0/E0/H0/I0 与 G1/E1/H1/I1 人工评分
- Q_V1/Q_V2/Q_V3 人工产品质量评分
- 课外AI污染核查与访谈标记
- 导出 `research_records.csv`
- 导出正式 `chat_messages.jsonl`
- 导出 `interview_cases.csv`

平台不会自动计算 GEHI、Q 或“下降时间+稳定性”的自创综合总分。

## 学生端

学生匿名编号统一为 `P01`–`P99`。正式AI课：

1. V2照片/真实测试数据
2. AI前独立问题诊断、依据、修改方案与选择
3. 服务端锁定
4. 对应Bot对话（刷新恢复同一正式 conversation）
5. AI后学生再次判断并提交最终决定
6. 服务端锁定，正式AI结束
7. 后续制作V3、复测、反思

## 本地静态检查

```bash
npm install
npm run check
```

该检查会验证JS语法、EdgeOne稳定入口、P编号规则，并扫描旧的 S/D、Control Bot、V4、round2、fading 和运行时 `course-stages.json` 引用。
