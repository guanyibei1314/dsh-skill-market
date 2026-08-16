# 开发日志

> 记录关键决策、验证命令和结果，便于回滚/排查。

## 2026-08-16

### 13:19 开始

- 工作目录：`C:\Users\Administrator\Desktop\技能市场`
- 需求：开发一个适配 DeepSeek Harness 的技能市场。

### 13:21 GitHub 克隆卡顿

- 尝试 `git clone https://github.com/deepseek-ai/deepseek-harness.git`。
- 现象：长时间停在 `Cloning into...`。
- 原因：仓库约 117 MB，当前 GitHub 网络不稳定。
- 处理：放弃整库克隆，改用 GitHub API 按需读取官方文档和源码。
- 结论：后续所有 DSH 研究均通过 API/raw 读取，不再 clone。

### 13:40 MVP 骨架

- 创建 `dsh-skill-market` 项目。
- 组件：
  - `apps/api`：Node 原生 HTTP API。
  - `apps/web`：独立 Web 市场前端。
  - `packages/dsh-skill-marketplace`：DSH 远程 provider 插件。
  - `tools/cli/dsh-market.mjs`：安装/搜索/发布 CLI。
  - `skills/`：两个示例技能。

### 13:50 第一轮测试

```bash
npm install
npm run seed
npm start
curl http://127.0.0.1:3081/api/v1/stats
```

- 结果：API 返回 2 个技能，统计正常。

### 14:20 provider 修复

- 问题：`toCandidate` 引用了 `apply` 闭包内的 `endpoint/providerName/rank` 导致 `ReferenceError`。
- 修复：把 `toCandidate` 移入 `apply` 闭包。
- 验证：`npm test` 全部通过。

### 14:27 DSH 客户端插件研究

- 研究官方 `@deepseek-ai/dsh-client-ui-settings-plugins` 的 bundle 与 slot 注册。
- 结论：在 DSH Web UI 中可注册 `settings.plugins.tab` 标签页。

### 14:35 新增客户端插件

- 新增 `packages/dsh-skill-marketplace/client.js`。
- 功能：在 DSH Web UI 设置 → 插件下新增“技能市场”标签，支持搜索/预览/复制安装命令。
- 更新 `package.json`：增加 `dsh.client` 声明与 `exports["./client"]`。

### 14:45 DSH 真机冒烟（临时 profile）

```bash
# /tmp/dsh-home/profiles/smoke
npm install
DSH_HOME=/tmp/dsh-home npx dsh --profile smoke --dump-config
DSH_HOME=/tmp/dsh-home npx dsh --profile smoke --port 3199 --host 127.0.0.1
```

- `--dump-config` 输出包含 `@dsh-skill-market/dsh-skill-marketplace` bundle 层。
- Web UI 启动成功。
- `window.__DSH_BOOT__` 包含客户端 bundle：
  `@dsh-skill-market/dsh-skill-marketplace/client.js?rev=c5145f5b790d`
- `/plugins/@dsh-skill-market/dsh-skill-marketplace/client.js` 返回 200，语法检查通过。

### 14:50 真实 SkillRegistry 契约验证

```js
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
new SkillRegistry(root)
apply(root, Config({ endpoint: ..., providerName: 'market' }))
await root.skills.list({})
await root.skills.get('demo-skill', {})
```

- `list()` 返回 market provider 候选。
- `get()` 返回 `{ content: '# hi', provider: 'market', resourceBase: { kind: 'url' } }`。
- 说明插件满足官方 `ctx.skills.registerProvider` 契约。

### 15:10 用户要求暂停并交接

- 已按用户要求停止继续开发。
- 清理测试进程（3081/3199）。
- 编写 `docs/HANDOVER.md` 与 `docs/LOG.md`。
- 准备 git 初始化并推送到 GitHub。

## 测试命令速查

```bash
# 全量测试
cd dsh-skill-market
npm test

# 独立验证
npm run seed
npm start

# DSH 冒烟（需要已安装 @deepseek-ai/dsh）
DSH_HOME=<临时目录> npx dsh --profile <profile> --dump-config
DSH_HOME=<临时目录> npx dsh --profile <profile> --port <port> --host 127.0.0.1
```
