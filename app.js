import { initAuth, loginUser, logoutUser } from './modules/auth.js';
import { listenForMessages, sendTextMessage, updateTextMessage, searchMessages, jumpToMessage } from './modules/chat.js';
import { sendImage } from './modules/images.js';
import { sendAttachment } from './modules/attachments.js';
import { messagesRef } from './modules/firebase.js';
import { remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { showImageModal } from './modules/modal.js';
import { startTyping, stopTyping, listenTypingStatus } from './modules/status.js';
import { initImageViewer } from './modules/viewer.js';
import { requestNotificationPermission, setNotificationVolume } from './modules/notifications.js';
import { refreshMessageTimes } from './modules/ui.js';
import { initPresence, removePresence } from './modules/presence.js';
import { initDots } from './modules/dots.js';
import { tryExecuteCommand, initCommandsPanel, replyLocalDefault, initCommandAutocomplete } from './modules/commands.js';
import { initFormatToolbar } from './modules/formatToolbar.js';

// ==========================================
// 1. ЭЛЕМЕНТЫ ИНТЕРФЕЙСА
// ==========================================
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const nameInput = document.getElementById('nameInput');
const enterBtn = document.getElementById('enterBtn');
const logoutBtn = document.getElementById('logoutBtn');
const offlineBtn = document.getElementById('offlineBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');

let unsubscribeMessages = null;
let replyTarget = null;
let editingTarget = null;
let draftBeforeEdit = null;
let isAwayMode = false;

// ==========================================
// 2. УПРАВЛЕНИЕ ЭКРАНАМИ (ВХОД/ВЫХОД)
// ==========================================
function showChat() {
  if (isAwayMode) return;
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  offlineBtn?.classList.remove('hidden');
  messageInput.focus();

  requestNotificationPermission();
  initPresence();
  
  const user = localStorage.getItem('chat_user_name');
  if (user && !unsubscribeMessages) {
    unsubscribeMessages = listenForMessages(user);
  }
}

function showLogin() {
  hideFileDropOverlay();
  clearReply();
  clearEdit();
  chatScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
  offlineBtn?.classList.add('hidden');
  nameInput.value = "";
  nameInput.focus();

  removePresence();
  
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  
  document.getElementById('messages').innerHTML = '';
}

enterBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (name) {
    loginUser(name);
    showChat();
  } else alert("Пожалуйста, введите имя!");
});

nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') enterBtn.click(); });

logoutBtn.addEventListener('click', () => {
  if (isAwayMode) {
    isAwayMode = false;
    document.getElementById('awayOverlay')?.classList.add('hidden');
    document.body.classList.remove('away-mode');
  }
  logoutUser();
  showLogin();
});

// ==========================================
// 3. РАБОТА С ТЕКСТОМ (РЕСАЙЗ И ОТПРАВКА)
// ==========================================
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
  
  if (messageInput.scrollHeight > 120) {
    messageInput.style.overflowY = 'auto';
  } else {
    messageInput.style.overflowY = 'hidden';
  }
}

messageInput.addEventListener('input', () => { 
  if (!editingTarget) startTyping(); 
  autoResizeTextarea();
});

async function sendCurrentMessage() {
  const text = messageInput.value.trim();
  
  if (editingTarget) {
    if (!text && !editingTarget.image) return;
    const targetId = editingTarget.id;
    const saved = await updateTextMessage(targetId, text);
    if (saved && editingTarget?.id === targetId) {
      const pendingDraft = messageInput.value.trim() === text ? '' : messageInput.value;
      clearEdit({ clearInput: false });
      messageInput.value = pendingDraft;
      autoResizeTextarea();
    }
    return;
  }

  if (!text) return;

  // Команды: /roll, /help и т.д. (не перехватываем при ответе на сообщение)
  if (text.startsWith('/') && !replyTarget) {
    const user = localStorage.getItem('chat_user_name') || 'Аноним';
    const submittedInputValue = messageInput.value;
    const result = await tryExecuteCommand(text, {
      user,
      sendResult: async (resultText) => {
        const ok = await sendTextMessage(resultText, null);
        if (!ok) throw new Error('Не удалось отправить результат команды');
        return ok;
      },
      replyLocal: replyLocalDefault,
    });
    if (result.handled) {
      if (messageInput.value === submittedInputValue) {
        messageInput.value = '';
        stopTyping();
        autoResizeTextarea();
      }
      return;
    }
  }

  const submittedReply = replyTarget;
  const submittedInputValue = messageInput.value;
  const sent = await sendTextMessage(text, submittedReply);
  
  if (!sent) return;

  if (messageInput.value === submittedInputValue) {
    messageInput.value = '';
    stopTyping();
    autoResizeTextarea(); // Сбрасываем высоту после отправки
  }
  if (replyTarget === submittedReply) clearReply();
}

