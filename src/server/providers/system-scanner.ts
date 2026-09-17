import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { UnifiedTerminalWindow } from './types.js';
import { detectProcessMeta } from '../process-detector.js';

const execAsync = promisify(exec);

const KNOWN_EMULATORS = [
  'alacritty',
  'foot',
  'konsole',
  'gnome-terminal-server',
  'gnome-terminal',
  'xfce4-terminal',
  'xterm',
  'tilix',
  'terminator',
  'urxvt',
  'rxvt',
  'kitty',
  'wezterm-gui',
  'ghostty',
  'rio',
  'warp-terminal',
];

/**
 * Walk up process tree to find terminal emulator binary
 */
function findTerminalEmulator(pid: number, depth = 0): string | null {
  if (depth > 6 || pid <= 1) return null;
  try {
    const statPath = `/proc/${pid}/stat`;
    if (!fs.existsSync(statPath)) return null;
    const stat = fs.readFileSync(statPath, 'utf8');
    const ppidMatch = stat.match(/\)\s+[A-Za-z]\s+(\d+)/);
    if (!ppidMatch) return null;

    const ppid = parseInt(ppidMatch[1], 10);
    const commPath = `/proc/${ppid}/comm`;
    if (fs.existsSync(commPath)) {
      const comm = fs.readFileSync(commPath, 'utf8').trim().toLowerCase();
      for (const emu of KNOWN_EMULATORS) {
        if (comm.includes(emu)) {
          return comm;
        }
      }
      return findTerminalEmulator(ppid, depth + 1);
    }
  } catch {}
  return null;
}

export async function listSystemTerminals(
  claimedPids: Set<number>
): Promise<UnifiedTerminalWindow[]> {
  try {
    // Only works on Linux /proc
    if (process.platform !== 'linux') return [];

    const { stdout } = await execAsync('ps -eo pid,ppid,tty,stat,%cpu,%mem,comm,args');
    const lines = stdout.split('\n');

    const windows: UnifiedTerminalWindow[] = [];
    const seenTtys = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 7) continue;

      const pid = parseInt(parts[0], 10);
      const ppid = parseInt(parts[1], 10);
      const tty = parts[2];
      const stat = parts[3];
      const cpu = parts[4];
      const mem = parts[5];
      const comm = parts[6];
      const args = parts.slice(7);

      // We only care about pseudo-terminals pts/* that are in foreground (+)
      if (!tty.startsWith('pts/')) continue;
      if (!stat.includes('+')) continue;

      // Skip self / helper tasks
      if (comm === 'ps' || comm === 'grep' || comm === 'head' || comm === 'tsx' || comm === 'node') {
        const fullArgs = args.join(' ');
        if (fullArgs.includes('term-deck') || fullArgs.includes('vite')) continue;
      }

      // Check if already claimed by Kitty or Tmux
      if (claimedPids.has(pid) || claimedPids.has(ppid)) continue;

      // Group by TTY to avoid sub-processes (like uvx or mcp server workers)
      if (seenTtys.has(tty)) continue;
      seenTtys.add(tty);

      // Find parent emulator
      const emu = findTerminalEmulator(pid);
      // If parent is Kitty or WezTerm, it's already handled by native providers
      if (emu && (emu.includes('kitty') || emu.includes('wezterm'))) continue;

      let cwd = '';
      try {
        cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      } catch {}

      const foreground = [{ cmdline: [comm, ...args], cwd, pid }];
      const meta = detectProcessMeta(comm, [[comm, ...args]]);

      const emuLabel = emu
        ? emu.charAt(0).toUpperCase() + emu.slice(1).replace('-server', '')
        : 'System Terminal';

      const compositeId = `system:${tty.replace('/', '-')}:${pid}`;

      windows.push({
        id: pid,
        compositeId,
        provider: 'system',
        providerLabel: emuLabel,
        title: `${meta.label} (${tty})`,
        cwd,
        pid,
        lines: 24,
        columns: 80,
        is_focused: false,
        is_active: true,
        supportsMirror: false,
        supportsInput: false,
        foreground_processes: foreground,
        category: meta.badge,
        meta,
        workspace: emuLabel,
        systemDetails: {
          tty,
          parentEmulator: emuLabel,
          cpu: `${cpu}%`,
          memory: `${mem}%`,
        },
      });
    }

    return windows;
  } catch (err) {
    return [];
  }
}

/**
 * Generates an informative terminal diagnostic screen for systems that don't have an IPC mirror
 */
export function getSystemTerminalScreen(win: UnifiedTerminalWindow): string {
  const details = win.systemDetails;
  return `
\x1b[1;36m╔════════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[1;36m║  💻 ${win.providerLabel.toUpperCase()} SESSION MONITOR (${details?.tty || 'pts'})  \x1b[0m
\x1b[1;36m╚════════════════════════════════════════════════════════════════╝\x1b[0m

  \x1b[1;33mProces:\x1b[0m          ${win.meta.label}
  \x1b[1;33mPID:\x1b[0m             ${win.pid}
  \x1b[1;33mEmulator:\x1b[0m        ${win.providerLabel}
  \x1b[1;33mŚcieżka (CWD):\x1b[0m   ${win.cwd}
  \x1b[1;33mUżycie CPU:\x1b[0m      ${details?.cpu || '0%'}
  \x1b[1;33mUżycie RAM:\x1b[0m      ${details?.memory || '0%'}
  \x1b[1;33mPolecenie:\x1b[0m       ${win.foreground_processes[0]?.cmdline.join(' ') || ''}

────────────────────────────────────────────────────────────────
  \x1b[1;35mℹ️  INFORMACJA DOTYCZĄCA ZDALNEGO STEROWANIA:\x1b[0m
  Emulator \x1b[1m${win.providerLabel}\x1b[0m nie udostępnia bezpośredniego
  gniazda IPC do bezinwazyjnego odczytu bufora GPU z zewnątrz.

  \x1b[1;32m✓ Sugestia:\x1b[0m
  Aby mieć pełny podgląd graficzny i możliwość wpisywania tekstu
  z telefonu, uruchamiaj długie zadania w:
  • \x1b[1mKitty\x1b[0m (wspierane w 100% natywnie)
  • \x1b[1mTmux\x1b[0m (uruchom 'tmux' wewnątrz ${win.providerLabel})
  • \x1b[1mDirect PTY\x1b[0m (wbudowany shell TermDeck na telefonie)
────────────────────────────────────────────────────────────────
`;
}
