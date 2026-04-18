import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { MODELS } from "../../config/models";

export function ModelsPage() {
	const { t } = useTranslation();
	const { setCurrentModel, setCurrentPage, currentModel, isProcessing, isDarkMode } = useAppStore();
	const [checking, setChecking] = useState<string | null>(null);
	const [modelStatus, setModelStatus] = useState<Record<string, "unchecked" | "checking" | "available" | "error">>({
		u2netp: "unchecked",
		u2net: "unchecked",
		"isnet-anime": "unchecked",
	});

	useEffect(() => {
		const checkAll = async () => {
			for (const model of MODELS) {
				await checkModel(model.id);
			}
		};
		checkAll();
	}, []);

	const checkModel = async (modelId: string) => {
		setChecking(modelId);
		setModelStatus((prev) => ({ ...prev, [modelId]: "checking" }));

		try {
			const modelPath = `/models/${modelId === "u2netp" ? "u2netp.onnx" : modelId === "u2net" ? "u2net.onnx" : "isnet-anime.onnx"}`;
			const response = await fetch(modelPath, { method: "HEAD" });
			if (response.ok) {
				setModelStatus((prev) => ({ ...prev, [modelId]: "available" }));
			} else {
				setModelStatus((prev) => ({ ...prev, [modelId]: "error" }));
			}
		} catch {
			setModelStatus((prev) => ({ ...prev, [modelId]: "error" }));
		}

		setChecking(null);
	};

	const selectModel = (modelId: string) => {
		if (isProcessing) return;
		setCurrentModel(modelId);
		setCurrentPage("main");
	};

	return (
		<div className="flex flex-col h-full">
			<div className={`flex items-center gap-3 pb-4 my-4 }`}>
				<button
					onClick={() => setCurrentPage("main")}
					className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDarkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}>
					<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<h2 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
					{t("modelsPageTitle")}
				</h2>
			</div>

			<div className="space-y-3 overflow-y-auto flex-1">
				{MODELS.map((model) => {
					const status = modelStatus[model.id];
					const isSelected = currentModel === model.id;

					return (
						<button
							key={model.id}
							onClick={() => selectModel(model.id)}
							disabled={isProcessing}
							className={`
                relative w-full rounded-xl border p-5 text-left transition-all
                ${
									isSelected
										? isDarkMode
											? "border-indigo-500 bg-indigo-900/30"
											: "border-indigo-600 bg-indigo-50"
										: isDarkMode
											? "border-slate-600 hover:border-slate-500 hover:shadow-sm"
											: "border-slate-200 hover:border-slate-300 hover:shadow-sm"
								}
                ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
              `}>
							<div className="flex items-center justify-between pr-14">
								<div>
									<div className="flex items-center gap-2">
										<span
											className={`text-base font-medium ${isSelected ? (isDarkMode ? "text-white" : "text-indigo-600") : isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
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
										className={`mt-1 flex items-center gap-3 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
										<span>{model.size}</span>
										<span>
											{t("modelOutputSize")}: {model.resolution}
											{t("modelResolution")}
										</span>
									</div>
								</div>
							</div>

							<div className="absolute right-4 top-1/2 -translate-y-1/2">
								{status === "available" && (
									<svg className="h-7 w-7 text-green-500" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
											clipRule="evenodd"
										/>
									</svg>
								)}
								{status === "error" && (
									<svg className="h-7 w-7 text-red-500" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
											clipRule="evenodd"
										/>
									</svg>
								)}
								{status === "checking" && (
									<svg className="h-7 w-7 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
								)}
								{status === "unchecked" && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											checkModel(model.id);
										}}
										className="text-xs text-slate-400 hover:text-slate-600">
										{t("checkStatus")}
									</button>
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
