/**
 * Background service worker — message handler for content scripts
 * CLAUDE.md: service worker base per MVP Fase 1
 * Non-module: tutti i moduli sono inline per compatibilità service worker MV3
 */

// ExtPay — UMD/IIFE caricato globalmente
importScripts('../vendor/ExtPay.js');

// ============ CRYPTO ============
const Crypto = {
  sha256: async (text) => {
    if (typeof text !== 'string') throw new Error('crypto.sha256 expects a string');
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex;
  }
};

// ============ LOGGER ============
const Logger = {
  warn: (message, ...args) => console.warn(`[Threadkeep] ${message}`, ...args),
  error: (message, ...args) => console.error(`[Threadkeep] ${message}`, ...args)
};

// ============ SANITIZE ============
const Sanitize = {
  text: (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').slice(0, 100000);
  },
  tags: (tags) => {
    if (!Array.isArray(tags)) return [];
    return tags.slice(0, 20).map(tag => Sanitize.text(tag).trim()).filter(tag => tag.length > 0 && tag.length <= 50);
  },
  url: (url) => {
    if (typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      return parsed.href;
    } catch { return ''; }
  }
};

// ============ STORAGE ============
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
      sanitized.hash = await Crypto.sha256(sanitized.prompt + sanitized.response);
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
      } catch (err) { Logger.error('storage.save failed', err); throw err; }
    });
  },
  getAll: async () => {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      return stored[STORAGE_KEY] || [];
    } catch (err) { Logger.error('storage.getAll failed', err); return []; }
  },
  delete: async (id) => {
    return _storageLock = _storageLock.then(async () => {
      try {
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        const entries = stored[STORAGE_KEY] || [];
        await chrome.storage.local.set({ [STORAGE_KEY]: entries.filter(e => e.id !== id) });
      } catch (err) { Logger.error('storage.delete failed', err); throw err; }
    });
  }
};

// ============ DEDUP ============
const Dedup = {
  findByHash: (hash, entries) => {
    if (!hash || !Array.isArray(entries)) return null;
    return entries.find(e => e.hash === hash) || null;
  },
  check: async (prompt, response, entries) => {
    if (!prompt || !response || !Array.isArray(entries)) return null;
    const hash = await Crypto.sha256(prompt + response);
    return Dedup.findByHash(hash, entries);
  }
};

// ============ SUBSCRIPTION ============
const SUBSCRIPTION_KEY = 'threadkeep_subscription';
const FREE_SAVE_LIMIT = 30;
const Subscription = {
  getStatus: async () => {
    try {
      const stored = await chrome.storage.local.get(SUBSCRIPTION_KEY);
      const state = stored[SUBSCRIPTION_KEY] || { plan: 'free', expiresAt: null, stripeCustomerId: null };
      if (state.plan === 'pro' && state.expiresAt && Date.now() > state.expiresAt) {
        state.plan = 'free';
        await chrome.storage.local.set({ [SUBSCRIPTION_KEY]: state });
      }
      return state;
    } catch (err) { Logger.error('subscription.getStatus failed', err); return { plan: 'free', expiresAt: null, stripeCustomerId: null }; }
  },
  isPro: async () => { const status = await Subscription.getStatus(); return status.plan === 'pro'; },
  canSave: async (entriesCount) => { const pro = await Subscription.isPro(); return pro || entriesCount < FREE_SAVE_LIMIT; }
};

// ============ EXTPAY ============
const extpay = ExtPay('threadkeep');
extpay.startBackground();

// Sincronizza stato Pro dopo pagamento ExtPay confermato
extpay.onPaid.addListener((user) => {
  chrome.storage.local.set({
    [SUBSCRIPTION_KEY]: { plan: 'pro', expiresAt: null, stripeCustomerId: null }
  }).catch(err => Logger.error('subscription sync failed', err));
});

// ============ HANDLERS ============
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed — nothing to initialize yet
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_ENTRY') {
    if (!message.payload || typeof message.payload.prompt !== 'string' || typeof message.payload.response !== 'string') {
      sendResponse({ success: false, error: 'invalid_payload' });
      return true;
    }
    handleSaveEntry(message.payload)
      .then(result => sendResponse(result))
      .catch(err => {
        Logger.error('background: SAVE_ENTRY failed', err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  if (message.type === 'OPEN_PAYMENT_PAGE') {
    extpay.openPaymentPage();
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'GET_USER_STATUS') {
    extpay.getUser()
      .then(user => sendResponse({ success: true, paid: user.paid }))
      .catch(err => {
        Logger.error('background: GET_USER_STATUS failed', err);
        sendResponse({ success: false, paid: false });
      });
    return true;
  }
});

async function handleSaveEntry(payload) {
  return _storageLock = _storageLock.then(async () => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const entries = stored[STORAGE_KEY] || [];
    const allowed = await Subscription.canSave(entries.length);
    if (!allowed) return { success: false, reason: 'limit_reached' };
    const duplicate = await Dedup.check(payload.prompt, payload.response, entries);
    if (duplicate) return { success: false, reason: 'duplicate', existingId: duplicate.id };
    const sanitized = {
      prompt: Sanitize.text(payload.prompt),
      response: Sanitize.text(payload.response),
      platform: Sanitize.text(payload.platform),
      url: Sanitize.url(payload.url),
      tags: Sanitize.tags(payload.tags || []),
      createdAt: Date.now()
    };
    sanitized.hash = await Crypto.sha256(sanitized.prompt + sanitized.response);
    sanitized.id = crypto.randomUUID();
    try {
      entries.unshift(sanitized);
      await chrome.storage.local.set({ [STORAGE_KEY]: entries });
      return { success: true, entry: sanitized };
    } catch (err) {
      if (err.message && err.message.includes('QUOTA_BYTES')) {
        Logger.error('storage.save: quota exceeded', err);
        return { success: false, reason: 'quota_exceeded' };
      }
      Logger.error('handleSaveEntry: save failed', err);
      throw err;
    }
  });
}