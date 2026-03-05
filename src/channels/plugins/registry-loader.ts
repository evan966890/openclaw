import type { PluginChannelRegistration, PluginRegistry } from "../../plugins/registry.js";
import { getActivePluginRegistry } from "../../plugins/runtime.js";
import type { ChannelId } from "./types.js";

type ChannelRegistryValueResolver<TValue> = (
  entry: PluginChannelRegistration,
) => TValue | undefined;

type ChannelRegistryLoaderOptions = {
  maxEntries?: number;
};

const DEFAULT_CACHE_MAX_ENTRIES = 256;

function resolveCacheMaxEntries(maxEntries?: number): number {
  if (typeof maxEntries !== "number" || !Number.isFinite(maxEntries)) {
    return DEFAULT_CACHE_MAX_ENTRIES;
  }
  return Math.max(1, Math.floor(maxEntries));
}

export function createChannelRegistryLoader<TValue>(
  resolveValue: ChannelRegistryValueResolver<TValue>,
  options?: ChannelRegistryLoaderOptions,
): (id: ChannelId) => Promise<TValue | undefined> {
  const cache = new Map<ChannelId, TValue>();
  const maxEntries = resolveCacheMaxEntries(options?.maxEntries);
  let lastRegistry: PluginRegistry | null = null;

  return async (id: ChannelId): Promise<TValue | undefined> => {
    const registry = getActivePluginRegistry();
    if (registry !== lastRegistry) {
      cache.clear();
      lastRegistry = registry;
    }
    const cached = cache.get(id);
    if (cached) {
      return cached;
    }
    const pluginEntry = registry?.channels.find((entry) => entry.plugin.id === id);
    if (!pluginEntry) {
      return undefined;
    }
    const resolved = resolveValue(pluginEntry);
    if (resolved) {
      if (!cache.has(id) && cache.size >= maxEntries) {
        cache.clear();
      }
      cache.set(id, resolved);
    }
    return resolved;
  };
}
