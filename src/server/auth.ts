import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { recordSecurityViolation } from './tunnel.js';

const DEFAULT_PIN = process.env.TERMDECK_PIN || '1337';
const validTokens = new Set<string>();

// Punkt 1: 256-bitowy kryptograficzny token sesji generowany przy każdym starcie
export const masterSessionToken = randomBytes(32).toString('hex');
validTokens.add(masterSessionToken);

// Rate limiting for LAN
const lanFailures = new Map<string, { count: number; lockedUntil: number }>();

export function getMasterSessionToken(): string {
  return masterSessionToken;
}

export function getExpectedPin(): string {
  return process.env.TERMDECK_PIN || DEFAULT_PIN;
}

export function isCloudflareRequest(req: Request): boolean {
  return Boolean(req.headers['cf-ray'] || req.headers['cf-connecting-ip']);
}

export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string') return cfIp;
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

export async function authenticatePin(pin: string, req?: Request): Promise<string | null> {
  const ip = req ? getClientIp(req) : 'local';
  const isCf = req ? isCloudflareRequest(req) : false;

  // Check LAN lockout
  const now = Date.now();
  const lanRecord = lanFailures.get(ip);
  if (lanRecord && lanRecord.lockedUntil > now) {
    return null;
  }

  if (pin === getExpectedPin()) {
    // Successfully authenticated
    if (lanRecord) lanFailures.delete(ip);
    const token = randomBytes(24).toString('hex');
    validTokens.add(token);
    return token;
  }

  // Failed PIN attempt
  if (isCf) {
    // Punkt 2: Każda błędna próba PINu przez publiczny tunel Cloudflare jest liczona do natychmiastowego killswitcha
    await recordSecurityViolation(ip, 'Błędny kod PIN z zewnętrznego tunelu');
  } else {
    // Standard LAN rate limiting (5 attempts = 10 min lock)
    const current = lanRecord?.count || 0;
    const nextCount = current + 1;
    if (nextCount >= 5) {
      lanFailures.set(ip, { count: nextCount, lockedUntil: now + 10 * 60 * 1000 });
      console.warn(`[SECURITY] Adres LAN ${ip} zablokowany na 10 minut po 5 błędnych próbach PIN.`);
    } else {
      lanFailures.set(ip, { count: nextCount, lockedUntil: 0 });
    }
  }

  return null;
}

export function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return validTokens.has(token);
}

export function revokeToken(token: string): void {
  validTokens.delete(token);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string);

  if (isValidToken(token)) {
    return next();
  }

  // If request arrived via Cloudflare tunnel and tries accessing API without auth
  if (isCloudflareRequest(req)) {
    const ip = getClientIp(req);
    // Log violation towards killswitch
    recordSecurityViolation(ip, `Nieautoryzowany dostęp do API: ${req.method} ${req.path}`);
  }

  res.status(401).json({ error: 'Unauthorized. Valid token or PIN required.' });
}
