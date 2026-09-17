import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import './style.css';

// Types
interface KittyForegroundProcess {
  cmdline: string[];
  cwd: string;
  pid: number;
}

interface ProcessMeta {
  type: 'ai' | 'server' | 'editor' | 'shell' | 'terminal';
  label: string;
  badge: string;
  color: string;
  isAiAgent: boolean;
}

interface KittyWindow {
  id: number | string;
  compositeId: string;
  provider?: string;
  providerLabel?: string;
  socketPath?: string;
  socketPid?: number;
  title: string;
  cwd: string;
  pid: number;
  lines: number;
  columns: number;
  is_focused: boolean;
  is_active: boolean;
  supportsMirror?: boolean;
  supportsInput?: boolean;
  foreground_processes: KittyForegroundProcess[];
  category: string;
  meta: ProcessMeta;
  workspace?: string;
  systemDetails?: {
    tty: string;
    parentEmulator?: string;
    cpu?: string;
    memory?: string;
  };
}

interface PTYItem {
  id: string;
  title: string;
  cwd: string;
}

interface SystemInfo {
  hostname: string;
  uptime: number;
  freemem: number;
  totalmem: number;
  loadavg: number[];
}

interface TunnelInfo {
  active: boolean;
  url: string | null;
  killedBySecurity: boolean;
  killedReason: string | null;
  violationsCount: number;
}

// App State
let token = localStorage.getItem('termdeck_token') || '';
let ws: WebSocket | null = null;
let currentView: 'auth' | 'dashboard' | 'terminal' = 'auth';
let activeCategoryFilter: string = 'all';

let terminals: KittyWindow[] = [];
let ptys: PTYItem[] = [];
let systemInfo: SystemInfo | null = null;
let tunnelInfo: TunnelInfo | null = null;

// Active Terminal state
let activeSessionType: 'kitty' | 'pty' | null = null;
let activeSessionId: string | null = null;
let termInstance: Terminal | null = null;
let fitAddon: FitAddon | null = null;

// Scrolling & History state
let isUserScrolledUp = false;
let pendingKittyContent: string | null = null;

// Modifier states
let ctrlActive = false;
let altActive = false;

// DOM Elements
const app = document.getElementById('app')!;

function vibrate(ms = 12) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {}
  }
}

function showToast(msg: string) {
  let toast = document.querySelector('.toast-container') as HTMLDivElement;
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-container';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2200);
}

// ----------------------------------------------------
// API Helpers
// ----------------------------------------------------

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    token = '';
    localStorage.removeItem('termdeck_token');
    render();
    throw new Error('Unauthorized');
  }
  return res.json();
}

async function fetchSystemStats() {
  try {
    const [sys, tunnel] = await Promise.all([
      api('/api/system').catch(() => null),
      api('/api/tunnel/status').catch(() => null),
    ]);
    if (sys) systemInfo = sys;
    if (tunnel) tunnelInfo = tunnel;
    updateSystemDisplay();
  } catch {}
}

async function fetchTerminals() {
  try {
    const data = await api('/api/terminals');
    terminals = data.terminals || [];
    ptys = data.ptys || [];
    if (currentView === 'dashboard') {
      renderDashboardCards();
    }
  } catch {}
}

// ----------------------------------------------------
// WebSocket
// ----------------------------------------------------

function connectWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateStatusBadge(true);
    // If returning to an active terminal
    if (activeSessionType === 'kitty' && activeSessionId) {
      ws?.send(JSON.stringify({ type: 'subscribe_kitty', compositeId: activeSessionId }));
    } else if (activeSessionType === 'pty' && activeSessionId) {
      ws?.send(JSON.stringify({ type: 'pty_subscribe', id: activeSessionId }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'terminals_update') {
        terminals = msg.terminals || [];
        ptys = msg.ptys || [];
        if (currentView === 'dashboard') {
          renderDashboardCards();
        }
      } else if (msg.type === 'kitty_screen' && activeSessionType === 'kitty') {
        if (termInstance) {
          if (isUserScrolledUp) {
            // User is reviewing history, save buffer and don't interrupt
            pendingKittyContent = msg.content;
            checkScrollStatus();
          } else {
            termInstance.reset();
            termInstance.write(msg.content);
            termInstance.scrollToBottom();
          }
        }
      } else if (msg.type === 'pty_data' && activeSessionType === 'pty') {
        if (termInstance) {
          termInstance.write(msg.data);
        }
      } else if (msg.type === 'pty_exit') {
        showToast('Powłoka PTY zakończyła działanie');
        if (activeSessionType === 'pty') {
          closeTerminalView();
        }
      }
    } catch {}
  };

  ws.onclose = () => {
    updateStatusBadge(false);
    // Reconnect on network drops / screen unlock
    setTimeout(() => {
      if (token) connectWS();
    }, 2000);
  };
}

