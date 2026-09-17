import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import type { KittyWindow } from './types.js';
import { getHyprlandClients } from './hyprland.js';

import { detectProcessMeta } from './process-detector.js';

const execFileAsync = promisify(execFile);

export async function findKittySockets(): Promise<string[]> {
  try {
    const files = await fs.readdir('/tmp');
    return files
      .filter((f) => f.startsWith('kitty-'))
      .map((f) => `/tmp/${f}`);
  } catch {
    return [];
  }
}

export async function listAllKittyWindows(): Promise<KittyWindow[]> {
  const sockets = await findKittySockets();
  const hyprClients = await getHyprlandClients();
  const results: KittyWindow[] = [];

  for (const socketPath of sockets) {
    const socketPidMatch = socketPath.match(/\/tmp\/kitty-(\d+)/);
    const socketPid = socketPidMatch ? parseInt(socketPidMatch[1], 10) : 0;

    try {
      const { stdout } = await execFileAsync(
        'kitty',
        ['@', '--to', `unix:${socketPath}`, 'ls'],
        { timeout: 2000 }
      );
      const osWindows = JSON.parse(stdout);

      for (const osWin of osWindows) {
        for (const tab of osWin.tabs || []) {
          for (const win of tab.windows || []) {
            const compositeId = `${socketPid}:${win.id}`;
            const fgProcs = (win.foreground_processes || []).map((p: any) => ({
              cmdline: p.cmdline || [],
              cwd: p.cwd || '',
              pid: p.pid || 0,
            }));

            const cmdlines = fgProcs.map((p: any) => p.cmdline);
            const meta = detectProcessMeta(win.title || '', cmdlines);

            // Find matching workspace from Hyprland
            const matchingHypr = hyprClients.find(
              (c) => c.pid === socketPid || c.pid === win.pid
            );

            results.push({
              id: win.id,
              compositeId,
              socketPath,
              socketPid,
              title: win.title || 'kitty',
              cwd: win.cwd || '',
              pid: win.pid || socketPid,
              lines: win.lines || 24,
              columns: win.columns || 80,
              is_focused: !!win.is_focused,
              is_active: !!win.is_active,
              foreground_processes: fgProcs,
              category: meta.type,
              meta,
              workspace: matchingHypr ? matchingHypr.workspace.name : undefined,
            });
          }
        }
      }
    } catch {
      // Socket might be stale or busy
    }
  }

  return results;
}

export async function getKittyScreen(
  socketPath: string,
  windowId: number,
  extent: 'screen' | 'all' = 'screen'
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'kitty',
      ['@', '--to', `unix:${socketPath}`, 'get-text', '--ansi', '--extent', extent, '--match', `id:${windowId}`],
      { timeout: 2000, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } catch (err: any) {
    return `[Błąd pobierania ekranu Kitty: ${err?.message || 'timeout'}]`;
  }
}

export function sendKittyInput(
  socketPath: string,
  windowId: number,
  input: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(
      'kitty',
      ['@', '--to', `unix:${socketPath}`, 'send-text', '--stdin', '--match', `id:${windowId}`],
      { stdio: ['pipe', 'ignore', 'ignore'] }
    );

    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));

    child.stdin.write(input);
    child.stdin.end();
  });
}
