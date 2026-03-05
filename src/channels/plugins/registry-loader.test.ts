import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getActivePluginRegistry, setActivePluginRegistry } from "../../plugins/runtime.js";
import { createTestRegistry } from "../../test-utils/channel-plugins.js";
import {
  CHANNEL_REGISTRY_LOADER_CACHE_MAX,
  createChannelRegistryLoader,
} from "./registry-loader.js";
import type { ChannelPlugin } from "./types.js";

const emptyRegistry = createTestRegistry([]);

let previousRegistry: ReturnType<typeof getActivePluginRegistry> = null;

function createPlugin(id: string): ChannelPlugin {
  return {
    id,
    meta: {
      id,
      label: id,
      selectionLabel: id,
      docsPath: `/channels/${id}`,
      blurb: "test plugin",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => [],
      resolveAccount: () => ({}),
    },
  };
}

describe("createChannelRegistryLoader", () => {
  beforeEach(() => {
    previousRegistry = getActivePluginRegistry();
    setActivePluginRegistry(emptyRegistry);
  });

  afterEach(() => {
    setActivePluginRegistry(previousRegistry ?? emptyRegistry);
  });

  it("caches plugin misses and undefined resolver results", async () => {
    const registry = createTestRegistry([
      {
        pluginId: "slack",
        plugin: createPlugin("slack"),
        source: "test",
      },
    ]);
    const findSpy = vi.spyOn(registry.channels, "find");
    setActivePluginRegistry(registry);

    const resolveSpy = vi.fn((entry) => entry.plugin.outbound);
    const loadOutbound = createChannelRegistryLoader(resolveSpy);

    await expect(loadOutbound("slack")).resolves.toBeUndefined();
    await expect(loadOutbound("slack")).resolves.toBeUndefined();
    await expect(loadOutbound("missing")).resolves.toBeUndefined();
    await expect(loadOutbound("missing")).resolves.toBeUndefined();

    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).toHaveBeenCalledTimes(2);
  });

  it("bounds cache growth with FIFO eviction", async () => {
    const registry = createTestRegistry([]);
    const findSpy = vi.spyOn(registry.channels, "find");
    setActivePluginRegistry(registry);

    const loadPlugin = createChannelRegistryLoader((entry) => entry.plugin);
    for (let i = 0; i <= CHANNEL_REGISTRY_LOADER_CACHE_MAX; i += 1) {
      await loadPlugin(`missing-${i}`);
    }
    await loadPlugin("missing-0");

    expect(findSpy).toHaveBeenCalledTimes(CHANNEL_REGISTRY_LOADER_CACHE_MAX + 2);
  });
});
