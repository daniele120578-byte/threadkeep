/**
 * Storage utility — sole access point for chrome.storage
 * CLAUDE.md rule 3: chrome.storage accessibile SOLO da qui
 */

import Sanitize from '../utils/sanitize.js';
import Crypto from '../utils/crypto.js';
import Logger from '../utils/logger.js';

const STORAGE_KEY = 'threadkeep_entries';
let _storageLock = Promise.resolve();

const Storage = {
  save: async (entry) => {
    return _storageLock = _storageLock.then(async () => {
      const sanitized = {
        prompt: Sanitize.text(entry.prompt),
        response: Sanitize.text(entry.response),
        platform: Sanitize.text(entry.platform),
        url: Sanitize.url(entry.url),
        tags: Sanitize.tags(entry.tags || []),
        createdAt: Date.now()
      };

      const hashInput = sanitized.prompt + sanitized.response;
      sanitized.hash = await Crypto.sha256(hashInput);
      sanitized.id = crypto.randomUUID();

      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        const entries = stored[STORAGE_KEY] || [];
        entries.unshift(sanitized);
        // Quota check — chrome.storage.local limit ~10MB
        try {
          await chrome.storage.local.set({ [STORAGE_KEY]: entries });
        } catch (err) {
          if (err.message && err.message.includes('QUOTA_BYTES')) {
            Logger.error('storage.save: quota exceeded', err);
            throw new Error('quota_exceeded');
          }
          throw err;
        }
        return sanitized;
      } catch (err) {
        Logger.error('storage.save failed', err);
        throw err;
      }
    });
  },

  getAll: async () => {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      return stored[STORAGE_KEY] || [];
    } catch (err) {
      Logger.error('storage.getAll failed', err);
      return [];
    }
  },

  delete: async (id) => {
    return _storageLock = _storageLock.then(async () => {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        const entries = stored[STORAGE_KEY] || [];
        const filtered = entries.filter(e => e.id !== id);
        await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
      } catch (err) {
        Logger.error('storage.delete failed', err);
        throw err;
      }
    });
  },

  search: async (query) => {
    const all = await Storage.getAll();
    const q = Sanitize.text(query).toLowerCase();
    return all.filter(e =>
      e.prompt.toLowerCase().includes(q) ||
      e.response.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q))
    );
  }
};

export default Storage;