/**
 * Cryptography utility — Web Crypto API wrapper for SHA-256 hashing
 * CLAUDE.md: Web Crypto API per hashing, zero librerie crittografia esterne
 */

const Crypto = {
  sha256: async (text) => {
    if (typeof text !== 'string') {
      throw new Error('crypto.sha256 expects a string');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex;
  }
};

export default Crypto;
