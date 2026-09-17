import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import type { UnifiedTerminalWindow } from './types.js';
import { detectProcessMeta } from '../process-detector.js';

const execAsync = promisify(exec);

let tmuxAvailable: boolean | null = null;

export async function isTmuxAvailable(): Promise<boolean> {
  if (tmuxAvailable !== null) return tmuxAvailable;
  try {
    const { stdout } = await execAsync('which tmux');
    tmuxAvailable = stdout.trim().length > 0;
  } catch {
    tmuxAvailable = false;
  }
  return tmuxAvailable;
}

/**
 * Read child processes from /proc on Linux to inspect what's running in the pane
 */
function getChildProcesses(parentPid: number): Array<{ cmdline: string[]; cwd: string; pid: number }> {
  const result: Array<{ cmdline: string[]; cwd: string; pid: number }> = [];

  try {
    const childrenPath = `/proc/${parentPid}/task/${parentPid}/children`;
    if (!fs.existsSync(childrenPath)) return result;

    const childrenStr = fs.readFileSync(childrenPath, 'utf8').trim();
    if (!childrenStr) return result;

    const childPids = childrenStr.split(/\s+/).map((p) => parseInt(p, 10)).filter((p) => !isNaN(p));

    for (const childPid of childPids) {
      try {
        const cmdlineFile = `/proc/${childPid}/cmdline`;
        if (fs.existsSync(cmdlineFile)) {
          const raw = fs.readFileSync(cmdlineFile);
          const cmdline = raw.toString('utf8').split('\0').filter((s) => s.length > 0);
          let cwd = '';
          try {
            cwd = fs.readlinkSync(`/proc/${childPid}/cwd`);
          } catch {}

          if (cmdline.length > 0) {
            result.push({ cmdline, cwd, pid: childPid });
          }
        }
        // Recursively check grandchildren (e.g. bash -> npm -> node)
        const grandChildren = getChildProcesses(childPid);
        result.push(...grandChildren);
      } catch {}
    }
  } catch {}

  return result;
}

export async function listTmuxPanes(): Promise<UnifiedTerminalWindow[]> {
  const available = await isTmuxAvailable();
  if (!available) return [];

  try {
    // Format: session:window:pane|title|cwd|pid|active|width|height|command
    const format =
      '#{session_name}:#{window_index}:#{pane_index}|#{pane_title}|#{pane_current_path}|#{pane_pid}|#{pane_active}|#{pane_width}|#{pane_height}|#{pane_current_command}';
    const { stdout } = await execAsync(`tmux list-panes -a -F "${format}"`);

    const lines = stdout.trim().split('\n').filter((l) => l.trim().length > 0);
    const windows: UnifiedTerminalWindow[] = [];

    for (const line of lines) {
      const [target, title, cwd, pidStr, activeStr, widthStr, heightStr, command] = line.split('|');
      const pid = parseInt(pidStr, 10) || 0;
      const isActive = activeStr === '1';
      const cols = parseInt(widthStr, 10) || 80;
      const rows = parseInt(heightStr, 10) || 24;

      // Find foreground children
      let foreground = getChildProcesses(pid);
      if (foreground.length === 0 && command) {
        foreground = [{ cmdline: [command], cwd: cwd || '', pid }];
      }

      const meta = detectProcessMeta(title || command || '', foreground.map((f) => f.cmdline));

      windows.push({
        id: target,
        compositeId: `tmux:${target}`,
        provider: 'tmux',
        providerLabel: 'Tmux',
        title: title || `Tmux [${target}]`,
        cwd: cwd || '',
        pid,
        lines: rows,
        columns: cols,
        is_focused: isActive,
        is_active: isActive,
        supportsMirror: true,
        supportsInput: true,
        foreground_processes: foreground,
        category: meta.badge,
        meta,
        workspace: `Tmux (${target.split(':')[0]})`,
      });
    }

    return windows;
  } catch (err: any) {
    // No tmux server running is a normal condition
    return [];
  }
}

export async function getTmuxScreen(target: string, extent: 'screen' | 'all' = 'screen'): Promise<string> {
  try {
    // -e keeps ANSI colors, -p prints to stdout, -S - captures scrollback
    const scrollFlag = extent === 'all' ? '-S -300' : '';
    const { stdout } = await execAsync(`tmux capture-pane -e -p ${scrollFlag} -t "${target}"`);
    return stdout;
  } catch (err: any) {
    return `[Tmux Error] Nie można odczytać ekranu ${target}: ${err?.message || err}`;
  }
}

export async function sendTmuxInput(target: string, input: string): Promise<boolean> {
  try {
    if (input === '\x03') {
      // Ctrl+C (SIGINT)
      await execAsync(`tmux send-keys -t "${target}" C-c`);
      return true;
    }

    if (input === '\x04') {
      // Ctrl+D (EOF)
      await execAsync(`tmux send-keys -t "${target}" C-d`);
      return true;
    }

    if (input === '\r' || input === '\n') {
      // Enter
      await execAsync(`tmux send-keys -t "${target}" Enter`);
      return true;
    }

    if (input.endsWith('\r') || input.endsWith('\n')) {
      const clean = input.replace(/[\r\n]+$/, '');
      if (clean.length > 0) {
        await execAsync(`tmux send-keys -t "${target}" -l "${clean.replace(/"/g, '\\"')}"`);
      }
      await execAsync(`tmux send-keys -t "${target}" Enter`);
      return true;
    }

    // Literal input
    await execAsync(`tmux send-keys -t "${target}" -l "${input.replace(/"/g, '\\"')}"`);
    return true;
  } catch (err: any) {
    console.error(`[Tmux] Błąd wysyłania tekstu do ${target}:`, err);
    return false;
  }
}
