
// scripts/modules/log.js
import { saveToStorage, loadFromStorage } from './storage.js';
import { renderCommentSection } from './comment.js';
import { openModal } from './modal.js';
import { renderReactionBar } from './reactions.js';
import {
  formatMentions,
  findPartByName,
  loadPartsIndex,
  attachPartSuggestions,
  attachMentionAutocomplete,
  showToast
} from './utils.js';

function formatWho(who) {
  if (!Array.isArray(who) || who.length === 1) return Array.isArray(who) ? who[0] : who;
  return `${who[0]}<br><span class="cofronter-list">+ ${who.slice(1).join(', ')}</span>`;
}

const GENERAL_LOG = 'front_logs';
const RECENT_LOG = 'recent_logs';
const ARCHIVE_LOG = 'front_logs_archive';
const RECENT_MAX = 5;

function ensureEditAccess() {
  const disabled = localStorage.getItem('disableLogEditing') === 'true';
  if (disabled) {
    showToast('Log editing has been disabled in settings.', 'error');
    return false;
  }
  return true;
}

function getTimestampFormat() {
  return localStorage.getItem('timestampFormat') === '24hr' ? '24hr' : '12hr';
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const options = {
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: getTimestampFormat() !== '24hr'
  };

  return date.toLocaleString(undefined, options);
}

function generateID() {
  return 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

function normalizeLog(entry, partsIndex = loadPartsIndex(), tracker) {
  const normalized = { ...entry };
  tracker = tracker || { changed: false };

  function assignTimestampMetadata(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const nextDateKey = `${year}-${month}-${day}`;
    const nextMonthKey = `${year}-${month}`;
    if (normalized.dateKey !== nextDateKey) {
      normalized.dateKey = nextDateKey;
      tracker.changed = true;
    }
    if (normalized.monthKey !== nextMonthKey) {
      normalized.monthKey = nextMonthKey;
      tracker.changed = true;
    }
  }

  if (!normalized.id) {
    normalized.id = generateID();
    tracker.changed = true;
  }

  if (!normalized.timestamp) {
    normalized.timestamp = new Date().toISOString();
    tracker.changed = true;
  }

  if (normalized.timestamp) {
    assignTimestampMetadata(normalized.timestamp);
  }

  const { mentions } = formatMentions(normalized.msg || '', partsIndex);
  if (!arraysEqual(normalized.mentions, mentions)) {
    normalized.mentions = mentions;
    tracker.changed = true;
  }

  const part = findPartByName(Array.isArray(normalized.who) ? normalized.who[0] : normalized.who, partsIndex);
  const nextRef = part ? part.name : null;
  const nextColor = part ? part.color || '#6699cc' : null;
  if (normalized.partRef !== nextRef) {
    normalized.partRef = nextRef;
    tracker.changed = true;
  }
  if (normalized.partColor !== nextColor) {
    normalized.partColor = nextColor;
    tracker.changed = true;
  }

  return normalized;
}

function arraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((item, idx) => {
    const other = b[idx];
    return (
      item?.raw === other?.raw &&
      item?.name === other?.name &&
      item?.color === other?.color
    );
  });
}

function syncRecentEntry(entry) {
  let recent = loadFromStorage(RECENT_LOG);
  const idx = recent.findIndex((log) => log.id === entry.id);
  if (idx !== -1) {
    recent[idx] = entry;
    saveToStorage(RECENT_LOG, recent);
  }
}

function loadAndNormalize(key, partsIndex = loadPartsIndex()) {
  const tracker = { changed: false };
  const logs = loadFromStorage(key).map((entry) =>
    normalizeLog(entry, partsIndex, tracker)
  );
  if (tracker.changed) {
    saveToStorage(key, logs);
  }
  return logs;
}

function removeRecentEntry(target, partsIndex = loadPartsIndex()) {
  const recent = loadAndNormalize(RECENT_LOG, partsIndex);
  const next = recent.filter((log) => !logsMatch(log, target));
  saveToStorage(RECENT_LOG, next);
}

