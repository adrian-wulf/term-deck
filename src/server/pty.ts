import pty from 'node-pty';
import { randomUUID } from 'node:crypto';
import type { PTYSession } from './types.js';

interface ActivePTY {
  session: PTYSession;
  instance: pty.IPty;
  listeners: Set<(data: string) => void>;
  exitListeners: Set<(exitCode: number) => void>;
}

const activePtys = new Map<string, ActivePTY>();

export function listPTYSessions(): PTYSession[] {
  return Array.from(activePtys.values()).map((p) => p.session);
}

export function createPTY(
  options: { cwd?: string; cols?: number; rows?: number; shell?: string } = {}
): PTYSession {
  const id = randomUUID().slice(0, 8);
  const cwd = options.cwd || process.env.HOME || '/mnt/dane/projekty';
  const cols = options.cols || 80;
  const rows = options.rows || 24;
  const shell = options.shell || process.env.SHELL || 'fish';

  const instance = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  const session: PTYSession = {
    id,
    title: `term-${id} (${shell})`,
    cwd,
    createdAt: Date.now(),
    pid: instance.pid,
    buffer: [],
  };

  const active: ActivePTY = {
    session,
    instance,
    listeners: new Set(),
    exitListeners: new Set(),
  };

  instance.onData((data) => {
    // Keep last 1000 chunks in buffer
    session.buffer.push(data);
    if (session.buffer.length > 1000) {
      session.buffer.shift();
    }
    for (const listener of active.listeners) {
      listener(data);
    }
  });

  instance.onExit(({ exitCode }) => {
    for (const listener of active.exitListeners) {
      listener(exitCode);
    }
    activePtys.delete(id);
  });

  activePtys.set(id, active);
  return session;
}

export function writePTY(id: string, data: string): boolean {
  const active = activePtys.get(id);
  if (!active) return false;
  active.instance.write(data);
  return true;
}

export function resizePTY(id: string, cols: number, rows: number): boolean {
  const active = activePtys.get(id);
  if (!active) return false;
  active.instance.resize(cols, rows);
  return true;
}

export function destroyPTY(id: string): boolean {
  const active = activePtys.get(id);
  if (!active) return false;
  active.instance.kill();
  activePtys.delete(id);
  return true;
}

export function subscribePTY(
  id: string,
  onData: (data: string) => void,
  onExit?: (exitCode: number) => void
): (() => void) | null {
  const active = activePtys.get(id);
  if (!active) return null;

  active.listeners.add(onData);
  if (onExit) active.exitListeners.add(onExit);

  // Send buffered history immediately
  for (const chunk of active.session.buffer) {
    onData(chunk);
  }

  return () => {
    active.listeners.delete(onData);
    if (onExit) active.exitListeners.delete(onExit);
  };
}
