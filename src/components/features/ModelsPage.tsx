import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { MODELS } from "../../config/models";
import { deleteModel } from "../../utils/modelCache";

export function ModelsPage() {
	const { t } = useTranslation();
	const {
		setCurrentModel,
		setCurrentPage,
		currentModel,
		isProcessing,
		isDarkMode,
		modelStatuses,
		modelDownloadProgresses,
		downloadModelWithProgress,
		updateModelStatus,
		cancelModelDownload,
	} = useAppStore();

	const handleDownload = async (modelId: string) => {
		try {
			await downloadModelWithProgress(modelId);
		} catch {
			// 错误已在 store 中处理
		}
	};

	const handleDelete = async (modelId: string) => {
		try {
			await deleteModel(modelId);
			updateModelStatus(modelId, "not_downloaded");
		} catch (error) {
			console.error(`Failed to delete model ${modelId}:`, error);
		}
	};

	const handleCancelDownload = (modelId: string) => {
		cancelModelDownload(modelId);
	};

	const selectModel = (modelId: string) => {
		if (isProcessing) return;
		setCurrentModel(modelId);
		setCurrentPage("main");
	};

	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
	};

	return (
		<div className="flex flex-col h-full">
			<div className={`flex items-center gap-3 pb-4 my-4`}>
				<button
					onClick={() => setCurrentPage("main")}
					className={`flex h-8 w-8 items-center justify-center rounded-lg ${
						isDarkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"
					}`}>
					<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<h2 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
					{t("modelsPageTitle")}
				</h2>
			</div>

			<div className="space-y-3 overflow-y-auto flex-1 sm:mx-0 mx-5">
				{MODELS.map((model) => {
					const status = modelStatuses[model.id] || "not_downloaded";
					const isSelected = currentModel === model.id;
					const isDownloading = status === "downloading";
					const progress = modelDownloadProgresses[model.id];

					return (
						<div
							key={model.id}
							className={`
								relative w-full rounded-xl border p-5 transition-all
								${
									isSelected
										? isDarkMode
											? "border-indigo-500 bg-indigo-900/30"
											: "border-indigo-600 bg-indigo-50"
										: isDarkMode
											? "border-slate-600"
											: "border-slate-200"
								}
								${isProcessing ? "opacity-50" : ""}
							`}>
							<div className="flex items-start justify-between gap-4">
								<button
									onClick={() => selectModel(model.id)}
									disabled={isProcessing}
									className="flex-1 text-left">
									<div className="flex items-center gap-2">
										<span
											className={`text-base font-medium ${
												isSelected
													? isDarkMode
														? "text-white"
														: "text-indigo-600"
													: isDarkMode
														? "text-slate-100"
														: "text-slate-900"
											}`}>
											{model.name}
										</span>
										{isSelected && (
											<svg
												className={`h-4 w-4 ${isDarkMode ? "text-white" : "text-indigo-600"}`}
												fill="currentColor"
												viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clipRule="evenodd"
												/>
											</svg>
										)}
									</div>
									<p className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
										{t(model.descKey)}
									</p>
									<div
										className={`mt-1 flex items-center gap-3 text-xs ${
											isDarkMode ? "text-slate-500" : "text-slate-400"
										}`}>
										<span>{model.size}</span>
										<span>
											{t("modelOutputSize")}: {model.resolution}
											{t("modelResolution")}
										</span>
									</div>
								</button>

								<div className="flex items-center gap-2">
									{status === "downloaded" && (
										<div className="flex items-center gap-2">
											<svg
												className="h-6 w-6 text-green-500"
												fill="currentColor"
												viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clipRule="evenodd"
												/>
											</svg>
											<button
												onClick={() => handleDelete(model.id)}
												className={`p-1.5 rounded-lg transition-colors ${
													isDarkMode
														? "text-slate-400 hover:text-red-400 hover:bg-slate-700"
														: "text-slate-400 hover:text-red-500 hover:bg-slate-100"
												}`}
												title={t("delete")}>
												<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									)}

									{status === "not_downloaded" && (
										<button
											onClick={() => handleDownload(model.id)}
											disabled={isDownloading}
											className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
												isDarkMode
													? "bg-indigo-600 hover:bg-indigo-500 text-white"
													: "bg-indigo-600 hover:bg-indigo-700 text-white"
											}`}>
											{t("download")}
										</button>
									)}

									{status === "error" && (
										<div className="flex items-center gap-2">
											<svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
												<path
													fillRule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
													clipRule="evenodd"
												/>
											</svg>
											<button
												onClick={() => handleDownload(model.id)}
												className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
													isDarkMode
														? "bg-slate-600 hover:bg-slate-500 text-white"
														: "bg-slate-200 hover:bg-slate-300 text-slate-700"
												}`}>
												{t("retry")}
											</button>
										</div>
									)}
								</div>
							</div>

							{isDownloading && progress && (
								<div className="mt-4">
									<div className="flex items-center justify-between text-xs mb-1.5">
										<span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>
											{t("downloading")}
										</span>
										<div className="flex items-center gap-3">
											<span className={isDarkMode ? "text-slate-300" : "text-slate-700"}>
												{progress.percentage}%
												{progress.total > 0 &&
													` (${formatBytes(progress.loaded)} / ${formatBytes(progress.total)})`}
											</span>
											<button
												onClick={() => handleCancelDownload(model.id)}
												className={`text-xs px-2 py-1 rounded transition-colors ${
													isDarkMode
														? "bg-slate-700 hover:bg-slate-600 text-slate-300"
														: "bg-slate-200 hover:bg-slate-300 text-slate-600"
												}`}>
												{t("cancelDownload")}
											</button>
										</div>
									</div>
									<div
										className={`h-2 rounded-full overflow-hidden ${
											isDarkMode ? "bg-slate-700" : "bg-slate-200"
										}`}>
										<div
											className="h-full bg-indigo-600 transition-all duration-200"
											style={{ width: `${progress.percentage}%` }}
										/>
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
