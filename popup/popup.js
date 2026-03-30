import Storage from '../core/storage.js';

const VALID_PLATFORMS = ['claude', 'chatgpt', 'gemini', 'perplexity'];

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const msg = chrome.i18n.getMessage(key);
    if (!msg) return;
    if (el.tagName === 'INPUT' && el.type === 'text') {
      el.setAttribute('placeholder', msg);
    } else {
      el.textContent = msg;
    }
  });
}

function renderEntry(entry) {
  const div = document.createElement('div');
  div.className = 'tk-entry';
  div.dataset.id = entry.id;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'tk-entry-delete';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await Storage.delete(entry.id);
    allEntries = await Storage.getAll();
    updateCounter(allEntries.length);
    renderEntries(allEntries);
  });

  const prompt = document.createElement('div');
  prompt.className = 'tk-entry-prompt';
  prompt.textContent = entry.prompt;
  prompt.title = entry.prompt;

  const response = document.createElement('div');
  response.className = 'tk-entry-response';
  response.textContent = entry.response;

  const meta = document.createElement('div');
  meta.className = 'tk-entry-meta';

  const platform = document.createElement('span');
  const safePlatform = VALID_PLATFORMS.includes(entry.platform) ? entry.platform : 'unknown';
  platform.className = `tk-entry-platform tk-platform-${safePlatform}`;
  platform.textContent = entry.platform;

  const date = document.createElement('span');
  date.textContent = new Date(entry.createdAt).toLocaleDateString();

  meta.appendChild(platform);
  meta.appendChild(date);

  div.appendChild(deleteBtn);
  div.appendChild(prompt);
  div.appendChild(response);
  div.appendChild(meta);

  div.addEventListener('click', () => {
    if (entry.url) chrome.tabs.create({ url: entry.url });
  });

  return div;
}

function renderEntries(entries) {
  const container = document.getElementById('tk-entries');
  const empty = document.getElementById('tk-empty');

  container.querySelectorAll('.tk-entry').forEach(e => e.remove());

  if (entries.length === 0) {
    empty.classList.remove('tk-hidden');
    return;
  }

  empty.classList.add('tk-hidden');
  entries.forEach(entry => {
    container.appendChild(renderEntry(entry));
  });
}

function updateCounter(count) {
  const counter = document.getElementById('tk-counter');
  const msg = chrome.i18n.getMessage('saved_count_label', [String(count)]);
  counter.textContent = msg || `${count} saved`;
}

let allEntries = [];

async function handleSearch(query) {
  if (!query.trim()) {
    renderEntries(allEntries);
    return;
  }
  const results = await Storage.search(query);
  renderEntries(results);
}

function openLibrary() {
  chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') });
}

function checkUserStatus() {
  chrome.runtime.sendMessage({ type: 'GET_USER_STATUS' })
    .then(response => {
      if (response && response.paid) {
        const btn = document.getElementById('tk-upgrade');
        if (btn) btn.style.display = 'none';
      }
    })
    .catch(() => {});
}

function openPaymentPage() {
  chrome.runtime.sendMessage({ type: 'OPEN_PAYMENT_PAGE' });
}

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();

  const searchInput = document.getElementById('tk-search-input');
  const openLibraryBtn = document.getElementById('tk-open-library');
  const upgradeBtn = document.getElementById('tk-upgrade');

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  openLibraryBtn.addEventListener('click', openLibrary);
  upgradeBtn.addEventListener('click', openPaymentPage);

  allEntries = await Storage.getAll();
  updateCounter(allEntries.length);
  renderEntries(allEntries);
  checkUserStatus();
});
