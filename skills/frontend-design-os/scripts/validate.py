#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[1]
required = [
    ROOT / 'SKILL.md',
    ROOT / 'skill.json',
    ROOT / 'references/ROUTER.md',
    ROOT / 'references/ANTI_SLOP.md',
    ROOT / 'references/REVIEW_GATES.md',
    ROOT / 'templates/PRODUCT.md',
    ROOT / 'templates/DESIGN.md',
    ROOT / 'templates/REVIEW.md',
]

errors = []
for path in required:
    if not path.exists() or path.stat().st_size < 40:
        errors.append(f'missing/empty: {path.relative_to(ROOT)}')

skill = (ROOT / 'SKILL.md').read_text(encoding='utf-8')
for key in ['name:', 'description:', 'whenToUse:', 'version: 2.0.0']:
    if key not in skill:
        errors.append(f'SKILL.md missing {key}')
for mode in ['FULL', 'STANDARD', 'LIGHT', 'PATCH']:
    if not re.search(rf'\b{mode}\b', skill):
        errors.append(f'SKILL.md missing routing mode {mode}')
for gate in ['Visual Reviewer', 'UX Reviewer', 'Engineering Reviewer']:
    if gate not in skill:
        errors.append(f'SKILL.md missing gate {gate}')

try:
    meta = json.loads((ROOT / 'skill.json').read_text(encoding='utf-8'))
    if meta.get('name') != 'frontend-design-os':
        errors.append('skill.json name mismatch')
    if meta.get('version') != '2.0.0':
        errors.append('skill.json version mismatch')
except Exception as exc:
    errors.append(f'skill.json invalid: {exc}')

if errors:
    print('FAIL')
    for e in errors:
        print('-', e)
    sys.exit(1)
print('PASS: Frontend Design OS v2 skill bundle validated')
