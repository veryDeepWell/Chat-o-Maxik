// modules/modal.js
export function showImageModal(file, onConfirm, onCancel = () => {}) {
  const modal = document.getElementById('imageModal');
  const previewImg = document.getElementById('previewImage');
  const confirmBtn = document.getElementById('confirmImageBtn');
  const cancelBtn = document.getElementById('cancelImageBtn');
  const captionInput = document.getElementById('imageCaptionInput');
  const keepQualityCheckbox = document.getElementById('keepQualityCheckbox');

  // Создаем временную ссылку для предпросмотра
  const objectUrl = URL.createObjectURL(file);
  previewImg.src = objectUrl;

  keepQualityCheckbox.checked = false;

  // Показываем окно и фокусируемся на поле ввода текста
  modal.classList.remove('hidden');
  captionInput.focus();

  // Функция очистки
  let settled = false;
  const cleanup = () => {
    modal.classList.add('hidden');
    URL.revokeObjectURL(objectUrl);
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    captionInput.onkeypress = null;
    captionInput.value = ''; // Очищаем поле при закрытии
  };

  // Обработчик кнопки "Отправить"
  const handleConfirm = () => {
    if (settled) return;
    settled = true;
    const caption = captionInput.value.trim();
    const keepOriginal = keepQualityCheckbox.checked;
    cleanup();
    onConfirm(file, caption, keepOriginal); // Передаем и файл, и текст
  };

  const handleCancel = () => {
    if (settled) return;
    settled = true;
    cleanup();
    onCancel();
  };

  confirmBtn.onclick = handleConfirm;
  cancelBtn.onclick = handleCancel;

  // Отправка по Enter
  captionInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };
}