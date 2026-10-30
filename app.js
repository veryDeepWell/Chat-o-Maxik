import { initAuth, loginUser, logoutUser } from './modules/auth.js';
import { listenForMessages, sendTextMessage, updateTextMessage } from './modules/chat.js';
import { sendImage } from './modules/images.js';
import { messagesRef } from './modules/firebase.js';
import { remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { showImageModal } from './modules/modal.js';
import { startTyping, stopTyping, listenTypingStatus } from './modules/status.js';
import { initImageViewer } from './modules/viewer.js';
import { requestNotificationPermission, setNotificationVolume } from './modules/notifications.js';
import { refreshMessageTimes } from './modules/ui.js';
import { initPresence, removePresence } from './modules/presence.js';
import { initBackgroundAnimation } from './modules/background.js';
import { initAppearance } from './modules/appearance.js';

// ==========================================
// 1. ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
// ==========================================
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const nameInput = document.getElementById('nameInput');
const enterBtn = document.getElementById('enterBtn');
const logoutBtn = document.getElementById('logoutBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');

let unsubscribeMessages = null;
let replyTarget = null;
let editingTarget = null;
let draftBeforeEdit = null;

// ==========================================
// 2. УПРАВЛЕНИЕ ЭКРАНАМИ (ВХОД/ВЫХОД)
// ==========================================
function showChat() {
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  messageInput.focus();

  requestNotificationPermission();
  initPresence();
  
  const user = localStorage.getItem('chat_user_name');
  if (user && !unsubscribeMessages) {
    unsubscribeMessages = listenForMessages(user);
  }
}

function showLogin() {
  clearReply();
  clearEdit();
  chatScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
  nameInput.value = "";
  nameInput.focus();

  removePresence();
  
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  document.getElementById('messages').innerHTML = '';
}

enterBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (name) {
    loginUser(name);
    showChat();
  } else alert("Пожалуйста, введите имя!");
});

nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enterBtn.click(); });

logoutBtn.addEventListener('click', () => {
  logoutUser();
  showLogin();
});

// ==========================================
// 3. РАБОТА С ТЕКСТОМ (РЕСАЙЗ И ОТПРАВКА)
// ==========================================
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
  
  if (messageInput.scrollHeight > 120) {
    messageInput.style.overflowY = 'auto';
  } else {
    messageInput.style.overflowY = 'hidden';
  }
}

messageInput.addEventListener('input', () => { 
  if (!editingTarget) startTyping(); 
  autoResizeTextarea();
});

async function sendCurrentMessage() {
  const text = messageInput.value.trim();
  
  if (editingTarget) {
    if (!text && !editingTarget.image) return;
    const targetId = editingTarget.id;
    const saved = await updateTextMessage(targetId, text);
    if (saved && editingTarget?.id === targetId) {
      const pendingDraft = messageInput.value.trim() === text ? '' : messageInput.value;
      clearEdit({ clearInput: false });
      messageInput.value = pendingDraft;
      autoResizeTextarea();
    }
    return;
  }

  if (!text) return;

  const submittedReply = replyTarget;
  const submittedInputValue = messageInput.value;
  const sent = await sendTextMessage(text, submittedReply);
  
  if (!sent) return;

  if (messageInput.value === submittedInputValue) {
    messageInput.value = '';
    stopTyping();
    autoResizeTextarea(); // Сбрасываем высоту после отправки
  }
  if (replyTarget === submittedReply) clearReply();
}

sendBtn.addEventListener('click', sendCurrentMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Отменяем перенос строки
    sendCurrentMessage();
  }
  // При Shift+Enter ничего не делаем, браузер сам сделает перенос
});

const emojiBtn = document.getElementById('emojiBtn');
const emojis = ['👍', '👌', '🤝', '🤔', '😭', '🥳', '❤️', '🎉'];
let emojiPicker = null;

emojiBtn.addEventListener('click', (e) => {
  e.stopPropagation(); 
  
  if (emojiPicker) {
    emojiPicker.remove();
    emojiPicker = null;
    return;
  }

  emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';
  emojiPicker.addEventListener('click', (e) => e.stopPropagation()); // <-- ВАЖНО: не закрываем окно при клике внутри него
  
  emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.addEventListener('click', () => {
      messageInput.value += emoji;
      autoResizeTextarea();
      messageInput.focus();
      // Окно не закрываем, так как добавили stopPropagation выше
    });
    emojiPicker.appendChild(span);
  });

  document.querySelector('.input-area').appendChild(emojiPicker);
});

// Закрываем окошко при клике в любое другое место
document.addEventListener('click', () => {
  if (emojiPicker) {
    emojiPicker.remove();
    emojiPicker = null;
  }
});

