import { getCircleClient, pollTransaction, extractJobId, AGENTIC_COMMERCE_CONTRACT, publicClient } from "@/lib/circle";

export async function POST(request: Request) {
  try {
    const { clientWalletAddress, providerWalletAddress, description } = await request.json();
    const client = getCircleClient();

    const block = await publicClient.getBlock();
    const expiredAt = (block.timestamp + BigInt(3600)).toString();

    const txRes = await client.createContractExecutionTransaction({
      walletAddress: clientWalletAddress,
      blockchain: "ARC-TESTNET",
      contractAddress: AGENTIC_COMMERCE_CONTRACT,
      abiFunctionSignature: "createJob(address,address,uint256,string,address)",
      abiParameters: [
        providerWalletAddress,
        clientWalletAddress, // evaluator = client
        expiredAt,
        description,
        "0x0000000000000000000000000000000000000000",
      ],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    });

    const txId = txRes.data?.id;
    if (!txId) throw new Error("No transaction ID");

    const { txHash } = await pollTransaction(txId);
    const jobId = await extractJobId(txHash as `0x${string}`);

    return Response.json({ txId, txHash, jobId: jobId.toString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
