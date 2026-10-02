import { useCallback, useEffect, useState } from 'react';
import {
  Apple,
  Download,
  Layers,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Terminal,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { useAppStore } from '../../stores/appStore';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

const LATEST_RELEASE_API = 'https://api.github.com/repos/isixe/bgx/releases/latest';

type OsId = 'windows' | 'macos' | 'linux';

type AssetKind =
  'win-installer' | 'win-portable' | 'mac-dmg' | 'mac-zip' | 'linux-appimage' | 'linux-deb';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface ReleaseInfo {
  tagName: string;
  assets: Partial<Record<AssetKind, ReleaseAsset>>;
}

type LoadStatus = 'loading' | 'ready' | 'error';

const ASSET_MATCHERS: [AssetKind, RegExp][] = [
  ['win-installer', /-win-[a-z0-9]+\.exe$/i],
  ['win-portable', /-portable\.exe$/i],
  ['mac-dmg', /-mac-[a-z0-9]+\.dmg$/i],
  ['mac-zip', /-mac-[a-z0-9]+\.zip$/i],
  ['linux-appimage', /\.appimage$/i],
  ['linux-deb', /\.deb$/i],
];

const PLATFORMS: { id: OsId; labelKey: string; kinds: AssetKind[] }[] = [
  { id: 'windows', labelKey: 'downloadPage.windows', kinds: ['win-installer', 'win-portable'] },
  { id: 'macos', labelKey: 'downloadPage.macOS', kinds: ['mac-dmg', 'mac-zip'] },
  { id: 'linux', labelKey: 'downloadPage.linux', kinds: ['linux-appimage', 'linux-deb'] },
];

const KIND_LABEL_KEYS: Record<AssetKind, string> = {
  'win-installer': 'downloadPage.kindWinInstaller',
  'win-portable': 'downloadPage.kindWinPortable',
  'mac-dmg': 'downloadPage.kindMacDmg',
  'mac-zip': 'downloadPage.kindMacZip',
  'linux-appimage': 'downloadPage.kindLinuxAppImage',
  'linux-deb': 'downloadPage.kindLinuxDeb',
};

const PLATFORM_ICONS: Record<OsId, typeof Monitor> = {
  windows: Monitor,
  macos: Apple,
  linux: Terminal,
};

const FEATURES: { icon: typeof Monitor; labelKey: string }[] = [
  { icon: WifiOff, labelKey: 'downloadPage.featureOffline' },
  { icon: Layers, labelKey: 'downloadPage.featureBatch' },
  { icon: ShieldCheck, labelKey: 'downloadPage.featureFree' },
];

function detectOs(): OsId | null {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return null;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

function fetchLatestRelease(): Promise<ReleaseInfo> {
  return fetch(LATEST_RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`GitHub API responded with ${response.status}`);
      return response.json() as Promise<Record<string, unknown>>;
    })
    .then((data) => ({
      tagName: typeof data.tag_name === 'string' ? data.tag_name : '',
      assets: collectAssets(data.assets),
    }));
}

