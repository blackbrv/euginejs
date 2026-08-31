import { createEditor } from "@eugine/core";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryVersionAdapter } from "../src/adapter.js";
import { VersioningError } from "../src/errors.js";
import { Versioning } from "../src/versioning.js";

function setup(documentId?: string) {
  const editor = createEditor({ clientId: "author-1", components: [{ type: "text" }] });
  const adapter = new MemoryVersionAdapter();
  const versioning = new Versioning({ adapter, documentId });
  editor.use(versioning);
  return { editor, adapter, versioning };
}

describe("Versioning", () => {
  it("throws VERSIONING_NOT_INSTALLED when used before editor.use()", async () => {
    const versioning = new Versioning({ adapter: new MemoryVersionAdapter() });
    await expect(versioning.createVersion()).rejects.toThrow(VersioningError);
    await expect(versioning.createVersion()).rejects.toMatchObject({ code: "VERSIONING_NOT_INSTALLED" });
    // listVersions()/getVersion() must fail the same way rather than silently
    // returning an empty list / undefined before the plugin is installed.
    await expect(versioning.listVersions()).rejects.toMatchObject({ code: "VERSIONING_NOT_INSTALLED" });
    await expect(versioning.getVersion("x")).rejects.toMatchObject({ code: "VERSIONING_NOT_INSTALLED" });
  });

  it("creates a version snapshotting the current document, numbered from 1", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });

    const version = await versioning.createVersion({ label: "First draft" });
    expect(version.number).toBe(1);
    expect(version.label).toBe("First draft");
    expect(version.author).toBe("author-1");
    expect(version.document.document.nodes.a).toBeDefined();
    expect(typeof version.id).toBe("string");
    expect(typeof version.createdAt).toBe("number");
  });

  it("numbers versions monotonically per document, never reusing a number", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();
    editor.insert("text", editor.getDocument().rootId, { id: "b" });
    const v2 = await versioning.createVersion();
    editor.insert("text", editor.getDocument().rootId, { id: "c" });
    const v3 = await versioning.createVersion();

    expect([v1.number, v2.number, v3.number]).toEqual([1, 2, 3]);
    expect(new Set([v1.id, v2.id, v3.id]).size).toBe(3);
  });

  it("does not touch the live document, undo/redo history, or an already-saved version", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const before = editor.getDocument();
    const canUndoBefore = editor.history.canUndo();

    const v1 = await versioning.createVersion();

    expect(editor.getDocument()).toBe(before); // same reference — createVersion never calls store.set()
    expect(editor.history.canUndo()).toBe(canUndoBefore);
    // Mutating the live document further must not retroactively change a
    // version already handed back to the caller.
    editor.insert("text", editor.getDocument().rootId, { id: "b" });
    expect(v1.document.document.nodes.b).toBeUndefined();
  });

  it("listVersions() returns every version, oldest first, regardless of adapter insertion order", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    await versioning.createVersion({ label: "one" });
    editor.insert("text", editor.getDocument().rootId, { id: "b" });
    await versioning.createVersion({ label: "two" });

    const versions = await versioning.listVersions();
    expect(versions.map((v) => v.label)).toEqual(["one", "two"]);
  });

  it("getVersion() returns undefined for an id that doesn't exist", async () => {
    const { versioning } = setup();
    expect(await versioning.getVersion("nope")).toBeUndefined();
  });

  it("restoreVersion() loads the target version's document into the live editor", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();
    editor.insert("text", editor.getDocument().rootId, { id: "b" });
    await versioning.createVersion();

    await versioning.restoreVersion(v1.id, { recordRestore: false });
    const nodes = editor.getDocument().nodes;
    expect(nodes.a).toBeDefined();
    expect(nodes.b).toBeUndefined();
  });

  it("restoreVersion() by default records a new version and destroys nothing already saved", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();
    editor.insert("text", editor.getDocument().rootId, { id: "b" });
    const v2 = await versioning.createVersion();

    const { restoredFrom, recordedVersion } = await versioning.restoreVersion(v1.id);

    expect(restoredFrom).toEqual(v1);
    expect(recordedVersion?.number).toBe(3);
    expect(recordedVersion?.label).toContain("version 1");
    expect(recordedVersion?.metadata).toMatchObject({ restoredFrom: v1.id });

    // v1 and v2 are both still there, unchanged, in order.
    const all = await versioning.listVersions();
    expect(all.map((v) => v.id)).toEqual([v1.id, v2.id, recordedVersion?.id]);
    expect(all[0]).toEqual(v1);
    expect(all[1]).toEqual(v2);
  });

  it("restoreVersion({ recordRestore: false }) returns recordedVersion: undefined but still emits version.restore", async () => {
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();

    const restoreEvents: unknown[] = [];
    versioning.events.on("version.restore", (payload) => restoreEvents.push(payload));

    const result = await versioning.restoreVersion(v1.id, { recordRestore: false });
    expect(result.recordedVersion).toBeUndefined();
    expect(result.restoredFrom).toEqual(v1);
    // The live document really did change — that alone must be observable.
    expect(restoreEvents).toEqual([{ restoredFrom: v1, recordedVersion: undefined }]);
    expect(await versioning.listVersions()).toEqual([v1]); // nothing new was persisted
  });

  it("restoreVersion() throws VERSIONING_VERSION_NOT_FOUND for an unknown id", async () => {
    const { versioning } = setup();
    await expect(versioning.restoreVersion("nope")).rejects.toMatchObject({
      code: "VERSIONING_VERSION_NOT_FOUND",
    });
  });

  it("restoring a version saved under a stale schemaVersion fails via the editor's normal load()/migration path, not a separate one", async () => {
    // This package deliberately does not special-case migration: a version's
    // `document` is a plain SerializedDocument, restored via editor.load(),
    // so a stale schemaVersion with no migration registered fails exactly
    // like loading any other stale document would.
    const adapter = new MemoryVersionAdapter();
    const editor = createEditor({ components: [{ type: "text" }] });
    const versioning = new Versioning({ adapter });
    editor.use(versioning);
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();

    const stale = {
      ...v1,
      id: "stale-version",
      document: { ...v1.document, document: { ...v1.document.document, schemaVersion: 0 } },
    };
    adapter.save("default", stale);

    await expect(versioning.restoreVersion(stale.id)).rejects.toMatchObject({
      code: "VERSIONING_RESTORE_FAILED",
    });
  });

  it("keeps separate documentIds' version histories independent on a shared adapter", async () => {
    // One Versioning instance per editor (a second instance with a different
    // documentId can't coexist on the same editor — PluginManager treats
    // plugin `name` as a uniqueness key, and a single Editor only ever has
    // one live document to version anyway). Two documentIds on one adapter
    // is the realistic multi-site scenario: separate editors/sessions, one
    // shared backing store.
    const adapter = new MemoryVersionAdapter();
    const homeEditor = createEditor({ components: [{ type: "text" }] });
    const home = new Versioning({ adapter, documentId: "home" });
    homeEditor.use(home);

    const aboutEditor = createEditor({ components: [{ type: "text" }] });
    const about = new Versioning({ adapter, documentId: "about" });
    aboutEditor.use(about);

    await home.createVersion({ label: "home v1" });
    await home.createVersion({ label: "home v2" });
    await about.createVersion({ label: "about v1" });

    expect((await home.listVersions()).map((v) => v.label)).toEqual(["home v1", "home v2"]);
    expect((await about.listVersions()).map((v) => v.label)).toEqual(["about v1"]);
  });

  it("emits version.create and version.restore", async () => {
    const { editor, versioning } = setup();
    const created: string[] = [];
    const restored: string[] = [];
    versioning.events.on("version.create", ({ version }) => created.push(version.id));
    versioning.events.on("version.restore", ({ restoredFrom }) => restored.push(restoredFrom.id));

    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();
    expect(created).toEqual([v1.id]);

    const { recordedVersion } = await versioning.restoreVersion(v1.id);
    expect(created).toEqual([v1.id, recordedVersion?.id]);
    expect(restored).toEqual([v1.id]);
  });

  it("assigns distinct, correctly ordered version numbers even when createVersion() is called concurrently", async () => {
    // Regression test: numbering used to be computed in Versioning via a
    // list()-then-max+1 read, which races under concurrent calls. It's now
    // the (synchronous, in-process-atomic) adapter's job.
    const { editor, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });

    const results = await Promise.all([
      versioning.createVersion({ label: "A" }),
      versioning.createVersion({ label: "B" }),
      versioning.createVersion({ label: "C" }),
      versioning.createVersion({ label: "D" }),
      versioning.createVersion({ label: "E" }),
    ]);

    const numbers = results.map((v) => v.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(results.map((v) => v.id)).size).toBe(5);
  });

  it("wraps a failing adapter.list()/get() as VERSIONING_ADAPTER_ERROR, not a raw error", async () => {
    const failingAdapter: import("../src/adapter.js").VersionAdapter = {
      save: () => {
        throw new Error("boom");
      },
      list: () => {
        throw new Error("boom");
      },
      get: () => {
        throw new Error("boom");
      },
    };
    const editor = createEditor();
    const versioning = new Versioning({ adapter: failingAdapter });
    editor.use(versioning);

    await expect(versioning.createVersion()).rejects.toMatchObject({ code: "VERSIONING_ADAPTER_ERROR" });
    await expect(versioning.listVersions()).rejects.toMatchObject({ code: "VERSIONING_ADAPTER_ERROR" });
    await expect(versioning.getVersion("x")).rejects.toMatchObject({ code: "VERSIONING_ADAPTER_ERROR" });
  });

  it("wraps an editor.load() failure during restoreVersion() as VERSIONING_RESTORE_FAILED", async () => {
    const { versioning } = setup();
    const v1 = await versioning.createVersion();

    // A version whose document has an unrecognized "engine" field — editor.load() rejects this outright.
    const adapter = new MemoryVersionAdapter();
    const badVersion = adapter.save("default", {
      ...v1,
      document: { ...v1.document, engine: "not-eugine" as never },
    });
    const isolatedEditor = createEditor();
    const isolatedVersioning = new Versioning({ adapter });
    isolatedEditor.use(isolatedVersioning);

    await expect(isolatedVersioning.restoreVersion(badVersion.id)).rejects.toMatchObject({
      code: "VERSIONING_RESTORE_FAILED",
    });
  });

  it("restoreVersion() still emits version.restore and rolls back the live document even when recording the restore fails", async () => {
    // editor.load() (the actual rollback) succeeds; the auto-record
    // createVersion() call that follows it is what fails here — the live
    // document must not be left in limbo just because persisting a record
    // of the restore didn't work.
    const { editor, adapter, versioning } = setup();
    editor.insert("text", editor.getDocument().rootId, { id: "a" });
    const v1 = await versioning.createVersion();
    editor.insert("text", editor.getDocument().rootId, { id: "b" });
    await versioning.createVersion();

    const restoreEvents: unknown[] = [];
    versioning.events.on("version.restore", (payload) => restoreEvents.push(payload));

    // From here on, the *next* save() call — restoreVersion()'s own
    // auto-record — is the one that fails; editor.load() itself doesn't
    // touch the adapter at all.
    adapter.save = () => {
      throw new Error("storage is down");
    };

    await expect(versioning.restoreVersion(v1.id)).rejects.toMatchObject({ code: "VERSIONING_ADAPTER_ERROR" });

    // The live document really did roll back, despite the rejection above.
    const nodes = editor.getDocument().nodes;
    expect(nodes.a).toBeDefined();
    expect(nodes.b).toBeUndefined();
    // A listener still finds out the document changed, with no recorded version.
    expect(restoreEvents).toEqual([{ restoredFrom: v1, recordedVersion: undefined }]);
  });
});

