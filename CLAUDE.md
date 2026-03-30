# CLAUDE.md — Threadkeep

## Identità progetto
Nome: Threadkeep
Tipo: Chrome Extension MV3, Chromium
Scopo: Salva output AI (prompt + risposta) con 1 click, organizza, ricerca, recupera.
MVP: Solo claude.ai
Stack: Vanilla JS, ES6 modules, zero dipendenze esterne nel bundle
Pagamenti: ExtensionPay (ExtPay v3.1.2) — unica eccezione dichiarata alla regola assoluta #1

---

## Regole assolute — mai violare

1. Zero dipendenze esterne nel bundle finale — **ECCEZIONE UNICA: ExtPay v3.1.2 (AGPL-3.0), file vendor/ExtPay.js e vendor/ExtPay.module.js copiati da dist/ ufficiale GitHub Glench/ExtPay**
2. Zero stringhe hardcodate in HTML/JS — tutto via chrome.i18n.getMessage()
3. chrome.storage è accessibile SOLO da core/storage.js per entries — eccezione: core/subscription.js per chiave threadkeep_subscription (regola 8)
4. Tutto l'input utente passa da utils/sanitize.js prima di essere salvato
5. Zero eval(), zero innerHTML con dati utente — sempre textContent o DOM API
6. CSP: zero unsafe-inline, zero unsafe-eval
7. console.log() vietato in produzione — solo console.warn() e console.error()
8. Ogni file ha un solo compito — nessuna logica mista UI/business
9. Dark mode nativa — ogni colore tramite CSS variables, mai hardcoded in dark context
10. Testo dark mode: #E8E6E1 primario, mai #FFFFFF puro

---

## Architettura file

```
threadkeep/
├── manifest.json
├── background/
│   └── background.js
├── content/
│   ├── content.js          ← adapter inline (MV3: no ES6 import in content scripts)
│   └── content.css
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── library/
│   ├── library.html
│   ├── library.js
│   └── library.css
├── core/
│   ├── storage.js
│   ├── search.js
│   ├── dedup.js
│   └── subscription.js
├── utils/
│   ├── sanitize.js
│   ├── crypto.js
│   └── logger.js
├── vendor/
│   ├── ExtPay.js           ← build IIFE — caricato via importScripts nel service worker
│   └── ExtPay.module.js    ← build ESM (non più usato — background.js è ora non-module)
├── scripts/
│   └── translate.js
├── assets/
│   ├── icons/
│   └── fonts/
└── _locales/
    ├── en/messages.json
    ├── it/messages.json
    ├── fr/messages.json
    ├── de/messages.json
    ├── es/messages.json
    └── ko/messages.json
```

**Nota architetturale — adapter inline:**
Gli adapter per le 4 piattaforme (Claude, ChatGPT, Gemini, Perplexity) sono inlineati
direttamente in content/content.js. MV3 content script non supporta ES6 import.
La directory content/adapters/ descritta in versioni precedenti non esiste nel progetto reale.

---

## ExtPay — note service worker

- Versione: 3.1.2 (stable) — aggiornare solo dopo verifica breaking changes
- File da scaricare: GitHub Glench/ExtPay branch main, cartella dist/
  - `dist/ExtPay.js` → copiare in `vendor/ExtPay.js`
  - `dist/ExtPay.module.js` → copiare in `vendor/ExtPay.module.js`
- Licenza: AGPL-3.0-or-later — eccezione consapevole e documentata
background.js è riscritto come non-module con tutti i moduli inline.
ExtPay caricato via `importScripts('../vendor/ExtPay.js')` — disponibile come globale.
Gli handler OPEN_PAYMENT_PAGE e GET_USER_STATUS usano `const extpay = ExtPay('threadkeep')` locale
come da pattern ExtPay standard per service worker.
- ID estensione ExtPay: `'threadkeep'` — corrisponde all'ID registrato su extensionpay.com
- `extpay.startBackground()` va chiamato SOLO nel service worker, una volta sola a top-level

---

## Design tokens

```css
--tk-accent:          #c0392b;
--tk-accent-hover:    #a93226;
--tk-accent-light:    #FCEBEB;
--tk-accent-text:     #A32D2D;
--tk-text-primary:    #E8E6E1;   /* dark mode */
--tk-text-secondary:  #A8A49E;   /* dark mode */
--tk-text-tertiary:   #6B6760;   /* dark mode */
--tk-bg-dark:         #1A1917;
--tk-surface-dark:    #222120;
--tk-border:          0.5px solid;
--tk-radius-md:       var(--border-radius-md);
--tk-radius-lg:       var(--border-radius-lg);
```

Logo mark: border `1.5px solid #c0392b`, testo `tk` lowercase
Nome UI: `Threadkeep` capitalizzato
Font: sans-serif sistema — zero font esterni

---

## Adapter pattern (inline in content.js)

Ogni piattaforma è definita come oggetto nell'array ADAPTERS in content.js.
Interfaccia standard per ogni adapter:

```js
{
  name: 'claude',
  matches: ['claude.ai'],
  findResponseElements: () => NodeList,
  getResponse: (resp) => string,
  getPrompt: (resp) => string,
  getConversationUrl: () => string
}
```

content.js non contiene logica specifica di piattaforma fuori dall'array ADAPTERS.
Aggiungere una piattaforma = aggiungere un oggetto all'array ADAPTERS in content.js
+ aggiornare manifest.json in 3 punti (host_permissions, content_scripts.matches,
web_accessible_resources.matches).

---

## Storage schema

