import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { useLanguage } from "../../lib/i18n/useLanguage";
import { ImageUploader } from "../features/ImageUploader";
import { ModelSelector } from "../features/ModelSelector";
import { ImagePreview } from "../features/ImagePreview";
import { ExportPanel } from "../features/ExportPanel";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";

export function MainLayout() {
	const { originalImage, resultImage, isProcessing, error, currentModel, processedModel } = useAppStore();
	const { t } = useTranslation();
	useLanguage();

	const isModelProcessed = processedModel === currentModel;

	return (
		<div className="min-h-screen bg-white text-slate-900">
			<header className="bg-white">
				<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 shadow-md">
								<svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
									/>
								</svg>
							</div>
							<div>
								<h1 className="text-lg font-semibold text-slate-900">{t('appName')}</h1>
								<p className="text-xs text-slate-500">{t('appSubtitle')}</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<LanguageSwitcher />
							<a
								href="https://github.com"
								target="_blank"
								rel="noopener noreferrer"
								className="flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:text-slate-700"
								title="GitHub"
							>
								<svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24">
									<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
								</svg>
							</a>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
				{!originalImage ? (
					<div className="mx-auto max-w-5xl">
						<div className="mb-12 text-center">
							<div className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-700">
								<span className="flex h-2 w-2 animate-pulse rounded-full bg-indigo-500"></span>
								{t('heroBadge')}
							</div>
							<h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">{t('heroTitle')}</h2>
							<p className="mx-auto mb-8  text-base text-slate-500">
								{t('heroDescription')}
							</p>
						</div>

						<div className="mb-16">
							<ImageUploader />
						</div>

						<div className="mb-12">
							<h3 className="mb-8 text-center text-lg font-semibold text-slate-900">{t('featuresTitle')}</h3>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
								<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
											/>
										</svg>
									</div>
									<h3 className="mb-1.5 text-sm font-semibold text-slate-900">{t('featurePrivacy')}</h3>
									<p className="text-xs text-slate-500">{t('featurePrivacyDesc')}</p>
								</div>

								<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M13 10V3L4 14h7v7l9-11h-7z"
											/>
										</svg>
									</div>
									<h3 className="mb-1.5 text-sm font-semibold text-slate-900">{t('featureSpeed')}</h3>
									<p className="text-xs text-slate-500">{t('featureSpeedDesc')}</p>
								</div>

								<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
											/>
										</svg>
									</div>
									<h3 className="mb-1.5 text-sm font-semibold text-slate-900">{t('featureFormats')}</h3>
									<p className="text-xs text-slate-500">{t('featureFormatsDesc')}</p>
								</div>

								<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
											/>
										</svg>
									</div>
									<h3 className="mb-1.5 text-sm font-semibold text-slate-900">{t('featureExport')}</h3>
									<p className="text-xs text-slate-500">{t('featureExportDesc')}</p>
								</div>
							</div>
						</div>

						<div className="my-16 rounded-2xl p-8 text-center">
							<h3 className="mb-2 text-lg font-semibold text-slate-900">{t('benefitsTitle')}</h3>
							<p className="mb-4 text-sm text-slate-500">{t('benefitsSubtitle')}</p>
							<div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-600">
								<span className="flex items-center gap-2">
									<svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
									{t('benefitNoInstall')}
								</span>
								<span className="flex items-center gap-2">
									<svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
									{t('benefitNoPayment')}
								</span>
								<span className="flex items-center gap-2">
									<svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
									{t('benefitNoRegister')}
								</span>
								<span className="flex items-center gap-2">
									<svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
									{t('benefitFree')}
								</span>
							</div>
						</div>

						<div className="mb-12 mt-16">
							<h3 className="mb-8 text-center text-lg font-semibold text-slate-900">{t('useCasesTitle')}</h3>
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 mx-auto">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
											/>
										</svg>
									</div>
									<h4 className="mb-1 text-sm font-medium text-slate-900">{t('useCaseCreative')}</h4>
									<p className="text-xs text-slate-500">{t('useCaseCreativeDesc')}</p>
								</div>
								<div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 mx-auto">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
											/>
										</svg>
									</div>
									<h4 className="mb-1 text-sm font-medium text-slate-900">{t('useCaseBusiness')}</h4>
									<p className="text-xs text-slate-500">{t('useCaseBusinessDesc')}</p>
								</div>
								<div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 mx-auto">
										<svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
											/>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
									</div>
									<h4 className="mb-1 text-sm font-medium text-slate-900">{t('useCasePhoto')}</h4>
									<p className="text-xs text-slate-500">{t('useCasePhotoDesc')}</p>
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-6 lg:flex-row">
						{/* 左侧：图片预览 - 占 2/3 */}
						<div className="flex-1 lg:w-2/3">
							{error && (
								<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
									<div className="flex items-center gap-2">
										<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
										<span>{error}</span>
									</div>
								</div>
							)}

								<ImagePreview />

							<div className="mt-4 flex gap-3">
								<button
									onClick={() => !isProcessing && useAppStore.getState().startProcessing()}
									disabled={isProcessing}
									className="flex-1 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-50">
									{isModelProcessed ? t('reprocess') : t('startProcessing')}
								</button>
								<button
									onClick={() => !isProcessing && useAppStore.getState().reset()}
									disabled={isProcessing}
									className="flex-1 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50">
									{t('processNewImage')}
								</button>
							</div>
						</div>

						{/* 右侧：设置面板 - 占 1/3 */}
						<div className="w-full lg:w-1/3 lg:max-w-sm">
							<div className="sticky top-4 space-y-4">
								<ModelSelector />
								<ExportPanel disabled={isProcessing} />
							</div>
						</div>
					</div>
				)}
			</main>

			<footer className="mt-auto border-t border-slate-200 bg-slate-50">
				<div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
					<p className="text-center text-xs text-slate-400">{t('footerText')}</p>
				</div>
			</footer>
		</div>
	);
}
