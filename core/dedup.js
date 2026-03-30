/**
 * Dedup utility — duplicate detection via SHA-256 hash comparison
 * CLAUDE.md: hash field in storage schema = SHA-256 of prompt+response
 * Non accede chrome.storage — riceve entries come parametro
 */

import Crypto from '../utils/crypto.js';

const Dedup = {
  /**
   * Check if an entry with the same content already exists
   * @param {string} hash - SHA-256 hash of prompt+response
   * @param {Object[]} entries - Existing saved entries
   * @returns {Object|null} - The duplicate entry if found, null otherwise
   */
  findByHash: (hash, entries) => {
    if (!hash || !Array.isArray(entries)) return null;
    return entries.find(e => e.hash === hash) || null;
  },

  /**
   * Generate SHA-256 hash for dedup comparison
   * @param {string} prompt
   * @param {string} response
   * @returns {Promise<string>} SHA-256 hex string
   */
  generateHash: async (prompt, response) => {
    return await Crypto.sha256(prompt + response);
  },

  /**
   * Full check: generate hash and search for duplicate in one call
   * @param {string} prompt
   * @param {string} response
   * @param {Object[]} entries - Existing saved entries
   * @returns {Promise<Object|null>} - The duplicate entry if found, null otherwise
   */
  check: async (prompt, response, entries) => {
    if (!prompt || !response || !Array.isArray(entries)) return null;
    const hash = await Crypto.sha256(prompt + response);
    return Dedup.findByHash(hash, entries);
  }
};

export default Dedup;
