
import { saveToStorage, loadFromStorage } from './storage.js';
import { refreshPartSuggestions, showToast } from './utils.js';

const STORAGE_KEY = 'parts_data';
const INDEX_KEY = 'parts_index';
const partsMap = {};

function getParts() {
  return loadFromStorage(STORAGE_KEY);
}

function saveParts(parts) {
  saveToStorage(STORAGE_KEY, parts);
  updatePartsIndex(parts);
  rebuildPartsMap(parts);
  refreshPartSuggestions();
}

function updatePartsIndex(parts) {
  const index = parts.map(p => ({ name: p.name, color: p.color }));
  saveToStorage(INDEX_KEY, index);
}

function ensureIndexFile() {
  const existing = loadFromStorage(INDEX_KEY, null);
  if (!existing) {
    saveToStorage(INDEX_KEY, []);
  }
}

function getPartsIndex() {
  return loadFromStorage(INDEX_KEY);
}

function rebuildPartsMap(parts) {
  Object.keys(partsMap).forEach((key) => delete partsMap[key]);
  parts.forEach((part) => {
    if (part?.name) {
      partsMap[part.name] = part;
    }
  });
}

function addPart(part) {
  const parts = getParts();
  parts.push(part);
  saveParts(parts);
}

function deletePart(index) {
  if (!confirm('Delete this part?')) return;
  const parts = getParts();
  parts.splice(index, 1);
  saveParts(parts);
  renderParts();
}

function editPart(index, updates) {
  const parts = getParts();
  const target = parts[index];
  if (!target) return;
  const nextPart = {
    ...target,
    ...updates,
    timestamp: new Date().toLocaleString()
  };
  parts[index] = nextPart;
  saveParts(parts);
  renderParts();
}

function renderParts() {
  const container = document.getElementById('partList');
  if (!container) return;

  const parts = getParts();
  container.innerHTML = '';

  parts.forEach((part, index) => {
    const div = document.createElement('div');
    div.className = 'part-card';

    const baseColor = part.color || '#6699cc';
    const gradient = `linear-gradient(to right, ${baseColor} 0%, #f0f0f0 85%)`;
    const textColor = getTextColor(baseColor);
    const borderColor = shade(baseColor, -30);

    div.style.background = gradient;
    div.style.color = textColor;
    div.style.border = `2px solid ${borderColor}`;
    div.style.boxShadow = `0 1px 3px rgba(0, 0, 0, 0.05)`;

    // Name
    const nameEl = document.createElement('strong');
    nameEl.textContent = part.name;
    nameEl.style.color = textColor;
    div.appendChild(nameEl);

    // Alias (if present)
    if (part.alias) {
      const aliasEl = document.createElement('em');
      aliasEl.className = 'alias';
      aliasEl.textContent = ` aka: ${part.alias}`;
      aliasEl.style.color = textColor;
      div.appendChild(aliasEl);
    }

    // Role
    const roleEl = document.createElement('p');
    roleEl.innerHTML = `🧩 Role: ${part.role}`;
    roleEl.style.color = textColor;
    div.appendChild(roleEl);

    // IFS Role (if present)
    if (part.ifsRole) {
      const ifsEl = document.createElement('p');
      ifsEl.innerHTML = `🧠 IFS: ${part.ifsRole}`;
      ifsEl.style.color = textColor;
      div.appendChild(ifsEl);
    }

    // Privacy flag
    if (part.private) {
      const privateEl = document.createElement('em');
      privateEl.textContent = '🔒 Hidden/Internal';
      privateEl.style.color = textColor;
      div.appendChild(privateEl);
    }

    // Timestamp
    const timeEl = document.createElement('p');
    timeEl.className = 'timestamp';
    timeEl.innerHTML = `📅 ${part.timestamp}`;
    timeEl.style.color = textColor;
    div.appendChild(timeEl);

    const actions = document.createElement('div');
    actions.className = 'part-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      if (div.querySelector('.part-edit-form')) return;
      const form = buildEditForm(part, index);
      div.appendChild(form);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deletePart(index);

    const journalBtn = document.createElement('button');
    journalBtn.type = 'button';
    journalBtn.textContent = '📓 Journal';
    journalBtn.onclick = () => {
      window.location.href = 'journal.html?part=' + encodeURIComponent(part.name);
    };

    const setCodeBtn = document.createElement('button');
    setCodeBtn.type = 'button';
    setCodeBtn.textContent = '🔑 Set Code';
    setCodeBtn.onclick = () => {
      const existing = div.querySelector('.journal-code-form');
      if (existing) { existing.remove(); return; }
      const form = buildJournalCodeForm(part);
      div.appendChild(form);
    };

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(journalBtn);
    actions.appendChild(setCodeBtn);
    div.appendChild(actions);

    container.appendChild(div);
  });
}

function saveJournalCode(partName, code) {
  const codes = loadFromStorage('journal_codes', {});
  codes[partName] = btoa('tagparts:' + partName.toLowerCase() + ':' + code);
  saveToStorage('journal_codes', codes);
}

