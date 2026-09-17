import express from 'express';
import cors from 'cors';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'node:os';

import {
  listAllUnifiedTerminals,
  getUnifiedScreen,
  sendUnifiedInput,
} from './providers/index.js';
import {
  listPTYSessions,
  createPTY,
  writePTY,
  resizePTY,
  destroyPTY,
  subscribePTY,
} from './pty.js';
import { focusHyprlandWindow } from './hyprland.js';
import {
  authenticatePin,
  isValidToken,
  requireAuth,
  getExpectedPin,
  getMasterSessionToken,
  getClientIp,
} from './auth.js';
import {
  startRemoteTunnel,
  stopRemoteTunnel,
  getTunnelStatus,
  getLocalIp,
  recordSecurityViolation,
} from './tunnel.js';
import type { WSClientMessage, WSServerMessage } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const HTTP_PORT = parseInt(process.env.PORT || '3000', 10);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '3443', 10);

const app = express();
app.use(cors());
app.use(express.json());

// Honeypot & Malicious Bot Scanner Trap
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p.includes('.env') ||
    p.includes('/wp-') ||
    p.includes('/phpmyadmin') ||
    p.includes('/cgi-bin') ||
    p.includes('/actuator') ||
    p.includes('/setup.cgi') ||
    p.includes('/config.json') ||
    p.includes('/id_rsa') ||
    p.includes('/.git') ||
    p.includes('/boaform')
  ) {
    const ip = getClientIp(req);
    console.warn(`[SECURITY] Wykryto złośliwy skaner: ${req.method} ${req.path} z IP: ${ip}`);
    recordSecurityViolation(ip, `Skaner uderzył w ${p}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Serve static frontend build if it exists
const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// ----------------------------------------------------
// REST API
// ----------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  const { pin } = req.body || {};
  const token = await authenticatePin(pin, req);
  if (token) {
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Nieprawidłowy kod PIN' });
  }
});

app.get('/api/tunnel/status', (req, res) => {
  res.json(getTunnelStatus());
});

app.post('/api/tunnel/kill', requireAuth, async (req, res) => {
  await stopRemoteTunnel('Wyłączono na żądanie użytkownika');
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.query.token as string);
  res.json({ authenticated: isValidToken(token) });
});

app.get('/api/system', requireAuth, (req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    freemem: os.freemem(),
    totalmem: os.totalmem(),
  });
});

app.get('/api/terminals', requireAuth, async (req, res) => {
  const [terminals, ptys] = await Promise.all([
    listAllUnifiedTerminals(),
    Promise.resolve(listPTYSessions()),
  ]);

  res.json({
    terminals,
    ptys: ptys.map((p) => ({
      id: p.id,
      title: p.title,
      cwd: p.cwd,
      createdAt: p.createdAt,
    })),
  });
});

app.get('/api/terminals/:compositeId/screen', requireAuth, async (req, res) => {
  const compositeId = String(req.params.compositeId);
  const extent = (req.query.extent as 'screen' | 'all') || 'screen';

  const content = await getUnifiedScreen(compositeId, extent);
  res.json({ compositeId, content });
});

app.post('/api/terminals/:compositeId/input', requireAuth, async (req, res) => {
  const compositeId = String(req.params.compositeId);
  const { input } = req.body || {};
  if (typeof input !== 'string') {
    return res.status(400).json({ error: 'Input must be a string' });
  }

  const success = await sendUnifiedInput(compositeId, input);
  res.json({ success });
});

app.post('/api/terminals/:compositeId/focus', requireAuth, async (req, res) => {
  const compositeId = String(req.params.compositeId);
  let pid = 0;
  if (compositeId.startsWith('kitty:')) {
    pid = parseInt(compositeId.split(':')[1], 10);
  } else if (compositeId.startsWith('system:')) {
    pid = parseInt(compositeId.split(':')[2], 10);
  } else if (!compositeId.includes(':') || compositeId.split(':').length === 2) {
    pid = parseInt(compositeId.split(':')[0], 10);
  }

  const success = pid > 0 ? await focusHyprlandWindow(pid) : false;
  res.json({ success });
});

app.post('/api/pty/create', requireAuth, (req, res) => {
  const { cwd, cols, rows, shell } = req.body || {};
  const session = createPTY({ cwd, cols, rows, shell });
  res.json({
    id: session.id,
    title: session.title,
    cwd: session.cwd,
  });
});

app.delete('/api/pty/:id', requireAuth, (req, res) => {
  const id = String(req.params.id);
  const success = destroyPTY(id);
  res.json({ success });
});

// SPA Fallback for Express 5
app.use((req, res) => {
  const indexHtml = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('TermDeck backend is running. Frontend build not found in dist/. Run pnpm build.');
  }
});

// ----------------------------------------------------
// HTTP & HTTPS Servers + WebSockets
// ----------------------------------------------------

const httpServer = http.createServer(app);
const wssHttp = new WebSocketServer({ noServer: true });

// Check for TLS certs
let httpsServer: https.Server | null = null;
let wssHttps: WebSocketServer | null = null;

const certPath = path.join(rootDir, 'certs/cert.pem');
const keyPath = path.join(rootDir, 'certs/key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const tlsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  httpsServer = https.createServer(tlsOptions, app);
  wssHttps = new WebSocketServer({ noServer: true });
}

function handleUpgrade(wss: WebSocketServer, request: http.IncomingMessage, socket: any, head: any) {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}

httpServer.on('upgrade', (req, sock, head) => {
  handleUpgrade(wssHttp, req, sock, head);
});

if (httpsServer && wssHttps) {
  httpsServer.on('upgrade', (req, sock, head) => {
    handleUpgrade(wssHttps!, req, sock, head);
  });
}

// ----------------------------------------------------
// WebSocket Connection Management
// ----------------------------------------------------

function setupWSS(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    let isAuthenticated = false;
    let subscribedKittyId: string | null = null;
    let kittyTimer: NodeJS.Timeout | null = null;
    let lastKittyContent = '';

    let ptyUnsubscribe: (() => void) | null = null;

    // Check token from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const queryToken = url.searchParams.get('token');
    if (queryToken && isValidToken(queryToken)) {
      isAuthenticated = true;
      send({ type: 'auth_ok' });
    }

    function send(msg: WSServerMessage) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    function stopKittySubscription() {
      if (kittyTimer) {
        clearInterval(kittyTimer);
        kittyTimer = null;
      }
      subscribedKittyId = null;
      lastKittyContent = '';
    }

    function startKittySubscription(compositeId: string) {
      stopKittySubscription();
      subscribedKittyId = compositeId;

      const poll = async () => {
        if (!subscribedKittyId || ws.readyState !== WebSocket.OPEN) return;
        try {
          const content = await getUnifiedScreen(subscribedKittyId, 'all');
          if (content !== lastKittyContent) {
            lastKittyContent = content;
            send({
              type: 'kitty_screen',
              compositeId: subscribedKittyId,
              content,
              title: `Terminal [${subscribedKittyId}]`,
            });
          }
        } catch {
          // ignore transient errors
        }
      };

      // Poll every 250ms for live screen updates
      poll();
      kittyTimer = setInterval(poll, 250);
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSClientMessage;

        if (msg.type === 'auth') {
          if (isValidToken(msg.token)) {
            isAuthenticated = true;
            send({ type: 'auth_ok' });
          } else {
            send({ type: 'auth_error', message: 'Invalid token' });
          }
          return;
        }

        if (!isAuthenticated) {
          send({ type: 'auth_error', message: 'Authentication required' });
          return;
        }

        // Subscribing to existing terminal window (Kitty, Tmux, WezTerm, etc.)
        if (msg.type === 'subscribe_kitty') {
          startKittySubscription(msg.compositeId);
          return;
        }

        if (msg.type === 'unsubscribe_kitty') {
          stopKittySubscription();
          return;
        }

        if (msg.type === 'kitty_input') {
          await sendUnifiedInput(msg.compositeId, msg.data);
          return;
        }

        // Direct PTY actions
        if (msg.type === 'pty_create') {
          const session = createPTY({ cwd: msg.cwd });
          broadcastTerminals();
          return;
        }

        if (msg.type === 'pty_subscribe') {
          if (ptyUnsubscribe) ptyUnsubscribe();
          ptyUnsubscribe = subscribePTY(
            msg.id,
            (data) => send({ type: 'pty_data', id: msg.id, data }),
            (exitCode) => {
              send({ type: 'pty_exit', id: msg.id, exitCode });
              broadcastTerminals();
            }
          );
          return;
        }

        if (msg.type === 'pty_input') {
          writePTY(msg.id, msg.data);
          return;
        }

        if (msg.type === 'pty_resize') {
          resizePTY(msg.id, msg.cols, msg.rows);
          return;
        }

        if (msg.type === 'pty_destroy') {
          destroyPTY(msg.id);
          broadcastTerminals();
          return;
        }
      } catch (err: any) {
        send({ type: 'error', message: err?.message || 'Invalid message' });
      }
    });

    ws.on('close', () => {
      stopKittySubscription();
      if (ptyUnsubscribe) ptyUnsubscribe();
    });
  });
}

setupWSS(wssHttp);
if (wssHttps) setupWSS(wssHttps);

// Periodic broadcast of terminals to all authenticated clients
async function broadcastTerminals() {
  try {
    const [terminals, ptys] = await Promise.all([
      listAllUnifiedTerminals(),
      Promise.resolve(listPTYSessions()),
    ]);
    const payload = JSON.stringify({
      type: 'terminals_update',
      terminals,
      ptys: ptys.map((p) => ({ id: p.id, title: p.title, cwd: p.cwd })),
    });

    const clients = [
      ...Array.from(wssHttp.clients),
      ...(wssHttps ? Array.from(wssHttps.clients) : []),
    ];

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  } catch {
    // ignore
  }
}

setInterval(broadcastTerminals, 2500);

// ----------------------------------------------------
// Start Listening
// ----------------------------------------------------

const shouldStartTunnel =
  process.argv.includes('--tunnel') ||
  process.env.TUNNEL === '1' ||
  process.env.TUNNEL === 'true';

const localIp = getLocalIp();

httpServer.listen(HTTP_PORT, '0.0.0.0', async () => {
  console.log(`[TermDeck] HTTP Server nasłuchuje na http://0.0.0.0:${HTTP_PORT}`);
  console.log(`[TermDeck] Sieć domowa (LAN): http://${localIp}:${HTTP_PORT}`);
  console.log(`[TermDeck] Kod PIN: ${getExpectedPin()}`);

  if (shouldStartTunnel) {
    await startRemoteTunnel(HTTP_PORT, getMasterSessionToken());
  } else {
    console.log(`[TermDeck] Tryb zdalny: WYŁĄCZONY (użyj 'pnpm run tunnel' lub 'pnpm start --tunnel' aby włączyć)`);
  }
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`[TermDeck] HTTPS Server nasłuchuje na https://0.0.0.0:${HTTPS_PORT}`);
    console.log(`[TermDeck] Dostęp iPhone PWA (LAN): https://${localIp}:${HTTPS_PORT}`);
  });
}

// Obsługa bezpiecznego wyłączenia (cleanup tunelu)
async function gracefulShutdown(signal: string) {
  console.log(`\n[TermDeck] Otrzymano ${signal} - zamykanie procesów...`);
  await stopRemoteTunnel(`Sygnał ${signal}`);
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
