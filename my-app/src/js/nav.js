export function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const overlay = document.getElementById('nav-overlay');

  const filename = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === filename || (filename === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  toggle?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });

  overlay?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });
}

document.addEventListener('DOMContentLoaded', initNav);
