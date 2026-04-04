const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("🚀 Deploying LendingPlatform...");
  console.log("   Deployer:", deployer.address);
  console.log(
    "   Balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const LendingPlatform = await hre.ethers.getContractFactory("LendingPlatform");
  const contract = await LendingPlatform.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("\n✅ LendingPlatform deployed!");
  console.log("   Contract address:", address);
  console.log("   Network:", hre.network.name);

  // ── Save deployment info ──────────────────────────────
  const fs = require("fs");
  const path = require("path");

  const deploymentInfo = {
    network:         hre.network.name,
    contractAddress: address,
    deployer:        deployer.address,
    deployedAt:      new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });

  const filePath = path.join(outPath, `${hre.network.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log("   Deployment info saved to:", filePath);

  // ── Also run ABI extraction immediately ──────────────
  console.log("\n📋 Extracting ABI...");
  const { execSync } = require("child_process");
  try {
    execSync("node scripts/extractABI.js", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
  } catch (e) {
    console.warn("   ABI extraction failed (run manually: npm run extract-abi)");
  }

  console.log("\n🎯 NEXT STEPS:");
  console.log("   1. Copy CONTRACT_ADDRESS below into backend/.env");
  console.log("      CONTRACT_ADDRESS=" + address);
  console.log("   2. Copy CONTRACT_ADDRESS into frontend/.env");
  console.log("      VITE_CONTRACT_ADDRESS=" + address);
  console.log("   3. ABI is auto-copied to backend/abi/ and frontend/src/abi/");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
