/**
 * Content script — inject save button next to each Claude response
 * CLAUDE.md: content.js non contiene logica specifica di piattaforma
 */

// Inline Logger — CLAUDE.md rule 7: solo warn/error, no console.log
const Logger = {
  warn: (message, ...args) => console.warn(`[Threadkeep] ${message}`, ...args),
  error: (message, ...args) => console.error(`[Threadkeep] ${message}`, ...args)
};

// Inline adapters — MV3 content script doesn't support ES6 imports
const ADAPTERS = [
  {
    name: 'claude',
    matches: ['claude.ai'],
    findResponseElements: () => {
      // Verificato: 2026-03-28
      const primary = document.querySelectorAll('div.font-claude-response');
      if (primary.length > 0) return primary;
      const fallback = document.querySelectorAll('[data-testid="assistant-response"]');
      if (fallback.length > 0) {
        Logger.warn('content: fallback selector used for response elements');
        return fallback;
      }
      return [];
    },
    getResponse: (resp) => {
      // Verificato: 2026-03-28 — selettore reale: [class*="font-user-message"] (Tailwind !important)
      const el = resp || document.querySelector('div.font-claude-response');
      if (el) {
        const clone = el.cloneNode(true);
        clone.querySelector('.tk-save-btn')?.remove();
        return clone.textContent || '';
      }
      const fallback = document.querySelector('[data-testid="assistant-response"]');
      if (fallback) {
        Logger.warn('claude adapter: fallback selector used for response');
        return fallback.textContent || '';
      }
      Logger.warn('claude adapter: no response selector matched');
      return '';
    },
    getPrompt: (resp) => {
      // Verificato: 2026-03-28 — selettore reale: [class*="font-user-message"] (Tailwind !important)
      const allPrompts = Array.from(document.querySelectorAll('[class*="font-user-message"]'));
      const primary = allPrompts.at(-1);
      if (primary) return primary.textContent || '';
      Logger.warn('claude adapter: no prompt selector matched');
      return '';
    },
    getConversationUrl: () => window.location.href
  },
  {
    name: 'chatgpt',
    matches: ['chat.openai.com', 'chatgpt.com'],
    findResponseElements: () => {
      // Verificato: 2026-03-28
      return document.querySelectorAll('[data-message-author-role="assistant"]');
    },
    getResponse: (resp) => {
      // Verificato: 2026-03-28
      const el = resp || document.querySelector('[data-message-author-role="assistant"]');
      if (el) {
        const clone = el.cloneNode(true);
        clone.querySelector('.tk-save-btn')?.remove();
        return clone.textContent || '';
      }
      Logger.warn('chatgpt adapter: no response selector matched');
      return '';
    },
    getPrompt: (resp) => {
      // Verificato: 2026-03-28
      const allPrompts = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
      const primary = allPrompts.at(-1);
      if (primary) return primary.textContent || '';
      Logger.warn('chatgpt adapter: no prompt selector matched');
      return '';
    },
    getConversationUrl: () => window.location.href
  },
  {
    name: 'gemini',
    matches: ['gemini.google.com'],
    findResponseElements: () => {
      // Verificato: 2026-03-28
      return document.querySelectorAll('div.response-content');
    },
    getResponse: (resp) => {
      // Verificato: 2026-03-28
      const el = resp || document.querySelector('div.response-content');
      if (el) {
        const clone = el.cloneNode(true);
        clone.querySelector('.tk-save-btn')?.remove();
        return clone.textContent || '';
      }
      Logger.warn('gemini adapter: no response selector matched');
      return '';
    },
    getPrompt: (resp) => {
      // Verificato: 2026-03-28
      const allPrompts = Array.from(document.querySelectorAll('div.user-query-container'));
      const primary = allPrompts.at(-1);
      if (primary) return primary.textContent.replace(/^(Hai detto|You said|Tu hai detto)[:\s]*/i, '').trim() || '';
      Logger.warn('gemini adapter: no prompt selector matched');
      return '';
    },
    getConversationUrl: () => window.location.href
  },
  {
    name: 'perplexity',
    matches: ['perplexity.ai'],
    findResponseElements: () => {
      // Verificato: 2026-03-29
      return document.querySelectorAll('div.prose');
    },
    getResponse: (resp) => {
      // Verificato: 2026-03-29
      const el = resp || document.querySelector('div.prose');
      if (el) {
        const clone = el.cloneNode(true);
        clone.querySelector('.tk-save-btn')?.remove();
        return clone.textContent || '';
      }
      Logger.warn('perplexity adapter: no response selector matched');
      return '';
    },
    getPrompt: (resp) => {
      // Verificato: 2026-03-29
      const allPrompts = Array.from(document.querySelectorAll('h1[class*="query"]'));
      const primary = allPrompts.at(-1);
      if (primary) return primary.textContent || '';
      Logger.warn('perplexity adapter: no prompt selector matched');
      return '';
    },
    getConversationUrl: () => window.location.href
  }
];

