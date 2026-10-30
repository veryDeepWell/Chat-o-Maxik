import { renderFormattedText } from './format.js';
import { createAttachmentElement } from './attachments.js';

function appendTextWithLinks(container, text) {
  renderFormattedText(container, text);
}

function closeMessageMenus(except = null) {
  document.querySelectorAll('.message-actions-menu').forEach(menu => {
    if (menu !== except) {
      menu.classList.add('hidden');
      const button = menu.parentElement?.querySelector('.message-more');
      if (button) button.setAttribute('aria-expanded', 'false');
    }
  });
}

// Единственный глобальный обработчик: закрывает меню при нажатии вне сообщения.
document.addEventListener('click', event => {
  if (!event.target.closest('.message-actions-wrapper')) closeMessageMenus();
});

function findMessage(messageId) {
  return Array.from(document.querySelectorAll('#messages .message')).find(element => element.dataset.id === messageId);
}

export function displayMessage(name, text, imageBase64, currentUser, isRead, messageId, timestamp, replyTo = null, prepend = false, edited = false, attachment = null) {
  const messagesDiv = document.getElementById('messages');
  const existingMessage = findMessage(messageId);
  const wasNearBottom = messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight < 100;
  const messageEl = document.createElement('div');
  messageEl.classList.add('message');
  messageEl.dataset.id = messageId;

  const isMine = name === currentUser;
  if (isMine) messageEl.classList.add('my-message');

  // Меню действий в углу сообщения.
  const actionsWrapper = document.createElement('div');
  actionsWrapper.className = 'message-actions-wrapper';
  const moreButton = document.createElement('button');
  moreButton.type = 'button';
  moreButton.className = 'message-more';
  moreButton.textContent = '…';
  moreButton.title = 'Действия сообщения';
  moreButton.setAttribute('aria-label', 'Действия сообщения');
  moreButton.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'message-actions-menu hidden';
  const replyAction = document.createElement('button');
  replyAction.type = 'button';
  replyAction.className = 'message-action';
  replyAction.textContent = 'Ответить';
  menu.appendChild(replyAction);

  let editAction = null;
  let deleteAction = null;
  let confirmBox = null;
  if (isMine) {
    editAction = document.createElement('button');
    editAction.type = 'button';
    editAction.className = 'message-action';
    editAction.textContent = 'Изменить';
    menu.appendChild(editAction);

    deleteAction = document.createElement('button');
    deleteAction.type = 'button';
    deleteAction.className = 'message-action message-action-danger';
    deleteAction.textContent = 'Удалить';
    menu.appendChild(deleteAction);

    confirmBox = document.createElement('div');
    confirmBox.className = 'delete-confirm-box hidden';
    const confirmText = document.createElement('span');
    confirmText.textContent = 'Удалить сообщение?';
    const confirmYes = document.createElement('button');
    confirmYes.type = 'button';
    confirmYes.className = 'confirm-yes';
    confirmYes.textContent = 'Да';
    const confirmNo = document.createElement('button');
    confirmNo.type = 'button';
    confirmNo.className = 'confirm-no';
    confirmNo.textContent = 'Нет';
    confirmBox.append(confirmText, confirmYes, confirmNo);
    menu.appendChild(confirmBox);

    deleteAction.addEventListener('click', event => {
      event.stopPropagation();
      confirmBox.classList.remove('hidden');
      deleteAction.classList.add('hidden');
      editAction.classList.add('hidden');
      replyAction.classList.add('hidden');
    });
    confirmNo.addEventListener('click', event => {
      event.stopPropagation();
      confirmBox.classList.add('hidden');
      deleteAction.classList.remove('hidden');
      editAction.classList.remove('hidden');
      replyAction.classList.remove('hidden');
    });
    confirmYes.addEventListener('click', async event => {
      event.stopPropagation();
      try {
        const { ref, remove } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js');
        const { db } = await import('./firebase.js');
        await remove(ref(db, `messages/${messageId}`));
        messageEl.remove();
        closeMessageMenus();
      } catch (error) {
        console.error('Ошибка удаления сообщения:', error);
        alert('Не удалось удалить сообщение. Проверь подключение к Firebase.');
      }
    });
  }

  moreButton.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = menu.classList.contains('hidden');
    closeMessageMenus(menu);
    menu.classList.toggle('hidden', !shouldOpen);
    menu.classList.remove('open-up');
    if (shouldOpen) {
      const messagesContainer = document.getElementById('messages');
      if (menu.getBoundingClientRect().bottom > messagesContainer.getBoundingClientRect().bottom) {
        menu.classList.add('open-up');
      }
      const PADDING = 10;
      menu.style.transform = '';
      const rect = menu.getBoundingClientRect();
      let shift = 0;
      if (rect.left < PADDING) {
        shift = PADDING - rect.left;
      } else if (rect.right > window.innerWidth - PADDING) {
        shift = (window.innerWidth - PADDING) - rect.right;
      }
      if (shift !== 0) {
        menu.style.transform = `translateX(${shift}px)`;
      }
    }
    moreButton.setAttribute('aria-expanded', String(shouldOpen));
  });
  menu.addEventListener('click', event => event.stopPropagation());
  replyAction.addEventListener('click', () => {
    menu.classList.add('hidden');
    moreButton.setAttribute('aria-expanded', 'false');
    document.dispatchEvent(new CustomEvent('chat:reply', {
      detail: { id: messageId, name, text, image: !!imageBase64 || !!attachment, attachment: attachment ? { name: attachment.name } : null }
    }));
  });
  if (editAction) {
    editAction.addEventListener('click', () => {
      menu.classList.add('hidden');
      moreButton.setAttribute('aria-expanded', 'false');
      document.dispatchEvent(new CustomEvent('chat:edit', {
        detail: { id: messageId, name, text: text || '', image: !!imageBase64 || !!attachment, attachment: attachment ? { name: attachment.name } : null }
      }));
    });
  }
  actionsWrapper.append(moreButton, menu);
  messageEl.appendChild(actionsWrapper);

  // Двойной клик по сообщению — ответить (как в мессенджерах)
  messageEl.addEventListener('dblclick', (event) => {
    if (event.target.closest('a, button, .message-actions-wrapper, .fmt-spoiler')) return;
    document.dispatchEvent(new CustomEvent('chat:reply', {
      detail: { id: messageId, name, text, image: !!imageBase64 || !!attachment, attachment: attachment ? { name: attachment.name } : null }
    }));
  });

  const senderSpan = document.createElement('span');
  senderSpan.className = 'sender';
  senderSpan.textContent = name;
  messageEl.appendChild(senderSpan);

  if (replyTo) {
    const quote = document.createElement('button');
    quote.type = 'button';
    quote.className = 'reply-preview';
    quote.textContent = `↪ Ответ на ${replyTo.name || 'сообщение'}: ${(replyTo.text || (replyTo.attachment?.name ? `📎 ${replyTo.attachment.name}` : (replyTo.image ? '📷 Изображение' : ''))).slice(0, 100)}`;
    quote.addEventListener('click', async () => {
      let target = findMessage(replyTo.id);

      // Если оригинал старше загруженной истории, по запросу пользователя
      // подтягиваем страницы вверх, пока не найдём его или не кончатся данные.
      if (!target && replyTo.id) {
        try {
          const { loadOlderMessages } = await import('./chat.js');
          while (!target) {
            const firstBefore = document.querySelector('#messages .message')?.dataset.id || null;
            const loaded = await loadOlderMessages();
            target = findMessage(replyTo.id);
            const firstAfter = document.querySelector('#messages .message')?.dataset.id || null;
            if (target || !loaded || firstBefore === firstAfter) break;
          }
        } catch (error) {
          console.error('Не удалось перейти к исходному сообщению:', error);
        }
      }

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('message-highlight');
        setTimeout(() => target.classList.remove('message-highlight'), 1200);
      } else {
        console.info('Исходное сообщение больше недоступно или не удалось загрузить историю.');
      }
    });
    messageEl.appendChild(quote);
  }

  let imgElement = null;
  let textSpan = null;
  if (imageBase64) {
    imgElement = document.createElement('img');
    imgElement.src = imageBase64;
    imgElement.alt = text ? 'Изображение: ' + text : 'Изображение';
    imgElement.addEventListener('click', async () => {
      const { openImageViewer } = await import('./viewer.js');
      openImageViewer(imageBase64);
    });
    messageEl.appendChild(imgElement);
  }
  if (attachment) {
    messageEl.appendChild(createAttachmentElement(attachment));
  }
  if (text) {
    textSpan = document.createElement('span');
    textSpan.className = 'message-text';
    appendTextWithLinks(textSpan, text);
    if (imageBase64) {
      textSpan.style.display = 'block';
      textSpan.style.marginTop = '8px';
    }
    messageEl.appendChild(textSpan);
  }

  const metaDiv = document.createElement('div');
  metaDiv.className = 'message-meta';
  if (timestamp) {
    const timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.dataset.timestamp = timestamp;
    const date = new Date(Number(timestamp));
    const use24 = localStorage.getItem('chat_time_format') !== '12';
    timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !use24 });
    metaDiv.appendChild(timeSpan);
  }
  if (edited) {
    const editedSpan = document.createElement('span');
    editedSpan.className = 'edited-label';
    editedSpan.textContent = 'изменено';
    editedSpan.title = 'Это сообщение редактировали';
    metaDiv.appendChild(editedSpan);
  }
  if (isMine) {
    const statusSpan = document.createElement('span');
    statusSpan.className = 'msg-status';
    statusSpan.textContent = isRead ? 'Прочитано' : 'Отправлено';
    metaDiv.appendChild(statusSpan);
  }
  messageEl.appendChild(metaDiv);

  if (existingMessage) {
    existingMessage.replaceWith(messageEl);
  } else if (prepend) {
    messagesDiv.insertBefore(messageEl, messagesDiv.firstChild);
  } else {
    messagesDiv.appendChild(messageEl);
    if (wasNearBottom) messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  if (imgElement) {
    imgElement.onload = () => {
      let width = imgElement.offsetWidth;
      if (width < 250) {
        width = 250;
        imgElement.style.margin = 'auto';
      }
      if (textSpan) textSpan.style.maxWidth = width + 'px';
      metaDiv.style.maxWidth = width + 'px';
      metaDiv.style.width = width + 'px';
      messageEl.style.width = 'fit-content';
      messageEl.style.maxWidth = '100%';
    };
  }
}

export function updateMessageStatus(messageId, isRead) {
  const element = findMessage(messageId);
  if (element && isRead) {
    const status = element.querySelector('.msg-status');
    if (status) status.textContent = 'Прочитано';
  }
}

export function refreshMessageTimes() {
  document.querySelectorAll('.message').forEach(element => {
    const time = element.querySelector('.msg-time');
    if (!time || !time.dataset.timestamp) return;
    const date = new Date(Number(time.dataset.timestamp));
    time.textContent = date.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
      hour12: localStorage.getItem('chat_time_format') === '12'
    });
  });
}
