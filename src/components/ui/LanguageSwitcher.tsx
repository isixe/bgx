import { useState, useEffect, useRef } from "react";
import { useTranslation, type Language } from "../../lib/i18n";
import { useAppStore } from "../../stores/appStore";

export function LanguageSwitcher() {
	const { language, setLanguage, t } = useTranslation();
	const { isDarkMode } = useAppStore();
	const [isOpen, setIsOpen] = useState(false);
	const [currentLang, setCurrentLang] = useState<Language>(language);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Listen for language changes
	useEffect(() => {
		const handleLanguageChange = (e: CustomEvent<Language>) => {
			setCurrentLang(e.detail);
		};
		window.addEventListener("languagechange", handleLanguageChange as EventListener);
		return () => {
			window.removeEventListener("languagechange", handleLanguageChange as EventListener);
		};
	}, []);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = (lang: Language) => {
		setLanguage(lang);
		setCurrentLang(lang);
		setIsOpen(false);
	};

	const languages: { value: Language; label: string }[] = [
		{ value: "zh", label: t("languageZh") },
		{ value: "en", label: t("languageEn") },
	];

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:text-slate-700"
				title={t("language")}>
				<svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
					/>
				</svg>
			</button>

			{isOpen && (
				<div
					className={`absolute right-0 z-20 mt-1 w-32 rounded-lg border py-1 shadow-lg ${isDarkMode ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
					{languages.map((lang) => (
						<button
							key={lang.value}
							onClick={() => handleSelect(lang.value)}
							className={`w-full px-4 py-2 text-left text-sm transition-colors ${
								currentLang === lang.value
									? isDarkMode
										? "bg-indigo-900/30 text-white font-medium"
										: "bg-indigo-50 text-indigo-600 font-medium"
									: isDarkMode
										? "text-slate-300 hover:bg-slate-700"
										: "text-slate-700 hover:bg-slate-50"
							}`}>
							<div className="flex items-center gap-2">
								{currentLang === lang.value && (
									<svg
										className={`h-4 w-4 ${isDarkMode ? "text-white" : "text-indigo-600"}`}
										fill="currentColor"
										viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
											clipRule="evenodd"
										/>
									</svg>
								)}
								<span>{lang.label}</span>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
