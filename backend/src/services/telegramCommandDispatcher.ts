import { BOT_COMMANDS, findBotCommand, type BotCommandDefinition } from '../utils/telegramCommandRegistry.js';

export interface TelegramCommandContext {
    userId: number;
    chatKey: string;
    text: string;
}

export type TelegramCommandHandler = (context: TelegramCommandContext, command: BotCommandDefinition) => Promise<void> | void;

export interface TelegramCommandDispatcherDependencies {
    authenticate?: (userId: number) => Promise<boolean>;
    rateLimit?: (userId: number, command: BotCommandDefinition) => { limited: boolean; retryAfterSeconds: number };
    featureEnabled?: (feature: string) => boolean;
    handlers: Record<string, TelegramCommandHandler | undefined>;
}

export interface TelegramCommandDispatchResult {
    handled: boolean;
    command?: BotCommandDefinition;
    reason?: 'not-command' | 'unknown-command' | 'auth-required' | 'rate-limited' | 'feature-disabled' | 'missing-handler';
    retryAfterSeconds?: number;
}

export async function dispatchTelegramCommand(
    context: TelegramCommandContext,
    dependencies: TelegramCommandDispatcherDependencies,
): Promise<TelegramCommandDispatchResult> {
    if (!context.text.trim().startsWith('/')) return { handled: false, reason: 'not-command' };
    const command = findBotCommand(context.text);
    if (!command) return { handled: false, reason: 'unknown-command' };
    if (command.requiresAuth !== false && dependencies.authenticate && !(await dependencies.authenticate(context.userId))) {
        return { handled: true, command, reason: 'auth-required' };
    }
    const rate = dependencies.rateLimit?.(context.userId, command);
    if (rate?.limited) return { handled: true, command, reason: 'rate-limited', retryAfterSeconds: rate.retryAfterSeconds };
    if (command.feature && dependencies.featureEnabled && !dependencies.featureEnabled(command.feature)) {
        return { handled: true, command, reason: 'feature-disabled' };
    }
    const handler = dependencies.handlers[command.handlerKey || command.command];
    if (!handler) return { handled: false, command, reason: 'missing-handler' };
    await handler(context, command);
    return { handled: true, command };
}

export interface CommandHomeButton {
    text: string;
    data: string;
}

export interface CommandHomePage {
    page: number;
    totalPages: number;
    category: string;
    commands: BotCommandDefinition[];
    buttons: CommandHomeButton[][];
}

const CATEGORY_LABELS: Record<string, string> = {
    main: '首页',
    files: '文件',
    channels: '频道',
    settings: '设置',
    security: '安全',
};

export function buildCommandHomePage(requestedPage: number): CommandHomePage {
    const visible = BOT_COMMANDS.filter(command => command.help);
    const categories = [...new Set(visible.map(command => command.category))];
    const totalPages = Math.max(1, categories.length);
    const page = Math.min(totalPages - 1, Math.max(0, requestedPage));
    const category = categories[page] || 'main';
    const commands = visible.filter(command => command.category === category);
    const buttons: CommandHomeButton[][] = commands.map(command => [{
        text: `/${command.command} · ${command.description}`,
        data: `home_open_${command.command}`,
    }]);
    const navigation: CommandHomeButton[] = [];
    if (page > 0) navigation.push({ text: '◀️', data: `home_page_${page - 1}` });
    navigation.push({ text: `${CATEGORY_LABELS[category] || category} ${page + 1}/${totalPages}`, data: `home_page_${page}` });
    if (page + 1 < totalPages) navigation.push({ text: '▶️', data: `home_page_${page + 1}` });
    buttons.push(navigation);
    return { page, totalPages, category, commands, buttons };
}
