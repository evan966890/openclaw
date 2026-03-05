import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importCatalogWithEmptyDiscovery() {
  vi.doMock("../../plugins/discovery.js", () => ({
    discoverOpenClawPlugins: () => ({ candidates: [] }),
  }));
  return await import("./catalog.js");
}

describe("channel plugin external catalog cache", () => {
  let tempDir = "";
  let catalogPath = "";

  beforeEach(() => {
    vi.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-catalog-cache-"));
    catalogPath = path.join(tempDir, "catalog.json");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unmock("../../plugins/discovery.js");
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reuses parsed entries when external catalog file is unchanged", async () => {
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        entries: [
          {
            name: "@openclaw/demo-channel",
            openclaw: {
              channel: {
                id: "demo-channel",
                label: "Demo Channel",
                selectionLabel: "Demo Channel",
                docsPath: "/channels/demo-channel",
                blurb: "Demo entry",
              },
              install: {
                npmSpec: "@openclaw/demo-channel",
              },
            },
          },
        ],
      }),
    );

    const readSpy = vi.spyOn(fs, "readFileSync");
    const { listChannelPluginCatalogEntries } = await importCatalogWithEmptyDiscovery();

    const first = listChannelPluginCatalogEntries({ catalogPaths: [catalogPath] });
    const second = listChannelPluginCatalogEntries({ catalogPaths: [catalogPath] });

    expect(first.map((entry) => entry.id)).toContain("demo-channel");
    expect(second.map((entry) => entry.id)).toContain("demo-channel");

    const catalogReads = readSpy.mock.calls.filter(
      ([filePath]) => String(filePath) === catalogPath,
    );
    expect(catalogReads).toHaveLength(1);
  });

  it("invalidates cache when catalog file metadata changes", async () => {
    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        entries: [
          {
            name: "@openclaw/demo-channel-v1",
            openclaw: {
              channel: {
                id: "demo-channel-v1",
                label: "Demo Channel V1",
                selectionLabel: "Demo Channel V1",
                docsPath: "/channels/demo-channel-v1",
                blurb: "Demo entry",
              },
              install: {
                npmSpec: "@openclaw/demo-channel-v1",
              },
            },
          },
        ],
      }),
    );

    const readSpy = vi.spyOn(fs, "readFileSync");
    const { listChannelPluginCatalogEntries } = await importCatalogWithEmptyDiscovery();

    expect(
      listChannelPluginCatalogEntries({ catalogPaths: [catalogPath] }).map((entry) => entry.id),
    ).toContain("demo-channel-v1");

    fs.writeFileSync(
      catalogPath,
      JSON.stringify({
        entries: [
          {
            name: "@openclaw/demo-channel-v2",
            openclaw: {
              channel: {
                id: "demo-channel-v2",
                label: "Demo Channel V2",
                selectionLabel: "Demo Channel V2",
                docsPath: "/channels/demo-channel-v2",
                blurb: "Demo entry",
              },
              install: {
                npmSpec: "@openclaw/demo-channel-v2",
              },
            },
          },
        ],
      }),
    );
    const bumped = new Date(Date.now() + 2_000);
    fs.utimesSync(catalogPath, bumped, bumped);

    const afterUpdate = listChannelPluginCatalogEntries({ catalogPaths: [catalogPath] }).map(
      (entry) => entry.id,
    );
    expect(afterUpdate).toContain("demo-channel-v2");
    expect(afterUpdate).not.toContain("demo-channel-v1");

    const catalogReads = readSpy.mock.calls.filter(
      ([filePath]) => String(filePath) === catalogPath,
    );
    expect(catalogReads).toHaveLength(2);
  });
});
