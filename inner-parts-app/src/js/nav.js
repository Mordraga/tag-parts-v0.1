const SECONDARY_HREFS = ['messageBoard.html', 'relationships.html', 'analytics.html', 'Settings.html'];

function getTermPlural() {
  try { return JSON.parse(localStorage.getItem('terminology') || '{}').plural || 'Parts'; } catch { return 'Parts'; }
}

export function initNav() {
  const filename = location.pathname.split('/').pop() || 'index.html';
  const secondary = document.getElementById('bn-secondary');
  const moreBtn = document.getElementById('bn-more');

  // Apply custom terminology to nav label
  const partsLabel = document.querySelector('.bn-item[href="parts.html"] .bn-label');
  if (partsLabel) partsLabel.textContent = getTermPlural();

  // Mark active link
  let activeInSecondary = false;
  document.querySelectorAll('.bn-item[href]').forEach(a => {
    if (a.getAttribute('href') === filename) {
      a.classList.add('active');
      if (SECONDARY_HREFS.includes(filename)) activeInSecondary = true;
    }
  });

  // Auto-open secondary row if current page lives there
  if (activeInSecondary && secondary && moreBtn) {
    secondary.classList.add('bn-open');
    moreBtn.classList.add('bn-active');
    moreBtn.setAttribute('aria-expanded', 'true');
  }

  // Toggle secondary row
  moreBtn?.addEventListener('click', () => {
    const open = secondary.classList.toggle('bn-open');
    moreBtn.setAttribute('aria-expanded', String(open));
    moreBtn.classList.toggle('bn-active', open);
  });
}

document.addEventListener('DOMContentLoaded', initNav);
