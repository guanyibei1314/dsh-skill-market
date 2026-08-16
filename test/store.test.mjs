import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { SkillStore } from '../apps/api/src/store.mjs'

test('store 发现、读取并安装技能', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-market-store-'))
  const store = new SkillStore({ root, cacheDir: path.join(root, '.cache') })
  await store.init()
  await store.writeSkill('publisher', {
    files: {
      'SKILL.md': `---
name: demo-skill
description: 用于测试的技能
metadata:
  version: 0.1.0
---
# Demo
`,
      'assets/help.md': '# help',
    },
  })
  const list = await store.list()
  assert.equal(list.length, 1)
  assert.equal(list[0].name, 'demo-skill')
  const bundle = await store.get('demo-skill', { includeFiles: true })
  assert.equal(bundle.files['assets/help.md'], '# help')
  const content = await store.getContent('demo-skill')
  assert.match(content, /name: demo-skill/)
  const asset = await store.getAsset('demo-skill', 'assets/help.md')
  assert.equal(asset.data.toString(), '# help')
  await store.bumpDownload('demo-skill')
  assert.equal((await store.get('demo-skill')).downloads, 1)
  await fs.rm(root, { recursive: true, force: true })
})
