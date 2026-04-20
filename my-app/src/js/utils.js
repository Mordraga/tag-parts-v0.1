// utils.js
import { marked } from './vendor/marked.esm.js';
import createDOMPurify from './vendor/purify.es.mjs';
import { loadFromStorage, saveToStorage } from './storage.js';

const DOMPurify = createDOMPurify(window);

marked.setOptions({
  breaks: true,
  gfm: true
});

// Keys
const PARTS_INDEX_KEY = 'parts_index';
const PART_SUGGESTION_ID = 'partsSuggestions';
const FALLBACK_CONTROLLERS = new Map();
const NEEDS_FALLBACK_SUGGESTIONS = typeof window !== 'undefined' && !!window.Capacitor;

// Parts helpers
export function loadPartsIndex() {
  const existing = loadFromStorage(PARTS_INDEX_KEY, []);
  if (existing.length) {
    if (!existing.some((part) => part?.name?.trim().toLowerCase() === '???')) {
      existing.unshift({ name: '???', color: '#888888' });
      saveToStorage(PARTS_INDEX_KEY, existing);
    }
    return existing;
  }

  const parts = loadFromStorage('parts_data', []);
  if (!parts.length) {
    return existing;
  }

  const rebuilt = parts
    .filter((part) => part?.name)
    .map((part) => ({ name: part.name, color: part.color }));
  const names = new Set(rebuilt.map((part) => part.name.trim().toLowerCase()));
  if (!names.has('???')) {
    rebuilt.unshift({ name: '???', color: '#888888' });
  }
  saveToStorage(PARTS_INDEX_KEY, rebuilt);
  return rebuilt;
}

export function findPartByName(name, partsIndex = loadPartsIndex()) {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  return partsIndex.find((p) => p.name.trim().toLowerCase() === needle) || null;
}

export function attachPartSuggestions(inputEl) {
  if (!inputEl) return;

  if (NEEDS_FALLBACK_SUGGESTIONS) {
    if (!FALLBACK_CONTROLLERS.has(inputEl)) {
      FALLBACK_CONTROLLERS.set(inputEl, createFallbackSuggestions(inputEl));
    }
    return;
  }

  let list = document.getElementById(PART_SUGGESTION_ID);
  if (!list) {
    list = document.createElement('datalist');
    list.id = PART_SUGGESTION_ID;
    document.body.appendChild(list);
  }

  populatePartSuggestions(list);
  inputEl.setAttribute('list', PART_SUGGESTION_ID);
}

export function refreshPartSuggestions() {
  const list = document.getElementById(PART_SUGGESTION_ID);
  if (list) {
    populatePartSuggestions(list);
  }

  if (FALLBACK_CONTROLLERS.size) {
    FALLBACK_CONTROLLERS.forEach((controller) => controller.refresh());
  }
}

function populatePartSuggestions(listEl) {
  const parts = loadPartsIndex();
  listEl.innerHTML = parts
    .map((part) => `<option value="${escapeHtml(part.name)}"></option>`)
    .join('');
}

function createFallbackSuggestions(inputEl) {
  const menu = document.createElement('div');
  menu.className = 'part-suggestions-menu hidden';
  document.body.appendChild(menu);

  const state = {
    options: loadPartsIndex(),
  };

  const hideMenu = () => {
    menu.classList.add('hidden');
  };

  const positionMenu = () => {
    const rect = inputEl.getBoundingClientRect();
    menu.style.width = `${rect.width}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  };

  const renderOptions = () => {
    const term = inputEl.value.trim().toLowerCase();
    const matches = state.options
      .filter((part) => !term || part.name.toLowerCase().includes(term))
      .slice(0, 8);

    if (!matches.length) {
      hideMenu();
      return;
    }

    menu.innerHTML = '';
    matches.forEach((part) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = part.name;
      btn.addEventListener('click', () => {
        inputEl.value = part.name;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        hideMenu();
      });
      menu.appendChild(btn);
    });

    positionMenu();
    menu.classList.remove('hidden');
  };

  const refresh = () => {
    state.options = loadPartsIndex();
    if (!menu.classList.contains('hidden')) {
      renderOptions();
    }
  };

  inputEl.setAttribute('autocomplete', 'off');
  inputEl.addEventListener('focus', () => {
    refresh();
    renderOptions();
  });
  inputEl.addEventListener('input', renderOptions);
  inputEl.addEventListener('blur', () => setTimeout(hideMenu, 150));
  window.addEventListener('resize', positionMenu);
  window.addEventListener('scroll', positionMenu, true);
  document.addEventListener('click', (evt) => {
    if (evt.target === inputEl || menu.contains(evt.target)) {
      return;
    }
    hideMenu();
  });

  return { refresh };
}

// Mention parsing/highlighting
const mentionRegex = /@([A-Za-z0-9_'`-]+)/g;
const PLACEHOLDER_PREFIX = '__MENTION__';

export function formatMentions(text = '', partsIndex = loadPartsIndex()) {
  if (!text) return { html: '', mentions: [] };
  const mentionEntries = [];
  const map = Object.fromEntries(
    partsIndex.map((p) => [p.name.trim().toLowerCase(), p])
  );

  let placeholderIndex = 0;
  const textWithPlaceholders = text.replace(mentionRegex, (match, name) => {
    const key = name.trim().toLowerCase();
    const part = map[key];
    if (!part) {
      return match;
    }
    const placeholder = `${PLACEHOLDER_PREFIX}${placeholderIndex++}__`;
    mentionEntries.push({
      placeholder,
      raw: match,
      name: part.name,
      color: part.color
    });
    return placeholder;
  });

  const markdownHtml = marked.parse(textWithPlaceholders || '');
  let html = DOMPurify.sanitize(markdownHtml || '');

  mentionEntries.forEach((mention) => {
    const color = mention.color || '#6699cc';
    const replacement = `<span class="mention" style="color:${color}">${escapeHtml(
      mention.raw
    )}</span>`;
    html = html.split(mention.placeholder).join(replacement);
  });

  const mentions = mentionEntries.map(({ placeholder, ...rest }) => rest);
  return { html, mentions };
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Lightweight toast for tips
export function showToast(message, type = 'info', duration = 2500) {
  const existing = document.querySelector('.toast-tip');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = type === 'error' ? 'toast-tip error' : 'toast-tip';
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add('visible');
  }, 50);

  setTimeout(() => {
    el.classList.remove('visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, duration);
}
