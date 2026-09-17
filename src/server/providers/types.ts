import type { ProcessMeta, KittyForegroundProcess } from '../types.js';

export type TerminalProviderType = 'kitty' | 'tmux' | 'wezterm' | 'system' | 'pty';

export interface UnifiedTerminalWindow {
  id: number | string;
  compositeId: string; // e.g. "kitty:123:1", "tmux:0:0:1", "wezterm:3", "system:pts-2:456"
  provider: TerminalProviderType;
  providerLabel: string; // "Kitty", "Tmux", "WezTerm", "Alacritty", "Foot", "Konsole"
  socketPath?: string;
  socketPid?: number;
  title: string;
  cwd: string;
  pid: number;
  lines: number;
  columns: number;
  is_focused: boolean;
  is_active: boolean;
  supportsMirror: boolean; // true if screen buffer can be streamed in real-time
  supportsInput: boolean;  // true if remote keyboard inputs can be injected
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
