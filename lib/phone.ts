export const MOBILE_DIGITS = 10;

/** Strip non-digits and cap at 10 characters. */
export function sanitizeMobileInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, MOBILE_DIGITS);
}

export function isValidMobile(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}
