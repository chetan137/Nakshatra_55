const hre = require("hardhat");

/**
 * Chainlink ETH/USD price feed addresses by network.
 * Docs: https://docs.chain.link/data-feeds/price-feeds/addresses
 */
const PRICE_FEEDS = {
  localhost: "0x0000000000000000000000000000000000000000", // replaced below by MockV3Aggregator
  hardhat:   "0x0000000000000000000000000000000000000000", // replaced below
  sepolia:   "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  mainnet:   "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
};

async function deployMockPriceFeed(deployer) {
  /**
   * MockV3Aggregator — used on localhost/hardhat only.
   * If @chainlink/contracts is installed we use the real mock; otherwise
   * we deploy a minimal inline mock.
   *
   * Install with:  npm install --save-dev @chainlink/contracts
   */
  let mockAddress;

  try {
    // Try to use the Chainlink-provided mock
    const Mock = await hre.ethers.getContractFactory("MockV3Aggregator");
    const INITIAL_PRICE = hre.ethers.parseUnits("2000", 8); // $2000 with 8 decimals
    const mock = await Mock.deploy(8, INITIAL_PRICE);
    await mock.waitForDeployment();
    mockAddress = await mock.getAddress();
    console.log("   MockV3Aggregator deployed at:", mockAddress);
  } catch {
    // Fallback: deploy the minimal mock included in this repo
    console.log("   @chainlink/contracts not found — deploying minimal MockV3Aggregator...");
    const Mock = await hre.ethers.getContractFactory("MockV3AggregatorMinimal");
    const INITIAL_PRICE = hre.ethers.parseUnits("2000", 8);
    const mock = await Mock.deploy(8, INITIAL_PRICE);
    await mock.waitForDeployment();
    mockAddress = await mock.getAddress();
    console.log("   MockV3AggregatorMinimal deployed at:", mockAddress);
  }

  return mockAddress;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network    = hre.network.name;

  console.log("🚀 Deploying LendingPlatform...");
  console.log("   Network:  ", network);
  console.log("   Deployer: ", deployer.address);
  console.log(
    "   Balance:  ",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // ── Resolve price feed address ─────────────────────────────────
  let priceFeedAddress = PRICE_FEEDS[network];

  if (!priceFeedAddress || priceFeedAddress === "0x0000000000000000000000000000000000000000") {
    if (network === "localhost" || network === "hardhat") {
      console.log("\n📡 Local network — deploying MockV3Aggregator...");
      priceFeedAddress = await deployMockPriceFeed(deployer);
    } else {
      throw new Error(`No price feed address configured for network: ${network}`);
    }
  }

  console.log("\n📡 Price feed address:", priceFeedAddress);

  // ── Deploy LendingPlatform ──────────────────────────────────────
  const LendingPlatform = await hre.ethers.getContractFactory("LendingPlatform");
  const contract        = await LendingPlatform.deploy(priceFeedAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("\n✅ LendingPlatform deployed!");
  console.log("   Contract address:", address);

  // ── Save deployment info ────────────────────────────────────────
  const fs   = require("fs");
  const path = require("path");

  const deploymentInfo = {
    network:          network,
    contractAddress:  address,
    priceFeedAddress: priceFeedAddress,
    deployer:         deployer.address,
    deployedAt:       new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });

  const filePath = path.join(outPath, `${network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  console.log("   Deployment info saved to:", filePath);

  // ── Extract ABI ─────────────────────────────────────────────────
  console.log("\n📋 Extracting ABI...");
  const { execSync } = require("child_process");
  try {
    execSync("node scripts/extractABI.js", { cwd: path.join(__dirname, ".."), stdio: "inherit" });
  } catch (e) {
    console.warn("   ABI extraction failed — run manually: npm run extract-abi");
  }

  console.log("\n🎯 NEXT STEPS:");
  console.log("   1. Add to backend/.env:");
  console.log("      CONTRACT_ADDRESS=" + address);
  console.log("      PRICE_FEED_ADDRESS=" + priceFeedAddress);
  console.log("   2. Add to frontend/.env:");
  console.log("      VITE_CONTRACT_ADDRESS=" + address);
  console.log("   3. ABI auto-copied to backend/abi/ and frontend/src/abi/");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
