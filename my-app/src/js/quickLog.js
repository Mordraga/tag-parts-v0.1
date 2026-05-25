// quickLog.js — floating Quick Log button with one-tap voice logging and preset sheet

import { addLogEntry, renderLogs } from './log.js';
import { loadFromStorage } from './storage.js';
import { showToast, loadPartsIndex } from './utils.js';
import { startVoice, stopVoice } from './voice.js';
import { getLocation } from './gps.js';

const SYSTEM_PRESETS = [
  { id: 'sys_here',   label: 'Here. Present.', awareness: 10 },
  { id: 'sys_foggy',  label: 'Foggy',          awareness: 1  },
  { id: 'sys_co',     label: 'Co-conscious',   awareness: 5  },
  { id: 'sys_switch', label: 'Switching',      awareness: 7  },
];

function getLastFronter() {
  const recent = loadFromStorage('recent_logs');
  if (!recent.length) return '???';
  const who = recent[0].who;
  return (Array.isArray(who) ? who[0] : who) || '???';
}

function getPresetsForPart(partName) {
  const parts = loadFromStorage('parts_data');
  const part = parts.find((p) => p.name === partName);
  const custom = (part && Array.isArray(part.quickPresets)) ? part.quickPresets : [];
  return [...SYSTEM_PRESETS, ...custom];
}

// ── DOM references (populated in initQuickLog) ──────────────────────────────
let fab, overlay, overlayText, sheet, sheetOverlay;
let activeRecognizer = null;
let locationPromise = null;
let finalTranscript = '';

// ── Voice path (Mode A) ─────────────────────────────────────────────────────

async function startRecordingFlow() {
  finalTranscript = '';
  locationPromise = getLocation();
  showOverlay();

  activeRecognizer = await startVoice(
    (interim) => {
      overlayText.textContent = interim || '…';
    },
    async (final) => {
      activeRecognizer = null;
      if (!final && !finalTranscript) {
        hideOverlay();
        return;
      }
      const transcript = final || finalTranscript;
      const where = await locationPromise;
      const who = getLastFronter();

      addLogEntry({
        who,
        where,
        when: new Date().toLocaleString(),
        msg: transcript,
        timestamp: new Date().toISOString(),
      });

      hideOverlay();
      showToast('Logged!');

      // Refresh the recent logs list if it's on this page
      if (document.getElementById('logDisplay')) {
        renderLogs('logDisplay', 'recent_logs');
      }
    },
    () => {
      activeRecognizer = null;
      hideOverlay();
      showToast('Microphone unavailable.', 'error');
    }
  );
}

function cancelRecording() {
  stopVoice(activeRecognizer);
  activeRecognizer = null;
  hideOverlay();
}

// ── Overlay (recording UI) ───────────────────────────────────────────────────

function showOverlay() {
  overlayText.textContent = '…';
  overlay.classList.add('active');
}

function hideOverlay() {
  overlay.classList.remove('active');
  overlayText.textContent = '';
}

// ── Preset sheet (Mode B) ────────────────────────────────────────────────────

function openSheet() {
  const fronter = getLastFronter();
  buildSheetContent(fronter);
  sheetOverlay.classList.add('open');
  sheet.classList.add('open');
}

function closeSheet() {
  sheetOverlay.classList.remove('open');
  sheet.classList.remove('open');
}