function addToArchive(entry, partsIndex = loadPartsIndex()) {
  const archive = loadAndNormalize(ARCHIVE_LOG, partsIndex);
  const payload = { ...entry, archivedAt: new Date().toISOString() };
  archive.unshift(payload);
  saveToStorage(ARCHIVE_LOG, archive);
}

function removeLogFromActive(target, partsIndex = loadPartsIndex()) {
  const allLogs = loadAndNormalize(GENERAL_LOG, partsIndex).filter(
    (log) => !logsMatch(log, target)
  );
  saveToStorage(GENERAL_LOG, allLogs);
  removeRecentEntry(target, partsIndex);
}

export function addLogEntry(entry) {
  const partsIndex = loadPartsIndex();
  const normalized = normalizeLog(entry, partsIndex);

  const allLogs = loadFromStorage(GENERAL_LOG);
  allLogs.unshift(normalized);
  saveToStorage(GENERAL_LOG, allLogs);

  let recent = loadFromStorage(RECENT_LOG);
  recent.unshift(normalized);
  recent = recent.slice(0, RECENT_MAX);
  saveToStorage(RECENT_LOG, recent);
}

export function getLogEntries(key = GENERAL_LOG) {
  const partsIndex = loadPartsIndex();
  const general = loadAndNormalize(GENERAL_LOG, partsIndex);
  if (key === GENERAL_LOG) {
    return general;
  }
  if (key === RECENT_LOG) {
    return loadAndNormalize(RECENT_LOG, partsIndex);
  }
  return loadFromStorage(key);
}

export function getArchivedLogs() {
  const partsIndex = loadPartsIndex();
  return loadAndNormalize(ARCHIVE_LOG, partsIndex);
}

export function deleteArchivedLog(id, containerId) {
  const partsIndex = loadPartsIndex();
  const archive = loadAndNormalize(ARCHIVE_LOG, partsIndex).filter(
    (log) => log.id !== id
  );
  saveToStorage(ARCHIVE_LOG, archive);
  if (containerId) {
    renderArchive(containerId);
  }
  showToast('Archived log deleted.');
}

export function restoreArchivedLog(id, containerId) {
  const partsIndex = loadPartsIndex();
  const archive = loadAndNormalize(ARCHIVE_LOG, partsIndex);
  const idx = archive.findIndex((log) => log.id === id);
  if (idx === -1) return;

  const [entry] = archive.splice(idx, 1);
  const general = loadAndNormalize(GENERAL_LOG, partsIndex);
  const restored = { ...entry };
  delete restored.archivedAt;

  general.unshift(restored);
  saveToStorage(GENERAL_LOG, general);

  let recent = loadFromStorage(RECENT_LOG);
  recent.unshift(restored);
  recent = recent.slice(0, RECENT_MAX);
  saveToStorage(RECENT_LOG, recent);

  saveToStorage(ARCHIVE_LOG, archive);

  if (containerId) {
    renderArchive(containerId);
  }
  showToast('Log restored.');
}

export function archiveLogEntry(
  targetLog,
  type = GENERAL_LOG,
  containerId = 'logDisplay',
  refreshCallback
) {
  const partsIndex = loadPartsIndex();
  const normalizedTarget = normalizeLog(targetLog, partsIndex);
  removeLogFromActive(normalizedTarget, partsIndex);
  addToArchive(normalizedTarget, partsIndex);
  if (typeof refreshCallback === 'function') {
    refreshCallback();
  } else if (containerId) {
    renderLogs(containerId, type);
  }
  showToast('Log archived.');
}

export function deleteLogEntry(
  targetLog,
  type = GENERAL_LOG,
  containerId = 'logDisplay',
  refreshCallback
) {
  const partsIndex = loadPartsIndex();
  const normalizedTarget = normalizeLog(targetLog, partsIndex);
  removeLogFromActive(normalizedTarget, partsIndex);
  if (typeof refreshCallback === 'function') {
    refreshCallback();
  } else if (containerId) {
    renderLogs(containerId, type);
  }
  showToast('Log deleted.');
}

