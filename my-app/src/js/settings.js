import { loadFromStorage, saveToStorage } from './storage.js';
import { getLogEntries, renderArchive } from './log.js';
import { showToast } from './utils.js';
import './nav.js';

const BACKUP_KEYS = ['parts_data', 'parts_index', 'front_logs', 'recent_logs', 'front_logs_archive', 'relationships_data', 'threads_data', 'journal_data', 'journal_codes'];

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  // === DOM Elements ===
  const darkToggle = document.getElementById('darkModeToggle');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const exportLogsBtn = document.getElementById('exportBtn');
  const importLogsBtn = document.getElementById('importLogsBtn');
  const importLogsInput = document.getElementById('importLogsInput');
  const timestampSelect = document.getElementById('timestampFormat');
  const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
  const archiveContainer = document.getElementById('archiveContainer');
  const backupAllBtn = document.getElementById('backupAllBtn');
  const restoreAllBtn = document.getElementById('restoreAllBtn');
  const restoreAllInput = document.getElementById('restoreAllInput');

  // === Theme: Dark Mode ===
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    if (darkToggle) darkToggle.checked = true;
  } else {
    root.setAttribute('data-theme', 'light');
  }

  if (darkToggle) {
    darkToggle.addEventListener('change', () => {
      const theme = darkToggle.checked ? 'dark' : 'light';
      root.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    });
  }

  // === Logs: Clear Logs ===
  clearLogsBtn?.addEventListener('click', () => {
    if (!confirm("Are you sure you want to clear all logs?")) return;
    localStorage.removeItem('front_logs');
    localStorage.removeItem('recent_logs');
    showToast("Logs cleared.");
  });

  // === Logs: Export Logs ===
  exportLogsBtn?.addEventListener('click', () => {
    const logs = getLogEntries();
    if (!logs || logs.length === 0) { showToast("No logs to export.", 'error'); return; }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'front_logs.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast("Logs exported.");
  });

  importLogsBtn?.addEventListener('click', () => importLogsInput?.click());

  importLogsInput?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        applyImportedLogs(payload);
        showToast('Logs imported.');
        if (archiveContainer && !archiveContainer.classList.contains('hidden')) {
          renderArchive('archiveContainer');
        }
      } catch (err) {
        showToast('Error importing logs: ' + err.message, 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      showToast('Unable to read selected file.', 'error');
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  // === Backup All ===
  backupAllBtn?.addEventListener('click', () => {
    const payload = {};
    BACKUP_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v) { try { payload[k] = JSON.parse(v); } catch { payload[k] = v; } }
    });
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `front_tracker_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup saved!');
  });

  // === Restore All ===
  restoreAllBtn?.addEventListener('click', () => restoreAllInput?.click());

  restoreAllInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        BACKUP_KEYS.forEach(k => {
          if (payload[k] !== undefined) localStorage.setItem(k, JSON.stringify(payload[k]));
        });
        showToast('Restore complete! Reload to see your data.');
      } catch { showToast('Could not read backup file.', 'error'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // === UI: Timestamp Format ===
  const savedFormat = localStorage.getItem('timestampFormat') || '12hr';
  if (timestampSelect) {
    timestampSelect.value = savedFormat;
    timestampSelect.addEventListener('change', () => {
      localStorage.setItem('timestampFormat', timestampSelect.value);
    });
  }

  if (toggleArchiveBtn && archiveContainer) {
    toggleArchiveBtn.addEventListener('click', () => {
      const isHidden = archiveContainer.classList.contains('hidden');
      if (isHidden) {
        renderArchive('archiveContainer');
        archiveContainer.classList.remove('hidden');
        toggleArchiveBtn.textContent = 'Hide Archive';
      } else {
        archiveContainer.classList.add('hidden');
        toggleArchiveBtn.textContent = 'Show Archive';
      }
    });
  }
});

function applyImportedLogs(payload) {
  const ensureArray = (value) => (Array.isArray(value) ? value : []);
  let general = [];
  let recent = [];
  let archive = loadFromStorage('front_logs_archive', []);

  if (Array.isArray(payload)) {
    general = payload;
  } else if (payload && typeof payload === 'object') {
    general = ensureArray(payload.front_logs || payload.logs || payload.entries);
    recent = ensureArray(payload.recent_logs || payload.recent);
    if (payload.front_logs_archive || payload.archive) {
      archive = ensureArray(payload.front_logs_archive || payload.archive);
    }
  }

  if (!general.length) throw new Error('No logs found in file.');

  saveToStorage('front_logs', general);
  if (!recent.length) recent = general.slice(0, 5);
  saveToStorage('recent_logs', recent);
  saveToStorage('front_logs_archive', archive);
}
