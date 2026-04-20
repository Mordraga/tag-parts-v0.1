
import { saveToStorage, loadFromStorage } from './storage.js';
import {
  formatMentions,
  loadPartsIndex,
  findPartByName,
  attachPartSuggestions,
  showToast
} from './utils.js';

export function renderCommentSection(targetEl, commentKey, allowWrite = true) {
  const data = loadFromStorage(commentKey) || [];
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
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = c.name;
      attachPartSuggestions(nameInput);

      const msgInput = document.createElement('textarea');
      msgInput.value = c.msg;

      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        const nextName = nameInput.value.trim();
        const nextMsg = msgInput.value.trim();
        if (!nextName || !nextMsg) {
          showToast('Both fields required.', 'error');
          return;
        }
        data[index] = {
          name: nextName,
          msg: nextMsg,
          timestamp: new Date().toISOString()
        };
        saveToStorage(commentKey, data);
        renderCommentSection(targetEl, commentKey, allowWrite);
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        renderCommentSection(targetEl, commentKey, allowWrite);
      });

      div.innerHTML = '';
      div.appendChild(nameInput);
      div.appendChild(msgInput);
      div.appendChild(saveBtn);
      div.appendChild(cancelBtn);
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
    attachPartSuggestions(partInput);

    const sendBtn = formDiv.querySelector('.comment-send');
    sendBtn.addEventListener('click', () => {
      const name = partInput.value.trim();
      const msg = formDiv.querySelector('.comment-msg').value.trim();

      if (!name || !msg) {
        alert('Both fields required.');
        return;
      }

      data.push({ name, msg, timestamp: new Date().toISOString() });
      saveToStorage(commentKey, data);
      renderCommentSection(targetEl, commentKey, allowWrite);
    });

    targetEl.appendChild(formDiv);
  }
}
