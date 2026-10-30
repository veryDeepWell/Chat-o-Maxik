/**
 * Плавающая панель форматирования при выделении текста в поле ввода.
 */

const ACTIONS = [
  { id: 'bold', label: 'B', title: 'Жирный ** **', wrap: ['**', '**'], style: 'font-weight:700' },
  { id: 'italic', label: 'I', title: 'Курсив * *', wrap: ['*', '*'], style: 'font-style:italic' },
  { id: 'underline', label: 'U', title: 'Подчёркнутый ++ ++', wrap: ['++', '++'], style: 'text-decoration:underline' },
  { id: 'strike', label: 'S', title: 'Зачёркнутый ~~ ~~', wrap: ['~~', '~~'], style: 'text-decoration:line-through' },
  { id: 'code', label: '</>', title: 'Блок кода с подсветкой синтаксиса', custom: 'code' },
  { id: 'spoiler', label: '||', title: 'Спойлер || ||', wrap: ['||', '||'] },
  { id: 'mark', label: '==', title: 'Выделение == ==', wrap: ['==', '=='] },
  { id: 'sup', label: 'x²', title: 'Верхний индекс ^^ ^^', wrap: ['^^', '^^'] },
  { id: 'sub', label: 'x₂', title: 'Нижний индекс ,, ,,', wrap: [',,', ',,'] },
  { id: 'quote', label: '❝', title: 'Цитата >', linePrefix: '> ' },
  { id: 'ul', label: '•', title: 'Список -', linePrefix: '- ' },
  { id: 'ol', label: '1.', title: 'Нумерованный список', linePrefix: '1. ' },
  { id: 'link', label: '🔗', title: 'Ссылка [текст](url)', custom: 'link' },
  { id: 'color', label: '🎨', title: 'Цвет [c:…][/c]', custom: 'color' },
];

const COLORS = ['red', 'green', 'blue', 'orange', 'purple', 'pink', 'cyan', 'yellow', 'white', 'gray'];

