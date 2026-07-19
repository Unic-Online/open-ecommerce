// Shared email storage utility for Meta event matching
import { storage } from '@/site.config';

const EMAIL_KEY = storage.localStorage.userEmail;
const POPUP_DISMISSED_KEY = storage.localStorage.emailPopupDismissed;

/**
 * Get stored user email (from popup or add-to-cart prompt)
 */
export function getStoredEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Store user email for later use in Meta events
 */
export function storeEmail(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    // Storage unavailable
  }
}

/**
 * Check if the email popup was already dismissed
 */
export function isPopupDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(POPUP_DISMISSED_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Mark the email popup as dismissed
 */
export function dismissPopup(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POPUP_DISMISSED_KEY, '1');
  } catch {
    // Storage unavailable
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