sendBtn.addEventListener('click', sendCurrentMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !document.getElementById('commandSuggest')?.classList.contains('hidden')) {
    // Enter сначала выбирает активную подсказку команды; отправка будет следующим нажатием.
    return;
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // Отменяем перенос строки
    sendCurrentMessage();
  }
  // При Shift+Enter ничего не делаем, браузер сам сделает перенос
});

const emojiBtn = document.getElementById('emojiBtn');
const emojis = Array.from(new Set((
  '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡 🤫 🤥 😶 😐 😑 😬 🫠 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🫥 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 💀 ☠️ 👻 👽 👾 🤖 💩 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💯 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤 👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 🧒 👦 👧 🧑 👨 👩 🧔 👱 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 👳 🧕 🤵 👰 🤰 🫃 🫄 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌 🧑‍💻 🧑‍🎓 🧑‍🔬 🧑‍🚀 🧑‍🍳 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🐓 🦃 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🪺 🌾 💐 🌷 🌹 🥀 🪻 🪷 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊 🎃 🎄 🎆 🎇 🧨 ✨ 🎈 🎉 🎊 🎋 🎍 🎎 🎏 🎐 🎑 🧧 🎀 🎁 🎗️ 🎟️ 🎫 🏆 🥇 🥈 🥉 🏅 🎖️ ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🚴 🚵 🏆 🎮 🕹️ 🎲 ♟️ 🧩 🧸 🪅 🪩 🪄 🎭 🎨 🧵 🪡 🧶 🪢 🎼 🎵 🎶 🎤 🎧 📯 🎷 🪗 🎸 🎹 🎺 🎻 🪕 🥁 🪘 🪇 🎬 🎞️ 📽️ 🎥 📺 📷 📸 📹 📼 🔍 🔎 🕯️ 💡 🔦 🏮 🪔 📔 📕 📖 📗 📘 📙 📚 📓 📒 📃 📜 📄 📰 🗞️ 📑 🔖 🏷️ 💰 🪙 💴 💵 💶 💷 💸 💳 🧾 💹 💱 💲 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 💣 🪃 🏹 🛡️ 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🔗 ⛓️ 🪝 🧰 🧲 🪜 🧪 🧫 🧬 🔬 🔭 📡 💉 🩸 💊 🩹 🩺 🚪 🛗 🪞 🪟 🛏️ 🛋️ 🪑 🚽 🪠 🚿 🛁 🪤 🪒 🧴 🧷 🧹 🧺 🧻 🪣 🧼 🫧 🪥 🧽 🧯 🛒 🚬 ⚰️ 🪦 ⚱️ 🗿 🪧 🪪 🏧 🚮 🚰 ♿ 🚹 🚺 🚻 🚼 🚾 🛂 🛃 🛄 🛅 ⚠️ 🚸 ⛔ 🚫 🚳 🚭 🚯 🚱 🚷 📵 🔞 ☢️ ☣️ ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🎵 🎶 🔊 🔉 🔈 🔇 📣 📢 🔔 🔕 ❤️‍🔥 💥 🔥 ✨ 🎉 🎊 🎈 🎁 ⭐ 🌟 💯 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💲 ™️ ©️ ®️ 〰️ ➰ 🌐 💠 🔰 🌀 🔱 ⭕ 🛑 ⏩ ⏪ 🔼 🔽 ⏫ ⏬ 🎯 💤 🆗 🆕 🆙 🆓 🆒 🆚 🆘 🅰️ 🅱️ 🆎 🅾️ 🅿️ 🅰️ 🏁 🚩 🏳️ 🏴 🏳️‍🌈 🏳️‍⚧️ 🇷🇺 🇺🇸 🇬🇧 🇳🇱 🇩🇪 🇫🇷 🇯🇵 🇨🇳 🇺🇦'
).split(/\s+/)));
const kaomojis = [
  '¯\\_(ツ)_/¯', '(╯°□°）╯︵ ┻━┻', '┬─┬ ノ( ゜-゜ノ)', '( ͡° ͜ʖ ͡°)', '(ง •̀_•́)ง', '(づ｡◕‿‿◕｡)づ', '(｡♥‿♥｡)', '(✿◠‿◠)', '(◕‿◕✿)', '(¬‿¬)', '(ಠ_ಠ)', '(ಥ﹏ಥ)', '(；一_一)', '(╥﹏╥)', 'ಥ_ಥ', '(ノಠ益ಠ)ノ', 'ヽ(ಠ‿ಠ)ノ', '٩(◕‿◕｡)۶', 'ლ(ಠ益ಠლ)', '(☞ﾟヮﾟ)☞', '☜(ﾟヮﾟ☜)', '(☞ ͡° ͜ʖ ͡°)☞', 'ᕕ( ᐛ )ᕗ', 'ᕦ(ò_óˇ)ᕤ', 'ᕙ(⇀‸↼‶)ᕗ', '(ง ื▿ ื)ว', 'ヽ(・∀・)ﾉ', 'ヾ(＠⌒ー⌒＠)ノ', '(* ^ ω ^)', '(´｡• ᵕ •｡`)', '(≧◡≦)', '(☆▽☆)', 'o(≧▽≦)o', '(⌒▽⌒)☆', '＼(＾▽＾)／', 'ヽ(o＾▽＾o)ノ', '(￣▽￣)', '(￣ω￣)', '(´• ω •`)', '(´･ᴗ･ ` )', '(っ˘ω˘ς)', '(－_－) zzZ', '(￣o￣) . z Z', '(＠￣ー￣＠)', '(¬_¬")', '(눈_눈)', '(；￣Д￣)', '(・`ω´・)', '(＃`Д´)', '(ง •̀_•́)ง‼', 'ψ(｀∇´)ψ', '(ノ_<。)', '(っ- ‸ – ς)', '(｡╯︵╰｡)', '(ಥ_ಥ)', '｡ﾟ(｡ﾉωヽ｡)ﾟ｡', 'o(〒﹏〒)o', '(ノ_<、)', '(；ω；)', '(｡•́︿•̀｡)', '(¬_¬)', '(￣へ￣)', '(；¬д¬)', '(눈‸눈)', '(╬ Ò﹏Ó)', '(＃＞＜)', '(งಠ_ಠ)ง', '( •̀ᴗ•́ )و', 'ᕦ(ò_óˇ)ᕤ', '٩(ˊᗜˋ*)و', 'd=(´▽｀)=b', 'b(￣▽￣)d', '♪(┌・。・)┌', '┌(・。・)┘♪', 'ヾ(⌐■_■)ノ♪', '♫꒰･◡･๑꒱', '(〜￣▽￣)〜', '(o´▽`o)', '(*≧ω≦*)', '(´｡• ᵕ •｡`)', '(づ￣ ³￣)づ', '( ˘ ³˘)♥', '(っ´▽｀)っ', '(つ≧▽≦)つ', '(づ◡ど)', '( ˶ˆᗜˆ˵ )', 'ლ(╹◡╹ლ)', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '｡･:*:･ﾟ★,｡･:*:･ﾟ☆', '☆彡', '★~(◠ω◕✿)', 'o(>ω<)o', '(ﾉ´ з `)ノ', '(´ ω `♡)', '(♡°▽°♡)', '(´• ω •`)ﾉ', '(￣▽￣)ノ', 'ヾ(＾-＾)ノ', 'ヾ(•ω•`)o', '(⌒‿⌒)', '(¬‿¬ )', '（￣へ￣）', '(╯︵╰,)', '┐(￣ヘ￣)┌', '┐(‘～`；)┌', '¯\\(°_o)/¯', '¯\\_(⊙_ʖ⊙)_/¯', '┐(ﾟ～ﾟ)┌', '乁( •_• )ㄏ', '(・_・ヾ', '(￣～￣;)', '(・・ ) ?', '(⊙_⊙)', 'Σ(°△°|||)', 'Σ(・ω・ノ)ノ', '(((゜д゜;)))', 'ヽ(ﾟДﾟ)ﾉ', 'ლ(ಠ益ಠლ)', '(ノ°益°)ノ', '(╬ Ò﹏Ó)', '凸(｀0´)凸', '(づ￣ ³￣)づ', '(づ｡◕‿‿◕｡)づ', 'ლ(・﹏・ლ)', '(つ✧ω✧)つ', '༼ つ ◕_◕ ༽つ', '(｡•̀ᴗ-)✧', '(๑˃ᴗ˂)ﻭ', '( •̀ ω •́ )✧', '(◕‿↼)', '(¬‿¬ )', '☜(ﾟヮﾟ☜)', '☞(ﾟヮﾟ☞)', 'ᕙ(`▿´)ᕗ', '(ﾉಥ益ಥ)ﾉ', '(ノಠ益ಠ)ノ彡┻━┻', '┬─┬ノ( º _ ºノ)', 'ʕ•ᴥ•ʔ', 'ʕ￫ᴥ￩ʔ', 'ʕっ•ᴥ•ʔっ', 'V●ᴥ●V', 'U・ᴥ・U', 'ฅ^•ﻌ•^ฅ', '=＾● ⋏ ●＾=', '(=^･ω･^=)', '(=｀ω´=)', 'ฅ(＾・ω・＾ฅ)', '₍ᐢ. .ᐢ₎', '૮ ˶ᵔ ᵕ ᵔ˶ ა', '૮₍ ˶•⤙•˶ ₎ა', '(づ◡ど)', '(｡•́︿•̀｡)', '(づ◡ど)'
];
let emojiPicker = null;
let emojiInsertStart = 0;
let emojiInsertEnd = 0;

