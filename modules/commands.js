/**
 * Система команд чата.
 *
 * Как добавить новую команду:
 *   registerCommand({
 *     name: 'mycmd',           // основное имя без слэша
 *     aliases: ['alias'],      // необязательные алиасы
 *     usage: '/mycmd [arg]',   // подсказка в панели
 *     description: 'Что делает',
 *     category: 'fun',         // fun | util | info
 *     // args — массив строк после имени команды
 *     // ctx: { user, raw, args, sendResult, replyLocal }
 *     async execute(ctx) { ... }
 *   });
 *
 * sendResult(text) — отправляет текст в общий чат (видят оба).
 * replyLocal(text) — показывает подсказку только у себя (тост/строка статуса).
 */

const commands = new Map(); // name/alias (lowercase) -> definition
const definitions = [];     // unique definitions in registration order

export function registerCommand(def) {
  if (!def?.name || typeof def.execute !== 'function') {
    throw new Error('Команда должна иметь name и execute');
  }
  const normalized = {
    name: def.name.toLowerCase(),
    aliases: (def.aliases || []).map(a => String(a).toLowerCase()),
    usage: def.usage || `/${def.name}`,
    description: def.description || '',
    category: def.category || 'util',
    execute: def.execute,
  };

  const keys = [normalized.name, ...normalized.aliases];
  for (const key of keys) {
    if (commands.has(key)) {
      console.warn(`Команда /${key} перезаписывается`);
    }
    commands.set(key, normalized);
  }
  definitions.push(normalized);
  return normalized;
}

export function getCommandList() {
  return definitions.slice();
}

export function findCommand(name) {
  if (!name) return null;
  return commands.get(String(name).toLowerCase()) || null;
}

/**
 * Разбор строки. Возвращает null, если это не команда.
 * Поддержка: /cmd, /cmd arg1 arg2, /cmd "quoted arg"
 */
export function parseCommandLine(text) {
  const trimmed = (text || '').trim();
  if (!trimmed.startsWith('/')) return null;

  const body = trimmed.slice(1);
  if (!body) return { name: '', args: [], raw: trimmed };

  const tokens = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  const name = (tokens.shift() || '').toLowerCase();
  return { name, args: tokens, raw: trimmed };
}

export async function tryExecuteCommand(text, { user, sendResult, replyLocal }) {
  const parsed = parseCommandLine(text);
  if (!parsed) return { handled: false };

  const cmd = findCommand(parsed.name);
  if (!cmd) {
    if (replyLocal) {
      replyLocal(`Неизвестная команда /${parsed.name || '?'}. Напиши /help`);
    }
    return { handled: true, ok: false };
  }

  try {
    await cmd.execute({
      user,
      raw: parsed.raw,
      args: parsed.args,
      sendResult,
      replyLocal,
      command: cmd,
    });
    return { handled: true, ok: true };
  } catch (error) {
    console.error('Ошибка команды', cmd.name, error);
    if (replyLocal) replyLocal(`Ошибка /${cmd.name}: ${error.message || error}`);
    return { handled: true, ok: false };
  }
}

// ---------------------------------------------------------------------------
// Встроенные команды
// ---------------------------------------------------------------------------

function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

registerCommand({
  name: 'roll',
  aliases: ['dice', 'кубик', 'd'],
  usage: '/roll [N] [раз]',
  description: 'Кубик от 1 до N (по умолчанию 6). Можно несколько бросков.',
  category: 'fun',
  async execute({ args, user, sendResult, replyLocal }) {
    let sides = 6;
    let count = 1;

    if (args[0] !== undefined) {
      const n = parseInt(args[0], 10);
      if (!Number.isFinite(n) || n < 2 || n > 1_000_000) {
        replyLocal?.('N должно быть целым числом от 2 до 1000000');
        return;
      }
      sides = n;
    }
    if (args[1] !== undefined) {
      const c = parseInt(args[1], 10);
      if (!Number.isFinite(c) || c < 1 || c > 20) {
        replyLocal?.('Число бросков — от 1 до 20');
        return;
      }
      count = c;
    }

    const rolls = Array.from({ length: count }, () => randInt(1, sides));
    const sum = rolls.reduce((a, b) => a + b, 0);
    const rollsText = rolls.join(', ');
    const body = count === 1
      ? `🎲 ${user} выбросил ${rolls[0]} (1–${sides})`
      : `🎲 ${user} выбросил [${rollsText}] = ${sum} (${count}×1–${sides})`;
    await sendResult(body);
  },
});