function updateStatusBadge(online: boolean) {
  const badge = document.getElementById('live-status-pill');
  if (badge) {
    badge.innerHTML = online
      ? '<span class="pulse-dot"></span> Live'
      : '<span style="width:7px;height:7px;border-radius:50%;background:#f38ba8;"></span> Offline';
  }
}

// ----------------------------------------------------
// Rendering Views
// ----------------------------------------------------

export function render() {
  app.innerHTML = '';
  if (!token) {
    currentView = 'auth';
    renderAuthView();
  } else if (currentView === 'terminal') {
    renderTerminalView();
  } else {
    currentView = 'dashboard';
    renderDashboardView();
  }
}

// 1. PIN / AUTH VIEW
function renderAuthView() {
  let enteredPin = '';

  const div = document.createElement('div');
  div.className = 'auth-view';
  div.innerHTML = `
    <div class="auth-card">
      <img src="/icon.svg" class="auth-logo" alt="TermDeck Logo"/>
      <h1 class="auth-title">TermDeck</h1>
      <p class="auth-sub">Podaj PIN aby połączyć się ze stacją roboczą</p>
      <div class="pin-display">
        <div class="pin-slot" id="slot-0"></div>
        <div class="pin-slot" id="slot-1"></div>
        <div class="pin-slot" id="slot-2"></div>
        <div class="pin-slot" id="slot-3"></div>
      </div>
      <div class="numpad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((n) => `<button class="numpad-btn" data-val="${n}">${n}</button>`)
          .join('')}
        <button class="numpad-btn" id="btn-clear" style="font-size: 1rem;">C</button>
        <button class="numpad-btn" data-val="0">0</button>
        <button class="numpad-btn" id="btn-back">⌫</button>
      </div>
    </div>
  `;
  app.appendChild(div);

  function updateSlots() {
    for (let i = 0; i < 4; i++) {
      const slot = document.getElementById(`slot-${i}`);
      if (slot) {
        if (i < enteredPin.length) {
          slot.classList.add('filled');
        } else {
          slot.classList.remove('filled');
        }
      }
    }
  }

  async function submitPin() {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        token = data.token;
        localStorage.setItem('termdeck_token', token);
        vibrate(30);
        showToast('Połączono pomyślnie!');
        connectWS();
        currentView = 'dashboard';
        render();
      } else {
        vibrate(80);
        showToast('Błędny PIN!');
        enteredPin = '';
        updateSlots();
      }
    } catch {
      showToast('Błąd połączenia z serwerem');
    }
  }

  div.querySelectorAll('.numpad-btn[data-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (enteredPin.length < 4) {
        vibrate();
        enteredPin += btn.getAttribute('data-val');
        updateSlots();
        if (enteredPin.length === 4) {
          submitPin();
        }
      }
    });
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    vibrate();
    enteredPin = '';
    updateSlots();
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    vibrate();
    enteredPin = enteredPin.slice(0, -1);
    updateSlots();
  });
}

