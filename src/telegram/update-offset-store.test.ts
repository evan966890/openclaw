import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withStateDirEnv } from "../test-helpers/state-dir-env.js";
const logVerboseMock = vi.hoisted(() => vi.fn());

vi.mock("../globals.js", () => ({
  logVerbose: logVerboseMock,
}));

import {
  deleteTelegramUpdateOffset,
  readTelegramUpdateOffset,
  writeTelegramUpdateOffset,
} from "./update-offset-store.js";

describe("deleteTelegramUpdateOffset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the offset file so a new bot starts fresh", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({ accountId: "default", updateId: 432_000_000 });
      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBe(432_000_000);

      await deleteTelegramUpdateOffset({ accountId: "default" });
      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBeNull();
    });
  });

  it("does not throw when the offset file does not exist", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await expect(deleteTelegramUpdateOffset({ accountId: "nonexistent" })).resolves.not.toThrow();
    });
  });

  it("only removes the targeted account offset, leaving others intact", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({ accountId: "default", updateId: 100 });
      await writeTelegramUpdateOffset({ accountId: "alerts", updateId: 200 });

      await deleteTelegramUpdateOffset({ accountId: "default" });

      expect(await readTelegramUpdateOffset({ accountId: "default" })).toBeNull();
      expect(await readTelegramUpdateOffset({ accountId: "alerts" })).toBe(200);
    });
  });

  it("returns null when stored offset was written by a different bot token", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async () => {
      await writeTelegramUpdateOffset({
        accountId: "default",
        updateId: 321,
        botToken: "111111:token-a",
      });

      expect(
        await readTelegramUpdateOffset({
          accountId: "default",
          botToken: "222222:token-b",
        }),
      ).toBeNull();
      expect(
        await readTelegramUpdateOffset({
          accountId: "default",
          botToken: "111111:token-a",
        }),
      ).toBe(321);
    });
  });

  it("treats legacy offset records without bot identity as stale when token is provided", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async ({ stateDir }) => {
      const legacyPath = path.join(stateDir, "telegram", "update-offset-default.json");
      await fs.mkdir(path.dirname(legacyPath), { recursive: true });
      await fs.writeFile(
        legacyPath,
        `${JSON.stringify({ version: 1, lastUpdateId: 777 }, null, 2)}\n`,
        "utf-8",
      );

      expect(
        await readTelegramUpdateOffset({
          accountId: "default",
          botToken: "333333:token-c",
        }),
      ).toBeNull();
    });
  });
  it("logs when stored state JSON is malformed", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async ({ stateDir }) => {
      const offsetPath = path.join(stateDir, "telegram", "update-offset-default.json");
      await fs.mkdir(path.dirname(offsetPath), { recursive: true });
      await fs.writeFile(offsetPath, "{not-json}\n", "utf-8");

      await expect(readTelegramUpdateOffset({ accountId: "default" })).resolves.toBeNull();
      expect(logVerboseMock).toHaveBeenCalledWith(
        expect.stringContaining("telegram update offset parse failed (default): invalid state"),
      );
    });
  });

  it("logs non-ENOENT read errors", async () => {
    await withStateDirEnv("openclaw-tg-offset-", async ({ stateDir }) => {
      const offsetPath = path.join(stateDir, "telegram", "update-offset-default.json");
      await fs.mkdir(offsetPath, { recursive: true });

      await expect(readTelegramUpdateOffset({ accountId: "default" })).resolves.toBeNull();
      expect(logVerboseMock).toHaveBeenCalledWith(
        expect.stringContaining("telegram update offset read failed (default):"),
      );
    });
  });
});
