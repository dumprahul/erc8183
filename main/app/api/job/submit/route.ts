import { getCircleClient, pollTransaction, AGENTIC_COMMERCE_CONTRACT } from "@/lib/circle";
import { keccak256, toHex } from "viem";

export async function POST(request: Request) {
  try {
    const { providerWalletAddress, jobId, deliverable } = await request.json();
    const client = getCircleClient();

    const deliverableHash = keccak256(toHex(deliverable as string));

    const txRes = await client.createContractExecutionTransaction({
      walletAddress: providerWalletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress: AGENTIC_COMMERCE_CONTRACT,
      abiFunctionSignature: "submit(uint256,bytes32,bytes)",
      abiParameters: [jobId, deliverableHash, "0x"],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const txId = txRes.data?.id;
    if (!txId) throw new Error("No transaction ID");

    const { txHash } = await pollTransaction(txId);
    return Response.json({ txId, txHash, deliverableHash });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
