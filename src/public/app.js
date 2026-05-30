/* LBR Offseason Hub — frontend logic
   ============================================ */

const STORAGE_TOKEN_KEY = 'lbr_offseason_token';
const STATUS_OPTIONS = [
  { value: 'nao-iniciado', label: 'Não iniciado' },
  { value: 'em-producao', label: 'Em produção' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'existe-refresh', label: 'Existe / refresh' },
  { value: 'aguardando-fonte', label: 'Aguardando fonte' },
];
const NEWS_STATUS_OPTIONS = [
  { value: 'aguardando', label: 'Aguardando gatilho' },
  { value: 'em-curso', label: 'Em curso' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'cancelado', label: 'Cancelado' },
];
const MONTHS = [
  { key: 'jun', label: 'Jun/26' },
  { key: 'jul', label: 'Jul/26' },
  { key: 'ago', label: 'Ago/26' },
  { key: 'set', label: 'Set/26' },
  { key: 'out', label: 'Out/26' },
];

let state = null;
let isAuthed = false;
let isDirty = false;
let saveTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ============================================
   STATUS INDICATOR
   ============================================ */

function setStatus(text, cls = '') {
  const el = $('#status-indicator');
  el.textContent = text;
  el.className = `status ${cls}`;
}

function markDirty() {
  if (!isAuthed) return;
  isDirty = true;
  setStatus('Mudanças não salvas', 'dirty');
  $('#save-btn').disabled = false;
}

function markClean() {
  isDirty = false;
  setStatus('Salvo', 'saved');
  $('#save-btn').disabled = true;
}

/* ============================================
   AUTH
   ============================================ */

function getToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) localStorage.setItem(STORAGE_TOKEN_KEY, token);
  else localStorage.removeItem(STORAGE_TOKEN_KEY);
}

function applyAuthState() {
  const token = getToken();
  isAuthed = !!token;
  const loginBtn = $('#login-btn');
  loginBtn.textContent = isAuthed ? 'Sair' : 'Entrar';

  $$('input, select, textarea, .rumor-add-btn').forEach((el) => {
    if (el.dataset.editable !== 'false') el.disabled = !isAuthed;
  });

  if (isAuthed) {
    setStatus('Pronto pra editar', 'saved');
    $('#save-btn').disabled = !isDirty;
  } else {
    setStatus('Modo visualização', 'locked');
    $('#save-btn').disabled = true;
  }
}

async function attemptLogin(password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Senha incorreta');
    }
    const data = await res.json();
    setToken(data.token);
    applyAuthState();
    closeLoginModal();
    toast('Bem-vindo. Você pode editar agora.', 'success');
  } catch (err) {
    $('#login-error').hidden = false;
    $('#login-error').textContent = err.message;
  }
}

function logout() {
  setToken('');
  applyAuthState();
  toast('Você saiu. Modo visualização ativo.', 'success');
}

function openLoginModal() {
  $('#login-modal').hidden = false;
  $('#login-error').hidden = true;
  $('#login-password').value = '';
  setTimeout(() => $('#login-password').focus(), 50);
}

function closeLoginModal() {
  $('#login-modal').hidden = true;
}

/* ============================================
   FETCH & SAVE
   ============================================ */

async function loadState() {
  setStatus('Carregando…', '');
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state = await res.json();
    renderAll();
    applyAuthState();
  } catch (err) {
    setStatus('Erro ao carregar', 'error');
    toast(`Erro ao carregar: ${err.message}`, 'error');
  }
}

async function saveState() {
  if (!isAuthed) {
    toast('Faça login pra salvar.', 'error');
    return;
  }
  if (!isDirty) return;

  setStatus('Salvando…', 'saving');
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify(state),
    });
    if (res.status === 401) {
      setToken('');
      applyAuthState();
      toast('Sessão expirou. Faça login novamente.', 'error');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (state.meta) state.meta.lastUpdated = data.savedAt;
    updateLastUpdatedLabel();
    markClean();
    toast('Salvo com sucesso.', 'success');
  } catch (err) {
    setStatus('Erro ao salvar', 'error');
    toast(`Erro ao salvar: ${err.message}`, 'error');
  }
}

/* ============================================
   RENDER — overview
   ============================================ */

function renderOverview() {
  $('#stat-pillars').textContent = state.pillars?.length || 0;
  $('#stat-news').textContent = state.newsBacklog?.length || 0;
  $('#stat-analyses').textContent = state.analyses?.length || 0;
  $('#global-notes').value = state.globalNotes || '';
  updateLastUpdatedLabel();
}

