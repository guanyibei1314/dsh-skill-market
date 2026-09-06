# Routing Matrix

Choose one mode. Prefer the smallest mode that still protects product and visual quality.

| Request pattern | Mode | Required artifacts | Required verification |
|---|---|---|---|
| New full website/web app/dashboard/landing page | FULL | PRODUCT + DESIGN + review ledger | desktop + mobile + core path + 3 reviewers |
| Major redesign / homepage replacement | FULL | PRODUCT delta + DESIGN + review ledger | desktop + mobile + core path + 3 reviewers |
| Reference-site-driven new product surface | FULL | reference observations + DESIGN | desktop + mobile + 3 reviewers |
| Substantial new page in existing product | STANDARD | product/design delta | desktop + mobile + visual/UX/engineering |
| Complex new feature surface | STANDARD | mini product/design contract | desktop + mobile + core path |
| New section or component family | LIGHT | mini design contract | relevant viewport(s) + focused review |
| Color/spacing/alignment/isolated overflow fix | PATCH | none unless existing contract missing | reproduce + patch + verify |

## Signals that force FULL
- The user says “from scratch”, “new website”, “redesign the whole UI”, “rebuild homepage”, or asks for a complete visual concept.
- Several pages or the global shell/navigation are affected.
- The request changes the product’s visual language, not just one component.

## Signals that force Existing Project Mode
- A repository, codebase, live app, or existing frontend is supplied.
- The user asks to “optimize my current site” or “modify this project”.

Preserve functionality first. Do not replace business logic merely to simplify visual implementation.

## Signals for Reference Mode
- A URL, screenshot, Figma file, moodboard, or named reference product is supplied as visual direction.

Extract principles. Do not blindly clone branding, copy, logos, customer names, or protected assets.
