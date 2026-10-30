import { db } from './firebase.js';
import { ref, set, onValue, onDisconnect, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Отдельная запись на вкладку. Поле user нужно, чтобы не считать вторую вкладку
// того же человека собеседником; legacy-записи без user учитываются как неизвестный клиент.
const mySessionId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
  .replace(/[^a-zA-Z0-9_-]/g, '');
const onlineUsersRef = ref(db, 'online_users');
const myPresenceRef = ref(db, `online_users/${mySessionId}`);
let unsubscribeOnlineUsers = null;
let presenceGeneration = 0;
let presenceQueue = Promise.resolve();

function enqueuePresenceOperation(operation) {
  const result = presenceQueue.then(operation, operation);
  presenceQueue = result.catch(error => {
    console.error('Ошибка очереди статуса присутствия:', error);
  });
  return result;
}

export function initPresence() {
  const userName = localStorage.getItem('chat_user_name');
  if (!userName || unsubscribeOnlineUsers) return Promise.resolve();
  const generation = ++presenceGeneration;

  return enqueuePresenceOperation(async () => {
    if (generation !== presenceGeneration) return;

    try {
      await onDisconnect(myPresenceRef).remove();
      if (generation !== presenceGeneration) return;
      await set(myPresenceRef, { user: userName, joinedAt: Date.now() });
      if (generation !== presenceGeneration) return;

      unsubscribeOnlineUsers = onValue(onlineUsersRef, snapshot => {
        const users = snapshot.val() || {};
        const friendOnline = Object.values(users).some(session => {
          if (!session || typeof session !== 'object') return false;
          // Старые версии чата не записывали имя в presence.
          return typeof session.user === 'string' ? session.user !== userName : true;
        });
        const statusEl = document.getElementById('friend-status');
        if (!statusEl) return;

        statusEl.textContent = friendOnline ? 'Собеседник онлайн' : 'Собеседник оффлайн';
        statusEl.style.color = friendOnline ? '#4caf50' : '#888888';
      }, error => {
        console.error('Не удалось получить статус собеседника:', error);
      });
    } catch (error) {
      console.error('Не удалось обновить статус присутствия:', error);
    }
  });
}

export function removePresence() {
  ++presenceGeneration;
  if (unsubscribeOnlineUsers) {
    unsubscribeOnlineUsers();
    unsubscribeOnlineUsers = null;
  }

  // Очередь не даёт запоздавшему set после logout удалить/перезаписать новую сессию.
  return enqueuePresenceOperation(async () => {
    try {
      await remove(myPresenceRef);
    } catch (error) {
      console.error('Не удалось очистить статус присутствия:', error);
    }
  });
}
