import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { getModelById, getLocalizedModel } from "../../utils/modelUtils";
import { MODELS } from "../../config/models";

export function ModelSelector() {
	const { currentModel, isProcessing, setCurrentModel, originalImage, isDarkMode } = useAppStore();
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const currentModelInfo = getModelById(currentModel);
	const localizedCurrentModel = getLocalizedModel(currentModel, t);

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
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<div
			className={`rounded-xl border p-4 shadow-sm ${isDarkMode ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
			<label className={`mb-3 block text-sm font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
				{t("modelSelectorTitle")}
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
								? "cursor-not-allowed opacity-50"
								: isDarkMode
									? "cursor-pointer border-slate-600 bg-slate-700 hover:border-slate-500 hover:shadow-sm"
									: "cursor-pointer border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
						}
					`}>
					<div className="flex items-center gap-3">
						<div
							className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDarkMode ? "bg-indigo-900/50" : "bg-indigo-100"}`}>
							<svg
								className={`h-4 w-4 ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
								/>
							</svg>
						</div>
						<div>
							<div className={`text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
								{localizedCurrentModel.name}
							</div>
							<div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
								{currentModelInfo.size} • {t("modelOutputSize")} {currentModelInfo.resolution}
								{t("modelResolution")}
							</div>
						</div>
					</div>
					<svg
						className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""} ${isDarkMode ? "text-slate-400" : "text-slate-400"}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{/* 下拉选项卡片 */}
				{isOpen && (
					<div
						className={`absolute z-10 mt-2 w-full rounded-lg border shadow-lg ${isDarkMode ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
						<div className="max-h-80 overflow-auto py-1">
							{MODELS.map((model) => {
								const modelId = model.id;
								const localized = getLocalizedModel(modelId, t);
								return (
									<button
										key={modelId}
										onClick={() => handleSelect(modelId)}
										className={`
													relative w-full px-4 py-3 pr-12 text-left transition-colors
													${
														currentModel === modelId
															? isDarkMode
																? "bg-indigo-900/30"
																: "bg-indigo-50"
															: isDarkMode
																? "hover:bg-slate-700"
																: "hover:bg-slate-50"
													}
												`}>
										{currentModel === modelId && (
											<div className="absolute right-3 top-1/2 -translate-y-1/2">
												<svg
													className={`h-6 w-6 ${isDarkMode ? "text-white" : "text-indigo-600"}`}
													fill="currentColor"
													viewBox="0 0 20 20">
													<path
														fillRule="evenodd"
														d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
														clipRule="evenodd"
													/>
												</svg>
											</div>
										)}
										<div>
											<div className="flex items-center gap-2">
												<span
													className={`font-medium ${currentModel === modelId ? (isDarkMode ? "text-white" : "text-indigo-600") : isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
													{localized.name}
												</span>
												<span className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
													{model.size}
												</span>
											</div>
											<p className={`mt-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
												{localized.description}
											</p>
											<div className={`mt-1 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
												{t("modelOutputSize")}: {model.resolution}
												{t("modelResolution")}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</div>
				)}

				{originalImage && (
					<p className={`mt-3 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
						<span className="inline-flex items-center gap-1">
							<svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{t("modelSwitchHint")}
						</span>
					</p>
				)}
			</div>
		</div>
	);
}
