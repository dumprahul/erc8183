import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "viem/chains";
import { setTimeout as delay } from "node:timers/promises";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const WALLET_ID = process.env.WALLET_ID ?? "";
const USDC      = "0x3600000000000000000000000000000000000000" as const;
const RECIPIENT = "0x0612D26676869aFcF8BCfdcC55Bd62a307fBF4b5" as const;

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function waitForTx(txId: string, label: string): Promise<string> {
  process.stdout.write(`  Waiting for ${label}`);
  for (let i = 0; i < 60; i++) {
    await delay(2000);
    const res = await client.getTransaction({ id: txId });
    const tx = res.data?.transaction;
    if (tx?.state === "COMPLETE" && tx.txHash) {
      console.log(" ✓");
      return tx.txHash;
    }
    if (tx?.state === "FAILED") throw new Error(`${label} failed on-chain`);
    process.stdout.write(".");
  }
  throw new Error(`${label} timed out`);
}

async function main() {
  if (!WALLET_ID) throw new Error("Set WALLET_ID in your .env");

  // Fetch sender wallet
  console.log("── Fetching wallet ──");
  const walletRes = await client.getWallet({ id: WALLET_ID });
  const wallet = walletRes.data?.wallet;
  if (!wallet?.address) throw new Error("Wallet not found");
  const sender = wallet.address as `0x${string}`;
  console.log("  Sender:     ", sender);
  console.log("  Recipient:  ", RECIPIENT);
  console.log("  Amount:      1 USDC");

  // Balances before
  const [balBefore, recipBalBefore] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [sender] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [RECIPIENT] }),
  ]);
  console.log("\n── Balances Before ──");
  console.log("  Sender USDC:    ", Number(balBefore) / 1e6, "USDC");
  console.log("  Recipient USDC: ", Number(recipBalBefore) / 1e6, "USDC");

  // Use createTransaction — Circle signs + broadcasts on Arc Testnet natively
  console.log("\n── Submitting 1 USDC transfer via Circle ──");
  const txRes = await client.createTransaction({
    walletId: WALLET_ID,
    blockchain: "ARC-TESTNET",
    tokenAddress: USDC,
    destinationAddress: RECIPIENT,
    amounts: ["1"],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const txId = txRes.data?.id;
  if (!txId) throw new Error("No transaction ID returned");
  console.log("  Transaction ID: ", txId);

  console.log("\n── Polling for confirmation ──");
  const txHash = await waitForTx(txId, "USDC transfer");
  console.log("  Tx Hash:  ", txHash);
  console.log("  Explorer: ", `${arcTestnet.blockExplorers.default.url}/tx/${txHash}`);

  // Fetch full tx details for signature + raw data
  const txDetail = await client.getTransaction({ id: txId });
  const txData = txDetail.data?.transaction;
  console.log("\n── Transaction Details ──");
  console.log("  State:      ", txData?.state);
  console.log("  Tx Hash:    ", txData?.txHash);
  console.log("  Network Fee:", txData?.networkFee ?? "N/A");
  console.log("\n── Raw Transaction Object ──");
  console.log(JSON.stringify(txData, null, 2));

  // Receipt from chain
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  console.log("\n── On-chain Receipt ──");
  console.log("  Status:   ", receipt.status === "success" ? "✓ success" : "✗ reverted");
  console.log("  Block:    ", receipt.blockNumber.toString());
  console.log("  Gas Used: ", receipt.gasUsed.toString());

  // Balances after
  const [balAfter, recipBalAfter] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [sender] }),
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [RECIPIENT] }),
  ]);
  console.log("\n── Balances After ──");
  console.log("  Sender USDC:    ", Number(balAfter) / 1e6, "USDC");
  console.log("  Recipient USDC: ", Number(recipBalAfter) / 1e6, "USDC");
  console.log("\n  Δ Sender:    -", (Number(balBefore) - Number(balAfter)) / 1e6, "USDC");
  console.log("  Δ Recipient: +", (Number(recipBalAfter) - Number(recipBalBefore)) / 1e6, "USDC");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
