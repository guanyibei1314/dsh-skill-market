import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSkillMarkdown, pathTraversalSafe, assertSkillName } from '../apps/api/src/skill-utils.mjs'

test('解析 DSH 兼容的 SKILL.md frontmatter', () => {
  const parsed = parseSkillMarkdown(`---
name: demo-skill
description: 演示技能
disable-model-invocation: false
user-invocable: true
metadata:
  version: '0.2.0'
---
# 正文
`, undefined)
  assert.equal(parsed.name, 'demo-skill')
  assert.equal(parsed.content, '# 正文')
  assert.deepEqual(parsed.invocation, { modelInvocable: true, userInvocable: true })
  assert.equal(parsed.metadata.version, '0.2.0')
})

test('缺少 frontmatter 时失败', () => {
  assert.throws(() => parseSkillMarkdown('# no frontmatter', undefined), /frontmatter/)
})

test('技能名必须是 kebab-case', () => {
  assert.throws(() => assertSkillName('BadName'), /kebab-case/)
  assert.doesNotThrow(() => assertSkillName('code-reviewer'))
})

test('路径穿越防护', () => {
  assert.ok(pathTraversalSafe('assets/example.md'))
  assert.equal(pathTraversalSafe('../secret.txt'), false)
  assert.equal(pathTraversalSafe('/etc/passwd'), false)
})
