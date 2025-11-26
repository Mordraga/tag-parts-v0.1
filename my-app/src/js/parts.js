
import { saveToStorage, loadFromStorage } from './storage.js';
import { refreshPartSuggestions } from './utils.js';

const STORAGE_KEY = 'parts_data';
const INDEX_KEY = 'parts_index';
const partsMap = {};

function getParts() {
  return loadFromStorage(STORAGE_KEY);
}

function saveParts(parts) {
  saveToStorage(STORAGE_KEY, parts);
  updatePartsIndex(parts);
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

function addPart(part) {
  const parts = getParts();
  parts.push(part);
  saveParts(parts);

  // New: Add to live map
  partsMap[part.name] = part;
}

function deletePart(index) {
  if (!confirm('Delete this part?')) return;
  const parts = getParts();
  parts.splice(index, 1);
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

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.color = textColor;
    deleteBtn.onclick = () => deletePart(index);
    div.appendChild(deleteBtn);

    container.appendChild(div);
  });
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
    alert('Name and Role are required.');
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

window.getPartsIndex = getPartsIndex;
window.deletePart = deletePart;

window.addEventListener('DOMContentLoaded', () => {
  ensureIndexFile();
  document.getElementById('partForm').addEventListener('submit', handleSubmit);
  setupColorSync();
  renderParts();
});

export function getPartsMap() {
  return partsMap;
}
