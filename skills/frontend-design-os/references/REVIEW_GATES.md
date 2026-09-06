# Review Gates

Each reviewer returns PASS or FAIL with evidence. A material FAIL blocks release.

## Visual Reviewer
PASS requires:
- one obvious first-view hierarchy;
- coherent type scale and line length;
- consistent spacing rhythm;
- intentional container model;
- controlled palette;
- no unsupported anti-slop pattern;
- mobile composition feels designed, not collapsed.

FAIL examples:
- repeated card soup;
- weak CTA hierarchy;
- type sizes drift between similar components;
- gratuitous glow/gradient;
- visible clipping;
- major layout imbalance.

## UX Reviewer
PASS requires:
- primary task is obvious;
- interactive controls look interactive;
- selected/hover/focus states are available where relevant;
- core loading/empty/error/success states are not misleading;
- mobile navigation preserves the main task;
- dense information is scannable.

FAIL examples:
- hidden primary action;
- icon-only destructive action without label/accessible name;
- mobile horizontal scroll;
- inert primary control;
- unclear save/success state.

## Engineering Reviewer
PASS requires:
- no runtime/console errors in tested path;
- no broken primary assets;
- no page-level horizontal overflow in target widths;
- visible keyboard focus;
- reduced-motion handling for material animation;
- sensible semantic and component structure;
- existing framework/business logic respected during redesign.

FAIL examples:
- console exceptions;
- layout fixed through fragile hard-coded offsets;
- missing alt/labels for important interactive content;
- primary workflow broken by redesign;
- desktop-only implementation for a responsive requirement.