function updateLastUpdatedLabel() {
  const lu = state?.meta?.lastUpdated;
  if (!lu) {
    $('#last-updated').textContent = '—';
    return;
  }
  try {
    const d = new Date(lu);
    const fmt = d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    $('#last-updated').textContent = `Atualizado em ${fmt}`;
  } catch {
    $('#last-updated').textContent = lu;
  }
}

/* ============================================
   RENDER — calendar
   ============================================ */

function fmtDateRange(start, end) {
  const d1 = new Date(start);
  const d2 = end ? new Date(end) : null;
  const opts = { day: '2-digit', month: '2-digit' };
  const s1 = d1.toLocaleDateString('pt-BR', opts);
  if (!d2 || s1 === d2.toLocaleDateString('pt-BR', opts)) return s1;
  return `${s1} – ${d2.toLocaleDateString('pt-BR', opts)}`;
}

function renderCalendar() {
  const body = $('#calendar-body');
  body.innerHTML = '';
  (state.calendar || []).forEach((ev) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${fmtDateRange(ev.date, ev.end)}</strong></td>
      <td>${escapeHtml(ev.event)}</td>
      <td>${escapeHtml(ev.coverage)}</td>
    `;
    body.appendChild(tr);
  });
}

/* ============================================
   RENDER — pillars
   ============================================ */

function statusBadge(value, options = STATUS_OPTIONS) {
  const opt = options.find((o) => o.value === value);
  const label = opt ? opt.label : value;
  return `<span class="badge ${value}">${escapeHtml(label)}</span>`;
}

function statusSelect(value, options, onChange) {
  const sel = document.createElement('select');
  sel.className = 'select';
  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', (e) => {
    onChange(e.target.value);
    markDirty();
  });
  return sel;
}

function renderPillars() {
  const grid = $('#pillars-grid');
  grid.innerHTML = '';
  (state.pillars || []).forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'card pillar-card';
    card.innerHTML = `
      <div class="pillar-meta">
        ${statusBadge(p.status)}
        <span class="muted small">${escapeHtml(p.window)}</span>
      </div>
      <h3>${escapeHtml(p.name)}</h3>
      <div class="pillar-row">
        <span class="label">URL prevista</span>
        <code class="value muted small">${escapeHtml(p.url)}</code>
      </div>
      <div class="pillar-row">
        <span class="label">Query-mãe</span>
        <span class="value muted small">${escapeHtml(p.query)}</span>
      </div>
      <div class="pillar-row">
        <span class="label">Status</span>
        <span class="value" data-field="status"></span>
      </div>
      <div class="pillar-row">
        <span class="label">Owner</span>
        <input class="input input-inline" data-field="owner" value="${escapeAttr(p.owner)}" placeholder="quem cuida" />
      </div>
      <div class="pillar-row">
        <span class="label">Data alvo</span>
        <input class="input input-inline" type="date" data-field="targetPublishDate" value="${escapeAttr(p.targetPublishDate)}" />
      </div>
      <div class="pillar-row">
        <span class="label">URL publicada</span>
        <input class="input input-inline" data-field="publishedUrl" value="${escapeAttr(p.publishedUrl)}" placeholder="https://lakersbrasil.com/…" />
      </div>
      <div class="pillar-row">
        <span class="label">Cliques 7d</span>
        <input class="input input-inline" type="number" data-field="clicks7d" value="${p.metrics?.clicks7d ?? ''}" />
      </div>
      <div class="pillar-row">
        <span class="label">Cliques 30d</span>
        <input class="input input-inline" type="number" data-field="clicks30d" value="${p.metrics?.clicks30d ?? ''}" />
      </div>
      <div class="pillar-row">
        <span class="label">CTR / pos</span>
        <div style="display:flex;gap:0.5rem">
          <input class="input input-inline" type="number" step="0.01" data-field="ctr" value="${p.metrics?.ctr ?? ''}" placeholder="CTR %" />
          <input class="input input-inline" type="number" step="0.1" data-field="position" value="${p.metrics?.position ?? ''}" placeholder="Posição" />
        </div>
      </div>
      <div class="pillar-notes">
        <textarea class="textarea" data-field="notes" rows="3" placeholder="Notas, decisões, contextos…">${escapeHtml(p.notes || '')}</textarea>
      </div>
    `;

    const statusSpan = card.querySelector('[data-field="status"]');
    statusSpan.appendChild(statusSelect(p.status, STATUS_OPTIONS, (v) => {
      state.pillars[idx].status = v;
      const badge = card.querySelector('.pillar-meta .badge');
      badge.outerHTML = statusBadge(v);
    }));

    card.querySelectorAll('input[data-field], textarea[data-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const field = el.dataset.field;
        const value = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
        if (['clicks7d', 'clicks30d', 'ctr', 'position'].includes(field)) {
          if (!state.pillars[idx].metrics) state.pillars[idx].metrics = {};
          state.pillars[idx].metrics[field] = value;
        } else {
          state.pillars[idx][field] = value;
        }
        markDirty();
      });
    });

    grid.appendChild(card);
  });
}

/* ============================================
   RENDER — news backlog
   ============================================ */

function renderNews() {
  const body = $('#news-body');
  body.innerHTML = '';
  (state.newsBacklog || []).forEach((n, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(n.trigger)}</strong></td>
      <td><code class="muted small">${escapeHtml(n.titleFormat)}</code></td>
      <td>${escapeHtml(n.window)}</td>
      <td data-field="status"></td>
      <td><input class="input input-inline" data-field="owner" value="${escapeAttr(n.owner)}" placeholder="owner" /></td>
      <td><input class="input input-inline" data-field="notes" value="${escapeAttr(n.notes)}" placeholder="notas…" /></td>
    `;
    const statusTd = tr.querySelector('[data-field="status"]');
    statusTd.appendChild(statusSelect(n.status, NEWS_STATUS_OPTIONS, (v) => {
      state.newsBacklog[idx].status = v;
    }));

    tr.querySelectorAll('input[data-field]').forEach((el) => {
      el.addEventListener('input', () => {
        state.newsBacklog[idx][el.dataset.field] = el.value;
        markDirty();
      });
    });

    body.appendChild(tr);
  });
}

