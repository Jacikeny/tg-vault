import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, Settings, Menu, X, Star, Download, LogOut, ListChecks, Monitor, Moon, Sun, UploadCloud } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { StorageWidget } from "../ui/StorageWidget";
import { LanguageToggle } from "../ui/LanguageToggle";
import type { StorageStats } from "../../services/api";
import { useTheme } from "../../hooks/useTheme";

const HeaderThemeSwitch = () => {
    const { theme, setTheme } = useTheme();
    const options = [
        { value: "light" as const, label: "浅色主题", icon: Sun },
        { value: "dark" as const, label: "深色主题", icon: Moon },
        { value: "system" as const, label: "跟随系统主题", icon: Monitor },
    ];
    return (
        <div data-testid="header-theme-switch" className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-1" role="group" aria-label="主题模式">
            {options.map(option => {
                const Icon = option.icon;
                const selected = theme === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        className={cn("flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", selected && "bg-background text-foreground shadow-sm")}
                        onClick={() => setTheme(option.value)}
                        aria-label={option.label}
                        title={option.label}
                        aria-pressed={selected}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                );
            })}
        </div>
    );
};

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    isActive?: boolean;
    onClick?: () => void;
    collapsed?: boolean;
}

const SidebarItem = ({ icon: Icon, label, isActive, onClick, collapsed }: SidebarItemProps) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group relative",
                isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                collapsed && "justify-center px-2"
            )}
        >
            <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-300", isActive && "scale-110")} />
            {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
        </button>
    );
};

export const AppLayout = ({ children, activeCategory, onCategoryChange, storageStats, onLogout }: { children: React.ReactNode; activeCategory: string; onCategoryChange?: (category: string) => void; storageStats?: StorageStats | null; onLogout?: () => void | Promise<void> }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const { t } = useTranslation();

    const handleTabClick = (id: string) => {
        onCategoryChange?.(id);
        setIsMobileMenuOpen(false); // Close mobile menu on selection
    };

    const categories = [
        { id: "upload", icon: UploadCloud, label: t("sidebar.uploadCenter") },
        { id: "all", icon: Folder, label: t("sidebar.files") },
        { id: "ytdlp", icon: Download, label: "YT-DLP" },
        { id: "favorites", icon: Star, label: t("sidebar.favorites") },
        { id: "tasks", icon: ListChecks, label: t("sidebar.tasks") },
        { id: "settings", icon: Settings, label: t("sidebar.settings") },
    ];

    const renderSidebarContent = (mobile = false) => {
        const collapsed = !mobile && !isSidebarOpen;

        return (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className={cn("flex-1 space-y-1 overflow-y-auto scrollbar-hide", mobile ? "" : "px-4 py-6")}>
                    {categories.map(cat => (
                        <SidebarItem
                            key={cat.id}
                            icon={cat.icon}
                            label={cat.label}
                            isActive={activeCategory === cat.id}
                            onClick={() => handleTabClick(cat.id)}
                            collapsed={collapsed}
                        />
                    ))}
                </div>

                {!collapsed && (
                    <div className={cn("border-t border-border/40 shrink-0", mobile ? "mt-auto pt-4 space-y-4" : "p-4 space-y-4")}>
                        <StorageWidget stats={storageStats} />
                        <div className="flex items-center justify-between">
                            <LanguageToggle />
                            {!mobile && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-muted-foreground" onClick={() => setIsSidebarOpen(false)} aria-label="收起侧栏" title="收起侧栏">
                                    <Menu className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                            onClick={() => void onLogout?.()}
                        >
                            <LogOut className="h-4 w-4" />
                            {t("sidebar.logout")}
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background font-sans">
            {/* Sidebar - Desktop */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 260 : 80 }}
                className="hidden md:flex h-full flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            >
                <div className="flex h-[72px] items-center border-b border-border/40 px-5 gap-3 justify-between shrink-0">
                    <div className={cn("flex items-center gap-3 overflow-hidden", !isSidebarOpen && "justify-center w-full")}>
                        <img src="/logo.png?v=tg-vault" alt="Logo" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
                        {isSidebarOpen && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="font-bold tracking-tight text-xl truncate"
                            >
                                {t("app.title")}
                            </motion.span>
                        )}
                    </div>
                </div>

                {renderSidebarContent(false)}

                {!isSidebarOpen && (
                    <div className="flex flex-col items-center py-4 gap-4 border-t border-border/40">
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} aria-label="展开侧栏" title="展开侧栏">
                            <Menu className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t("sidebar.logout")} aria-label={t("sidebar.logout")} onClick={() => void onLogout?.()}>
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </motion.aside>

            {/* Mobile Menu Drawer */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                            className="fixed inset-y-0 right-0 z-50 h-full w-4/5 max-w-xs border-l border-border bg-background p-6 shadow-xl md:hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <img src="/logo.png?v=tg-vault" alt="Logo" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
                                    <span className="font-bold text-xl">{t("app.title")}</span>
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => setIsMobileMenuOpen(false)} aria-label="关闭导航菜单" title="关闭导航菜单">
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            {renderSidebarContent(true)}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-gradient-to-br from-background to-muted/20">
                <header className="h-[72px] px-4 sm:px-8 flex items-center justify-between bg-background border-b border-border/40 transition-all">
                    <div className="flex items-center gap-3 md:hidden">
                        <img src="/logo.png?v=tg-vault" alt="Logo" className="h-10 w-10 rounded-xl object-contain shadow-sm" />
                        <div className="flex flex-col justify-center h-full pt-4 pb-4">
                            <h1 className="text-xl font-bold tracking-tight text-foreground">{t("app.title")}</h1>
                            <p className="text-xs text-muted-foreground">{categories.find(c => c.id === activeCategory)?.label || activeCategory}</p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <HeaderThemeSwitch />
                        <div className="md:hidden">
                            <Button size="icon" variant="ghost" onClick={() => setIsMobileMenuOpen(true)} aria-label="打开导航菜单" title="打开导航菜单">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-4 sm:p-8 scroll-smooth will-change-transform">
                    {children}
                </div>
            </main>
        </div>
    );
};
