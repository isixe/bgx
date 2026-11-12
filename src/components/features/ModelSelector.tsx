import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useTranslation } from '../../lib/i18n';
import { getModelById, getLocalizedModel, getModelGroups } from '../../utils/modelUtils';

export function ModelSelector() {
  const {
    currentModel,
    isProcessing,
    setCurrentModel,
    originalImage,
    isDarkMode,
    modelStatuses,
    defaultModel,
    setDefaultModel,
  } = useAppStore();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentModelInfo = getModelById(currentModel);
  const localizedCurrentModel = getLocalizedModel(currentModel, t);
  const modelGroups = getModelGroups();

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleSelect = (modelId: typeof currentModel) => {
    if (isProcessing) return;
    setCurrentModel(modelId);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className={`rounded-xl border p-4 pt-6 shadow-sm ${isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'}`}
    >
      <label
        className={`mb-4 block text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
      >
        {t('modelSelectorTitle')}
      </label>

      <div className="relative" ref={dropdownRef}>
        {/* 触发按钮 */}
        <button
          onClick={() => !isProcessing && setIsOpen(!isOpen)}
          disabled={isProcessing}
          className={`
						flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-left
						transition-all
						${
              isProcessing
                ? 'cursor-not-allowed opacity-50'
                : isDarkMode
                  ? 'cursor-pointer border-slate-600 bg-slate-700 hover:border-slate-500 hover:shadow-sm'
                  : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }
					`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDarkMode ? 'bg-indigo-900/50' : 'bg-indigo-100'}`}
            >
              <svg
                className={`h-4 w-4 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            </div>
            <div>
              <div
                className={`text-sm font-medium ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}
              >
                {localizedCurrentModel.name}
              </div>
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentModelInfo.size} • {t('modelOutputSize')} {currentModelInfo.resolution}
                {t('modelResolution')}
              </div>
            </div>
          </div>
          <svg
            className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 下拉选项卡片 */}
        {isOpen && (
          <div
            className={`absolute z-10 mt-2 w-full rounded-lg border shadow-lg ${isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'}`}
          >
            <div className="max-h-80 overflow-auto py-1">
              {modelGroups.map(({ group, models }) => (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`flex w-full items-center gap-1 px-4 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-black'}`}
                  >
                    <svg
                      className={`h-3 w-3 shrink-0 transition-transform ${collapsedGroups[group.id] ? '-rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    {t(group.nameKey)}
                  </button>
                  {!collapsedGroups[group.id] &&
                    models.map((model) => {
                      const modelId = model.id;
                      const localized = getLocalizedModel(modelId, t);
                      const status = modelStatuses[modelId] || 'not_downloaded';
                      const isDefault = defaultModel === modelId;
                      return (
                        <div key={modelId} className="relative">
                          <button
                            onClick={() => handleSelect(modelId)}
                            className={`
												relative w-full px-4 py-3 pr-12 text-left transition-colors
												${
                          currentModel === modelId
                            ? isDarkMode
                              ? 'bg-indigo-900/30'
                              : 'bg-indigo-50'
                            : isDarkMode
                              ? 'hover:bg-slate-700'
                              : 'hover:bg-slate-50'
                        }
											`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-medium ${currentModel === modelId ? (isDarkMode ? 'text-white' : 'text-indigo-600') : isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}
                                >
                                  {localized.name}
                                </span>
                                <span
                                  className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                                >
                                  {model.size}
                                </span>
                                {status === 'downloaded' && (
                                  <svg
                                    className="h-4 w-4 text-green-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <p
                                className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                              >
                                {localized.description}
                              </p>
                              <div
                                className={`mt-1 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                              >
                                {t('modelOutputSize')}: {model.resolution}
                                {t('modelResolution')}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setDefaultModel(modelId)}
                            title={isDefault ? t('defaultModel') : t('setAsDefault')}
                            aria-label={isDefault ? t('defaultModel') : t('setAsDefault')}
                            className={`absolute right-2 top-2 rounded-lg p-1.5 transition-colors ${
                              isDefault
                                ? isDarkMode
                                  ? 'text-indigo-400 hover:bg-slate-700'
                                  : 'text-indigo-500 hover:bg-slate-100'
                                : isDarkMode
                                  ? 'text-slate-600 hover:bg-slate-700 hover:text-indigo-400'
                                  : 'text-slate-300 hover:bg-slate-100 hover:text-indigo-500'
                            }`}
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill={isDefault ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                              />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {originalImage && (
          <p className={`mt-3 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className="inline-flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {t('modelSwitchHint')}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
