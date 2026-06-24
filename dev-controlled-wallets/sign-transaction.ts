import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http, parseEther, parseGwei, toHex } from "viem";
import { arcTestnet } from "viem/chains";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

// ── Replace with your EOA wallet ID from create-wallet.ts ──
const WALLET_ID = process.env.WALLET_ID ?? "";
// ── Recipient address (can be any address for testing) ──
const TO_ADDRESS = "0x0000000000000000000000000000000000000001";

async function main() {
  if (!WALLET_ID) {
    throw new Error("Set WALLET_ID in your .env (must be an EOA wallet — SCA wallets are not supported for raw signing)");
  }

  // Fetch the wallet to get its address
  console.log("── Fetching wallet ──");
  const walletRes = await client.getWallet({ id: WALLET_ID });
  const wallet = walletRes.data?.wallet;
  if (!wallet?.address) throw new Error("Wallet not found");
  console.log("  Address:    ", wallet.address);
  console.log("  Blockchain: ", wallet.blockchain);

  // Get current nonce and fee data from Arc Testnet
  console.log("\n── Fetching on-chain data ──");
  const [nonce, feeData, block] = await Promise.all([
    publicClient.getTransactionCount({ address: wallet.address as `0x${string}` }),
    publicClient.estimateFeesPerGas(),
    publicClient.getBlock(),
  ]);
  console.log("  Nonce:              ", nonce);
  console.log("  MaxFeePerGas:       ", feeData.maxFeePerGas?.toString(), "wei");
  console.log("  MaxPriorityFeeGas:  ", feeData.maxPriorityFeePerGas?.toString(), "wei");
  console.log("  Block:              ", block.number.toString());

  // Build the EIP-1559 transaction (value = 0 — just a signature demo)
  const transaction = {
    chainId: toHex(arcTestnet.id),
    nonce: toHex(nonce),
    to: TO_ADDRESS,
    value: toHex(0),                                              // 0 USDC value transfer
    gas: toHex(21000),
    maxFeePerGas: toHex(feeData.maxFeePerGas ?? parseGwei("1")),
    maxPriorityFeePerGas: toHex(feeData.maxPriorityFeePerGas ?? parseGwei("1")),
    data: "0x",
  };

  console.log("\n── Transaction to sign ──");
  console.log(JSON.stringify(transaction, null, 2));

  // Sign via Circle — keys never leave Circle's HSM
  console.log("\n── Signing transaction ──");
  const signRes = await client.signTransaction({
    walletId: WALLET_ID,
    transaction: JSON.stringify(transaction),
  });

  const result = signRes.data;
  console.log("\n── Signature Results ──");
  console.log("  Signature:         ", result?.signature);
  console.log("  Signed Transaction:", result?.signedTransaction);
  console.log("  Tx Hash (if any):  ", result?.txHash ?? "(not returned — broadcast manually)");

  console.log("\n── Raw Result Object ──");
  console.log(JSON.stringify(result, null, 2));

  console.log("\n✓ Done. The signed transaction above can be broadcast via any Arc Testnet RPC.");
  console.log("  RPC: https://rpc.testnet.arc.network");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
