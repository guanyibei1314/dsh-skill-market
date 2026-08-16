#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const endpoint = (process.env.DSH_MARKET_ENDPOINT ?? 'http://127.0.0.1:3081').replace(/\/+$/, '')
const command = process.argv[2] ?? 'help'
const args = process.argv.slice(3)

try {
  switch (command) {
    case 'search':
    case 'list':
      await search(args[0])
      break
    case 'show':
    case 'info':
      await show(requireArg(args, 0, 'show <skill-name>'))
      break
    case 'install':
    case 'add':
      await install(requireArg(args, 0, 'install <skill-name>'))
      break
    case 'publish':
      await publish(requireArg(args, 0, 'publish <skill-dir>'))
      break
    case 'remote':
      await remote()
      break
    case 'help':
    default:
      printHelp()
  }
} catch (error) {
  console.error(`\n[错误] ${error.message}`)
  process.exit(1)
}

function printHelp() {
  console.log(`
dsh-market — DeepSeek Harness 技能市场客户端

用法:
  dsh-market search [关键词]                  搜索技能
  dsh-market show <技能名>                    查看技能详情与 SKILL.md
  dsh-market install <技能名> [选项]          安装技能到 DSH 本地发现目录
      --target user|project|<目录>            默认 user: ~/.dsh/skills
      --force                                 覆盖已存在的技能目录
  dsh-market publish <技能目录>               发布技能（需 MARKET_API_KEY）
  dsh-market remote                           显示远程 provider 的接入方式

环境变量:
  DSH_MARKET_ENDPOINT  市场 API 地址（默认 http://127.0.0.1:3081）
  MARKET_API_KEY       发布技能的 API Key
  DSH_HOME             DSH 配置根目录（默认 ~/.dsh）
`)
}

async function api(pathname) {
  const response = await fetch(`${endpoint}${pathname}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try { message = (await response.json()).error ?? message } catch {}
    throw new Error(message)
  }
  return response.json()
}

async function search(query) {
  const url = new URL('/api/v1/skills', endpoint)
  if (query) url.searchParams.set('q', query)
  const { skills, total } = await api(`${url.pathname}${url.search}`)
  if (skills.length === 0) return console.log('没有找到匹配的技能。')
  console.log(`共 ${total} 个匹配技能：\n`)
  for (const skill of skills) {
    const tags = (skill.tags ?? []).join(', ')
    console.log(`${skill.name.padEnd(28)} v${String(skill.version).padEnd(8)} ${skill.downloads} 次安装`)
    console.log(`  ${skill.description}`)
    if (tags) console.log(`  tags: ${tags}`)
    console.log()
  }
}

async function show(name) {
  const skill = await api(`/api/v1/skills/${encodeURIComponent(name)}`)
  const contentResponse = await fetch(`${endpoint}/api/v1/skills/${encodeURIComponent(name)}/content`)
  const content = await contentResponse.text()
  console.log(`${skill.name}  v${skill.version}`)
  console.log(`作者: ${skill.author}  许可: ${skill.license}  安装: ${skill.downloads}`)
  console.log(`描述: ${skill.description}`)
  if (skill.whenToUse) console.log(`何时使用: ${skill.whenToUse}`)
  console.log(`标签: ${(skill.tags ?? []).join(', ') || '-'}`)
  console.log(`调用策略: model=${skill.invocation?.modelInvocable !== false} user=${skill.invocation?.userInvocable !== false}`)
  console.log('\n--- SKILL.md ---\n')
  console.log(content)
}

async function install(name, options = parseInstallOptions()) {
  const skill = await api(`/api/v1/skills/${encodeURIComponent(name)}/bundle`)
  const targetRoot = resolveTarget(options.target)
  const target = path.join(targetRoot, name)
  const exists = await fs.stat(target).then(() => true, () => false)
  if (exists && !options.force) {
    throw new Error(`目标已存在: ${target}\n使用 --force 覆盖，或先手动删除。`)
  }
  await fs.rm(target, { recursive: true, force: true })
  await fs.mkdir(target, { recursive: true })
  let count = 0
  for (const [relative, content] of Object.entries(skill.files ?? {})) {
    if (relative === 'skill.json') continue
    const absolute = path.resolve(target, relative)
    if (!absolute.startsWith(target + path.sep)) throw new Error(`拒绝写入越界路径: ${relative}`)
    await fs.mkdir(path.dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, content, 'utf8')
    count += 1
  }
  console.log(`已安装 ${name} v${skill.version} -> ${target}`)
  console.log(`写入 ${count} 个文件。DSH 的 skill-filesystem 会在几秒内自动发现它（无需重启 dsh 进程）。`)
  console.log(`如果是当前项目，建议提交 ${path.relative(process.cwd(), target)} 让团队共享。`)
}

function parseInstallOptions() {
  const result = { target: 'user', force: false }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--force') result.force = true
    else if (arg === '--target') {
      const value = args[++index]
      if (!value) throw new Error('--target 需要参数 user|project|<目录>')
      result.target = value
    }
  }
  return result
}

function resolveTarget(target) {
  if (target === 'user') {
    const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
    return path.join(home, 'skills')
  }
  if (target === 'project') return path.join(process.cwd(), '.dsh', 'skills')
  return path.resolve(target)
}

async function publish(dir) {
  const rootDir = path.resolve(dir)
  const files = {}
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || entry.name === 'node_modules') continue
      const absolute = path.join(current, entry.name)
      const relative = path.relative(rootDir, absolute).split(path.sep).join('/')
      if (entry.isDirectory()) await walk(absolute)
      else files[relative] = await fs.readFile(absolute, 'utf8')
    }
  }
  await walk(rootDir)
  if (!files['SKILL.md']) throw new Error(`目录中缺少 SKILL.md: ${rootDir}`)
  const apiKey = process.env.MARKET_API_KEY
  const response = await fetch(`${endpoint}/api/v1/skills`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify({ files, publisher: process.env.USER ?? os.userInfo().username }),
  })
  let payload = {}
  try { payload = await response.json() } catch {}
  if (!response.ok) throw new Error(payload.error ?? `发布失败 HTTP ${response.status}`)
  console.log(`已发布 ${payload.name} v${payload.version}`)
  console.log(`市场页面: ${endpoint}/`)
}

async function remote() {
  const installLine = 'dsh plugin --profile web add @dsh-skill-market/dsh-skill-marketplace'
  console.log(`
# 方式一：只启用远程 provider（不改本地文件）
${installLine}

# 然后在该 profile 的 cordis.patch.yml 中追加：
- insert:
    - id: skill-marketplace
      name: '@dsh-skill-market/dsh-skill-marketplace'
      config:
        endpoint: ${endpoint}

# 方式二：本地安装（推荐个人/项目固定技能）
dsh-market install <skill-name>
`)
}

function requireArg(list, index, usage) {
  const value = list[index]
  if (!value) throw new Error(`缺少参数，用法: dsh-market ${usage}`)
  return value
}