export function editLogEntry(id, changes, containerId, type, refreshCallback) {

  const partsIndex = loadPartsIndex();
  const logs = loadFromStorage(GENERAL_LOG);
  const idx = logs.findIndex((log) => log.id === id);
  if (idx === -1) return;

  const updated = normalizeLog({ ...logs[idx], ...changes }, partsIndex);
  logs[idx] = updated;
  saveToStorage(GENERAL_LOG, logs);
  syncRecentEntry(updated);
  if (typeof refreshCallback === 'function') {
    refreshCallback(updated);
  } else {
    renderLogs(containerId, type);
  }
}

function openLogEditModal(log, containerId, type, refreshCallback) {
  openModal('Edit Log', (body, close) => {
    body.innerHTML = `
      <div class="log-edit-form">
        <div class="edit-who-container"></div>
        <button type="button" class="edit-add-cofronter">+ co-fronter</button>
        <input type="text" class="edit-where" placeholder="Where" value="${log.where}" />
        <input type="text" class="edit-when" placeholder="When" value="${log.when}" />
        <textarea class="edit-msg" placeholder="Message">${log.msg || ''}</textarea>
        <label>Awareness
          <input type="number" class="edit-awareness" min="1" max="10" value="${log.awareness || 5}" />
        </label>
        <div class="edit-actions">
          <button type="button" class="save-edit">Save</button>
          <button type="button" class="cancel-edit">Cancel</button>
        </div>
      </div>
    `;

    const whoContainer = body.querySelector('.edit-who-container');
    const whoValues = Array.isArray(log.who) ? log.who : [log.who || ''];

    function addEditWhoRow(value, isPrimary) {
      const row = document.createElement('div');
      row.className = 'who-field';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-who-input';
      input.placeholder = isPrimary ? 'Who (required)' : 'Co-fronter';
      input.value = value;
      row.appendChild(input);
      if (!isPrimary) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'who-remove-btn';
        btn.textContent = '−';
        btn.addEventListener('click', () => row.remove());
        row.appendChild(btn);
      }
      whoContainer.appendChild(row);
      attachPartSuggestions(input);
    }

    whoValues.forEach((v, i) => addEditWhoRow(v, i === 0));

    body.querySelector('.edit-add-cofronter').addEventListener('click', () => {
      addEditWhoRow('', false);
    });

    body.querySelector('.cancel-edit').addEventListener('click', close);

    body.querySelector('.save-edit').addEventListener('click', () => {
      const editWhoValues = [...body.querySelectorAll('.edit-who-input')]
        .map(el => el.value.trim()).filter(Boolean);
      const who = editWhoValues.length > 1 ? editWhoValues : editWhoValues[0] ?? '';
      const where = body.querySelector('.edit-where').value.trim();
      const when = body.querySelector('.edit-when').value.trim();
      const msg = body.querySelector('.edit-msg').value.trim();
      const awareness = parseInt(body.querySelector('.edit-awareness').value, 10) || 5;

      if (!editWhoValues.length || !where || !when) {
        showToast('Who, Where, and When are required.', 'error');
        return;
      }

      editLogEntry(log.id, { who, where, when, msg, awareness }, containerId, type, refreshCallback);
      close();
    });

    attachMentionAutocomplete(body.querySelector('.edit-msg'));
    body.querySelector('.edit-where').focus();
  });
}

export function renderLogs(containerId = 'logDisplay', type = GENERAL_LOG) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const logs = getLogEntries(type);
  const refresh = () => renderLogs(containerId, type);
  renderLogEntries(logs, container, { containerId, type, onRefresh: refresh });
}

export function renderLogEntries(logs, container, options = {}) {
  if (!container) return;
  container.innerHTML = '';
  const partsIndex = options.partsIndex || loadPartsIndex();
  logs.forEach((log) => {
    const entry = createLogEntryElement(log, partsIndex, options);
    container.appendChild(entry);
  });
}

