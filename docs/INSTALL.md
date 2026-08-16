# 安装与下载方法

本仓库包含三类可交付物：

1. **市场服务**（API + Web）
2. **DSH 远程 provider + Web UI 插件**（`@dsh-skill-market/dsh-skill-marketplace`）
3. **CLI 安装器**（`dsh-market`）

## 0. 先决条件

- Node.js >= 20.11
- DeepSeek Harness（可选，仅使用远程 provider/Web UI 标签时需要）
- pnpm 或 npm

## 1. 克隆仓库

```bash
git clone <你的 GitHub 仓库 URL>
cd dsh-skill-market
npm install
```

> 本仓库当前为 monorepo，根目录是私有 `package.json`，不能直接用 `dsh plugin add github:...` 安装整仓。
> 请按下方方法 3/4 获取可安装的 DSH 插件包。

## 2. 本地安装技能（最简单）

启动市场服务后：

```bash
npm start
# 另一个终端
npm run market -- search code-reviewer
npm run market -- install code-reviewer
```

这会安装到 `~/.dsh/skills`。DSH 自动发现，无需额外插件。

## 3. 构建 DSH 插件包（tarball，已验证）

```bash
cd dsh-skill-market
npm run pack:plugin
# 产物：dist/dsh-skill-market-dsh-skill-marketplace-0.1.0.tgz
```

在 DSH profile 目录安装：

```bash
# 进入 profile 目录（例如 $DSH_HOME/profiles/web）
npm install <上一步 tgz 的绝对路径>
```

或在 profile 的 `package.json` 中添加：

```json
{
  "dependencies": {
    "@dsh-skill-market/dsh-skill-marketplace": "file:/绝对路径/dsh-skill-market-dsh-skill-marketplace-0.1.0.tgz"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@dsh-skill-market/dsh-skill-marketplace"
      ]
    }
  }
}
```

然后在 profile 的 `cordis.patch.yml` 中配置市场地址：

```yaml
- insert:
    - id: skill-marketplace
      name: '@dsh-skill-market/dsh-skill-marketplace'
      config:
        endpoint: 'http://127.0.0.1:3081'
```

启动 DSH：

```bash
DSH_HOME=<dsh-home> npx dsh --profile <profile>
```

Web UI 中进入 **设置 → 插件 → 技能市场** 即可浏览；模型会话会自动出现 `<available_skills>` 市场技能目录。

## 4. 从 GitHub 获取源码并手动 pack

如果尚未发布 npm 包，可以：

```bash
git clone <你的 GitHub 仓库 URL>
cd dsh-skill-market
npm install
npm run pack:plugin
```

然后按方法 3 安装 tarball。

后续计划：

- 发布到 npm：`npm publish --workspace @dsh-skill-market/dsh-skill-marketplace`
- GitHub Actions 自动生成 `dist/*.tgz` 作为 release 附件
- 提供 `dsh plugin add <tarball-url>` 一行安装

## 5. 环境变量

| 变量 | 作用 |
|---|---|
| `PORT` | 市场服务端口，默认 3081 |
| `MARKET_API_KEY` | 发布技能所需的 API Key |
| `DSH_MARKET_ENDPOINT` | CLI 连接的市场地址，默认 `http://127.0.0.1:3081` |
| `DSH_HOME` | DSH 配置根目录，默认 `~/.dsh` |

## 6. 已验证的下载链路

- ✅ `npm run pack:plugin` 产出 tarball
- ✅ tarball 安装到临时 DSH profile
- ✅ `dsh --dump-config` 正确加载 bundle
- ✅ DSH Web UI 启动后下发 `client.js`
- ⏳ npm 发布、GitHub Release 附件、`dsh plugin add github:...` 尚未完成（见 `HANDOVER.md`）