function buildSheetContent(fronter) {
  sheet.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'ql-sheet-header';
  header.innerHTML = '<strong>Quick Log</strong>';

  const micBtn = document.createElement('button');
  micBtn.className = 'ghost ql-mic-btn';
  micBtn.setAttribute('aria-label', 'Voice log');
  micBtn.textContent = '🎙';
  micBtn.onclick = () => { closeSheet(); startRecordingFlow(); };

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ghost ql-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.onclick = closeSheet;

  header.appendChild(micBtn);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  // Who chip
  const whoRow = document.createElement('div');
  whoRow.className = 'ql-who-row';
  const whoLabel = document.createElement('span');
  whoLabel.className = 'ql-label';
  whoLabel.textContent = 'Who: ';

  const partsIndex = loadPartsIndex();
  let selectedWho = fronter;

  const whoChip = document.createElement('button');
  whoChip.className = 'ql-who-chip';
  const updateWhoChip = () => {
    const part = partsIndex.find((p) => p.name === selectedWho);
    whoChip.textContent = selectedWho || 'Pick a part';
    if (part && part.color) whoChip.style.color = part.color;
  };
  updateWhoChip();

  // Part picker (shown inline when who chip is tapped)
  const picker = document.createElement('div');
  picker.className = 'ql-part-picker';
  picker.style.display = 'none';
  partsIndex.forEach((p) => {
    const opt = document.createElement('button');
    opt.className = 'preset-chip';
    opt.textContent = (p.defaultEmoji ? p.defaultEmoji + ' ' : '') + p.name;
    opt.style.borderColor = p.color || '';
    opt.onclick = () => {
      selectedWho = p.name;
      updateWhoChip();
      picker.style.display = 'none';
    };
    picker.appendChild(opt);
  });

  whoChip.onclick = () => {
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
  };

  whoRow.appendChild(whoLabel);
  whoRow.appendChild(whoChip);
  sheet.appendChild(whoRow);
  sheet.appendChild(picker);

  // Preset chips
  const chipLabel = document.createElement('div');
  chipLabel.className = 'ql-label';
  chipLabel.textContent = 'Preset:';
  sheet.appendChild(chipLabel);

  const chipsRow = document.createElement('div');
  chipsRow.className = 'preset-chips';

  const presets = getPresetsForPart(selectedWho);
  let selectedPreset = null;
  let awarenessValue = null;

  const awarenessDisplay = document.createElement('div');
  awarenessDisplay.className = 'ql-awareness';
  awarenessDisplay.style.display = 'none';

  presets.forEach((preset) => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.textContent = preset.label;
    chip.onclick = () => {
      chipsRow.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedPreset = preset;
      awarenessValue = preset.awareness;
      awarenessDisplay.textContent = `Awareness: ${awarenessValue}/10`;
      awarenessDisplay.style.display = 'block';
    };
    chipsRow.appendChild(chip);
  });

  sheet.appendChild(chipsRow);
  sheet.appendChild(awarenessDisplay);

  // Log It button
  const logBtn = document.createElement('button');
  logBtn.className = 'btn-block';
  logBtn.style.marginTop = '16px';
  logBtn.textContent = 'Log It';
  logBtn.onclick = async () => {
    if (!selectedWho) {
      showToast('Pick who is fronting.', 'error');
      return;
    }
    if (!selectedPreset) {
      showToast('Pick a preset.', 'error');
      return;
    }

    const where = await getLocation(4000);
    addLogEntry({
      who: selectedWho,
      where,
      when: new Date().toLocaleString(),
      msg: selectedPreset.label,
      awareness: awarenessValue,
      timestamp: new Date().toISOString(),
    });

    closeSheet();
    showToast('Logged!');
  };
  sheet.appendChild(logBtn);
}

// ── FAB interaction (tap = open sheet) ──────────────────────────────────────

// ── Init ─────────────────────────────────────────────────────────────────────

export function initQuickLog() {
  const root = document.getElementById('quick-log-root');
  if (!root) return;

  // FAB
  fab = document.createElement('button');
  fab.className = 'quick-log-fab';
  fab.setAttribute('aria-label', 'Quick Log');
  fab.textContent = '⚡';
  fab.addEventListener('click', openSheet);

  // Recording overlay
  overlay = document.createElement('div');
  overlay.className = 'ql-overlay';
  overlay.innerHTML = `
    <div class="ql-mic-icon">🎙</div>
    <div class="ql-transcript"></div>
    <div class="ql-cancel-hint">Tap to cancel</div>
  `;
  overlayText = overlay.querySelector('.ql-transcript');
  overlay.addEventListener('pointerdown', cancelRecording);

  // Preset sheet + its overlay
  sheetOverlay = document.createElement('div');
  sheetOverlay.className = 'ql-sheet-overlay';
  sheetOverlay.addEventListener('pointerdown', closeSheet);

  sheet = document.createElement('div');
  sheet.className = 'ql-sheet';

  root.appendChild(fab);
  root.appendChild(overlay);
  root.appendChild(sheetOverlay);
  root.appendChild(sheet);
}

window.addEventListener('DOMContentLoaded', initQuickLog);
