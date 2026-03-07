import { vi } from "vitest";

// Avoid exporting inferred vitest mock types (TS2742 under pnpm + d.ts emit).
// oxlint-disable-next-line typescript/no-explicit-any

type AnyMockFn = any;

type FeishuClientMockModule = {
  createFeishuWSClient: AnyMockFn;
  createEventDispatcher: AnyMockFn;
};

type FeishuRuntimeMockModule = {
  getFeishuRuntime: () => {
    channel: {
      debounce: {
        resolveInboundDebounceMs: () => number;
        createInboundDebouncer: () => {
          enqueue: () => Promise<void>;
          flushKey: () => Promise<void>;
        };
      };
      text: {
        hasControlCommand: () => boolean;
      };
    };
  };
};

export function createFeishuClientMockModule(): FeishuClientMockModule {
  return {
    createFeishuWSClient: vi.fn(() => ({ start: vi.fn() })),
    createEventDispatcher: vi.fn(() => ({ register: vi.fn() })),
  };
}

export function createFeishuRuntimeMockModule(): FeishuRuntimeMockModule {
  return {
    getFeishuRuntime: () => ({
      channel: {
        debounce: {
          resolveInboundDebounceMs: () => 0,
          createInboundDebouncer: () => ({
            enqueue: async () => {},
            flushKey: async () => {},
          }),
        },
        text: {
          hasControlCommand: () => false,
        },
      },
    }),
  };
}
