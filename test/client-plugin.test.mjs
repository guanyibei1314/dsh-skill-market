import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

test('DSH 客户端 bundle 注册 settings.plugins.tab', async () => {
  let loaded
  globalThis.window = {
    __ModuleLoader__: {
      load(record) { loaded = record },
    },
  }
  const fakeReact = {
    useState: (value) => [value, () => {}],
    useCallback: (fn) => fn,
    useEffect: () => {},
    createElement: (type, props, ...children) => ({ type, props, children }),
  }
  const moduleUrl = pathToFileURL(path.resolve('packages/dsh-skill-marketplace/client.js'))
  await import(`${moduleUrl.href}?test=${Date.now()}`)
  assert.ok(loaded, 'bundle 已注册')
  assert.equal(loaded.id, '@dsh-skill-market/dsh-skill-marketplace')

  let registration
  let disposed = false
  const ctx = {
    slots: {
      inject(key, callback) {
        assert.equal(key, 'settings.plugins.tab')
        registration = callback()
      },
      register(options, component) {
        return { options, component, dispose: () => { disposed = true } }
      },
    },
    logger: { warn() {} },
  }
  const exports = loaded.factory((specifier) => {
    assert.equal(specifier, 'react')
    return fakeReact
  })
  exports.apply(ctx, { endpoint: 'https://market.example.com' })
  assert.ok(registration)
  assert.equal(registration.options.id, 'skill-marketplace')
  assert.equal(registration.options.label, '技能市场')
  assert.equal(window.DSH_SKILL_MARKET_ENDPOINT, 'https://market.example.com')
  assert.equal(exports.inject[0], 'slots')
  delete globalThis.window
})
