/**
 * Разметка сообщений (безопасно, через DOM-узлы, без innerHTML).
 *
 * Инлайн:
 *   **жирный**  *курсив*  _курсив_  ~~зачёркнутый~~
 *   ++подчёркнутый++  ^^верхний^^  ,,нижний,,
 *   `код`  ||спойлер||  ==выделение==
 *   [c:red]цвет[/c]  [c:#ff80ab]hex[/c]
 *   [текст](https://url) — ссылка как на Reddit
 *   авто-ссылки http(s):// и www.
 *
 * Блоки (с начала строки):
 *   > цитата
 *   - пункт   * пункт   • пункт  — маркированный список
 *   1. пункт  2) пункт           — нумерованный список
 */

const COLOR_NAMES = {
  red: '#e53935',
  green: '#43a047',
  blue: '#1e88e5',
  yellow: '#fdd835',
  orange: '#fb8c00',
  purple: '#8e24aa',
  pink: '#ff80ab',
  cyan: '#00acc1',
  white: '#f0f0f0',
  gray: '#9e9e9e',
  grey: '#9e9e9e',
  black: '#111111',
};

function resolveColor(token) {
  const raw = String(token || '').trim().toLowerCase();
  if (COLOR_NAMES[raw]) return COLOR_NAMES[raw];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  return null;
}

