import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function projectRoot(metaUrl = import.meta.url) {
  // apps/api/src/skill-utils.mjs -> repository root
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), '../../..')
}

export function assertSkillName(name) {
  if (typeof name !== 'string' || !SKILL_NAME_RE.test(name)) {
    throw Object.assign(new Error(`非法技能名 "${name}"，必须是小写 kebab-case（如 code-reviewer）`), { status: 400 })
  }
}

export function parseBoolean(value, field) {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'on', '1'].includes(normalized)) return true
    if (['false', 'no', 'off', '0'].includes(normalized)) return false
  }
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1
  throw new TypeError(`frontmatter 字段 "${field}" 必须是布尔值`)
}

/**
 * 解析 DSH 本地 provider 兼容的 SKILL.md。
 * 本地 provider 要求 YAML frontmatter 中至少包含 name 与 description。
 */
export function parseSkillMarkdown(raw, fallbackName) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!match) {
    throw new Error(`缺少 YAML frontmatter：DSH 要求 SKILL.md 以 --- 开头并包含 name/description`)
  }
  let data
  try {
    data = parseYaml(match[1])
  } catch (cause) {
    throw new Error(`frontmatter YAML 解析失败: ${cause.message}`)
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('frontmatter 必须是 YAML 对象')
  }
  const name = typeof data.name === 'string' ? data.name.trim() : fallbackName
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  assertSkillName(name)
  if (!description) throw new Error('frontmatter 缺少 description')
  const invocation = {
    modelInvocable: !(parseBoolean(data['disable-model-invocation'], 'disable-model-invocation') ?? false),
    userInvocable: parseBoolean(data['user-invocable'], 'user-invocable') ?? true,
  }
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
    ? data.metadata
    : undefined
  return {
    name,
    description,
    whenToUse: typeof data.whenToUse === 'string' ? data.whenToUse.trim() : undefined,
    invocation,
    metadata,
    content: raw.slice(match[0].length).trim(),
    rawFrontmatter: data,
  }
}

/** 递归读取目录下所有文件为 { relativePath, content }，用于发布与安装。 */
export async function readSkillBundle(dir) {
  const root = path.resolve(dir)
  const files = new Map()
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
      } else if (entry.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join('/')
        files.set(relative, await fs.readFile(absolute, 'utf8'))
      }
    }
  }
  await walk(root)
  return files
}

export function pathTraversalSafe(relative) {
  const normalized = path.posix.normalize(relative)
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) return false
  return normalized
}