registerCommand({
  name: 'flip',
  aliases: ['coin', 'монетка'],
  usage: '/flip',
  description: 'Подбросить монетку: орёл или решка.',
  category: 'fun',
  async execute({ user, sendResult }) {
    const side = Math.random() < 0.5 ? 'орёл' : 'решка';
    await sendResult(`🪙 ${user}: ${side}`);
  },
});

registerCommand({
  name: 'random',
  aliases: ['rand', 'rnd'],
  usage: '/random [min] [max]',
  description: 'Случайное число. Без аргументов — 1–100, с одним — 1–N, с двумя — min–max.',
  category: 'fun',
  async execute({ args, user, sendResult, replyLocal }) {
    let min = 1;
    let max = 100;
    if (args.length === 1) {
      max = parseInt(args[0], 10);
      min = 1;
    } else if (args.length >= 2) {
      min = parseInt(args[0], 10);
      max = parseInt(args[1], 10);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      replyLocal?.('Нужны целые числа');
      return;
    }
    if (min > max) [min, max] = [max, min];
    if (max - min > 1_000_000_000) {
      replyLocal?.('Слишком большой диапазон');
      return;
    }
    const value = randInt(min, max);
    await sendResult(`🔢 ${user}: ${value} (${min}–${max})`);
  },
});

registerCommand({
  name: 'choose',
  aliases: ['pick', 'выбери'],
  usage: '/choose a | b | c',
  description: 'Случайно выбрать один вариант. Разделитель — | или запятая.',
  category: 'fun',
  async execute({ args, raw, user, sendResult, replyLocal }) {
    // Берём всё после имени команды и режем по | или ,
    const after = raw.replace(/^\/\S+\s*/, '');
    let options = after.split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    if (options.length < 2) {
      options = after.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    }
    if (options.length < 2) {
      replyLocal?.('Нужно минимум два варианта: /choose чай | кофе | какао');
      return;
    }
    const pick = options[randInt(0, options.length - 1)];
    await sendResult(`🎯 ${user} выбрал: ${pick}`);
  },
});

registerCommand({
  name: '8ball',
  aliases: ['ball', 'шар'],
  usage: '/8ball [вопрос]',
  description: 'Магический шар с ответом да/нет/может быть.',
  category: 'fun',
  async execute({ args, user, sendResult }) {
    const answers = [
      'Бесспорно', 'Определённо да', 'Без сомнений', 'Да',
      'Вероятнее всего', 'Хорошие перспективы', 'Знаки говорят — да',
      'Пока не ясно, попробуй ещё', 'Спроси позже', 'Лучше не говорить сейчас',
      'Сконцентрируйся и спроси снова', 'Не рассчитывай на это',
      'Мой ответ — нет', 'Перспективы не очень', 'Весьма сомнительно',
    ];
    const answer = answers[randInt(0, answers.length - 1)];
    const q = args.join(' ').trim();
    const prefix = q ? `«${q.slice(0, 120)}» → ` : '';
    await sendResult(`🎱 ${user}: ${prefix}${answer}`);
  },
});

registerCommand({
  name: 'me',
  aliases: ['action'],
  usage: '/me действие',
  description: 'Отыгрыш действия от третьего лица.',
  category: 'fun',
  async execute({ args, user, sendResult, replyLocal }) {
    const action = args.join(' ').trim();
    if (!action) {
      replyLocal?.('Пример: /me танцует');
      return;
    }
    await sendResult(`* ${user} ${action}`);
  },
});