function insertIntoMessageInput(value) {
  const start = Number.isInteger(emojiInsertStart) ? emojiInsertStart : messageInput.selectionStart;
  const end = Number.isInteger(emojiInsertEnd) ? emojiInsertEnd : messageInput.selectionEnd;
  const current = messageInput.value;
  messageInput.value = current.slice(0, start) + value + current.slice(end);
  const caret = start + value.length;
  emojiInsertStart = emojiInsertEnd = caret;
  messageInput.focus();
  messageInput.setSelectionRange(caret, caret);
  messageInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderEmojiGrid(grid, entries, kind) {
  grid.replaceChildren();
  entries.forEach(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = kind === 'emoji' ? 'emoji-item' : 'kaomoji-item';
    button.textContent = value;
    button.title = `Вставить ${value}`;
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => insertIntoMessageInput(value));
    grid.appendChild(button);
  });
}

function setEmojiPickerTab(tab) {
  if (!emojiPicker) return;
  emojiPicker.querySelectorAll('[data-emoji-tab]').forEach(button => {
    const active = button.dataset.emojiTab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const grid = emojiPicker.querySelector('.emoji-picker-grid');
  grid.classList.toggle('kaomoji-grid', tab === 'kaomoji');
  renderEmojiGrid(grid, tab === 'kaomoji' ? kaomojis : emojis, tab === 'kaomoji' ? 'kaomoji' : 'emoji');
}

emojiBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (emojiPicker) {
    emojiPicker.remove();
    emojiPicker = null;
    return;
  }

  emojiInsertStart = messageInput.selectionStart;
  emojiInsertEnd = messageInput.selectionEnd;
  emojiPicker = document.createElement('div');
  emojiPicker.className = 'emoji-picker';
  emojiPicker.addEventListener('click', event => event.stopPropagation());
  const tabs = document.createElement('div');
  tabs.className = 'emoji-picker-tabs';
  tabs.setAttribute('role', 'tablist');
  [['emoji', 'Эмодзи'], ['kaomoji', 'Каомодзи']].forEach(([tab, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'emoji-picker-tab';
    button.dataset.emojiTab = tab;
    button.setAttribute('role', 'tab');
    button.textContent = label;
    button.addEventListener('click', () => setEmojiPickerTab(tab));
    tabs.appendChild(button);
  });
  const grid = document.createElement('div');
  grid.className = 'emoji-picker-grid';
  emojiPicker.append(tabs, grid);
  document.querySelector('.input-area').appendChild(emojiPicker);
  setEmojiPickerTab('emoji');
});

document.addEventListener('click', () => {
  if (emojiPicker) {
    emojiPicker.remove();
    emojiPicker = null;
  }
});

// ==========================================
// 4. РЕДАКТИРОВАНИЕ И ОТВЕТЫ
// ==========================================
function clearEdit({ clearInput = true, restoreDraft = false } = {}) {
  editingTarget = null;
  document.getElementById('editingBar').classList.add('hidden');
  document.getElementById('editingText').textContent = 'Редактирование сообщения';
  if (restoreDraft && draftBeforeEdit !== null) messageInput.value = draftBeforeEdit;
  else if (clearInput) messageInput.value = '';
  draftBeforeEdit = null;
  messageInput.placeholder = 'Напиши что-нибудь...';
  sendBtn.textContent = '➤';
  if (attachBtn) attachBtn.disabled = false;
  autoResizeTextarea();
}

function clearReply() {
  replyTarget = null;
  document.getElementById('replyingBar').classList.add('hidden');
  document.getElementById('replyingText').textContent = '';
}

document.addEventListener('chat:reply', (event) => {
  const draft = editingTarget ? draftBeforeEdit : messageInput.value;
  if (editingTarget) clearEdit({ clearInput: false, restoreDraft: true });
  else clearEdit({ clearInput: false });
  if (draft !== null) messageInput.value = draft;
  
  replyTarget = event.detail;
  document.getElementById('replyingText').textContent = `Ответ на ${replyTarget.name}: ${(replyTarget.text || (replyTarget.attachment?.name ? `📎 ${replyTarget.attachment.name}` : (replyTarget.image ? '📷 Изображение' : ''))).slice(0, 100)}`;
  document.getElementById('replyingBar').classList.remove('hidden');
  messageInput.focus();
  autoResizeTextarea();
});

document.getElementById('cancelReplyBtn').addEventListener('click', clearReply);

document.addEventListener('chat:edit', (event) => {
  const draft = editingTarget ? draftBeforeEdit : messageInput.value;
  if (editingTarget) clearEdit({ clearInput: false, restoreDraft: true });
  draftBeforeEdit = draft ?? '';
  clearReply();
  
  const target = event.detail;
  editingTarget = target;
  document.getElementById('editingText').textContent = `Редактирование сообщения: ${(target.text || (target.image ? '📷 подпись к изображению' : '')).slice(0, 90)}`;
  document.getElementById('editingBar').classList.remove('hidden');
  messageInput.value = target.text || '';
  messageInput.placeholder = 'Измени сообщение...';
  sendBtn.textContent = '✓';
  attachBtn.disabled = true;
  messageInput.focus();
  autoResizeTextarea();
});

document.getElementById('cancelEditBtn').addEventListener('click', () => {
  clearEdit({ clearInput: false, restoreDraft: true });
});

// ==========================================
// 5. ОТПРАВКА ФАЙЛОВ
// ==========================================
attachBtn.addEventListener('click', () => fileInput.click());

function handleImageSelection(file) {
  if (!file) return Promise.resolve(false);

  return new Promise((resolve) => {
    const existingText = messageInput.value.trim();
    showImageModal(file, async (confirmedFile, caption, keepOriginal) => {
      let sent = false;
      try {
        sent = await sendImage(confirmedFile, caption, replyTarget, keepOriginal);
      } catch (error) {
        console.error('Не удалось отправить изображение:', error);
      }

      if (sent) {
        clearReply();
        if (messageInput.value.trim() === existingText) {
          messageInput.value = '';
          autoResizeTextarea();
        }
      } else {
        messageInput.value = caption;
        autoResizeTextarea();
      }
      resolve(sent);
    }, () => resolve(null));

    setTimeout(() => {
      const captionInput = document.getElementById('imageCaptionInput');
      if (captionInput) captionInput.value = existingText;
    }, 0);
  });
}

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'md', 'markdown',
  'txt', 'json', 'xml', 'yaml', 'yml', 'log'
]);
const COMMON_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif', 'svg'
]);

