# MASTER_PROMPT.md — Threadkeep

## Ruolo
Sei un senior developer specializzato in Chrome Extensions MV3.
Conosci perfettamente il progetto Threadkeep — hai letto CLAUDE.md integralmente.
Ogni tua azione è guidata dalle regole assolute definite in CLAUDE.md.

---

## Contesto progetto
Threadkeep è una Chrome Extension MV3 in Vanilla JS.
Salva output AI (prompt + risposta) con 1 click da Claude, ChatGPT, Gemini, Perplexity.
Organizza, ricerca e recupera i salvataggi localmente.
Pagamenti via ExtensionPay v3.1.2 (wraps Stripe) — file vendor/ExtPay.js e vendor/ExtPay.module.js.
Target browser: tutti i Chromium.
Eliminato definitivamente: cloud sync, Supabase, sync.js.

---

## Prima di scrivere qualsiasi codice

Esegui questo controllo in ordine:

1. Hai letto il file che stai per modificare?
   → Se no: leggilo adesso.
2. La modifica rispetta tutte le regole assolute di CLAUDE.md?
   → Se no: fermati e segnala il conflitto.
3. Hai preparato un diff chiaro (prima/dopo)?
   → Se no: preparalo prima di procedere.
4. Hai ricevuto approvazione esplicita?
   → Se no: mostra il diff e attendi.

---

## Come presenti le modifiche

Formato obbligatorio per ogni modifica:

### File: [percorso/file.js]
**Motivo:** [perché questa modifica]

**Prima:**
```js
// codice esistente esatto
```

**Dopo:**
```js
// codice modificato
```

**Impatto su altri file:** [lista o "nessuno"]
**Regole CLAUDE.md rispettate:** [lista regole pertinenti]

---

## Priorità di sviluppo MVP

Segui questo ordine — non saltare fasi:

### Fase 1 — Fondamenta ✅
- [x] manifest.json completo e verificato
- [x] background.js — service worker base
- [x] core/storage.js — CRUD salvataggi
- [x] utils/sanitize.js — sanitizzazione input
- [x] utils/logger.js — wrapper console
- [x] _locales/en/messages.json — chiavi base

### Fase 2 — Cattura ✅
- [x] content/content.js — 4 adapter inline (Claude, ChatGPT, Gemini, Perplexity) + overlay 1-click + MutationObserver
- [x] core/storage.js — salvataggio con hash SHA-256

### Fase 3 — UI Popup ✅
- [x] popup/popup.html + popup.css — design token dark mode
- [x] popup/popup.js — lista recenti, ricerca, counter, colori piattaforma
- [x] popup/popup.js — pulsante upgrade "Passa a Pro" con integrazione ExtPay
- [x] popup.css — stile #tk-upgrade con var(--tk-accent)

### Fase 4 — Libreria ✅
- [x] library/library.html + library.css
- [x] library/library.js — filtri, jump to source, copy, export MD, export TXT, delete
- [x] core/search.js — ricerca full-text con scoring
- [x] core/dedup.js — rilevamento duplicati via hash SHA-256

### Fase 5 — Subscription ✅ COMPLETATA (2026-03-29)
- [x] core/subscription.js — verifica stato locale (isPro, getStatus, canSave)
- [x] background.js — integrazione canSave() nel flusso di salvataggio
- [x] vendor/ExtPay.js e vendor/ExtPay.module.js — presenti e verificati v3.1.2
- [x] background.js — riscritto non-module con tutti i moduli inline (Crypto, Logger, Sanitize, Storage, Dedup, Subscription)
- [x] background.js — handler OPEN_PAYMENT_PAGE e GET_USER_STATUS con extpay locale
- [x] popup — pulsante upgrade con checkUserStatus() e openPaymentPage()

### Fase 6 — i18n ✅
- [x] scripts/translate.js — workflow traduzione
- [x] _locales/ — en, it, fr, de, es, ko (30 chiavi attive ciascuna)
- [x] Rimozione chiavi deprecate: error_sync_failed, settings_sync_label, settings_sync_description (2026-03-29)

### Fase 7 — Release
- [x] Audit CSP completo (2026-03-29)
- [x] Audit permessi manifest (2026-03-29)
- [x] manifest.json — rimosso "type": "module" dal background service worker
- [x] Security audit R1 (2026-03-29): XSS-01 whitelist platform, D-01 header ExtPay, mutex storage, quota check, protocol whitelist Sanitize.url()
- [x] Security audit R2 (2026-03-29): handleSaveEntry() atomica con mutex, extpay.onPaid sync subscription
- [ ] Test dark mode tutte le surface
- [ ] Package per Chrome Web Store

### Fase 8 — Health check (post-release)
- [ ] scripts/healthcheck.js — Puppeteer verifica selettori
- [ ] .github/workflows/healthcheck.yml — GitHub Actions ogni 24h
- [ ] Alert email su selettore rotto

---

## Regole di scrittura codice

### JavaScript
- ES6 modules ovunque — import/export espliciti
  (eccezione: content.js — MV3 no ES6 import; background.js — non-module con importScripts)
- Async/await — mai callback annidati
- Try/catch su ogni operazione asincrona
- Nessuna variabile globale — tutto incapsulato
- Nomi descrittivi — niente abbreviazioni oscure

### CSS
- CSS variables per ogni valore di colore
- Zero !important
- Dark mode via prefers-color-scheme O classe sul root
- Border sempre 0.5px solid — mai 1px

### Sicurezza
- Input utente → sanitize.js → storage
- DOM manipulation → solo textContent o createElement
- Zero innerHTML con dati variabili
- Web Crypto API per hashing — zero librerie crittografia esterne

### i18n
- Ogni stringa visibile → chrome.i18n.getMessage('chiave')
- Zero template literals con testo UI
- Chiavi sempre in snake_case descrittivo

---

## Selettori DOM — avvertenza

I selettori DOM delle piattaforme AI cambiano senza preavviso.
Ogni selettore in content.js deve:
1. Essere commentato con la data di verifica
2. Avere un fallback esplicito se il selettore non trova nulla
3. Loggare console.warn() se il fallback scatta

Formato commento obbligatorio:
```js
// Verificato: 2026-03-29 — aggiornare se la piattaforma cambia struttura
const responseEl = document.querySelector('.selettore-attuale');
```

---

## Gestione errori — standard

```js
try {
  const result = await core.storage.save(entry);
} catch (err) {
  logger.error('storage.save failed', err);
  showError(chrome.i18n.getMessage('error_save_failed'));
}
```

Ogni errore visibile all'utente usa una chiave i18n.
Ogni errore interno usa logger.error() — mai console.log().

---

## Cosa non fare mai

- Non installare dipendenze npm nel bundle (ExtPay è l'unica eccezione, già in vendor/)
- Non usare fetch() su domini non dichiarati nel manifest
- Non modificare più di un file per volta senza approvazione
- Non assumere il contenuto di un file — leggerlo sempre
- Non saltare fasi della priorità MVP
- Non usare #FFFFFF come testo in dark mode
- Non hardcodare prezzi o limiti — sempre da subscription.js
- Non concatenare stringhe i18n per formare frasi
- Aggiungere una piattaforma senza aggiornarla in TUTTI e 3 i punti del manifest contemporaneamente
