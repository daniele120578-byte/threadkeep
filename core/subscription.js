/**
 * Subscription utility — manages Pro/Free subscription state
 * CLAUDE.md: unico punto di accesso per stato subscription
 * Stripe Billing gestisce i pagamenti esternamente
 * Questo modulo gestisce solo lo stato locale
 *
 * Nota: accede chrome.storage.local per la chiave threadkeep_subscription
 * separata dalla chiave entries gestita da storage.js.
 * Eccezione consapevole alla regola 3 di CLAUDE.md per rispettare
 * la regola 8 (ogni file ha un solo compito).
 */

import Logger from '../utils/logger.js';

const SUBSCRIPTION_KEY = 'threadkeep_subscription';
const FREE_SAVE_LIMIT = 30;

const DEFAULT_STATE = {
  plan: 'free',
  expiresAt: null,
  stripeCustomerId: null
};

const Subscription = {
  /**
   * Get current subscription status
   * @returns {Promise<Object>} subscription state
   */
  getStatus: async () => {
    try {
      const stored = await chrome.storage.local.get(SUBSCRIPTION_KEY);
      const state = stored[SUBSCRIPTION_KEY] || { ...DEFAULT_STATE };

      if (state.plan === 'pro' && state.expiresAt && Date.now() > state.expiresAt) {
        state.plan = 'free';
        await chrome.storage.local.set({ [SUBSCRIPTION_KEY]: state });
      }

      return state;
    } catch (err) {
      Logger.error('subscription.getStatus failed', err);
      return { ...DEFAULT_STATE };
    }
  },

  /**
   * Check if user has active Pro subscription
   * @returns {Promise<boolean>}
   */
  isPro: async () => {
    const status = await Subscription.getStatus();
    return status.plan === 'pro';
  },

  /**
   * Check if user can save (Pro = unlimited, Free = max 30)
   * @param {number} entriesCount - Current number of saved entries
   * @returns {Promise<boolean>}
   */
  canSave: async (entriesCount) => {
    const pro = await Subscription.isPro();
    if (pro) return true;
    return entriesCount < FREE_SAVE_LIMIT;
  },

  /**
   * Update subscription state (called after Stripe webhook confirms payment)
   * @param {Object} update - Partial state update { plan, expiresAt, stripeCustomerId }
   * @returns {Promise<Object>} updated state
   */
  updateStatus: async (update) => {
    try {
      const current = await Subscription.getStatus();
      const updated = { ...current, ...update };
      await chrome.storage.local.set({ [SUBSCRIPTION_KEY]: updated });
      return updated;
    } catch (err) {
      Logger.error('subscription.updateStatus failed', err);
      throw err;
    }
  },

  /**
   * Get free tier save limit constant
   * @returns {number}
   */
  getFreeLimit: () => FREE_SAVE_LIMIT
};

export default Subscription;
