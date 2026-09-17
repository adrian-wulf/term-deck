import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HyprlandClient } from './types.js';

const execFileAsync = promisify(execFile);

export async function getHyprlandClients(): Promise<HyprlandClient[]> {
  try {
    const { stdout } = await execFileAsync('hyprctl', ['clients', '-j'], { timeout: 1500 });
    return JSON.parse(stdout) as HyprlandClient[];
  } catch {
    return [];
  }
}

export async function focusHyprlandWindow(pid: number): Promise<boolean> {
  try {
    await execFileAsync('hyprctl', ['dispatch', 'focuswindow', `pid:${pid}`], { timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}
