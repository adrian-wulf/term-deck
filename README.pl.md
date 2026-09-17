# 📱 TermDeck

<p align="center">
  🌐 <strong>Języki:</strong>
  <a href="README.md">🇬🇧 English</a> •
  <a href="README.pl.md"><strong>🇵🇱 Polski</strong></a> •
  <a href="README.de.md">🇩🇪 Deutsch</a> •
  <a href="README.es.md">🇪🇸 Español</a> •
  <a href="README.fr.md">🇫🇷 Français</a>
</p>

<p align="center">
  <strong>Mobilne Centrum Dowodzenia & Hub Terminali PWA dla Smartfonów i Stacji Roboczych.</strong><br>
  <em>Podglądaj bufor na żywo i steruj sesjami Kitty, Tmux, WezTerm oraz ponad 30 agentami AI z łóżka lub ogrodu bezpośrednio z telefonu lub tabletu bez instalowania zbędnych aplikacji.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licencja-MIT-amber.svg?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Platformy-Linux_%7C_macOS_%7C_Windows-3b82f6?style=for-the-badge" alt="Cross-Platform">
  <img src="https://img.shields.io/badge/Klient-Natywne_PWA_(Zero_Instalacji)-10b981?style=for-the-badge" alt="Natywne PWA">
  <img src="https://img.shields.io/badge/Dostęp_Zdalny-Zero--Config_OOTB-0ea5e9?style=for-the-badge&logo=cloudflare" alt="Zero-Config Remote">
  <img src="https://img.shields.io/badge/Dostawcy_Terminali-Kitty_%7C_Tmux_%7C_WezTerm-f97316?style=for-the-badge&logo=gnometerminal" alt="Multi-Terminal Providers">
  <img src="https://img.shields.io/badge/Bezpieczeństwo-Token_256--bit_%2B_Killswitch-ef4444?style=for-the-badge" alt="Security 256-bit Killswitch">
  <a href="https://buymeacoffee.com/adrianwulf"><img src="https://img.shields.io/badge/☕_Postaw_Kawę-adrianwulf-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Postaw Kawę"></a>
  <a href="https://github.com/sponsors/adrian-wulf"><img src="https://img.shields.io/badge/GitHub_Sponsors-Wesprzyj_Autora-EA4AAA?style=for-the-badge&logo=github-sponsors" alt="GitHub Sponsors"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-5.x-black?style=flat-square&logo=express" alt="Express 5">
  <img src="https://img.shields.io/badge/Engine-Node.js_22%2B-339933?style=flat-square&logo=node.js" alt="Node.js 22+">
  <img src="https://img.shields.io/badge/WebSocket-Pełny_Dupleks_WSS-blue?style=flat-square" alt="WebSocket">
  <img src="https://img.shields.io/badge/Terminal-xterm.js_v6-red?style=flat-square" alt="xterm.js">
  <img src="https://img.shields.io/badge/Frontend-Vite_PWA-9333EA?style=flat-square&logo=vite" alt="Vite PWA">
  <img src="https://img.shields.io/badge/Stylistyka-Catppuccin_Mocha-F5C2E7?style=flat-square" alt="Catppuccin">
</p>

---

