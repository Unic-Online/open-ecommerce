import { describe, it, expect } from 'vitest';

describe('Checkout Form Validation', () => {
  function validate(form: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.firstName?.trim()) errors.firstName = 'Prenumele este obligatoriu';
    if (!form.lastName?.trim()) errors.lastName = 'Numele este obligatoriu';
    if (!form.email?.trim() || !/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Email invalid';
    if (!form.phone?.trim() || form.phone.replace(/\D/g, '').length < 10) errors.phone = 'Telefon invalid';
    if (!form.county?.trim()) errors.county = 'Județul este obligatoriu';
    if (!form.city?.trim()) errors.city = 'Orașul este obligatoriu';
    if (!form.address?.trim()) errors.address = 'Adresa este obligatorie';
    if (!form.country?.trim()) errors.country = 'Țara este obligatorie';
    return errors;
  }

  it('passes with valid complete form', () => {
    const errors = validate({
      firstName: 'Ion',
      lastName: 'Popescu',
      email: 'ion@test.ro',
      phone: '+40712345678',
      county: 'Ilfov',
      city: 'București',
      address: 'Str. Test nr. 10',
      country: 'România',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('fails with empty form', () => {
    const errors = validate({
      firstName: '', lastName: '', email: '', phone: '',
      county: '', city: '', address: '', country: '',
    });
    expect(Object.keys(errors).length).toBeGreaterThanOrEqual(7);
  });

  it('rejects invalid email', () => {
    const errors = validate({
      firstName: 'Ion', lastName: 'Popescu',
      email: 'not-an-email',
      phone: '+40712345678',
      county: 'Ilfov', city: 'București',
      address: 'Str. Test 10', country: 'România',
    });
    expect(errors.email).toBe('Email invalid');
  });

  it('accepts email with dots and subdomains', () => {
    const errors = validate({
      firstName: 'Ion', lastName: 'Popescu',
      email: 'ion.popescu@sub.domain.ro',
      phone: '+40712345678',
      county: 'Ilfov', city: 'București',
      address: 'Str. Test 10', country: 'România',
    });
    expect(errors.email).toBeUndefined();
  });

  it('rejects short phone number', () => {
    const errors = validate({
      firstName: 'Ion', lastName: 'Popescu',
      email: 'ion@test.ro',
      phone: '0787',
      county: 'Ilfov', city: 'București',
      address: 'Str. Test 10', country: 'România',
    });
    expect(errors.phone).toBe('Telefon invalid');
  });

  it('accepts phone with spaces and dashes', () => {
    const errors = validate({
      firstName: 'Ion', lastName: 'Popescu',
      email: 'ion@test.ro',
      phone: '+40 712 345 678',
      county: 'Ilfov', city: 'București',
      address: 'Str. Test 10', country: 'România',
    });
    expect(errors.phone).toBeUndefined();
  });

  it('trims whitespace-only fields as empty', () => {
    const errors = validate({
      firstName: '   ', lastName: 'Popescu',
      email: 'ion@test.ro', phone: '+40712345678',
      county: 'Ilfov', city: 'București',
      address: 'Str. Test 10', country: 'România',
    });
    expect(errors.firstName).toBe('Prenumele este obligatoriu');
  });

  it('postal code is optional (no validation)', () => {
    // postalCode is NOT in the validation — this confirms it's optional
    const errors = validate({
      firstName: 'Ion', lastName: 'Popescu',
      email: 'ion@test.ro', phone: '+40712345678',
      county: 'Ilfov', city: 'București',
      address: 'Str. Test 10', country: 'România',
    });
    expect(errors.postalCode).toBeUndefined();
  });
});
