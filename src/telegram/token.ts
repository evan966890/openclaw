import fs from "node:fs";
import type { BaseTokenResolution } from "../channels/plugins/types.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeResolvedSecretInputString } from "../config/types.secrets.js";
import type { TelegramAccountConfig } from "../config/types.telegram.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../routing/session-key.js";

export type TelegramTokenSource = "env" | "tokenFile" | "config" | "none";

export type TelegramTokenResolution = BaseTokenResolution & {
  source: TelegramTokenSource;
};

type ResolveTelegramTokenOpts = {
  envToken?: string | null;
  accountId?: string | null;
  logMissingFile?: (message: string) => void;
};

type ReadTelegramTokenFileResult = { ok: true; token: string } | { ok: false };

function readTelegramTokenFile(params: {
  tokenFile: string;
  logMissingFile?: (message: string) => void;
  missingMessage: string;
  readFailedMessagePrefix: string;
}): ReadTelegramTokenFileResult {
  try {
    return { ok: true, token: fs.readFileSync(params.tokenFile, "utf-8").trim() };
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: unknown }).code
        : undefined;
    if (code === "ENOENT") {
      params.logMissingFile?.(params.missingMessage);
    } else {
      params.logMissingFile?.(`${params.readFailedMessagePrefix}: ${String(err)}`);
    }
    return { ok: false };
  }
}

export function resolveTelegramToken(
  cfg?: OpenClawConfig,
  opts: ResolveTelegramTokenOpts = {},
): TelegramTokenResolution {
  const accountId = normalizeAccountId(opts.accountId);
  const telegramCfg = cfg?.channels?.telegram;

  // Account IDs are normalized for routing (e.g. lowercased). Config keys may not
  // be normalized, so resolve per-account config by matching normalized IDs.
  const resolveAccountCfg = (id: string): TelegramAccountConfig | undefined => {
    const accounts = telegramCfg?.accounts;
    if (!accounts || typeof accounts !== "object" || Array.isArray(accounts)) {
      return undefined;
    }
    // Direct hit (already normalized key)
    const direct = accounts[id];
    if (direct) {
      return direct;
    }
    // Fallback: match by normalized key
    const matchKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === id);
    return matchKey ? accounts[matchKey] : undefined;
  };

  const accountCfg = resolveAccountCfg(
    accountId !== DEFAULT_ACCOUNT_ID ? accountId : DEFAULT_ACCOUNT_ID,
  );
  const accountTokenFile = accountCfg?.tokenFile?.trim();
  if (accountTokenFile) {
    const tokenResult = readTelegramTokenFile({
      tokenFile: accountTokenFile,
      logMissingFile: opts.logMissingFile,
      missingMessage: `channels.telegram.accounts.${accountId}.tokenFile not found: ${accountTokenFile}`,
      readFailedMessagePrefix: `channels.telegram.accounts.${accountId}.tokenFile read failed`,
    });
    if (!tokenResult.ok) {
      return { token: "", source: "none" };
    }
    if (tokenResult.token) {
      return { token: tokenResult.token, source: "tokenFile" };
    }
    return { token: "", source: "none" };
  }

  const accountToken = normalizeResolvedSecretInputString({
    value: accountCfg?.botToken,
    path: `channels.telegram.accounts.${accountId}.botToken`,
  });
  if (accountToken) {
    return { token: accountToken, source: "config" };
  }

  const allowEnv = accountId === DEFAULT_ACCOUNT_ID;
  const tokenFile = telegramCfg?.tokenFile?.trim();
  if (tokenFile) {
    const tokenResult = readTelegramTokenFile({
      tokenFile,
      logMissingFile: opts.logMissingFile,
      missingMessage: `channels.telegram.tokenFile not found: ${tokenFile}`,
      readFailedMessagePrefix: "channels.telegram.tokenFile read failed",
    });
    if (!tokenResult.ok) {
      return { token: "", source: "none" };
    }
    if (tokenResult.token) {
      return { token: tokenResult.token, source: "tokenFile" };
    }
  }

  const configToken = normalizeResolvedSecretInputString({
    value: telegramCfg?.botToken,
    path: "channels.telegram.botToken",
  });
  if (configToken) {
    return { token: configToken, source: "config" };
  }

  const envToken = allowEnv ? (opts.envToken ?? process.env.TELEGRAM_BOT_TOKEN)?.trim() : "";
  if (envToken) {
    return { token: envToken, source: "env" };
  }

  return { token: "", source: "none" };
}