## 📑 Spis treści
1. [⚡ Dlaczego TermDeck?](#-dlaczego-termdeck)
2. [🌐 Ekosystem Adriana Wulfa](#-ekosystem-adriana-wulfa)
3. [📊 Porównanie: TermDeck vs Tradycyjne SSH i VNC](#-porównanie-termdeck-vs-tradycyjne-ssh-i-vnc)
4. [🏗️ Architektura Systemu](#️-architektura-systemu)
5. [🚀 Szybki Start (Lokalnie & Zdalnie)](#-szybki-start-lokalnie--zdalnie)
6. [🛡️ Architektura Bezpieczeństwa & Panic Killswitch](#️-architektura-bezpieczeństwa--panic-killswitch)
7. [🤖 Obsługiwane Narzędzia AI & Multipleksery](#-obsługiwane-narzędzia-ai--multipleksery)
8. [📱 Ergonomia Mobilna & Touch Bar na iPhone 16 Pro Max](#-ergonomia-mobilna--touch-bar-na-iphone-16-pro-max)
9. [⚙️ Usługa Systemowa (systemd)](#️-usługa-systemowa-systemd)
10. [☕ Wesprzyj Projekt & Filozofia RobinHood dev](#-wesprzyj-projekt--filozofia-robinhood-dev)
11. [⚖️ Impressum & Nota Prawna (§ 5 DDG / MIT)](#️-impressum--nota-prawna--5-ddg--mit)

---

## ⚡ Dlaczego TermDeck?

Podczas przenoszenia stanowiska komputerowego do innego pomieszczenia (np. sypialni) lub pracy na świeżym powietrzu w ogrodzie, deweloperzy pracujący z autonomicznymi agentami LLM stają przed poważnymi barierami:

1. **Bariery instalacji aplikacji**: Brak konieczności instalowania dedykowanego oprogramowania ze sklepów z aplikacjami, kompilacji natywnego kodu na telefon czy uciążliwych certyfikatów i profili.
2. **Tradycyjne aplikacje SSH są ślepe**: Standardowe klienty SSH na telefon (Termius, Prompt, Blink) nie widzą tego, co już działa na monitorze komputera. Tworzą odizolowaną nową sesję shella zamiast pokazywać aktywne procesy stacji roboczej.
3. **Pulpit Zdalny (VNC / RDP) nie nadaje się na ekran dotykowy**: Przesyłanie strumienia wideo całego pulpitu na telefon oznacza mikroskopijne czcionki, niewygodną emulację kursora myszy, ogromne zużycie transferu i błyskawiczne drenowanie baterii.
4. **Trudności z siecią poza domowym Wi-Fi**: Dostęp z ogrodu po LTE/5G zwykle wymusza skomplikowaną konfigurację routera, publiczny adres IP lub logowanie do zewnętrznych portali.

**TermDeck rozwiązuje to raz na zawsze:**
* **Natywne PWA (Progressive Web App)**: Zapisz do ekranu początkowego Safari lub Chrome w 2 kliknięciach. Pełny ekran, obsługa Dynamic Island i brak pasków przeglądarki.
* **Bezinwazyjny Mirroring bufora w czasie rzeczywistym**: Natywne gniazda IPC w **Kitty**, **Tmux** i **WezTerm** przesyłają strumień kolorów ANSI i przyjmują komendy bez opóźnień.
* **Rejestr Agentów AI**: Automatycznie rozpoznaje ponad 30 narzędzi LLM (Claude Code, Antigravity, Kimi Code, Codex, DeepCode, JCode, Aider, Goose) oraz serwery deweloperskie z kategoryzacją i etykietami.
* **Zdalny tunel Out-of-the-Box**: Komenda `pnpm run tunnel` automatycznie uruchamia szyfrowany tunel Cloudflare Quick Tunnel bez potrzeby rejestracji konta ani posiadania domeny. W terminalu komputera pojawia się kod QR (ANSI) gotowy do zeskanowania aparatem telefonu.
* **Wojskowy Panic Killswitch**: 256-bitowy token kryptograficzny zawarty bezpośrednio w kodzie QR. Każda próba skanowania botów lub 3 nieudane próby z zewnątrz natychmiast **niszczą proces tunelu** i wysyłają powiadomienie na pulpit (`notify-send` oraz alerty systemowe).
* **Zaprojektowany pod ergonomię dotykową**: Wyłączony podwójny klik przybliżający ekran, płynny gest swipe po canvasie xterm, blokada wyrywania ekranu przy przeglądaniu historii, sticky `Ctrl`/`Alt` i szuflada szybkich promptów.

---

## 🌐 Ekosystem Adriana Wulfa

TermDeck jest częścią niezależnego ekosystemu narzędzi programistycznych i biznesowych tworzonych zgodnie z filozofią **RobinHood dev**:

| Usługa / Projekt | Adres URL / Repozytorium | Przeznaczenie |
| :--- | :---: | :--- |
| 📱 **TermDeck** | [adrian-wulf/term-deck](https://github.com/adrian-wulf/term-deck) | **Mobilny Hub Terminali:** Centrum dowodzenia PWA dla iPhone'a i stacji roboczych (Kitty, Tmux, WezTerm). |
| 🛡️ **Nachtwache** | [sentry.social-wulf.eu](https://sentry.social-wulf.eu) | **Autonomiczny Strażnik Błędów:** Drop-in zamiennik Sentry w pojedynczej binarce w Rust z AI Auto-Fix (~15 MB RAM). |
| 🚀 **Wulf Lead.er** | [lead.social-wulf.eu](https://lead.social-wulf.eu) | **B2B Lead Intelligence & OSINT Auditor:** Pozyskiwanie leadów lokalnych, audyt SEO/Core Web Vitals i analiza technologii. |
| 🌐 **Central Wulf Hub** | [social-wulf.eu](https://social-wulf.eu) | **Główny Portal Ekosystemu:** Portfolio, narzędzia biznesowe i dokumentacja techniczna Adriana Wulfa. |
| 💼 **Wulf Code** | [wulf-code.it](https://wulf-code.it) | **Software House & Consulting:** Inżynieria oprogramowania, systemy wysokiej wydajności i audyty bezpieczeństwa. |

---

## 🚀 Szybki Start (Lokalnie & Zdalnie)

### Wymagania wstępne
* **System operacyjny hosta**: Linux (Ubuntu, Debian, Arch, Fedora itp.), macOS lub Windows (PowerShell, WSL2, Windows Terminal, ConEmu)
* **Środowisko**: Node.js 22+ oraz `pnpm`
* **Terminal / Multiplekser**: **Kitty** (`allow_remote_control yes`), **Tmux**, **WezTerm** lub wbudowany bezpośredni shell PTY

### Instalacja
```bash
# 1. Sklonuj repozytorium
git clone https://github.com/adrian-wulf/term-deck.git
cd term-deck

# 2. Zainstaluj zależności
pnpm install

# 3. Zbuduj frontend
pnpm build
```

### Opcja A: Dostęp w sieci domowej (LAN)
```bash
pnpm start
```
* Działa pod adresem: `http://192.168.x.x:3000`.
* Domyślny PIN: `1337` (zmienny w zmiennej `TERMDECK_PIN`).

### Opcja B: Dostęp zdalny Zero-Config (Ogród / LTE / Podróż)
```bash
pnpm run tunnel
# lub: pnpm start --tunnel
```
* Uruchamia automatyczny, bezpieczny tunel Cloudflare Quick Tunnel.
* Generuje **kod QR** bezpośrednio w konsoli.
* Skieruj aparat telefonu na kod QR — strona otworzy się natychmiast zalogowana tokenem 256-bitowym.
* Wybierz **Udostępnij** -> **Do ekranu początkowego**, aby zainstalować natywne PWA.

---

## ☕ Wesprzyj Projekt & Filozofia RobinHood dev

<p align="center">
  <a href="https://buymeacoffee.com/adrianwulf"><img src="https://img.shields.io/badge/☕_Postaw_Kawę-buymeacoffee.com%2Fadrianwulf-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Postaw Kawę"></a>
  <a href="https://github.com/sponsors/adrian-wulf"><img src="https://img.shields.io/badge/GitHub_Sponsors-Wesprzyj_Autora-EA4AAA?style=for-the-badge&logo=github-sponsors" alt="GitHub Sponsors"></a>
</p>

### Czym jest filozofia RobinHood dev?
> **"Wolność programisty, ergonomia pracy i suwerenność nad własną stacją roboczą powinny być dostępne natychmiast z każdego urządzenia, bez barier i zamkniętych ekosystemów."**

**TermDeck powstał w duchu RobinHood dev:**
* Zapewnienie programistom pełnej kontroli nad mocą obliczeniową ich komputerów z dowolnego urządzenia mobilnego lub przeglądarki za 0 zł.
* W 100% darmowy kod open-source na licencji MIT, bez telemetrii, bez kont i bez ukrytych opłat.

### Jak możesz pomóc?
* ☕ **Postaw kawę:** [buymeacoffee.com/adrianwulf](https://buymeacoffee.com/adrianwulf)
* 💖 **Zostań sponsorem na GitHubie:** [github.com/sponsors/adrian-wulf](https://github.com/sponsors/adrian-wulf)
* ⭐ **Dodaj gwiazdkę na GitHubie:** Pomóż projektowi dotrzeć do programistów na całym świecie.

---

## ⚖️ Impressum & Nota Prawna (§ 5 DDG / MIT)

* **Twórca / Autor:** Adrian Wulf
* **Kontakt:** Dostępny przez profil GitHub: [https://github.com/adrian-wulf](https://github.com/adrian-wulf) oraz portal [https://social-wulf.eu](https://social-wulf.eu) / [https://wulf-code.it](https://wulf-code.it).
* **Licencja:** Oprogramowanie udostępniane jest na otwartej licencji [MIT](LICENSE).

---

<p align="center">
  <em>Stworzone z pasją dla społeczności Open Source przez Adriana Wulfa.</em>
</p>
