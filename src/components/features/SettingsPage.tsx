import { useAppStore } from "../../stores/appStore";
import { useTranslation } from "../../lib/i18n";
import { ModelsPage } from "./ModelsPage";

export function SettingsPage() {
	const { t, language } = useTranslation();
	const { settingsTab, setSettingsTab, setCurrentPage, isDarkMode } = useAppStore();

	const tabs = [
		{
			id: "models" as const,
			label: t("settingsModelSettings"),
			icon: (
				<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			),
		},
		{
			id: "relatedTools" as const,
			label: t("settingsRelatedTools"),
			icon: (
				<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
				</svg>
			),
		},
		{
			id: "about" as const,
			label: t("settingsAbout"),
			icon: (
				<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
					<circle cx="12" cy="12" r="10" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4" />
					<path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01" />
				</svg>
			),
		},
	];

	return (
		<div className="flex h-full overflow-hidden flex-col [@media(min-width:900px)]:flex-row">
			{/* Mobile: header + horizontal tab bar */}
			<div className="[@media(min-width:900px)]:hidden flex flex-col flex-shrink-0 border-b">
				<div
					className={`flex items-center justify-between px-4 h-12 border-b ${
						isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
					}`}>
					<h2
						className={`text-sm font-semibold uppercase tracking-wider ${
							isDarkMode ? "text-slate-300" : "text-slate-500"
						}`}>
						{t("settings")}
					</h2>
					<button
						onClick={() => setCurrentPage("main")}
						className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
							isDarkMode
								? "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
								: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						}`}
						title={t("aboutClose")}>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div className={`flex overflow-x-auto gap-1 px-3 py-2 ${isDarkMode ? "bg-slate-800" : "bg-white"}`}>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setSettingsTab(tab.id)}
							className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
								settingsTab === tab.id
									? isDarkMode
										? "bg-indigo-900/40 text-indigo-300"
										: "bg-indigo-50 text-indigo-700"
									: isDarkMode
										? "text-slate-300 hover:bg-slate-700/60 hover:text-slate-100"
										: "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
							}`}>
							{tab.icon}
							<span>{tab.label}</span>
						</button>
					))}
				</div>
			</div>

			{/* Desktop: sidebar */}
			<aside
				className={`hidden [@media(min-width:900px)]:flex w-52 flex-shrink-0 border-r flex-col ${
					isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
				}`}>
				<div
					className={`flex items-center justify-between px-4 h-14 border-b ${
						isDarkMode ? "border-slate-700" : "border-slate-200"
					}`}>
					<h2
						className={`text-sm font-semibold uppercase tracking-wider ${
							isDarkMode ? "text-slate-300" : "text-slate-500"
						}`}>
						{t("settings")}
					</h2>
					<button
						onClick={() => setCurrentPage("main")}
						className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
							isDarkMode
								? "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
								: "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
						}`}
						title={t("aboutClose")}>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<nav className="flex-1 p-2 space-y-1">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setSettingsTab(tab.id)}
							className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
								settingsTab === tab.id
									? isDarkMode
										? "bg-indigo-900/40 text-indigo-300"
										: "bg-indigo-50 text-indigo-700"
									: isDarkMode
										? "text-slate-300 hover:bg-slate-700/60 hover:text-slate-100"
										: "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
							}`}>
							{tab.icon}
							<span>{tab.label}</span>
						</button>
					))}
				</nav>
			</aside>

			<div className={`flex-1 flex flex-col ${isDarkMode ? "bg-slate-900" : "bg-slate-50"}`}>
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-3xl mx-auto">
						{settingsTab === "models" && (
							<div className="px-6 py-5">
								<ModelsPage hideHeader />
							</div>
						)}

						{settingsTab === "about" && (
							<div className="px-6 py-5">
								<div className="space-y-6">
									<div>
										<h2 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
											{t("aboutTitle")}
										</h2>
										<p className={`mt-2 text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
											{t("aboutDescription")}
										</p>
									</div>

									<div className="grid gap-4">
										<a
											href="https://github.com/isixe/bgx"
											target="_blank"
											rel="noopener noreferrer"
											className={`flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md ${
												isDarkMode
													? "border-slate-700 bg-slate-800 hover:border-slate-600"
													: "border-slate-200 bg-white hover:border-slate-300"
											}`}>
											<div
												className={`flex h-10 w-10 items-center justify-center rounded-lg ${
													isDarkMode ? "bg-slate-700" : "bg-slate-100"
												}`}>
												<svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
													<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
												</svg>
											</div>
											<div className="flex-1 min-w-0">
												<p className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
													{t("aboutGithub")}
												</p>
												<p className={`text-sm mt-0.5 truncate ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
													github.com/isixe/bgx
												</p>
											</div>
											<svg
												className={`h-4 w-4 flex-shrink-0 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												strokeWidth={2}>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>

										<a
											href="https://github.com/isixe"
											target="_blank"
											rel="noopener noreferrer"
											className={`flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md ${
												isDarkMode
													? "border-slate-700 bg-slate-800 hover:border-slate-600"
													: "border-slate-200 bg-white hover:border-slate-300"
											}`}>
											<div
												className={`flex h-10 w-10 items-center justify-center rounded-lg ${
													isDarkMode ? "bg-slate-700" : "bg-slate-100"
												}`}>
												<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
													/>
												</svg>
											</div>
											<div className="flex-1 min-w-0">
												<p className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
													{t("aboutAuthor")}
												</p>
												<p className={`text-sm mt-0.5 truncate ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
													{t("aboutAuthorName")}
												</p>
											</div>
											<svg
												className={`h-4 w-4 flex-shrink-0 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												strokeWidth={2}>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>

										<div className="grid grid-cols-2 gap-4">
											<div
												className={`flex items-center gap-4 rounded-xl border p-4 ${
													isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
												}`}>
												<div
													className={`flex h-10 w-10 items-center justify-center rounded-lg ${
														isDarkMode ? "bg-slate-700" : "bg-slate-100"
													}`}>
													<svg
														className="h-5 w-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														strokeWidth={2}>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
														/>
													</svg>
												</div>
												<div>
													<p className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
														{t("aboutVersion")}
													</p>
													<p className={`text-sm mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>0.1.2</p>
												</div>
											</div>

											<div
												className={`flex items-center gap-4 rounded-xl border p-4 ${
													isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
												}`}>
												<div
													className={`flex h-10 w-10 items-center justify-center rounded-lg ${
														isDarkMode ? "bg-slate-700" : "bg-slate-100"
													}`}>
													<svg
														className="h-5 w-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														strokeWidth={2}>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
														/>
													</svg>
												</div>
												<div>
													<p className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
														{t("aboutLicense")}
													</p>
													<p className={`text-sm mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>MIT</p>
												</div>
											</div>
										</div>

										<p
											className={`text-xs absolute bottom-5 left-1/2 -translate-x-1/2 text-center [@media(min-width:900px)]:ml-32 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>
											{t("footerText")}
										</p>
									</div>
								</div>
							</div>
						)}

						{settingsTab === "relatedTools" && (
							<div className="px-6 py-5">
								<div className="space-y-6">
									<div>
										<h2 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
											{t("settingsRelatedTools")}
										</h2>
										<p className={`mt-2 text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
											{t("relatedToolsSubtitle")}
										</p>
									</div>

									<div className="grid gap-4">
										<a
											href="https://image-dash.itea.dev"
											target="_blank"
											rel="noopener noreferrer"
											className={`flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md ${
												isDarkMode
													? "border-slate-700 bg-slate-800 hover:border-slate-600"
													: "border-slate-200 bg-white hover:border-slate-300"
											}`}>
											<div
												className={`flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden ${
													isDarkMode ? "bg-slate-700" : "bg-slate-100"
												}`}>
												<img
													src="https://image-dash.itea.dev/favicon.ico"
													alt="Image Dash"
													className="h-5 w-5"
													crossOrigin="anonymous"
												/>
											</div>
											<div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                                                    {t("toolImageDashName")}
                                                </p>
                                                <p
                                                    className={`text-sm mt-0.5 line-clamp-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                                                    {t("toolImageDashDesc")}
                                                </p>
											</div>
											<svg
												className={`h-4 w-4 flex-shrink-0 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												strokeWidth={2}>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
												/>
											</svg>
										</a>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