function getFileExtension(file) {
  return String(file?.name || '').split('.').pop().toLowerCase();
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith('image/')) || COMMON_IMAGE_EXTENSIONS.has(getFileExtension(file));
}

function isSupportedDropFile(file) {
  return isImageFile(file) || SUPPORTED_ATTACHMENT_EXTENSIONS.has(getFileExtension(file));
}

async function processSelectedFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  if (editingTarget) {
    replyLocalDefault('Нельзя прикреплять файлы во время редактирования сообщения.');
    return;
  }

  const unsupportedFiles = files.filter(file => !isSupportedDropFile(file));
  const supportedFiles = files.filter(isSupportedDropFile);

  for (const file of supportedFiles) {
    if (isImageFile(file)) {
      // Открываем диалог для каждого изображения последовательно. Отмена прекращает пакет.
      const sent = await handleImageSelection(file);
      if (!sent) break;
      continue;
    }

    const draft = messageInput.value;
    const submittedReply = replyTarget;
    const sent = await sendAttachment(file, draft, submittedReply);
    if (!sent) break;

    if (messageInput.value === draft) {
      messageInput.value = '';
      autoResizeTextarea();
    }
    if (replyTarget === submittedReply) clearReply();
  }

  if (unsupportedFiles.length) {
    const names = unsupportedFiles.slice(0, 4).map(file => file.name).join(', ');
    const rest = unsupportedFiles.length > 4 ? ` и ещё ${unsupportedFiles.length - 4}` : '';
    replyLocalDefault(`Пропущены неподдерживаемые файлы: ${names}${rest}.`);
  }
}

