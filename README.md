# DSH 技能市场（dsh-skill-market）

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的**公网社区技能市场** MVP。它不是一个孤立的下载站，而是围绕 DSH 原生的 skill 能力设计：

- **Web 市场**：浏览、搜索、预览技能，零依赖（除 YAML 解析）的 Node API + 静态前端。
- **DSH Web UI 插件页**：在 DSH 的 **设置 → 插件 → 技能市场** 中直接浏览/搜索/复制安装命令。
- **本地安装 CLI**：一键把技能装到 `~/.dsh/skills` 或项目 `.dsh/skills`，DSH 的 `dsh-skill-filesystem` 会自动发现。
- **远程 provider 插件**：`@dsh-skill-market/dsh-skill-marketplace` 实现 DSH 的 `ctx.skills.registerProvider` 契约，让市场技能直接出现在模型会话的 `<available_skills>` 目录中，按需加载，无需安装到本地。
- **标准技能格式**：完全兼容 DSH 的 `SKILL.md` frontmatter 规范。

> DSH 目前处于 developer preview，API 会破坏性变化。本项目的 provider 插件采用防御式实现，只依赖公开的 `ctx.skills` 注册契约。

## 为什么这样设计

DSH 官方已经内置了完整的 skill 能力（`packages/skill/*`）：

| DSH 组件 | 作用 |
|---|---|
| `@deepseek-ai/dsh-skill` | `ctx.skills` 注册表，合并 local/embedded/remote provider |
| `@deepseek-ai/dsh-skill-filesystem` | 从项目、`~/.dsh/skills` 等目录发现技能 |
| `@deepseek-ai/dsh-tool-skill` | 给模型提供 `skill` 工具和 `<available_skills>` 目录 |

本地发现的优先级（低 rank 胜出）：`project-dsh(100)` → `project-agents(200)` → `runtime(250)` → `custom(300)` → `user-dsh(400)` → `user-agents(500)` → `bundled(600)`。

因此技能市场有两种接入方式，本项目都实现了：

1. **安装型**：CLI 从市场拉取 `SKILL.md` 与资源文件，写入本地发现目录。技能固定、离线可用、可被团队 Git 共享；项目技能会覆盖用户技能。
2. **远程型**：provider 插件把市场 API 映射成 `SkillCandidate`。默认 `rank: 450`，所以“项目本地技能 > 用户已安装技能 > 市场远程技能”，用户可调低 rank 改变优先级。

## 文档

- [安装与下载方法](docs/INSTALL.md)
- [交接文档](docs/HANDOVER.md)
- [开发日志](docs/LOG.md)

## 目录结构

```
dsh-skill-market/
├── apps/api/                     # 市场 API（Node 内置 http，无框架）
├── apps/web/                     # 市场前端（原生 JS）
├── packages/dsh-skill-marketplace/
│   ├── index.js                  # DSH 远程 SkillProvider 插件
│   ├── cordis.patch.yml          # 作为 DSH bundle 时的默认 patch
│   └── package.json              # dsh.bundle manifest
├── tools/cli/dsh-market.mjs      # 安装/搜索/发布 CLI
├── skills/                       # 市场技能源（可直接被 DSH 发现）
│   ├── changelog-writer/SKILL.md
│   └── code-reviewer/SKILL.md
├── scripts/seed.mjs              # 校验/统计技能
└── test/                         # 单元与 provider 集成测试
```

## 快速开始

```bash
npm install
npm run seed      # 校验 skills/ 中的示例
npm start         # 默认 http://127.0.0.1:3081
```

打开 `http://127.0.0.1:3081` 即可浏览市场。

环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3081` | 市场服务端口 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `MARKET_API_KEY` | 空 | 发布接口的 API Key；为空时默认禁止发布 |
| `MARKET_ALLOW_ANON_PUBLISH` | `0` | 本地开发时设为 `1` 可免 Key 发布 |
| `SKILL_REGISTRY_DIR` | `./skills` | 技能源目录 |

## CLI 用法

```bash
npm run market search review        # 搜索
npm run market show code-reviewer   # 查看详情
npm run market install code-reviewer            # 安装到 ~/.dsh/skills
npm run market install code-reviewer --target project   # 安装到 ./.dsh/skills
MARKET_API_KEY=xxx npm run market publish ./skills/my-skill
```

也可链接为全局命令：

```bash
npm link tools/cli      # 或 npm link --workspace @dsh-skill-market/cli
dsh-market install code-reviewer
```

安装后 DSH 的 watcher 会在数秒内发现新技能，**不需要重启 dsh 进程**。

## 远程 provider 接入 DSH

把插件作为 bundle 加入 profile，并在 profile 的 `cordis.patch.yml` 配置市场地址：

```yaml
- insert:
    - id: skill-marketplace
      name: '@dsh-skill-market/dsh-skill-marketplace'
      config:
        endpoint: 'http://127.0.0.1:3081'
        providerName: marketplace
        rank: 450          # 数字越小优先级越高
        timeoutMs: 10000
        cacheTtlMs: 60000
