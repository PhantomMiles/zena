# Zena Field

## What it does

The offline-first Expo / React Native app for drivers and yard managers. Key screens: job list, dual-signed handover capture (photos, condition notes, two signatures), offline queue, and earnings tracker. Works on Android and iOS.

## Why it is designed this way

Drivers operate in areas with patchy connectivity. The app captures and signs events locally, queues them, and syncs automatically when online. WCAG 2.2 AA, 44 px touch targets, minimum 16 px body text.

## Run locally

```bash
cp apps/field/.env.example apps/field/.env
# Expo CLI installed separately — see Phase 1 setup
pnpm --filter @zena/field dev
```

## Test

```bash
pnpm --filter @zena/field test
```
