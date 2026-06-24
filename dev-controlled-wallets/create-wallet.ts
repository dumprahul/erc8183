import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

async function main() {
  // Step 1: Create a wallet set (logical container for wallets)
  console.log("── Creating wallet set ──");
  const walletSetResponse = await client.createWalletSet({
    name: "My First Dev-Controlled Wallet Set",
  });

  const walletSet = walletSetResponse.data?.walletSet;
  if (!walletSet?.id) {
    throw new Error("Wallet set creation failed: no ID returned");
  }
  console.log("  Wallet Set ID:", walletSet.id);

  // Step 2: Create a wallet inside the set on Arc Testnet
  console.log("\n── Creating wallet ──");
  const walletResponse = await client.createWallets({
    walletSetId: walletSet.id,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
  });

  const wallet = walletResponse.data?.wallets?.[0];
  if (!wallet) {
    throw new Error("Wallet creation failed: no wallet returned");
  }

  console.log("  Wallet ID:  ", wallet.id);
  console.log("  Address:    ", wallet.address);
  console.log("  Blockchain: ", wallet.blockchain);
  console.log("  State:      ", wallet.state);
  console.log("\nFund your wallet at: https://faucet.circle.com");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
