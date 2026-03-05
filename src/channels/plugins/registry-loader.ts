import type { PluginChannelRegistration, PluginRegistry } from "../../plugins/registry.js";
import { getActivePluginRegistry } from "../../plugins/runtime.js";
import type { ChannelId } from "./types.js";

type ChannelRegistryValueResolver<TValue> = (
  entry: PluginChannelRegistration,
) => TValue | undefined;

export const CHANNEL_REGISTRY_LOADER_CACHE_MAX = 512;

const CHANNEL_REGISTRY_MISS = Symbol("channel-registry-miss");

type ChannelRegistryCacheValue<TValue> = TValue | typeof CHANNEL_REGISTRY_MISS;

function setChannelRegistryCacheValue<TValue>(
  cache: Map<ChannelId, ChannelRegistryCacheValue<TValue>>,
  key: ChannelId,
  value: ChannelRegistryCacheValue<TValue>,
): void {
  cache.set(key, value);
  if (cache.size <= CHANNEL_REGISTRY_LOADER_CACHE_MAX) {
    return;
  }
  const oldest = cache.keys().next();
  if (!oldest.done) {
    cache.delete(oldest.value);
  }
}

export function createChannelRegistryLoader<TValue>(
  resolveValue: ChannelRegistryValueResolver<TValue>,
): (id: ChannelId) => Promise<TValue | undefined> {
  const cache = new Map<ChannelId, ChannelRegistryCacheValue<TValue>>();
  let lastRegistry: PluginRegistry | null = null;

  return async (id: ChannelId): Promise<TValue | undefined> => {
    const registry = getActivePluginRegistry();
    if (registry !== lastRegistry) {
      cache.clear();
      lastRegistry = registry;
    }
    if (cache.has(id)) {
      const cached = cache.get(id);
      if (cached === CHANNEL_REGISTRY_MISS) {
        return undefined;
      }
      return cached;
    }
    const pluginEntry = registry?.channels.find((entry) => entry.plugin.id === id);
    const resolved = pluginEntry ? resolveValue(pluginEntry) : undefined;
    setChannelRegistryCacheValue(
      cache,
      id,
      resolved === undefined ? CHANNEL_REGISTRY_MISS : resolved,
    );
    return resolved;
  };
}
