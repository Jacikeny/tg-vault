import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

export const LanguageToggle = () => {
    const { i18n } = useTranslation();

    return (
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button
                variant="ghost"
                size="sm"
                aria-label="Switch language to English"
                aria-pressed={i18n.language === "en"}
                onClick={() => i18n.changeLanguage("en")}
                className={cn(
                    "h-7 px-2 text-xs font-medium hover:bg-transparent",
                    i18n.language === "en" ? "bg-secondary text-primary shadow-sm hover:bg-secondary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                EN
            </Button>
            <Button
                variant="ghost"
                size="sm"
                aria-label="切换语言为中文"
                aria-pressed={i18n.language === "zh"}
                onClick={() => i18n.changeLanguage("zh")}
                className={cn(
                    "h-7 px-2 text-xs font-medium hover:bg-transparent",
                    i18n.language === "zh" ? "bg-secondary text-primary shadow-sm hover:bg-secondary" : "text-muted-foreground hover:text-foreground"
                )}
            >
                中
            </Button>
        </div>
    );
};
