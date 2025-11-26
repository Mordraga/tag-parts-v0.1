
// scripts/modules/messageBoard.js
import { saveToStorage, loadFromStorage } from './storage.js';
import { renderCommentSection } from './comment.js';
import {
  formatMentions,
  loadPartsIndex,
  findPartByName,
  attachPartSuggestions
} from './utils.js';

const STORAGE_KEY = 'board_threads';

function getThreads() {
  return loadFromStorage(STORAGE_KEY);
}

function saveThreads(threads) {
  saveToStorage(STORAGE_KEY, threads);
}

function generateID() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function normalizeThread(thread, partsIndex = loadPartsIndex()) {
  const normalized = { ...thread };
  const part = findPartByName(normalized.part, partsIndex);
  normalized.partColor = part?.color || null;
  const mentionData = formatMentions(normalized.subject || '', partsIndex);
  normalized.mentions = mentionData.mentions;
  if (!normalized.id) {
    normalized.id = generateID();
  }
  return normalized;
}

function populateThreadPartSelect() {
  const selectEl = document.getElementById('input-part-select');
  if (!selectEl) return;
  const parts = loadPartsIndex();
  const previous = selectEl.value;
  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select part (optional)';
  selectEl.appendChild(placeholder);

  parts.forEach((part) => {
    const option = document.createElement('option');
    option.value = part.name;
    option.textContent = part.name;
    selectEl.appendChild(option);
  });

  if (previous && parts.some((p) => p.name === previous)) {
    selectEl.value = previous;
  }
}

function addThread(part, subject) {
  const threads = getThreads();
  const thread = normalizeThread({
    part: part || 'Unknown',
    subject,
    timestamp: new Date().toISOString()
  });
  threads.unshift(thread);
  saveThreads(threads);
  renderBoard();
}

function deleteThread(id) {
  if (!confirm('Delete this thread?')) return;
  const threads = getThreads().filter((thread) => thread.id !== id);
  saveThreads(threads);
  renderBoard();
}

function editThread(id, updates) {
  const partsIndex = loadPartsIndex();
  const threads = getThreads();
  const idx = threads.findIndex((thread) => thread.id === id);
  if (idx === -1) return;
  const updated = normalizeThread({ ...threads[idx], ...updates }, partsIndex);
  threads[idx] = updated;
  saveThreads(threads);
  renderBoard();
}

function buildThreadEditForm(thread) {
  const form = document.createElement('div');
  form.className = 'log-edit-form';
  form.innerHTML = `
    <input type="text" class="edit-thread-part" placeholder="Part" value="${thread.part}" />
    <textarea class="edit-thread-subject" placeholder="Subject">${thread.subject}</textarea>
    <div class="edit-actions">
      <button type="button" class="save-thread-edit">Save</button>
      <button type="button" class="cancel-thread-edit">Cancel</button>
    </div>
  `;

  const partInput = form.querySelector('.edit-thread-part');
  attachPartSuggestions(partInput);

  form.querySelector('.cancel-thread-edit').addEventListener('click', () => {
    form.remove();
  });

  form.querySelector('.save-thread-edit').addEventListener('click', () => {
    const part = partInput.value.trim();
    const subject = form.querySelector('.edit-thread-subject').value.trim();
    if (!subject) {
      alert('Subject is required.');
      return;
    }
    editThread(thread.id, { part: part || 'Unknown', subject });
  });

  return form;
}

export function renderBoard() {
  const container = document.getElementById('message-board');
  if (!container) return;

  const threads = getThreads();
  const partsIndex = loadPartsIndex();
  populateThreadPartSelect();
  container.innerHTML = '';

  threads.forEach((thread) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    if (thread.partColor) {
      div.style.borderLeftColor = thread.partColor;
    }

    const content = document.createElement('div');
    content.className = 'log-content';
    const mentionData = formatMentions(thread.subject || '', partsIndex);
    content.innerHTML = `
      <p><strong>${thread.part}</strong>: ${mentionData.html}</p>
      <p class="timestamp">${new Date(thread.timestamp).toLocaleString()}</p>
    `;

    const actions = document.createElement('div');
    actions.className = 'log-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (div.querySelector('.log-edit-form')) return;
      const form = buildThreadEditForm(thread);
      div.appendChild(form);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteThread(thread.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    const commentWrapper = document.createElement('div');
    commentWrapper.className = 'comment-toggle hidden';
    const commentKey = `msg_comment_${thread.id}`;
    renderCommentSection(commentWrapper, commentKey);

    content.addEventListener('click', () => {
      commentWrapper.classList.toggle('hidden');
    });

    div.appendChild(content);
    div.appendChild(actions);
    div.appendChild(commentWrapper);
    container.appendChild(div);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  renderBoard();

  const partInput = document.getElementById('input-part');
  attachPartSuggestions(partInput);
  const partSelect = document.getElementById('input-part-select');
  populateThreadPartSelect();
  partSelect?.addEventListener('change', () => {
    if (partSelect.value) {
      partInput.value = partSelect.value;
    }
  });

  const postBtn = document.getElementById('post-thread-btn');
  if (postBtn) {
    postBtn.addEventListener('click', () => {
      const manual = partInput.value.trim();
      const selected = partSelect?.value.trim() || '';
      const partValue = manual || selected || 'Unknown';
      const subjectInput = document.getElementById('input-subject');
      const subject = subjectInput.value.trim();
      if (!subject) {
        alert('Subject is required.');
        return;
      }
      addThread(partValue, subject);
      subjectInput.value = '';
      partInput.value = '';
      if (partSelect) {
        partSelect.value = '';
      }
    });
  }
});
