# TermDeck — Plan Wdrożenia (Roadmap)

## Faza 1: Fundament Backendowy i API Kitty IPC
- [ ] Inicjalizacja projektu Node.js / TypeScript w `/mnt/dane/projekty/term-deck`.
- [ ] Moduł skanowania socketów `/tmp/kitty-*` oraz integracja z `kitty @ ls`.
- [ ] Endpointy REST & WebSocket:
  - `GET /api/terminals` — lista aktywnych okien Kitty (id, tytuł, cwd, procesy potomne, workspace).
  - `GET /api/terminals/:id/screen` — pobieranie bieżącego bufora tekstowego (`kitty @ get-text --ansi`).
  - `POST /api/terminals/:id/input` — wysyłanie tekstu/klawiszy (`kitty @ send-text`).
  - `WS /ws/stream/:id` — strumień zmian bufora na żywo.
- [ ] Autoryzacja kodem PIN i generowanie certyfikatu SSL (HTTPS/WSS) dla bezpiecznego połączenia z iPhone'a.

## Faza 2: Frontend PWA i UI pod iPhone 16 Pro Max
- [ ] Szkielet aplikacji (Vite + Tailwind/CSS + xterm.js).
- [ ] Konfiguracja PWA:
  - `manifest.json` (`display: standalone`, `theme_color`, ikony).
  - Obsługa iOS Safe Areas (`env(safe-area-inset-top)` dla Dynamic Island).
- [ ] Widok główny Dashboardu:
  - Karty aktywnych terminali (identyfikator, katalog, ikona/badge stanu: Claude, Agy, Serwer, Shell).
  - Przełącznik jednym dotknięciem między sesjami.
- [ ] Widok terminala:
  - Renderowanie z pełnymi kolorami ANSI i formatowaniem.
  - Automatyczne dopasowanie do szerokości ekranu iPhone 16 Pro Max (6.9").

## Faza 3: Mobilny Pasek Narzędzi i Interakcja (Touch Accessory Bar)
- [ ] Pasek narzędziowy nad klawiaturą iOS:
  - Klawisze: `Esc`, `Tab`, `Ctrl`, `Alt`, `Enter`, `↑`, `↓`, `←`, `→`.
  - Szybkie akcje: `Ctrl+C` (przerwij), `Ctrl+D`, `Ctrl+Z`, `Clear`.
  - Tryb sticky dla `Ctrl` i `Alt` (np. kliknięcie `Ctrl` podświetla go, po czym wciśnięcie `C` wysyła `\x03`).
- [ ] Pole szybkiego promptu (Quick Prompt Bar) — możliwość wklejenia dłuższego tekstu lub zatwierdzenia komendy jednym klikiem.
- [ ] Haptic Feedback — delikatne wibracje przy klikaniu klawiszy funkcyjnych.

## Faza 4: Dedykowane Terminale PTY i Integracja Hyprland
- [ ] Obsługa tworzenia nowych, niezależnych sesji terminalowych PTY (Fish shell).
- [ ] Integracja z `hyprctl`:
  - Podgląd na którym pulpicie (workspace) znajduje się dane okno.
  - Przycisk "Focus na monitorze" (aktywuje okno na fizycznym ekranie PC).
- [ ] Opcjonalny podgląd wizualny (zrzut okna przez `grim`).

## Faza 5: Testy i Wdrożenie Autostartu
- [ ] Test połączenia z iPhone 16 Pro Max w sieci domowej (oraz przez ewentualny VPN/Tailscale).
- [ ] Dodanie skrótu PWA na ekranie początkowym iOS.
- [ ] Utworzenie usługi systemd (`termdeck.service`) pod użytkownikiem `wulf` dla automatycznego startu w tle wraz z PC.