/* ============================================
   RENDER — rumors
   ============================================ */

function renderRumors() {
  const tList = $('#rumors-templates');
  tList.innerHTML = '';
  (state.rumorsTemplates || []).forEach((t) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(t.trigger)}:</strong> <code>${escapeHtml(t.titleFormat)}</code>`;
    tList.appendChild(li);
  });

  const grid = $('#rumors-grid');
  grid.innerHTML = '';
  MONTHS.forEach((m) => {
    const items = state.rumorsPipeline?.[m.key] || [];
    const col = document.createElement('div');
    col.className = 'rumor-month';
    col.innerHTML = `
      <div class="rumor-month-head">
        <h4>${m.label}</h4>
        <span class="muted small">${items.length}</span>
      </div>
      <div class="rumor-list"></div>
      <button class="rumor-add-btn" type="button">+ Adicionar rumor</button>
    `;
    const list = col.querySelector('.rumor-list');
    items.forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'rumor-item';
      div.innerHTML = `
        <div>${escapeHtml(it.title)}</div>
        <div class="rumor-source">${escapeHtml(it.source)} · ${escapeHtml(it.date || '')}</div>
        <button class="btn-icon" title="Remover">✕</button>
      `;
      div.querySelector('.btn-icon').addEventListener('click', () => {
        if (!isAuthed) return;
        state.rumorsPipeline[m.key].splice(idx, 1);
        renderRumors();
        markDirty();
      });
      list.appendChild(div);
    });
    const addBtn = col.querySelector('.rumor-add-btn');
    addBtn.disabled = !isAuthed;
    addBtn.addEventListener('click', () => {
      if (!isAuthed) return;
      const title = prompt('Título do rumor (ex: "Lakers de olho em Kevin Durant"):');
      if (!title) return;
      const source = prompt('Fonte (ex: "Shams / The Athletic"):') || '';
      const date = prompt('Data (YYYY-MM-DD, opcional):') || '';
      if (!state.rumorsPipeline[m.key]) state.rumorsPipeline[m.key] = [];
      state.rumorsPipeline[m.key].push({ title, source, date });
      renderRumors();
      markDirty();
    });
    grid.appendChild(col);
  });
}

/* ============================================
   RENDER — analyses
   ============================================ */

function renderAnalyses() {
  const grid = $('#analyses-grid');
  grid.innerHTML = '';
  (state.analyses || []).forEach((a, idx) => {
    const card = document.createElement('div');
    card.className = 'card analysis-card';
    card.innerHTML = `
      <span class="analysis-date">${escapeHtml(a.publishDate)}</span>
      <h3 class="analysis-theme">${escapeHtml(a.theme)}</h3>
      <p class="analysis-template">${escapeHtml(a.titleTemplate)}</p>
      <div class="pillar-row">
        <span class="label">Status</span>
        <span class="value" data-field="status"></span>
      </div>
      <div class="pillar-row">
        <span class="label">Owner</span>
        <input class="input input-inline" data-field="owner" value="${escapeAttr(a.owner)}" placeholder="owner" />
      </div>
      <textarea class="textarea" data-field="notes" rows="2" placeholder="Notas…">${escapeHtml(a.notes || '')}</textarea>
    `;
    const statusSpan = card.querySelector('[data-field="status"]');
    statusSpan.appendChild(statusSelect(a.status, STATUS_OPTIONS, (v) => {
      state.analyses[idx].status = v;
    }));
    card.querySelectorAll('input[data-field], textarea[data-field]').forEach((el) => {
      el.addEventListener('input', () => {
        state.analyses[idx][el.dataset.field] = el.value;
        markDirty();
      });
    });
    grid.appendChild(card);
  });
}

/* ============================================
   RENDER — KPIs
   ============================================ */

function renderKpis() {
  const body = $('#kpis-body');
  body.innerHTML = '';
  MONTHS.forEach((m) => {
    const k = state.kpis?.monthly?.[m.key] || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${m.label}</strong></td>
      <td>
        <div class="kpi-cell">
          <span class="kpi-target ${k.clicksTarget ? '' : 'muted'}">${k.clicksTarget?.toLocaleString('pt-BR') || '—'}</span>
          <span class="kpi-sep">/</span>
          <input class="input kpi-actual" type="number" data-field="clicksActual" value="${k.clicksActual ?? ''}" placeholder="real" />
        </div>
      </td>
      <td>
        <div class="kpi-cell">
          <span class="kpi-target">${k.ctrTarget ? k.ctrTarget.toFixed(1) + '%' : '—'}</span>
          <span class="kpi-sep">/</span>
          <input class="input kpi-actual" type="number" step="0.01" data-field="ctrActual" value="${k.ctrActual ?? ''}" placeholder="real" />
        </div>
      </td>
      <td>
        <div class="kpi-cell">
          <span class="kpi-target">${k.evergreenShareTarget ? k.evergreenShareTarget + '%' : '—'}</span>
          <span class="kpi-sep">/</span>
          <input class="input kpi-actual" type="number" data-field="evergreenShareActual" value="${k.evergreenShareActual ?? ''}" placeholder="real" />
        </div>
      </td>
      <td>
        <div class="kpi-cell">
          <span class="kpi-target">${escapeHtml(k.piecesTarget || '—')}</span>
          <span class="kpi-sep">/</span>
          <input class="input kpi-actual" type="number" data-field="piecesActual" value="${k.piecesActual ?? ''}" placeholder="real" />
        </div>
      </td>
      <td><input class="input input-inline" data-field="notes" value="${escapeAttr(k.notes)}" placeholder="notas…" /></td>
    `;

    tr.querySelectorAll('input[data-field]').forEach((el) => {
      el.addEventListener('input', () => {
        if (!state.kpis) state.kpis = { monthly: {} };
        if (!state.kpis.monthly[m.key]) state.kpis.monthly[m.key] = {};
        const field = el.dataset.field;
        const value = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
        state.kpis.monthly[m.key][field] = value;
        markDirty();
      });
    });

    body.appendChild(tr);
  });
}

