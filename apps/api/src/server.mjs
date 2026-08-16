import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SkillStore } from './store.mjs'
import { pathTraversalSafe } from './skill-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'apps/web')
const PORT = Number(process.env.PORT ?? 3081)
const HOST = process.env.HOST ?? '127.0.0.1'
const API_KEY = process.env.MARKET_API_KEY ?? ''
const ALLOW_ANON_PUBLISH = process.env.MARKET_ALLOW_ANON_PUBLISH === '1'

const store = new SkillStore({ root: path.join(ROOT, 'skills') })
await store.init()

const server = http.createServer(async (request, response) => {
  try {
    await route(request, response)
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500
    if (status >= 500) console.error('[api]', error)
    sendJson(response, status, { error: error.message ?? 'internal error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[dsh-skill-market] http://${HOST}:${PORT}`)
  console.log(`[dsh-skill-market] 技能目录: ${store.root}`)
})

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)

  if (request.method === 'OPTIONS') {
    cors(response)
    response.writeHead(204)
    response.end()
    return
  }

  if (pathname.startsWith('/api/v1/')) {
    cors(response)
    await routeApi(request, response, url)
    return
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method not allowed' })
    return
  }
  await serveStatic(pathname, response)
}

async function routeApi(request, response, url) {
  const parts = url.pathname.replace(/^\/api\/v1\//, '').split('/').filter(Boolean)
  const method = request.method

  if (method === 'GET' && parts.length === 0) return sendJson(response, 200, await descriptor())
  if (method === 'GET' && parts[0] === 'skills' && parts.length === 1) {
    const skills = await store.list({ q: url.searchParams.get('q'), tag: url.searchParams.get('tag'), sort: url.searchParams.get('sort') })
    return sendJson(response, 200, { skills, total: skills.length })
  }
  if (method === 'GET' && parts[0] === 'skills' && parts.length === 2) {
    const skill = await store.get(parts[1])
    if (!skill) return sendJson(response, 404, { error: `技能不存在: ${parts[1]}` })
    return sendJson(response, 200, skill)
  }
  if (method === 'GET' && parts[0] === 'skills' && parts.length === 3 && parts[2] === 'content') {
    const content = await store.getContent(parts[1])
    if (content === undefined) return sendJson(response, 404, { error: `技能不存在: ${parts[1]}` })
    response.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-cache' })
    response.end(content)
    return
  }
  if (method === 'GET' && parts[0] === 'skills' && parts.length === 3 && parts[2] === 'bundle') {
    const skill = await store.get(parts[1], { includeFiles: true })
    if (!skill) return sendJson(response, 404, { error: `技能不存在: ${parts[1]}` })
    await store.bumpDownload(parts[1])
    return sendJson(response, 200, skill)
  }
  if (method === 'GET' && parts[0] === 'skills' && parts.length >= 4 && parts[2] === 'files') {
    const relative = parts.slice(3).join('/')
    const result = await store.getAsset(parts[1], relative)
    if (result === undefined) return sendJson(response, 404, { error: '文件不存在' })
    if (result.error) return sendJson(response, result.status, { error: result.error })
    response.writeHead(200, {
      'Content-Type': result.type,
      'Cache-Control': 'public, max-age=300',
    })
    response.end(result.data)
    return
  }
  if (method === 'GET' && parts[0] === 'stats' && parts.length === 1) {
    return sendJson(response, 200, await store.stats())
  }
  if (method === 'POST' && parts[0] === 'skills' && parts.length === 1) {
    if (!authorized(request)) return sendJson(response, 401, { error: '缺少或无效的 API Key（设置 MARKET_API_KEY，请求头使用 x-api-key 或 Bearer）' })
    const body = await readJson(request, 5 * 1024 * 1024)
    const files = body?.files
    if (typeof files !== 'object' || files === null || Array.isArray(files)) {
      return sendJson(response, 400, { error: '请求体需要 {"files":{"SKILL.md":"...","assets/...":"..."}}' })
    }
    const allowUpdate = url.searchParams.get('update') === '1'
    const skill = await store.writeSkill(body.publisher ?? 'api', { files, allowUpdate })
    return sendJson(response, allowUpdate ? 200 : 201, skill)
  }

  sendJson(response, 404, { error: `未知 API: ${method} /api/v1/${parts.join('/')}` })
}

async function descriptor() {
  return {
    name: 'dsh-skill-market',
    apiVersion: 'v1',
    description: '面向 DeepSeek Harness 的技能市场 API',
    endpoints: {
      skills: '/api/v1/skills',
      skill: '/api/v1/skills/:name',
      content: '/api/v1/skills/:name/content',
      bundle: '/api/v1/skills/:name/bundle',
      publish: 'POST /api/v1/skills',
      stats: '/api/v1/stats',
    },
    dsh: {
      installToLocal: 'dsh-market install <skill-name>',
      remoteProvider: {
        plugin: '@dsh-skill-market/dsh-skill-marketplace',
        patch: [
          '- insert:',
          '    - id: skill-marketplace',
          '      name: @dsh-skill-market/dsh-skill-marketplace',
          `      config: { endpoint: ${JSON.stringify(`http://${HOST}:${PORT}`)} }`,
        ],
      },
    },
  }
}

function authorized(request) {
  if (!API_KEY) {
    if (ALLOW_ANON_PUBLISH) return true
    return false
  }
  const header = request.headers['x-api-key'] ?? request.headers.authorization ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : header
  return timingSafeEqual(bearer, API_KEY)
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

async function readJson(request, maxBytes) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw Object.assign(new Error('请求体过大'), { status: 413 })
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求体不是合法 JSON'), { status: 400 })
  }
}

async function serveStatic(pathname, response) {
  const safe = pathname === '/' ? 'index.html' : pathTraversalSafe(pathname.replace(/^\/+/, ''))
  if (!safe) return sendJson(response, 403, { error: '非法路径' })
  const file = path.join(WEB_DIR, safe)
  try {
    const stat = await fs.stat(file)
    if (stat.isDirectory()) return sendJson(response, 403, { error: '目录不可访问' })
    const data = await fs.readFile(file)
    response.writeHead(200, {
      'Content-Type': contentType(file),
      'Content-Length': data.length,
      'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=300',
    })
    response.end(data)
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'not found' })
    throw error
  }
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase()
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  }[extension] ?? 'application/octet-stream'
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data, null, 2)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-API-Key')
}