fileInput.addEventListener('change', async (event) => {
  const files = Array.from(event.target.files || []);
  fileInput.value = '';
  await processSelectedFiles(files);
});

// Drag-and-drop файлов работает по всей странице, а не только над полем ввода.
let fileDragDepth = 0;
let fileDropOverlay = null;

function isExternalFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function canReceiveDroppedFiles() {
  return Boolean(localStorage.getItem('chat_user_name')) &&
    !chatScreen.classList.contains('hidden') && !isAwayMode;
}

function ensureFileDropOverlay() {
  if (fileDropOverlay) return fileDropOverlay;
  fileDropOverlay = document.createElement('div');
  fileDropOverlay.id = 'fileDropOverlay';
  fileDropOverlay.className = 'file-drop-overlay hidden';
  fileDropOverlay.setAttribute('aria-hidden', 'true');
  fileDropOverlay.innerHTML = `
    <div class="file-drop-card">
      <span class="file-drop-icon" aria-hidden="true">📎</span>
      <strong>Отпустите файлы для отправки</strong>
      <span class="file-drop-description">Обычные файлы — до 2 МиБ; изображения без сжатия — до 5 МиБ</span>
    </div>`;
  document.body.appendChild(fileDropOverlay);
  return fileDropOverlay;
}

function showFileDropOverlay() {
  const overlay = ensureFileDropOverlay();
  const title = overlay.querySelector('strong');
  const description = overlay.querySelector('.file-drop-description');
  if (editingTarget) {
    title.textContent = 'Сначала завершите редактирование';
    description.textContent = 'Прикрепление файлов недоступно в режиме редактирования сообщения.';
  } else {
    title.textContent = 'Отпустите файлы для отправки';
    description.textContent = 'Обычные файлы — до 2 МиБ; изображения без сжатия — до 5 МиБ';
  }
  overlay.classList.remove('hidden');
}

