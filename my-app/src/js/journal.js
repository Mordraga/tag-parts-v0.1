import { loadFromStorage, saveToStorage } from './storage.js';
import { loadPartsIndex, findPartByName, showToast, attachMentionAutocomplete } from './utils.js';
import { openModal } from './modal.js';

let unlocked = false;
let currentPart = null;

function codeToken(partName, code) {
  return btoa('tagparts:' + partName.toLowerCase() + ':' + code);
}

function entriesKey(partName) {
  return 'journal_entries_' + partName;
}

function genId() {
  return 'jentry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Entry CRUD ────────────────────────────────────────────────

function getEntries(partName) {
  return loadFromStorage(entriesKey(partName), []);
}

function saveEntries(partName, entries) {
  saveToStorage(entriesKey(partName), entries);
}

function addEntry(partName, text) {
  const entries = getEntries(partName);
  entries.unshift({ id: genId(), text: text.trim(), timestamp: new Date().toISOString() });
  saveEntries(partName, entries);
}

function updateEntry(partName, id, newText) {
  const entries = getEntries(partName).map(e =>
    e.id === id ? { ...e, text: newText.trim(), timestamp: new Date().toISOString() } : e
  );
  saveEntries(partName, entries);
}

function deleteEntry(partName, id) {
  const entries = getEntries(partName).filter(e => e.id !== id);
  saveEntries(partName, entries);
}

// ── Render ────────────────────────────────────────────────────

function renderEntries(partName) {
  const container = document.getElementById('journalEntries');
  if (!container) return;
  const entries = getEntries(partName);
  container.innerHTML = '';

  if (!entries.length) {
    container.innerHTML = '<p style="color:var(--timestamp);font-style:italic">No entries yet.</p>';
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'log-entry';
    card.dataset.id = entry.id;

    card.innerHTML = `
      <div class="log-content" style="white-space:pre-wrap">${escapeHtml(entry.text)}</div>
      <div class="log-actions">
        <button class="edit-entry-btn ghost-btn" data-id="${entry.id}">Edit</button>
        <button class="delete-entry-btn ghost-btn" style="color:#a33" data-id="${entry.id}">Delete</button>
        <span class="timestamp" style="margin-left:auto">${formatDate(entry.timestamp)}</span>
      </div>
    `;

    card.querySelector('.edit-entry-btn').addEventListener('click', () => {
      openJournalEditModal(partName, entry);
    });

    card.querySelector('.delete-entry-btn').addEventListener('click', () => {
      if (confirm('Delete this entry?')) {
        deleteEntry(partName, entry.id);
        renderEntries(partName);
        showToast('Entry deleted.');
      }
    });

    container.appendChild(card);
  });
}

function openJournalEditModal(partName, entry) {
  openModal('Edit Entry', (body, close) => {
    body.innerHTML = `
      <div class="log-edit-form">
        <textarea rows="6" style="width:100%;box-sizing:border-box">${escapeHtml(entry.text)}</textarea>
        <div class="edit-actions">
          <button class="save-edit-btn">Save</button>
          <button class="cancel-edit-btn ghost-btn">Cancel</button>
        </div>
      </div>
    `;

    body.querySelector('.cancel-edit-btn').addEventListener('click', close);

    body.querySelector('.save-edit-btn').addEventListener('click', () => {
      const newText = body.querySelector('textarea').value;
      if (!newText.trim()) return;
      updateEntry(partName, entry.id, newText);
      renderEntries(partName);
      close();
    });

    const ta = body.querySelector('textarea');
    attachMentionAutocomplete(ta);
    ta.focus();
  });
}

// ── Journal View ──────────────────────────────────────────────

function renderJournal(part) {
  const root = document.getElementById('journalRoot');
  root.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'journal-part-header';
  header.innerHTML = `
    <div class="journal-color-bar" style="background:${part.color}"></div>
    <h2>${escapeHtml(part.name)}'s Journal</h2>
  `;
  root.appendChild(header);

  const compose = document.createElement('div');
  compose.className = 'journal-compose card';
  compose.innerHTML = `
    <textarea id="newEntryText" rows="4" placeholder="Write something..." style="width:100%;box-sizing:border-box"></textarea>
    <button id="saveEntryBtn">Save Entry</button>
  `;
  root.appendChild(compose);
  attachMentionAutocomplete(compose.querySelector('#newEntryText'));

  compose.querySelector('#saveEntryBtn').addEventListener('click', () => {
    const ta = compose.querySelector('#newEntryText');
    if (!ta.value.trim()) return;
    addEntry(part.name, ta.value);
    ta.value = '';
    renderEntries(part.name);
  });

  const listSection = document.createElement('section');
  listSection.id = 'journalEntries';
  root.appendChild(listSection);

  renderEntries(part.name);
}

// ── Gate ──────────────────────────────────────────────────────

function renderGate(part) {
  const root = document.getElementById('journalRoot');
  root.innerHTML = '';

  const gate = document.createElement('div');
  gate.className = 'journal-gate';
  gate.innerHTML = `
    <div class="gate-accent" style="background:${part.color}20;border:2px solid ${part.color}">📓</div>
    <h2 style="border-bottom:3px solid ${part.color};padding-bottom:6px">${escapeHtml(part.name)}'s Journal</h2>
    <p style="color:var(--timestamp);font-size:0.88rem">Private notes &mdash; enter your code to continue.</p>
    <input type="password" id="codeInput" placeholder="Your code" autocomplete="off" />
    <button id="unlockBtn" style="background:${part.color}">Unlock</button>
    <p class="gate-error hidden" id="gateError">Incorrect code — try again.</p>
  `;
  root.appendChild(gate);

  const input = gate.querySelector('#codeInput');
  const btn = gate.querySelector('#unlockBtn');
  const err = gate.querySelector('#gateError');

  const attempt = () => {
    const codes = loadFromStorage('journal_codes', {});
    const stored = codes[part.name];
    if (codeToken(part.name, input.value) === stored) {
      unlocked = true;
      renderJournal(part);
    } else {
      err.classList.remove('hidden');
      input.value = '';
      input.focus();
    }
  };

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  input.focus();
}

// ── Init ──────────────────────────────────────────────────────

function initJournalPage() {
  const params = new URLSearchParams(window.location.search);
  const partName = params.get('part');

  if (!partName) {
    document.getElementById('journalRoot').innerHTML =
      '<div class="card" style="margin:24px;gap:12px"><p>No part specified.</p><a href="parts.html" class="btn-link">Go to Parts</a></div>';
    return;
  }

  const partsIndex = loadPartsIndex();
  const part = findPartByName(partName, partsIndex);

  if (!part) {
    document.getElementById('journalRoot').innerHTML =
      `<div class="card" style="margin:24px;gap:12px"><p>Part "${escapeHtml(partName)}" not found.</p><a href="parts.html" class="btn-link">Go to Parts</a></div>`;
    return;
  }

  currentPart = part;
  document.title = `${part.name}'s Journal`;

  const codes = loadFromStorage('journal_codes', {});
  if (codes[part.name]) {
    renderGate(part);
  } else {
    unlocked = true;
    renderJournal(part);
  }
}

document.addEventListener('DOMContentLoaded', initJournalPage);
