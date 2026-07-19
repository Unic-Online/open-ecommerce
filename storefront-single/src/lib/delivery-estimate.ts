export const STOCK_DELIVERY_BUSINESS_DAYS = 2;

export function estimateNextShippingDate(now: Date): Date {
  const candidate = startOfLocalDay(now);

  if (isBusinessDay(candidate)) {
    return addBusinessDays(candidate, STOCK_DELIVERY_BUSINESS_DAYS);
  }

  return nextBusinessDay(candidate);
}

export function formatDeliveryDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function nextBusinessDay(date: Date): Date {
  const next = startOfLocalDay(date);
  while (!isBusinessDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function addBusinessDays(date: Date, days: number): Date {
  const next = startOfLocalDay(date);
  let remaining = Math.max(0, days);

  while (remaining > 0) {
    next.setDate(next.getDate() + 1);
    if (isBusinessDay(next)) {
      remaining -= 1;
    }
  }

  return next;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
