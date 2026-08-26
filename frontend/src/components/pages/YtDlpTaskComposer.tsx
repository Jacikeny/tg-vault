import { useState, type FormEvent } from "react";
import { Download, ExternalLink, Link2, Music2, Video } from "lucide-react";
import { Button } from "../ui/Button";
import { IndeterminateSpinner } from "../ui/IndeterminateSpinner";

interface YtDlpTaskComposerProps {
    onSubmit: (input: { url: string; format: 'best' | 'audio' }) => Promise<void>;
    onOpenTasks: () => void;
}

export const YtDlpTaskComposer = ({ onSubmit, onOpenTasks }: YtDlpTaskComposerProps) => {
    const [url, setUrl] = useState("");
    const [format, setFormat] = useState<'best' | 'audio'>('best');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalized = url.trim();
        if (!normalized) {
            setError('请输入媒体链接');
            return;
        }
        try {
            const parsed = new URL(normalized);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
            setError('请输入有效的 http 或 https 链接');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await onSubmit({ url: normalized, format });
            setUrl("");
        } catch (submissionError) {
            setError(submissionError instanceof Error ? submissionError.message : '添加任务失败');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="ytdlp-task-title">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
                <form className="min-w-0 flex-1 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Download className="h-5 w-5" /></div>
                            <div>
                                <h3 id="ytdlp-task-title" className="font-semibold">添加下载任务</h3>
                                <p className="text-sm text-muted-foreground">粘贴 yt-dlp 支持站点的单个视频或音频页面链接。</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
                        <label className="relative block min-w-0">
                            <span className="sr-only">媒体链接</span>
                            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                value={url}
                                onChange={event => setUrl(event.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/20"
                                disabled={submitting}
                            />
                        </label>
                        <label className="relative block">
                            <span className="sr-only">下载格式</span>
                            {format === 'audio' ? <Music2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /> : <Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
                            <select
                                value={format}
                                onChange={event => setFormat(event.target.value as 'best' | 'audio')}
                                className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                disabled={submitting}
                            >
                                <option value="best">视频（最佳质量）</option>
                                <option value="audio">仅音频（MP3）</option>
                            </select>
                        </label>
                        <Button type="submit" className="h-11 gap-2" disabled={submitting || !url.trim()}>
                            {submitting ? <IndeterminateSpinner label="正在添加任务" size="sm" /> : <Download className="h-4 w-4" />}
                            {submitting ? '正在提交' : '添加下载任务'}
                        </Button>
                    </div>
                    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
                </form>
                <div className="shrink-0 border-t border-border pt-4 lg:w-56 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    <p className="text-xs leading-5 text-muted-foreground">提交后由服务器排队下载并保存到当前存储源的 <code>ytdlp</code> 目录。播放列表默认不处理。</p>
                    <button type="button" onClick={onOpenTasks} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        前往任务中心查看进度 <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </section>
    );
};
