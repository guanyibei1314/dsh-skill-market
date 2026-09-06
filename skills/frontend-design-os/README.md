# Frontend Design OS Skill v2

A portable, auto-routable frontend design workflow for agent harnesses that support `SKILL.md` discovery.

## What v2 adds

- automatic FULL / STANDARD / LIGHT / PATCH routing;
- automatic reference-site / screenshot / Figma / existing-repository modes;
- product-truth gate before visual invention;
- explicit `DESIGN.md` contract;
- anti-AI-slop gate;
- independent Visual / UX / Engineering review gates;
- browser evidence requirements before claiming completion.

## Trigger examples

The skill should be selected automatically for requests such as:

- “做一个无人机地面站管理网页” → FULL
- “重做这个 AI 求职项目的整个 UI” → FULL + Existing Project Mode
- “按这个网站的感觉重新设计首页” → FULL + Website Reference Mode
- “给当前产品加一个复杂的职位详情页” → STANDARD
- “做一个新的数据表格组件” → LIGHT
- “把按钮颜色改黑、修掉手机端溢出” → PATCH

## DSH installation

When published under `dsh-skill-market/skills/frontend-design-os`, DSH can discover it through the market provider or install it locally with the market CLI.

Typical local install after the market serves this skill:

```bash
dsh-market install frontend-design-os
```

Project-local installation takes precedence over user/global skills:

```bash
dsh-market install frontend-design-os --target project
```

## Important limitation

Publishing this repository does not by itself install the skill into every ChatGPT conversation. Automatic cross-conversation invocation requires the host product/harness to have this skill installed or surfaced through its skill/plugin provider. The `whenToUse` metadata and routing logic are designed for that environment.
