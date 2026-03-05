import { resolveChannelGroupRequireMention } from "openclaw/plugin-sdk/compat";
import type { ChannelGroupContext } from "openclaw/plugin-sdk/mattermost";
import { resolveMattermostAccount } from "./mattermost/accounts.js";

export function resolveMattermostGroupRequireMention(
  params: ChannelGroupContext & { requireMentionOverride?: boolean },
): boolean | undefined {
  const requireMentionOverride =
    typeof params.requireMentionOverride === "boolean"
      ? params.requireMentionOverride
      : resolveMattermostAccount({
          cfg: params.cfg,
          accountId: params.accountId,
        }).requireMention;
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "mattermost",
    groupId: params.groupId,
    accountId: params.accountId,
    requireMentionOverride,
  });
}
