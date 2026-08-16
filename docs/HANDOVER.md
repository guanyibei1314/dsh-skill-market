# 交接文档

> 状态：MVP 已完成，已做 DSH 真机冒烟验证；公网运营、账号/审核/数据库、正式 UI 回归和 npm 发布留待下一步。
> 更新时间：2026-08-16

## 1. 项目是什么

`dsh-skill-market` 是一个面向 DeepSeek Harness（`dsh`）的社区技能市场。

它没有另造一套技能格式，而是复用 DSH 官方 skill 体系：

- 技能 = `SKILL.md` + 可选 `assets/`，frontmatter 至少含 `name`、`description`。
- DSH 本地发现目录：`~/.dsh/skills`、项目 `.dsh/skills` 等。
- DSH 远程 provider：`ctx.skills.registerProvider`，让市场技能直接进入模型会话的 `<available_skills>`。

## 2. 已实现功能

| 模块 | 功能 | 状态 |
|---|---|---|
| `apps/api` | 市场 API：搜索/列表/详情/正文/资源文件/bundle/发布/统计 | ✅ 可运行 |
| `apps/web` | 独立 Web 市场页面（原生 JS） | ✅ 可运行 |
| `packages/dsh-skill-marketplace` | DSH 远程 SkillProvider 插件 + DSH Web UI 设置页“技能市场”标签 | ✅ 冒烟通过 |
| `tools/cli/dsh-market.mjs` | `search/show/install/publish/remote` CLI | ✅ 测试通过 |
| `skills/` | 两个示例技能：`changelog-writer`、`code-reviewer` | ✅ |
| `test/` | 8 个自动化测试 | ✅ 全绿 |

## 3. 关键验证记录

### 3.1 单元/集成测试

```bash
cd dsh-skill-market
npm test
```

结果：`8 pass / 0 fail`

覆盖：

- `skill-utils`：frontmatter 解析、kebab-case 校验、路径穿越防护。
- `store`：技能发布、发现、bundle、下载计数。
- `provider`：远程 provider 的 `list()`/`get()` 与网络失败降级。
- `client-plugin`：DSH 客户端 bundle 能注册 `settings.plugins.tab`。

### 3.2 DSH 真机冒烟

在临时环境安装 `@deepseek-ai/dsh@0.1.0-rc.6` 验证：

1. `dsh --profile smoke --dump-config`
   - 成功输出包含我们的 bundle 层 `@dsh-skill-market/dsh-skill-marketplace`。
2. `dsh --profile smoke --port 3199 --host 127.0.0.1`
   - Web UI 正常启动。
   - 页面 `window.__DSH_BOOT__` 包含我们的客户端条目：
     `@dsh-skill-market/dsh-skill-marketplace/client.js?rev=...`
   - `/plugins/@dsh-skill-market/dsh-skill-marketplace/client.js` 可访问，JS 语法校验通过。
3. 使用真实 `@deepseek-ai/dsh-skill` `SkillRegistry` 加载本插件：
   - `ctx.skills.list()` 返回 market provider 的候选。
   - `ctx.skills.get('demo-skill')` 返回正确正文，说明满足官方 provider 契约。

### 3.3 CLI/API

```bash
npm start   # 启动市场 API + Web
npm run market search
npm run market install changelog-writer --target /tmp/dsh-target
```

均已跑通。

## 4. 目录结构与入口

```text
dsh-skill-market/
├── README.md
├── docs/
│   ├── HANDOVER.md          # 本文件
│   └── LOG.md               # 开发日志
├── apps/
│   ├── api/src/server.mjs   # HTTP 服务入口
│   └── web/                 # 独立市场前端
├── packages/dsh-skill-marketplace/
│   ├── index.js             # DSH 宿主侧远程 provider
│   ├── client.js            # DSH Web UI 设置页插件
│   └── cordis.patch.yml     # DSH bundle patch
├── tools/cli/dsh-market.mjs # CLI
├── scripts/seed.mjs         # 技能校验/统计
└── test/                    # 自动化测试
```

### 常用命令

```bash
npm install
npm run seed
npm start                # 默认 http://127.0.0.1:3081
npm test
npm run market -- search review
npm run market -- install code-reviewer
```

### DSH 接入方式

方式 A：本地安装（无需插件）

```bash
dsh-market install <skill-name>
```

方式 B：远程 provider + Web UI 标签

1. 构建/获取 `@dsh-skill-market/dsh-skill-marketplace` 包。
2. 将其加入 DSH profile 的 bundle 列表，patch 中配置：

```yaml
- insert:
    - id: skill-marketplace
      name: '@dsh-skill-market/dsh-skill-marketplace'
      config:
        endpoint: 'https://你的市场域名'
        providerName: marketplace
        rank: 450
        timeoutMs: 10000
        cacheTtlMs: 60000
```

3. 启动 DSH Web UI，进入 **设置 → 插件 → 技能市场** 即可浏览市场。

## 5. 已知限制（交接时需知晓）

1. **公网运营未完成**：
   - 没有用户注册/登录。
   - 发布只依赖 `MARKET_API_KEY`，没有审核队列、人工审核、恶意代码扫描、技能签名。
   - 存储仍是文件系统 + 内存缓存，不是 SQLite/Postgres。
2. **Web UI e2e 尚未跑完**：
   - 已验证 DSH 能加载并下发客户端 bundle，但 Playwright 浏览器自动化只进行到“设置 → 模型引导”，未完成“设置 → 插件 → 技能市场”的点击链路（按用户要求暂停）。
3. **GitHub 直接安装未最终验证**：
   - 当前包位于 monorepo 子目录 `packages/dsh-skill-marketplace`，`dsh plugin add github:...` 直接安装整仓还不适用。
   - 已验证的方式是：在 `packages/dsh-skill-marketplace` 下 `npm pack` 得到 tarball，再通过 `dsh plugin add ./xxx.tgz` 或手动 profile 安装。
   - 后续建议：把该子包发布到 npm，或调整仓库为可安装根包，或提供 GitHub Actions 产物。
4. **DSH 版本兼容**：
   - DSH 处于 developer preview，接口可能破坏性变化。
   - 冒烟测试基于 `@deepseek-ai/dsh@0.1.0-rc.6`；升级 DSH 后需重跑 `npm test` 和冒烟。
5. **远程 provider 的 endpoint 配置**：
   - 宿主侧和浏览器侧都读取 patch 中的 `endpoint`；浏览器侧同时支持 `window.DSH_SKILL_MARKET_ENDPOINT` 覆盖。
   - 公网部署时请使用 HTTPS。

## 6. 下一步建议

1. **部署基础**：Dockerfile + 反向代理 + HTTPS + 数据库（先 SQLite，后 Postgres）。
2. **账号与审核**：OIDC/GitHub 登录、发布审核、版本化、技能签名/哈希。
3. **DSH UI 完善**：完成 Playwright e2e；加入“一键安装到当前 DSH home”的宿主 RPC，而不是只复制命令。
4. **发布通道**：
   - 把 `@dsh-skill-market/dsh-skill-marketplace` 发布到 npm。
   - GitHub Actions 自动构建 tarball/发布 npm。
   - 提供 `dsh plugin add github:...` 或 `dsh plugin add <tarball-url>`。
5. **运营**：热门/评分/举报、搜索优化、数据导出、审计日志、限流持久化。

## 7. 环境与凭据

- 本项目不包含任何密钥。
- 发布技能需自行设置环境变量 `MARKET_API_KEY`。
- Git/GitHub 使用当前机器已登录的 `guanyibei1314` 账号。
