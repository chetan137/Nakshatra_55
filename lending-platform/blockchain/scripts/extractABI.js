/**
 * extractABI.js
 * After `npm run compile`, this copies the ABI to:
 *   ../backend/abi/LendingPlatform.json
 *   ../frontend/src/abi/LendingPlatform.json
 *
 * Run automatically via deploy.js or manually: npm run extract-abi
 */

const fs   = require("fs");
const path = require("path");

const ARTIFACT_PATH = path.join(
  __dirname, "..", "artifacts", "contracts",
  "LendingPlatform.sol", "LendingPlatform.json"
);

if (!fs.existsSync(ARTIFACT_PATH)) {
  console.error("❌ Artifact not found. Run `npm run compile` first.");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));

const abiOnly = {
  contractName: artifact.contractName,
  abi:          artifact.abi,
  bytecode:     artifact.bytecode,
};

// ── Destinations ──────────────────────────────────────────
const destinations = [
  path.join(__dirname, "..", "..", "backend", "abi"),
  path.join(__dirname, "..", "..", "frontend", "src", "abi"),
];

for (const dest of destinations) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const outFile = path.join(dest, "LendingPlatform.json");
  fs.writeFileSync(outFile, JSON.stringify(abiOnly, null, 2));
  console.log("✅ ABI written to:", outFile);
}
