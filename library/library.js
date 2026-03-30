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

function renderEntry(entry, index) {
  const div = document.createElement('div');
  div.className = 'lib-entry';
  div.dataset.id = entry.id;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'lib-entry-delete';
  deleteBtn.textContent = '×';
  try {
    deleteBtn.title = chrome.i18n.getMessage('delete_label') || 'Delete';
  } catch {
    deleteBtn.title = 'Delete';
  }
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await Storage.delete(entry.id);
    allEntries = await Storage.getAll();
    updateCounter(allEntries.length);
    renderEntries(allEntries);
    renderTagFilters();
  });

  const prompt = document.createElement('div');
  prompt.className = 'lib-entry-prompt';
  prompt.textContent = entry.prompt;

  const response = document.createElement('div');
  response.className = 'lib-entry-response';
  response.textContent = entry.response;

  const meta = document.createElement('div');
  meta.className = 'lib-entry-meta';

  const platform = document.createElement('span');
  const safePlatform = VALID_PLATFORMS.includes(entry.platform) ? entry.platform : 'unknown';
  platform.className = `lib-entry-platform lib-platform-${safePlatform}`;
  platform.textContent = entry.platform;

  const date = document.createElement('span');
  date.textContent = new Date(entry.createdAt).toLocaleDateString();

  meta.appendChild(platform);
  meta.appendChild(date);

  const actions = document.createElement('div');
  actions.className = 'lib-entry-actions';

  const jumpBtn = document.createElement('button');
  jumpBtn.textContent = chrome.i18n.getMessage('jump_to_chat_label') || 'Jump to chat';
  jumpBtn.addEventListener('click', () => {
    if (entry.url) chrome.tabs.create({ url: entry.url });
  });

  actions.appendChild(jumpBtn);

  const copyBtn = document.createElement('button');
  copyBtn.textContent = chrome.i18n.getMessage('copy_label') || 'Copy';
  copyBtn.addEventListener('click', async () => {
    const text = `${entry.prompt}\n\n---\n\n${entry.response}`;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = chrome.i18n.getMessage('copied_feedback_label') || 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = chrome.i18n.getMessage('copy_label') || 'Copy';
      }, 2000);
    } catch (err) {
      // silent fail — clipboard access may be denied
    }
  });

  actions.appendChild(copyBtn);

  const exportBtn = document.createElement('button');
  exportBtn.textContent = chrome.i18n.getMessage('export_md_label') || 'Export MD';
  exportBtn.addEventListener('click', () => {
    const md = `# Prompt\n\n${entry.prompt}\n\n---\n\n# Response\n\n${entry.response}\n\n---\n\n*Platform: ${entry.platform} — Date: ${new Date(entry.createdAt).toLocaleDateString()}*`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threadkeep_${entry.platform}_${index + 1}.md`;
    a.click();
    URL.revokeObjectURL(url);
  });

  actions.appendChild(exportBtn);

  const exportTxtBtn = document.createElement('button');
  exportTxtBtn.textContent = chrome.i18n.getMessage('export_txt_label') || 'Export TXT';
  exportTxtBtn.addEventListener('click', () => {
    const txt = `Prompt:\n${entry.prompt}\n\n---\n\nResponse:\n${entry.response}\n\n---\n\nPlatform: ${entry.platform} — Date: ${new Date(entry.createdAt).toLocaleDateString()}`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threadkeep_${entry.platform}_${index + 1}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  actions.appendChild(exportTxtBtn);

  div.appendChild(deleteBtn);
  div.appendChild(prompt);
  div.appendChild(response);
  div.appendChild(meta);
  div.appendChild(actions);

  return div;
}

function renderEntries(entries) {
  const container = document.getElementById('lib-entries');
  const empty = document.getElementById('lib-empty');

  container.querySelectorAll('.lib-entry').forEach(e => e.remove());

  if (entries.length === 0) {
    empty.classList.remove('lib-hidden');
    return;
  }

  empty.classList.add('lib-hidden');
  entries.forEach((entry, index) => {
    container.appendChild(renderEntry(entry, index));
  });
}

function updateCounter(count) {
  const counter = document.getElementById('lib-counter');
  const msg = chrome.i18n.getMessage('saved_count_label', [String(count)]);
  counter.textContent = msg || `${count} saved`;
}

function renderTagFilters() {
  const container = document.getElementById('lib-tags');
  container.querySelectorAll('.lib-tag-chip').forEach(e => e.remove());

  const allTags = [...new Set(allEntries.flatMap(e => e.tags))];
  allTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'lib-tag-chip';
    chip.textContent = tag;
    chip.addEventListener('click', () => {
      filterByTag(tag, chip);
    });
    container.appendChild(chip);
  });
}

let allEntries = [];
let activeTag = null;

function filterByTag(tag, chip) {
  if (activeTag === tag) {
    activeTag = null;
    chip.classList.remove('active');
  } else {
    document.querySelectorAll('.lib-tag-chip').forEach(c => c.classList.remove('active'));
    activeTag = tag;
    chip.classList.add('active');
  }
  applyFilters();
}

function applyFilters() {
  let filtered = allEntries;

  if (activeTag) {
    filtered = filtered.filter(e => e.tags.includes(activeTag));
  }

  renderEntries(filtered);
}

async function handleSearch(query) {
  if (!query.trim()) {
    renderEntries(allEntries);
    return;
  }
  const results = await Storage.search(query);
  renderEntries(results);
}

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();

  const searchInput = document.getElementById('lib-search-input');
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  allEntries = await Storage.getAll();
  updateCounter(allEntries.length);
  renderEntries(allEntries);
  renderTagFilters();
});