registerCommand({
  name: 'shrug',
  usage: '/shrug [текст]',
  description: 'Классический ¯\\_(ツ)_/¯',
  category: 'fun',
  async execute({ args, sendResult }) {
    const extra = args.join(' ').trim();
    await sendResult(extra ? `${extra} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯');
  },
});

registerCommand({
  name: 'tableflip',
  aliases: ['flip_table'],
  usage: '/tableflip',
  description: '(╯°□°)╯︵ ┻━┻',
  category: 'fun',
  async execute({ sendResult }) {
    await sendResult('(╯°□°)╯︵ ┻━┻');
  },
});

registerCommand({
  name: 'unflip',
  usage: '/unflip',
  description: '┬─┬ ノ( ゜-゜ノ)',
  category: 'fun',
  async execute({ sendResult }) {
    await sendResult('┬─┬ ノ( ゜-゜ノ)');
  },
});

registerCommand({
  name: 'time',
  aliases: ['время', 'now'],
  usage: '/time',
  description: 'Текущее локальное время отправителя.',
  category: 'info',
  async execute({ user, sendResult }) {
    const now = new Date();
    const formatted = now.toLocaleString('ru-RU', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    await sendResult(`🕒 ${user}: ${formatted}`);
  },
});

registerCommand({
  name: 'uuid',
  aliases: ['guid'],
  usage: '/uuid',
  description: 'Сгенерировать UUID v4.',
  category: 'util',
  async execute({ sendResult }) {
    const id = globalThis.crypto?.randomUUID?.() ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    await sendResult(`🪪 ${id}`);
  },
});

registerCommand({
  name: 'len',
  aliases: ['length', 'strlen'],
  usage: '/len текст',
  description: 'Длина текста (символы и слова).',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /len привет мир');
      return;
    }
    const chars = [...text].length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    await sendResult(`📏 ${chars} симв., ${words} слов`);
  },
});

registerCommand({
  name: 'reverse',
  aliases: ['rev'],
  usage: '/reverse текст',
  description: 'Перевернуть текст задом наперёд.',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /reverse кот');
      return;
    }
    await sendResult([...text].reverse().join(''));
  },
});

registerCommand({
  name: 'upper',
  usage: '/upper текст',
  description: 'ВЕРХНИЙ РЕГИСТР',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /upper громко');
      return;
    }
    await sendResult(text.toLocaleUpperCase('ru-RU'));
  },
});

registerCommand({
  name: 'lower',
  usage: '/lower текст',
  description: 'нижний регистр',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /lower ТИХО');
      return;
    }
    await sendResult(text.toLocaleLowerCase('ru-RU'));
  },
});

registerCommand({
  name: 'format',
  aliases: ['fmt', 'разметка'],
  usage: '/format',
  description: 'Справка по форматированию текста в сообщениях.',
  category: 'info',
  async execute({ replyLocal }) {
    const { FORMAT_HELP } = await import('./format.js');
    replyLocal?.(FORMAT_HELP);
  },
});

registerCommand({
  name: 'rps',
  aliases: ['кнб'],
  usage: '/rps [камень|ножницы|бумага]',
  description: 'Камень-ножницы-бумага против бота.',
  category: 'fun',
  async execute({ args, user, sendResult, replyLocal }) {
    const map = {
      rock: 'камень', камень: 'камень', r: 'камень', к: 'камень',
      paper: 'бумага', бумага: 'бумага', p: 'бумага', б: 'бумага',
      scissors: 'ножницы', ножницы: 'ножницы', s: 'ножницы', н: 'ножницы',
    };
    const choice = map[(args[0] || '').toLowerCase()];
    if (!choice) {
      replyLocal?.('Выбери: /rps камень | ножницы | бумага');
      return;
    }
    const options = ['камень', 'ножницы', 'бумага'];
    const bot = options[Math.floor(Math.random() * 3)];
    const beats = { камень: 'ножницы', ножницы: 'бумага', бумага: 'камень' };
    let outcome = 'ничья';
    if (beats[choice] === bot) outcome = 'победа';
    else if (beats[bot] === choice) outcome = 'поражение';
    const emoji = { камень: '🪨', ножницы: '✂️', бумага: '📄' };
    await sendResult(`🎮 ${user}: ${emoji[choice]}${choice} vs ${emoji[bot]}${bot} → ${outcome}`);
  },
});

registerCommand({
  name: 'calc',
  aliases: ['math', 'посчитай'],
  usage: '/calc выражение',
  description: 'Простой калькулятор (+ − * / % ^ и скобки).',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const expr = args.join(' ').trim();
    if (!expr) {
      replyLocal?.('Пример: /calc (2+3)*4');
      return;
    }
    if (!/^[0-9+\-*/%^().\s]+$/.test(expr)) {
      replyLocal?.('Только цифры и + - * / % ^ ( )');
      return;
    }
    try {
      const normalized = expr.replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${normalized})`)();
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        replyLocal?.('Не удалось вычислить');
        return;
      }
      await sendResult(`🧮 ${expr} = ${value}`);
    } catch {
      replyLocal?.('Ошибка в выражении');
    }
  },
});

