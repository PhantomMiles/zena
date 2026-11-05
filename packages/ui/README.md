# @zena/ui

## What it does

The shared React component library that implements the Zena design system. All components are consumed by `apps/hub`; a React Native variant will serve `apps/field` in Phase 2.

Design system principles (from `docs/design-tokens.json` and rule 30):

- **Colours**: Midnight Blue 800 `#0B1F3A`, Verdant Green 500 `#1FB36B`, Signal Amber 500 `#F5A524`
- **Fonts**: Space Grotesk (headings), Inter (UI text), JetBrains Mono (IDs and hashes)
- **Status**: always pair colour with an icon and a label — never colour alone
- **Accessibility**: WCAG 2.2 AA, 16 px minimum body text, 44 px minimum touch targets
- **i18n**: all user-facing strings come from i18n files — no hard-coded copy in components

## Test

```bash
pnpm --filter @zena/ui test
```

Component tests (Vitest + Testing Library) and browser checks are added in Phase 1.
