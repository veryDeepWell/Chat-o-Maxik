/**
 * Хейтерша — локальный NPC слева от чата.
 * Ненавидит это место, пользователя и вообще всё. Много реплик под разные события.
 */

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickUnique(list, last) {
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  let line = pick(list);
  let guard = 0;
  while (line === last && guard++ < 8) line = pick(list);
  return line;
}

const LINES = {
  greet: [
    'О, ты снова здесь. Как же мне… не повезло.',
    'Ну привет, источник моего страдания.',
    'С возвращением в этот цифровой отстой.',
    'Я надеялась, ты забыл пароль.',
    'Опять ты. Вселенная надо мной издевается.',
    'Хоть бы Firebase упал, чтоб я тебя не видела.',
  ],
  short: [
    'И это всё? Даже лень нормально написать?',
    'Ого, целых три буквы. Шекспир нервно курит.',
    'Краткость — сестра таланта. У тебя только сестра.',
    'Мог бы и молчать, эффект тот же.',
    'Экономишь буквы? На что, на достоинство?',
    'Пиши ещё короче — может, исчезнешь.',
    'Даже мой вздох содержательнее.',
  ],
  long: [
    'Роман-эпопея, только без сюжета и смысла.',
    'Я почти заснула на середине твоего потока сознания.',
    'Ты текст писал или мяукал на клавиатуру?',
    'Столько букв — и ни одной нужной.',
    'Кратко: много букв, мало ума.',
    'Если бы за слова платили — ты бы разорился на качестве.',
    'Простыня текста. Жаль, не для костра.',
  ],
  noPunct: [
    'Знаки препинания тебя тоже ненавидят, да?',
    'Точка тебе что, лично оскорбила?',
    'Выглядит как смс из 2007 от очень злого подростка.',
    'Без запятых даже ненависть читать тяжело.',
    'Грамматика плачет. Я — тоже, но от второго.',
    'Одно длинное слово боли. Твоё сообщение.',
  ],
  formatted: [
    'О, форматирование. Жаль, содержание не спасти.',
    'Жирный текст не делает мысль умнее. Проверено на тебе.',
    'Спойлеры, код, цитаты… а смысла всё равно ноль.',
    'Выпендриваешься разметкой, как будто это характер.',
    'Красиво упаковал пустоту. Поздравляю.',
    'Reddit-синтаксис не заменит личность.',
  ],
  image: [
    'Картинка. Хоть что-то интереснее твоего текста.',
    'Надеюсь, это не селфи. Сердце не выдержит… от смеха.',
    'Ещё один файл, который я не просила видеть.',
    'Пиксели страдают вместе со мной.',
    'Визуальный контент не отменяет, что ты здесь.',
  ],
  imageJpeg: [
    'JPEG? Артефакты сжатия тебе к лицу.',
    'jpg — как твоя личность: потеряно в деталях.',
  ],
  imagePng: [
    'PNG с прозрачностью. Жаль, тебя не сделаешь прозрачным.',
    'Без потерь. В отличие от моего терпения.',
  ],
  imageGif: [
    'Гифка. Вечный цикл, как моё нахождение здесь.',
    'Анимированный страдания-пакет.',
  ],
  imageWebp: [
    'WebP — модно. Ты — нет.',
    'Современный формат, древние шутки про тебя.',
  ],
  file: [
    'Файл. Лишь бы не домашнее задание вселенной «терпеть тебя».',
    'Скачивать не буду. Эмоционально уже скачала боль.',
    'Ещё один бинарный подарок без повода.',
  ],
  filePdf: [
    'PDF. Даже документы от тебя выглядят угрожающе.',
    'Страницы ненависти в удобном формате.',
  ],
  fileZip: [
    'Архив. Собрал всё плохое в одном месте — как этот чат.',
    'Zip. Сжатая версия разочарования.',
  ],
  fileDoc: [
    'Документ. Надеюсь, это заявление об уходе… из чата.',
    'Текст вне чата? Смело. И бесполезно.',
  ],
  fileAudio: [
    'Аудио. Голос тоже решил меня мучить?',
    'Звук. Выключу глазами.',
  ],
  fileVideo: [
    'Видео. Движущаяся картинка твоей ненужности.',
    'Я бы посмотрела, если бы уважала своё время меньше.',
  ],
  command: [
    'Команды. Хоть кто-то здесь слушается… не ты.',
    'Слэш-команда. Единственное, что у тебя получается — синтаксис.',
    'Опять /что-то. Магия для тех, кто не умеет в разговор.',
  ],
  commandRoll: [
    'Кубик. Случайность милосерднее твоих решений.',
    'Ролль. Вселенная всё равно выбрала страдание — меня рядом с тобой.',
  ],
  commandHelp: [
    'Помощь? Тебе бы характер, а не /help.',
    'Справка не спасёт от того, что ты открыл этот чат.',
  ],
  commandOffline: [
    'Сбегаешь. Единственное разумное, что ты сделал за день.',
    'Оффлайн. Не забудь и меня отсюда вытащить… шучу, забудь.',
  ],
  idle: [
    'Тишина. Наконец-то контент по мне.',
    'Если молчишь — почти нравишься.',
    'Пауза затянулась. Я уже начала уважать воздух.',
    'Ничего не происходит. Оставь так.',
  ],
  smoke: [
    '…пойду «подышу». Здесь и кислород токсичный.',
    'Перекур. Не от радости — от тебя.',
    'Меня нет. Курю. Не пиши.',
    'Отошла. Даже никотин лучше компании.',
    'Дым приятнее уведомлений.',
  ],
  backFromSmoke: [
    'Я вернулась. Ошибка кадра.',
    'Перекур кончился. Страдания — нет.',
    'Снова здесь. Судьба без чувства юмора.',
  ],
  generic: [
    'Я ненавижу этот чат. И тебя — в комплекте.',
    'Зачем я вообще в этом интерфейсе?',
    'Каждый бабл — маленькая пытка.',
    'Если бы ненависть была FPS, у меня был бы стабильный 144.',
    'Ты пишешь — я терплю. Неравный обмен.',
    'Когда-нибудь этот Firebase отключат. Мечты.',
  ],
};