```

插件启动后会在 `ctx.skills` 上注册名为 `marketplace` 的 provider。DSH 会在每次符合条件的 `agent/pre-step` 拉取目录，模型调用 `skill <name>` 时再按需拉取正文。

## API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/v1/skills?q=&tag=&sort=` | 技能列表（`sort`: `name`/`updated`/`downloads`） |
| GET | `/api/v1/skills/:name` | 技能元数据 |
| GET | `/api/v1/skills/:name/content` | 原始 `SKILL.md` |
| GET | `/api/v1/skills/:name/bundle` | 元数据 + 全部文件（供 CLI 安装） |
| GET | `/api/v1/skills/:name/files/*` | 技能资源文件 |
| GET | `/api/v1/stats` | 统计 |
| POST | `/api/v1/skills` | 发布（需要 API Key） |
| GET | `/api/v1` | 市场能力描述（含 DSH 接入提示） |

发布请求体：

```json
{
  "publisher": "your-name",
  "files": {
    "SKILL.md": "---\nname: my-skill\ndescription: ...\n---\n正文",
    "assets/template.md": "..."
  }
}
```

## 技能格式

市场技能与 DSH 本地技能格式完全一致：

```markdown
---
name: code-reviewer
description: 对代码变更做结构化审查。
whenToUse: 用户要求 review 或检查 PR。
disable-model-invocation: false   # true 时模型不可调用
user-invocable: true
metadata:
  version: 0.1.0
  tags: [review, code-quality]
---

# 技能正文
```

市场特有的可选文件 `skill.json`（不影响 DSH 解析）：

```json
{
  "version": "0.1.0",
  "author": "your-name",
  "license": "MIT",
  "tags": ["review"],
  "homepage": "https://example.com"
}
```

## 安全说明

- 技能是指令文本，本身不是沙箱内代码，但模型会按其执行命令和读写文件。安装前先审阅 `SKILL.md`，尤其是有 `scripts/`、`assets/` 引用的技能。
- 远程 provider 意味着每个会话都能读取市场目录，但正文在模型调用 `skill` 工具时才传输。
- 发布接口只做 API Key 鉴权，生产环境请放反代/TLS 后面，并增加审核流。
- 市场 API 目前不做用户隔离、审核、签名和恶意代码静态扫描，不能直接公网开放。

## 当前限制与路线图

### 建议下一步（按优先级）

1. **补完 DSH Web UI 端到端测试**
   - 完成 Playwright 点击链路：**设置 → 插件 → 技能市场**。
   - 验证市场列表、搜索、预览、复制安装命令。
   - 若条件允许，加入“一键安装到当前 DSH home”的宿主 RPC，替代只复制命令。
2. **发布 DSH 插件到 npm**
   - 执行 `npm publish --workspace @dsh-skill-market/dsh-skill-marketplace`。
   - 配置 GitHub Actions：打 tag 后自动 `npm run pack:plugin`，并把 tarball 作为 Release 附件。
   - 最终目标：支持 `dsh plugin add <tarball-url>` 或 `dsh plugin add @dsh-skill-market/dsh-skill-marketplace`。
3. **部署为公网社区市场**
   - 加 Dockerfile + 反向代理 + HTTPS。
   - 存储从文件系统迁到 SQLite/Postgres。
   - 增加用户登录（OIDC/GitHub）、发布审核、技能签名/哈希、评分/举报/下载统计持久化。
4. **丰富运营能力**
   - Git 源自动索引（`dsh-plugin` topic）。
   - 版本化与回滚、审计日志、限流持久化、数据导出。
   - 将市场页进一步深度集成进 DSH UI（不限于设置页标签）。

### 当前限制

- MVP：单实例、文件即数据库、公开只读、API Key 发布。
- 未完成：账号/审核/数据库、正式 Playwright 点击链路、npm 发布、GitHub Release 产物。
- DSH preview 的接口可能变化：请锁定本插件 `peerDependencies` 并在升级 `dsh` 后重跑 `npm test`。

详细交接信息见 [docs/HANDOVER.md](docs/HANDOVER.md)，安装方式见 [docs/INSTALL.md](docs/INSTALL.md)。

## 参考

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [DSH 插件打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)
- [DSH skill 子系统](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.zh.md)
