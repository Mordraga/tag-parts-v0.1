import { saveToStorage, loadFromStorage } from './storage.js';
import { ensureMicPermission } from './voice.js';
import { getLocation } from './gps.js';
import { requestPermission } from './notifications.js';
import { getTermSingular, getTermPlural } from './utils.js';

const DONE_KEY = 'onboarding_complete';
const PARTS_KEY = 'parts_data';
const INDEX_KEY = 'parts_index';

export function maybeShowOnboarding() {
  if (loadFromStorage(DONE_KEY, false)) return;
  const parts = loadFromStorage(PARTS_KEY, []);
  if (parts.length > 0) {
    saveToStorage(DONE_KEY, true);
    return;
  }
  buildOverlay();
}

function buildOverlay() {
  const singular = getTermSingular();
  const plural = getTermPlural();

  const overlay = document.createElement('div');
  overlay.id = 'ob-overlay';
  overlay.innerHTML = `
    <div class="ob-box">
      <div class="ob-step" id="ob-step-1">
        <div class="ob-hero">🌟</div>
        <h2>Welcome to Inner Parts</h2>
        <p class="ob-subtitle">A private space for your system to track fronting, manage ${plural.toLowerCase()}, and understand patterns over time.</p>
        <div class="ob-features">
          <div class="ob-feature-chip">🧩 ${plural} directory</div>
          <div class="ob-feature-chip">📋 Fronting log</div>
          <div class="ob-feature-chip">📓 Journals</div>
          <div class="ob-feature-chip">📊 Analytics</div>
        </div>
        <p class="ob-privacy-note">🔒 All data stays on this device. Nothing is sent anywhere.</p>
        <button class="ob-btn" id="ob-next-1">Get Started →</button>
      </div>

      <div class="ob-step ob-hidden" id="ob-step-2">
        <h2>Add Your First ${singular}</h2>
        <p class="ob-subtitle">${plural} are the members of your system. Add one now to unlock the fronting log and autocomplete.</p>
        <div class="ob-form">
          <label class="ob-label">
            Name <span class="ob-req">*</span>
            <input id="ob-name" type="text" placeholder="Part name" maxlength="50" autocomplete="off" />
          </label>
          <label class="ob-label">
            Role <span class="ob-req">*</span>
            <input id="ob-role" type="text" placeholder="e.g. Protector, Host, Caretaker" maxlength="100" autocomplete="off" />
          </label>
          <label class="ob-label">
            Color
            <div class="ob-color-row">
              <input id="ob-color" type="color" value="#8b5cf6" />
              <span id="ob-color-preview" class="ob-color-chip">Preview</span>
            </div>
          </label>
          <label class="ob-label">
            Emoji <span class="ob-opt">(optional)</span>
            <input id="ob-emoji" type="text" placeholder="e.g. 🌊" maxlength="4" autocomplete="off" />
          </label>
        </div>
        <p class="ob-error ob-hidden" id="ob-err">Name and Role are required.</p>
        <button class="ob-btn" id="ob-save">Save &amp; Continue →</button>
        <button class="ob-skip" id="ob-skip">Skip for now</button>
      </div>

      <div class="ob-step ob-hidden" id="ob-step-3">
        <div class="ob-hero">🔐</div>
        <h2>Set Up Permissions</h2>
        <p class="ob-subtitle">Inner Parts works best with a few permissions. You can change these any time in device Settings.</p>
        <div class="ob-tips">
          <p>🎙 <strong>Microphone</strong> — for voice logging</p>
          <p>📍 <strong>Location</strong> — to auto-fill where you are</p>
          <p>🔔 <strong>Notifications</strong> — for check-in reminders</p>
        </div>
        <button class="ob-btn" id="ob-allow">Allow Permissions</button>
        <button class="ob-skip" id="ob-skip-perms">Skip for now</button>
      </div>

      <div class="ob-step ob-hidden" id="ob-step-4">
        <div class="ob-hero">✅</div>
        <h2>You're all set!</h2>
        <p class="ob-subtitle">You can now log who's fronting, explore your parts list, and build your system's history.</p>
        <div class="ob-tips">
          <p>💡 <strong>Tip:</strong> Log daily to get meaningful analytics over time.</p>
          <p>📓 Each part can have their own password-protected journal.</p>
          <p>⚡ Tap the Quick Log button (top right) for fast entries.</p>
        </div>
        <button class="ob-btn" id="ob-finish">Start Using Inner Parts</button>
      </div>

      <div class="ob-dots">
        <span class="ob-dot ob-dot-active" data-step="1"></span>
        <span class="ob-dot" data-step="2"></span>
        <span class="ob-dot" data-step="3"></span>
        <span class="ob-dot" data-step="4"></span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  bindEvents(overlay);
}

function bindEvents(overlay) {
  overlay.querySelector('#ob-next-1').addEventListener('click', () => goToStep(2));

  const colorInput = overlay.querySelector('#ob-color');
  const colorPreview = overlay.querySelector('#ob-color-preview');
  const syncPreview = () => {
    colorPreview.style.backgroundColor = colorInput.value;
    colorPreview.textContent = colorInput.value;
  };
  colorInput.addEventListener('input', syncPreview);
  syncPreview();

  overlay.querySelector('#ob-save').addEventListener('click', () => {
    const name = overlay.querySelector('#ob-name').value.trim();
    const role = overlay.querySelector('#ob-role').value.trim();
    const errEl = overlay.querySelector('#ob-err');
    if (!name || !role) {
      errEl.classList.remove('ob-hidden');
      return;
    }
    errEl.classList.add('ob-hidden');
    savePart({
      name,
      role,
      ifsRole: '',
      alias: '',
      color: colorInput.value,
      defaultEmoji: overlay.querySelector('#ob-emoji').value.trim() || null,
      private: false,
      timestamp: new Date().toLocaleString(),
    });
    goToStep(3);
  });

  overlay.querySelector('#ob-skip').addEventListener('click', () => goToStep(3));

  overlay.querySelector('#ob-allow').addEventListener('click', async () => {
    const btn = overlay.querySelector('#ob-allow');
    btn.disabled = true;
    btn.textContent = 'Requesting…';
    // Request sequentially — each triggers its own system dialog
    await ensureMicPermission().catch(() => {});
    await getLocation(3000).catch(() => {});
    await requestPermission().catch(() => {});
    goToStep(4);
  });

  overlay.querySelector('#ob-skip-perms').addEventListener('click', () => goToStep(4));

  overlay.querySelector('#ob-finish').addEventListener('click', () => {
    saveToStorage(DONE_KEY, true);
    overlay.remove();
    window.location.reload();
  });
}

function goToStep(n) {
  document.querySelectorAll('.ob-step').forEach(el => el.classList.add('ob-hidden'));
  document.getElementById('ob-step-' + n).classList.remove('ob-hidden');
  document.querySelectorAll('.ob-dot').forEach(dot => {
    dot.classList.toggle('ob-dot-active', parseInt(dot.dataset.step) === n);
  });
}

function savePart(part) {
  const parts = loadFromStorage(PARTS_KEY, []);
  parts.push(part);
  saveToStorage(PARTS_KEY, parts);
  const index = parts.map(p => ({ name: p.name, color: p.color, defaultEmoji: p.defaultEmoji || null }));
  saveToStorage(INDEX_KEY, index);
}