// ==========================================
// 4. РЕДАКТИРОВАНИЕ И ОТВЕТЫ
// ==========================================
function clearEdit({ clearInput = true, restoreDraft = false } = {}) {
  editingTarget = null;
  document.getElementById('editingBar').classList.add('hidden');
  document.getElementById('editingText').textContent = 'Редактирование сообщения';
  if (restoreDraft && draftBeforeEdit !== null) messageInput.value = draftBeforeEdit;
  else if (clearInput) messageInput.value = '';
  draftBeforeEdit = null;
  messageInput.placeholder = 'Напиши что-нибудь...';
  sendBtn.textContent = '➤';
  if (attachBtn) attachBtn.disabled = false;
  autoResizeTextarea();
}

function clearReply() {
  replyTarget = null;
  document.getElementById('replyingBar').classList.add('hidden');
  document.getElementById('replyingText').textContent = '';
}

document.addEventListener('chat:reply', (event) => {
  const draft = editingTarget ? draftBeforeEdit : messageInput.value;
  if (editingTarget) clearEdit({ clearInput: false, restoreDraft: true });
  else clearEdit({ clearInput: false });
  if (draft !== null) messageInput.value = draft;
  
  replyTarget = event.detail;
  document.getElementById('replyingText').textContent = `Ответ на ${replyTarget.name}: ${(replyTarget.text || (replyTarget.image ? '📷 Изображение' : '')).slice(0, 100)}`;
  document.getElementById('replyingBar').classList.remove('hidden');
  messageInput.focus();
  autoResizeTextarea();
});

document.getElementById('cancelReplyBtn').addEventListener('click', clearReply);

document.addEventListener('chat:edit', (event) => {
  const draft = editingTarget ? draftBeforeEdit : messageInput.value;
  if (editingTarget) clearEdit({ clearInput: false, restoreDraft: true });
  draftBeforeEdit = draft ?? '';
  clearReply();
  
  const target = event.detail;
  editingTarget = target;
  document.getElementById('editingText').textContent = `Редактирование сообщения: ${(target.text || (target.image ? '📷 подпись к изображению' : '')).slice(0, 90)}`;
  document.getElementById('editingBar').classList.remove('hidden');
  messageInput.value = target.text || '';
  messageInput.placeholder = 'Измени сообщение...';
  sendBtn.textContent = '✓';
  attachBtn.disabled = true;
  messageInput.focus();
  autoResizeTextarea();
});

document.getElementById('cancelEditBtn').addEventListener('click', () => {
  clearEdit({ clearInput: false, restoreDraft: true });
});

// ==========================================
// 5. ОТПРАВКА ФАЙЛОВ
// ==========================================
attachBtn.addEventListener('click', () => fileInput.click());

function handleImageSelection(file) {
  if (!file) return;
  const existingText = messageInput.value.trim();
  
  showImageModal(file, async (confirmedFile, caption, keepOriginal) => {
    const sent = await sendImage(confirmedFile, caption, replyTarget, keepOriginal);
    if (sent) {
      clearReply();
      if (messageInput.value.trim() === existingText) {
        messageInput.value = '';
        autoResizeTextarea();
      }
    } else {
      messageInput.value = caption;
      autoResizeTextarea();
    }
  });
  
  setTimeout(() => {
    document.getElementById('imageCaptionInput').value = existingText;
  }, 0);
}

fileInput.addEventListener('change', (e) => {
  handleImageSelection(e.target.files[0]);
  fileInput.value = '';
});

document.addEventListener('paste', (event) => {
  const isChatVisible = !chatScreen.classList.contains('hidden');
  if (!isChatVisible || editingTarget) return;

  const items = (event.clipboardData || window.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      handleImageSelection(item.getAsFile());
      event.preventDefault();
      break; 
    }
  }
});

// ==========================================
// 6. НАСТРОЙКИ И ГЛОБАЛЬНЫЕ ФУНКЦИИ
// ==========================================
const settingsModal = document.getElementById('settingsModal');
const soundVolume = document.getElementById('soundVolume');
const soundVolumeValue = document.getElementById('soundVolumeValue');
const timeFormat = document.getElementById('timeFormat');

soundVolume.value = localStorage.getItem('chat_sound_volume') ?? '60';
soundVolumeValue.textContent = `${soundVolume.value}%`;
timeFormat.value = localStorage.getItem('chat_time_format') ?? '24';
setNotificationVolume(soundVolume.value);

document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

soundVolume.addEventListener('input', () => { 
  soundVolumeValue.textContent = `${soundVolume.value}%`; 
  setNotificationVolume(soundVolume.value); 
});

timeFormat.addEventListener('change', () => {
  localStorage.setItem('chat_time_format', timeFormat.value);
  refreshMessageTimes();
});

window.clearChat = async function() {
  if (confirm("Удалить ВСЕ сообщения?")) {
    await remove(messagesRef);
    document.getElementById('messages').innerHTML = '';
    console.log("Чат очищен");
  }
};

// Автофокус при клике мимо полей ввода
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
  if (chatScreen.classList.contains('hidden')) return;
  const active = document.activeElement;
  if (active === messageInput || active?.matches('input, textarea, select, button, [contenteditable="true"]')) return;
  messageInput.focus();
});

// ==========================================
// 7. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
initImageViewer();
initAuth(showChat, showLogin);
listenTypingStatus();
initAppearance();
initBackgroundAnimation();