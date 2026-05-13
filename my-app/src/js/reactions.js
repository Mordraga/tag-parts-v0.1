import { loadFromStorage, saveToStorage } from './storage.js';
import { loadPartsIndex } from './utils.js';
import { openModal } from './modal.js';
import 'emoji-picker-element';

function reactionKey(targetType, targetId) {
  return `reactions_${targetType}_${targetId}`;
}

function getReactions(targetType, targetId) {
  return loadFromStorage(reactionKey(targetType, targetId), {});
}

function saveReactions(targetType, targetId, data) {
  saveToStorage(reactionKey(targetType, targetId), data);
}

function toggleReaction(targetType, targetId, emoji, partName) {
  const data = getReactions(targetType, targetId);
  if (!data[emoji]) data[emoji] = [];
  const idx = data[emoji].indexOf(partName);
  if (idx >= 0) {
    data[emoji].splice(idx, 1);
    if (!data[emoji].length) delete data[emoji];
  } else {
    data[emoji].push(partName);
  }
  saveReactions(targetType, targetId, data);
}

function chipLabel(parts) {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
  return `${parts[0]} +${parts.length - 1}`;
}

export function renderReactionBar(container, targetType, targetId) {
  let bar = container.querySelector('.reaction-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'reaction-bar';
    container.appendChild(bar);
  }

  const data = getReactions(targetType, targetId);
  bar.innerHTML = '';

  Object.entries(data).forEach(([emoji, parts]) => {
    if (!parts.length) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'reaction-chip';
    chip.innerHTML = `<span class="reaction-emoji">${emoji}</span><span class="reaction-names">${chipLabel(parts)}</span>`;
    chip.addEventListener('click', () => openReactionModal(targetType, targetId, container, emoji));
    bar.appendChild(chip);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'reaction-add-btn';
  addBtn.title = 'Add reaction';
  addBtn.textContent = '＋';
  addBtn.addEventListener('click', () => openReactionModal(targetType, targetId, container, null));
  bar.appendChild(addBtn);
}

function openReactionModal(targetType, targetId, container, preEmoji) {
  const partsIndex = loadPartsIndex().filter(p => p.name !== '???');
  const quickParts = partsIndex.filter(p => p.defaultEmoji);

  openModal('React', (body, close) => {
    const inner = document.createElement('div');
    inner.className = 'reaction-modal-inner';

    // ── Quick react row ───────────────────────────────────────────
    if (quickParts.length) {
      const quickLabel = document.createElement('p');
      quickLabel.className = 'quick-react-label';
      quickLabel.textContent = 'Quick react';
      inner.appendChild(quickLabel);

      const quickRow = document.createElement('div');
      quickRow.className = 'quick-react-row';

      quickParts.forEach(part => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quick-react-chip';
        btn.innerHTML = `<span class="qr-emoji">${part.defaultEmoji}</span><span class="qr-name">${part.name}</span>`;
        btn.addEventListener('click', () => {
          toggleReaction(targetType, targetId, part.defaultEmoji, part.name);
          renderReactionBar(container, targetType, targetId);
          close();
        });
        quickRow.appendChild(btn);
      });

      inner.appendChild(quickRow);

      const divider = document.createElement('p');
      divider.className = 'quick-react-divider';
      divider.textContent = 'or pick any emoji';
      inner.appendChild(divider);
    }

    // ── Part selector (for full picker) ──────────────────────────
    if (!quickParts.length || true) {
      const label = document.createElement('label');
      label.className = 'reaction-part-label';
      label.textContent = 'Who is reacting?';
      const select = document.createElement('select');
      select.className = 'reaction-part-select';
      select.innerHTML = `<option value="">Choose a part…</option>` +
        partsIndex.map(p => `<option value="${p.name}">${p.defaultEmoji ? p.defaultEmoji + ' ' : ''}${p.name}</option>`).join('');
      label.appendChild(select);
      inner.appendChild(label);
    }

    if (preEmoji) {
      const note = document.createElement('p');
      note.className = 'reaction-pre-note';
      note.innerHTML = `Existing <span class="reaction-pre-emoji">${preEmoji}</span> reaction — pick the same emoji to remove yours.`;
      inner.appendChild(note);
    }

    body.appendChild(inner);

    const partSelect = body.querySelector('.reaction-part-select');

    // ── Full emoji picker ─────────────────────────────────────────
    const picker = document.createElement('emoji-picker');
    picker.dataSource = '/emoji-data.json';
    picker.className = 'reaction-picker';
    body.appendChild(picker);

    picker.addEventListener('emoji-click', (e) => {
      const emoji = e.detail.unicode;
      if (!emoji) return;
      if (!partSelect.value) {
        partSelect.style.outline = '2px solid #a33';
        partSelect.focus();
        return;
      }
      partSelect.style.outline = '';
      toggleReaction(targetType, targetId, emoji, partSelect.value);
      renderReactionBar(container, targetType, targetId);
      close();
    });

    partSelect?.addEventListener('change', () => { partSelect.style.outline = ''; });
  });
}
