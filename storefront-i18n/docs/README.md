# Docs

Reference docs for the storefront template.

- [`../AGENTS.md`](../AGENTS.md) — primary technical reference: stack, file map,
  the config file, how-to guides (rebrand / add product / add category / add
  locale / theme / feature flags), env vars, storage/Mongo schema, conventions,
  and the AI rules. `../CLAUDE.md` simply re-exports it.
- [`../README.md`](../README.md) — human-facing overview + quickstart + deploy.
- [`./revolut-payments-setup.md`](./revolut-payments-setup.md) — Revolut Merchant
  API setup and payment operations runbook.
- [`./revolut-merchant-2026-03-12.yaml`](./revolut-merchant-2026-03-12.yaml) —
  vendored Revolut Merchant API OpenAPI spec (the source of truth for any
  field/endpoint question).
- [`../src/plugins/abandoned-cart/README.md`](../src/plugins/abandoned-cart/README.md)
  — the cart-recovery plugin (popup, sync, recovery emails, coupons, admin).

## Content is code

Deployable content and catalog data have a single source of truth in code, not
in markdown:

- `../content/products/` — one file per product (registered in `index.ts`).
- `../src/site.config.ts` — brand, markets, categories, storage, features.
- `../messages/{en,ro}/` — UI strings.

Do not maintain a parallel copy of catalog or copy in external markdown.
`../.env.example` is curated by hand; `pnpm sync-docs` verifies it covers every
`process.env.X` in `src/` (it never overwrites the file).
