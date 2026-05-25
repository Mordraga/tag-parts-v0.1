import { loadFromStorage, saveToStorage } from './storage.js';
import { getLogEntries, renderArchive } from './log.js';
import { showToast } from './utils.js';
import './nav.js';
import { requestPermission, scheduleReminders, cancelReminders, initReminders } from './notifications.js';

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

  // === Theme: Light Mode toggle (dark is default) ===
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    root.setAttribute('data-theme', 'light');
    if (darkToggle) darkToggle.checked = true;
  } else {
    root.setAttribute('data-theme', 'dark');
  }

  if (darkToggle) {
    darkToggle.addEventListener('change', () => {
      if (darkToggle.checked) {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
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
  exportLogsBtn?.addEventListener('click', async () => {
    const logs = getLogEntries();
    if (!logs || logs.length === 0) { showToast("No logs to export.", 'error'); return; }
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    await shareOrDownload(blob, 'front_logs.json');
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
  backupAllBtn?.addEventListener('click', async () => {
    const payload = {};
    // Static keys
    BACKUP_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v) { try { payload[k] = JSON.parse(v); } catch { payload[k] = v; } }
    });
    // Dynamic journal entry keys (journal_entries_<partName>)
    Object.keys(localStorage)
      .filter(k => k.startsWith('journal_entries_'))
      .forEach(k => {
        const v = localStorage.getItem(k);
        if (v) { try { payload[k] = JSON.parse(v); } catch { payload[k] = v; } }
      });

    const date = new Date().toISOString().slice(0, 10);
    const filename = `front_tracker_backup_${date}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });

    await shareOrDownload(blob, filename);
    showToast('Backup ready!');
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
        // Static keys
        BACKUP_KEYS.forEach(k => {
          if (payload[k] !== undefined) localStorage.setItem(k, JSON.stringify(payload[k]));
        });
        // Dynamic journal entry keys
        Object.keys(payload)
          .filter(k => k.startsWith('journal_entries_'))
          .forEach(k => localStorage.setItem(k, JSON.stringify(payload[k])));
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

  // === Ko-Fi Support ===
  document.getElementById('kofi-btn')?.addEventListener('click', () => {
    window.open('https://ko-fi.com/mordraga0', '_system');
  });

  // === Check-in Reminders ===
  const reminderToggle = document.getElementById('reminder-toggle');
  const slotBtns = document.querySelectorAll('.slot-btn');

  if (reminderToggle) {
    let enabled = localStorage.getItem('reminder_enabled') === 'true';
    let slots = JSON.parse(localStorage.getItem('reminder_slots') || '[]');

    function syncUI() {
      slotBtns.forEach(b => b.classList.toggle('active', slots.includes(b.dataset.slot)));
      reminderToggle.textContent = enabled ? 'Disable Notifications' : 'Enable Notifications';
      reminderToggle.classList.toggle('active', enabled);
    }
    syncUI();

    slotBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const slot = btn.dataset.slot;
        slots = slots.includes(slot) ? slots.filter(s => s !== slot) : [...slots, slot];
        localStorage.setItem('reminder_slots', JSON.stringify(slots));
        syncUI();
        if (enabled) await scheduleReminders(slots);
      });
    });

    reminderToggle.addEventListener('click', async () => {
      if (!enabled) {
        if (!slots.length) { showToast('Select at least one time slot first.', 'error'); return; }
        const granted = await requestPermission();
        if (!granted) { showToast('Notification permission denied.', 'error'); return; }
        enabled = true;
        localStorage.setItem('reminder_enabled', 'true');
        await scheduleReminders(slots);
        showToast('Reminders enabled.');
      } else {
        enabled = false;
        localStorage.setItem('reminder_enabled', 'false');
        await cancelReminders();
        showToast('Reminders disabled.');
      }
      syncUI();
    });

    initReminders();
  }
});

async function shareOrDownload(blob, filename) {
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const SharePlugin = window.Capacitor?.Plugins?.Share;

  // Primary: Capacitor Filesystem + Share plugin (reliable on Android)
  if (Filesystem && SharePlugin) {
    try {
      const text = await blob.text();
      const result = await Filesystem.writeFile({
        path: filename,
        data: text,
        directory: 'CACHE',
        encoding: 'utf8',
      });
      await SharePlugin.share({
        title: filename,
        url: result.uri,
        dialogTitle: 'Save or share backup',
      });
      return;
    } catch (err) {
      const msg = err?.message ?? '';
      if (msg.includes('cancel') || msg.includes('Cancel')) return;
      console.warn('Capacitor share failed, trying Web Share API', err);
    }
  }

  // Fallback: Web Share API (works in some Capacitor WebView builds)
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  // Last resort: blob URL download (desktop / browser dev mode)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
