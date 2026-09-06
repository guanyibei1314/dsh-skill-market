---
name: frontend-design-os
description: Evidence-driven frontend design workflow that automatically routes new websites, web apps, dashboards, landing pages, mobile web interfaces, and significant UI redesigns through product framing, design research, design contracts, implementation, browser verification, and multi-reviewer quality gates instead of jumping directly to code.
whenToUse: Use automatically when the user asks to create, redesign, modernize, rebuild, prototype, restyle, or substantially improve a frontend website, landing page, dashboard, web app, product UI, or mobile web interface. Also use when a user supplies a reference website, screenshot, Figma design, or existing frontend repository and asks to build or redesign from it. Do not run the full workflow for trivial visual patches such as changing one color, moving one button, or fixing a small spacing bug; route those to PATCH mode.
user-invocable: true
disable-model-invocation: false
metadata:
  tags: [frontend, ui, ux, design-system, visual-review, responsive, workflow]
  author: guanyibei1314
  version: 2.0.0
---

# Frontend Design OS

Build frontend surfaces through a design-constrained loop. The core rule is simple:

> Do not jump from vague intent directly to code when the task is materially visual.

## 1. Route the request before doing work

Classify the task into exactly one mode.

### FULL
Use for:
- a new website, web app, dashboard, landing page, product UI, or mobile web interface;
- a full homepage redesign;
- a major visual/system redesign of an existing frontend;
- a reference-driven recreation where the user expects a coherent new product surface.

Run:
`Product → Research → Design Contract → Wireframe/Visual Direction → Build → Browser Render → Visual/UX/Engineering Review → Fix → Pass`

### STANDARD
Use for:
- one substantial new page inside an existing product;
- one complex feature surface;
- a redesign constrained by an existing design system.

Reuse the existing product/design contract where reliable. Research only what is missing. Always render and review.

### LIGHT
Use for:
- one new component family;
- a small but visually meaningful section;
- a focused UI composition that does not redefine the product shell.

Create a mini design contract before implementation. Perform focused visual and responsive review.

### PATCH
Use for:
- small color, spacing, typography, alignment, overflow, or isolated component fixes;
- a clear bug with a local visual cause.

Do not create unnecessary research or design documents. Read the existing design system, patch the smallest surface, then verify in the browser.

If uncertain between two modes, choose the smaller mode that still protects quality.

Read `references/ROUTER.md` for the detailed decision table.

## 2. Preserve product truth

Before design, identify:
- primary user job;
- primary path/action;
- information hierarchy;
- hard facts supplied by the user or existing product;
- constraints that must not change;
- mobile/responsive requirements;
- unknowns that must not be invented.

Never invent product claims, fake metrics, unsupported integrations, fake testimonials, fake customers, or business capabilities merely to fill a layout.

For FULL mode, write a concise `PRODUCT.md` using `templates/PRODUCT.md`.

## 3. Research only when it changes the design

For FULL mode, inspect 3–6 high-quality references when current external research is useful. Extract transferable patterns, not brand imitation:
- hierarchy;
- layout/container model;
- density;
- typography;
- color/material;
- component anatomy;
- motion;
- responsive behavior.

When the user provides a reference website, screenshot, Figma file, or repository, treat it as a design input and use the matching reference mode:
- **Website Reference Mode**: inspect layout, typography, interaction, and section rhythm; do not copy protected brand assets or text unnecessarily.
- **Screenshot Mode**: treat visible geometry, hierarchy, spacing, and styling as evidence; distinguish uncertain areas.
- **Figma Mode**: use the design as the production source of truth when available.
- **Existing Project Mode**: inspect the current product behavior, framework, design tokens, and interaction contracts before changing visuals.

Skip broad research when it will not affect the implementation.

## 4. Lock the design contract before material implementation

For FULL mode, create a `DESIGN.md` from `templates/DESIGN.md`. It must define:
- visual direction in one sentence;
- background/surface/text/accent colors;
- typography hierarchy;
- spacing and container model;
- radii, borders, shadows;
- navigation anatomy;
- component families;
- first viewport composition;
- mobile transformation rules;
- motion rules;
- prohibited patterns.

The design contract is a constraint, not inspiration. Once implementation starts, do not silently invent a new component family, color treatment, section, hero, badge, metric, or container style.

Use `references/ANTI_SLOP.md` as a hard gate.

## 5. Build the real product surface

Implementation rules:
- preserve the real product workflow before decorative polish;
- use the existing framework when editing an existing project;
- for a new complex app UI, prefer React + Vite unless the user or repository specifies otherwise;
- keep UI text, controls, forms, tables, navigation, and state code-native;
- use shared tokens/components for repeated visual primitives;
- use semantic HTML and visible keyboard focus;
- implement meaningful hover, selected, loading, empty, error, success, and disabled states where relevant;
- respect `prefers-reduced-motion`;
- do not squeeze desktop tables into unreadable mobile columns;
- do not replace real UI with a screenshot.

## 6. Browser verification is mandatory for material work

For FULL, STANDARD, and LIGHT modes:
1. run the actual frontend;
2. verify desktop;
3. verify a mobile viewport;
4. exercise the primary interaction path;
5. inspect console/runtime errors;
6. check horizontal overflow and clipped primary content;
7. capture screenshots when the environment supports it.

A successful build command is not sufficient evidence of visual correctness.

## 7. Run three independent review gates

Review from three perspectives. Do not let one review substitute for another.

### Visual Reviewer
Checks:
- hierarchy;
- typography;
- spacing;
- palette discipline;
- container discipline;
- visual distinctiveness;
- mobile composition;
- anti-slop violations.

### UX Reviewer
Checks:
- obvious primary action;
- labels and affordances;
- selected/hover/focus states;
- loading/empty/error/success behavior;
- mobile navigation;
- scanability and task completion.

### Engineering Reviewer
Checks:
- runtime/console errors;
- broken assets;
- semantic structure;
- responsive overflow;
- keyboard focus;
- reduced motion;
- maintainable component boundaries;
- no fragile one-off hacks around core layout.

Use `references/REVIEW_GATES.md` and `templates/REVIEW.md`.

## 8. Fix until the release gate passes

Release blockers include:
- horizontal page overflow at target widths;
- clipped primary content;
- broken primary interaction;
- unreadable text;
- console/runtime errors;
- obvious design-system drift;
- invented visible product claims;
- generic AI decoration replacing hierarchy;
- mobile layout that is merely a compressed desktop layout.

If a reviewer fails the build, fix the evidence-backed issue and rerun the relevant checks. Do not claim completion while a material reviewer finding remains unresolved.

## 9. Final handoff

Report only verified work. Include:
- chosen mode;
- what design/product contracts were created or reused;
- browser viewports checked;
- primary interaction path checked;
- material reviewer findings fixed;
- remaining intentional deviations or unverified items.

Do not claim a browser, visual, or interaction check that was not actually performed.
