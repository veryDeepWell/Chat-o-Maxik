import { THEME_DEFAULTS, loadThemeParams, saveThemeParams } from './themeSettings.js';

const FIELDS = {
  dots: [
    { key: 'density', label: 'Плотность', type: 'range', min: 30, max: 140, step: 5 },
    { key: 'linkDist', label: 'Длина связей', type: 'range', min: 60, max: 220, step: 5 },
    { key: 'size', label: 'Размер точек', type: 'range', min: 0.5, max: 2, step: 0.1 },
  ],
  orbits: [
    { key: 'rings', label: 'Кольца', type: 'range', min: 2, max: 10, step: 1 },
    { key: 'glow', label: 'Свечение', type: 'range', min: 0.3, max: 2, step: 0.1 },
  ],
  math: [
    { key: 'waves', label: 'Волны', type: 'range', min: 1, max: 8, step: 1 },
    { key: 'amplitude', label: 'Амплитуда', type: 'range', min: 0.3, max: 2, step: 0.1 },
  ],
  platonic: [
    { key: 'count', label: 'Количество тел', type: 'range', min: 1, max: 16, step: 1 },
    { key: 'spin', label: 'Вращение', type: 'range', min: 0, max: 1.5, step: 0.05 },
    { key: 'size', label: 'Размер', type: 'range', min: 0.5, max: 2, step: 0.1 },
    { key: 'speed', label: 'Скорость движения', type: 'range', min: 0.2, max: 2, step: 0.1 },
  ],
  tesseract: [
    { key: 'scale', label: 'Масштаб', type: 'range', min: 0.5, max: 1.8, step: 0.1 },
    { key: 'spin', label: 'Вращение 4D', type: 'range', min: 0.2, max: 2, step: 0.1 },
  ],
  graphs: [
    { key: 'showGrid', label: 'Сетка координат', type: 'checkbox' },
    { key: 'crawlLabels', label: 'Ползущие формулы', type: 'checkbox' },
    { key: 'xRange', label: 'Диапазон X', type: 'range', min: 6, max: 24, step: 0.5 },
    { key: 'yScale', label: 'Масштаб Y', type: 'range', min: 0.4, max: 2, step: 0.1 },
  ],
  blobs: [
    { key: 'count', label: 'Количество', type: 'range', min: 4, max: 30, step: 1 },
    { key: 'size', label: 'Размер', type: 'range', min: 0.5, max: 2, step: 0.1 },
    { key: 'mergeStrength', label: 'Сила слияния', type: 'range', min: 0.2, max: 2, step: 0.1 },
    { key: 'colored', label: 'Цветные блебы', type: 'checkbox' },
  ],
  blob_cycle: [
    { key: 'bits', label: 'Осколков при взрыве', type: 'range', min: 8, max: 36, step: 1 },
    { key: 'explodeForce', label: 'Сила взрыва', type: 'range', min: 0.8, max: 3, step: 0.1 },
    { key: 'gatherSpeed', label: 'Скорость сбора', type: 'range', min: 0.4, max: 2, step: 0.1 },
  ],
  polylines: [
    { key: 'pieces', label: 'Кусочков витража', type: 'range', min: 6, max: 30, step: 1 },
    { key: 'size', label: 'Размер', type: 'range', min: 0.4, max: 1.6, step: 0.05 },
    { key: 'alpha', label: 'Прозрачность стекла', type: 'range', min: 0.15, max: 0.8, step: 0.05 },
  ],
  flicker: [
    { key: 'cols', label: 'Столбцы сетки', type: 'range', min: 6, max: 24, step: 1 },
    { key: 'rows', label: 'Строки сетки', type: 'range', min: 5, max: 18, step: 1 },
    { key: 'ripple', label: 'Рябь', type: 'range', min: 0.2, max: 2, step: 0.1 },
    { key: 'linkAlpha', label: 'Видимость связей', type: 'range', min: 0.05, max: 0.5, step: 0.05 },
  ],
  solar: [
    { key: 'scale', label: 'Масштаб', type: 'range', min: 0.6, max: 1.6, step: 0.1 },
    { key: 'speed', label: 'Скорость орбит', type: 'range', min: 0.2, max: 2, step: 0.1 },
    { key: 'labels', label: 'Подписи', type: 'checkbox' },
  ],
  cheese: [
    { key: 'size', label: 'Размер сыра', type: 'range', min: 0.6, max: 1.8, step: 0.1 },
    { key: 'speed', label: 'Скорость', type: 'range', min: 0.3, max: 2, step: 0.1 },
  ],
  blackhole: [
    { key: 'particles', label: 'Частицы', type: 'range', min: 40, max: 320, step: 10 },
    { key: 'pull', label: 'Притяжение', type: 'range', min: 0.3, max: 2, step: 0.1 },
    { key: 'disc', label: 'Диск аккреции', type: 'range', min: 0.5, max: 1.8, step: 0.1 },
  ],
  puppet: [
    { key: 'layers', label: 'Слои', type: 'range', min: 3, max: 10, step: 1 },
    { key: 'amp', label: 'Амплитуда', type: 'range', min: 0.4, max: 2, step: 0.1 },
  ],
  wind: [
    { key: 'count', label: 'Потоков', type: 'range', min: 15, max: 120, step: 5 },
    { key: 'length', label: 'Длина линий', type: 'range', min: 40, max: 180, step: 5 },
    { key: 'speed', label: 'Скорость', type: 'range', min: 0.3, max: 2, step: 0.1 },
  ],
  desert: [
    { key: 'dunes', label: 'Дюны', type: 'range', min: 3, max: 7, step: 1 },
    { key: 'tumble', label: 'Перекати-поле', type: 'checkbox' },
    { key: 'critters', label: 'Скорпионы и змеи', type: 'checkbox' },
  ],
  glacier: [
    { key: 'scale', label: 'Размер ледника', type: 'range', min: 0.8, max: 1.8, step: 0.05 },
    { key: 'chunks', label: 'Обломки льда', type: 'range', min: 3, max: 16, step: 1 },
  ],
  sand: [
    { key: 'count', label: 'Зёрен', type: 'range', min: 40, max: 260, step: 10 },
    { key: 'size', label: 'Размер', type: 'range', min: 0.5, max: 2, step: 0.1 },
  ],
  balls: [
    { key: 'count', label: 'Мячиков', type: 'range', min: 4, max: 24, step: 1 },
    { key: 'size', label: 'Размер', type: 'range', min: 0.5, max: 2, step: 0.1 },
    { key: 'collide', label: 'Столкновения друг с другом', type: 'checkbox' },
  ],
  fireworks: [
    { key: 'rate', label: 'Частота запусков', type: 'range', min: 0.4, max: 2, step: 0.1 },
    { key: 'height', label: 'Высота подъёма', type: 'range', min: 0.6, max: 1.8, step: 0.1 },
    { key: 'variety', label: 'Разнообразие', type: 'range', min: 0.5, max: 2, step: 0.1 },
  ],
  hater: [],
  none: [],
};

