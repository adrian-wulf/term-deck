# TermDeck — Architektura i Koncepcja Techniczna

## 1. Wyzwanie i Stan Wyjściowy

- **Stacja robocza**: CachyOS (Arch Linux), Hyprland 0.56.2 (Wayland), Kitty 0.48.2, Fish shell 4.9.3.
- **Klient**: iPhone 16 Pro Max (Safari / PWA na ekranie początkowym, ekran 6.9", Dynamic Island).
- **Istniejące procesy**: Wielosesyjność (Claude Code CLI, Antigravity CLI, dev serwery, kompilacje).
- **Zasób w systemie**: Kitty ma już skonfigurowany protokół zdalnego sterowania:
  - `allow_remote_control yes`
  - `listen_on unix:/tmp/kitty`
  - Instancje tworzą gniazda w `/tmp/kitty-<PID>`.

---

## 2. Architektura Systemu

```
┌─────────────────────────────────────────────────────────────┐
│                    iPhone 16 Pro Max                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   TermDeck PWA (Safari Standalone Mode)               │  │
│  │   - Dashboard sesji (Karty okien / procesów)          │  │
│  │   - Terminal Viewport (xterm.js + ANSI renderer)      │  │
│  │   - Virtual Accessory Bar (Esc, Ctrl, Tab, Arrows)    │  │
│  │   - Touch Input / Haptic Feedback Engine              │  │
│  └───────────────────────────▲───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │ WebSocket (WSS) + HTTPS
                               │ (Lokalne Wi-Fi lub Tailscale)
┌──────────────────────────────┼──────────────────────────────┐
│  Host (CachyOS / PC)         ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  TermDeck Daemon (Node.js / Express / ws)             │  │
│  │  - Auth & Session Guard (PIN / Bearer token)          │  │
│  │  - Kitty IPC Manager (UNIX socket communication)      │  │
│  │  - PTY Engine (node-pty dla nowych powłok Fish)       │  │
│  │  - Hyprland State Watcher (hyprctl IPC / grim)        │  │
│  └───────────────▲────────────────────────▲──────────────┘  │
│                  │                        │                 │
│      UNIX Socket │            UNIX Socket │ / hyprctl IPC   │
│      /tmp/kitty-*│                        │                 │
│  ┌───────────────▼─────────┐    ┌─────────▼──────────────┐  │
│  │ Kitty Window 1 (Claude) │    │ Hyprland Compositor    │  │
│  │ Kitty Window 2 (Agy)    │    │ (Workspaces, Window    │  │
│  │ Kitty Window 3 (Server) │    │  Focus, Active state)  │  │
│  └─────────────────────────┘    └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Komponenty i Przepływ Danych

### A. Monitorowanie i Kontrola Istniejących Okien Kitty (Mirror Mode)
1. **Odkrywanie okien**:
   - Backend skanuje `/tmp/kitty-*` lub odpytuje aktywne sockety poleceniem `kitty @ --to unix:/tmp/kitty-<PID> ls`.
   - Zwraca listę okien, tytuł, katalog roboczy (`cwd`), listę aktywnych procesów potomnych (`cmdline`, `pid`), stan skupienia.
2. **Pobieranie bufora (ANSI Stream)**:
   - Backend wywołuje `kitty @ --to unix:/tmp/kitty-<PID> get-text --match id:<win_id> --ansi`.
   - Zmiany są przesyłane do klienta przez WebSocket (delta lub odświeżanie strumieniowe).
3. **Wprowadzanie danych (Input forwarding)**:
   - Wpisanie tekstu na telefonie lub kliknięcie przycisku szybkiej akcji wysyła żądanie do backendu.
   - Backend przekazuje znaki: `kitty @ --to unix:/tmp/kitty-<PID> send-text --match id:<win_id> -- <input>`.
   - Działa bezpośrednio na oknie widocznym na monitorze stacjonarnym.

### B. Nowe Niezależne Terminale (Direct PTY Mode)
- Gdy z poziomu telefonu chcesz odpalić coś nowego bez ingerowania w obecne okna na monitorze:
- Backend tworzy proces PTY (`node-pty`) z powłoką `fish`.
- Dwukierunkowy, surowy strumień WebSocket połączony z biblioteką `xterm.js` w przeglądarce.

### C. Warstwa Hyprland (Opcjonalna integracja pulpitu)
- `hyprctl clients -j` dostarcza informacji o workspace, na którym znajduje się dane okno.
- Możliwość wywołania `hyprctl dispatch focuswindow pid:<PID>` lub przełączenia workspace z telefonu.
- Miniaturki okien przez `grim` (narzędzie do zrzutów Wayland już obecne w systemie).

---

## 4. Wymagania i Optymalizacja pod iPhone 16 Pro Max

1. **Manifest PWA**:
   - `display: standalone` — ukrywa pasek adresu i nawigacji Safari.
   - `theme_color: #1e1e2e` (Catppuccin / dopasowany do motywu CachyOS).
   - Obsługa ikon w formacie Apple Touch Icon (`180x180`, `512x512`).
2. **Obsługa Viewportu i Dynamic Island**:
   - `viewport-fit=cover` w znaczniku meta.
   - Odpowiednie marginesy CSS `env(safe-area-inset-top)` oraz `env(safe-area-inset-bottom)`.
   - Obsługa `window.visualViewport` przy wysuwaniu wirtualnej klawiatury iOS (zapobiega ucinaniu dołu terminala).
3. **Pasek klawiszy funkcyjnych (Accessory Bar)**:
   - Klawiatura iOS nie posiada: `Esc`, `Tab`, `Ctrl`, `Alt`, klawiszy strzałek.
   - Nad klawiaturą wyświetlany jest responsywny pasek z dedykowanymi przyciskami (w tym modyfikatory `Ctrl+` i `Alt+` działające jako sticky toggle).
4. **Certyfikat HTTPS / WSS**:
   - iOS wymaga bezpiecznego kontekstu (HTTPS) dla większości API PWA oraz stabilnego utrzymywania WebSocketów w tle.
   - Backend wygeneruje automatycznie certyfikat lokalny (self-signed lub mkcert) bądź skorzysta z Tailscale HTTPS.

---

## 5. Bezpieczeństwo

- Ponieważ backend ma uprawnienia do uruchamiania poleceń w powłoce użytkownika `wulf`:
  - Dostęp chroniony PIN-em / hasłem przy pierwszym połączeniu.
  - Zapis tokena sesji w `localStorage` PWA.
  - Ograniczenie nasłuchiwania do zaufanego interfejsu sieciowego (LAN / Tailscale).
