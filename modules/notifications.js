// Загружаем звук
const notificationSound = new Audio('./assets/pop.mp3');
notificationSound.volume = Number(localStorage.getItem('chat_sound_volume') ?? 60) / 100;
export function setNotificationVolume(value) { notificationSound.volume = Math.max(0, Math.min(1, Number(value) / 100)); localStorage.setItem('chat_sound_volume', String(value)); }
let originalTitle = document.title;

// Функция запроса разрешения (вызывается при входе в чат)
export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  
  // Если разрешение еще не запрошено — запрашиваем
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Основная функция показа уведомления
export function showNotification(senderName, messageText, isImage) {
  // 1. Проигрываем звук
  notificationSound.play().catch(e => console.log("Браузер заблокировал звук до первого клика", e));

  // 2. Меняем заголовок вкладки, если вкладка не активна
  if (document.hidden) {
    document.title = `💬 Новое сообщение от ${senderName}`;
  }

  // 3. Показываем системное уведомление (только если есть разрешение и вкладка не активна)
  if (typeof Notification !== 'undefined' && Notification.permission === "granted" && document.hidden) {
    const textToShow = isImage ? "📷 Отправил(а) картинку" : messageText;
    
    const notification = new Notification(`Сообщение от ${senderName}`, {
      body: textToShow,
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968819.png', // Можно поставить свою иконку
      tag: 'chat-message' // Группирует уведомления (не будет спамить 10 окон)
    });

    // Если кликнуть по уведомлению — фокусируемся на вкладке и возвращаем заголовок
    notification.onclick = () => {
      window.focus();
      document.title = originalTitle;
      notification.close();
    };
  }
}

// Сброс заголовка при возвращении на вкладку
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    document.title = originalTitle;
  }
});