export function DownloadPage() {
  const { t, language } = useTranslation();
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [detectedOs] = useState<OsId | null>(() =>
    typeof navigator === 'undefined' ? null : detectOs(),
  );

  const load = useCallback(() => {
    fetchLatestRelease().then(
      (info) => {
        setRelease(info);
        setStatus('ready');
      },
      () => {
        setStatus('error');
      },
    );
  }, []);

  const retry = () => {
    setStatus('loading');
    load();
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    document.title = t('downloadPage.documentTitle');
  }, [language, t]);

  const surfaceBg = isDarkMode ? 'bg-slate-900' : 'bg-slate-50';
  const headerStyle = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const titleStyle = isDarkMode ? 'text-white' : 'text-slate-900';
  const mutedStyle = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const cardStyle = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';

  return (
    <div className={`h-[100dvh] overflow-y-auto ${surfaceBg}`}>
      <header
        className={`sticky top-0 z-10 flex h-14 items-center justify-between border-b px-4 ${headerStyle}`}
      >
        <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <img src="/favicon.ico" alt="BGX" className="h-8 w-8 rounded-lg" />
          <span className={`text-base font-semibold ${titleStyle}`}>BGX</span>
        </a>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-14 pt-10">
        <div className="text-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              isDarkMode
                ? 'border-indigo-500/40 bg-indigo-900/40 text-indigo-300'
                : 'border-indigo-200 bg-indigo-50 text-indigo-600'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            {release?.tagName
              ? `${t('downloadPage.versionLabel')} ${release.tagName}`
              : t('downloadPage.versionLabel')}
          </span>
          <h1 className={`mt-4 text-3xl font-bold ${titleStyle}`}>{t('downloadPage.title')}</h1>
          <p className={`mx-auto mt-3 max-w-xl text-sm ${mutedStyle}`}>
            {t('downloadPage.subtitle')}
          </p>
        </div>

        <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, labelKey }) => (
            <li
              key={labelKey}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-3 text-xs ${cardStyle}`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
              />
              <span className={mutedStyle}>{t(labelKey)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {status === 'loading' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={`h-40 animate-pulse rounded-xl border ${cardStyle} ${index === 2 ? 'sm:col-span-2' : ''}`}
                />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div
              className={`flex flex-col items-center gap-4 rounded-xl border p-8 text-center ${
                isDarkMode ? 'border-red-500/40 bg-slate-800' : 'border-red-200 bg-white'
              }`}
            >
              <p className={`text-sm ${mutedStyle}`}>{t('downloadPage.loadFailed')}</p>
              <button
                onClick={retry}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <RefreshCw className="h-4 w-4" />
                {t('downloadPage.retry')}
              </button>
            </div>
          )}

          {status === 'ready' && release && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {PLATFORMS.map(({ id, labelKey, kinds }) => {
                const Icon = PLATFORM_ICONS[id];
                const isRecommended = detectedOs === id;
                const available = kinds
                  .map((kind) => ({ kind, asset: release.assets[kind] }))
                  .filter((entry): entry is { kind: AssetKind; asset: ReleaseAsset } =>
                    Boolean(entry.asset),
                  );

                return (
                  <section
                    key={id}
                    className={`rounded-xl border p-5 ${cardStyle} ${
                      isRecommended
                        ? 'ring-2 ring-indigo-500 sm:col-span-2'
                        : available.length === 0
                          ? 'opacity-70 sm:col-span-2'
                          : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-5 w-5 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}
                        />
                        <h2 className={`text-base font-semibold ${titleStyle}`}>{t(labelKey)}</h2>
                      </div>
                      {isRecommended && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            isDarkMode
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-indigo-100 text-indigo-600'
                          }`}
                        >
                          {t('downloadPage.recommended')}
                        </span>
                      )}
                    </div>

                    {available.length === 0 ? (
                      <p className={`mt-4 text-sm ${mutedStyle}`}>{t('downloadPage.noAssets')}</p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {available.map(({ kind, asset }) => {
                          const size = formatSize(asset.size);
                          return (
                            <li
                              key={kind}
                              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 ${cardStyle}`}
                            >
                              <div className="min-w-0">
                                <div className={`text-sm font-medium ${titleStyle}`}>
                                  {t(KIND_LABEL_KEYS[kind])}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                  {asset.name}
                                  {size && ` · ${size}`}
                                </div>
                              </div>
                              <a
                                href={asset.browser_download_url}
                                download={asset.name}
                                aria-label={`${t('downloadPage.download')} ${asset.name}`}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                              >
                                <Download className="h-3.5 w-3.5" />
                                {t('downloadPage.download')}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <p className="text-xs text-slate-500">{t('downloadPage.footerNote')}</p>
          <a
            href="/"
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isDarkMode
                ? 'text-indigo-400 hover:text-indigo-300'
                : 'text-indigo-600 hover:text-indigo-700'
            }`}
          >
            {t('downloadPage.backToWeb')}
          </a>
        </div>
      </main>
    </div>
  );
}
