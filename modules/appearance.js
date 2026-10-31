import { loadGraphFormulas, saveGraphFormulas, compileGraphExpression } from './background.js';
const STORAGE_KEY = 'chat_appearance_v1';

const DEFAULTS = Object.freeze({
  pageBg: '#121212',
  panelBg: '#1e1e1e',
  text: '#f0f0f0',
  muted: '#888888',
  accent: '#ff80ab',
  border: '#333333',
  otherMessage: '#202020',
  otherText: '#f0f0f0',
  mineStart: '#ff80ab',
  mineEnd: '#ff4081',
  mineText: '#ffffff',
  chatBg: '#0f0710',
  chatBackground: 'glow',
  animation: 'dots',
  speed: 1,
  density: 75,
  opacity: 65
});

const PRESETS = {
  pink: { ...DEFAULTS },
  violet: {
    ...DEFAULTS, pageBg: '#11101a', panelBg: '#1c192b', text: '#f1edff', muted: '#a49bbd',
    accent: '#b18cff', border: '#39314f', otherMessage: '#29243a', mineStart: '#9c7bff',
    mineEnd: '#6845d8', chatBg: '#100d1b', chatBackground: 'grid'
  },
  ocean: {
    ...DEFAULTS, pageBg: '#0d141b', panelBg: '#17232d', text: '#e8f5fb', muted: '#91a9b8',
    accent: '#52c7e8', border: '#2d4655', otherMessage: '#203440', mineStart: '#38b9d7',
    mineEnd: '#2874d0', chatBg: '#0b1821', chatBackground: 'glow', animation: 'orbits'
  },
  matrix: {
    ...DEFAULTS, pageBg: '#0b110d', panelBg: '#131e17', text: '#e5f4e8', muted: '#8ba895',
    accent: '#8be36b', border: '#263d2e', otherMessage: '#1b2a20', mineStart: '#66c94e',
    mineEnd: '#168a55', chatBg: '#09130d', chatBackground: 'grid', animation: 'math'
  },
  sunset: {
    ...DEFAULTS, pageBg: '#171015', panelBg: '#261a22', text: '#fff0e9', muted: '#bba2a1',
    accent: '#ffb36b', border: '#49313d', otherMessage: '#33242b', mineStart: '#ffb36b',
    mineEnd: '#e95b78', chatBg: '#170e16', chatBackground: 'glow', animation: 'orbits'
  }
};

const COLOR_KEYS = [
  'pageBg', 'panelBg', 'text', 'muted', 'accent', 'border', 'otherMessage',
  'otherText', 'mineStart', 'mineEnd', 'mineText', 'chatBg'
];
const VALID_CHAT_BACKGROUNDS = new Set(['glow', 'grid', 'plain']);
const VALID_ANIMATIONS = new Set(['dots', 'orbits', 'math', 'platonic', 'tesseract', 'graphs', 'blobs', 'blobs_color', 'blob_cycle', 'polylines', 'flicker', 'solar', 'cheese', 'blackhole', 'puppet', 'wind', 'desert', 'glacier', 'sand', 'balls', 'fireworks', 'none']);

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const state = { ...DEFAULTS };
    for (const key of COLOR_KEYS) {
      if (isHexColor(saved[key])) state[key] = saved[key];
    }
    if (VALID_CHAT_BACKGROUNDS.has(saved.chatBackground)) state.chatBackground = saved.chatBackground;
    if (VALID_ANIMATIONS.has(saved.animation)) state.animation = saved.animation;
    state.speed = clampNumber(saved.speed, 0.2, 2, DEFAULTS.speed);
    state.density = clampNumber(saved.density, 30, 140, DEFAULTS.density);
    state.opacity = clampNumber(saved.opacity, 10, 100, DEFAULTS.opacity);
    return state;
  } catch (error) {
    console.warn('Не удалось загрузить настройки оформления:', error);
    return { ...DEFAULTS };
  }
}

function saveAppearance(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Не удалось сохранить настройки оформления:', error);
  }
}

