import { startTunnel, type Tunnel } from 'untun';
import qrcode from 'qrcode';
import { exec } from 'node:child_process';
import os from 'node:os';

interface TunnelState {
  active: boolean;
  tunnelInstance: Tunnel | null;
  url: string | null;
  authUrl: string | null;
  killedBySecurity: boolean;
  killedReason: string | null;
  recentViolations: Array<{ ip: string; reason: string; timestamp: number }>;
}

const state: TunnelState = {
  active: false,
  tunnelInstance: null,
  url: null,
  authUrl: null,
  killedBySecurity: false,
  killedReason: null,
  recentViolations: [],
};

// Rolling violation window: 60 seconds
const VIOLATION_WINDOW_MS = 60_000;
const MAX_FAILURES_BEFORE_KILL = 3;

/**
 * Get all local non-internal IPv4 addresses
 */
export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Send desktop alerts to Linux (via notify-send and hyprctl)
 */
function sendDesktopAlert(title: string, message: string) {
  // Standard freedesktop notification (Dunst, Mako, SwayNC, etc.)
  exec(`notify-send -u critical -a "TermDeck Security" "${title}" "${message}"`, (err) => {
    if (err) {
      // Non-critical if notify-send fails (e.g. headless)
    }
  });

  // Native Hyprland notification badge
  exec(`hyprctl notify 0 8000 "rgb(f38ba8)" "TermDeck: ${title} - ${message}"`, (err) => {
    if (err) {
      // Non-critical if not running in Hyprland
    }
  });
}

/**
 * Record a security violation (e.g. failed login via tunnel, probing without token)
 * Triggers instant tunnel shutdown if >= MAX_FAILURES_BEFORE_KILL within rolling window.
 */
export async function recordSecurityViolation(ip: string, reason: string): Promise<boolean> {
  const now = Date.now();
  // Filter out older violations
  state.recentViolations = state.recentViolations.filter(
    (v) => now - v.timestamp < VIOLATION_WINDOW_MS
  );

  state.recentViolations.push({ ip, reason, timestamp: now });
  const count = state.recentViolations.length;

  console.warn(`[SECURITY WARNING] Niezautoryzowane zapytanie z zewnątrz! IP: ${ip} | Powód: ${reason} (${count}/${MAX_FAILURES_BEFORE_KILL})`);

  if (count >= MAX_FAILURES_BEFORE_KILL) {
    await triggerSecurityKillswitch(ip, `Wykryto ${count} podejrzane próby w krótkim czasie (${reason})`);
    return true;
  }

  return false;
}

/**
 * Panic trigger / killswitch: immediately destroys the Cloudflare tunnel
 */
export async function triggerSecurityKillswitch(sourceIp: string, reason: string): Promise<void> {
  state.killedBySecurity = true;
  state.killedReason = `Intruz IP: ${sourceIp} - ${reason}`;

  console.error('\n' + '█'.repeat(70));
  console.error('  🚨 ALERT BEZPIECZEŃSTWA: TUNNEL CLOUDFLARE NATYCHMIAST ZNISZCZONY!');
  console.error(`  Źródło (IP): ${sourceIp}`);
  console.error(`  Powód:        ${reason}`);
  console.error(`  Data/Czas:    ${new Date().toISOString()}`);
  console.error('  Dostęp z publicznego internetu został CAŁKOWICIE ODCIĘTY.');
  console.error('█'.repeat(70) + '\n');

  // Kill the active tunnel
  try {
    if (state.tunnelInstance) {
      await state.tunnelInstance.close();
    }
  } catch (err) {
    console.error('[TermDeck] Błąd podczas zamykania tunelu:', err);
  } finally {
    state.active = false;
    state.tunnelInstance = null;
    state.url = null;
    state.authUrl = null;
  }

  sendDesktopAlert(
    'ALERT BEZPIECZEŃSTWA: Tunel zniszczony!',
    `Wykryto podejrzany ruch z IP: ${sourceIp}. Tunel Cloudflare został natychmiast wyłączony.`
  );
}

/**
 * Start the Cloudflare Quick Tunnel and display ANSI QR Code
 */
export async function startRemoteTunnel(port: number, sessionToken: string): Promise<string | null> {
  if (state.active && state.url) {
    return state.url;
  }

  try {
    console.log('[TermDeck] Uruchamianie bezpiecznego tunelu Cloudflare (TryCloudflare)...');

    const tunnel = await startTunnel({
      port,
      acceptCloudflareNotice: true,
    });

    if (!tunnel) {
      throw new Error('Nie udało się utworzyć instancji tunelu untun/cloudflared');
    }

    const tunnelUrl = await tunnel.getURL();
    const authUrl = `${tunnelUrl}/?token=${sessionToken}`;

    state.active = true;
    state.tunnelInstance = tunnel;
    state.url = tunnelUrl;
    state.authUrl = authUrl;
    state.killedBySecurity = false;
    state.killedReason = null;
    state.recentViolations = [];

    // Generate ANSI QR Code for instant scanning with iPhone Camera
    const qrCodeAnsi = await qrcode.toString(authUrl, {
      type: 'terminal',
      small: true,
    });

    const localIp = getLocalIp();

    console.log('\n' + '─'.repeat(64));
    console.log('  🚀 TERMDECK ZDALNY DOSTĘP (BEZPIECZNY TUNEL OOTB AKTYWNY)');
    console.log('─'.repeat(64));
    console.log(`  🏠 Sieć lokalna (LAN):   http://${localIp}:${port}`);
    console.log(`  🌐 Publiczny URL:        ${tunnelUrl}`);
    console.log(`  🔐 Token szyfrujący:     256-bit AES (zawarty w kodzie QR)`);
    console.log(`  🛡️ Killswitch:           UZBROJONY (3 nieudane próby = zniszczenie)`);
    console.log('─'.repeat(64));
    console.log('  📱 Zeskanuj aparatorem iPhone\'a, aby połączyć się z ogrodu/LTE:\n');
    console.log(qrCodeAnsi);
    console.log('─'.repeat(64));
    console.log('  Wskazówka: Po otwarciu w Safari wybierz "Dodaj do ekranu początkowego"\n');

    return tunnelUrl;
  } catch (err: any) {
    console.error('[TermDeck] Błąd podczas uruchamiania tunelu Cloudflare:', err?.message || err);
    state.active = false;
    state.tunnelInstance = null;
    return null;
  }
}

/**
 * Manually close the remote tunnel
 */
export async function stopRemoteTunnel(reason: string = 'Wyłączono ręcznie'): Promise<void> {
  if (state.tunnelInstance) {
    try {
      await state.tunnelInstance.close();
    } catch {}
  }
  state.active = false;
  state.tunnelInstance = null;
  state.url = null;
  state.authUrl = null;
  console.log(`[TermDeck] Tunel Cloudflare został zamknięty (${reason}).`);
}

/**
 * Get current tunnel status for API and UI
 */
export function getTunnelStatus() {
  return {
    active: state.active,
    url: state.url,
    killedBySecurity: state.killedBySecurity,
    killedReason: state.killedReason,
    violationsCount: state.recentViolations.length,
    maxViolations: MAX_FAILURES_BEFORE_KILL,
  };
}
