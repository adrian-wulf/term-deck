import path from 'node:path';
import type { ProcessMeta } from './types.js';

interface ToolSignature {
  matchers: string[];
  name: string;
  category: 'ai' | 'server' | 'editor' | 'shell' | 'terminal';
  color: string;
  isAi: boolean;
}

// Exhaustive registry of AI coding tools & popular developer CLI utilities
const TOOL_SIGNATURES: ToolSignature[] = [
  // --- AI Coding Assistants & LLM Agent CLIs ---
  {
    matchers: ['fcc-claude', 'claude'],
    name: 'Claude Code',
    category: 'ai',
    color: '#cba6f7', // Mauve
    isAi: true,
  },
  {
    matchers: ['agy', 'antigravity', 'gemini-cli'],
    name: 'Antigravity',
    category: 'ai',
    color: '#89b4fa', // Blue
    isAi: true,
  },
  {
    matchers: ['kimi-code', 'kimi', 'kimicode'],
    name: 'Kimi Code',
    category: 'ai',
    color: '#94e2d5', // Teal
    isAi: true,
  },
  {
    matchers: ['codex', 'openai-cli', 'chatgpt-cli', 'chatgpt'],
    name: 'OpenAI Codex',
    category: 'ai',
    color: '#a6e3a1', // Green
    isAi: true,
  },
  {
    matchers: ['deepcode'],
    name: 'DeepCode',
    category: 'ai',
    color: '#74c7ec', // Sapphire
    isAi: true,
  },
  {
    matchers: ['jcode'],
    name: 'JCode',
    category: 'ai',
    color: '#fab387', // Peach
    isAi: true,
  },
  {
    matchers: ['aider', 'aider-chat'],
    name: 'Aider',
    category: 'ai',
    color: '#f9e2af', // Yellow
    isAi: true,
  },
  {
    matchers: ['goose', 'goose-ai'],
    name: 'Goose AI',
    category: 'ai',
    color: '#b4befe', // Lavender
    isAi: true,
  },
  {
    matchers: ['cline', 'cline-cli'],
    name: 'Cline',
    category: 'ai',
    color: '#eba0ac', // Maroon
    isAi: true,
  },
  {
    matchers: ['opencode'],
    name: 'OpenCode',
    category: 'ai',
    color: '#89dceb', // Sky
    isAi: true,
  },
  {
    matchers: ['openhands', 'opendevin'],
    name: 'OpenHands',
    category: 'ai',
    color: '#f5e0dc', // Rosewater
    isAi: true,
  },
  {
    matchers: ['devika'],
    name: 'Devika',
    category: 'ai',
    color: '#f2cdcd', // Flamingo
    isAi: true,
  },
  {
    matchers: ['mentat'],
    name: 'Mentat',
    category: 'ai',
    color: '#f5c2e7', // Pink
    isAi: true,
  },
  {
    matchers: ['continue', 'continue-cli'],
    name: 'Continue CLI',
    category: 'ai',
    color: '#89b4fa', // Blue
    isAi: true,
  },
  {
    matchers: ['cursor', 'cursor-cli'],
    name: 'Cursor CLI',
    category: 'ai',
    color: '#cba6f7', // Mauve
    isAi: true,
  },
  {
    matchers: ['plandex'],
    name: 'Plandex',
    category: 'ai',
    color: '#a6e3a1', // Green
    isAi: true,
  },
  {
    matchers: ['gpt-engineer', 'gpte'],
    name: 'GPT-Engineer',
    category: 'ai',
    color: '#fab387', // Peach
    isAi: true,
  },
  {
    matchers: ['strix'],
    name: 'Strix AI',
    category: 'ai',
    color: '#f38ba8', // Red
    isAi: true,
  },
  {
    matchers: ['foundry'],
    name: 'Foundry',
    category: 'ai',
    color: '#94e2d5', // Teal
    isAi: true,
  },
  {
    matchers: ['smolagents', 'smol-developer'],
    name: 'Smolagents',
    category: 'ai',
    color: '#f9e2af', // Yellow
    isAi: true,
  },
  {
    matchers: ['autogpt', 'babyagi'],
    name: 'AutoGPT',
    category: 'ai',
    color: '#94e2d5', // Teal
    isAi: true,
  },
  {
    matchers: ['bolt', 'bolt-cli'],
    name: 'Bolt.new',
    category: 'ai',
    color: '#74c7ec', // Sapphire
    isAi: true,
  },
  {
    matchers: ['v0'],
    name: 'Vercel v0',
    category: 'ai',
    color: '#cdd6f4', // Text
    isAi: true,
  },
  {
    matchers: ['ollama'],
    name: 'Ollama',
    category: 'ai',
    color: '#bac2de', // Subtext1
    isAi: true,
  },
  {
    matchers: ['llm'],
    name: 'LLM CLI',
    category: 'ai',
    color: '#89b4fa', // Blue
    isAi: true,
  },
  {
    matchers: ['sgpt', 'shellgpt'],
    name: 'ShellGPT',
    category: 'ai',
    color: '#a6e3a1', // Green
    isAi: true,
  },
  {
    matchers: ['fabric', 'fabric-ai'],
    name: 'Fabric AI',
    category: 'ai',
    color: '#cba6f7', // Mauve
    isAi: true,
  },
  {
    matchers: ['copilot', 'gh-copilot'],
    name: 'Copilot CLI',
    category: 'ai',
    color: '#89b4fa', // Blue
    isAi: true,
  },
  {
    matchers: ['amazon-q', 'q'],
    name: 'Amazon Q',
    category: 'ai',
    color: '#fab387', // Peach
    isAi: true,
  },
  {
    matchers: ['tabnine'],
    name: 'Tabnine',
    category: 'ai',
    color: '#94e2d5', // Teal
    isAi: true,
  },
  {
    matchers: ['codecompanion'],
    name: 'CodeCompanion',
    category: 'ai',
    color: '#b4befe', // Lavender
    isAi: true,
  },
  {
    matchers: ['cody'],
    name: 'Sourcegraph Cody',
    category: 'ai',
    color: '#eba0ac', // Maroon
    isAi: true,
  },

  // --- Web Servers & Dev Watchers ---
  {
    matchers: ['vite'],
    name: 'Vite Server',
    category: 'server',
    color: '#a6e3a1',
    isAi: false,
  },
  {
    matchers: ['next', 'nuxt', 'astro', 'remix', 'svelte-kit'],
    name: 'Web Dev Server',
    category: 'server',
    color: '#a6e3a1',
    isAi: false,
  },
  {
    matchers: ['cargo', 'rustc'],
    name: 'Cargo (Rust)',
    category: 'server',
    color: '#fab387',
    isAi: false,
  },
  {
    matchers: ['fcc-server'],
    name: 'FCC Server',
    category: 'server',
    color: '#74c7ec',
    isAi: false,
  },
  {
    matchers: ['uvicorn', 'gunicorn', 'fastapi', 'flask', 'django'],
    name: 'Python Server',
    category: 'server',
    color: '#f9e2af',
    isAi: false,
  },
  {
    matchers: ['docker', 'docker-compose', 'podman'],
    name: 'Docker Container',
    category: 'server',
    color: '#89b4fa',
    isAi: false,
  },

  // --- TUI & Terminal Editors ---
  {
    matchers: ['nvim', 'neovim', 'vim', 'helix', 'hx', 'nano', 'micro'],
    name: 'Editor (TUI)',
    category: 'editor',
    color: '#b4befe',
    isAi: false,
  },
  {
    matchers: ['btop', 'htop', 'top', 'bottom'],
    name: 'System Monitor',
    category: 'editor',
    color: '#fab387',
    isAi: false,
  },
  {
    matchers: ['lazygit', 'tig', 'gitui'],
    name: 'Git TUI',
    category: 'editor',
    color: '#94e2d5',
    isAi: false,
  },

  // --- Shells ---
  {
    matchers: ['fish', 'bash', 'zsh', 'nu', 'sh'],
    name: 'Shell',
    category: 'shell',
    color: '#6c7086',
    isAi: false,
  },
];

