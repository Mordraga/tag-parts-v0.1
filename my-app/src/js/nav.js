const SECONDARY_HREFS = ['messageBoard.html', 'relationships.html', 'analytics.html', 'Settings.html'];

export function initNav() {
  const filename = location.pathname.split('/').pop() || 'index.html';
  const secondary = document.getElementById('bn-secondary');
  const moreBtn = document.getElementById('bn-more');

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
