import type { Api } from 'telegram';
import { canonicalTelegramChatKey, telegramChatKeyFromPeerParts } from '../utils/telegramChatKey.js';

export function messageChatKey(message: Api.Message, senderId: number): string {
    return canonicalTelegramChatKey(message.chatId?.toString() || senderId);
}

export function callbackChatKey(update: Api.UpdateBotCallbackQuery, userId: number): string {
    return telegramChatKeyFromPeerParts(update.peer as any, userId);
}

export function telegramSubscriptionPeerKey(peer: any): string {
    const value = peer?.userId || peer?.chatId || peer?.channelId;
    return String(value?.toString?.() || value || peer?.toString?.() || '').replace(/^-100/, '').replace(/^-/, '');
}