/* ============================================
   RENDER — discards
   ============================================ */

function renderDiscards() {
  const ul = $('#discards-list');
  ul.innerHTML = '';
  (state.discards || []).forEach((d) => {
    const li = document.createElement('li');
    li.textContent = d;
    ul.appendChild(li);
  });
}

/* ============================================
   RENDER ALL
   ============================================ */

function renderAll() {
  if (!state) return;
  renderOverview();
  renderCalendar();
  renderPillars();
  renderNews();
  renderRumors();
  renderAnalyses();
  renderKpis();
  renderDiscards();
  $('#footer-version').textContent = `v${state.meta?.version || '0.1.0'}`;
}

/* ============================================
   GLOBAL NOTES
   ============================================ */

$('#global-notes').addEventListener('input', (e) => {
  state.globalNotes = e.target.value;
  markDirty();
});

/* ============================================
   EXPORT
   ============================================ */

function exportJson() {
  if (!state) return;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `lbr-offseason-state-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('JSON exportado.', 'success');
}

/* ============================================
   TOAST
   ============================================ */

let toastTimer = null;
function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

/* ============================================
   UTIL
   ============================================ */

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

/* ============================================
   EVENT BINDINGS
   ============================================ */

$('#login-btn').addEventListener('click', () => {
  if (isAuthed) logout();
  else openLoginModal();
});

$('#login-cancel').addEventListener('click', closeLoginModal);
$('#login-submit').addEventListener('click', () => {
  const pwd = $('#login-password').value.trim();
  if (!pwd) return;
  attemptLogin(pwd);
});

$('#login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const pwd = $('#login-password').value.trim();
    if (pwd) attemptLogin(pwd);
  }
});

$('#login-modal .modal-backdrop').addEventListener('click', closeLoginModal);

$('#save-btn').addEventListener('click', saveState);
$('#export-btn').addEventListener('click', exportJson);

// Save com Ctrl+S
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (isAuthed && isDirty) saveState();
  }
});

// Warn de saída com mudanças não salvas
window.addEventListener('beforeunload', (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ============================================
   BOOT
   ============================================ */

loadState();