function hexToRgba(hex: string, alpha = 0.15): string {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(137, 180, 250, ${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16) || 137;
  const g = parseInt(hex.slice(3, 5), 16) || 180;
  const b = parseInt(hex.slice(5, 7), 16) || 250;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 2. DASHBOARD VIEW
function renderDashboardView() {
  const container = document.createElement('div');
  container.className = 'dashboard-wrapper';

  container.innerHTML = `
    <header class="app-header">
      <div class="brand">
        <img src="/icon.svg" class="brand-icon" alt="TermDeck"/>
        <span class="brand-name">TermDeck</span>
      </div>
      <div class="header-meta">
        ${
          tunnelInfo?.active
            ? `
          <div class="tunnel-pill" title="Publiczny tunel Cloudflare (token 256-bit)">
            <span class="pulse-dot-blue"></span> Zdalny
          </div>
        `
            : ''
        }
        <div class="status-pill" id="live-status-pill">
          <span class="pulse-dot"></span> Live
        </div>
        <button class="btn-icon" id="btn-refresh" title="Odśwież">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
      </div>
    </header>

    <main class="dashboard-view">
      ${
        tunnelInfo?.killedBySecurity
          ? `
        <div class="security-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <strong>ALARM BEZPIECZEŃSTWA:</strong> Tunel zniszczony po wykryciu nieautoryzowanych prób!<br>
            <small style="opacity: 0.85;">${tunnelInfo.killedReason || ''}</small>
          </div>
        </div>
      `
          : ''
      }
      <div class="system-strip" id="system-strip">
        <div class="system-stat">
          <span>Host</span>
          <span class="system-stat-value" id="stat-host">wulf420</span>
        </div>
        <div class="system-stat">
          <span>RAM</span>
          <span class="system-stat-value" id="stat-ram">--%</span>
        </div>
        <div class="system-stat">
          <span>Uptime</span>
          <span class="system-stat-value" id="stat-uptime">--</span>
        </div>
      </div>

      <div class="actions-strip" id="filters-strip">
        <button class="btn-primary" id="btn-new-pty">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nowy Shell (Fish)
        </button>
        <div id="dynamic-chips" style="display: flex; gap: 8px;"></div>
      </div>

      <div class="cards-grid" id="cards-container">
        <!-- Rendered by renderDashboardCards -->
      </div>
    </main>
  `;

  app.appendChild(container);

  // Bind Header
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    vibrate();
    fetchTerminals();
    fetchSystemStats();
  });

  document.getElementById('btn-new-pty')?.addEventListener('click', async () => {
    vibrate(20);
    try {
      const res = await api('/api/pty/create', { method: 'POST' });
      if (res && res.id) {
        showToast('Utworzono nowy terminal');
        openTerminalView('pty', res.id, res.title);
      }
    } catch {
      showToast('Błąd tworzenia powłoki');
    }
  });

  fetchSystemStats();
  fetchTerminals();
  renderDashboardCards();
}

function renderFilterChips() {
  const container = document.getElementById('dynamic-chips');
  if (!container) return;

  const total = terminals.length + ptys.length;
  const aiCount = terminals.filter((t) => t.meta?.isAiAgent).length;

  // Group by tool label
  const toolsMap = new Map<string, { count: number; color: string; isAi: boolean }>();
  for (const t of terminals) {
    const label = t.meta?.label || 'Terminal';
    const existing = toolsMap.get(label) || {
      count: 0,
      color: t.meta?.color || '#89b4fa',
      isAi: !!t.meta?.isAiAgent,
    };
    existing.count += 1;
    toolsMap.set(label, existing);
  }

  const chips: Array<{ id: string; label: string }> = [
    { id: 'all', label: `Wszystkie (${total})` },
  ];

  if (aiCount > 0) {
    chips.push({ id: 'ai', label: `🤖 Wszyscy Agenci AI (${aiCount})` });
  }

  // Add individual tool chips
  for (const [toolName, info] of toolsMap.entries()) {
    const icon = info.isAi ? '🤖' : '💻';
    chips.push({ id: `tool:${toolName}`, label: `${icon} ${toolName} (${info.count})` });
  }

  if (ptys.length > 0) {
    chips.push({ id: 'shell', label: `🐚 Shell (${ptys.length})` });
  }

  container.innerHTML = chips
    .map(
      (c) => `
      <button class="filter-chip ${activeCategoryFilter === c.id ? 'active' : ''}" data-filter="${c.id}">
        ${c.label}
      </button>
    `
    )
    .join('');

  container.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      vibrate();
      container.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      activeCategoryFilter = btn.getAttribute('data-filter') || 'all';
      renderDashboardCards();
    });
  });
}

