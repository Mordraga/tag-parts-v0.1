// utils.js
import { marked } from './vendor/marked.esm.js';
import createDOMPurify from './vendor/purify.es.mjs';
import { loadFromStorage, saveToStorage } from './storage.js';

const DOMPurify = createDOMPurify(window);

marked.setOptions({
  breaks: true,
  gfm: true
});

// ── Terminology helpers ───────────────────────────────────────────────────────
const TERM_PRESETS = {
  parts:     { singular: 'Part',     plural: 'Parts'     },
  alters:    { singular: 'Alter',    plural: 'Alters'    },
  headmates: { singular: 'Headmate', plural: 'Headmates' },
  members:   { singular: 'Member',   plural: 'Members'   },
};

function readTerminology() {
  try { return JSON.parse(localStorage.getItem('terminology') || '{}'); } catch { return {}; }
}

export function getTermSingular() {
  const t = readTerminology();
  return t.singular || 'Member';
}

export function getTermPlural() {
  const t = readTerminology();
  return t.plural || 'Members';
}

export { TERM_PRESETS };

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

let suggestionsPopulated = false;

export function attachPartSuggestions(inputEl) {
  if (!inputEl) return;
  
  let list = document.getElementById(PART_SUGGESTION_ID);
  if (!list) {
    list = document.createElement('datalist');
    list.id = PART_SUGGESTION_ID;
    document.body.appendChild(list);
  }

  if (!suggestionsPopulated) {
    populatePartSuggestions(list);
    suggestionsPopulated = true;
  }

  inputEl.setAttribute('list', PART_SUGGESTION_ID);
}

// @mention autocomplete for message textareas and text inputs
export function attachMentionAutocomplete(el) {
  if (!el) return;

  let menu = null;

  function getContext() {
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    // Match the last @ up to the cursor — allow spaces so multi-word names work
    const m = before.match(/@([^@\n]*)$/);
    if (!m) return null;
    const query = m[1];
    // Don't trigger if nothing typed after @ yet (show all parts) or if only spaces
    return { query: query.toLowerCase(), atPos: pos - m[0].length, end: pos };
  }

  function removeMenu() {
    menu?.remove();
    menu = null;
  }

  function pick(partName, ctx) {
    const val = el.value;
    const insert = '@' + partName;
    el.value = val.slice(0, ctx.atPos) + insert + val.slice(ctx.end);
    const newPos = ctx.atPos + insert.length;
    el.setSelectionRange(newPos, newPos);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    removeMenu();
    el.focus();
  }

  function showMenu(parts, ctx) {
    removeMenu();
    if (!parts.length) return;

    menu = document.createElement('div');
    menu.className = 'mention-autocomplete';

    parts.slice(0, 8).forEach((part) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mention-ac-item';
      const dot = document.createElement('span');
      dot.className = 'mention-ac-dot';
      dot.style.background = part.color || '#6699cc';
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(part.name));
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pick(part.name, ctx);
      });
      menu.appendChild(btn);
    });

    const rect = el.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.minWidth = `${Math.min(rect.width, 220)}px`;
    document.body.appendChild(menu);
  }

  el.addEventListener('input', () => {
    const ctx = getContext();
    if (!ctx) { removeMenu(); return; }
    const all = loadPartsIndex().filter(p => p.name !== '???');
    const q = ctx.query;
    const matches = all.filter(p => p.name.toLowerCase().startsWith(q));
    if (matches.length) showMenu(matches, ctx);
    else removeMenu();
  });

  el.addEventListener('blur', () => setTimeout(removeMenu, 150));
  window.addEventListener('scroll', removeMenu, { passive: true, capture: true });
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
// Placeholder uses «»  which are not markdown special characters and won't be
// processed as bold/italic/code by marked, so the replacement survives sanitization.
const PLACEHOLDER_PREFIX = '«MENTION';
const PLACEHOLDER_SUFFIX = '»';

function buildMentionRegex(partsIndex) {
  // Sort longest first so multi-word names match before shorter prefixes.
  // Escape regex special chars in part names, then fall back to the generic
  // word-char class for @mentions of unknown names.
  const escapedNames = partsIndex
    .map(p => p.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const alternatives = escapedNames.length
    ? [...escapedNames, "[A-Za-z0-9_'`\\-]+"]
    : ["[A-Za-z0-9_'`\\-]+"];

  return new RegExp(`@(${alternatives.join('|')})`, 'gi');
}

export function formatMentions(text = '', partsIndex = loadPartsIndex()) {
  if (!text) return { html: '', mentions: [] };
  const mentionEntries = [];
  const map = Object.fromEntries(
    partsIndex.map((p) => [p.name.trim().toLowerCase(), p])
  );

  const mentionRegex = buildMentionRegex(partsIndex);
  let placeholderIndex = 0;
  const textWithPlaceholders = text.replace(mentionRegex, (match, name) => {
    const key = name.trim().toLowerCase();
    const part = map[key];
    if (!part) return match;
    const placeholder = `${PLACEHOLDER_PREFIX}${placeholderIndex++}${PLACEHOLDER_SUFFIX}`;
    mentionEntries.push({ placeholder, raw: match, name: part.name, color: part.color });
    return placeholder;
  });

  const markdownHtml = marked.parse(textWithPlaceholders || '');
  let html = DOMPurify.sanitize(markdownHtml || '');

  mentionEntries.forEach((mention) => {
    const color = mention.color || '#6699cc';
    const replacement = `<span class="mention" style="color:${color}">${escapeHtml(mention.raw)}</span>`;
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
