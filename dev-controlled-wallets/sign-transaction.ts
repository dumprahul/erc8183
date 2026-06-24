import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseGwei,
  parseUnits,
  toHex,
} from "viem";
import { arcTestnet } from "viem/chains";

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

const WALLET_ID   = process.env.WALLET_ID ?? "";
const USDC        = "0x3600000000000000000000000000000000000000" as const;
const RECIPIENT   = "0x0612D26676869aFcF8BCfdcC55Bd62a307fBF4b5" as const;
const AMOUNT      = parseUnits("1", 6); // 1 USDC — 6 decimals

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to",     type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  if (!WALLET_ID) {
    throw new Error("Set WALLET_ID in your .env (must be an EOA wallet)");
  }

  // Fetch sender wallet
  console.log("── Fetching wallet ──");
  const walletRes = await client.getWallet({ id: WALLET_ID });
  const wallet = walletRes.data?.wallet;
  if (!wallet?.address) throw new Error("Wallet not found");
  const sender = wallet.address as `0x${string}`;
  console.log("  Sender:     ", sender);
  console.log("  Recipient:  ", RECIPIENT);
  console.log("  Amount:     1 USDC");

  // Check sender USDC balance before
  const balanceBefore = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [sender],
  });
  console.log("\n── Balances Before ──");
  console.log("  Sender USDC:    ", Number(balanceBefore) / 1e6, "USDC");

  // Fetch nonce + fee data
  console.log("\n── Fetching on-chain data ──");
  const [nonce, feeData] = await Promise.all([
    publicClient.getTransactionCount({ address: sender }),
    publicClient.estimateFeesPerGas(),
  ]);
  console.log("  Nonce:              ", nonce);
  console.log("  MaxFeePerGas:       ", feeData.maxFeePerGas?.toString(), "wei");
  console.log("  MaxPriorityFeeGas:  ", feeData.maxPriorityFeePerGas?.toString(), "wei");

  // Encode ERC-20 transfer(to, amount) calldata
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [RECIPIENT, AMOUNT],
  });

  // Estimate gas for the token transfer
  const gasEstimate = await publicClient.estimateGas({
    account: sender,
    to: USDC,
    data,
  });
  console.log("  Gas Estimate:       ", gasEstimate.toString());

  // Build EIP-1559 transaction targeting the USDC contract
  const transaction = {
    chainId: toHex(arcTestnet.id),
    nonce: toHex(nonce),
    to: USDC,
    value: toHex(0),
    gas: toHex((gasEstimate * 120n) / 100n), // +20% buffer
    maxFeePerGas: toHex(feeData.maxFeePerGas ?? parseGwei("1")),
    maxPriorityFeePerGas: toHex(feeData.maxPriorityFeePerGas ?? parseGwei("1")),
    data,
  };

  console.log("\n── Transaction to sign ──");
  console.log(JSON.stringify(transaction, null, 2));

  // Sign via Circle HSM — private key never leaves Circle
  console.log("\n── Signing transaction ──");
  const signRes = await client.signTransaction({
    walletId: WALLET_ID,
    transaction: JSON.stringify(transaction),
  });

  const result = signRes.data;

  console.log("\n── Signature Results ──");
  console.log("  Signature:          ", result?.signature);
  console.log("  Signed Transaction: ", result?.signedTransaction);
  console.log("  Tx Hash:            ", result?.txHash ?? "(broadcast manually to get hash)");

  console.log("\n── Raw Result Object ──");
  console.log(JSON.stringify(result, null, 2));

  // Broadcast if we have the signed tx
  if (result?.signedTransaction) {
    console.log("\n── Broadcasting transaction ──");
    const txHash = await publicClient.sendRawTransaction({
      serializedTransaction: result.signedTransaction as `0x${string}`,
    });
    console.log("  Tx Hash:  ", txHash);
    console.log("  Explorer: ", `${arcTestnet.blockExplorers.default.url}/tx/${txHash}`);

    console.log("\n  Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("  Status:   ", receipt.status === "success" ? "✓ success" : "✗ reverted");
    console.log("  Block:    ", receipt.blockNumber.toString());
    console.log("  Gas Used: ", receipt.gasUsed.toString());

    // Check balances after
    const [balAfterSender, balAfterRecipient] = await Promise.all([
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [sender] }),
      publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [RECIPIENT] }),
    ]);
    console.log("\n── Balances After ──");
    console.log("  Sender USDC:    ", Number(balAfterSender) / 1e6, "USDC");
    console.log("  Recipient USDC: ", Number(balAfterRecipient) / 1e6, "USDC");
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
