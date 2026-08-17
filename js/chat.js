(() => {
  const CHAT_API_URL = 'https://chainway-chat.chainway.workers.dev/chat';
  const HISTORY_KEY = 'chainwayAiChatHistory';
  const NUDGE_DISMISSED_KEY = 'chainwayAiNudgeDismissed';
  const KNOWN_CATEGORIES = [
    'Mobile Computers', 'Handheld RFID Readers', 'Fixed RFID Readers', 'Bluetooth RFID Readers',
    'RFID Modules', 'RFID Software', 'Rugged Tablets', 'Vehicle Computers', 'Printers',
    'Biometric Readers', 'Mobility Family',
  ];
  const ACTION_RE = /\[\[CHAINWAY_ACTION\]\]([\s\S]*?)\[\[\/CHAINWAY_ACTION\]\]/;

  const $ = selector => document.querySelector(selector);

  const chat = $('#aiChat');
  const toggle = $('#aiChatToggle');
  const panel = $('#aiChatPanel');
  const closeBtn = $('#aiChatClose');
  const newChatBtn = $('#aiChatNew');
  const messagesEl = $('#aiChatMessages');
  const form = $('#aiChatForm');
  const input = $('#aiChatInput');

  if (!chat || !toggle || !panel || !form || !input) return;

  let open = false;
  let sending = false;
  let history = loadHistory();

  // ---------- persistence ----------

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40))); } catch {}
  }

  // ---------- markdown (safe: escapes HTML, then adds a small set of tags) ----------

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function inlineMarkdown(text) {
    let out = escapeHTML(text);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return out;
  }

  function isTableSeparator(line) {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c));
  }

  function splitRow(line) {
    let l = line.trim();
    if (l.startsWith('|')) l = l.slice(1);
    if (l.endsWith('|')) l = l.slice(0, -1);
    return l.split('|').map(c => c.trim());
  }

  function renderMarkdown(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return '';
    const blocks = text.split(/\n{2,}/);

    return blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return '';

      if (lines.length === 1) {
        const heading = lines[0].match(/^#{1,6}\s+(.*)$/);
        if (heading) return `<p class="ai-msg-heading">${inlineMarkdown(heading[1])}</p>`;
      }

      if (lines.length >= 2 && lines[0].includes('|') && isTableSeparator(lines[1])) {
        const header = splitRow(lines[0]);
        const rows = lines.slice(2).filter(l => l.includes('|')).map(splitRow);
        const thead = `<thead><tr>${header.map(h => `<th>${inlineMarkdown(h)}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
        return `<div class="ai-table-wrap"><table>${thead}${tbody}</table></div>`;
      }

      if (lines.every(l => /^[-*]\s+/.test(l))) {
        return `<ul>${lines.map(l => `<li>${inlineMarkdown(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }

      if (lines.every(l => /^\d+\.\s+/.test(l))) {
        return `<ol>${lines.map(l => `<li>${inlineMarkdown(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
      }

      return `<p>${lines.map(inlineMarkdown).join('<br>')}</p>`;
    }).join('');
  }

  // ---------- action protocol (lets replies pre-fill the quote form or filter the catalog) ----------

  function extractAction(text) {
    const match = text.match(ACTION_RE);
    if (!match) return { clean: text, action: null };
    const clean = (text.slice(0, match.index) + text.slice(match.index + match[0].length)).trim();
    let action = null;
    try { action = JSON.parse(match[1]); } catch { action = null; }
    return { clean, action };
  }

  function runAction(action) {
    if (!action || typeof action !== 'object') return;
    if (action.type === 'quote') {
      const interestField = $('#interestField');
      const messageField = document.querySelector('#quoteForm textarea[name="message"]');
      if (interestField && typeof action.product === 'string') interestField.value = action.product;
      if (messageField && typeof action.message === 'string' && !messageField.value.trim()) messageField.value = action.message;
      $('#contact')?.scrollIntoView({ behavior: 'smooth' });
    } else if (action.type === 'filter' && KNOWN_CATEGORIES.includes(action.category)) {
      window.ChainwayApp?.setCategoryFilter(action.category);
    } else if (action.type === 'compare' && Array.isArray(action.products)) {
      window.ChainwayApp?.compareProducts(action.products);
    }
  }

  // ---------- rendering ----------

  function formatTime(ts) {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  }

  function appendMessage(role, text, ts = Date.now()) {
    const row = document.createElement('div');
    row.className = `ai-msg ai-msg-${role}`;
    const stack = document.createElement('div');
    stack.className = 'ai-msg-stack';
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';
    if (role === 'assistant') bubble.innerHTML = renderMarkdown(text);
    else bubble.textContent = text;
    const time = document.createElement('span');
    time.className = 'ai-msg-time';
    time.textContent = formatTime(ts);
    stack.appendChild(bubble);
    stack.appendChild(time);
    row.appendChild(stack);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function appendTyping() {
    const row = document.createElement('div');
    row.className = 'ai-msg ai-msg-assistant ai-msg-typing';
    row.innerHTML = '<div class="ai-msg-stack"><div class="ai-msg-bubble"><span></span><span></span><span></span></div></div>';
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function greet() {
    appendMessage('assistant', "Hi, I'm the Chainway assistant. Ask me about RFID readers, mobile computers, tablets or which device fits your workflow.");
  }

  function restoreHistory() {
    if (!history.length) return;
    history.forEach(m => appendMessage(m.role, m.content, m.ts || Date.now()));
  }

  function setOpen(next) {
    open = next;
    chat.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    if (open) {
      if (!messagesEl.childElementCount) greet();
      stopNudges();
      setTimeout(() => input.focus(), 150);
    }
  }

  // ---------- sending ----------

  async function send(text) {
    if (sending) return;
    sending = true;
    const userTs = Date.now();
    appendMessage('user', text, userTs);
    history.push({ role: 'user', content: text, ts: userTs });
    saveHistory();

    const typingRow = appendTyping();
    let bubble = null;
    let full = '';

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop();
        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find(line => line.startsWith('data:'));
          if (!dataLine) continue;
          const raw = dataLine.slice(5).trim();
          if (raw === '[DONE]') { done = true; break; }
          let payload;
          try { payload = JSON.parse(raw); } catch { continue; }
          const delta = payload.choices?.[0]?.delta?.content;
          if (delta) {
            if (!bubble) { typingRow.remove(); bubble = appendMessage('assistant', '', Date.now()); }
            full += delta;
            bubble.textContent = full;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }
      }

      if (!full) throw new Error('Empty response');

      const { clean, action } = extractAction(full);
      bubble.innerHTML = renderMarkdown(clean);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      history.push({ role: 'assistant', content: clean, ts: Date.now() });
      saveHistory();

      if (action) runAction(action);
    } catch (err) {
      typingRow.remove();
      appendMessage('assistant', "Sorry, I couldn't reach the assistant just now. Please try again, or contact sales@chainwayafrica.co.za / +27 (0)11 077 9700.");
    } finally {
      sending = false;
    }
  }

  function newChat() {
    if (sending) return;
    history = [];
    saveHistory();
    messagesEl.innerHTML = '';
    greet();
  }

  toggle.addEventListener('click', () => setOpen(!open));
  closeBtn?.addEventListener('click', () => setOpen(false));
  newChatBtn?.addEventListener('click', newChat);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;
    input.value = '';
    setOpen(true);
    send(text);
  });

  window.ChainwayChat = {
    ask(text) {
      if (typeof text !== 'string' || !text.trim() || sending) return;
      setOpen(true);
      send(text.trim());
    },
  };

  restoreHistory();

  // ---------- attention-grabbing nudge bubbles ----------

  const NUDGE_QUESTIONS = [
    'Need an RFID reader for warehouse counting?',
    'Which mobile computer suits cold storage?',
    'Looking for a rugged tablet with built-in RFID?',
    'Want a device for retail stock takes?',
    'Need a Bluetooth RFID sled for your phone?',
    'Curious about fixed RFID readers for dock doors?',
    'Which scanner fits a logistics fleet?',
    'Need a vehicle-mount computer for forklifts?',
    'Looking for an RFID printer for tagging?',
    "Not sure which Chainway device fits your workflow?",
  ];

  let nudgeEl = null;
  let nudgeShowTimer = null;
  let nudgeHideTimer = null;
  let lastQuestion = '';

  function nudgesAllowed() {
    return !open && sessionStorage.getItem(NUDGE_DISMISSED_KEY) !== '1';
  }

  function pickQuestion() {
    let question = lastQuestion;
    while (question === lastQuestion) {
      question = NUDGE_QUESTIONS[Math.floor(Math.random() * NUDGE_QUESTIONS.length)];
    }
    lastQuestion = question;
    return question;
  }

  function showNudge() {
    if (!nudgesAllowed()) return;
    const question = pickQuestion();
    hideNudge();

    nudgeEl = document.createElement('div');
    nudgeEl.className = 'ai-chat-nudge';
    nudgeEl.innerHTML = `<button class="ai-chat-nudge-close" type="button" aria-label="Dismiss">×</button><span></span>`;
    nudgeEl.querySelector('span').textContent = question;
    chat.appendChild(nudgeEl);
    toggle.classList.add('pulse');

    nudgeEl.addEventListener('click', event => {
      if (event.target.closest('.ai-chat-nudge-close')) {
        sessionStorage.setItem(NUDGE_DISMISSED_KEY, '1');
        hideNudge();
        clearTimeout(nudgeShowTimer);
        return;
      }
      hideNudge();
      setOpen(true);
      send(question);
    });

    nudgeHideTimer = setTimeout(() => {
      hideNudge();
      scheduleNudge(38000 + Math.random() * 20000);
    }, 11000);
  }

  function hideNudge() {
    clearTimeout(nudgeHideTimer);
    toggle.classList.remove('pulse');
    if (nudgeEl) { nudgeEl.remove(); nudgeEl = null; }
  }

  function stopNudges() {
    clearTimeout(nudgeShowTimer);
    clearTimeout(nudgeHideTimer);
    hideNudge();
  }

  function scheduleNudge(delay) {
    clearTimeout(nudgeShowTimer);
    if (!nudgesAllowed()) return;
    nudgeShowTimer = setTimeout(showNudge, delay);
  }

  scheduleNudge(9000);
})();