export function initThemeParamsUI(getAnimation) {
  const host = document.getElementById('themeParamsHost');
  const graphBlock = document.getElementById('graphFormulasBlock');
  if (!host) return { refresh() {} };

  let all = loadThemeParams();

  function render() {
    const anim = typeof getAnimation === 'function' ? getAnimation() : getAnimation;
    all = loadThemeParams();
    const fields = FIELDS[anim] || [];
    const values = { ...THEME_DEFAULTS[anim], ...all[anim] };
    host.innerHTML = '';
    host.classList.toggle('hidden', !fields.length && anim !== 'graphs');

    if (fields.length) {
      const title = document.createElement('h5');
      title.className = 'theme-params-title';
      title.textContent = 'Параметры этой темы';
      host.appendChild(title);
    }

    for (const field of fields) {
      const wrap = document.createElement('label');
      wrap.className = field.type === 'checkbox' ? 'theme-param theme-param-check' : 'theme-param appearance-range';
      if (field.type === 'checkbox') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(values[field.key]);
        input.addEventListener('change', () => {
          all[anim] = { ...values, ...all[anim], [field.key]: input.checked };
          values[field.key] = input.checked;
          saveThemeParams(all);
        });
        wrap.appendChild(input);
        const span = document.createElement('span');
        span.textContent = field.label;
        wrap.appendChild(span);
      } else {
        const head = document.createElement('span');
        const out = document.createElement('output');
        out.textContent = String(values[field.key] ?? field.min);
        head.innerHTML = `${field.label} `;
        head.appendChild(out);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = field.min;
        input.max = field.max;
        input.step = field.step;
        input.value = values[field.key] ?? field.min;
        input.addEventListener('input', () => {
          const v = field.step < 1 ? Number(input.value) : Math.round(Number(input.value));
          out.textContent = String(v);
          all[anim] = { ...values, ...all[anim], [field.key]: v };
          values[field.key] = v;
          saveThemeParams(all);
        });
        wrap.appendChild(head);
        wrap.appendChild(input);
      }
      host.appendChild(wrap);
    }

    if (graphBlock) {
      graphBlock.classList.toggle('hidden', anim !== 'graphs');
    }
  }

  return { refresh: render };
}
