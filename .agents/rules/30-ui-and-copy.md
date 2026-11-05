---
trigger: always_on
---

UI and copy

- Use the design tokens in docs/design-tokens.json. If absent, use: Midnight Blue 800 #0B1F3A and 900 #071326, Verdant Green 500 #1FB36B and 700 #0E7A47, accent Signal Amber 500 #F5A524, neutrals #FFFFFF, #F5F7FA, #E8ECF2, #6B7A90, error #E5484D, info #4C8DFF.
- Fonts: Space Grotesk for headings, Inter for UI text, JetBrains Mono for IDs and fingerprints.
- Use white text only on Midnight Blue 600 or darker and on Verdant 700. Use Midnight 900 text on Verdant 500 and on the amber accent.
- Never use the words blockchain, wallet, token, gas or crypto in any user-facing string. Use: Signed, Awaiting receiver, Handover confirmed, Verified on network, Settled, Queued.
- Status is never colour alone: always pair colour with an icon and a label.
- Accessibility: WCAG 2.2 AA, 16px minimum body text, 44px minimum touch targets, visible focus states.
- Every data screen needs loading, empty, error and offline states.
- Strings live in i18n files (English first, French, Igbo and Pidgin English ready). No hard-coded user-facing text in components.
