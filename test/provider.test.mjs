import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { apply, Config } from '../packages/dsh-skill-marketplace/index.js'

test('远程 provider 把市场 API 映射为 DSH SkillCandidate 并加载正文', async () => {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname === '/api/v1/skills') {
      return sendJson(response, 200, { skills: [{
        name: 'demo-skill',
        description: '测试技能',
        version: '0.1.0',
        whenToUse: '测试时使用',
        invocation: { modelInvocable: true, userInvocable: false },
        metadata: { level: 1 },
      }] })
    }
    if (url.pathname === '/api/v1/skills/demo-skill/content') {
      response.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8' })
      response.end('---\nname: demo-skill\ndescription: 测试技能\n---\n# Body')
      return
    }
    sendJson(response, 404, { error: 'not found' })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const endpoint = `http://127.0.0.1:${port}`

  const config = Config({ endpoint, providerName: 'test-market', rank: 420, timeoutMs: 2000, cacheTtlMs: 0 })
  let registeredProvider
  const ctx = {
    skills: {
      registerProvider(factory) {
        registeredProvider = factory({ signal: new AbortController().signal, invalidate() {} })
      },
    },
    logger: { info() {} },
  }
  apply(ctx, config)

  const candidates = await registeredProvider.list({})
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].name, 'demo-skill')
  assert.equal(candidates[0].provider, 'test-market')
  assert.equal(candidates[0].rank, 420)
  assert.equal(candidates[0].invocation.userInvocable, false)

  const definition = await registeredProvider.get(candidates[0], {})
  assert.equal(definition.name, 'demo-skill')
  assert.equal(definition.content, '# Body')
  assert.equal(definition.resourceBase.kind, 'url')

  await new Promise((resolve) => server.close(resolve))
})

test('网络失败返回不完整观测而不是抛错', async () => {
  let registeredProvider
  const ctx = {
    skills: { registerProvider(factory) { registeredProvider = factory({ signal: new AbortController().signal, invalidate() {} }) } },
    logger: { info() {} },
  }
  const config = Config({ endpoint: 'http://127.0.0.1:1', providerName: 'offline', rank: 450, timeoutMs: 200, cacheTtlMs: 0 })
  apply(ctx, config)
  const result = await registeredProvider.list({})
  assert.equal(Array.isArray(result), false)
  assert.equal(result.complete, false)
  assert.deepEqual(result.candidates, [])
})

function sendJson(response, status, data) {
  const body = JSON.stringify(data)
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(body)
}