function createLogEntryElement(log, partsIndex, options = {}) {
  const div = document.createElement('div');
  div.className = 'log-entry';
  const part = findPartByName(Array.isArray(log.who) ? log.who[0] : log.who, partsIndex);
  const color = log.partColor || part?.color;
  if (color) {
    div.style.borderLeftColor = color;
  }

  const logContent = document.createElement('div');
  logContent.className = 'log-content';
  const mentionData = formatMentions(log.msg || '', partsIndex);
  const timestampLabel = log.timestamp ? formatTimestamp(log.timestamp) : '';
  logContent.innerHTML = `
      <p><strong>Who:</strong> ${formatWho(log.who)}</p>
      <p><strong>Where:</strong> ${log.where}</p>
      <p><strong>When:</strong> ${log.when}</p>
      <p><strong>Awareness:</strong> ${log.awareness ?? 'N/A'}</p>
      ${log.msg ? `<p><strong>Message:</strong> ${mentionData.html}</p>` : ''}
      <p class="timestamp">${timestampLabel}</p>
    `;

  const actions = document.createElement('div');
  actions.className = 'log-actions';
  const refresh = typeof options.onRefresh === 'function'
    ? options.onRefresh
    : () => {
        if (options.containerId) {
          renderLogs(options.containerId, options.type || GENERAL_LOG);
        }
      };
  const targetType = options.type || GENERAL_LOG;

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!ensureEditAccess()) return;
    openLogEditModal(log, options.containerId, targetType, refresh);
  });

  const archiveBtn = document.createElement('button');
  archiveBtn.textContent = 'Archive';
  archiveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    archiveLogEntry(log, targetType, options.containerId, refresh);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Delete this log permanently?')) {
      deleteLogEntry(log, targetType, options.containerId, refresh);
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(archiveBtn);
  actions.appendChild(deleteBtn);

  const commentWrapper = document.createElement('div');
  commentWrapper.className = 'comment-toggle hidden';
  const commentKey = `log_comment_${log.id}`;
  renderCommentSection(commentWrapper, commentKey);

  logContent.addEventListener('click', () => {
    commentWrapper.classList.toggle('hidden');
  });

  div.appendChild(logContent);
  div.appendChild(actions);
  div.appendChild(commentWrapper);
  renderReactionBar(div, 'log', log.id);
  return div;
}

export function renderArchive(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const logs = getArchivedLogs();
  container.innerHTML = '';

  if (!logs.length) {
    container.innerHTML = '<p class="timestamp">Archive is empty.</p>';
    return;
  }

  const partsIndex = loadPartsIndex();
  logs.forEach((log) => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    const part = findPartByName(Array.isArray(log.who) ? log.who[0] : log.who, partsIndex);
    const color = log.partColor || part?.color;
    if (color) {
      div.style.borderLeftColor = color;
    }

    const mentionData = formatMentions(log.msg || '', partsIndex);
    div.innerHTML = `
      <div class="log-content">
        <p>👤 <strong>Who:</strong> ${formatWho(log.who)}</p>
        <p>📍 <strong>Where:</strong> ${log.where}</p>
        <p>🕒 <strong>When:</strong> ${log.when}</p>
        ${log.msg ? `<p>💬 <strong>Message:</strong> ${mentionData.html}</p>` : ''}
        <p class="timestamp">🗓 Logged: ${formatTimestamp(log.timestamp)}</p>
        <p class="timestamp">🗂 Archived: ${formatTimestamp(log.archivedAt)}</p>
      </div>
      <div class="log-actions">
        <button data-id="${log.id}" class="restore-archive">Restore</button>
        <button data-id="${log.id}" class="delete-archive">Delete</button>
      </div>
    `;

    container.appendChild(div);
  });

  container.querySelectorAll('.delete-archive').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this archived log?')) {
        deleteArchivedLog(btn.dataset.id, containerId);
      }
    });
  });

  container.querySelectorAll('.restore-archive').forEach((btn) => {
    btn.addEventListener('click', () => {
      restoreArchivedLog(btn.dataset.id, containerId);
    });
  });
}

function logsMatch(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) {
    return a.id === b.id;
  }
  return (
    a.who === b.who &&
    a.where === b.where &&
    a.when === b.when &&
    a.msg === b.msg &&
    a.timestamp === b.timestamp
  );
}
