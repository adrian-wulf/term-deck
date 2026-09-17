#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"

mkdir -p "$SERVICE_DIR"
cp "$DIR/termdeck.service" "$SERVICE_DIR/termdeck.service"

systemctl --user daemon-reload
systemctl --user enable --now termdeck.service

echo "[TermDeck] Usługa systemd została zainstalowana i uruchomiona."
echo "[TermDeck] Status: systemctl --user status termdeck.service"
echo "[TermDeck] Logi: journalctl --user -u termdeck.service -f"
