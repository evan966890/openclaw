import { describe, expect, it } from "vitest";
import { readResponseWithLimit } from "./read-response-with-limit.js";

function makeStream(chunks: Uint8Array[], onPull?: () => void): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      const next = chunks.shift();
      if (!next) {
        controller.close();
        return;
      }
      controller.enqueue(next);
    },
  });
}

describe("readResponseWithLimit", () => {
  it("rejects immediately when content-length exceeds the limit", async () => {
    let getReaderCalled = false;
    let arrayBufferCalled = false;
    const res = {
      headers: new Headers({ "content-length": "5" }),
      body: {
        getReader() {
          getReaderCalled = true;
          throw new Error("getReader should not be called");
        },
      },
      async arrayBuffer() {
        arrayBufferCalled = true;
        throw new Error("arrayBuffer should not be called");
      },
    } as unknown as Response;

    await expect(readResponseWithLimit(res, 4)).rejects.toThrow(
      "Content too large: 5 bytes (limit: 4 bytes)",
    );
    expect(getReaderCalled).toBe(false);
    expect(arrayBufferCalled).toBe(false);
  });

  it("falls back to streamed counting when content-length is invalid", async () => {
    const res = new Response(makeStream([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]), {
      headers: { "content-length": "not-a-number" },
    });

    await expect(readResponseWithLimit(res, 4)).rejects.toThrow(
      "Content too large: 6 bytes (limit: 4 bytes)",
    );
  });
});