function mixWithWhite(hex, amount = 0.15) {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
  return '#' + channels.map(channel => Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0')).join('');
}

function applyAppearance(state) {
  const root = document.documentElement;
  const styles = {
    '--bg-color': state.pageBg,
    '--panel-bg': state.panelBg,
    '--text-main': state.text,
    '--text-muted': state.muted,
    '--accent': state.accent,
    '--accent-hover': mixWithWhite(state.accent, 0.16),
    '--border-color': state.border,
    '--msg-bg-other': state.otherMessage,
    '--msg-bg-mine': `linear-gradient(135deg, ${state.mineStart}, ${state.mineEnd})`,
    '--msg-text-other': state.otherText,
    '--msg-text-mine': state.mineText,
    '--chat-bg-color': state.chatBg,
    '--blue-accent': state.accent
  };
  for (const [name, value] of Object.entries(styles)) root.style.setProperty(name, value);
  root.dataset.chatBackground = state.chatBackground;
  root.dataset.backgroundAnimation = state.animation;
  window.dispatchEvent(new CustomEvent('appearance:change', { detail: { ...state } }));
}

function updateRangeOutputs(state) {
  const values = {
    backgroundSpeedValue: `${Number(state.speed).toFixed(1)}×`,
    backgroundDensityValue: String(state.density),
    backgroundOpacityValue: `${state.opacity}%`
  };
  for (const [id, value] of Object.entries(values)) {
    const output = document.getElementById(id);
    if (output) output.textContent = value;
  }
}

function syncControls(state) {
  document.querySelectorAll('[data-appearance-setting]').forEach(control => {
    const key = control.dataset.appearanceSetting;
    if (Object.prototype.hasOwnProperty.call(state, key)) control.value = String(state[key]);
  });
  updateRangeOutputs(state);
  document.querySelectorAll('[data-appearance-preset]').forEach(button => button.classList.remove('active'));
  const matchingPreset = Object.entries(PRESETS).find(([, preset]) =>
    COLOR_KEYS.every(key => preset[key] === state[key]) &&
    preset.chatBackground === state.chatBackground && preset.animation === state.animation
  );
  if (matchingPreset) {
    document.querySelector(`[data-appearance-preset="${matchingPreset[0]}"]`)?.classList.add('active');
  }
}

export function initAppearance() {
  let state = loadAppearance();
  applyAppearance(state);
  syncControls(state);

  document.querySelectorAll('[data-appearance-setting]').forEach(control => {
    const eventName = control.type === 'range' || control.type === 'color' ? 'input' : 'change';
    control.addEventListener(eventName, () => {
      const key = control.dataset.appearanceSetting;
      if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) return;
      let value = control.value;
      if (COLOR_KEYS.includes(key) && !isHexColor(value)) return;
      if (key === 'speed') value = clampNumber(value, 0.2, 2, DEFAULTS.speed);
      if (key === 'density') value = Math.round(clampNumber(value, 30, 140, DEFAULTS.density));
      if (key === 'opacity') value = Math.round(clampNumber(value, 10, 100, DEFAULTS.opacity));
      if (key === 'chatBackground' && !VALID_CHAT_BACKGROUNDS.has(value)) return;
      if (key === 'animation' && !VALID_ANIMATIONS.has(value)) return;
      state = { ...state, [key]: value };
      saveAppearance(state);
      applyAppearance(state);
      updateRangeOutputs(state);
      document.querySelectorAll('[data-appearance-preset]').forEach(button => button.classList.remove('active'));
    });
  });

  document.querySelectorAll('[data-appearance-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const preset = PRESETS[button.dataset.appearancePreset];
      if (!preset) return;
      state = { ...preset };
      saveAppearance(state);
      applyAppearance(state);
      syncControls(state);
    });
  });

  document.getElementById('resetAppearanceBtn')?.addEventListener('click', () => {
    state = { ...DEFAULTS };
    saveAppearance(state);
    applyAppearance(state);
    syncControls(state);
  });

  const graphInput = document.getElementById('graphFormulasInput');
  const graphSave = document.getElementById('saveGraphFormulasBtn');
  if (graphInput) {
    graphInput.value = loadGraphFormulas().join('\n');
  }
  graphSave?.addEventListener('click', () => {
    const lines = (graphInput?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const valid = [];
    const errors = [];
    for (const line of lines) {
      try {
        compileGraphExpression(line);
        valid.push(line);
      } catch (error) {
        errors.push(`${line} — ${error.message}`);
      }
    }
    saveGraphFormulas(valid.length ? valid : loadGraphFormulas());
    if (graphInput) graphInput.value = loadGraphFormulas().join('\n');
    if (errors.length) {
      alert('Часть формул не принята:\n' + errors.slice(0, 5).join('\n'));
    }
  });
}