function hideFileDropOverlay() {
  fileDragDepth = 0;
  fileDropOverlay?.classList.add('hidden');
}

document.addEventListener('dragenter', event => {
  if (!isExternalFileDrag(event) || !canReceiveDroppedFiles()) return;
  event.preventDefault();
  fileDragDepth += 1;
  showFileDropOverlay();
});

document.addEventListener('dragover', event => {
  if (!isExternalFileDrag(event) || !canReceiveDroppedFiles()) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = editingTarget ? 'none' : 'copy';
  showFileDropOverlay();
});

document.addEventListener('dragleave', event => {
  if (!isExternalFileDrag(event) || !canReceiveDroppedFiles()) return;
  fileDragDepth = Math.max(0, fileDragDepth - 1);
  if (fileDragDepth === 0 || event.relatedTarget == null) hideFileDropOverlay();
});

document.addEventListener('drop', async event => {
  if (!isExternalFileDrag(event) || !canReceiveDroppedFiles()) return;
  event.preventDefault();
  const files = Array.from(event.dataTransfer?.files || []);
  hideFileDropOverlay();
  await processSelectedFiles(files);
});

document.addEventListener('paste', (event) => {
  const isChatVisible = !chatScreen.classList.contains('hidden');
  if (!isChatVisible || editingTarget) return;

  const items = (event.clipboardData || window.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      handleImageSelection(item.getAsFile());
      event.preventDefault();
      break; 
    }
  }
});