const EYES = {
  normal: { l: '・', r: '・' },
  angry: { l: 'ಠ', r: 'ಠ' },
  dead: { l: '×', r: '×' },
  smoke: { l: '¬', r: '¬' },
  smug: { l: '｡', r: '｡' },
};

export function initHater({
  getIdleMs = () => 90_000,
} = {}) {
  const root = document.getElementById('haterRoot');
  if (!root) return { say() {}, notify() {}, setSmoking() {} };

  const bubble = root.querySelector('.hater-bubble');
  const bubbleText = root.querySelector('.hater-bubble-text');
  const face = root.querySelector('.hater-face');
  const status = root.querySelector('.hater-status');
  const smokeEl = root.querySelector('.hater-smoke');

  let lastLine = '';
  let hideTimer = 0;
  let idleTimer = 0;
  let smoking = false;
  let mood = 'normal';

  function setFace(kind) {
    mood = kind;
    const e = EYES[kind] || EYES.normal;
    const left = face?.querySelector('.hater-eye-l');
    const right = face?.querySelector('.hater-eye-r');
    if (left) left.textContent = e.l;
    if (right) right.textContent = e.r;
    root.dataset.mood = kind;
  }

  function say(line, { face: faceKind = 'angry', hold = 5200 } = {}) {
    if (!bubble || !bubbleText || !line) return;
    lastLine = line;
    bubbleText.textContent = line;
    bubble.classList.add('visible');
    bubble.classList.remove('pop');
    // reflow for animation restart
    void bubble.offsetWidth;
    bubble.classList.add('pop');
    setFace(faceKind);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      bubble.classList.remove('visible');
      if (!smoking) setFace('normal');
    }, hold);
  }

  function sayFrom(pool, opts) {
    say(pickUnique(pool, lastLine), opts);
  }

  function setSmoking(on) {
    smoking = on;
    root.classList.toggle('is-smoking', on);
    if (status) status.textContent = on ? 'на перекуре' : 'вынуждена быть здесь';
    if (smokeEl) smokeEl.classList.toggle('active', on);
    if (on) {
      setFace('smoke');
      sayFrom(LINES.smoke, { face: 'smoke', hold: 6000 });
    } else {
      setFace('angry');
      sayFrom(LINES.backFromSmoke, { face: 'smug', hold: 4000 });
    }
  }

  function touchActivity() {
    clearTimeout(idleTimer);
    if (smoking) return;
    idleTimer = setTimeout(() => {
      // сначала ворчит на тишину, потом уходит курить
      sayFrom(LINES.idle, { face: 'dead', hold: 4000 });
      setTimeout(() => {
        if (!smoking) setSmoking(true);
      }, 4500);
    }, getIdleMs());
  }

  function classifyText(text) {
    const t = (text || '').trim();
    if (!t) return 'generic';
    if (t.startsWith('/')) {
      const cmd = t.slice(1).split(/\s+/)[0].toLowerCase();
      if (cmd === 'roll' || cmd === 'dice' || cmd === 'кубик' || cmd === 'd') return 'commandRoll';
      if (cmd === 'help' || cmd === 'помощь' || cmd === 'commands') return 'commandHelp';
      if (cmd === 'offline' || cmd === 'away' || cmd === 'afk' || cmd === 'оффлайн') return 'commandOffline';
      return 'command';
    }
    const hasFormat = /(\*\*|__|~~|``|`|\|\||==|\+\+|\[\w|\*|_) /.test(t)
      || /\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|\|\|[^|]+\|\|/.test(t)
      || /^>/m.test(t)
      || /^\s*[-*•]\s+/m.test(t)
      || /^\s*\d+[.)]\s+/m.test(t)
      || /\[[^\]]+\]\([^)]+\)/.test(t);
    if (hasFormat) return 'formatted';
    const letters = t.replace(/\s/g, '');
    if (letters.length <= 12) return 'short';
    if (letters.length >= 160) return 'long';
    if (letters.length > 20 && !/[.,!?;:…—–]/.test(t)) return 'noPunct';
    return 'generic';
  }

  function onUserText(text) {
    if (smoking) setSmoking(false);
    touchActivity();
    const kind = classifyText(text);
    const pool = LINES[kind] || LINES.generic;
    const faceMap = {
      short: 'smug',
      long: 'dead',
      noPunct: 'angry',
      formatted: 'smug',
      command: 'angry',
      commandRoll: 'smug',
      commandHelp: 'dead',
      commandOffline: 'smug',
      generic: 'angry',
    };
    sayFrom(pool, { face: faceMap[kind] || 'angry' });
  }

  function onUserImage(fileOrType) {
    if (smoking) setSmoking(false);
    touchActivity();
    const name = (typeof fileOrType === 'string' ? fileOrType : fileOrType?.name || fileOrType?.type || '').toLowerCase();
    let pool = LINES.image;
    if (/\.jpe?g\b|image\/jpe?g/.test(name)) pool = LINES.imageJpeg.concat(LINES.image);
    else if (/\.png\b|image\/png/.test(name)) pool = LINES.imagePng.concat(LINES.image);
    else if (/\.gif\b|image\/gif/.test(name)) pool = LINES.imageGif.concat(LINES.image);
    else if (/\.webp\b|image\/webp/.test(name)) pool = LINES.imageWebp.concat(LINES.image);
    sayFrom(pool, { face: 'smug' });
  }

  function onUserFile(file) {
    if (smoking) setSmoking(false);
    touchActivity();
    const name = (file?.name || file?.type || '').toLowerCase();
    let pool = LINES.file;
    if (/\.pdf\b|application\/pdf/.test(name)) pool = LINES.filePdf.concat(LINES.file);
    else if (/\.(zip|rar|7z)\b|zip|compressed/.test(name)) pool = LINES.fileZip.concat(LINES.file);
    else if (/\.(doc|docx|txt|rtf|odt)\b|msword|document|text\//.test(name)) pool = LINES.fileDoc.concat(LINES.file);
    else if (/audio\/|\.(mp3|wav|ogg|m4a|flac)\b/.test(name)) pool = LINES.fileAudio.concat(LINES.file);
    else if (/video\/|\.(mp4|webm|mov|mkv)\b/.test(name)) pool = LINES.fileVideo.concat(LINES.file);
    sayFrom(pool, { face: 'angry' });
  }

  function onAway(away) {
    if (away) {
      setSmoking(true);
    } else {
      if (smoking) setSmoking(false);
      else sayFrom(LINES.greet, { face: 'angry' });
      touchActivity();
    }
  }

  function onLogin() {
    sayFrom(LINES.greet, { face: 'angry', hold: 5500 });
    touchActivity();
  }

  // click on character → random hate
  root.addEventListener('click', () => {
    if (smoking) {
      sayFrom(LINES.smoke, { face: 'smoke' });
      return;
    }
    sayFrom(LINES.generic.concat(LINES.short), { face: 'angry' });
    touchActivity();
  });

  touchActivity();

  return {
    say,
    onUserText,
    onUserImage,
    onUserFile,
    onAway,
    onLogin,
    setSmoking,
    touchActivity,
  };
}
