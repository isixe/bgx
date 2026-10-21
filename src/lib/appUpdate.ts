import pkg from '../../package.json';
import { fetchLatestRelease } from './release';
import type { UpdateCheckState } from '../types/app';

export const APP_VERSION = pkg.version;

export const DOWNLOAD_URL = 'https://bgx.itea.dev/download/';

export function isDesktopApp(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => {
      const value = Number.parseInt(part, 10);
      return Number.isFinite(value) ? value : 0;
    });
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const base = parseVersion(current);
  const length = Math.max(next.length, base.length);

  for (let i = 0; i < length; i += 1) {
    const a = next[i] ?? 0;
    const b = base[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

export interface AppUpdateResult {
  state: Exclude<UpdateCheckState, 'idle' | 'checking'>;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
}

export async function checkForAppUpdate(timeoutMs?: number): Promise<AppUpdateResult> {
  const currentVersion = APP_VERSION;

  try {
    const release = await fetchLatestRelease(timeoutMs);
    const latestVersion = release.tagName.replace(/^v/i, '');

    if (latestVersion && isNewerVersion(latestVersion, currentVersion)) {
      return { state: 'available', currentVersion, latestVersion, downloadUrl: DOWNLOAD_URL };
    }

    return {
      state: 'up-to-date',
      currentVersion,
      latestVersion: latestVersion || currentVersion,
      downloadUrl: DOWNLOAD_URL,
    };
  } catch {
    return {
      state: 'error',
      currentVersion,
      latestVersion: '',
      downloadUrl: DOWNLOAD_URL,
    };
  }
}
