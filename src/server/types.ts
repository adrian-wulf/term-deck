export interface KittyForegroundProcess {
  cmdline: string[];
  cwd: string;
  pid: number;
}

export interface ProcessMeta {
  type: 'ai' | 'server' | 'editor' | 'shell' | 'terminal';
  label: string;
  badge: string;
  color: string;
  isAiAgent: boolean;
}

export interface KittyWindow {
  id: number | string;
  compositeId: string;
  provider?: 'kitty' | 'tmux' | 'wezterm' | 'system' | 'pty';
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
}

export interface HyprlandClient {
  address: string;
  mapped: boolean;
  hidden: boolean;
  at: [number, number];
  size: [number, number];
  workspace: {
    id: number;
    name: string;
  };
  floating: boolean;
  monitor: number;
  class: string;
  title: string;
  initialClass: string;
  initialTitle: string;
  pid: number;
  xwayland: boolean;
  pinned: boolean;
  fullscreen: boolean;
  fullscreenClient: number;
  grouped: any[];
  tags: string[];
  swallowing: string;
  focusHistoryID: number;
}

export interface PTYSession {
  id: string;
  title: string;
  cwd: string;
  createdAt: number;
  pid: number;
  buffer: string[];
}

export type WSClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'subscribe_kitty'; compositeId: string }
  | { type: 'unsubscribe_kitty' }
  | { type: 'kitty_input'; compositeId: string; data: string }
  | { type: 'pty_create'; cwd?: string }
  | { type: 'pty_subscribe'; id: string }
  | { type: 'pty_input'; id: string; data: string }
  | { type: 'pty_resize'; id: string; cols: number; rows: number }
  | { type: 'pty_destroy'; id: string };

export type WSServerMessage =
  | { type: 'auth_ok' }
  | { type: 'auth_error'; message: string }
  | { type: 'terminals_update'; terminals: KittyWindow[]; ptys: Array<{ id: string; title: string; cwd: string }> }
  | { type: 'kitty_screen'; compositeId: string; content: string; title: string }
  | { type: 'pty_data'; id: string; data: string }
  | { type: 'pty_exit'; id: string; exitCode: number }
  | { type: 'error'; message: string };
