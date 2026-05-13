
import { saveToStorage, loadFromStorage } from './storage.js';
import { openModal } from './modal.js';
import { renderReactionBar } from './reactions.js';
import {
  formatMentions,
  loadPartsIndex,
  findPartByName,
  attachPartSuggestions,
  attachMentionAutocomplete,
  showToast
} from './utils.js';

function genCommentId() {
  return 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
}

function normalizeComments(data) {
  let changed = false;
  const result = data.map(c => {
    if (!c.id) { changed = true; return { ...c, id: genCommentId() }; }
    return c;
  });
  return { result, changed };
}

export function renderCommentSection(targetEl, commentKey, allowWrite = true) {
  const raw = loadFromStorage(commentKey) || [];
  const { result: data, changed } = normalizeComments(raw);
  if (changed) saveToStorage(commentKey, data);
  targetEl.innerHTML = '';

  const partsIndex = loadPartsIndex();

  const threadDiv = document.createElement('div');
  threadDiv.className = 'comment-thread';

  data.forEach((c, index) => {
    const div = document.createElement('div');
    div.className = 'comment';

    const part = findPartByName(c.name, partsIndex);
    if (part?.color) {
      div.style.borderLeftColor = part.color;
    }

    const p = document.createElement('p');
    const mentionData = formatMentions(c.msg || '', partsIndex);
    p.innerHTML = `<strong>${c.name}</strong>: ${mentionData.html}`;

    const time = document.createElement('div');
    time.className = 'comment-timestamp';
    time.textContent = new Date(c.timestamp).toLocaleString();

    const btnWrap = document.createElement('div');
    btnWrap.className = 'comment-buttons';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      if (!allowWrite) return;
      openModal('Edit Comment', (body, close) => {
        body.innerHTML = `
          <div class="log-edit-form">
            <input type="text" class="comment-edit-name" value="${c.name}" placeholder="Part name" />
            <textarea class="comment-edit-msg" rows="3">${c.msg}</textarea>
            <div class="edit-actions">
              <button class="comment-save-btn">Save</button>
              <button class="comment-cancel-btn ghost-btn">Cancel</button>
            </div>
          </div>
        `;

        const nameInput = body.querySelector('.comment-edit-name');
        const msgTextarea = body.querySelector('.comment-edit-msg');
        attachPartSuggestions(nameInput);
        attachMentionAutocomplete(msgTextarea);
        body.querySelector('.comment-cancel-btn').addEventListener('click', close);

        body.querySelector('.comment-save-btn').addEventListener('click', () => {
          const nextName = nameInput.value.trim();
          const nextMsg = msgTextarea.value.trim();
          if (!nextName || !nextMsg) {
            showToast('Both fields required.', 'error');
            return;
          }
          data[index] = { ...data[index], name: nextName, msg: nextMsg, timestamp: new Date().toISOString() };
          saveToStorage(commentKey, data);
          renderCommentSection(targetEl, commentKey, allowWrite);
          close();
        });

        nameInput.focus();
      });
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (!confirm('Delete this comment?')) return;
      data.splice(index, 1);
      saveToStorage(commentKey, data);
      renderCommentSection(targetEl, commentKey, allowWrite);
    });

    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(delBtn);

    div.appendChild(p);
    div.appendChild(time);
    div.appendChild(btnWrap);
    if (c.id) renderReactionBar(div, 'comment', `${commentKey}_${c.id}`);
    threadDiv.appendChild(div);
  });

  targetEl.appendChild(threadDiv);

  if (allowWrite) {
    const formDiv = document.createElement('div');
    formDiv.className = 'comment-box';

    formDiv.innerHTML = `
      <input type="text" class="comment-part" placeholder="Part name" />
      <input type="text" class="comment-msg" placeholder="Comment..." />
      <button class="comment-send">Send</button>
    `;

    const partInput = formDiv.querySelector('.comment-part');
    const msgInput = formDiv.querySelector('.comment-msg');
    attachPartSuggestions(partInput);
    attachMentionAutocomplete(msgInput);

    const sendBtn = formDiv.querySelector('.comment-send');
    sendBtn.addEventListener('click', () => {
      const name = partInput.value.trim();
      const msg = msgInput.value.trim();

      if (!name || !msg) {
        showToast('Both fields required.', 'error');
        return;
      }

      data.push({ id: genCommentId(), name, msg, timestamp: new Date().toISOString() });
      saveToStorage(commentKey, data);
      renderCommentSection(targetEl, commentKey, allowWrite);
    });

    targetEl.appendChild(formDiv);
  }
}