registerCommand({
  name: 'mock',
  aliases: ['spongebob'],
  usage: '/mock текст',
  description: 'ЧeReДoВаНиЕ рЕгИсТрА.',
  category: 'fun',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /mock ну да конечно');
      return;
    }
    let upper = false;
    const out = [...text].map(ch => {
      if (!/\p{L}/u.test(ch)) return ch;
      upper = !upper;
      return upper ? ch.toLocaleUpperCase('ru-RU') : ch.toLocaleLowerCase('ru-RU');
    }).join('');
    await sendResult(out);
  },
});

registerCommand({
  name: 'clap',
  usage: '/clap текст',
  description: 'Слова 👏 через 👏 хлопки.',
  category: 'fun',
  async execute({ args, sendResult, replyLocal }) {
    const words = args.filter(Boolean);
    if (!words.length) {
      replyLocal?.('Пример: /clap это важно');
      return;
    }
    await sendResult(words.join(' 👏 '));
  },
});

registerCommand({
  name: 'whoami',
  aliases: ['я'],
  usage: '/whoami',
  description: 'Твой ник в чате.',
  category: 'info',
  async execute({ user, replyLocal }) {
    replyLocal?.(`Ты: ${user}`);
  },
});

registerCommand({
  name: 'echo',
  aliases: ['say'],
  usage: '/echo текст',
  description: 'Отправить текст как есть (с разметкой).',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /echo **привет**');
      return;
    }
    await sendResult(text);
  },
});

registerCommand({
  name: 'binary',
  aliases: ['bin'],
  usage: '/binary текст',
  description: 'Текст → двоичный код.',
  category: 'util',
  async execute({ args, sendResult, replyLocal }) {
    const text = args.join(' ');
    if (!text) {
      replyLocal?.('Пример: /binary hi');
      return;
    }
    const bin = [...text].map(ch => ch.codePointAt(0).toString(2).padStart(8, '0')).join(' ');
    await sendResult(bin.length > 500 ? bin.slice(0, 500) + '…' : bin);
  },
});

registerCommand({
  name: 'coinflip',
  aliases: ['cf'],
  usage: '/coinflip [раз]',
  description: 'Серия подбрасываний монетки.',
  category: 'fun',
  async execute({ args, user, sendResult, replyLocal }) {
    let count = 1;
    if (args[0] !== undefined) {
      count = parseInt(args[0], 10);
      if (!Number.isFinite(count) || count < 1 || count > 30) {
        replyLocal?.('Число бросков 1–30');
        return;
      }
    }
    const results = Array.from({ length: count }, () => Math.random() < 0.5 ? 'О' : 'Р');
    const o = results.filter(x => x === 'О').length;
    const body = count === 1
      ? `🪙 ${user}: ${results[0] === 'О' ? 'орёл' : 'решка'}`
      : `🪙 ${user}: ${results.join(' ')} (орлов ${o}, решек ${count - o})`;
    await sendResult(body);
  },
});

registerCommand({
  name: 'offline',
  aliases: ['away', 'afk', 'оффлайн'],
  usage: '/offline',
  description: 'Оффлайн-режим (скрыть чат, статус оффлайн). Переключение: Ctrl+Alt+O.',
  category: 'info',
  async execute({ replyLocal }) {
    document.dispatchEvent(new CustomEvent('chat:away', { detail: { away: true } }));
    replyLocal?.('Оффлайн-режим. Переключить режим: Ctrl+Alt+O');
  },
});