function isSafeUrl(href) {
  try {
    const u = new URL(href.startsWith('www.') ? `https://${href}` : href);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Правила инлайн-разметки: от длинных разделителей к коротким. */
const RULES = [
  {
    // [label](url) — markdown-ссылка (Reddit)
    open: /\[([^\]]+)\]\(([^)\s]+)\)/y,
    single: true,
    wrap: (_frag, openMatch) => {
      const label = openMatch[1];
      let href = openMatch[2];
      if (href.startsWith('www.')) href = `https://${href}`;
      if (!isSafeUrl(href)) {
        return document.createTextNode(openMatch[0]);
      }
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      return a;
    },
  },
  {
    open: /\[c:([^\]]+)\]/iy,
    close: /\[\/c\]/ig,
    wrap: (frag, openMatch) => {
      const color = resolveColor(openMatch[1]);
      const el = document.createElement('span');
      el.className = 'fmt-color';
      if (color) el.style.color = color;
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /\|\|/y,
    close: /\|\|/g,
    wrap: (frag) => {
      const el = document.createElement('span');
      el.className = 'fmt-spoiler';
      el.title = 'Нажми, чтобы показать';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.appendChild(frag);
      const reveal = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('revealed');
      };
      el.addEventListener('click', reveal);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') reveal(e);
      });
      return el;
    },
  },
  {
    open: /==/y,
    close: /==/g,
    wrap: (frag) => {
      const el = document.createElement('mark');
      el.className = 'fmt-mark';
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /\*\*/y,
    close: /\*\*/g,
    wrap: (frag) => {
      const el = document.createElement('strong');
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /~~/y,
    close: /~~/g,
    wrap: (frag) => {
      const el = document.createElement('s');
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /\+\+/y,
    close: /\+\+/g,
    wrap: (frag) => {
      const el = document.createElement('u');
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /\^\^/y,
    close: /\^\^/g,
    wrap: (frag) => {
      const el = document.createElement('sup');
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /,,/y,
    close: /,,/g,
    wrap: (frag) => {
      const el = document.createElement('sub');
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /`/y,
    close: /`/g,
    literal: true,
    wrap: (text) => {
      const el = document.createElement('code');
      el.className = 'fmt-code';
      el.textContent = text;
      return el;
    },
  },
  {
    open: /\*/y,
    close: /\*/g,
    wrap: (frag) => {
      const el = document.createElement('em');
      el.appendChild(frag);
      return el;
    },
  },
  {
    open: /_/y,
    close: /_/g,
    wrap: (frag) => {
      const el = document.createElement('em');
      el.appendChild(frag);
      return el;
    },
  },
];

const URL_RE = /https?:\/\/[^\s<]+|www\.[^\s<]+/gi;

function appendPlainWithLinks(container, text) {
  if (!text) return;
  URL_RE.lastIndex = 0;
  let last = 0;
  let match;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      container.appendChild(document.createTextNode(text.slice(last, match.index)));
    }
    let raw = match[0];
    let trailing = '';
    while (/[),.!?;:]$/.test(raw)) {
      trailing = raw.slice(-1) + trailing;
      raw = raw.slice(0, -1);
    }
    if (isSafeUrl(raw)) {
      const link = document.createElement('a');
      link.href = raw.startsWith('www.') ? `https://${raw}` : raw;
      link.textContent = raw;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.appendChild(link);
    } else {
      container.appendChild(document.createTextNode(match[0]));
      trailing = '';
    }
    if (trailing) container.appendChild(document.createTextNode(trailing));
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    container.appendChild(document.createTextNode(text.slice(last)));
  }
}

function findOpen(text, from) {
  let best = null;
  for (const rule of RULES) {
    rule.open.lastIndex = from;
    const m = rule.open.exec(text);
    if (!m || m.index !== from) continue;
    if (!rule.single && (rule.open.source === '\\*' || rule.open.source === '_') && from > 0) {
      const prev = text[from - 1];
      if (/\w/.test(prev)) continue;
    }
    if (!best || m[0].length > best.match[0].length) {
      best = { rule, match: m };
    }
  }
  return best;
}

function findClose(text, from, rule) {
  if (!rule.close) return null;
  // global, не sticky: ищем закрывающий маркер начиная с from
  rule.close.lastIndex = from;
  let m;
  while ((m = rule.close.exec(text)) !== null) {
    if (m.index < from) continue;
    if (rule.close.source === '\\*' || rule.close.source === '_') {
      const next = text[m.index + m[0].length];
      if (next && /\w/.test(next)) continue;
    }
    return m;
  }
  return null;
}

/** Инлайн-парсер для одного фрагмента текста (без блочных конструкций). */
function parseInline(text, start = 0, end = text.length) {
  const frag = document.createDocumentFragment();
  let i = start;
  while (i < end) {
    const open = findOpen(text, i);
    if (!open) {
      let next = end;
      for (let j = i + 1; j < end; j++) {
        if (findOpen(text, j)) {
          next = j;
          break;
        }
      }
      appendPlainWithLinks(frag, text.slice(i, next));
      i = next;
      continue;
    }

    const { rule, match: openMatch } = open;

    if (rule.single) {
      frag.appendChild(rule.wrap(null, openMatch));
      i = openMatch.index + openMatch[0].length;
      continue;
    }

    const contentStart = openMatch.index + openMatch[0].length;
    const closeMatch = findClose(text, contentStart, rule);
    if (!closeMatch || closeMatch.index >= end) {
      appendPlainWithLinks(frag, openMatch[0]);
      i = contentStart;
      continue;
    }

    const contentEnd = closeMatch.index;
    if (rule.literal) {
      frag.appendChild(rule.wrap(text.slice(contentStart, contentEnd), openMatch));
    } else {
      const inner = parseInline(text, contentStart, contentEnd);
      frag.appendChild(rule.wrap(inner, openMatch));
    }
    i = closeMatch.index + closeMatch[0].length;
  }
  return frag;
}

const BULLET_RE = /^\s*([-*•])\s+(.+)$/;
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.+)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

function tokenizeBlocks(text) {
  const lines = String(text).split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Блок кода: ```python ... ``` — содержимое не проходит через inline-разметку.
    const codeFence = line.match(/^\s*```([a-zA-Z0-9_+.-]*)\s*$/);
    if (codeFence) {
      const language = (codeFence[1] || 'plaintext').toLowerCase();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length && /^\s*```\s*$/.test(lines[i])) i += 1;
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const items = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        items.push(lines[i].match(QUOTE_RE)[1]);
        i += 1;
      }
      blocks.push({ type: 'quote', lines: items });
      continue;
    }

    if (BULLET_RE.test(line)) {
      const items = [];
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(lines[i].match(BULLET_RE)[2]);
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (ORDERED_RE.test(line)) {
      const items = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(lines[i].match(ORDERED_RE)[2]);
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const para = [];
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === '') break;
      if (QUOTE_RE.test(l) || BULLET_RE.test(l) || ORDERED_RE.test(l) || /^\s*```[a-zA-Z0-9_+.-]*\s*$/.test(l)) break;
      para.push(l);
      i += 1;
    }
    blocks.push({ type: 'p', lines: para });
  }

  return blocks;
}

function renderBlocks(blocks) {
  const frag = document.createDocumentFragment();

  for (const block of blocks) {
    if (block.type === 'code') {
      const pre = document.createElement('pre');
      pre.className = 'fmt-code-block';
      const code = document.createElement('code');
      const languageAliases = {
        web: 'html', js: 'javascript', ts: 'typescript', csharp: 'csharp',
        'c#': 'csharp', cpp: 'cpp', 'c++': 'cpp', py: 'python', shell: 'bash',
        sh: 'bash', ps: 'powershell', txt: 'plaintext', text: 'plaintext', md: 'markdown',
      };
      const normalizedLanguage = languageAliases[block.language] || block.language;
      if (normalizedLanguage) {
        // language-plaintext отключает автоопределение для обычного текста.
        code.className = `language-${normalizedLanguage}`;
      }
      code.textContent = block.code;
      pre.appendChild(code);
      frag.appendChild(pre);
      if (globalThis.hljs?.highlightElement) {
        try { globalThis.hljs.highlightElement(code); } catch (error) { console.warn('Не удалось подсветить код:', error); }
      }
    } else if (block.type === 'p') {
      const p = document.createElement('span');
      p.className = 'fmt-p';
      block.lines.forEach((line, idx) => {
        if (idx > 0) p.appendChild(document.createElement('br'));
        p.appendChild(parseInline(line));
      });
      frag.appendChild(p);
    } else if (block.type === 'quote') {
      const q = document.createElement('blockquote');
      q.className = 'fmt-quote';
      block.lines.forEach((line, idx) => {
        if (idx > 0) q.appendChild(document.createElement('br'));
        q.appendChild(parseInline(line));
      });
      frag.appendChild(q);
    } else if (block.type === 'ul') {
      const ul = document.createElement('ul');
      ul.className = 'fmt-list fmt-ul';
      for (const item of block.items) {
        const li = document.createElement('li');
        li.appendChild(parseInline(item));
        ul.appendChild(li);
      }
      frag.appendChild(ul);
    } else if (block.type === 'ol') {
      const ol = document.createElement('ol');
      ol.className = 'fmt-list fmt-ol';
      for (const item of block.items) {
        const li = document.createElement('li');
        li.appendChild(parseInline(item));
        ol.appendChild(li);
      }
      frag.appendChild(ol);
    }
  }

  return frag;
}

export function renderFormattedText(container, text) {
  container.textContent = '';
  if (text == null || text === '') return;
  const blocks = tokenizeBlocks(String(text));
  if (blocks.length === 0) return;
  container.appendChild(renderBlocks(blocks));
}

export const FORMAT_HELP = [
  '**жирный**  *курсив*  _курсив_',
  '~~зачёркнутый~~  ++подчёркнутый++',
  '^^верхний^^  ,,нижний,,',
  '`код`  ||спойлер||  ==выделение==',
  '[текст](https://example.com) — ссылка',
  '[c:red]цвет[/c]  [c:#ff80ab]hex[/c]',
  '> цитата',
  '- пункт списка   * тоже пункт',
  '1. нумерованный  2. пункт',
  'Блок кода: три обратные кавычки + язык (например python), код, затем три кавычки на отдельной строке.',
].join('\n');
