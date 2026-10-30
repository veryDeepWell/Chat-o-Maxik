import { messagesRef } from './firebase.js';
import { push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function guessMimeType(file) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', md: 'text/markdown', txt: 'text/plain', json: 'application/json'
  })[extension] || 'application/octet-stream';
}

export async function sendAttachment(file, caption = '', replyTo = null) {
  const user = localStorage.getItem('chat_user_name');
  if (!file || !user) return false;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    alert(`Файл слишком большой. Сейчас лимит — 2 МБ.\nДля крупных файлов лучше подключить Firebase Storage, а в Realtime Database хранить только ссылку.`);
    return false;
  }

  const status = document.getElementById('status-indicator');
  const previousStatus = status?.textContent;
  try {
    if (status) status.textContent = 'Читаем файл…';
    const dataUrl = await readDataUrl(file);
    if (status) status.textContent = 'Отправляем файл…';
    const payload = {
      name: user,
      text: String(caption || '').trim(),
      attachment: {
        name: file.name,
        type: guessMimeType(file),
        size: file.size,
        dataUrl
      },
      read: false,
      timestamp: serverTimestamp()
    };
    if (replyTo) payload.replyTo = replyTo;
    await push(messagesRef, payload);
    if (status) {
      status.textContent = 'Подключено';
      status.classList.add('connected');
    }
    return true;
  } catch (error) {
    console.error('Ошибка отправки файла:', error);
    if (status) status.textContent = previousStatus || 'Подключение…';
    alert('Не удалось отправить файл. Проверь подключение к Firebase. Черновик подписи сохранён.');
    return false;
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = String(dataUrl).split(',', 2);
  const mime = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  if (header.includes(';base64')) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data || '')], { type: mime });
}

function parseCsv(text) {
  const rows = [];
  // CSV из Excel в европейских локалях часто использует точку с запятой.
  const firstLine = String(text).split(/\r?\n/, 1)[0] || '';
  let commas = 0, semicolons = 0, inFirstQuote = false;
  for (let i = 0; i < firstLine.length; i++) {
    if (firstLine[i] === '"' && firstLine[i + 1] === '"' && inFirstQuote) { i++; continue; }
    if (firstLine[i] === '"') inFirstQuote = !inFirstQuote;
    else if (!inFirstQuote && firstLine[i] === ',') commas++;
    else if (!inFirstQuote && firstLine[i] === ';') semicolons++;
  }
  const delimiter = semicolons > commas ? ';' : ',';
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function renderTable(container, rows, maxRows = 30, maxCols = 12) {
  const table = document.createElement('table');
  table.className = 'attachment-table';
  rows.slice(0, maxRows).forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    row.slice(0, maxCols).forEach(value => {
      const cell = document.createElement(rowIndex === 0 ? 'th' : 'td');
      cell.textContent = value == null ? '' : String(value);
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  });
  container.appendChild(table);
  if (rows.length > maxRows) {
    const note = document.createElement('p');
    note.className = 'attachment-preview-note';
    note.textContent = `Показаны первые ${maxRows} строк из ${rows.length}. Файл можно скачать целиком.`;
    container.appendChild(note);
  }
}

function ensureViewer() {
  let overlay = document.getElementById('attachmentViewer');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'attachmentViewer';
  overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = '<div class="modal-content attachment-viewer-content" role="dialog" aria-modal="true" aria-label="Предпросмотр файла"><div class="attachment-viewer-header"><h3 id="attachmentViewerTitle">Предпросмотр файла</h3><div class="attachment-viewer-actions"><a id="attachmentDownload" class="btn-secondary" download>Скачать</a><button id="attachmentViewerClose" class="btn-primary" type="button">Закрыть</button></div></div><div id="attachmentPreviewBody" class="attachment-preview-body"></div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeAttachmentViewer(); });
  overlay.querySelector('#attachmentViewerClose').addEventListener('click', closeAttachmentViewer);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAttachmentViewer(); });
  return overlay;
}

export function closeAttachmentViewer() {
  const overlay = document.getElementById('attachmentViewer');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.querySelector('#attachmentPreviewBody').replaceChildren();
  overlay.querySelector('#attachmentDownload').removeAttribute('href');
  if (overlay.dataset.objectUrl) URL.revokeObjectURL(overlay.dataset.objectUrl);
  delete overlay.dataset.objectUrl;
}

