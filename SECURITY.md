# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's
private vulnerability reporting on this repository
(Security → Report a vulnerability). You'll get a response within a few days.

In scope: anything that could compromise a store running one of these
templates — payment/checkout flows (server-side price computation, Revolut
webhook signature verification), admin authentication, signed
recovery/account links (HMAC), cron endpoint auth, or leakage of customer
data.

## Notes for operators

- All secrets come from environment variables (`.env.example` documents every
  one). The repo contains no real credentials; anything that looks like a key
  in tests is a fixture.
- Order totals are always recomputed server-side; client-submitted prices are
  never trusted.
- Revolut webhooks are signature-verified with a rotation window; replayed or
  unsigned payloads are rejected.
