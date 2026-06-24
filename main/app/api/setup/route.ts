import { getCircleClient } from "@/lib/circle";

export async function POST() {
  try {
    const client = getCircleClient();

    const walletSetRes = await client.createWalletSet({
      name: `ERC8183-${Date.now()}`,
    });
    const walletSetId = walletSetRes.data?.walletSet?.id;
    if (!walletSetId) throw new Error("Wallet set creation failed");

    const walletsRes = await client.createWallets({
      blockchains: ["ARC-TESTNET"],
      count: 2,
      walletSetId,
      accountType: "SCA",
    });

    const wallets = walletsRes.data?.wallets;
    if (!wallets || wallets.length < 2) throw new Error("Wallet creation failed");

    const client_wallet = wallets[0]!;
    const provider_wallet = wallets[1]!;

    return Response.json({
      walletSetId,
      clientWallet: { id: client_wallet.id, address: client_wallet.address },
      providerWallet: { id: provider_wallet.id, address: provider_wallet.address },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