registerCommand({
  name: 'online',
  aliases: ['back', 'онлайн'],
  usage: '/online',
  description: 'Выйти из оффлайн-режима (если вдруг вызвали из консоли).',
  category: 'info',
  async execute({ replyLocal }) {
    document.dispatchEvent(new CustomEvent('chat:away', { detail: { away: false } }));
    replyLocal?.('Снова онлайн');
  },
});

registerCommand({
  name: 'help',


  aliases: ['commands', 'cmds', 'помощь'],
  usage: '/help [команда]',
  description: 'Список команд или справка по одной.',
  category: 'info',
  async execute({ args, replyLocal, sendResult }) {
    if (args[0]) {
      const cmd = findCommand(args[0].replace(/^\//, ''));
      if (!cmd) {
        replyLocal?.(`Команда /${args[0]} не найдена`);
        return;
      }
      replyLocal?.(`${cmd.usage} — ${cmd.description}`);
      return;
    }
    // Локальная подсказка, чтобы не спамить чат
    const lines = definitions
      .map(c => `${c.usage} — ${c.description}`)
      .join('\n');
    replyLocal?.(`Команды:\n${lines}\n\nПодробнее — панель справа или /help имя`);
  },
});

registerCommand({
  name: 'ping',
  usage: '/ping',
  description: 'Проверка, что клиент жив (локально).',
  category: 'info',
  async execute({ replyLocal }) {
    const t0 = performance.now();
    // микро-задержка, чтобы показать «латентность» UI
    await Promise.resolve();
    const ms = Math.round(performance.now() - t0);
    replyLocal?.(`pong · ${ms} ms`);
  },
});

// ---------------------------------------------------------------------------
// UI панели команд
// ---------------------------------------------------------------------------

const CATEGORY_LABELS = {
  fun: 'Развлечения',
  util: 'Утилиты',
  info: 'Инфо',
};

function showLocalToast(text) {
  let toast = document.getElementById('commandToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'commandToast';
    toast.className = 'command-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('visible');
  clearTimeout(showLocalToast._timer);
  showLocalToast._timer = setTimeout(() => {
    toast.classList.remove('visible');
  }, Math.min(8000, 2000 + text.length * 30));
}

export function replyLocalDefault(text) {
  showLocalToast(text);
}


/**
 * Подсказка команд над полем ввода.
 * Показывать только когда строка начинается с / и нет режима ответа.
 */
export function initCommandAutocomplete(messageInput, { isReplyActive } = {}) {
  if (!messageInput) return { update() {}, hide() {} };

  let box = document.getElementById('commandSuggest');
  if (!box) {
    box = document.createElement('div');
    box.id = 'commandSuggest';
    box.className = 'command-suggest hidden';
    box.setAttribute('role', 'listbox');
    const area = messageInput.closest('.input-area') || messageInput.parentElement;
    area.appendChild(box);
  }

  let items = [];
  let activeIndex = -1;

  function hide() {
    box.classList.add('hidden');
    box.innerHTML = '';
    items = [];
    activeIndex = -1;
  }

  function select(index) {
    const cmd = items[index];
    if (!cmd) return;
    const insert = cmd.usage.includes('[') ? `/${cmd.name} ` : `/${cmd.name}`;
    messageInput.value = insert;
    messageInput.focus();
    const len = messageInput.value.length;
    messageInput.setSelectionRange(len, len);
    messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    hide();
  }

  function render(list) {
    items = list;
    activeIndex = list.length ? 0 : -1;
    box.innerHTML = '';
    if (!list.length) {
      hide();
      return;
    }
    list.forEach((cmd, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'command-suggest-item' + (i === 0 ? ' active' : '');
      row.setAttribute('role', 'option');
      row.innerHTML = `
        <span class="csi-name">/${escapeHtml(cmd.name)}</span>
        <span class="csi-usage">${escapeHtml(cmd.usage)}</span>
        <span class="csi-desc">${escapeHtml(cmd.description)}</span>`;
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        select(i);
      });
      box.appendChild(row);
    });
    box.classList.remove('hidden');
  }

  function update() {
    if (typeof isReplyActive === 'function' && isReplyActive()) {
      hide();
      return;
    }
    const value = messageInput.value;
    if (!value.startsWith('/') || value.includes('\n')) {
      hide();
      return;
    }
    // только пока набираем имя команды (до первого пробела)
    const body = value.slice(1);
    if (/\s/.test(body)) {
      hide();
      return;
    }
    const q = body.toLowerCase();
    const matches = [];
    const seen = new Set();
    for (const cmd of definitions) {
      if (seen.has(cmd.name)) continue;
      const hay = [cmd.name, ...cmd.aliases];
      if (!q || hay.some(a => a.startsWith(q))) {
        seen.add(cmd.name);
        matches.push(cmd);
      }
      if (matches.length >= 8) break;
    }
    render(matches);
  }

  function onKeyDown(e) {
    if (box.classList.contains('hidden') || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      [...box.children].forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      [...box.children].forEach((el, i) => el.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      select(activeIndex);
    } else if (e.key === 'Tab' && activeIndex >= 0) {
      e.preventDefault();
      select(activeIndex);
    } else if (e.key === 'Escape') {
      hide();
    }
  }

  messageInput.addEventListener('input', update);
  messageInput.addEventListener('keydown', onKeyDown);
  messageInput.addEventListener('blur', () => setTimeout(hide, 150));

  return { update, hide };
}

export function initCommandsPanel({ onInsert } = {}) {
  const panel = document.getElementById('commandsPanel');
  const list = document.getElementById('commandsList');
  const search = document.getElementById('commandsSearch');
  const toggleBtn = document.getElementById('commandsToggleBtn');
  const closeBtn = document.getElementById('commandsCloseBtn');
  if (!panel || !list) return;

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    list.innerHTML = '';

    const groups = new Map();
    for (const cmd of definitions) {
      const hay = `${cmd.name} ${cmd.aliases.join(' ')} ${cmd.usage} ${cmd.description}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      if (!groups.has(cmd.category)) groups.set(cmd.category, []);
      groups.get(cmd.category).push(cmd);
    }

    if (groups.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'commands-empty';
      empty.textContent = 'Ничего не найдено';
      list.appendChild(empty);
      return;
    }

    for (const [category, cmds] of groups) {
      const heading = document.createElement('div');
      heading.className = 'commands-category';
      heading.textContent = CATEGORY_LABELS[category] || category;
      list.appendChild(heading);

      for (const cmd of cmds) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'commands-item';
        item.innerHTML = `
          <span class="commands-item-usage">${escapeHtml(cmd.usage)}</span>
          <span class="commands-item-desc">${escapeHtml(cmd.description)}</span>
        `;
        item.title = cmd.aliases.length
          ? `Также: ${cmd.aliases.map(a => '/' + a).join(', ')}`
          : cmd.usage;
        item.addEventListener('click', () => {
          const insert = cmd.usage.includes('[') ? `/${cmd.name} ` : `/${cmd.name}`;
          if (typeof onInsert === 'function') onInsert(insert);
          // На мобилке закрываем панель после выбора
          if (window.matchMedia('(max-width: 900px)').matches) {
            setPanelOpen(false);
          }
        });
        list.appendChild(item);
      }
    }
  }

  function setPanelOpen(open) {
    panel.classList.toggle('open', open);
    panel.classList.remove('hidden'); // не используем глобальный .hidden — ломает drawer
    document.body.classList.toggle('commands-panel-open', open);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && search) {
      setTimeout(() => search.focus(), 50);
    }
  }

  // Панель команд закрыта по умолчанию и на desktop, и на mobile.
  setPanelOpen(false);

  render();
  search?.addEventListener('input', () => render(search.value));
  toggleBtn?.addEventListener('click', () => {
    const open = !panel.classList.contains('open');
    setPanelOpen(open);
    if (open) panel.classList.remove('hidden');
  });
  closeBtn?.addEventListener('click', () => setPanelOpen(false));

  // Backdrop on mobile
  panel.addEventListener('click', (e) => {
    if (e.target === panel && window.matchMedia('(max-width: 900px)').matches) {
      setPanelOpen(false);
    }
  });

  return { render, setPanelOpen };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
