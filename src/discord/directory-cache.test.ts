import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetDiscordDirectoryCacheForTest,
  rememberDiscordDirectoryUser,
  resolveDiscordDirectoryUserId,
} from "./directory-cache.js";

describe("discord directory cache account bounds", () => {
  beforeEach(() => {
    __resetDiscordDirectoryCacheForTest();
  });

  it("evicts the oldest account cache when the account cap is exceeded", () => {
    for (let index = 0; index < 64; index += 1) {
      rememberDiscordDirectoryUser({
        accountId: `acct-${index}`,
        userId: `${1000 + index}`,
        handles: ["alice"],
      });
    }

    expect(resolveDiscordDirectoryUserId({ accountId: "acct-0", handle: "alice" })).toBe("1000");

    rememberDiscordDirectoryUser({
      accountId: "acct-64",
      userId: "1064",
      handles: ["alice"],
    });

    expect(resolveDiscordDirectoryUserId({ accountId: "acct-0", handle: "alice" })).toBeUndefined();
    expect(resolveDiscordDirectoryUserId({ accountId: "acct-64", handle: "alice" })).toBe("1064");
  });

  it("keeps recently touched accounts when evicting", () => {
    for (let index = 0; index < 64; index += 1) {
      rememberDiscordDirectoryUser({
        accountId: `acct-${index}`,
        userId: `${2000 + index}`,
        handles: ["alice"],
      });
    }

    rememberDiscordDirectoryUser({
      accountId: "acct-0",
      userId: "3000",
      handles: ["bob"],
    });

    rememberDiscordDirectoryUser({
      accountId: "acct-64",
      userId: "3064",
      handles: ["alice"],
    });

    expect(resolveDiscordDirectoryUserId({ accountId: "acct-0", handle: "bob" })).toBe("3000");
    expect(resolveDiscordDirectoryUserId({ accountId: "acct-1", handle: "alice" })).toBeUndefined();
  });
});
