const fs = require("fs");
const path = require("path");

const localUploadRoot = path.resolve(__dirname, "..", "uploads");

function uploadRoot() {
  const configured = String(process.env.UPLOAD_ROOT || "").trim();
  if (configured.includes("\0")) {
    throw new Error("UPLOAD_ROOT must not contain a null byte");
  }

  const root = path.resolve(configured || localUploadRoot);
  try {
    fs.mkdirSync(root, { recursive: true });
    if (!fs.statSync(root).isDirectory()) {
      throw new Error("not a directory");
    }
    fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    throw new Error(`UPLOAD_ROOT is not usable: ${root} (${error.message})`);
  }
  return root;
}

function uploadDirectory(name) {
  if (typeof name !== "string" || !name || path.basename(name) !== name) {
    throw new Error("Upload directory name must be a single directory name");
  }

  const root = uploadRoot();
  const directory = path.resolve(root, name);
  if (!directory.startsWith(`${root}${path.sep}`)) {
    throw new Error("Upload directory must remain within UPLOAD_ROOT");
  }
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

module.exports = { uploadRoot, uploadDirectory };