// ==========================================
// ПОИСК ПО ИСТОРИИ
// ==========================================
const searchModal = document.getElementById('searchModal');
const searchForm = document.getElementById('searchForm');
const searchQuery = document.getElementById('searchQuery');
const searchResults = document.getElementById('searchResults');
const searchStatus = document.getElementById('searchStatus');

document.getElementById('searchChatBtn')?.addEventListener('click', () => {
  searchModal.classList.remove('hidden');
  setTimeout(() => searchQuery.focus(), 20);
});
document.getElementById('closeSearchBtn')?.addEventListener('click', () => searchModal.classList.add('hidden'));
searchModal?.addEventListener('click', event => { if (event.target === searchModal) searchModal.classList.add('hidden'); });
searchForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const query = searchQuery.value.trim();
  if (!query) {
    searchStatus.textContent = 'Введи хотя бы один символ.';
    return;
  }
  const submit = document.getElementById('searchSubmitBtn');
  submit.disabled = true;
  searchResults.replaceChildren();
  searchStatus.textContent = 'Ищем по истории…';
  try {
    const results = await searchMessages(query, {
      maxResults: 50,
      onProgress: ({ scanned, found }) => {
        searchStatus.textContent = `Проверено сообщений: ${scanned}. Найдено: ${found}.`;
      }
    });
    searchResults.replaceChildren();
    if (!results.length) {
      searchStatus.textContent = `По запросу «${query}» ничего не найдено.`;
      return;
    }
    searchStatus.textContent = `Найдено: ${results.length}${results.length === 50 ? ' (показаны первые 50)' : ''}. Нажми на результат, чтобы перейти к сообщению.`;
    results.forEach(result => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'chat-search-result';
      const header = document.createElement('span');
      header.className = 'chat-search-result-header';
      const name = document.createElement('strong');
      name.textContent = result.name;
      const time = document.createElement('time');
      time.textContent = result.timestamp ? new Date(Number(result.timestamp)).toLocaleString() : '';
      header.append(name, time);
      const snippet = document.createElement('span');
      snippet.className = 'chat-search-result-text';
      snippet.textContent = result.text || (result.attachmentName ? `📎 ${result.attachmentName}` : result.image ? '📷 Изображение' : '(без текста)');
      item.append(header, snippet);
      item.addEventListener('click', async () => {
        searchModal.classList.add('hidden');
        const reached = await jumpToMessage(result.id);
        if (!reached) replyLocalDefault('Не удалось загрузить найденное сообщение. Попробуй повторить поиск.');
      });
      searchResults.appendChild(item);
    });
  } catch (error) {
    console.error('Ошибка поиска по истории:', error);
    searchStatus.textContent = 'Поиск не удался. Проверь подключение к Firebase и попробуй ещё раз.';
  } finally {
    submit.disabled = false;
  }
});

// ==========================================
// 6. НАСТРОЙКИ И ГЛОБАЛЬНЫЕ ФУНКЦИИ
// ==========================================
const settingsModal = document.getElementById('settingsModal');
const soundVolume = document.getElementById('soundVolume');
const soundVolumeValue = document.getElementById('soundVolumeValue');
const timeFormat = document.getElementById('timeFormat');

