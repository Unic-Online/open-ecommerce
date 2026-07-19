/**
 * Shared Resend mock for unit tests.
 *
 * Two entry points, matching the two ways production code reaches Resend:
 *   - `resendLibModule()` for `vi.mock('@/lib/resend', ...)` — the normal
 *     case; everything outbound goes through `sendEmail()` per AGENTS.md.
 *   - `resendPackageModule()` for `vi.mock('resend', ...)` — only for tests
 *     that exercise `@/lib/resend` itself.
 *
 * Both share the single `sendEmailMock` spy so assertions are uniform:
 *   expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: [...] }))
 *
 * Default resolution mirrors the Resend SDK success shape (`data.id`).
 */
import { vi } from 'vitest';

// Args intentionally loose: tests assert on `.mock.calls[0][0].html` etc.
// without re-declaring the full Resend payload type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sendEmailMock = vi.fn<(...args: any[]) => Promise<unknown>>(
  async () => ({ data: { id: 'mock-email-id' }, error: null }),
);

/** Module-shape factory for `vi.mock('@/lib/resend', () => resendLibModule())`. */
export function resendLibModule() {
  return {
    sendEmail: sendEmailMock,
    getResend: vi.fn(() => ({ emails: { send: sendEmailMock } })),
  };
}

/** Module-shape factory for `vi.mock('resend', () => resendPackageModule())`. */
export function resendPackageModule() {
  return {
    Resend: vi.fn().mockImplementation(function (this: { emails: { send: typeof sendEmailMock } }) {
      this.emails = { send: sendEmailMock };
    }),
  };
}
