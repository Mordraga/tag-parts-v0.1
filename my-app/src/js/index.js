// index.js
import { addLogEntry, renderLogs } from './log.js';
import { attachPartSuggestions, showToast } from './utils.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log("[index.js] loaded");

  // Awareness slider update logic
  const slider = document.getElementById('aware');
  const output = document.getElementById('awarenessValue');

  if (slider && output) {
    output.textContent = slider.value;
    slider.addEventListener('input', () => {
      output.textContent = slider.value;
    });
  }

  const whoInput = document.getElementById('who');
  attachPartSuggestions(whoInput);

  // Load logs on page load
  renderLogs('logDisplay', 'recent_logs');

  // Log button click handler
  const logBtn = document.getElementById('log-btn');
  if (logBtn) {
    logBtn.addEventListener('click', logEntry);
  }
});

function logEntry() {
  console.log("[logEntry] called");

  const who = document.getElementById('who').value.trim();
  const where = document.getElementById('where').value.trim();
  const when = document.getElementById('when').value.trim();
  const msg = document.getElementById('msg').value.trim();
  const awareness = parseInt(document.getElementById('aware').value, 10);

  if (!who || !where || !when) {
    showToast("Please fill out who, where, and when.", 'error');
    return;
  }

  const entry = {
    who,
    where,
    when,
    msg,
    awareness,
    timestamp: new Date().toISOString()
  };

  addLogEntry(entry);
  renderLogs('logDisplay', 'recent_logs');
  showToast("Entry logged!");

  // Clear form
  document.getElementById('who').value = '';
  document.getElementById('where').value = '';
  document.getElementById('when').value = '';
  document.getElementById('msg').value = '';
  document.getElementById('aware').value = '5';
  document.getElementById('awarenessValue').textContent = '5';
}
