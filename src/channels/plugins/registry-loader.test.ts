import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePluginRegistry } from "../../plugins/runtime.js";
import {
  createChannelTestPluginBase,
  createTestRegistry,
} from "../../test-utils/channel-plugins.js";
import { createChannelRegistryLoader } from "./registry-loader.js";
import type { ChannelPlugin } from "./types.js";

const emptyRegistry = createTestRegistry([]);

const createPlugin = (id: string): ChannelPlugin =>
  createChannelTestPluginBase({
    id,
    label: id,
  }) as ChannelPlugin;

describe("createChannelRegistryLoader", () => {
  beforeEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  it("bounds cached entries and re-loads values evicted by the cap", async () => {
    const channels = [
      { pluginId: "a", plugin: createPlugin("a"), source: "test" },
      { pluginId: "b", plugin: createPlugin("b"), source: "test" },
      { pluginId: "c", plugin: createPlugin("c"), source: "test" },
    ];
    const findSpy = vi.spyOn(channels, "find");
    setActivePluginRegistry(createTestRegistry(channels));

    const loader = createChannelRegistryLoader<ChannelPlugin>((entry) => entry.plugin, {
      maxEntries: 2,
    });

    expect(await loader("a")).toBe(channels[0].plugin);
    expect(await loader("a")).toBe(channels[0].plugin);
    expect(findSpy).toHaveBeenCalledTimes(1);

    expect(await loader("b")).toBe(channels[1].plugin);
    expect(await loader("c")).toBe(channels[2].plugin);
    expect(await loader("a")).toBe(channels[0].plugin);
    expect(findSpy).toHaveBeenCalledTimes(4);
  });
});
