# 架构说明

## 目标

做一个“适配 deepseek-harness 的技能市场”，核心不是再做一套新 skill 格式，而是把市场能力挂到 DSH 已经定义好的 `ctx.skills` seam 上。

## 数据流

### 安装型（推荐默认）

```text
发布者 ── POST /api/v1/skills ──> 市场 API ──> skills/<name>/SKILL.md
用户   ── dsh-market install ──> 市场 API bundle
                                └──> ~/.dsh/skills/<name>/SKILL.md
DSH    ── dsh-skill-filesystem 扫描并监视该目录
        └──> ctx.skills 注册 filesystem provider
        └──> dsh-tool-skill 渲染 <available_skills>
```

### 远程 provider 型

```text
DSH boot
  └── profile bundle: @dsh-skill-market/dsh-skill-marketplace
        └── apply(ctx) 调用 ctx.skills.registerProvider(marketplace)

每个 agent/pre-step
  └── dsh-tool-skill 调 ctx.skills.snapshot()
        └── marketplace.list({cwd, signal})
              └── GET /api/v1/skills
              └── 返回 SkillCandidate[]（rank 默认 450）

模型调用 skill("code-reviewer")
  └── dsh-tool-skill 调 ctx.skills.get(name)
        └── marketplace.get(candidate, {cwd, signal})
              └── GET /api/v1/skills/code-reviewer/content
              └── 剥掉 frontmatter，返回 SkillDefinition
              └── dsh-skill 渲染 <skill_content>
```

## Provider 契约

插件只依赖 DSH 的公开契约：

- `ctx.skills.registerProvider(create)`：同步注册；远程初始化放在 `list()` 的 await 阶段。
- `list(options)`：`options.signal` 取消发现；网络失败返回 `{ candidates, complete: false }` 而不是抛错，避免 DSH 把 provider 从快照中整体省略。
- `get(candidate, options)`：只加载之前返回过的候选；`locator` 是 `{ name, version }`。
- `resourceBase: { kind: 'url', url: ... }`：技能正文中的相对资源引用由市场静态文件服务解析。

## 优先级设计

DSH 本地 filesystem provider 的 rank：

| rank | 来源 |
|---|---|
| 100 | 项目 `.dsh/skills` |
| 200 | 项目 `.agents/skills` |
| 300 | 自定义目录 |
| 400 | 用户 `~/.dsh/skills` |
| 500 | 用户 `~/.agents/skills` |
| 600 | bundled |

市场 provider 默认 `rank: 450`：已安装到 `~/.dsh/skills` 的用户技能赢过远程市场，市场赢过 `~/.agents/skills`。团队可以把市场 bundle 的 `rank` 调到 `150`，让组织级市场覆盖本地默认技能（不建议设为 `50`，以免项目 `.dsh/skills` 无法覆盖）。

## 可靠性

- API 层按 SKILL.md 的 mtime 缓存解析结果；技能目录变更后下一次请求即刷新。
- CLI 安装做路径穿越校验，写入前校验 `SKILL.md` frontmatter。
- 远程 provider 对 `list()` 做内存 TTL 缓存；网络失败时保留旧目录并标记 `complete: false`。
- 下载计数写入 `registry/.cache/downloads.json`，是尽力而为的统计，不是计费数据源。

## 演进

市场 API 的 `GET /api/v1` 返回能力描述，provider 插件未来可据此做握手和版本协商；当前插件按 `apiVersion: v1` 的字段契约实现，后端不可破坏性改字段。
