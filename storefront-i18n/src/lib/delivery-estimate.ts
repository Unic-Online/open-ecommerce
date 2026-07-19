export const STOCK_DELIVERY_BUSINESS_DAYS = 2;

const RO_WEEKDAYS = [
  'duminică',
  'luni',
  'marți',
  'miercuri',
  'joi',
  'vineri',
  'sâmbătă',
];

const RO_MONTHS = [
  'ianuarie',
  'februarie',
  'martie',
  'aprilie',
  'mai',
  'iunie',
  'iulie',
  'august',
  'septembrie',
  'octombrie',
  'noiembrie',
  'decembrie',
];

export function estimateNextShippingDate(now: Date): Date {
  const candidate = startOfLocalDay(now);

  if (isBusinessDay(candidate)) {
    return addBusinessDays(candidate, STOCK_DELIVERY_BUSINESS_DAYS);
  }

  return nextBusinessDay(candidate);
}

export function formatRomanianDeliveryDate(date: Date): string {
  const weekday = RO_WEEKDAYS[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = RO_MONTHS[date.getMonth()];
  return `${weekday}, ${day} ${month} ${date.getFullYear()}`;
}

export function formatDeliveryDate(date: Date, locale: 'ro' | 'en'): string {
  if (locale === 'en') return formatEnglishDeliveryDate(date);
  return formatRomanianDeliveryDate(date);
}

function formatEnglishDeliveryDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
