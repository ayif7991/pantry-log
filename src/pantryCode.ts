/**
 * The "pantry code" is what stands in for an account: a short random code
 * that identifies a shared Firestore document. Whoever enters the same code
 * on another device sees and edits the same pantry — no sign-in, but also
 * no real access control beyond "you have to know the code" (same model as
 * a shared Google Doc link). Fine for household inventory data.
 */

const STORAGE_KEY = 'pantry-log-sync-code-v1';
const CODE_LENGTH = 6;

// Excludes 0/O, 1/I/L, and 2/Z — characters that are easy to misread when
// read aloud or copied by hand from one device to another.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXY3456789';

export function generatePantryCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Uppercases and strips whitespace/hyphens, so pasted or hand-typed codes still match. */
export function normalizePantryCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidPantryCode(value: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(value);
}

export function getStoredPantryCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPantryCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

/** The code this device already uses, or a freshly generated (and saved) one. */
export function getOrCreatePantryCode(): string {
  const existing = getStoredPantryCode();
  if (existing && isValidPantryCode(existing)) return existing;

  const code = generatePantryCode();
  setStoredPantryCode(code);
  return code;
}