function wrapSelection(textarea, before, after) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  textarea.value = next;
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  textarea.focus();
  textarea.setSelectionRange(cursorStart, cursorEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function prefixLines(textarea, prefix) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  // расширяем до целых строк
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const updated = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : prefix + line))
    .join('\n');
  textarea.value = value.slice(0, lineStart) + updated + value.slice(lineEnd);
  textarea.focus();
  textarea.setSelectionRange(lineStart, lineStart + updated.length);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyLink(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || 'текст';
  const url = window.prompt('URL ссылки:', 'https://');
  if (!url) return;
  const insert = `[${selected}](${url.trim()})`;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + insert + value.slice(end);
  textarea.focus();
  textarea.setSelectionRange(start, start + insert.length);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyColor(textarea, color) {
  wrapSelection(textarea, `[c:${color}]`, '[/c]');
}

export function initFormatToolbar(textarea) {
  if (!textarea) return;

  let bar = document.getElementById('formatToolbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'formatToolbar';
    bar.className = 'format-toolbar hidden';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Форматирование');
    document.body.appendChild(bar);
  }

  let colorMenu = null;
  let codeMenu = null;

  const CODE_LANGUAGES = [
    ['plaintext', 'Обычный текст'], ['html', 'HTML'], ['css', 'CSS'],
    ['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['json', 'JSON'],
    ['python', 'Python'], ['csharp', 'C#'], ['cpp', 'C++'], ['c', 'C'],
    ['java', 'Java'], ['go', 'Go'], ['rust', 'Rust'], ['sql', 'SQL'],
    ['bash', 'Bash'], ['powershell', 'PowerShell'], ['php', 'PHP'],
    ['ruby', 'Ruby'], ['kotlin', 'Kotlin'], ['swift', 'Swift'], ['lua', 'Lua'],
    ['xml', 'XML'], ['yaml', 'YAML'], ['markdown', 'Markdown'], ['diff', 'Diff'],
  ];

  function buildBar() {
    bar.innerHTML = '';
    for (const action of ACTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'format-toolbar-btn';
      btn.title = action.title;
      btn.textContent = action.label;
      if (action.style) btn.setAttribute('style', action.style);
      btn.addEventListener('mousedown', (e) => {
        // не снимаем выделение с textarea
        e.preventDefault();
        e.stopPropagation();
        if (action.custom === 'link') {
          applyLink(textarea);
          hide();
          return;
        }
        if (action.custom === 'color') {
          toggleColorMenu(btn);
          return;
        }
        if (action.custom === 'code') {
          toggleCodeMenu(btn);
          return;
        }
        if (action.linePrefix) {
          prefixLines(textarea, action.linePrefix);
        } else if (action.wrap) {
          wrapSelection(textarea, action.wrap[0], action.wrap[1]);
        }
        hide();
      });
      bar.appendChild(btn);
    }
  }

  function toggleCodeMenu(anchorBtn) {
    if (codeMenu) {
      codeMenu.remove();
      codeMenu = null;
      return;
    }
    colorMenu?.remove();
    colorMenu = null;
    codeMenu = document.createElement('div');
    codeMenu.className = 'format-code-menu';

    const languageLabel = document.createElement('label');
    languageLabel.textContent = 'Язык';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Язык программирования');
    CODE_LANGUAGES.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = 'javascript';

    const insertButton = document.createElement('button');
    insertButton.type = 'button';
    insertButton.className = 'format-code-insert';
    insertButton.textContent = 'Вставить блок';
    insertButton.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const original = textarea.value;
      const selected = original.slice(start, end);
      const language = select.value;
      // Fence должны стоять на отдельных строках даже если выбрали слово внутри абзаца.
      const lead = start > 0 && original[start - 1] !== '\n' ? '\n' : '';
      const trail = end < original.length && original[end] !== '\n' ? '\n' : '';
      const fenced = `${lead}\`\`\`${language}\n${selected}\n\`\`\`${trail}`;
      textarea.value = original.slice(0, start) + fenced + original.slice(end);
      textarea.focus();
      const codeStart = start + lead.length + language.length + 4;
      textarea.setSelectionRange(codeStart, codeStart + selected.length);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      hide();
    });
    codeMenu.append(languageLabel, select, insertButton);
    bar.appendChild(codeMenu);
  }

  function toggleColorMenu(anchorBtn) {
    if (colorMenu) {
      colorMenu.remove();
      colorMenu = null;
      return;
    }
    colorMenu = document.createElement('div');
    colorMenu.className = 'format-color-menu';
    for (const color of COLORS) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'format-color-swatch';
      sw.title = color;
      sw.style.background = color === 'white' ? '#f0f0f0' : color;
      sw.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyColor(textarea, color);
        colorMenu?.remove();
        colorMenu = null;
        hide();
      });
      colorMenu.appendChild(sw);
    }
    bar.appendChild(colorMenu);
  }

  function hide() {
    bar.classList.add('hidden');
    colorMenu?.remove();
    colorMenu = null;
    codeMenu?.remove();
    codeMenu = null;
  }

  function positionBar() {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end || document.activeElement !== textarea) {
      hide();
      return;
    }

    // Приблизительная позиция над полем ввода (textarea не даёт rect выделения)
    const rect = textarea.getBoundingClientRect();
    const area = textarea.closest('.input-area')?.getBoundingClientRect() || rect;

    bar.classList.remove('hidden');
    // измеряем после показа
    const barRect = bar.getBoundingClientRect();
    let left = rect.left + (rect.width - barRect.width) / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - barRect.width - 8));
    let top = area.top - barRect.height - 8;
    if (top < 8) top = area.top + 8;

    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  }

  function onSelectionMaybe() {
    // небольшой defer, чтобы selection обновился после mouseup
    requestAnimationFrame(() => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end && document.activeElement === textarea) {
        positionBar();
      } else {
        hide();
      }
    });
  }

  buildBar();

  textarea.addEventListener('mouseup', onSelectionMaybe);
  textarea.addEventListener('keyup', (e) => {
    if (e.shiftKey || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key.startsWith('Home') ||
        e.key.startsWith('End')) {
      onSelectionMaybe();
    }
  });
  textarea.addEventListener('blur', () => {
    // delay: клик по кнопке toolbar идёт через mousedown preventDefault
    setTimeout(() => {
      if (!bar.contains(document.activeElement)) hide();
    }, 150);
  });
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  return { hide, refresh: onSelectionMaybe };
}
