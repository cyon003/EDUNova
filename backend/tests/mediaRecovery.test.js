const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { mediaFile, prepareMediaRecovery, finishMediaRecovery } = require("../services/mediaRecoveryService");

test("recovery rejects unsafe names and preserves shared media and missing legacy files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "edunova-media-recovery-"));
  const previousRoot = process.env.UPLOAD_ROOT;
  process.env.UPLOAD_ROOT = root;
  try {
    for (const name of ["..", ".", "../secret", "/secret", "x\\secret", "x\0y"]) assert.equal(mediaFile("course-videos", name), null);
    assert.equal(mediaFile("unknown", "video.mp4"), null);
    await fs.mkdir(path.join(root, "course-videos"));
    const source = path.join(root, "course-videos", "shared.mp4");
    await fs.writeFile(source, "shared bytes");
    const ticket = await prepareMediaRecovery([mediaFile("course-videos", "shared.mp4"), mediaFile("course-videos", "missing.mp4")], { operation: "test" });
    assert.equal(ticket.manifest.files[1].missing, true);
    await finishMediaRecovery(ticket, [{ primaryMedia: { storage: "course-videos", storedName: "shared.mp4" } }]);
    assert.equal(await fs.readFile(source, "utf8"), "shared bytes");
    assert.equal(await fs.readFile(path.join(ticket.directory, "0"), "utf8"), "shared bytes");
    const manifest = JSON.parse(await fs.readFile(path.join(ticket.directory, "manifest.json"), "utf8"));
    assert.equal(manifest.state, "archived");
    assert.equal((await fs.stat(path.join(root, "media-recovery"))).mode & 0o777, 0o700);
    assert.equal((await fs.stat(path.join(ticket.directory, "manifest.json"))).mode & 0o777, 0o600);
    await fs.symlink(source, path.join(root, "course-videos", "linked.mp4"));
    await assert.rejects(prepareMediaRecovery([mediaFile("course-videos", "linked.mp4")], {}), /regular file/);
  } finally {
    if (previousRoot === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});