const CATPPUCCIN_PALETTE = [
  '#cba6f7', // mauve
  '#89b4fa', // blue
  '#94e2d5', // teal
  '#a6e3a1', // green
  '#f9e2af', // yellow
  '#fab387', // peach
  '#f38ba8', // red
  '#74c7ec', // sapphire
  '#b4befe', // lavender
];

function generateColorHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CATPPUCCIN_PALETTE.length;
  return CATPPUCCIN_PALETTE[index];
}

function extractBinaryName(cmdline: string[]): string {
  if (!cmdline || cmdline.length === 0) return '';
  const first = cmdline[0];
  const basename = path.basename(first).toLowerCase();

  // If node/python/uv/npx/bun wrapper, check next argument
  if (
    (basename === 'node' ||
      basename === 'python' ||
      basename === 'python3' ||
      basename === 'npx' ||
      basename === 'pnpm' ||
      basename === 'uv' ||
      basename === 'uvx') &&
    cmdline.length > 1
  ) {
    for (let i = 1; i < cmdline.length; i++) {
      const arg = cmdline[i];
      if (!arg.startsWith('-')) {
        const subBase = path.basename(arg).toLowerCase();
        if (subBase !== 'run' && subBase !== 'exec' && subBase !== 'dev') {
          return subBase;
        }
      }
    }
  }

  return basename;
}

