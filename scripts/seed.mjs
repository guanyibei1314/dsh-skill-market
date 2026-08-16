import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SkillStore } from '../apps/api/src/store.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const store = new SkillStore({ root: path.join(root, 'skills') })
await store.init()
const skills = await store.list()
console.log(`已校验 ${skills.length} 个技能：`)
for (const skill of skills) {
  console.log(`- ${skill.name} v${skill.version}: ${skill.description}`)
}
if (skills.length === 0) {
  console.warn('skills/ 目录为空。请按 skills/<name>/SKILL.md 的格式添加技能。')
  process.exitCode = 1
}
