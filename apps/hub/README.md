# Zena Hub

## What it does

The web application that operations directors, finance managers, and node administrators use day-to-day. Built with Next.js (added in Phase 1). Screens include: dashboard, shipment list and detail, handover review, settlement and evidence packs, analytics, and node health.

## Why it is designed this way

A server-rendered Next.js app gives fast first paint for data-heavy screens and clean SEO for the public network explorer. All UI strings live in i18n files; English first, French / Igbo / Pidgin English ready.

## Run locally

```bash
cp apps/hub/.env.example apps/hub/.env
pnpm --filter @zena/hub dev
```

## Test

```bash
pnpm --filter @zena/hub test
```
