import Schema from '@deepseek-ai/schemastery'

export const name = 'skill-marketplace'
export const inject = ['skills']

export const Config = Schema.object({
  endpoint: Schema.string().default('http://127.0.0.1:3081'),
  providerName: Schema.string().default('marketplace'),
  rank: Schema.number().default(450),
  timeoutMs: Schema.number().default(10000),
  cacheTtlMs: Schema.number().default(60000),
})

const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * 远程技能市场 provider。
 *
 * 它实现了 DeepSeek Harness 的 `ctx.skills.registerProvider` 契约：
 * - `list()` 把市场 API 的摘要映射为 SkillCandidate（rank 默认 450，
 *   因此项目技能 > 本项目 > 用户 ~/.dsh/skills；可在 cordis.patch.yml 中调整）。
 * - `get()` 按需从市场 API 拉取 SKILL.md 正文并剥掉 frontmatter。
 * - 网络失败时返回 `complete: false`，让 dsh 保留上一次可用的模型目录。
 */
export function apply(ctx, config) {
  const endpoint = String(config.endpoint ?? 'http://127.0.0.1:3081').replace(/\/+$/, '')
  const providerName = String(config.providerName ?? 'marketplace')
  const rank = Number(config.rank ?? 450)
  const timeoutMs = Math.max(100, Number(config.timeoutMs ?? 10000))
  const cacheTtlMs = Math.max(0, Number(config.cacheTtlMs ?? 60000))
  const log = (message, ...args) => {
    if (ctx?.logger?.info) ctx.logger.info(`[${providerName}] ${message}`, ...args)
  }

  const cache = new Map()

  const toCandidate = (skill) => {
    if (!skill || typeof skill !== 'object') return undefined
    const candidateName = typeof skill.name === 'string' ? skill.name : ''
    if (!SKILL_NAME_RE.test(candidateName)) return undefined
    const description = typeof skill.description === 'string' ? skill.description : ''
    if (!description) return undefined
    const modelInvocable = skill.invocation?.modelInvocable !== false
    const userInvocable = skill.invocation?.userInvocable !== false
    return {
      name: candidateName,
      description,
      whenToUse: typeof skill.whenToUse === 'string' ? skill.whenToUse : undefined,
      invocation: { modelInvocable, userInvocable },
      source: 'marketplace',
      provider: providerName,
      resourceBase: {
        kind: 'url',
        url: `${endpoint}/api/v1/skills/${encodeURIComponent(candidateName)}/files/`,
      },
      rank,
      locator: { name: candidateName, version: skill.version ?? '0.0.0' },
      metadata: skill.metadata,
    }
  }

  const provider = {
    name: providerName,

    async list(options = {}) {
      const cwd = options.cwd ?? ''
      const key = cwd || '<default>'
      const cached = cache.get(key)
      if (cached && Date.now() - cached.at < cacheTtlMs) {
        return cached.candidates
      }

      const signal = withTimeout(options.signal, timeoutMs)
      try {
        const url = new URL('/api/v1/skills', endpoint)
        if (cwd) url.searchParams.set('cwd', cwd)
        const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error(`marketplace HTTP ${response.status}`)
        const payload = await response.json()
        const candidates = (Array.isArray(payload?.skills) ? payload.skills : [])
          .map((skill) => toCandidate(skill))
          .filter(Boolean)
        cache.set(key, { at: Date.now(), candidates })
        log(`发现 ${candidates.length} 个技能 (cwd: ${cwd || '<default>'})`)
        return candidates
      } catch (error) {
        if (isAbort(error)) return incomplete(cached?.candidates ?? [])
        log(`列表请求失败，返回不完整快照: ${error.message}`)
        return incomplete(cached?.candidates ?? [])
      }
    },

    async get(candidate, options = {}) {
      const name = candidate?.locator?.name ?? candidate?.name
      if (!name || !SKILL_NAME_RE.test(name)) return undefined
      const signal = withTimeout(options.signal, timeoutMs)
      try {
        const response = await fetch(`${endpoint}/api/v1/skills/${encodeURIComponent(name)}/content`, {
          signal,
          headers: { accept: 'text/markdown' },
        })
        if (!response.ok) return undefined
        const raw = await response.text()
        const content = stripFrontmatter(raw)
        if (!content) return undefined
        return {
          name,
          description: candidate.description,
          whenToUse: candidate.whenToUse,
          invocation: candidate.invocation ?? { modelInvocable: true, userInvocable: true },
          source: candidate.source ?? 'marketplace',
          provider: providerName,
          resourceBase: {
            kind: 'url',
            url: `${endpoint}/api/v1/skills/${encodeURIComponent(name)}/files/`,
          },
          content,
          metadata: candidate.metadata,
        }
      } catch (error) {
        log(`加载技能 ${name} 失败: ${error.message}`)
        return undefined
      }
    },
  }

  if (!ctx?.skills?.registerProvider) {
    throw new Error('skill-marketplace 需要 ctx.skills（@deepseek-ai/dsh-skill）；请确认 bundle 顺序或 inject: ["skills"]')
  }

  ctx.skills.registerProvider(() => provider)
  log(`已注册远程技能市场 provider (endpoint=${endpoint}, rank=${rank})`)
}

function stripFrontmatter(raw) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw)
  return (match ? raw.slice(match[0].length) : raw).trim()
}

function incomplete(candidates) {
  return { candidates, complete: false }
}

function withTimeout(parentSignal, timeoutMs) {
  if (parentSignal && timeoutMs > 0) {
    return AbortSignal.any([parentSignal, AbortSignal.timeout(timeoutMs)])
  }
  if (parentSignal) return parentSignal
  return timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined
}

function isAbort(error) {
  return error?.name === 'AbortError' || error?.name === 'TimeoutError'
}
