// Review submissions now persist server-side (see `@/lib/reviews-store` and
// `POST /api/reviews`) — this module no longer stores anything in
// localStorage. It only keeps the "open the review form" UI event: any
// "Write a review" CTA on the page (e.g. ReviewSummary) can dispatch it, and
// the review form on the same product listens for it, opens, and scrolls
// itself into view.
export const OPEN_REVIEW_FORM_EVENT = 'sf:open-review-form';
