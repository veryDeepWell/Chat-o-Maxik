import { db } from './firebase.js';
import { ref, set, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { currentUser } from './auth.js';

let friendTypingInterval = null;
let typingTimeout = null;
const typingRootRef = ref(db, 'typing_status');
const connectionRef = ref(db, '.info/connected');
const sessionId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
  .replace(/[^a-zA-Z0-9_-]/g, '');
const ownTypingRef = ref(db, `typing_status/${sessionId}`);
let disconnectCleanupRegistered = false;
let lastConnectionState = null;
let unsubscribeTypingStatus = null;

function registerDisconnectCleanup() {
  if (disconnectCleanupRegistered) return;
  disconnectCleanupRegistered = true;
  onDisconnect(ownTypingRef).remove().catch(error => {
    console.error('Не удалось настроить очистку статуса набора:', error);
    disconnectCleanupRegistered = false;
  });
}

function writeTypingStatus() {
  if (!currentUser) return;
  set(ownTypingRef, { user: currentUser, timestamp: Date.now() }).catch(error => {
    console.error('Не удалось обновить статус набора:', error);
  });
}

// onDisconnect must be registered again after an RTDB connection is restored.
onValueConnection();
function onValueConnection() {
  onValue(connectionRef, snapshot => {
    const connected = snapshot.val() === true;
    if (!connected) {
      disconnectCleanupRegistered = false;
    } else if (lastConnectionState !== true) {
      disconnectCleanupRegistered = false;
      if (typingTimeout !== null && currentUser) {
        registerDisconnectCleanup();
        writeTypingStatus();
      }
    }
    lastConnectionState = connected;
  }, error => console.error('Не удалось проверить подключение Firebase:', error));
}

// У каждого открытого клиента собственная запись, чтобы клиенты не стирали
// статус набора друг друга. Читаем и старый плоский формат для совместимости.
export function startTyping() {
  if (!currentUser) return;

  registerDisconnectCleanup();
  writeTypingStatus();

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 2000);
}

export function stopTyping() {
  clearTimeout(typingTimeout);
  typingTimeout = null;
  remove(ownTypingRef).catch(error => {
    console.error('Не удалось очистить статус набора:', error);
  });
}

export function listenTypingStatus() {
  if (unsubscribeTypingStatus) return unsubscribeTypingStatus;

  unsubscribeTypingStatus = onValue(typingRootRef, snapshot => {
    const data = snapshot.val();
    const now = Date.now();
    const isRecent = timestamp => Number.isFinite(Number(timestamp)) && now - Number(timestamp) < 5000;

    // Legacy clients stored { user, timestamp } directly at /typing_status.
    const legacyTyping = data && typeof data.user === 'string' &&
      data.user !== currentUser && isRecent(data.timestamp);
    const sessionTyping = data && Object.values(data).some(item =>
      item && typeof item === 'object' && item.user && item.user !== currentUser &&
      isRecent(item.timestamp)
    );
    const anotherUserTyping = Boolean(legacyTyping || sessionTyping);

    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;

    if (anotherUserTyping) {
      if (friendTypingInterval === null) {
        let dots = 0;
        friendTypingInterval = setInterval(() => {
          dots = (dots + 1) % 4;
          indicator.textContent = 'Собеседник печатает' + '.'.repeat(dots);
        }, 500);
      }
    } else {
      clearInterval(friendTypingInterval);
      friendTypingInterval = null;
      indicator.textContent = '';
    }
  }, error => {
    console.error('Не удалось получить статус набора:', error);
  });

  return unsubscribeTypingStatus;
}
