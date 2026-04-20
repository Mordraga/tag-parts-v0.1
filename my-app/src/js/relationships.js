import { loadFromStorage, saveToStorage } from './storage.js';
import { loadPartsIndex, findPartByName, attachPartSuggestions, showToast } from './utils.js';

const STORAGE_KEY = 'relationships_data';

function getRelationships() {
  return loadFromStorage(STORAGE_KEY, []);
}

function saveRelationships(rels) {
  saveToStorage(STORAGE_KEY, rels);
}

function genId() {
  return 'rel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTextColor(hex) {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000' : '#fff';
}

function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = Math.max(Math.min(255, (num >> 16) + percent), 0);
  let g = Math.max(Math.min(255, (num >> 8 & 0x00FF) + percent), 0);
  let b = Math.max(Math.min(255, (num & 0x0000FF) + percent), 0);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

// ── Part chip helper ──────────────────────────────────────────

function makePartChip(name, partsIndex) {
  const part = findPartByName(name, partsIndex);
  const span = document.createElement('span');
  span.className = 'part-chip';

  if (!part) {
    span.classList.add('unknown-part');
    span.textContent = name || '?';
    return span;
  }

  const color = part.color || '#6699cc';
  const r = parseInt(color.substr(1, 2), 16);
  const g = parseInt(color.substr(3, 2), 16);
  const b = parseInt(color.substr(5, 2), 16);
  const textColor = (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000' : '#fff';

  span.style.borderColor = color;
  span.style.background = `rgba(${r},${g},${b},0.15)`;
  span.style.color = textColor;
  span.innerHTML = `<span class="part-dot" style="background:${color}"></span>${escapeHtml(part.name)}`;
  return span;
}

// plain name chip for external people (no part color data)
function makeNameChip(name) {
  const span = document.createElement('span');
  span.className = 'part-chip unknown-part';
  span.textContent = name || '?';
  return span;
}

// ── CRUD ──────────────────────────────────────────────────────

function addRelationship(partA, partB, type, notes, internal, partsIndex) {
  const errEl = document.getElementById('relFormError');
  if (!partA.trim() || !partB.trim() || !type.trim()) {
    errEl.textContent = 'All three fields (part, description, person/part) are required.';
    errEl.style.display = 'block';
    return false;
  }
  if (!findPartByName(partA, partsIndex)) {
    errEl.textContent = `"${partA}" not found in parts directory.`;
    errEl.style.display = 'block';
    return false;
  }
  errEl.style.display = 'none';

  const rels = getRelationships();
  rels.unshift({
    id: genId(),
    partA: partA.trim(),
    partB: partB.trim(),
    type: type.trim(),
    notes: notes.trim(),
    internal: !!internal,
    timestamp: new Date().toISOString()
  });
  saveRelationships(rels);
  return true;
}

function deleteRelationship(id) {
  if (!confirm('Delete this relationship?')) return;
  saveRelationships(getRelationships().filter(r => r.id !== id));
  renderRelationships(currentFilter());
  showToast('Relationship removed.');
}

function updateRelationship(id, updates) {
  const rels = getRelationships().map(r =>
    r.id === id ? { ...r, ...updates, timestamp: new Date().toISOString() } : r
  );
  saveRelationships(rels);
}

// ── Filter state ──────────────────────────────────────────────

function currentFilter() {
  return (document.getElementById('relFilter')?.value || '').trim().toLowerCase();
}

// ── Render ────────────────────────────────────────────────────

function createRelCard(rel, partsIndex) {
  const partAData = findPartByName(rel.partA, partsIndex);
  const baseColor = partAData?.color || '#6699cc';
  const gradient = `linear-gradient(to right, ${baseColor} 0%, #f0f0f0 85%)`;
  const textColor = getTextColor(baseColor);
  const borderColor = shade(baseColor, -30);

  const card = document.createElement('div');
  card.className = 'part-card';
  card.style.background = gradient;
  card.style.color = textColor;
  card.style.border = `2px solid ${borderColor}`;
  card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
  card.dataset.id = rel.id;

  // Part A chip → type → Part B chip
  const chipsRow = document.createElement('div');
  chipsRow.className = 'rel-chips-row';
  chipsRow.appendChild(makePartChip(rel.partA, partsIndex));

  const typeLabel = document.createElement('span');
  typeLabel.className = 'rel-type-label';
  typeLabel.textContent = rel.type;
  typeLabel.style.color = textColor;
  chipsRow.appendChild(typeLabel);

  const partBChip = rel.internal
    ? makePartChip(rel.partB, partsIndex)
    : makeNameChip(rel.partB);
  chipsRow.appendChild(partBChip);
  card.appendChild(chipsRow);

  if (rel.notes) {
    const notesEl = document.createElement('p');
    notesEl.className = 'rel-notes';
    notesEl.textContent = rel.notes;
    notesEl.style.color = textColor;
    card.appendChild(notesEl);
  }

  // Internal/external badge
  const badge = document.createElement('em');
  badge.textContent = rel.internal ? '🔒 Internal' : '🌐 External';
  badge.style.color = textColor;
  card.appendChild(badge);

  // Timestamp
  const timeEl = document.createElement('p');
  timeEl.className = 'timestamp';
  timeEl.textContent = `📅 ${formatDate(rel.timestamp)}`;
  timeEl.style.color = textColor;
  card.appendChild(timeEl);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'part-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => {
    const existing = card.querySelector('.rel-edit-form');
    if (existing) { existing.remove(); return; }
    card.appendChild(buildRelEditForm(rel, partsIndex));
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => deleteRelationship(rel.id));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}

