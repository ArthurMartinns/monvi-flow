import { request, send } from "./http.ts";

export type TelegramLinkStatus = {
  enabled: boolean;
  linked: boolean;
  botUsername: string;
};
export type TelegramLinkCode = { code: string; expiresAt: string };

export function telegramLinkStatus(signal?: AbortSignal) {
  return request<TelegramLinkStatus>("/api/telegram/link", { signal });
}

export function createTelegramLinkCode() {
  return send<TelegramLinkCode>("POST", "/api/telegram/link/code");
}

export function unlinkTelegram() {
  return send<void>("DELETE", "/api/telegram/link");
}
