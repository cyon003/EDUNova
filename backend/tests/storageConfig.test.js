const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { uploadRoot, uploadDirectory } = require("../config/storage");

function withUploadRoot(value, callback) {
  const original = process.env.UPLOAD_ROOT;
  try {
    if (value === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = value;
    callback();
  } finally {
    if (original === undefined) delete process.env.UPLOAD_ROOT;
    else process.env.UPLOAD_ROOT = original;
  }
}

test("storage defaults to backend/uploads", () => {
  withUploadRoot(undefined, () => {
    assert.equal(uploadRoot(), path.resolve(__dirname, "..", "uploads"));
  });
});

test("UPLOAD_ROOT override creates directories beneath the configured root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunova-storage-"));
  try {
    withUploadRoot(root, () => {
      assert.equal(uploadRoot(), path.resolve(root));
      const directory = uploadDirectory("payment-slips");
      assert.equal(directory, path.join(path.resolve(root), "payment-slips"));
      assert.ok(fs.statSync(directory).isDirectory());
      assert.throws(() => uploadDirectory("../outside"), /single directory name/);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("public URL paths stay limited to non-sensitive image directories", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(appSource, /app\.use\("\/uploads\/course-covers", express\.static\(uploadDirectory\("course-covers"\)\)\)/);
  assert.match(appSource, /app\.use\("\/uploads\/lesson-posters", express\.static\(uploadDirectory\("lesson-posters"\)\)\)/);
  assert.match(appSource, /app\.use\("\/uploads\/profile-photos", express\.static\(uploadDirectory\("profile-photos"\)\)\)/);
  assert.doesNotMatch(appSource, /express\.static\(uploadDirectory\("(?:payment-slips|tutor-applications)"\)\)/);
});
