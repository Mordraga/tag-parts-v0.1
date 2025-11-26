import { loadFromStorage, saveToStorage } from './storage.js';
import { getLogEntries, renderArchive } from './log.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;

  // === DOM Elements ===
  const darkToggle = document.getElementById('darkModeToggle');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const exportLogsBtn = document.getElementById('exportBtn');
  const exportPartsBtn = document.getElementById('exportPartsBtn');
  const importPartsBtn = document.getElementById('importPartsBtn');
  const partsBackupArea = document.getElementById('partsBackupArea');
  const timestampSelect = document.getElementById('timestampFormat');
  const toggleArchiveBtn = document.getElementById('toggleArchiveBtn');
  const archiveContainer = document.getElementById('archiveContainer');

  // === Theme: Dark Mode ===
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    if (darkToggle) {
      darkToggle.checked = true;
    }
  } else {
    root.setAttribute('data-theme', 'light');
  }

  if (darkToggle) {
    darkToggle.addEventListener('change', () => {
      const enabled = darkToggle.checked;
      const theme = enabled ? 'dark' : 'light';
      root.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    });
  }

  // === Logs: Clear Logs ===
  clearLogsBtn?.addEventListener('click', () => {
    if (!confirm("Are you sure you want to clear all logs?")) {
      return;
    }
    localStorage.removeItem('front_logs');
    localStorage.removeItem('recent_logs');
    alert("Logs cleared.");
  });

// === Logs: Export Logs ===
exportLogsBtn?.addEventListener('click', () => {
  const logs = getLogEntries(); // gets from 'front_logs' by default
  if (!logs || logs.length === 0) return alert("No logs to export.");

  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'front_logs.json';
  a.click();
  URL.revokeObjectURL(url);
});

  // === Parts: Export ===
  exportPartsBtn?.addEventListener('click', async () => {
    const parts = loadFromStorage('parts_data');
    if (!parts || parts.length === 0) {
      if (partsBackupArea) {
        partsBackupArea.value = '';
      }
      alert("No parts to export.");
      return;
    }

    const json = JSON.stringify(parts, null, 2);
    if (partsBackupArea) {
      partsBackupArea.value = json;
    }

    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json);
        copied = true;
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
      }
    }

    alert(copied ? "Parts JSON copied to clipboard." : "Parts JSON updated in the backup box.");
  });

  // === Parts: Import ===
  importPartsBtn?.addEventListener('click', () => {
    if (!partsBackupArea) {
      alert("Backup box not found.");
      return;
    }

    const raw = partsBackupArea.value.trim();
    if (!raw) {
      alert("Paste parts JSON into the backup box first.");
      return;
    }

    try {
      const parts = JSON.parse(raw);
      if (!Array.isArray(parts)) {
        throw new Error("Invalid parts format.");
      }
      saveToStorage('parts_data', parts);
      alert("Parts restored. Open the Parts tab to review.");
    } catch (err) {
      alert("Error importing parts: " + err.message);
    }
  });

  // === UI: Timestamp Format ===
  const savedFormat = localStorage.getItem('timestampFormat') || '12hr';
  if (timestampSelect) {
    timestampSelect.value = savedFormat;
    timestampSelect.addEventListener('change', () => {
      localStorage.setItem('timestampFormat', timestampSelect.value);
    });
  }

  if (partsBackupArea) {
    const existingParts = loadFromStorage('parts_data');
    if (existingParts && existingParts.length) {
      partsBackupArea.value = JSON.stringify(existingParts, null, 2);
    }
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
