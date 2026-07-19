# Contributing

Thanks for your interest! Issues and pull requests are welcome.

## Ground rules

- **Open an issue before large PRs.** Features and behavior changes should be
  discussed first; bug-fix PRs can come straight in.
- **Most changes apply to both templates.** `storefront-i18n` and
  `storefront-single` are siblings, not consumers of shared code. If you fix
  something in one, check whether the same fix belongs in the other (the file
  layout matches almost 1:1) and apply it to both in the same PR.
- **Tests gate everything.** CI runs lint, typecheck, the unit suites, a
  production build, and the Playwright e2e suites for both templates.

## Dev setup

```bash
cd storefront-single        # or storefront-i18n
pnpm install
pnpm dev                    # browsing/cart works with zero env
```

Checkout, admin, and emails need env — see `.env.example` for the full
annotated table, and `AGENTS.md` for architecture rules.

## Running checks locally

```bash
pnpm lint
pnpm typecheck
pnpm test          # vitest unit suites
pnpm build
pnpm test:e2e      # needs a local MongoDB (any mongodb://... in MONGODB_URI)
```

## Conventions

- One product per file in `content/products/`; register it with one import line.
- All brand/market/category/flag config lives in `src/site.config.ts`.
- Env access goes through `src/env.ts` (Zod-validated) — never raw `process.env`.
- UI copy: `messages/{en,ro}/*.json` (i18n) or `src/content/strings.ts` (single).
