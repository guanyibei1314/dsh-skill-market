import fs from 'node:fs/promises'
import path from 'node:path'
import { parseSkillMarkdown, readSkillBundle, pathTraversalSafe, assertSkillName } from './skill-utils.mjs'

export class SkillStore {
  constructor(options = {}) {
    this.root = path.resolve(options.root ?? process.env.SKILL_REGISTRY_DIR ?? 'skills')
    this.cacheDir = path.resolve(options.cacheDir ?? process.env.SKILL_CACHE_DIR ?? 'registry/.cache')
    this.parseCache = new Map() // name -> { mtimeMs, skill }
    this.downloads = new Map()
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true })
    await fs.mkdir(this.cacheDir, { recursive: true })
    await this.#loadDownloads()
  }

  async #loadDownloads() {
    try {
      const raw = await fs.readFile(path.join(this.cacheDir, 'downloads.json'), 'utf8')
      const data = JSON.parse(raw)
      for (const [name, count] of Object.entries(data)) this.downloads.set(name, Number(count) || 0)
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[store] 下载计数读取失败:', error.message)
    }
  }

  async #saveDownloads() {
    const data = Object.fromEntries(this.downloads)
    await fs.mkdir(this.cacheDir, { recursive: true })
    await fs.writeFile(path.join(this.cacheDir, 'downloads.json'), JSON.stringify(data, null, 2), 'utf8')
  }

  #skillDir(name) {
    return path.join(this.root, name)
  }

  async #readMarketManifest(name) {
    try {
      const raw = await fs.readFile(path.join(this.#skillDir(name), 'skill.json'), 'utf8')
      return JSON.parse(raw)
    } catch (error) {
      if (error.code === 'ENOENT') return {}
      throw error
    }
  }

  async #loadOne(name, { refresh = false } = {}) {
    assertSkillName(name)
    const dir = this.#skillDir(name)
    const skillFile = path.join(dir, 'SKILL.md')
    let stat
    try {
      stat = await fs.stat(skillFile)
    } catch (error) {
      if (error.code === 'ENOENT') return undefined
      throw error
    }
    const mtimeMs = stat.mtimeMs
    const cached = this.parseCache.get(name)
    if (!refresh && cached && Math.abs(cached.mtimeMs - mtimeMs) < 1) return cached.skill

    const raw = await fs.readFile(skillFile, 'utf8')
    const parsed = parseSkillMarkdown(raw, name)
    if (parsed.name !== name) {
      throw new Error(`技能目录 ${name} 中 SKILL.md 声明的 name 是 "${parsed.name}"，两者必须一致`)
    }
    const manifest = await this.#readMarketManifest(name)
    const metadata = { ...(parsed.metadata ?? {}), ...(manifest.metadata ?? {}) }
    const skill = {
      name: parsed.name,
      description: parsed.description,
      whenToUse: parsed.whenToUse,
      invocation: parsed.invocation,
      metadata,
      version: manifest.version ?? metadata.version ?? '0.0.0',
      author: manifest.author ?? metadata.author ?? 'anonymous',
      license: manifest.license ?? metadata.license ?? 'MIT',
      tags: manifest.tags ?? (Array.isArray(metadata.tags) ? metadata.tags : []),
      homepage: manifest.homepage,
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      downloads: this.downloads.get(name) ?? 0,
    }
    this.parseCache.set(name, { mtimeMs, skill })
    return skill
  }

  async list({ q, tag, sort = 'name' } = {}) {
    const entries = await fs.readdir(this.root, { withFileTypes: true })
    const skills = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) continue
      try {
        const skill = await this.#loadOne(entry.name)
        if (skill) skills.push(skill)
      } catch (error) {
        console.warn(`[store] 跳过技能 ${entry.name}:`, error.message)
      }
    }
    const ql = q?.trim().toLowerCase()
    const filtered = skills.filter((skill) => {
      if (ql) {
        const haystack = [skill.name, skill.description, skill.whenToUse ?? '', ...(skill.tags ?? [])]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(ql)) return false
      }
      if (tag && !(skill.tags ?? []).includes(tag)) return false
      return true
    })
    filtered.sort((a, b) => {
      switch (sort) {
        case 'updated': return b.updatedAt.localeCompare(a.updatedAt)
        case 'downloads': return b.downloads - a.downloads
        case 'name':
        default: return a.name.localeCompare(b.name)
      }
    })
    return filtered
  }

  async get(name, { includeFiles = false } = {}) {
    const skill = await this.#loadOne(name)
    if (!skill) return undefined
    const liveSkill = { ...skill, downloads: this.downloads.get(name) ?? 0 }
    if (!includeFiles) return liveSkill
    const dir = this.#skillDir(name)
    const files = await readSkillBundle(dir)
    files.delete('skill.json')
    return { ...liveSkill, files: Object.fromEntries(files) }
  }

  async getContent(name) {
    const skill = await this.#loadOne(name)
    if (!skill) return undefined
    return fs.readFile(path.join(this.#skillDir(name), 'SKILL.md'), 'utf8')
  }

  async getAsset(name, relative) {
    const skill = await this.#loadOne(name)
    if (!skill) return undefined
    const safe = pathTraversalSafe(relative)
    if (!safe) return { error: '路径非法', status: 400 }
    const absolute = path.resolve(this.#skillDir(name), safe)
    const inside = path.resolve(this.#skillDir(name)) + path.sep
    if (absolute !== path.resolve(this.#skillDir(name)) && !absolute.startsWith(inside)) {
      return { error: '路径越界', status: 403 }
    }
    try {
      return { data: await fs.readFile(absolute), type: guessContentType(absolute) }
    } catch (error) {
      if (error.code === 'ENOENT') return undefined
      throw error
    }
  }

  async writeSkill(publisher, { files, allowUpdate = false }) {
    const markdown = files['SKILL.md']
    if (typeof markdown !== 'string') throw Object.assign(new Error('发布包必须包含 SKILL.md'), { status: 400 })
    const parsed = parseSkillMarkdown(markdown, undefined)
    const { name } = parsed
    const dir = this.#skillDir(name)
    const exists = await fs.stat(dir).then(() => true, () => false)
    if (exists && !allowUpdate) throw Object.assign(new Error(`技能 "${name}" 已存在`), { status: 409 })

    await fs.mkdir(dir, { recursive: true })
    for (const [relative, content] of Object.entries(files)) {
      if (relative === 'skill.json' && exists) continue // 不覆盖市场管理字段
      const safe = pathTraversalSafe(relative)
      if (!safe) throw Object.assign(new Error(`拒绝写入不安全路径: ${relative}`), { status: 400 })
      const target = path.resolve(dir, safe)
      const prefix = dir + path.sep
      if (!target.startsWith(prefix)) throw Object.assign(new Error(`路径越界: ${relative}`), { status: 400 })
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8')
    }
    this.parseCache.delete(name)
    return this.#loadOne(name, { refresh: true })
  }

  async bumpDownload(name) {
    if (!this.downloads.has(name)) this.downloads.set(name, 0)
    this.downloads.set(name, this.downloads.get(name) + 1)
    await this.#saveDownloads()
  }

  async stats() {
    const skills = await this.list()
    return {
      total: skills.length,
      downloads: skills.reduce((sum, skill) => sum + skill.downloads, 0),
      tags: [...new Set(skills.flatMap((skill) => skill.tags ?? []))].sort(),
      updatedAt: skills.map((skill) => skill.updatedAt).sort().at(-1) ?? null,
    }
  }
}

function guessContentType(file) {
  const extension = path.extname(file).toLowerCase()
  return {
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }[extension] ?? 'application/octet-stream'
}