function buildJournalCodeForm(part) {
  const codes = loadFromStorage('journal_codes', {});
  const hasCode = !!codes[part.name];

  const form = document.createElement('div');
  form.className = 'journal-code-form';

  form.innerHTML = `
    <p>${hasCode ? 'Change the private code for this journal.' : 'Set a private code for this journal.'}</p>
    <input type="password" class="jcode-input" placeholder="New code" autocomplete="off" />
    <input type="password" class="jcode-confirm" placeholder="Confirm code" autocomplete="off" />
    <p class="jcode-error" style="color:#a33;font-size:0.82rem;display:none">Codes don't match.</p>
    <div style="display:flex;gap:8px">
      <button type="button" class="jcode-save-btn">Save Code</button>
      <button type="button" class="jcode-cancel-btn ghost-btn">Cancel</button>
    </div>
  `;

  form.querySelector('.jcode-save-btn').addEventListener('click', () => {
    const a = form.querySelector('.jcode-input').value;
    const b = form.querySelector('.jcode-confirm').value;
    const err = form.querySelector('.jcode-error');
    if (!a.trim()) return;
    if (a !== b) { err.style.display = 'block'; return; }
    err.style.display = 'none';
    saveJournalCode(part.name, a);
    form.remove();
  });

  form.querySelector('.jcode-cancel-btn').addEventListener('click', () => form.remove());
  return form;
}

function getTextColor(hex) {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000' : '#fff';
}

function shade(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + percent;
  let g = (num >> 8 & 0x00FF) + percent;
  let b = (num & 0x0000FF) + percent;

  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);

  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

function handleSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const alias = document.getElementById('alias').value.trim();
  const role = document.getElementById('role').value.trim();
  const ifsRole = document.getElementById('ifsRole').value.trim();
  const colorPicker = document.getElementById('color').value;
  const hexInput = document.getElementById('hexColor').value.trim();
  const privatePart = document.getElementById('private').checked;

  const color = /^#[0-9a-fA-F]{6}$/.test(hexInput) ? hexInput : colorPicker;

  if (!name || !role) {
    showToast('Name and Role are required.', 'error');
    return;
  }

  const newPart = {
    name,
    role,
    ifsRole,
    alias,
    color,
    private: privatePart,
    timestamp: new Date().toLocaleString()
  };

  addPart(newPart);
  renderParts();
  e.target.reset();
  document.getElementById('hexColor').value = '';
  updateColorPreview('');
}

// Color sync and preview logic
function setupColorSync() {
  const hexField = document.getElementById('hexColor');
  const colorField = document.getElementById('color');

  if (!hexField || !colorField) return;

  hexField.addEventListener('input', () => {
    const val = hexField.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      colorField.value = val;
      updateColorPreview(val);
    }
  });

  colorField.addEventListener('input', () => {
    hexField.value = colorField.value;
    updateColorPreview(colorField.value);
  });
}

function updateColorPreview(val) {
  const preview = document.getElementById('colorPreview');
  if (!preview) return;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    preview.style.backgroundColor = val;
    preview.style.color = getTextColorForBackground(val);
    preview.textContent = `Preview: ${val}`;
  } else {
    preview.style.backgroundColor = '';
    preview.textContent = '';
  }
}

function getTextColorForBackground(hex) {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000' : '#fff';
}

function buildEditForm(part, index) {
  const form = document.createElement('div');
  form.className = 'part-edit-form';
  form.innerHTML = `
    <label>Name
      <input type="text" class="edit-name" value="${part.name || ''}" />
    </label>
    <label>Alias
      <input type="text" class="edit-alias" value="${part.alias || ''}" />
    </label>
    <label>Role
      <input type="text" class="edit-role" value="${part.role || ''}" />
    </label>
    <label>IFS Role
      <input type="text" class="edit-ifs" value="${part.ifsRole || ''}" />
    </label>
    <label>Color
      <div class="color-pair">
        <input type="color" class="edit-color" value="${part.color || '#6699cc'}" />
        <input type="text" class="edit-hex" value="${part.color || '#6699cc'}" />
      </div>
    </label>
    <label class="checkbox-field">
      <input type="checkbox" class="edit-private" ${part.private ? 'checked' : ''} />
      Private
    </label>
    <div class="edit-actions">
      <button type="button" class="save-part-edit">Save</button>
      <button type="button" class="cancel-part-edit">Cancel</button>
    </div>
  `;

  const colorInput = form.querySelector('.edit-color');
  const hexInput = form.querySelector('.edit-hex');
  const syncColor = (value) => {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      colorInput.value = value;
      hexInput.value = value;
    }
  };
  colorInput.addEventListener('input', () => syncColor(colorInput.value));
  hexInput.addEventListener('input', () => syncColor(hexInput.value));

  form.querySelector('.cancel-part-edit').addEventListener('click', () => {
    form.remove();
  });

  form.querySelector('.save-part-edit').addEventListener('click', () => {
    const updates = {
      name: form.querySelector('.edit-name').value.trim(),
      alias: form.querySelector('.edit-alias').value.trim(),
      role: form.querySelector('.edit-role').value.trim(),
      ifsRole: form.querySelector('.edit-ifs').value.trim(),
      color: hexInput.value.trim(),
      private: form.querySelector('.edit-private').checked
    };
    if (!updates.name || !updates.role) {
      showToast('Name and Role are required.', 'error');
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(updates.color)) {
      updates.color = colorInput.value;
    }
    editPart(index, updates);
  });

  return form;
}

window.getPartsIndex = getPartsIndex;
window.deletePart = deletePart;

window.addEventListener('DOMContentLoaded', () => {
  ensureIndexFile();
  rebuildPartsMap(getParts());
  document.getElementById('partForm').addEventListener('submit', handleSubmit);
  setupColorSync();
  renderParts();
});

export function getPartsMap() {
  return partsMap;
}