export async function openAttachmentPreview(attachment) {
  if (!attachment?.dataUrl) return;
  const overlay = ensureViewer();
  const title = overlay.querySelector('#attachmentViewerTitle');
  const body = overlay.querySelector('#attachmentPreviewBody');
  const download = overlay.querySelector('#attachmentDownload');
  const name = attachment.name || 'attachment';
  const extension = name.split('.').pop().toLowerCase();
  if (overlay.dataset.objectUrl) URL.revokeObjectURL(overlay.dataset.objectUrl);
  const blob = dataUrlToBlob(attachment.dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  overlay.dataset.objectUrl = objectUrl;
  title.textContent = name;
  download.href = objectUrl;
  download.download = name;
  body.replaceChildren();
  overlay.classList.remove('hidden');

  const addMessage = text => {
    const p = document.createElement('p');
    p.className = 'attachment-preview-note';
    p.textContent = text;
    body.appendChild(p);
  };

  try {
    if (extension === 'pdf' || attachment.type === 'application/pdf') {
      const frame = document.createElement('iframe');
      frame.className = 'attachment-pdf-preview';
      frame.title = `Предпросмотр ${name}`;
      frame.src = objectUrl;
      body.appendChild(frame);
    } else if (['csv'].includes(extension)) {
      renderTable(body, parseCsv(await blob.text()));
    } else if (['md', 'markdown'].includes(extension)) {
      const text = await blob.text();
      const { marked } = await import('https://esm.sh/marked@15.0.7');
      const DOMPurifyModule = await import('https://esm.sh/dompurify@3.2.4');
      const purifier = DOMPurifyModule.default || DOMPurifyModule;
      const template = document.createElement('div');
      template.innerHTML = purifier.sanitize(marked.parse(text), { FORBID_TAGS: ['img', 'iframe', 'object', 'embed', 'video', 'audio'] });
      template.className = 'markdown-preview';
      body.appendChild(template);
    } else if (['docx'].includes(extension)) {
      const mammothModule = await import('https://esm.sh/mammoth@1.9.0');
      const mammoth = mammothModule.default || mammothModule;
      const DOMPurifyModule = await import('https://esm.sh/dompurify@3.2.4');
      const purifier = DOMPurifyModule.default || DOMPurifyModule;
      const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
      const template = document.createElement('div');
      template.className = 'document-preview';
      template.innerHTML = purifier.sanitize(result.value, { FORBID_TAGS: ['img', 'iframe', 'object', 'embed', 'video', 'audio'] });
      body.appendChild(template);
    } else if (['xlsx', 'xls'].includes(extension)) {
      const XLSXModule = await import('https://esm.sh/xlsx@0.18.5');
      const XLSX = XLSXModule.default || XLSXModule;
      const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
      const sheets = workbook.SheetNames;
      if (sheets.length > 1) {
        const select = document.createElement('select');
        select.className = 'attachment-sheet-select';
        sheets.forEach((sheet, index) => {
          const option = document.createElement('option');
          option.value = sheet; option.textContent = sheet;
          select.appendChild(option);
        });
        body.appendChild(select);
        const tableHost = document.createElement('div');
        body.appendChild(tableHost);
        const showSheet = sheetName => {
          tableHost.replaceChildren();
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false });
          renderTable(tableHost, rows);
        };
        select.addEventListener('change', () => showSheet(select.value));
        showSheet(sheets[0]);
      } else {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheets[0]], { header: 1, defval: '', blankrows: false });
        renderTable(body, rows);
      }
    } else if (['txt', 'log', 'json', 'xml', 'yaml', 'yml'].includes(extension) || (attachment.type || '').startsWith('text/')) {
      const pre = document.createElement('pre');
      pre.className = 'attachment-text-preview';
      pre.textContent = await blob.text();
      body.appendChild(pre);
    } else if (extension === 'doc') {
      addMessage('Формат .doc не поддерживает надёжный встроенный предпросмотр в браузере. Скачай файл, чтобы открыть его в редакторе документов.');
    } else {
      addMessage('Для этого типа файла доступно скачивание, но встроенный предпросмотр не поддерживается.');
    }
  } catch (error) {
    console.error('Не удалось показать предпросмотр файла:', error);
    body.replaceChildren();
    addMessage('Не удалось построить предпросмотр. Файл всё ещё можно скачать. Возможно, нужен доступ к CDN-библиотекам или файл повреждён.');
  }
}

export function createAttachmentElement(attachment) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'message-attachment';
  const ext = (attachment.name || 'FILE').split('.').pop().slice(0, 5).toUpperCase();
  const icon = document.createElement('span');
  icon.className = 'attachment-type-icon';
  icon.textContent = ext || 'FILE';
  const meta = document.createElement('span');
  meta.className = 'attachment-meta';
  const filename = document.createElement('strong');
  filename.textContent = attachment.name || 'Файл';
  const size = document.createElement('small');
  size.textContent = formatBytes(attachment.size || 0);
  meta.append(filename, size);
  const arrow = document.createElement('span');
  arrow.className = 'attachment-open-icon';
  arrow.textContent = '↗';
  button.append(icon, meta, arrow);
  button.addEventListener('click', () => openAttachmentPreview(attachment));
  return button;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
