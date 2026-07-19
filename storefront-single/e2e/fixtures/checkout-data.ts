// Shared shipping fixture. Do not use a real email — recovery emails are
// dry-run during e2e but a typo could still leak.

export const TEST_SHIPPING = {
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'e2e@playwright.example.test',
  phone: '+44 7700 900123',
  county: 'Greater London',
  city: 'London',
  address: '10 Example Street, Flat 5',
  country: 'United Kingdom',
  postalCode: 'SW1A 1AA',
} as const;
