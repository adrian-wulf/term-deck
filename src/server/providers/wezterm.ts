import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { UnifiedTerminalWindow } from './types.js';
import { detectProcessMeta } from '../process-detector.js';

const execAsync = promisify(exec);

let weztermAvailable: boolean | null = null;

export async function isWezTermAvailable(): Promise<boolean> {
  if (weztermAvailable !== null) return weztermAvailable;
  try {
    const { stdout } = await execAsync('which wezterm');
    weztermAvailable = stdout.trim().length > 0;
  } catch {
    weztermAvailable = false;
  }
  return weztermAvailable;
}

interface WezTermCliItem {
  window_id: number;
  tab_id: number;
  pane_id: number;
  workspace: string;
  size: {
    rows: number;
    cols: number;
    pixel_width: number;
    pixel_height: number;
    dpi: number;
  };
  title: string;
  cwd: string;
  cursor_x: number;
  cursor_y: number;
  cursor_shape: string;
  cursor_visibility: string;
  left_col: number;
  top_row: number;
  tab_title: string;
  window_title: string;
  is_active: boolean;
  is_zoomed: boolean;
  tty_name: string;
}

export async function listWezTermPanes(): Promise<UnifiedTerminalWindow[]> {
  const available = await isWezTermAvailable();
  if (!available) return [];

  try {
    const { stdout } = await execAsync('wezterm cli list --format json');
    const items = JSON.parse(stdout) as WezTermCliItem[];
    const windows: UnifiedTerminalWindow[] = [];

    for (const item of items) {
      const paneId = item.pane_id.toString();
      const meta = detectProcessMeta(item.title || item.window_title || '', []);

      windows.push({
        id: item.pane_id,
        compositeId: `wezterm:${paneId}`,
        provider: 'wezterm',
        providerLabel: 'WezTerm',
        title: item.title || item.tab_title || `WezTerm [${paneId}]`,
        cwd: item.cwd?.replace('file://', '') || '',
        pid: 0,
        lines: item.size?.rows || 24,
        columns: item.size?.cols || 80,
        is_focused: item.is_active,
        is_active: item.is_active,
        supportsMirror: true,
        supportsInput: true,
        foreground_processes: [],
        category: meta.badge,
        meta,
        workspace: item.workspace ? `WezTerm (${item.workspace})` : 'WezTerm',
      });
    }

    return windows;
  } catch (err) {
    // If WezTerm server is not running, ignore
    return [];
  }
}

export async function getWezTermScreen(paneId: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`wezterm cli get-text --pane-id "${paneId}" --escapes`);
    return stdout;
  } catch (err: any) {
    return `[WezTerm Error] Nie można odczytać ekranu ${paneId}: ${err?.message || err}`;
  }
}

export async function sendWezTermInput(paneId: string, input: string): Promise<boolean> {
  try {
    // WezTerm send-text supports raw strings
    const escaped = input.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await execAsync(`wezterm cli send-text --pane-id "${paneId}" --no-paste "${escaped}"`);
    return true;
  } catch (err) {
    console.error(`[WezTerm] Błąd wysyłania tekstu do ${paneId}:`, err);
    return false;
  }
}