describe("MemoryVersionAdapter", () => {
  let adapter: MemoryVersionAdapter;
  beforeEach(() => {
    adapter = new MemoryVersionAdapter();
  });

  it("assigns and returns a monotonically increasing number, ignoring any number the caller passed", () => {
    const v1 = adapter.save("doc", { id: "v1", document: {} as never, createdAt: 1 });
    const v2 = adapter.save("doc", { id: "v2", document: {} as never, createdAt: 2, number: 999 } as never);
    expect(v1.number).toBe(1);
    expect(v2.number).toBe(2);
  });

  it("never overwrites a previously saved version", () => {
    adapter.save("doc", { id: "v1", document: {} as never, createdAt: 1 });
    adapter.save("doc", { id: "v2", document: {} as never, createdAt: 2 });
    expect(adapter.list("doc")).toHaveLength(2);
    expect(adapter.get("doc", "v1")?.number).toBe(1);
  });

  it("list()/get() return deep-cloned data: mutating a returned version cannot corrupt stored history", () => {
    adapter.save("doc", { id: "v1", document: {} as never, createdAt: 1, metadata: { note: "original" } });

    const viaList = adapter.list("doc")[0]!;
    viaList.metadata!.note = "tampered via list()";
    const viaGet = adapter.get("doc", "v1")!;
    viaGet.metadata!.note = "tampered via get()";

    expect(adapter.get("doc", "v1")?.metadata?.note).toBe("original");
  });

  it("list() returns an independent copy, not the live array", () => {
    adapter.save("doc", { id: "v1", document: {} as never, createdAt: 1 });
    const list = adapter.list("doc");
    list.pop();
    expect(adapter.list("doc")).toHaveLength(1);
  });

  it("assigns distinct, sequential numbers for concurrent synchronous-looking save() calls (no list() round-trip to race)", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => adapter.save("doc", { id: `v${i}`, document: {} as never, createdAt: i })),
      ),
    );
    expect(results.map((v) => v.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
