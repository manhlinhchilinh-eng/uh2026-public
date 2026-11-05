/**
 * UMS Digital Class Logbook - Cryptographic & Password Security Utilities
 * Implements Web Crypto API SHA-256 Hashing & Verification
 * Eliminates all cleartext password exposure in browser storage and network.
 */

export const DEFAULT_PASSWORD_HASH =
  '56d8c422bc5ae8560b7784552525471ae00c1547ef6527ab7cca4f3c5cb2e6cd';

/**
 * Resolves the SubtleCrypto instance across browser, Vitest (jsdom), and Node environments.
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in the current environment.');
}

/**
 * Hashes a plaintext password using SHA-256 via Web Crypto API.
 * Returns a 64-character lowercase hexadecimal string.
 *
 * @param password Plaintext password to hash
 * @returns Lowercase hex-encoded SHA-256 hash
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Mật khẩu không được để trống khi băm.');
  }
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a plaintext password against a stored SHA-256 hash.
 * Utilizes constant-time character comparison to prevent timing side-channel attacks.
 *
 * @param password Plaintext password to test
 * @param hash Stored SHA-256 hex string to verify against
 * @returns Promise<boolean> True if match, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  try {
    const computedHash = await hashPassword(password);
    if (computedHash.length !== hash.length) {
      return false;
    }
    let mismatch = 0;
    const lowerHash = hash.toLowerCase();
    for (let i = 0; i < computedHash.length; i++) {
      mismatch |= computedHash.charCodeAt(i) ^ lowerHash.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}
