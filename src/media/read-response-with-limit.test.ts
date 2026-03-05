import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logVerbose: vi.fn(),
}));
const { logVerbose } = mocks;

vi.mock("../globals.js", async () => {
  const actual = await vi.importActual<typeof import("../globals.js")>("../globals.js");
  return { ...actual, logVerbose };
});

const { readResponseWithLimit } = await import("./read-response-with-limit.js");

function makeResponse(reader: {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
  cancel: () => Promise<void>;
  releaseLock: () => void;
}): Response {
  return {
    body: {
      getReader: () => reader,
    },
    url: "https://example.test/media.bin",
  } as unknown as Response;
}

describe("readResponseWithLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps overflow behavior when cancel fails and logs the cancel error", async () => {
    const reader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new Uint8Array([1, 2, 3, 4, 5]),
      }),
      cancel: vi.fn().mockRejectedValue(new Error("cancel failed")),
      releaseLock: vi.fn(),
    };

    await expect(readResponseWithLimit(makeResponse(reader), 4)).rejects.toThrow(
      "Content too large: 5 bytes (limit: 4 bytes)",
    );
    expect(reader.cancel).toHaveBeenCalledTimes(1);
    expect(reader.releaseLock).toHaveBeenCalledTimes(1);
    expect(logVerbose).toHaveBeenCalledTimes(1);
    expect(logVerbose).toHaveBeenCalledWith(expect.stringContaining("reader.cancel failed"));
  });

  it("returns buffered data when releaseLock fails and logs the release error", async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new Uint8Array([7, 8, 9]),
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined,
        }),
      cancel: vi.fn().mockResolvedValue(undefined),
      releaseLock: vi.fn(() => {
        throw new Error("release failed");
      }),
    };

    const result = await readResponseWithLimit(makeResponse(reader), 10);

    expect(result).toEqual(Buffer.from([7, 8, 9]));
    expect(reader.cancel).not.toHaveBeenCalled();
    expect(logVerbose).toHaveBeenCalledTimes(1);
    expect(logVerbose).toHaveBeenCalledWith(expect.stringContaining("reader.releaseLock failed"));
  });
});
