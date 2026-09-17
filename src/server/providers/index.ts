import { listAllKittyWindows, getKittyScreen, sendKittyInput } from '../kitty.js';
import { listTmuxPanes, getTmuxScreen, sendTmuxInput } from './tmux.js';
import { listWezTermPanes, getWezTermScreen, sendWezTermInput } from './wezterm.js';
import { listSystemTerminals, getSystemTerminalScreen } from './system-scanner.js';
import type { UnifiedTerminalWindow } from './types.js';

let cachedWindows: UnifiedTerminalWindow[] = [];

/**
 * Aggregates all terminal providers: Kitty, Tmux, WezTerm, and generic System TTYs
 */
export async function listAllUnifiedTerminals(): Promise<UnifiedTerminalWindow[]> {
  try {
    // 1. Query native IPC providers concurrently
    const [kittyWins, tmuxWins, weztermWins] = await Promise.all([
      listAllKittyWindows().catch(() => []),
      listTmuxPanes().catch(() => []),
      listWezTermPanes().catch(() => []),
    ]);

    // Map Kitty windows to Unified format
    const unifiedKitty: UnifiedTerminalWindow[] = kittyWins.map((k) => ({
      id: k.id,
      compositeId: `kitty:${k.compositeId}`,
      provider: 'kitty',
      providerLabel: 'Kitty',
      socketPath: k.socketPath,
      socketPid: k.socketPid,
      title: k.title,
      cwd: k.cwd,
      pid: k.pid,
      lines: k.lines,
      columns: k.columns,
      is_focused: k.is_focused,
      is_active: k.is_active,
      supportsMirror: true,
      supportsInput: true,
      foreground_processes: k.foreground_processes,
      category: k.category,
      meta: k.meta,
      workspace: k.workspace,
    }));

    // Collect all claimed PIDs to avoid duplicate detection in generic scanner
    const claimedPids = new Set<number>();
    for (const w of [...unifiedKitty, ...tmuxWins, ...weztermWins]) {
      if (w.pid) claimedPids.add(w.pid);
      for (const fp of w.foreground_processes) {
        if (fp.pid) claimedPids.add(fp.pid);
      }
    }

    // 2. Discover any remaining active terminal processes (Alacritty, Foot, Konsole, etc.)
    const systemWins = await listSystemTerminals(claimedPids).catch(() => []);

    // Combine all
    const all = [...unifiedKitty, ...tmuxWins, ...weztermWins, ...systemWins];
    cachedWindows = all;
    return all;
  } catch (err) {
    console.error('[Providers] Błąd podczas zbierania terminali:', err);
    return [];
  }
}

/**
 * Route screen retrieval to the appropriate provider
 */
export async function getUnifiedScreen(
  compositeId: string,
  extent: 'screen' | 'all' = 'screen'
): Promise<string> {
  // Support legacy compositeId format without prefix (defaults to Kitty)
  if (!compositeId.includes(':') || (!compositeId.startsWith('kitty:') && !compositeId.startsWith('tmux:') && !compositeId.startsWith('wezterm:') && !compositeId.startsWith('system:'))) {
    // Legacy kitty format: "socketPid:winId"
    const [socketPidStr, winIdStr] = compositeId.split(':');
    const socketPath = `/tmp/kitty-${socketPidStr}`;
    const winId = parseInt(winIdStr, 10);
    return getKittyScreen(socketPath, winId, extent);
  }

  const parts = compositeId.split(':');
  const provider = parts[0];

  if (provider === 'kitty') {
    const socketPidStr = parts[1];
    const winIdStr = parts[2];
    const socketPath = `/tmp/kitty-${socketPidStr}`;
    const winId = parseInt(winIdStr, 10);
    return getKittyScreen(socketPath, winId, extent);
  }

  if (provider === 'tmux') {
    const target = parts.slice(1).join(':');
    return getTmuxScreen(target, extent);
  }

  if (provider === 'wezterm') {
    const paneId = parts[1];
    return getWezTermScreen(paneId);
  }

  if (provider === 'system') {
    const win = cachedWindows.find((w) => w.compositeId === compositeId);
    if (win) {
      return getSystemTerminalScreen(win);
    }
    return '[System Monitor] Sesja terminala została zakończona.';
  }

  return `[TermDeck] Nieznany dostawca terminala: ${compositeId}`;
}

/**
 * Route remote input to the appropriate provider
 */
export async function sendUnifiedInput(compositeId: string, input: string): Promise<boolean> {
  // Support legacy compositeId format
  if (!compositeId.startsWith('kitty:') && !compositeId.startsWith('tmux:') && !compositeId.startsWith('wezterm:') && !compositeId.startsWith('system:')) {
    const [socketPidStr, winIdStr] = compositeId.split(':');
    const socketPath = `/tmp/kitty-${socketPidStr}`;
    const winId = parseInt(winIdStr, 10);
    return sendKittyInput(socketPath, winId, input);
  }

  const parts = compositeId.split(':');
  const provider = parts[0];

  if (provider === 'kitty') {
    const socketPidStr = parts[1];
    const winIdStr = parts[2];
    const socketPath = `/tmp/kitty-${socketPidStr}`;
    const winId = parseInt(winIdStr, 10);
    return sendKittyInput(socketPath, winId, input);
  }

  if (provider === 'tmux') {
    const target = parts.slice(1).join(':');
    return sendTmuxInput(target, input);
  }

  if (provider === 'wezterm') {
    const paneId = parts[1];
    return sendWezTermInput(paneId, input);
  }

  if (provider === 'system') {
    console.warn(`[System] Terminal ${compositeId} nie wspiera zdalnego wprowadzania tekstu.`);
    return false;
  }

  return false;
}
