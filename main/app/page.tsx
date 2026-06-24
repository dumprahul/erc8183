"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Wallet = { id: string; address: string };

type StepStatus = "idle" | "loading" | "done" | "error";

type Step = {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  txHash?: string;
  detail?: string;
};

type JobState = {
  walletSetId: string;
  clientWallet: Wallet;
  providerWallet: Wallet;
  jobId: string;
  deliverableHash?: string;
  jobStatus?: string;
  clientBalance?: string;
  providerBalance?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const ARCSCAN = "https://testnet.arcscan.app";

const INITIAL_STEPS: Step[] = [
  { id: "setup",      label: "Create Wallets",       description: "Spin up client + provider wallets via Circle",     status: "idle" },
  { id: "fund",       label: "Fund Client Wallet",    description: "Add USDC from the Arc Testnet faucet",             status: "idle" },
  { id: "createJob",  label: "Create Job",            description: "Post the job on-chain via createJob()",            status: "idle" },
  { id: "setBudget",  label: "Set Budget",            description: "Provider sets the 5 USDC price via setBudget()",   status: "idle" },
  { id: "fundEscrow", label: "Fund Escrow",           description: "Client approves + deposits USDC into escrow",      status: "idle" },
  { id: "submit",     label: "Submit Deliverable",    description: "Provider submits keccak256 hash of work",          status: "idle" },
  { id: "complete",   label: "Complete Job",          description: "Evaluator approves and releases payment",          status: "idle" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

// ── Components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; className: string }> = {
    idle:    { label: "Pending",  className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
    loading: { label: "Running…", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse" },
    done:    { label: "Done",     className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    error:   { label: "Error",    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  };
  const { label, className } = map[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      step.status === "loading" ? "border-blue-400 dark:border-blue-500 shadow-sm" :
      step.status === "done"    ? "border-green-300 dark:border-green-700" :
      step.status === "error"   ? "border-red-300 dark:border-red-700" :
      "border-zinc-200 dark:border-zinc-800"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            step.status === "done"    ? "bg-green-500 text-white" :
            step.status === "loading" ? "bg-blue-500 text-white" :
            step.status === "error"   ? "bg-red-500 text-white" :
            "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          }`}>
            {step.status === "done" ? "✓" : step.status === "error" ? "✗" : index + 1}
          </span>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{step.label}</p>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{step.description}</p>
            {step.detail && (
              <p className="mt-1 text-xs font-mono text-zinc-600 dark:text-zinc-300">{step.detail}</p>
            )}
            {step.txHash && (
              <a
                href={`${ARCSCAN}/tx/${step.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                {shortHash(step.txHash)} ↗
              </a>
            )}
          </div>
        </div>
        <StatusBadge status={step.status} />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [jobState, setJobState] = useState<Partial<JobState>>({});
  const [description, setDescription] = useState("Build a decentralized payment demo on Arc Testnet");
  const [deliverable, setDeliverable] = useState("arc-erc8183-demo-deliverable");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "setup" | "waitFund" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function post<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? "Request failed");
    return data as T;
  }

  // Phase 1: create wallets
  async function handleSetup() {
    setRunning(true);
    setError(null);
    setPhase("setup");
    updateStep("setup", { status: "loading" });
    try {
      const data = await post<{ walletSetId: string; clientWallet: Wallet; providerWallet: Wallet }>("/api/setup");
      setJobState((s) => ({ ...s, ...data }));
      updateStep("setup", {
        status: "done",
        detail: `Client: ${shortAddr(data.clientWallet.address)} | Provider: ${shortAddr(data.providerWallet.address)}`,
      });
      setPhase("waitFund");
    } catch (e) {
      updateStep("setup", { status: "error" });
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  }

  // Phase 2: mark funded, then run full lifecycle
  async function handleRunLifecycle() {
    if (!jobState.clientWallet || !jobState.providerWallet) return;
    setRunning(true);
    setError(null);
    setPhase("running");
    updateStep("fund", { status: "done", detail: "Manually funded via faucet" });

    try {
      // createJob
      updateStep("createJob", { status: "loading" });
      const job = await post<{ txHash: string; jobId: string }>("/api/job/create", {
        clientWalletAddress: jobState.clientWallet.address,
        providerWalletAddress: jobState.providerWallet.address,
        description,
      });
      setJobState((s) => ({ ...s, jobId: job.jobId }));
      updateStep("createJob", { status: "done", txHash: job.txHash, detail: `Job ID: ${job.jobId}` });

      // setBudget
      updateStep("setBudget", { status: "loading" });
      const budget = await post<{ txHash: string }>("/api/job/set-budget", {
        providerWalletAddress: jobState.providerWallet.address,
        jobId: job.jobId,
      });
      updateStep("setBudget", { status: "done", txHash: budget.txHash, detail: "Budget: 5 USDC" });

      // fund escrow
      updateStep("fundEscrow", { status: "loading" });
      const fund = await post<{ approveTxHash: string; fundTxHash: string }>("/api/job/fund", {
        clientWalletAddress: jobState.clientWallet.address,
        jobId: job.jobId,
      });
      updateStep("fundEscrow", { status: "done", txHash: fund.fundTxHash, detail: "5 USDC locked in escrow" });

      // submit deliverable
      updateStep("submit", { status: "loading" });
      const submit = await post<{ txHash: string; deliverableHash: string }>("/api/job/submit", {
        providerWalletAddress: jobState.providerWallet.address,
        jobId: job.jobId,
        deliverable,
      });
      setJobState((s) => ({ ...s, deliverableHash: submit.deliverableHash }));
      updateStep("submit", { status: "done", txHash: submit.txHash, detail: `Hash: ${shortHash(submit.deliverableHash)}` });

      // complete
      updateStep("complete", { status: "loading" });
      const complete = await post<{ txHash: string }>("/api/job/complete", {
        clientWalletAddress: jobState.clientWallet.address,
        jobId: job.jobId,
      });
      updateStep("complete", { status: "done", txHash: complete.txHash });

      // fetch final state
      const status = await fetch(
        `/api/job/status?jobId=${job.jobId}&clientAddress=${jobState.clientWallet.address}&providerAddress=${jobState.providerWallet.address}`
      ).then((r) => r.json());

      setJobState((s) => ({
        ...s,
        jobStatus: status.statusName,
        clientBalance: status.balances?.client,
        providerBalance: status.balances?.provider,
      }));

      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setSteps(INITIAL_STEPS);
    setJobState({});
    setPhase("idle");
    setError(null);
    setRunning(false);
  }

  const allDone = phase === "done";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="mx-auto max-w-2xl px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-md bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white uppercase tracking-wide">Arc Testnet</span>
            <span className="rounded-md bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">ERC-8183</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Agentic Commerce Job</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Full ERC-8183 lifecycle — client, provider, and evaluator — powered by Circle dev-controlled wallets on Arc Testnet.
          </p>
        </div>

        {/* Config */}
        {phase === "idle" && (
          <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Job Configuration</h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Job Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Deliverable Text <span className="text-zinc-400 font-normal">(will be keccak256 hashed)</span>
              </label>
              <input
                type="text"
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSetup}
              disabled={running}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Create Wallets
            </button>
          </div>
        )}

        {/* Wallet info + fund prompt */}
        {phase === "waitFund" && jobState.clientWallet && (
          <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Fund the Client Wallet with Testnet USDC</h2>
            <div className="space-y-1">
              <p className="text-xs text-amber-700 dark:text-amber-400">Client Wallet Address (copy this):</p>
              <p className="rounded-md bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all select-all">
                {jobState.clientWallet.address}
              </p>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Go to{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                faucet.circle.com
              </a>{" "}
              or{" "}
              <a href="https://console.circle.com/faucet" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                console.circle.com/faucet
              </a>
              , paste the address above, and request at least <strong>10 USDC</strong> on Arc Testnet.
            </p>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                Job Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="block text-sm font-medium text-amber-800 dark:text-amber-300">
                Deliverable Text
              </label>
              <input
                type="text"
                value={deliverable}
                onChange={(e) => setDeliverable(e.target.value)}
                className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleRunLifecycle}
              disabled={running}
              className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Wallet is funded — Run Full Lifecycle
            </button>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Final result */}
        {allDone && (
          <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎉</span>
              <h2 className="font-semibold text-green-800 dark:text-green-300">Job Completed!</h2>
              <span className="rounded-full bg-green-200 dark:bg-green-800 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">
                {jobState.jobStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Job ID</p>
                <p className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{jobState.jobId}</p>
              </div>
              <div className="rounded-lg bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Budget</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">5 USDC</p>
              </div>
              <div className="rounded-lg bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Client Balance</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{jobState.clientBalance ?? "—"} USDC</p>
              </div>
              <div className="rounded-lg bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Provider Balance</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{jobState.providerBalance ?? "—"} USDC</p>
              </div>
            </div>
            {jobState.clientWallet && (
              <a
                href={`${ARCSCAN}/address/${jobState.clientWallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View on Arcscan ↗
              </a>
            )}
            <button
              onClick={reset}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Run Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
