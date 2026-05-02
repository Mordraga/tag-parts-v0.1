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

  attachPartSuggestions(document.querySelector('.who-input'));
  document.getElementById('add-cofronter').addEventListener('click', addCoFronterField);

  // Load logs on page load
  renderLogs('logDisplay', 'recent_logs');

  // Log button click handler
  const logBtn = document.getElementById('log-btn');
  if (logBtn) {
    logBtn.addEventListener('click', logEntry);
  }
});

function addCoFronterField() {
  const row = document.createElement('div');
  row.className = 'who-field';
  const input = document.createElement('input');
  input.className = 'who-input';
  input.placeholder = 'Co-fronter name';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'who-remove-btn';
  btn.textContent = '−';
  btn.addEventListener('click', () => row.remove());
  row.append(input, btn);
  document.getElementById('who-container').appendChild(row);
  attachPartSuggestions(input);
}

function logEntry() {
  console.log("[logEntry] called");

  const whoValues = [...document.querySelectorAll('.who-input')]
    .map(el => el.value.trim()).filter(Boolean);
  const who = whoValues.length > 1 ? whoValues : whoValues[0] ?? '';
  const where = document.getElementById('where').value.trim();
  const when = document.getElementById('when').value.trim();
  const msg = document.getElementById('msg').value.trim();
  const awareness = parseInt(document.getElementById('aware').value, 10);

  if (!whoValues.length || !where || !when) {
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
  const whoContainer = document.getElementById('who-container');
  whoContainer.querySelectorAll('.who-field:not(:first-child)').forEach(r => r.remove());
  whoContainer.querySelector('.who-input').value = '';
  document.getElementById('where').value = '';
  document.getElementById('when').value = '';
  document.getElementById('msg').value = '';
  document.getElementById('aware').value = '5';
  document.getElementById('awarenessValue').textContent = '5';
}
