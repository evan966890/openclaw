import { describe, expect, it, vi } from "vitest";
import { readResponseWithLimit } from "./read-response-with-limit.js";

function makeStream(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe("readResponseWithLimit", () => {
  it("concatenates streamed chunks", async () => {
    const res = new Response(makeStream([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]), {
      status: 200,
    });

    const out = await readResponseWithLimit(res, 10);

    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5]);
  });

  it("uses overflow callback when streamed body exceeds maxBytes", async () => {
    const res = new Response(makeStream([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]), {
      status: 200,
    });
    const onOverflow = vi.fn(
      ({ size, maxBytes }: { size: number; maxBytes: number }) =>
        new Error(`overflow:${size}/${maxBytes}`),
    );

    await expect(readResponseWithLimit(res, 4, { onOverflow })).rejects.toThrow("overflow:5/4");
    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it("falls back to arrayBuffer when body stream is unavailable", async () => {
    const raw = new Uint8Array([9, 8, 7]).buffer;
    const res = {
      body: null,
      arrayBuffer: vi.fn(async () => raw),
    } as unknown as Response;

    const out = await readResponseWithLimit(res, 10);

    expect(Array.from(out)).toEqual([9, 8, 7]);
  });
});
