let modalEl = null;

function ensureModal() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.style.display = 'none';
  modalEl.innerHTML = `
    <div class="modal-box">
      <h3 class="modal-title"></h3>
      <div class="modal-body"></div>
    </div>
  `;
  document.body.appendChild(modalEl);
  return modalEl;
}

export function openModal(title, setupFn) {
  const modal = ensureModal();
  modal.querySelector('.modal-title').textContent = title;
  const body = modal.querySelector('.modal-body');
  body.innerHTML = '';
  const close = () => { modal.style.display = 'none'; body.innerHTML = ''; };
  modal.onclick = (e) => { if (e.target === modal) close(); };
  modal.style.display = 'flex';
  setupFn(body, close);
}