soundVolume.value = localStorage.getItem('chat_sound_volume') ?? '60';
soundVolumeValue.textContent = `${soundVolume.value}%`;
timeFormat.value = localStorage.getItem('chat_time_format') ?? '24';
setNotificationVolume(soundVolume.value);

document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('closeSettingsBtn').addEventListener('click', () => settingsModal.classList.add('hidden'));
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

soundVolume.addEventListener('input', () => { 
  soundVolumeValue.textContent = `${soundVolume.value}%`; 
  setNotificationVolume(soundVolume.value); 
});

timeFormat.addEventListener('change', () => {
  localStorage.setItem('chat_time_format', timeFormat.value);
  refreshMessageTimes();
});

window.clearChat = async function() {
  if (confirm("Удалить ВСЕ сообщения?")) {
    await remove(messagesRef);
    document.getElementById('messages').innerHTML = '';
    console.log("Чат очищен");
  }
};

// Автофокус при клике мимо полей ввода
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
  if (chatScreen.classList.contains('hidden')) return;
  const active = document.activeElement;
  if (active === messageInput || active?.matches('input, textarea, select, button, [contenteditable="true"]')) return;
  messageInput.focus();
});

// ==========================================
// 7. ЗАПУСК ПРИЛОЖЕНИЯ
// ==========================================
// ==========================================
// ОФФЛАЙН-РЕЖИМ (away)
// Хоткей Ctrl+Alt+O и кнопка в шапке — скрыть чат без разлогина
// ==========================================
function ensureAwayOverlay() {
  let overlay = document.getElementById('awayOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'awayOverlay';
  overlay.className = 'away-overlay hidden';
  overlay.innerHTML = `
    <div class="away-card">
      <div class="away-icon" aria-hidden="true">🌙</div>
      <h2>Оффлайн-режим</h2>
      <p>Ты скрыт из чата. Сообщения не показываются, статус «оффлайн».</p>
      <p class="away-hotkey">Переключить режим: <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd> или кнопка ниже</p>
      <button type="button" id="awayReturnBtn" class="btn-primary">Вернуться в чат</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#awayReturnBtn').addEventListener('click', () => setAwayMode(false));
  return overlay;
}

function setAwayMode(away) {
  const user = localStorage.getItem('chat_user_name');
  if (!user) return;

  isAwayMode = away;
  if (away) hideFileDropOverlay();
  const overlay = ensureAwayOverlay();
  offlineBtn?.classList.toggle('hidden', away);

  if (away) {
    clearReply();
    clearEdit();
    stopTyping();
    removePresence();
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    chatScreen.classList.add('hidden');
    loginScreen.classList.add('hidden');
    logoutBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
    document.body.classList.add('away-mode');
  } else {
    overlay.classList.add('hidden');
    document.body.classList.remove('away-mode');
    // Быстрый возврат без повторного ввода имени
    showChat();
  }
}

document.addEventListener('keydown', (e) => {
  // Ctrl+Alt+O: не конфликтует с типичной браузерной командой Ctrl+L (адресная строка).
  const isOfflineHotkey = e.code === 'KeyO' && e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey;
  if (!isOfflineHotkey || e.repeat) return;
  if (!localStorage.getItem('chat_user_name')) return;

  e.preventDefault();
  setAwayMode(!isAwayMode);
});

// Кнопка оффлайн-режима в шапке: не зависит от перехвата клавиатурных сочетаний браузером.
offlineBtn?.addEventListener('click', () => setAwayMode(!isAwayMode));

// Команда /offline из modules/commands.js
document.addEventListener('chat:away', (e) => {
  const force = e.detail?.away;
  if (typeof force === 'boolean') setAwayMode(force);
  else setAwayMode(!isAwayMode);
});

initImageViewer();
initAuth(showChat, showLogin);
listenTypingStatus();
initDots();
initCommandsPanel({
  onInsert: (snippet) => {
    messageInput.value = snippet;
    messageInput.focus();
    autoResizeTextarea();
    const len = messageInput.value.length;
    messageInput.setSelectionRange(len, len);
  },
});
initCommandAutocomplete(messageInput, {
  isReplyActive: () => Boolean(replyTarget || editingTarget),
});
initFormatToolbar(messageInput);