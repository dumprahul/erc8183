import { getCircleClient, pollTransaction, AGENTIC_COMMERCE_CONTRACT, USDC_CONTRACT, JOB_BUDGET_RAW } from "@/lib/circle";

export async function POST(request: Request) {
  try {
    const { clientWalletAddress, jobId } = await request.json();
    const client = getCircleClient();

    // Step 1: approve USDC spending
    const approveTx = await client.createContractExecutionTransaction({
      walletAddress: clientWalletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress: USDC_CONTRACT,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [AGENTIC_COMMERCE_CONTRACT, JOB_BUDGET_RAW.toString()],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    const approveId = approveTx.data?.id;
    if (!approveId) throw new Error("Approve tx failed");
    const approve = await pollTransaction(approveId);

    // Step 2: fund escrow
    const fundTx = await client.createContractExecutionTransaction({
      walletAddress: clientWalletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress: AGENTIC_COMMERCE_CONTRACT,
      abiFunctionSignature: "fund(uint256,bytes)",
      abiParameters: [jobId, "0x"],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });
    const fundId = fundTx.data?.id;
    if (!fundId) throw new Error("Fund tx failed");
    const fund = await pollTransaction(fundId);

    return Response.json({
      approveTxHash: approve.txHash,
      fundTxHash: fund.txHash,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
