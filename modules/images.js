import { messagesRef } from './firebase.js';
import { push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Функция для сжатия картинки (остается без изменений)
function compressImage(file, maxWidth = 800, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось создать canvas-контекст для сжатия изображения.'));
          return;
        }
        try {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = (error) => reject(error);
      img.src = event.target.result;
    };
    reader.onerror = (error) => reject(error);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// Обновленная функция отправки
export async function sendImage(file, captionText = "", replyTo = null, keepOriginal = false) {
  const currentUser = localStorage.getItem('chat_user_name');
  if (!file || !currentUser) return false;

  const statusIndicator = document.getElementById('status-indicator');
  const originalText = statusIndicator.textContent;

  try {
    let base64Image;

    // ЛОГИКА ВЫБОРА: сжимать или нет
    if (keepOriginal) {
      // Проверка размера: если больше 5 МБ, не пускаем
      const maxSize = 5 * 1024 * 1024; // 5 МБ в байтах
      if (file.size > maxSize) {
        alert("Картинка слишком большая для отправки без сжатия (максимум 5 МБ).\nПожалуйста, снимите галочку 'Отправить без сжатия' или выберите файл поменьше.");
        return false; // Прерываем отправку
      }
      
      statusIndicator.textContent = "Обработка...";
      base64Image = await fileToBase64(file);
    } else {
      statusIndicator.textContent = "Сжимаем...";
      base64Image = await compressImage(file);
    }
    
    statusIndicator.textContent = "Отправляем...";
    
    const payload = {
      name: currentUser,
      image: base64Image,
      text: captionText,
      read: false,
      timestamp: serverTimestamp()
    };
    
    if (replyTo) payload.replyTo = replyTo;
    
    await push(messagesRef, payload);
    
    statusIndicator.textContent = "Подключено";
    statusIndicator.classList.add('connected');
    return true;
  } catch (error) {
    console.error("Ошибка отправки картинки:", error);
    statusIndicator.textContent = originalText;
    alert("Не удалось отправить картинку. Возможно, она слишком большая или соединение с Firebase недоступно.");
    return false;
  }
}