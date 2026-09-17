# TermDeck (Mobile Terminal Hub)

Custom PWA & Web dashboard designed for iPhone 16 Pro Max to monitor and interact with all active desktop terminal sessions on CachyOS / Hyprland (Kitty).

## Kluczowe założenia

1. **Zero kosztów App Store**:
   - Działa jako natywna aplikacja **PWA (Progressive Web App)** dodana do ekranu początkowego Safari na iOS (*Add to Home Screen*).
   - Tryb pełnoekranowy (`standalone`), brak pasków Safari, obsługa Dynamic Island (`viewport-fit=cover`) i bezpiecznych stref iOS.
2. **Podgląd i kontrola istniejących terminali (Kitty)**:
   - Wykorzystanie natywnego socketu zdalnego sterowania Kitty (`allow_remote_control yes`, `/tmp/kitty-*`).
   - Podgląd na żywo bufora z kolorami ANSI dowolnego uruchomionego okna Kitty (sesje Claude Code, agy, kompilacje, serwery).
   - Przesyłanie znaków, tekstu i skrótów (Enter, Ctrl+C, Ctrl+D, odpowiedzi na prompty).
3. **Dedykowany mobilny terminal (Direct PTY)**:
   - Możliwość otwarcia pełnoprawnej interaktywnej sesji PTY (xterm.js + WebSocket + Fish shell) bezpośrednio z telefonu w razie potrzeby odpalenia nowych poleceń z łóżka.
4. **Wsparcie dla klawiatury mobilnej iOS**:
   - Pasek funkcyjny z klawiszami: `Esc`, `Tab`, `Ctrl`, `Alt`, `↑`, `↓`, `←`, `→`, `Ctrl+C`, `Enter`, `/`, `~`, `|`.
5. **Integracja z Hyprland**:
   - Odczyt aktualnych okien i workspace'ów (`hyprctl clients -j`).
   - Opcjonalne zrzuty ekranu (`grim`) i przełączanie okien/pulpitów.
6. **Bezpieczeństwo i Dostęp Out-of-the-Box**:
   - **Tryb LAN (Domyślny)**: `pnpm start` — nasłuchuje tylko w sieci lokalnej (`http://192.168.x.x:3000`).
   - **Tryb Zdalny (LTE / Ogród / Podróż)**: `pnpm run tunnel` (lub `pnpm start --tunnel`):
     - Automatycznie zestawia bezpieczny tunel Cloudflare Quick Tunnel bez konieczności zakładania konta ani posiadania domeny.
     - Generuje w konsoli **kod QR (ANSI)** do natychmiastowego zeskanowania aparatem iPhone'a.
     - **256-bitowy kryptograficzny token sesji** zaszyty w linku QR — logowanie jednym dotknięciem bez wpisywania PIN-u.
     - **Panic Killswitch**: Każda próba skanowania botów lub 3 nieudane próby autoryzacji z zewnątrz natychmiast bezpowrotnie **niszczą proces tunelu**, odcinają dostęp do PC i wysyłają powiadomienie na pulpit (`notify-send` + `hyprctl notify`).

