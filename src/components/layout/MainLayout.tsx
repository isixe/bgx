import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { useLanguage } from "../../hooks/useLanguage";
import { ImageUploader } from "../features/ImageUploader";
import { ModelSelector } from "../features/ModelSelector";
import { ImagePreview } from "../features/ImagePreview";
import { ExportPanel } from "../features/ExportPanel";
import { ModelsPage } from "../features/ModelsPage";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";

export function MainLayout() {
	const { originalImage, resultImage, isProcessing, currentModel, processedModel, startProcessing, reset, currentPage, setCurrentPage } = useAppStore();
	const { t } = useTranslation();
	useLanguage();

	const isModelProcessed = processedModel === currentModel;
	const error = useAppStore((state) => state.error);

	return (
		<div className="flex h-screen flex-col bg-slate-50">
			<header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
				<div className="flex items-center gap-3">
					<img src="/favicon.ico" alt="BGX" className="h-8 w-8 rounded-lg" />
					<span className="text-base font-semibold text-slate-900">BGX</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setCurrentPage('models')}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
						title={t('settings')}
					>
						<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
						</svg>
					</button>
					<LanguageSwitcher />
					<a
						href="https://github.com"
						target="_blank"
						rel="noopener noreferrer"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
						title="GitHub"
					>
						<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
						</svg>
					</a>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				<main className="flex-1 flex flex-col overflow-hidden bg-slate-100">
					{currentPage === 'models' ? (
						<div className="flex flex-1 overflow-hidden">
							<div className="w-full max-w-3xl mx-auto">
								<ModelsPage />
							</div>
						</div>
					) : !originalImage ? (
						<div className="flex flex-1 items-center justify-center">
								<ImageUploader />
						</div>
					) : (
							<div className="flex flex-1 overflow-hidden">
									<ImagePreview />
						</div>
					)}
				</main>

				{currentPage !== 'models' && (
				<aside className="w-[400px] flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
					<div className="p-4 space-y-6">
						{error && (
							<div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-red-200 bg-red-600 px-4 py-3 text-sm text-white shadow-lg">
								<button onClick={() => useAppStore.getState().setError(null)} className="ml-3 text-white/70 hover:text-white">✕</button>
								{error}
							</div>
						)}

						<div className="space-y-2">
							{originalImage && !resultImage && !isProcessing && (
								<button
									onClick={startProcessing}
									disabled={!originalImage}
									className="w-full rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{t("startProcessing")}
								</button>
							)}

							{resultImage && (
								<>
									{!isModelProcessed && !isProcessing && (
										<button
											onClick={startProcessing}
											className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
										>
											{t("reprocess")}
										</button>
									)}

									<button
										onClick={reset}
										disabled={isProcessing}
										className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
									>
										{t("processNewImage")}
									</button>
								</>
							)}

							{isProcessing && (
								<button
									onClick={() => useAppStore.getState().abortProcessing?.()}
									className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
								>
									{t("cancel")}
								</button>
							)}
						</div>

						<ModelSelector />

						{originalImage && <ExportPanel disabled={isProcessing} />}
					</div>
				</aside>
				)}
			</div>
		</div>
	);
}