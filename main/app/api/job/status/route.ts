import { publicClient, agenticCommerceAbi, AGENTIC_COMMERCE_CONTRACT, USDC_CONTRACT, STATUS_NAMES } from "@/lib/circle";
import { formatUnits } from "viem";

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const clientAddress = searchParams.get("clientAddress");
    const providerAddress = searchParams.get("providerAddress");

    if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

    const job = await publicClient.readContract({
      address: AGENTIC_COMMERCE_CONTRACT,
      abi: agenticCommerceAbi,
      functionName: "getJob",
      args: [BigInt(jobId)],
    });

    const balances: Record<string, string> = {};
    if (clientAddress) {
      const bal = await publicClient.readContract({
        address: USDC_CONTRACT,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [clientAddress as `0x${string}`],
      });
      balances.client = formatUnits(bal, 6);
    }
    if (providerAddress) {
      const bal = await publicClient.readContract({
        address: USDC_CONTRACT,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [providerAddress as `0x${string}`],
      });
      balances.provider = formatUnits(bal, 6);
    }

    return Response.json({
      id: job.id.toString(),
      client: job.client,
      provider: job.provider,
      evaluator: job.evaluator,
      description: job.description,
      budget: formatUnits(job.budget, 6),
      expiredAt: job.expiredAt.toString(),
      status: Number(job.status),
      statusName: STATUS_NAMES[Number(job.status)] ?? "Unknown",
      balances,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