function updateSystemDisplay() {
  if (!systemInfo) return;
  const hostEl = document.getElementById('stat-host');
  const ramEl = document.getElementById('stat-ram');
  const uptimeEl = document.getElementById('stat-uptime');

  if (hostEl) hostEl.textContent = systemInfo.hostname;
  if (ramEl) {
    const used = systemInfo.totalmem - systemInfo.freemem;
    const pct = Math.round((used / systemInfo.totalmem) * 100);
    ramEl.textContent = `${pct}%`;
  }
  if (uptimeEl) {
    const hrs = Math.floor(systemInfo.uptime / 3600);
    const mins = Math.floor((systemInfo.uptime % 3600) / 60);
    uptimeEl.textContent = `${hrs}h ${mins}m`;
  }
}

function renderDashboardCards() {
  const container = document.getElementById('cards-container');
  if (!container) return;

  renderFilterChips();

  container.innerHTML = '';

  // 1. Direct PTY items
  for (const pty of ptys) {
    if (activeCategoryFilter !== 'all' && activeCategoryFilter !== 'shell') continue;

    const card = document.createElement('div');
    card.className = 'session-card';
    card.innerHTML = `
      <div class="card-top">
        <span class="card-badge" style="color: #94e2d5; background: rgba(148, 226, 213, 0.15); border: 1px solid rgba(148, 226, 213, 0.35);">🐚 Direct PTY</span>
        <span class="ws-pill">Mobile</span>
      </div>
      <div class="card-title">${escapeHtml(pty.title)}</div>
      <div class="card-cwd">${escapeHtml(pty.cwd)}</div>
      <div class="card-footer">
        <span class="card-pid">id: ${pty.id}</span>
        <div class="card-actions">
          <button class="btn-secondary btn-kill-pty" data-id="${pty.id}">Zamknij</button>
          <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">Otwórz</button>
        </div>
      </div>
    `;

    card.querySelector('.btn-primary')?.addEventListener('click', (e) => {
      e.stopPropagation();
      vibrate();
      openTerminalView('pty', pty.id, pty.title);
    });

    card.querySelector('.btn-kill-pty')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      vibrate();
      await api(`/api/pty/${pty.id}`, { method: 'DELETE' });
      ptys = ptys.filter((p) => p.id !== pty.id);
      renderDashboardCards();
    });

    card.addEventListener('click', () => {
      vibrate();
      openTerminalView('pty', pty.id, pty.title);
    });

    container.appendChild(card);
  }

  // 2. Kitty Desktop Windows
  const filtered = terminals.filter((t) => {
    if (activeCategoryFilter === 'all') return true;
    if (activeCategoryFilter === 'ai') return t.meta?.isAiAgent;
    if (activeCategoryFilter.startsWith('tool:')) {
      const targetTool = activeCategoryFilter.slice(5);
      return t.meta?.label === targetTool;
    }
    return t.meta?.type === activeCategoryFilter;
  });

  if (filtered.length === 0 && ptys.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 40px 20px;">
        Brak aktywnych terminali w wybranym filtrze.
      </div>
    `;
    return;
  }

  for (const win of filtered) {
    const card = document.createElement('div');
    card.className = `session-card ${win.is_focused ? 'focused' : ''}`;

    const meta = win.meta || {
      type: 'terminal',
      label: 'Terminal',
      badge: 'Terminal',
      color: '#6c7086',
      isAiAgent: false,
    };

    const iconPrefix = meta.isAiAgent
      ? '🤖'
      : meta.type === 'server'
      ? '⚡'
      : meta.type === 'editor'
      ? '🛠️'
      : meta.type === 'shell'
      ? '🐚'
      : '💻';

    const wsText = win.workspace ? `WS ${win.workspace}` : `PID ${win.socketPid}`;
    const badgeStyle = `color: ${meta.color}; background: ${hexToRgba(meta.color, 0.15)}; border: 1px solid ${hexToRgba(meta.color, 0.35)};`;

    const providerName = win.providerLabel || 'Kitty';
    const isReadOnly = win.supportsInput === false;

    card.innerHTML = `
      <div class="card-top">
        <span class="card-badge" style="${badgeStyle}">${iconPrefix} ${escapeHtml(meta.badge)}</span>
        <div style="display: flex; gap: 5px; align-items: center;">
          <span class="provider-pill">${escapeHtml(providerName)}</span>
          <span class="ws-pill">${wsText}</span>
        </div>
      </div>
      <div class="card-title">${escapeHtml(win.title)}</div>
      <div class="card-cwd">${escapeHtml(win.cwd || '~')}</div>
      <div class="card-footer">
        <span class="card-pid">id: ${win.compositeId}</span>
        <div class="card-actions">
          <button class="btn-secondary btn-focus-pc" data-id="${win.compositeId}" title="Pokaż na monitorze PC">
            Focus PC
          </button>
          <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
            ${isReadOnly ? 'Monitor' : 'Podgląd'}
          </button>
        </div>
      </div>
    `;

    card.querySelector('.btn-focus-pc')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      vibrate(25);
      const res = await api(`/api/terminals/${win.compositeId}/focus`, { method: 'POST' });
      showToast(res.success ? 'Aktywowano okno na monitorze' : 'Nie udało się aktywować');
    });

    card.querySelector('.btn-primary')?.addEventListener('click', (e) => {
      e.stopPropagation();
      vibrate();
      openTerminalView('kitty', win.compositeId, win.title);
    });

    card.addEventListener('click', () => {
      vibrate();
      openTerminalView('kitty', win.compositeId, win.title);
    });

    container.appendChild(card);
  }
}

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ----------------------------------------------------
// 3. TERMINAL VIEWPORT (Full Screen on Mobile)
// ----------------------------------------------------

function checkScrollStatus() {
  if (!termInstance) return;
  const buffer = termInstance.buffer.active;
  const isUp = buffer.viewportY < buffer.baseY - 1;
  isUserScrolledUp = isUp;

  const scrollBtn = document.getElementById('btn-scroll-bottom');
  const scrollLabel = document.getElementById('scroll-bottom-label');
  if (scrollBtn && scrollLabel) {
    if (isUp) {
      const diff = buffer.baseY - buffer.viewportY;
      scrollLabel.textContent = `↓ Na dół (${diff})`;
      scrollBtn.style.display = 'flex';
    } else {
      scrollBtn.style.display = 'none';
      if (pendingKittyContent) {
        termInstance.reset();
        termInstance.write(pendingKittyContent);
        termInstance.scrollToBottom();
        pendingKittyContent = null;
      }
    }
  }
}

function openTerminalView(type: 'kitty' | 'pty', id: string, title: string) {
  activeSessionType = type;
  activeSessionId = id;
  isUserScrolledUp = false;
  pendingKittyContent = null;
  currentView = 'terminal';
  render();
}

function closeTerminalView() {
  if (activeSessionType === 'kitty' && activeSessionId && ws) {
    ws.send(JSON.stringify({ type: 'unsubscribe_kitty' }));
  }

  if (termInstance) {
    termInstance.dispose();
    termInstance = null;
    fitAddon = null;
  }

  activeSessionType = null;
  activeSessionId = null;
  isUserScrolledUp = false;
  pendingKittyContent = null;
  ctrlActive = false;
  altActive = false;

  currentView = 'dashboard';
  render();
}

function renderTerminalView() {
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-view';

  const currentWin = terminals.find((t) => t.compositeId === activeSessionId);
  const currentPty = ptys.find((p) => p.id === activeSessionId);
  const sessionTitle =
    activeSessionType === 'kitty'
      ? currentWin?.title || 'Kitty Terminal'
      : currentPty?.title || 'Shell Fish (PTY)';
  const meta = currentWin?.meta;
  const icon = meta?.isAiAgent
    ? '🤖'
    : meta?.type === 'server'
    ? '⚡'
    : meta?.type === 'editor'
    ? '🛠️'
    : meta?.type === 'shell'
    ? '🐚'
    : '💻';

  const providerLabel = currentWin?.providerLabel || 'Mirror PC';
  const subLabel =
    activeSessionType === 'kitty'
      ? `${icon} ${meta?.label || 'Terminal'} (${providerLabel})`
      : `🐚 Shell Fish (Direct PTY)`;

  wrapper.innerHTML = `
    <div class="term-topbar">
      <button class="btn-icon" id="btn-term-back" title="Wróć do listy">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="term-title-block">
        <span class="term-title-text">${escapeHtml(sessionTitle)}</span>
        <span class="term-sub-text" style="color: ${meta?.color || 'var(--text-dim)'};">${escapeHtml(subLabel)}</span>
      </div>
      <div class="term-controls">
        ${
          activeSessionType === 'kitty'
            ? `<button class="btn-secondary" id="btn-term-focus" style="padding:6px 10px; font-size:0.75rem;">Focus PC</button>`
            : ''
        }
        <button class="btn-icon" id="btn-term-clear" title="Wyczyść ekran">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>

    <div class="term-container" id="terminal-mount">
      <button class="scroll-bottom-btn" id="btn-scroll-bottom" style="display: none;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span id="scroll-bottom-label">Na dół</span>
      </button>
    </div>

    <div class="mobile-touch-bar" id="mobile-accessory-bar">
      <div class="quick-prompt-drawer">
        <input type="text" class="prompt-input" id="quick-prompt-input" placeholder="Wpisz komendę / prompt..." autocomplete="off" autocapitalize="none" spellcheck="false"/>
        <button class="prompt-send-btn" id="quick-prompt-send">Wyślij</button>
      </div>

      <div class="touch-keys-row">
        <button class="t-key" id="key-ctrl">Ctrl</button>
        <button class="t-key" id="key-alt">Alt</button>
        <button class="t-key" id="key-esc">Esc</button>
        <button class="t-key" id="key-tab">Tab</button>
        <button class="t-key" id="key-pgup" style="color: var(--accent-blue);">PgUp</button>
        <button class="t-key" id="key-pgdn" style="color: var(--accent-blue);">PgDn</button>
        <button class="t-key" id="key-up">↑</button>
        <button class="t-key" id="key-down">↓</button>
        <button class="t-key" id="key-left">←</button>
        <button class="t-key" id="key-right">→</button>
        <button class="t-key danger" id="key-ctrl-c">^C</button>
        <button class="t-key accent" id="key-enter">↵</button>
      </div>

      <div class="touch-keys-row" style="padding-top: 2px;">
        <button class="t-key" data-send="^D">^D</button>
        <button class="t-key" data-send="^Z">^Z</button>
        <button class="t-key" data-send="y\r">y↵</button>
        <button class="t-key" data-send="n\r">n↵</button>
        <button class="t-key" data-send="clear\r">clear</button>
        <button class="t-key" data-send="git status\r">git</button>
        <button class="t-key" data-send="/">/</button>
        <button class="t-key" data-send="~">~</button>
        <button class="t-key" data-send="|">|</button>
      </div>
    </div>
  `;

  app.appendChild(wrapper);

  // Initialize xterm
  const mountEl = document.getElementById('terminal-mount')!;
  termInstance = new Terminal({
    fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    fontSize: 13,
    lineHeight: 1.15,
    cursorBlink: true,
    cursorStyle: 'bar',
    theme: {
      background: '#11111b',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#585b70',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
    convertEol: true,
    scrollback: 3000,
  });

  fitAddon = new FitAddon();
  termInstance.loadAddon(fitAddon);
  termInstance.open(mountEl);
  fitAddon.fit();

  // Resize handling (orientation change and iOS virtual keyboard open/close)
  const handleResize = () => {
    try {
      fitAddon?.fit();
      if (activeSessionType === 'pty' && activeSessionId && ws && termInstance) {
        ws.send(
          JSON.stringify({
            type: 'pty_resize',
            id: activeSessionId,
            cols: termInstance.cols,
            rows: termInstance.rows,
          })
        );
      }
    } catch {}
  };

  window.addEventListener('resize', handleResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
  }

  // Smooth Touch Scrolling on Mobile Screen
  let touchStartY = 0;
  let touchAccumulator = 0;
  let isTouching = false;

  mountEl.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchAccumulator = 0;
        isTouching = true;
      }
    },
    { passive: true }
  );

  mountEl.addEventListener(
    'touchmove',
    (e) => {
      if (!isTouching || !termInstance || e.touches.length !== 1) return;
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY - currentY;
      touchStartY = currentY;

      touchAccumulator += deltaY;
      // 14px threshold per line for responsive touch feel
      const lines = Math.trunc(touchAccumulator / 14);
      if (lines !== 0) {
        termInstance.scrollLines(lines);
        touchAccumulator -= lines * 14;
        checkScrollStatus();
      }
    },
    { passive: true }
  );

  mountEl.addEventListener(
    'touchend',
    () => {
      isTouching = false;
      checkScrollStatus();
    },
    { passive: true }
  );

  termInstance.onScroll(() => {
    checkScrollStatus();
  });

  // Handle User Keystrokes in xterm
  termInstance.onData((data) => {
    sendInputToActiveSession(data);
  });

  // Top buttons
  document.getElementById('btn-term-back')?.addEventListener('click', () => {
    vibrate();
    closeTerminalView();
  });

  document.getElementById('btn-term-clear')?.addEventListener('click', () => {
    vibrate();
    termInstance?.clear();
  });

  document.getElementById('btn-term-focus')?.addEventListener('click', async () => {
    vibrate(20);
    if (activeSessionType === 'kitty' && activeSessionId) {
      const res = await api(`/api/terminals/${activeSessionId}/focus`, { method: 'POST' });
      showToast(res.success ? 'Okno aktywowane na monitorze PC' : 'Błąd aktywacji okna');
    }
  });

  // Touch Accessory Keys
  const ctrlBtn = document.getElementById('key-ctrl')!;
  const altBtn = document.getElementById('key-alt')!;

  ctrlBtn.addEventListener('click', () => {
    vibrate();
    ctrlActive = !ctrlActive;
    ctrlBtn.classList.toggle('sticky-active', ctrlActive);
  });

  altBtn.addEventListener('click', () => {
    vibrate();
    altActive = !altActive;
    altBtn.classList.toggle('sticky-active', altActive);
  });

  document.getElementById('key-esc')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\x1b');
  });

  document.getElementById('key-tab')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\t');
  });

  document.getElementById('key-pgup')?.addEventListener('click', () => {
    vibrate(10);
    termInstance?.scrollPages(-1);
    checkScrollStatus();
  });

  document.getElementById('key-pgdn')?.addEventListener('click', () => {
    vibrate(10);
    termInstance?.scrollPages(1);
    checkScrollStatus();
  });

  document.getElementById('btn-scroll-bottom')?.addEventListener('click', (e) => {
    e.stopPropagation();
    vibrate(15);
    isUserScrolledUp = false;
    if (termInstance) {
      if (pendingKittyContent) {
        termInstance.reset();
        termInstance.write(pendingKittyContent);
        pendingKittyContent = null;
      }
      termInstance.scrollToBottom();
    }
    const scrollBtn = document.getElementById('btn-scroll-bottom');
    if (scrollBtn) scrollBtn.style.display = 'none';
  });

  document.getElementById('key-up')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\x1b[A');
  });

  document.getElementById('key-down')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\x1b[B');
  });

  document.getElementById('key-left')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\x1b[D');
  });

  document.getElementById('key-right')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\x1b[C');
  });

  document.getElementById('key-ctrl-c')?.addEventListener('click', () => {
    vibrate(35);
    sendInputToActiveSession('\x03');
    showToast('Wysłano SIGINT (Ctrl+C)');
  });

  document.getElementById('key-enter')?.addEventListener('click', () => {
    vibrate();
    sendInputToActiveSession('\r');
  });

  // Second row quick keys
  wrapper.querySelectorAll<HTMLButtonElement>('.touch-keys-row button[data-send]').forEach((btn) => {
    btn.addEventListener('click', () => {
      vibrate();
      const sendVal = btn.getAttribute('data-send') || '';
      let raw = sendVal;
      if (raw === '^D') raw = '\x04';
      else if (raw === '^Z') raw = '\x1a';
      else raw = raw.replace(/\\r/g, '\r');
      sendInputToActiveSession(raw);
    });
  });

  // Quick Prompt Input Drawer
  const promptInput = document.getElementById('quick-prompt-input') as HTMLInputElement;
  const promptSendBtn = document.getElementById('quick-prompt-send') as HTMLButtonElement;

  const sendPrompt = () => {
    const val = promptInput.value;
    if (val) {
      vibrate();
      sendInputToActiveSession(val + '\r');
      promptInput.value = '';
    }
  };

  promptSendBtn.addEventListener('click', sendPrompt);
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendPrompt();
    }
  });

  // Initial data loading / Subscription
  if (activeSessionType === 'kitty' && activeSessionId) {
    // Initial snapshot fetch
    api(`/api/terminals/${activeSessionId}/screen?extent=all`).then((data) => {
      if (termInstance && data.content) {
        termInstance.write(data.content);
      }
    });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe_kitty', compositeId: activeSessionId }));
    }
  } else if (activeSessionType === 'pty' && activeSessionId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'pty_subscribe', id: activeSessionId }));
    }
  }
}

function sendInputToActiveSession(data: string) {
  let toSend = data;

  if (isUserScrolledUp) {
    isUserScrolledUp = false;
    termInstance?.scrollToBottom();
    const scrollBtn = document.getElementById('btn-scroll-bottom');
    if (scrollBtn) scrollBtn.style.display = 'none';
  }

  // Handle sticky modifiers
  if (ctrlActive && toSend.length === 1) {
    const code = toSend.toLowerCase().charCodeAt(0);
    if (code >= 97 && code <= 122) {
      // a-z mapped to \x01-\x1a
      toSend = String.fromCharCode(code - 96);
    }
    ctrlActive = false;
    document.getElementById('key-ctrl')?.classList.remove('sticky-active');
  }

  if (altActive) {
    toSend = '\x1b' + toSend;
    altActive = false;
    document.getElementById('key-alt')?.classList.remove('sticky-active');
  }

  if (activeSessionType === 'kitty' && activeSessionId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'kitty_input',
          compositeId: activeSessionId,
          data: toSend,
        })
      );
    } else {
      api(`/api/terminals/${activeSessionId}/input`, {
        method: 'POST',
        body: JSON.stringify({ input: toSend }),
      });
    }
  } else if (activeSessionType === 'pty' && activeSessionId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'pty_input',
          id: activeSessionId,
          data: toSend,
        })
      );
    }
  }
}

// ----------------------------------------------------
// App Boot
// ----------------------------------------------------

async function init() {
  // Check if token was provided in URL query parameters (e.g. from QR code scan)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryToken = urlParams.get('token');
    if (queryToken) {
      token = queryToken;
      localStorage.setItem('termdeck_token', token);
      const cleanUrl =
        window.location.protocol + '//' + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      showToast('Zalogowano tokenem 256-bit');
    }
  } catch {}

  if (token) {
    try {
      const res = await api('/api/auth/check');
      if (res.authenticated) {
        connectWS();
        currentView = 'dashboard';
      } else {
        token = '';
        localStorage.removeItem('termdeck_token');
        currentView = 'auth';
      }
    } catch {
      token = '';
      currentView = 'auth';
    }
  } else {
    currentView = 'auth';
  }
  render();
}

// ----------------------------------------------------
// Prevent iOS Double-Tap-to-Zoom & Gesture Zooming
// ----------------------------------------------------

let lastTouchEndTime = 0;
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now();
    const target = event.target as HTMLElement | null;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    if (!isInput && now - lastTouchEndTime <= 300) {
      event.preventDefault();
    }
    lastTouchEndTime = now;
  },
  { passive: false }
);

document.addEventListener(
  'gesturestart',
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

document.addEventListener(
  'gesturechange',
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

init();