const STYLE_ID = 'threadkeep-inject-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content/content.css');
  document.head.appendChild(link);
}

function getAdapter() {
  const hostname = window.location.hostname;
  return ADAPTERS.find(a => a.matches.some(m => hostname.includes(m)));
}

function createSaveButton(adapter, resp) {
  const btn = document.createElement('button');
  btn.className = 'tk-save-btn';
  try {
    btn.textContent = chrome.i18n.getMessage('save_button_label') || 'Save';
  } catch {
    btn.textContent = 'Save';
  }
  btn.addEventListener('click', () => handleSave(adapter, resp, btn));
  return btn;
}

function injectButtons() {
  const adapter = getAdapter();
  if (!adapter) return;

  const responses = adapter.findResponseElements();
  if (responses.length === 0) return;

  responses.forEach(resp => {
    if (resp.querySelector('.tk-save-btn')) return; // già iniettato
    const btn = createSaveButton(adapter, resp);
    resp.appendChild(btn);
  });
}

async function handleSave(adapter, resp, btn) {
  const entry = {
    prompt: adapter.getPrompt(resp),
    response: adapter.getResponse(resp),
    platform: adapter.name,
    url: adapter.getConversationUrl()
  };

  if (!entry.prompt || !entry.response) {
    Logger.warn('content: no content to save');
    return;
  }

  const originalText = btn.textContent;
  btn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({ type: 'SAVE_ENTRY', payload: entry });

    if (result && result.success) {
      try {
        btn.textContent = chrome.i18n.getMessage('saved_feedback_label') || 'Saved ✓';
      } catch {
        btn.textContent = 'Saved ✓';
      }
    } else if (result && result.reason === 'duplicate') {
      try {
        btn.textContent = chrome.i18n.getMessage('save_duplicate_label') || 'Already saved';
      } catch {
        btn.textContent = 'Already saved';
      }
    } else if (result && result.reason === 'limit_reached') {
      try {
        btn.textContent = chrome.i18n.getMessage('save_limit_label') || 'Limit reached';
      } catch {
        btn.textContent = 'Limit reached';
      }
    } else {
      try {
        btn.textContent = chrome.i18n.getMessage('save_error_label') || 'Error';
      } catch {
        btn.textContent = 'Error';
      }
    }
  } catch (err) {
    Logger.error('content: save failed', err);
    try {
      btn.textContent = chrome.i18n.getMessage('save_error_label') || 'Error';
    } catch {
      btn.textContent = 'Error';
    }
  }

  setTimeout(() => {
    btn.textContent = originalText;
    btn.disabled = false;
  }, 2000);
}

// Init
injectStyles();

// Observe DOM for dynamically loaded responses
let observerTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(observerTimeout);
  observerTimeout = setTimeout(injectButtons, 1500);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  injectButtons();
  observer.observe(document.body, { childList: true, subtree: true });
}
