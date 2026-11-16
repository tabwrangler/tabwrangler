/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */

const { execFileSync } = require("child_process");
const packageJson = require("./package.json");

function describe() {
  try {
    return execFileSync(
      "git",
      ["describe", "--tags", "--long", "--dirty", "--match", "v[0-9]*.[0-9]*.[0-9]*"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    // Not a Git checkout (e.g. the source archive submitted to AMO) or no release tags.
    return null;
  }
}

function getVersion() {
  const description = describe();
  if (description == null) {
    return { version: packageJson.version, versionName: packageJson.version };
  }

  const match = /^v(\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)(-dirty)?$/.exec(description);
  if (match == null) throw new Error(`Unexpected \`git describe\` output: ${description}`);

  const [, tagVersion, commitsSinceTag, hash, dirty = ""] = match;
  if (commitsSinceTag === "0") {
    if (tagVersion !== packageJson.version) {
      throw new Error(
        `Tag v${tagVersion} does not match package.json version ${packageJson.version}`,
      );
    }
    return { version: tagVersion, versionName: `${tagVersion}${dirty}` };
  }

  return {
    // Manifest versions allow only up to four integers, so the commit count orders dev builds
    // after their tag and before the next release.
    version: `${tagVersion}.${commitsSinceTag}`,
    versionName: `${tagVersion}-${commitsSinceTag}-g${hash}${dirty}`,
  };
}

module.exports = getVersion();