export function detectProcessMeta(title: string, cmdlines: string[][]): ProcessMeta {
  const allBinaries: string[] = [];
  const fullText = (title + ' ' + cmdlines.map((c) => c.join(' ')).join(' ')).toLowerCase();

  for (const cmd of cmdlines) {
    const bin = extractBinaryName(cmd);
    if (bin) allBinaries.push(bin);
  }

  // 1. Exact binary name match
  for (const sig of TOOL_SIGNATURES) {
    if (allBinaries.some((b) => sig.matchers.includes(b))) {
      return {
        type: sig.category,
        label: sig.name,
        badge: sig.name,
        color: sig.color,
        isAiAgent: sig.isAi,
      };
    }
  }

  // 2. Substring in title or cmdline
  for (const sig of TOOL_SIGNATURES) {
    for (const m of sig.matchers) {
      if (m.length > 2 && fullText.includes(m)) {
        return {
          type: sig.category,
          label: sig.name,
          badge: sig.name,
          color: sig.color,
          isAiAgent: sig.isAi,
        };
      }
    }
  }

  // 2. Generic Dev Server / Compiler pattern
  if (
    fullText.includes('server') ||
    fullText.includes('dev') ||
    fullText.includes('run') ||
    fullText.includes('watch')
  ) {
    return {
      type: 'server',
      label: 'Dev Server',
      badge: 'Dev Server',
      color: '#a6e3a1',
      isAiAgent: false,
    };
  }

  // 3. Fallback: Display cleanly as "Terminal" (or custom binary if known)
  const activeBin = allBinaries.find((b) => b !== 'fish' && b !== 'bash' && b !== 'zsh' && b !== 'kitty');

  if (activeBin) {
    const formatted = activeBin.charAt(0).toUpperCase() + activeBin.slice(1);
    return {
      type: 'terminal',
      label: formatted,
      badge: formatted,
      color: generateColorHash(activeBin),
      isAiAgent: false,
    };
  }

  return {
    type: 'terminal',
    label: 'Terminal',
    badge: 'Terminal',
    color: '#6c7086', // Dim gray
    isAiAgent: false,
  };
}