```js
{
  id: string,          // crypto.randomUUID()
  prompt: string,      // testo prompt originale
  response: string,    // testo risposta AI
  platform: string,    // 'claude' | 'chatgpt' | 'gemini' | 'perplexity'
  url: string,         // URL conversazione originale
  tags: string[],      // tag utente
  createdAt: number,   // Date.now()
  hash: string         // SHA-256 di prompt+response per dedup
}
```

---

## i18n — regole

- Fonte di verità: _locales/en/messages.json (30 chiavi attive)
- Lingue: en, it, fr, de, es, ko
- Chiavi descrittive: save_button_label, non btn1
- Placeholder espliciti: $RESPONSE_COUNT$, non $1
- Zero concatenazione di stringhe tradotte
- Chiavi deprecate rimosse (2026-03-29): error_sync_failed, settings_sync_label,
  settings_sync_description — cloud sync eliminato definitivamente
- Script scripts/translate.js rileva gap e chiavi mancanti
  Esecuzione: node scripts/translate.js

---

## Subscription — tier e limiti

| Feature         | Free | Pro |
|----------------|------|-----|
| Salvataggi     | 30   | ∞   |
| Export         | ✗    | ✓   |
| Deduplicazione | ✗    | ✓   |
| Piattaforme    | Claude | Tutte |

Stack pagamenti: ExtensionPay v3.1.2 (wraps Stripe)
Verifica stato: core/subscription.js — unico punto di accesso locale
Logica locale implementata: isPro(), getStatus(), canSave(entriesCount)
Integrazione ExtPay in background.js: GET_USER_STATUS e OPEN_PAYMENT_PAGE via chrome.runtime.sendMessage
Popup upgrade button: checkUserStatus() nasconde il pulsante se paid === true
Eliminato definitivamente: cloud sync, Supabase, sync.js

---

## Manifest — permessi

```json
"permissions": ["storage", "activeTab", "tabs"],
"host_permissions": [
  "https://claude.ai/*",
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://gemini.google.com/*",
  "https://perplexity.ai/*",
  "https://www.perplexity.ai/*",
  "https://extensionpay.com/*"
]
```

CSP (audit completato 2026-03-29):
```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
connect-src 'self' https://extensionpay.com; object-src 'none'; frame-src 'none'
```

**Nota permessi:** `alarms` rimosso — non utilizzato nel codebase attuale.
Aggiungere piattaforma = aggiungere host_permission + content_scripts.matches
+ web_accessible_resources.matches. Mai dimenticarne uno.
- web_accessible_resources: vendor/ExtPay.js elencato per https://extensionpay.com/* (2026-03-29)

---

## Metodologia obbligatoria prima di ogni modifica

1. Leggi il file esatto che modificherai — non assumere il contenuto
2. Mostra il diff preciso (prima / dopo)
3. Attendi approvazione esplicita
4. Applica solo ciò che è stato approvato
5. Verifica che nessuna regola assoluta sia violata

Mai scrivere codice su basi assunte. Mai applicare senza approvazione.

---

## Security — difese implementate

- **XSS:** output sempre via `.textContent`, mai `innerHTML`. Regex in `Sanitize.text()` è difesa secondaria per control chars e tag HTML.
- **Platform whitelist:** `VALID_PLATFORMS = ['claude', 'chatgpt', 'gemini', 'perplexity']` in popup.js e library.js — className platform validata prima dell'uso.
- **Protocol whitelist:** `Sanitize.url()` accetta solo `http:` e `https:` — blocca `javascript:`, `data:` e altri protocolli pericolosi.
- **Storage mutex:** operazioni `save()` e `delete()` serializzate tramite `_storageLock = Promise.resolve()` in background.js e core/storage.js.
- **Storage quota check:** `chrome.storage.local` ha limite ~10MB — errore `QUOTA_BYTES` catturato e thrown come `quota_exceeded`.
- **Atomic handleSaveEntry():** l'intera operazione getAll → canSave → dedup → save è dentro un singolo `_storageLock`.
- **ExtPay onPaid sync:** `extpay.onPaid.addListener()` sincronizza stato Pro in `threadkeep_subscription` dopo pagamento confermato.

## Errori noti da non ripetere

- Non usare innerHTML con dati utente
- Non accedere chrome.storage fuori da core/storage.js
- Non hardcodare stringhe visibili all'utente
- Non aggiungere dipendenze npm nel bundle (ExtPay è l'unica eccezione, già inclusa)
- Non usare #FFFFFF come testo in dark mode
- Non concatenare stringhe i18n
- Content script MV3 non supporta ES6 import — Logger e adapter vanno inlineati in content.js
- Aggiungere una nuova piattaforma richiede 3 punti nel manifest: host_permissions,
  content_scripts.matches, web_accessible_resources.matches — mai dimenticarne uno
- Perplexity.ai richiede sia perplexity.ai/* che www.perplexity.ai/* nel manifest
- Selettori DOM verificati 2026-03-28:
  - Claude risposta: div.font-claude-response
  - Claude prompt: [class*="font-user-message"]
- Selettori DOM verificati 2026-03-29:
  - ChatGPT risposta: [data-message-author-role="assistant"]
  - ChatGPT prompt: [data-message-author-role="user"]
  - Gemini risposta: div.response-content
  - Gemini prompt: div.user-query-container
  - Perplexity risposta: div.prose
  - Perplexity prompt: h1[class*="query"]

---

## Health check selettori DOM

Da implementare post-release: script Node.js su GitHub Actions.
File previsto: scripts/healthcheck.js
Frequenza: ogni 24h via GitHub Actions (.github/workflows/healthcheck.yml)
Logica: Puppeteer apre ogni piattaforma, verifica selettori, invia alert email se rotto.
Piattaforme monitorate: claude.ai, chatgpt.com, gemini.google.com, perplexity.ai
Quando implementare: dopo Fase 7 (Release)
