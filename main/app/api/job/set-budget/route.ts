import { getCircleClient, pollTransaction, AGENTIC_COMMERCE_CONTRACT, JOB_BUDGET_RAW } from "@/lib/circle";

export async function POST(request: Request) {
  try {
    const { providerWalletAddress, jobId } = await request.json();
    const client = getCircleClient();

    const txRes = await client.createContractExecutionTransaction({
      walletAddress: providerWalletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress: AGENTIC_COMMERCE_CONTRACT,
      abiFunctionSignature: "setBudget(uint256,uint256,bytes)",
      abiParameters: [jobId, JOB_BUDGET_RAW.toString(), "0x"],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const txId = txRes.data?.id;
    if (!txId) throw new Error("No transaction ID");

    const { txHash } = await pollTransaction(txId);
    return Response.json({ txId, txHash });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
