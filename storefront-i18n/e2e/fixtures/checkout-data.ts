// Shared shipping fixture. Do not use a real email — recovery emails are
// dry-run during e2e but a typo could still leak.

export const TEST_SHIPPING = {
  firstName: 'Ion',
  lastName: 'Popescu',
  email: 'e2e@playwright.example.test',
  phone: '+40712345678',
  county: 'Ilfov',
  city: 'Otopeni',
  address: 'Str. Testare nr. 1, bl. A',
  country: 'România',
  postalCode: '012345',
} as const;
