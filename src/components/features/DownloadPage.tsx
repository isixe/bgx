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
import {
  fetchLatestRelease,
  readCachedRelease,
  writeCachedRelease,
  type AssetKind,
  type ReleaseAsset,
  type ReleaseInfo,
} from '../../lib/release';

type OsId = 'windows' | 'macos' | 'linux';

type LoadStatus = 'loading' | 'ready' | 'error';

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

interface DownloadPageProps {
  initialRelease?: ReleaseInfo | null;
}

export function DownloadPage({ initialRelease = null }: DownloadPageProps) {
  const { t, language } = useTranslation();
  const isDarkMode = useAppStore((state) => state.isDarkMode);
  const setIsDarkMode = useAppStore((state) => state.setIsDarkMode);
  const [release, setRelease] = useState<ReleaseInfo | null>(
    () => initialRelease ?? readCachedRelease(),
  );
  const [status, setStatus] = useState<LoadStatus>(() =>
    (initialRelease ?? readCachedRelease()) ? 'ready' : 'loading',
  );
  const [detectedOs] = useState<OsId | null>(() =>
    typeof navigator === 'undefined' ? null : detectOs(),
  );

  const load = useCallback(() => {
    fetchLatestRelease().then(
      (info) => {
        setRelease(info);
        setStatus('ready');
        writeCachedRelease(info);
      },
      () => {
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
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
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <a
            href="https://github.com/isixe/bgx"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            title="GitHub"
            aria-label="GitHub"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
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
                  className={`rounded-xl border p-5 ${cardStyle} ${index === 2 ? 'sm:col-span-2' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 animate-pulse rounded ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`}
                    />
                    <div
                      className={`h-4 w-24 animate-pulse rounded ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`}
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div
                      className={`h-12 animate-pulse rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}
                    />
                    <div
                      className={`h-12 animate-pulse rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}
                    />
                  </div>
                </div>
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
