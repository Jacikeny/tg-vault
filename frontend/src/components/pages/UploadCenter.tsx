import { useMemo, useState } from "react";
import { CheckCircle2, Cloud, FolderOpen, Gauge, RotateCcw, ShieldCheck, Upload, XCircle } from "lucide-react";
import type { QueueItem } from "../ui/UploadQueueModal";
import { UploadZone } from "../ui/UploadZone";
import type { UploadCapabilities } from "../../services/api";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface UploadCenterProps {
    onUpload: (files: File[], folder?: string) => void;
    uploading: boolean;
    uploadProgress: number;
    capabilities: UploadCapabilities | null;
    storageTarget: { provider: string; account: string } | null;
    folders: string[];
    queue: QueueItem[];
    recoveredUploadCount: number;
    onOpenQueue: () => void;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** unit)).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const statusLabel: Record<QueueItem["status"], string> = {
    pending: "等待上传",
    uploading: "正在上传",
    processing: "服务器处理中",
    completed: "已完成",
    error: "上传失败",
    cancelled: "已取消",
};

export const UploadCenter = ({
    onUpload,
    uploading,
    uploadProgress,
    capabilities,
    storageTarget,
    folders,
    queue,
    recoveredUploadCount,
    onOpenQueue,
}: UploadCenterProps) => {
    const [destination, setDestination] = useState("");
    const activeCount = queue.filter(item => ["pending", "uploading", "processing"].includes(item.status)).length;
    const completedCount = queue.filter(item => item.status === "completed").length;
    const failedCount = queue.filter(item => ["error", "cancelled"].includes(item.status)).length;
    const recentItems = useMemo(() => queue.slice(-4).reverse(), [queue]);
    const threshold = capabilities ? Math.round(capabilities.simpleUploadThresholdBytes / 1024 / 1024) : null;

    return (
        <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 pb-8 sm:gap-6" aria-labelledby="upload-center-title">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                    <h1 id="upload-center-title" className="text-2xl font-bold tracking-tight sm:text-4xl">上传中心</h1>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground sm:mt-2 sm:text-base">
                        选择目标目录后直接添加文件。大文件自动分片，上传可在后台继续。
                    </p>
                </div>
                {(queue.length > 0 || recoveredUploadCount > 0) && (
                    <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={onOpenQueue}>
                        <Gauge className="h-4 w-4" />
                        管理上传队列
                    </Button>
                )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="p-3 sm:p-6">
                    <UploadZone
                        onDrop={files => onUpload(files, destination || undefined)}
                        uploading={uploading}
                        uploadProgress={uploadProgress}
                        capabilities={capabilities}
                        destinationLabel={destination || "根目录"}
                    />
                </div>
                <div data-testid="upload-destination" className="flex flex-col gap-3 border-t border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-background p-2 shadow-sm ring-1 ring-border"><FolderOpen className="h-4 w-4" /></div>
                        <div>
                            <label htmlFor="upload-destination" className="text-sm font-semibold">上传到</label>
                            <p className="mt-0.5 text-xs text-muted-foreground">上传开始后，目标存储与目录不会随设置变更。</p>
                        </div>
                    </div>
                    <select
                        id="upload-destination"
                        value={destination}
                        onChange={event => setDestination(event.target.value)}
                        className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/20 sm:w-72"
                    >
                        <option value="">根目录</option>
                        {folders.map(folder => <option key={folder} value={folder}>{folder}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/55 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Cloud className="h-4 w-4" />当前存储</div>
                    <p className="mt-2 truncate text-sm font-semibold" title={storageTarget ? `${storageTarget.provider} / ${storageTarget.account}` : "正在读取存储配置"}>
                        {storageTarget ? `${storageTarget.provider} / ${storageTarget.account}` : "正在读取存储配置"}
                    </p>
                </div>
                <div data-testid="upload-queue-summary" className="rounded-xl bg-muted/55 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Gauge className="h-4 w-4" />上传队列</div>
                    <p className="mt-2 text-sm font-semibold tabular-nums">
                        {activeCount > 0 ? `${activeCount} 项进行中` : "当前空闲"}
                        {recoveredUploadCount > 0 ? ` · ${recoveredUploadCount} 项可恢复` : ""}
                    </p>
                </div>
                <div className="rounded-xl bg-muted/55 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4" />传输策略</div>
                    <p className="mt-2 text-sm font-semibold">{threshold ? `超过 ${threshold} MiB 自动分片` : "正在读取上传限制"}</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.45fr_0.75fr]">
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">本次上传</h2>
                            <p className="mt-1 text-xs text-muted-foreground">{completedCount} 项完成 · {failedCount} 项失败或取消</p>
                        </div>
                        {queue.length > 0 && <Button variant="ghost" size="sm" onClick={onOpenQueue}>查看全部</Button>}
                    </div>
                    {recentItems.length === 0 ? (
                        <div className="mt-5 rounded-xl bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">选择文件后，进度会显示在这里。</div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {recentItems.map(item => (
                                <button key={item.id} type="button" onClick={onOpenQueue} className="block w-full rounded-xl bg-muted/35 p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border", item.status === "completed" && "text-green-600", ["error", "cancelled"].includes(item.status) && "text-red-600")}>
                                            {item.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : ["error", "cancelled"].includes(item.status) ? <XCircle className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="truncate text-sm font-medium">{item.file.name}</p>
                                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.progress}%</span>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                <span>{statusLabel[item.status]}</span><span>{formatBytes(item.file.size)}</span>
                                            </div>
                                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
                                                <div className={cn("h-full rounded-full bg-primary transition-[width] duration-300", ["error", "cancelled"].includes(item.status) && "bg-red-500")} style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <aside className="rounded-2xl border border-border bg-muted/35 p-5 sm:p-6">
                    <h2 className="text-base font-semibold">可靠上传</h2>
                    <div className="mt-5 space-y-5 text-sm">
                        <div className="flex gap-3"><RotateCcw className="mt-0.5 h-4 w-4 shrink-0 opacity-75" /><div><p className="font-medium">可续传</p><p className="mt-1 leading-5 opacity-65">中断的大文件上传可重新选择原文件继续。</p></div></div>
                        <div className="flex gap-3"><Gauge className="mt-0.5 h-4 w-4 shrink-0 opacity-75" /><div><p className="font-medium">并发受控</p><p className="mt-1 leading-5 opacity-65">队列同时处理最多 3 个文件，降低浏览器和服务器压力。</p></div></div>
                        <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 opacity-75" /><div><p className="font-medium">目标锁定</p><p className="mt-1 leading-5 opacity-65">每项任务创建时记录存储账户与目录，避免中途切换。</p></div></div>
                    </div>
                </aside>
            </div>
        </section>
    );
};