function buildRelEditForm(rel, partsIndex) {
  const form = document.createElement('div');
  form.className = 'rel-edit-form';
  form.innerHTML = `
    <label>Part
      <input type="text" class="edit-partA" value="${escapeHtml(rel.partA)}" autocomplete="off" />
    </label>
    <label>Relationship
      <input type="text" class="edit-type" value="${escapeHtml(rel.type)}" autocomplete="off" />
    </label>
    <label>With
      <input type="text" class="edit-partB" value="${escapeHtml(rel.partB)}" autocomplete="off" />
    </label>
    <label>Notes
      <textarea class="edit-notes" rows="2">${escapeHtml(rel.notes || '')}</textarea>
    </label>
    <label class="checkbox-field">
      <input type="checkbox" class="edit-internal" ${rel.internal ? 'checked' : ''} />
      Internal (system only)
    </label>
    <div class="edit-actions">
      <button type="button" class="save-rel-edit">Save</button>
      <button type="button" class="cancel-rel-edit">Cancel</button>
    </div>
  `;

  attachPartSuggestions(form.querySelector('.edit-partA'));
  attachPartSuggestions(form.querySelector('.edit-partB'));

  form.querySelector('.cancel-rel-edit').addEventListener('click', () => form.remove());

  form.querySelector('.save-rel-edit').addEventListener('click', () => {
    const newPartA = form.querySelector('.edit-partA').value.trim();
    const newPartB = form.querySelector('.edit-partB').value.trim();
    const newType = form.querySelector('.edit-type').value.trim();
    const newNotes = form.querySelector('.edit-notes').value.trim();
    const newInternal = form.querySelector('.edit-internal').checked;

    if (!newPartA || !newPartB || !newType) return;
    if (!findPartByName(newPartA, partsIndex)) {
      alert(`"${newPartA}" not found in parts directory.`);
      return;
    }

    updateRelationship(rel.id, {
      partA: newPartA, partB: newPartB,
      type: newType, notes: newNotes, internal: newInternal
    });
    renderRelationships(currentFilter());
  });

  return form;
}

function renderRelationships(filter = '') {
  const container = document.getElementById('relationshipList');
  if (!container) return;

  const partsIndex = loadPartsIndex();
  let rels = getRelationships();

  if (filter) {
    const needle = filter.toLowerCase();
    rels = rels.filter(r =>
      r.partA.toLowerCase().includes(needle) || r.partB.toLowerCase().includes(needle)
    );
  }

  container.innerHTML = '';

  if (!rels.length) {
    container.innerHTML = `<p style="color:var(--timestamp);font-style:italic;padding:8px 0">${filter ? 'No relationships match that filter.' : 'No relationships added yet.'}</p>`;
    return;
  }

  rels.forEach(rel => container.appendChild(createRelCard(rel, partsIndex)));
}

// ── Init ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const partsIndex = loadPartsIndex();

  attachPartSuggestions(document.getElementById('relPartA'));
  attachPartSuggestions(document.getElementById('relPartB'));
  attachPartSuggestions(document.getElementById('relFilter'));

  document.getElementById('addRelBtn').addEventListener('click', () => {
    const partA    = document.getElementById('relPartA').value;
    const type     = document.getElementById('relType').value;
    const partB    = document.getElementById('relPartB').value;
    const notes    = document.getElementById('relNotes').value;
    const internal = document.getElementById('relInternal').checked;

    const ok = addRelationship(partA, partB, type, notes, internal, partsIndex);
    if (ok) {
      document.getElementById('relPartA').value = '';
      document.getElementById('relType').value = '';
      document.getElementById('relPartB').value = '';
      document.getElementById('relNotes').value = '';
      document.getElementById('relInternal').checked = true;
      renderRelationships(currentFilter());
    }
  });

  document.getElementById('relFilter').addEventListener('input', () => {
    renderRelationships(currentFilter());
  });

  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    document.getElementById('relFilter').value = '';
    renderRelationships('');
  });

  renderRelationships();
});
