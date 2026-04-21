import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { ImageUploader } from "../features/ImageUploader";
import { ModelSelector } from "../features/ModelSelector";
import { ImagePreview } from "../features/ImagePreview";
import { ExportPanel } from "../features/ExportPanel";
import { ModelsPage } from "../features/ModelsPage";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";

export function MainLayout() {
	const {
		originalImage,
		resultImage,
		isProcessing,
		currentModel,
		processedModel,
		startProcessing,
		reset,
		currentPage,
		setCurrentPage,
		isDarkMode,
		setIsDarkMode,
		modelStatuses,
		modelDownloadProgresses,
	} = useAppStore();
	const { t } = useTranslation();

	const isModelProcessed = processedModel === currentModel;
	const error = useAppStore((state) => state.error);
	
	// 从全局状态计算当前模型的下载状态
	const isModelDownloading = modelStatuses[currentModel] === 'downloading';
	const currentModelProgress = modelDownloadProgresses[currentModel];
	const modelDownloadProgress = currentModelProgress?.percentage ?? 0;

	return (
		<div className={`h-[100dvh] overflow-y-auto ${isDarkMode ? "bg-slate-900" : "bg-slate-50"}`}>
			<header
				className={`flex h-14 items-center justify-between border-b ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"} px-4`}>
				<div className="flex items-center gap-3">
					<img src="/favicon.ico" alt="BGX" className="h-8 w-8 rounded-lg" />
					<span className={`text-base font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>BGX</span>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setIsDarkMode(!isDarkMode)}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
						aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}>
						{isDarkMode ? (
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
								<circle cx="12" cy="12" r="5" />
								<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
							</svg>
						) : (
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
							</svg>
						)}
					</button>
					<button
						onClick={() => setCurrentPage("models")}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
						title={t("settings")}>
						<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
					</svg>
					</button>
					<LanguageSwitcher />
					<a
						href="https://github.com/isixe/bgx"
						target="_blank"
						rel="noopener noreferrer"
						className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
						title="GitHub">
						<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
					</svg>
					</a>
				</div>
			</header>

			{/* Model Downloading Notification */}
			{isModelDownloading && (
				<div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md rounded-xl border p-4 shadow-lg ${isDarkMode ? "border-indigo-500/30 bg-indigo-900/90" : "border-indigo-200 bg-indigo-50"}`}>
					<div className="flex items-center gap-3">
						<svg className={`h-5 w-5 animate-spin ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24">
							<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
							<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
						<div className="flex-1">
							<p className={`text-sm font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
								{t("modelDownloadingTitle")}
							</p>
							<p className={`text-xs mt-0.5 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
								{t("modelDownloadingDesc")}
							</p>
						</div>
						<span className={`text-sm font-medium ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`}>
							{modelDownloadProgress}%
						</span>
					</div>
					<div className={`mt-3 h-1.5 rounded-full overflow-hidden ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}>
						<div
							className="h-full bg-indigo-600 transition-all duration-200"
							style={{ width: `${modelDownloadProgress}%` }}
						/>
					</div>
				</div>
			)}

			{/* Mobile Layout */}
			<div className="[@media(min-width:900px)]:hidden">
				<main className={`${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
					{currentPage === "models" ? (
						<div className="overflow-hidden">
							<div className="w-full max-w-3xl mx-auto">
								<ModelsPage />
							</div>
						</div>
					) : !originalImage ? (
						<div className="flex items-center justify-center p-4" style={{ minHeight: "calc(100dvh - 56px)" }}>
							<ImageUploader
								disabled={isModelDownloading}
								disabledMessage={isModelDownloading ? t("modelDownloadingTitle") : undefined}
							/>
						</div>
					) : (
						<div className="flex flex-col">
							{/* Image Preview */}
							<div className="h-[300px]">
								<ImagePreview />
							</div>
							{/* Mobile Controls */}
							<div
								className={`border-t ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"} p-4`}>
								<SidebarContent
									error={error}
									originalImage={originalImage}
									resultImage={resultImage}
									isProcessing={isProcessing}
									isModelProcessed={isModelProcessed}
									startProcessing={startProcessing}
									reset={reset}
									t={t}
									isDarkMode={isDarkMode}
								/>
							</div>
						</div>
					)}
				</main>
			</div>

			{/* Desktop Layout */}
			<div className="hidden [@media(min-width:900px)]:flex h-[calc(100dvh-56px)] overflow-hidden">
				<main className={`flex-1 flex flex-col overflow-y-auto ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`}>
					{currentPage === "models" ? (
						<div className="overflow-y-auto h-full">
							<div className="w-full max-w-3xl mx-auto">
								<ModelsPage />
							</div>
						</div>
					) : !originalImage ? (
						<div className="flex items-center justify-center p-4 flex-1 min-h-0">
							<ImageUploader
								disabled={isModelDownloading}
								disabledMessage={isModelDownloading ? t("modelDownloadingTitle") : undefined}
							/>
						</div>
					) : (
						<div className="flex flex-col flex-1 min-h-0">
							{/* Image Preview */}
							<div className="flex-1 min-h-0">
								<ImagePreview />
							</div>
						</div>
					)}
				</main>

				{/* Desktop Sidebar */}
				{currentPage !== "models" && (
					<aside
						className={`w-[400px] flex-shrink-0 border-l ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"} overflow-y-auto p-4`}>
						<SidebarContent
							error={error}
							originalImage={originalImage}
							resultImage={resultImage}
							isProcessing={isProcessing}
							isModelProcessed={isModelProcessed}
							startProcessing={startProcessing}
							reset={reset}
							t={t}
							isDarkMode={isDarkMode}
						/>
					</aside>
				)}
			</div>
		</div>
	);
}

// Sidebar content component to avoid duplication
interface SidebarContentProps {
	error: string | null;
	originalImage: string | null;
	resultImage: string | null;
	isProcessing: boolean;
	isModelProcessed: boolean;
	startProcessing: () => void;
	reset: () => void;
	t: (key: string) => string;
	isDarkMode: boolean;
	onAction?: () => void;
}

function SidebarContent({
	error,
	originalImage,
	resultImage,
	isProcessing,
	isModelProcessed,
	startProcessing,
	reset,
	t,
	isDarkMode,
	onAction,
}: SidebarContentProps) {
	const handleStartProcessing = () => {
		startProcessing();
		onAction?.();
	};

	const handleReset = () => {
		reset();
		onAction?.();
	};

	return (
		<>
			{error && (
				<div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-red-200 bg-red-600 px-4 py-3 text-sm text-white shadow-lg">
					<button onClick={() => useAppStore.getState().setError(null)} className="ml-3 text-white/70 hover:text-white">
						✕
					</button>
					{error === 'model_download_failed' ? t('modelDownloadFailed') : error}
				</div>
			)}

			<div className="space-y-4">
				{originalImage && !resultImage && !isProcessing && (
					<button
						onClick={handleStartProcessing}
						disabled={!originalImage}
						className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
						{t("startProcessing")}
					</button>
				)}

				{resultImage && (
					<div className="space-y-4">
						{!isModelProcessed && !isProcessing && (
							<button
								onClick={handleStartProcessing}
								className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-indigo-700">
								{t("reprocess")}
							</button>
						)}

						<button
							onClick={handleReset}
							disabled={isProcessing}
							className={`w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all disabled:opacity-50 ${isDarkMode ? "border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
							{t("processNewImage")}
						</button>
					</div>
				)}

				<ModelSelector />

				{originalImage && <ExportPanel disabled={isProcessing} />}
			</div>
		</>
	);
}
