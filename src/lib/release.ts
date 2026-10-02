export type AssetKind =
  'win-installer' | 'win-portable' | 'mac-dmg' | 'mac-zip' | 'linux-appimage' | 'linux-deb';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tagName: string;
  assets: Partial<Record<AssetKind, ReleaseAsset>>;
}

const LATEST_RELEASE_API = 'https://api.github.com/repos/isixe/bgx/releases/latest';

const RELEASE_CACHE_KEY = 'bgx-latest-release';

const ASSET_MATCHERS: [AssetKind, RegExp][] = [
  ['win-installer', /-win-[a-z0-9]+\.exe$/i],
  ['win-portable', /-portable\.exe$/i],
  ['mac-dmg', /-mac-[a-z0-9]+\.dmg$/i],
  ['mac-zip', /-mac-[a-z0-9]+\.zip$/i],
  ['linux-appimage', /\.appimage$/i],
  ['linux-deb', /\.deb$/i],
];

function collectAssets(rawAssets: unknown): ReleaseInfo['assets'] {
  const assets: ReleaseInfo['assets'] = {};
  if (!Array.isArray(rawAssets)) return assets;

  for (const item of rawAssets) {
    if (!item || typeof item !== 'object') continue;
    const { name, browser_download_url: url, size } = item as Record<string, unknown>;
    if (typeof name !== 'string' || typeof url !== 'string') continue;

    for (const [kind, matcher] of ASSET_MATCHERS) {
      if (!assets[kind] && matcher.test(name)) {
        assets[kind] = {
          name,
          browser_download_url: url,
          size: typeof size === 'number' ? size : 0,
        };
        break;
      }
    }
  }
  return assets;
}

export function fetchLatestRelease(timeoutMs = 8000): Promise<ReleaseInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub API responded with ${response.status}`);
      return response.json() as Promise<Record<string, unknown>>;
    })
    .then((data) => ({
      tagName: typeof data.tag_name === 'string' ? data.tag_name : '',
      assets: collectAssets(data.assets),
    }))
    .finally(() => {
      clearTimeout(timer);
    });
}

export function readCachedRelease(): ReleaseInfo | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RELEASE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReleaseInfo> | null;
    if (
      !parsed ||
      typeof parsed.tagName !== 'string' ||
      typeof parsed.assets !== 'object' ||
      parsed.assets === null
    ) {
      return null;
    }
    return { tagName: parsed.tagName, assets: parsed.assets as ReleaseInfo['assets'] };
  } catch {
    // Corrupted cache entry — ignore and fall back to a network load.
    return null;
  }
}

export function writeCachedRelease(info: ReleaseInfo): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify(info));
  } catch {
    // Quota exceeded or storage unavailable — caching is optional.
  }
}
