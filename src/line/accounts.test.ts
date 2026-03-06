import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  resolveLineAccount,
  resolveDefaultLineAccountId,
  normalizeAccountId,
  DEFAULT_ACCOUNT_ID,
} from "./accounts.js";

describe("LINE accounts", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("resolveLineAccount", () => {
    it("resolves account from config", () => {
      const cfg: OpenClawConfig = {
        channels: {
          line: {
            enabled: true,
            channelAccessToken: "test-token",
            channelSecret: "test-secret",
            name: "Test Bot",
          },
        },
      };

      const account = resolveLineAccount({ cfg });

      expect(account.accountId).toBe(DEFAULT_ACCOUNT_ID);
      expect(account.enabled).toBe(true);
      expect(account.channelAccessToken).toBe("test-token");
      expect(account.channelSecret).toBe("test-secret");
      expect(account.name).toBe("Test Bot");
      expect(account.tokenSource).toBe("config");
    });

    it("resolves account from environment variables", () => {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = "env-token";
      process.env.LINE_CHANNEL_SECRET = "env-secret";

      const cfg: OpenClawConfig = {
        channels: {
          line: {
            enabled: true,
          },
        },
      };

      const account = resolveLineAccount({ cfg });

      expect(account.channelAccessToken).toBe("env-token");
      expect(account.channelSecret).toBe("env-secret");
      expect(account.tokenSource).toBe("env");
    });

    it("resolves named account", () => {
      const cfg: OpenClawConfig = {
        channels: {
          line: {
            enabled: true,
            accounts: {
              business: {
                enabled: true,
                channelAccessToken: "business-token",
                channelSecret: "business-secret",
                name: "Business Bot",
              },
            },
          },
        },
      };

      const account = resolveLineAccount({ cfg, accountId: "business" });

      expect(account.accountId).toBe("business");
      expect(account.enabled).toBe(true);
      expect(account.channelAccessToken).toBe("business-token");
      expect(account.channelSecret).toBe("business-secret");
      expect(account.name).toBe("Business Bot");
    });

    it("returns empty token when not configured", () => {
      const cfg: OpenClawConfig = {};

      const account = resolveLineAccount({ cfg });

      expect(account.channelAccessToken).toBe("");
      expect(account.channelSecret).toBe("");
      expect(account.tokenSource).toBe("none");
    });

    it("reuses credential file reads until file metadata changes", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-line-account-"));
      const tokenPath = path.join(tmpDir, "token.txt");
      const secretPath = path.join(tmpDir, "secret.txt");
      fs.writeFileSync(tokenPath, "token-v1\n", "utf-8");
      fs.writeFileSync(secretPath, "secret-v1\n", "utf-8");

      const cfg: OpenClawConfig = {
        channels: {
          line: {
            tokenFile: tokenPath,
            secretFile: secretPath,
          },
        },
      };

      const readSpy = vi.spyOn(fs, "readFileSync");
      try {
        const first = resolveLineAccount({ cfg });
        const second = resolveLineAccount({ cfg });

        expect(first.channelAccessToken).toBe("token-v1");
        expect(first.channelSecret).toBe("secret-v1");
        expect(second.channelAccessToken).toBe("token-v1");
        expect(second.channelSecret).toBe("secret-v1");

        const tokenReadsBeforeChange = readSpy.mock.calls.filter(
          ([candidate]) => String(candidate) === tokenPath,
        ).length;
        const secretReadsBeforeChange = readSpy.mock.calls.filter(
          ([candidate]) => String(candidate) === secretPath,
        ).length;
        expect(tokenReadsBeforeChange).toBe(1);
        expect(secretReadsBeforeChange).toBe(1);

        fs.writeFileSync(tokenPath, "token-v2-long\n", "utf-8");
        const third = resolveLineAccount({ cfg });
        expect(third.channelAccessToken).toBe("token-v2-long");
        expect(third.channelSecret).toBe("secret-v1");

        const tokenReadsAfterChange = readSpy.mock.calls.filter(
          ([candidate]) => String(candidate) === tokenPath,
        ).length;
        const secretReadsAfterChange = readSpy.mock.calls.filter(
          ([candidate]) => String(candidate) === secretPath,
        ).length;
        expect(tokenReadsAfterChange).toBe(2);
        expect(secretReadsAfterChange).toBe(1);
      } finally {
        readSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("resolveDefaultLineAccountId", () => {
    it("prefers channels.line.defaultAccount when configured", () => {
      const cfg: OpenClawConfig = {
        channels: {
          line: {
            defaultAccount: "business",
            accounts: {
              business: { enabled: true },
              support: { enabled: true },
            },
          },
        },
      };

      const id = resolveDefaultLineAccountId(cfg);
      expect(id).toBe("business");
    });

    it("normalizes channels.line.defaultAccount before lookup", () => {
      const cfg: OpenClawConfig = {
        channels: {
          line: {
            defaultAccount: "Business Ops",
            accounts: {
              "business-ops": { enabled: true },
            },
          },
        },
      };

      const id = resolveDefaultLineAccountId(cfg);
      expect(id).toBe("business-ops");
    });

    it("returns first named account when default not configured", () => {
      const cfg: OpenClawConfig = {
        channels: {
          line: {
            accounts: {
              business: { enabled: true },
            },
          },
        },
      };

      const id = resolveDefaultLineAccountId(cfg);

      expect(id).toBe("business");
    });

    it("falls back when channels.line.defaultAccount is missing", () => {
      const cfg: OpenClawConfig = {
        channels: {
          line: {
            defaultAccount: "missing",
            accounts: {
              business: { enabled: true },
            },
          },
        },
      };

      const id = resolveDefaultLineAccountId(cfg);
      expect(id).toBe("business");
    });
  });

  describe("normalizeAccountId", () => {
    it("trims and lowercases account ids", () => {
      expect(normalizeAccountId("  Business  ")).toBe("business");
    });
  });
});
