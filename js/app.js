let provider;
let signer;
let nftContract;
let governorContract;
let currentAccount = "";
let requiredDepositEth = "0.1";
const proposalCache = new Map();
let currentChainId = "";
let toastSequence = 0;
const HARDHAT_CHAIN_ID_HEX = "0x539";
const HARDHAT_NETWORK_PARAMS = {
    chainId: HARDHAT_CHAIN_ID_HEX,
    chainName: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18
    }
};

function normalizeTargets(arr) {
    return Array.from(arr || []).map((v) => ethers.getAddress(String(v)));
}

function normalizeValues(arr) {
    return Array.from(arr || []).map((v) => BigInt(v.toString()));
}

function normalizeCalldatas(arr) {
    return Array.from(arr || []).map((v) => {
        try {
            return ethers.hexlify(v);
        } catch (_err) {
            return String(v);
        }
    });
}

function tryDecodeProposalTx(txData) {
    if (!txData || !governorContract) return null;
    try {
        const iface = governorContract.interface;
        const selector = String(txData).slice(0, 10).toLowerCase();
        const proposeWithDeposit = iface.getFunction("proposeWithDeposit");
        const propose = iface.getFunction("propose");

        if (proposeWithDeposit && selector === proposeWithDeposit.selector.toLowerCase()) {
            const d = iface.decodeFunctionData(proposeWithDeposit, txData);
            return {
                targets: normalizeTargets(d[0] ?? []),
                values: normalizeValues(d[1] ?? []),
                calldatas: normalizeCalldatas(d[2] ?? []),
                description: String(d[3] ?? "")
            };
        }
        if (propose && selector === propose.selector.toLowerCase()) {
            const d = iface.decodeFunctionData(propose, txData);
            return {
                targets: normalizeTargets(d[0] ?? []),
                values: normalizeValues(d[1] ?? []),
                calldatas: normalizeCalldatas(d[2] ?? []),
                description: String(d[3] ?? "")
            };
        }
    } catch (_err) {
        return null;
    }
    return null;
}

async function resolveProposalParamsById(proposalId) {
    if (!governorContract || !provider) return null;
    const events = await governorContract.queryFilter(
        governorContract.filters.ProposalCreated(),
        0,
        "latest"
    );
    const matched = events.find((ev) => {
        const id = ev.args?.proposalId ?? ev.args?.[0];
        return id && id.toString() === proposalId.toString();
    });
    if (!matched) return null;

    const a = matched.args;
    let targets = normalizeTargets(a?.[2] ?? []);
    let values = normalizeValues(a?.[3] ?? []);
    let calldatas = normalizeCalldatas(a?.[5] ?? []);
    let description = String(a?.[8] ?? "");

    // If event decoding is incomplete, decode from original tx input.
    const eventLooksIncomplete =
        !targets.length || !values.length || !calldatas.length || !description.trim();
    if (eventLooksIncomplete) {
        try {
            const tx = await provider.getTransaction(matched.transactionHash);
            const decoded = tryDecodeProposalTx(tx?.data);
            if (decoded) {
                targets = decoded.targets;
                values = decoded.values;
                calldatas = decoded.calldatas;
                description = decoded.description;
            }
        } catch (_err) {
            // Keep event data fallback
        }
    }

    return { targets, values, calldatas, description };
}

const STATUS_CLASS_MAP = {
    info: "alert-info",
    success: "alert-success",
    warning: "alert-warning",
    error: "alert-error"
};

function shortAddr(addr) {
    if (!addr || addr.length < 10) return addr || "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function stateText(state) {
    const map = {
        0: "Pending",
        1: "Active",
        2: "Canceled",
        3: "Defeated",
        4: "Succeeded",
        5: "Queued",
        6: "Expired",
        7: "Executed"
    };
    return map[Number(state)] ?? `Unknown(${state})`;
}

function stateBadgeClass(state) {
    const map = {
        0: "badge-warning",
        1: "badge-info",
        2: "badge-ghost",
        3: "badge-error",
        4: "badge-success",
        5: "badge-accent",
        6: "badge-ghost",
        7: "badge-success"
    };
    return map[Number(state)] ?? "badge-outline";
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getErrorMessage(err, fallback) {
    const rawData = typeof err?.data === "string" ? err.data : (typeof err?.error?.data === "string" ? err.error.data : "");
    const selector = rawData && rawData.length >= 10 ? rawData.slice(0, 10) : "";
    const selectorMap = {
        "0x71c6af49": "You already voted on this proposal.",
        "0x31b75e4d": "Invalid proposal state for this action.",
        "0x6ad06075": "Proposal parameters do not match any on-chain proposal.",
        "0x7e2d1d8f": "Voting is not active yet.",
        "0x4f9d9c71": "Proposal is not successful, cannot execute."
    };

    if (selector && selectorMap[selector]) return selectorMap[selector];
    if (err?.code === 4001) return "You rejected the request in MetaMask.";
    if (err?.reason) return err.reason;
    if (err?.shortMessage) return err.shortMessage;
    if (err?.message) return err.message;
    return fallback;
}

function setGlobalStatus(message, type = "info") {
    const statusEl = document.getElementById("globalStatus");
    if (!statusEl) return;

    statusEl.className = `alert text-sm ${STATUS_CLASS_MAP[type] || STATUS_CLASS_MAP.info}`;
    statusEl.innerHTML = `<span>${escapeHtml(message)}</span>`;
}

function showToast(message, type = "info", timeoutMs = 4200) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    const toastId = `toast-${++toastSequence}`;
    const borderColor = {
        success: "border-emerald-400/30",
        warning: "border-amber-400/30",
        error: "border-rose-400/30",
        info: "border-sky-400/30"
    }[type] || "border-sky-400/30";

    toast.id = toastId;
    toast.className = `toast-item alert ${STATUS_CLASS_MAP[type] || STATUS_CLASS_MAP.info} ${borderColor} shadow-2xl shadow-slate-950/40 border bg-slate-950/90 text-slate-100`;
    toast.innerHTML = `
        <div class="flex items-start justify-between gap-3 w-full">
            <div class="space-y-0.5">
                <div class="text-xs uppercase tracking-[0.18em] text-slate-300/70">${escapeHtml(type)}</div>
                <div class="text-sm font-medium text-slate-50">${escapeHtml(message)}</div>
            </div>
            <button class="btn btn-ghost btn-xs text-slate-200 hover:bg-white/10">Dismiss</button>
        </div>
    `;

    const closeBtn = toast.querySelector("button");
    const removeToast = () => {
        if (toast.dataset.state === "leave") return;
        toast.dataset.state = "leave";
        window.setTimeout(() => toast.remove(), 220);
    };

    closeBtn.addEventListener("click", removeToast);
    container.appendChild(toast);

    if (timeoutMs > 0) {
        window.setTimeout(removeToast, timeoutMs);
    }
}

function setText(id, text, extraClass = "") {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = extraClass || el.className;
    el.textContent = text;
}

function setButtonLoading(buttonId, loading, loadingText, defaultText) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (!btn.dataset.defaultText) {
        btn.dataset.defaultText = defaultText || btn.textContent.trim();
    }

    if (loading) {
        btn.disabled = true;
        btn.classList.add("loading");
        btn.textContent = loadingText;
    } else {
        btn.disabled = false;
        btn.classList.remove("loading");
        btn.textContent = btn.dataset.defaultText;
    }
}

function setConnectedUI(connected) {
    const connectBtn = document.getElementById("connectBtn");
    const switchAccountBtn = document.getElementById("switchAccountBtn");
    const stateBadge = document.getElementById("walletConnectionState");
    const walletAddressEl = document.getElementById("walletAddress");
    const mintBtn = document.getElementById("mintBtn");
    const proposeBtn = document.getElementById("proposeBtn");
    const donateBtn = document.getElementById("donateBtn");

    if (!connectBtn || !stateBadge || !walletAddressEl || !mintBtn || !proposeBtn || !donateBtn) return;

    if (connected) {
        connectBtn.textContent = "Connected";
        connectBtn.classList.remove("btn-outline");
        connectBtn.classList.add("btn-success");

        if (switchAccountBtn) {
            switchAccountBtn.textContent = "Disconnect";
            switchAccountBtn.disabled = false;
        }

        stateBadge.textContent = "Connected";
        stateBadge.className = "badge badge-outline badge-success";

        walletAddressEl.textContent = shortAddr(currentAccount);
        walletAddressEl.title = currentAccount;

        mintBtn.disabled = false;
        proposeBtn.disabled = false;
        donateBtn.disabled = false;
    } else {
        proposalCache.clear();
        connectBtn.textContent = "Connect Wallet";
        connectBtn.classList.remove("btn-success");
        connectBtn.classList.add("btn-outline");

        if (switchAccountBtn) {
            switchAccountBtn.textContent = "Disconnect";
            switchAccountBtn.disabled = true;
        }

        stateBadge.textContent = "Disconnected";
        stateBadge.className = "badge badge-outline badge-warning";

        walletAddressEl.textContent = "Not connected";
        walletAddressEl.removeAttribute("title");

        mintBtn.disabled = true;
        proposeBtn.disabled = true;
        donateBtn.disabled = true;
        document.getElementById("treasuryBalance").textContent = "0.00 ETH";
        document.getElementById("votingPeriodDisplay").textContent = "Loading...";
        document.getElementById("quorumDisplay").textContent = "Quorum: Loading...";
        document.getElementById("depositDisplay").textContent = "Loading...";
        document.getElementById("votingDelayDisplay").textContent = "Loading...";
        document.getElementById("supermajorityDisplay").textContent = "Loading...";
        document.getElementById("proposalList").innerHTML = `<div class="alert alert-info shadow-sm bg-slate-950/50 border border-white/10 text-slate-100"><span>Please connect wallet to load proposals.</span></div>`;
        setText("networkInfo", "Network: Not connected", "text-xs text-slate-300/70");
    }
}

async function refreshTreasuryBalance() {
    if (!provider) return;

    const balanceInWei = await provider.getBalance(CONTRACT_ADDRESSES.governor);
    document.getElementById("treasuryBalance").textContent = `${parseFloat(ethers.formatEther(balanceInWei)).toFixed(4)} ETH`;
}

function formatBlocks(blocks) {
    const numeric = Number(blocks || 0);
    if (!Number.isFinite(numeric)) return String(blocks);
    const minutes = Math.max(1, Math.round((numeric * 12) / 60));
    const hours = (minutes / 60).toFixed(minutes >= 120 ? 1 : 0);
    return `${numeric} blocks (${hours}h)`;
}

function isLocalHardhatChain() {
    return currentChainId === "1337" || currentChainId === "31337";
}

async function advanceLocalBlock() {
    if (!provider || typeof provider.send !== "function") {
        throw new Error("Local block mining is not available in the current wallet connection.");
    }

    await provider.send("evm_mine", []);
}

async function refreshGovernanceSnapshot() {
    if (!governorContract) return;

    try {
        const depositWei = typeof governorContract.proposalDeposit === "function"
            ? await governorContract.proposalDeposit()
            : 0n;
        const votingDelayBlocks = typeof governorContract.votingDelay === "function"
            ? await governorContract.votingDelay()
            : 0n;
        const votingPeriodBlocks = typeof governorContract.votingPeriod === "function"
            ? await governorContract.votingPeriod()
            : 0n;

        let quorumText = "Unavailable";
        if (typeof governorContract.quorum === "function") {
            try {
                const currentBlock = await provider.getBlockNumber();
                const quorumWei = await governorContract.quorum(currentBlock);
                quorumText = `${quorumWei.toString()} votes required`;
            } catch (quorumErr) {
                console.warn("quorum read failed:", quorumErr);
            }
        }

        document.getElementById("depositDisplay").textContent = `${ethers.formatEther(depositWei)} ETH`;
        document.getElementById("votingDelayDisplay").textContent = formatBlocks(votingDelayBlocks);
        document.getElementById("votingPeriodDisplay").textContent = formatBlocks(votingPeriodBlocks);
        document.getElementById("quorumDisplay").textContent = `Quorum: ${quorumText}`;
        document.getElementById("supermajorityDisplay").textContent = "66.6% yes-vote threshold";

        requiredDepositEth = ethers.formatEther(depositWei);
        const proposeBtn = document.getElementById("proposeBtn");
        if (proposeBtn) {
            proposeBtn.dataset.defaultText = `Pay ${requiredDepositEth} ETH & Submit Proposal`;
            proposeBtn.textContent = proposeBtn.dataset.defaultText;
        }
    } catch (err) {
        console.error("refreshGovernanceSnapshot error:", err);
        showToast(getErrorMessage(err, "Failed to load governance snapshot."), "warning");
    }
}

async function refreshDashboard() {
    await Promise.allSettled([
        refreshTreasuryBalance(),
        loadProposals(),
        refreshGovernanceSnapshot()
    ]);
}

async function verifyContractDeployment() {
    if (!provider) return;
    const network = await provider.getNetwork();
    const governorCode = await provider.getCode(CONTRACT_ADDRESSES.governor);
    const nftCode = await provider.getCode(CONTRACT_ADDRESSES.nft);

    if (governorCode === "0x") {
        throw new Error(
            `Governor contract not found at ${CONTRACT_ADDRESSES.governor} on chain ${network.chainId}. Please redeploy and update js/config.js.`
        );
    }
    if (nftCode === "0x") {
        throw new Error(
            `NFT contract not found at ${CONTRACT_ADDRESSES.nft} on chain ${network.chainId}. Please redeploy and update js/config.js.`
        );
    }
}

async function ensureLocalNetwork() {
    if (!window.ethereum) {
        throw new Error("MetaMask is not detected. Please install MetaMask first.");
    }

    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId === HARDHAT_CHAIN_ID_HEX) {
        return chainId;
    }

    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: HARDHAT_CHAIN_ID_HEX }]
        });
    } catch (err) {
        if (err?.code !== 4902) {
            throw err;
        }

        await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [HARDHAT_NETWORK_PARAMS]
        });
    }

    return window.ethereum.request({ method: "eth_chainId" });
}

async function connectWallet() {
    if (!window.ethereum) {
        setGlobalStatus("MetaMask is not detected. Please install MetaMask first.", "error");
        return;
    }

    setButtonLoading("connectBtn", true, "Connecting...", "Connect Wallet");
    try {
        setGlobalStatus("Checking MetaMask network...", "info");
        const ensuredChainId = await ensureLocalNetwork();
        if (ensuredChainId !== HARDHAT_CHAIN_ID_HEX) {
            throw new Error("Please switch MetaMask to Hardhat Local (Chain ID 1337).");
        }

        setGlobalStatus("Requesting wallet access...", "info");
        await window.ethereum.request({ method: "eth_requestAccounts" });
        await initializeConnectedAccount();

        showToast(`Connected as ${shortAddr(currentAccount)}`, "success");
        await refreshDashboard();
    } catch (err) {
        const msg = getErrorMessage(err, "Connection failed.");
        setGlobalStatus(`Wallet connection failed: ${msg}`, "error");
        showToast(msg, "error");
        currentAccount = "";
        setConnectedUI(false);
    } finally {
        setButtonLoading("connectBtn", false, "", "Connect Wallet");
        if (currentAccount && governorContract) {
            setConnectedUI(true);
        }
    }
}

async function initializeConnectedAccount() {
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    currentAccount = await signer.getAddress();
    const network = await provider.getNetwork();
    currentChainId = network.chainId.toString();
    await verifyContractDeployment();

    nftContract = new ethers.Contract(CONTRACT_ADDRESSES.nft, CONTRACT_ABIS.nft, signer);
    governorContract = new ethers.Contract(CONTRACT_ADDRESSES.governor, CONTRACT_ABIS.governor, signer);

    if (typeof governorContract.proposalDeposit === "function") {
        const depositWei = await governorContract.proposalDeposit();
        requiredDepositEth = ethers.formatEther(depositWei);
        const proposeBtn = document.getElementById("proposeBtn");
        if (proposeBtn) {
            proposeBtn.dataset.defaultText = `Pay ${requiredDepositEth} ETH & Submit Proposal`;
            proposeBtn.textContent = proposeBtn.dataset.defaultText;
        }
    }

    const targetInput = document.getElementById("targetInput");
    if (targetInput && !targetInput.value.trim()) {
        targetInput.value = currentAccount;
    }

    setConnectedUI(true);
    setGlobalStatus(`Wallet connected: ${shortAddr(currentAccount)}. You can mint NFT or submit proposals now.`, "success");
    setText("status", "Ready to mint and delegate voting rights.", "text-sm mt-2 text-info");
    setText("proposeStatus", "Fill in description, target address, and amount.", "text-sm mt-2 text-slate-300/75");
    setText("networkInfo", `Network: Chain ID ${currentChainId}`, "text-xs text-slate-300/70");
}

async function loadProposals() {
    const proposalListEl = document.getElementById("proposalList");
    if (!proposalListEl || !governorContract) return;

    proposalListEl.innerHTML = `<div class="alert alert-info shadow-sm bg-slate-950/50 border border-white/10 text-slate-100"><span>Loading proposals...</span></div>`;

    try {
        const events = await governorContract.queryFilter(
            governorContract.filters.ProposalCreated(),
            0,
            "latest"
        );

        if (!events.length) {
            proposalListEl.innerHTML = `<div class="alert alert-info shadow-sm bg-slate-950/50 border border-white/10 text-slate-100"><span>No proposals yet. Submit the first one.</span></div>`;
            return;
        }

        const results = await Promise.allSettled(
            events.map(async (ev) => {
                const args = ev.args;
                const proposalIdRaw = args?.proposalId ?? args?.[0];
                const proposerRaw = args?.[1];
                const targetsRaw = args?.[2] ?? [];
                const valuesRaw = args?.[3] ?? [];
                const calldatasRaw = args?.[5] ?? [];
                const descriptionRaw = args?.[8] ?? "";

                if (proposalIdRaw === undefined || proposalIdRaw === null) {
                    throw new Error("ProposalCreated event missing proposalId.");
                }

                const eventProposalId = proposalIdRaw.toString();
                const resolved = await resolveProposalParamsById(proposalIdRaw.toString());
                const targets = resolved?.targets?.length
                    ? resolved.targets
                    : normalizeTargets(targetsRaw);
                const values = resolved?.values?.length
                    ? resolved.values
                    : normalizeValues(valuesRaw);
                const calldatas = resolved?.calldatas?.length
                    ? resolved.calldatas
                    : normalizeCalldatas(calldatasRaw);
                const description = resolved?.description?.trim()
                    ? resolved.description
                    : String(descriptionRaw || "");

                // Use event proposalId as the source of truth for reading state.
                // This avoids skipping valid historical proposals due to param-format differences.
                const proposalId = proposalIdRaw.toString();

                const state = await governorContract.state(proposalIdRaw);
                const [againstVotes, forVotes, abstainVotes] = await governorContract.proposalVotes(proposalIdRaw);
                const snapshot = await governorContract.proposalSnapshot(proposalIdRaw);
                const deadline = await governorContract.proposalDeadline(proposalIdRaw);
                let hasVoted = false;
                let deposit = 0n;
                if (typeof governorContract.deposits === "function") {
                    try {
                        deposit = await governorContract.deposits(proposalIdRaw);
                    } catch (_err) {
                        deposit = 0n;
                    }
                }

                if (currentAccount && typeof governorContract.hasVoted === "function") {
                    try {
                        hasVoted = await governorContract.hasVoted(proposalIdRaw, currentAccount);
                    } catch (_err) {
                        hasVoted = false;
                    }
                }

                const proposal = {
                    proposalId,
                    proposer: proposerRaw || ethers.ZeroAddress,
                    eventProposalId,
                    targets,
                    values,
                    calldatas,
                    description,
                    eventTargets: normalizeTargets(targetsRaw),
                    eventValues: normalizeValues(valuesRaw),
                    eventCalldatas: normalizeCalldatas(calldatasRaw),
                    eventDescription: String(descriptionRaw || ""),
                    state: Number(state),
                    againstVotes: againstVotes.toString(),
                    forVotes: forVotes.toString(),
                    abstainVotes: abstainVotes.toString(),
                    snapshot: snapshot.toString(),
                    deadline: deadline.toString(),
                    deposit: ethers.formatEther(deposit),
                    depositWei: deposit.toString(),
                    hasVoted,
                    requestedTarget: targets?.[0] || "",
                    requestedAmount: values?.[0] ? ethers.formatEther(values[0]) : "0"
                };

                proposalCache.set(proposalId, proposal);
                return proposal;
            })
        );

        const proposals = results
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value)
            .reverse();
        const failedCount = results.length - proposals.length;
        const firstReject = results.find((r) => r.status === "rejected");

        renderProposals(proposals);
        if (failedCount > 0) {
            setGlobalStatus(
                `Loaded ${proposals.length} proposals. ${failedCount} proposal record(s) were skipped. ${firstReject ? getErrorMessage(firstReject.reason, "Unknown parse error.") : ""}`,
                "warning"
            );
        }

        if (!failedCount) {
            setGlobalStatus(`Loaded ${proposals.length} proposals.`, "success");
        }
    } catch (err) {
        console.error("loadProposals error:", err);
        const msg = getErrorMessage(err, "Failed to load proposals.");
        proposalListEl.innerHTML = `<div class="alert alert-error shadow-sm"><span>Failed to load proposals: ${escapeHtml(msg)}</span></div>`;
        setGlobalStatus(`Proposal loading failed: ${msg}`, "error");
    }
}

function renderProposals(proposals) {
    const proposalListEl = document.getElementById("proposalList");
    if (!proposalListEl) return;

    if (!proposals.length) {
        proposalListEl.innerHTML = `<div class="alert alert-info shadow-sm bg-slate-950/50 border border-white/10 text-slate-100"><span>No proposals yet.</span></div>`;
        return;
    }

    proposalListEl.innerHTML = proposals.map((p) => {
        const canVote = p.state === 1;
        const canExecute = p.state === 4;
        const voteDisabled = !canVote || p.hasVoted;
        const voteButtonClass = voteDisabled ? "btn btn-sm btn-disabled opacity-60" : "btn btn-sm";
        const executeHint = canExecute
            ? "Execute is available because this proposal is already Succeeded."
            : "Execute is only available after the proposal reaches Succeeded state.";
        const canClaimRefund =
            currentAccount &&
            p.proposer.toLowerCase() === currentAccount.toLowerCase() &&
            [3, 4, 7].includes(p.state) &&
            p.depositWei !== "0";

        return `
        <div class="card glass-card border border-white/10">
            <div class="card-body gap-3">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <h3 class="card-title text-xl text-slate-100">Proposal #${p.proposalId}</h3>
                    <div class="badge ${stateBadgeClass(p.state)}">${stateText(p.state)}</div>
                </div>

                <p class="text-sm md:text-base text-slate-300/80"><span class="font-semibold text-slate-100">Proposer:</span> ${shortAddr(p.proposer)}</p>
                <p class="text-sm md:text-base text-slate-200"><span class="font-semibold text-slate-100">Description:</span> ${escapeHtml(p.description)}</p>
                <p class="text-sm md:text-base text-slate-200"><span class="font-semibold text-slate-100">Target:</span> ${shortAddr(p.requestedTarget)}</p>
                <p class="text-sm md:text-base text-slate-200"><span class="font-semibold text-slate-100">Requested Amount:</span> ${p.requestedAmount} ETH</p>
                <p class="text-sm md:text-base text-slate-200"><span class="font-semibold text-slate-100">Deposit:</span> ${p.deposit} ETH</p>
                <p class="text-sm md:text-base text-slate-200"><span class="font-semibold text-slate-100">Voting Window:</span> Block ${p.snapshot} to ${p.deadline}</p>
                <p class="text-xs text-slate-300/70">${p.hasVoted ? "This wallet has already voted on this proposal." : "Voting actions are available only while the proposal is Active."}</p>
                <p class="text-xs text-slate-300/70">${executeHint}</p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1 text-center">
                    <div class="stat bg-slate-950/50 border border-white/10 rounded-box py-3 px-2">
                        <div class="stat-title text-sm text-slate-300">For</div>
                        <div class="stat-value text-2xl text-emerald-300">${p.forVotes}</div>
                    </div>
                    <div class="stat bg-slate-950/50 border border-white/10 rounded-box py-3 px-2">
                        <div class="stat-title text-sm text-slate-300">Against</div>
                        <div class="stat-value text-2xl text-rose-300">${p.againstVotes}</div>
                    </div>
                    <div class="stat bg-slate-950/50 border border-white/10 rounded-box py-3 px-2">
                        <div class="stat-title text-sm text-slate-300">Abstain</div>
                        <div class="stat-value text-2xl text-sky-300">${p.abstainVotes}</div>
                    </div>
                </div>

                <div class="card-actions flex-wrap justify-start md:justify-end mt-2">
                    <button class="${voteDisabled ? "btn btn-sm btn-disabled opacity-60" : "btn btn-success btn-sm"}" onclick="voteProposal('${p.proposalId}', 1)" ${voteDisabled ? "disabled" : ""}>Vote For</button>
                    <button class="${voteDisabled ? "btn btn-sm btn-disabled opacity-60" : "btn btn-error btn-sm"}" onclick="voteProposal('${p.proposalId}', 0)" ${voteDisabled ? "disabled" : ""}>Vote Against</button>
                    <button class="${voteDisabled ? "btn btn-sm btn-disabled opacity-60" : "btn btn-info btn-sm"}" onclick="voteProposal('${p.proposalId}', 2)" ${voteDisabled ? "disabled" : ""}>Abstain</button>
                    <button class="btn btn-primary btn-sm" onclick="executeProposal('${p.proposalId}')" ${canExecute ? "" : "disabled"}>Execute</button>
                    <button class="btn btn-outline btn-sm" onclick="claimRefund('${p.proposalId}')" ${canClaimRefund ? "" : "disabled"}>Claim Refund</button>
                </div>
            </div>
        </div>
    `;
    }).join("");
}

function validateProposalForm() {
    const desc = document.getElementById("descInput").value.trim();
    const target = document.getElementById("targetInput").value.trim();
    const amount = document.getElementById("amountInput").value.trim();

    if (desc.length < 10) {
        return { ok: false, message: "Description should be at least 10 characters." };
    }
    if (!ethers.isAddress(target)) {
        return { ok: false, message: "Please enter a valid Ethereum address." };
    }
    if (!amount || Number(amount) <= 0) {
        return { ok: false, message: "Requested amount must be greater than 0." };
    }

    try {
        ethers.parseEther(amount);
    } catch (_err) {
        return { ok: false, message: "Invalid ETH amount format." };
    }

    return { ok: true, desc, target, amount };
}

function updateProposalFormHint() {
    if (!governorContract) return;
    const validation = validateProposalForm();
    if (!validation.ok) {
        setText("proposeStatus", validation.message, "text-sm mt-2 text-warning");
        return;
    }
    setText("proposeStatus", "Form looks good. You can submit the proposal.", "text-sm mt-2 text-success");
}

window.voteProposal = async (proposalId, support) => {
    if (!governorContract) {
        setGlobalStatus("Please connect wallet first.", "warning");
        return;
    }

    try {
        setGlobalStatus(`Submitting vote for Proposal #${proposalId}...`, "info");
        const tx = await governorContract.castVote(proposalId, support);
        await tx.wait();

        setGlobalStatus(`Vote submitted for Proposal #${proposalId}.`, "success");
        showToast(`Vote submitted for Proposal #${proposalId}`, "success");
        await loadProposals();
    } catch (err) {
        const msg = getErrorMessage(err, "Vote failed.");
        setGlobalStatus(`Vote failed: ${msg}`, "error");
        showToast(msg, "error");
    }
};

window.executeProposal = async (proposalId) => {
    if (!governorContract) {
        setGlobalStatus("Please connect wallet first.", "warning");
        return;
    }

    try {
        const resolved = await resolveProposalParamsById(proposalId);
        if (
            !resolved ||
            !resolved.targets.length ||
            !resolved.values.length ||
            !resolved.calldatas.length ||
            !resolved.description.trim()
        ) {
            setGlobalStatus("Cannot execute: on-chain proposal params not found for this proposal ID.", "error");
            return;
        }

        setGlobalStatus(`Executing Proposal #${proposalId}...`, "info");
        const descriptionHash = ethers.id(resolved.description);

        const tx = await governorContract.execute(
            resolved.targets,
            resolved.values,
            resolved.calldatas,
            descriptionHash
        );

        await tx.wait();
        await loadProposals();
        await refreshTreasuryBalance();
        setGlobalStatus(`Proposal #${proposalId} executed successfully.`, "success");
        showToast(`Proposal #${proposalId} executed`, "success");
    } catch (err) {
        const msg = getErrorMessage(err, "Execute failed.");
        setGlobalStatus(`Execute failed: ${msg}`, "error");
        showToast(msg, "error");
    }
};

window.claimRefund = async (proposalId) => {
    if (!governorContract || typeof governorContract.claimRefund !== "function") {
        setGlobalStatus("claimRefund is not available in current contract ABI.", "warning");
        return;
    }

    try {
        setGlobalStatus(`Claiming refund for Proposal #${proposalId}...`, "info");
        const tx = await governorContract.claimRefund(proposalId);
        await tx.wait();

        await loadProposals();
        await refreshTreasuryBalance();
        setGlobalStatus(`Refund claimed for Proposal #${proposalId}.`, "success");
        showToast(`Refund claimed for Proposal #${proposalId}`, "success");
    } catch (err) {
        const msg = getErrorMessage(err, "Claim refund failed.");
        setGlobalStatus(`Claim refund failed: ${msg}`, "error");
        showToast(msg, "error");
    }
};

document.getElementById("connectBtn").onclick = connectWallet;

document.getElementById("switchAccountBtn").onclick = async () => {
    if (!window.ethereum) {
        setGlobalStatus("MetaMask is not detected. Please install MetaMask first.", "error");
        showToast("MetaMask is not detected.", "error");
        return;
    }

    setGlobalStatus("Opening wallet account selector...", "info");
    try {
        try {
            await window.ethereum.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }]
            });
        } catch (_err) {
            // Not all wallets expose permission revocation, so continue to the selection flow.
        }

        currentAccount = "";
        signer = undefined;
        provider = undefined;
        nftContract = undefined;
        governorContract = undefined;
        setConnectedUI(false);
        setGlobalStatus("Wallet disconnected. Click Connect Wallet again to reconnect or choose another account if MetaMask shows it.", "info");
        showToast("Wallet disconnected.", "success");
    } catch (err) {
        const msg = getErrorMessage(err, "Account switch cancelled.");
        setGlobalStatus(msg, "warning");
        showToast(msg, "warning");
    }
};

document.getElementById("mintBtn").onclick = async () => {
    if (!nftContract || !signer) {
        setGlobalStatus("Please connect wallet first.", "warning");
        return;
    }

    setButtonLoading("mintBtn", true, "Processing...", "Mint NFT & Delegate Votes");
    try {
        setText("status", "Step 1/2: Confirm NFT mint transaction in MetaMask...", "text-sm mt-2 text-info");
        await (await nftContract.safeMint(currentAccount)).wait();

        setText("status", "Step 2/2: Confirm delegation transaction...", "text-sm mt-2 text-info");
        await (await nftContract.delegate(currentAccount)).wait();

        setText("status", "Success: you now have voting rights.", "text-sm mt-2 text-emerald-300");
        setGlobalStatus("Membership NFT minted and voting rights activated.", "success");
        showToast("NFT minted and voting rights activated.", "success");
    } catch (err) {
        const msg = getErrorMessage(err, "Mint or delegation failed.");
        setText("status", `Failed: ${msg}`, "text-sm mt-2 text-rose-300");
        setGlobalStatus(`Mint flow failed: ${msg}`, "error");
        showToast(msg, "error");
    } finally {
        setButtonLoading("mintBtn", false, "", "Mint NFT & Delegate Votes");
    }
};

document.getElementById("donateBtn").onclick = async () => {
    if (!signer || !provider || !currentAccount) {
        setGlobalStatus("Please connect wallet first.", "warning");
        showToast("Please connect wallet first.", "warning");
        return;
    }

    const amountInput = document.getElementById("donateAmountInput");
    const amount = amountInput?.value?.trim();
    if (!amount) {
        setText("donateStatus", "Please enter a donation amount.", "text-sm text-warning");
        setGlobalStatus("Please enter a donation amount.", "warning");
        return;
    }

    let value;
    try {
        value = ethers.parseEther(amount);
    } catch (_err) {
        setText("donateStatus", "Invalid ETH amount format.", "text-sm text-error");
        setGlobalStatus("Invalid ETH amount format.", "error");
        showToast("Invalid ETH amount format.", "error");
        return;
    }

    setButtonLoading("donateBtn", true, "Sending...", "Donate to Treasury");
    try {
        setText("donateStatus", "Confirm the treasury transfer in MetaMask...", "text-sm text-info");
        const tx = await signer.sendTransaction({
            to: CONTRACT_ADDRESSES.governor,
            value
        });
        await tx.wait();

        setText("donateStatus", `Donation sent successfully. Tx: ${tx.hash.slice(0, 10)}...`, "text-sm text-success");
        setGlobalStatus(`Treasury funded with ${amount} ETH.`, "success");
        showToast(`Treasury funded with ${amount} ETH`, "success");
        amountInput.value = "";
        await refreshTreasuryBalance();
    } catch (err) {
        const msg = getErrorMessage(err, "Donation failed.");
        setText("donateStatus", `Failed: ${msg}`, "text-sm text-error");
        setGlobalStatus(`Donation failed: ${msg}`, "error");
        showToast(msg, "error");
    } finally {
        setButtonLoading("donateBtn", false, "", "Donate to Treasury");
    }
};

document.getElementById("proposeBtn").onclick = async () => {
    if (!governorContract || !signer) {
        setGlobalStatus("Please connect wallet first.", "warning");
        return;
    }

    const validation = validateProposalForm();
    if (!validation.ok) {
        setText("proposeStatus", validation.message, "text-sm mt-2 text-error");
        setGlobalStatus(validation.message, "warning");
        return;
    }

    const { desc, target, amount } = validation;

    setButtonLoading("proposeBtn", true, "Submitting...", `Pay ${requiredDepositEth} ETH & Submit Proposal`);
    try {
        setText(
            "proposeStatus",
            `Step 1/2: Confirm deposit payment (${requiredDepositEth} ETH) and proposal tx in MetaMask...`,
            "text-sm mt-2 text-sky-300"
        );

        const tx = await governorContract.proposeWithDeposit(
            [target],
            [ethers.parseEther(amount)],
            ["0x"],
            desc,
            { value: ethers.parseEther(requiredDepositEth) }
        );

        setText("proposeStatus", "Step 2/2: Waiting for transaction confirmation...", "text-sm mt-2 text-sky-300");
        await tx.wait();

        setText("proposeStatus", "Proposal submitted successfully.", "text-sm mt-2 text-emerald-300");
        setGlobalStatus("Proposal created. Move to Proposal Board to vote once active.", "success");

        document.getElementById("descInput").value = "";
        document.getElementById("amountInput").value = "";
        if (isLocalHardhatChain()) {
            try {
                await advanceLocalBlock();
                showToast("Local chain advanced by 1 block so the proposal can become active.", "success");
            } catch (mineErr) {
                console.warn("auto mine failed:", mineErr);
                showToast("Proposal created. Mine one local block to activate it.", "warning");
            }
        }
        await loadProposals();
        await refreshTreasuryBalance();
    } catch (err) {
        const msg = getErrorMessage(err, "Proposal submission failed.");
        setText("proposeStatus", `Failed: ${msg}`, "text-sm mt-2 text-error");
        setGlobalStatus(`Proposal failed: ${msg}`, "error");
        showToast(msg, "error");
    } finally {
        setButtonLoading("proposeBtn", false, "", `Pay ${requiredDepositEth} ETH & Submit Proposal`);
    }
};

document.getElementById("refreshBtn").onclick = async () => {
    if (!governorContract) {
        setGlobalStatus("Please connect wallet first.", "warning");
        return;
    }

    setGlobalStatus("Refreshing proposal board...", "info");
    await refreshDashboard();
    setGlobalStatus("Proposal board updated.", "success");
    showToast("Proposal board updated.", "success");
};

const advanceBlockBtn = document.getElementById("advanceBlockBtn");
if (advanceBlockBtn) {
    advanceBlockBtn.onclick = async () => {
        if (!provider || !governorContract) {
            setGlobalStatus("Please connect wallet first.", "warning");
            return;
        }

        try {
            setGlobalStatus("Advancing local chain by 1 block...", "info");
            await advanceLocalBlock();
            await refreshDashboard();
            setGlobalStatus("Local chain advanced.", "success");
            showToast("Local chain advanced by 1 block.", "success");
        } catch (err) {
            const msg = getErrorMessage(err, "Failed to mine a local block.");
            setGlobalStatus(msg, "error");
            showToast(msg, "error");
        }
    };
}

["descInput", "targetInput", "amountInput"].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", updateProposalFormHint);
});

if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
        if (!accounts || accounts.length === 0) {
            currentAccount = "";
            signer = undefined;
            provider = undefined;
            nftContract = undefined;
            governorContract = undefined;
            setConnectedUI(false);
            setGlobalStatus("Wallet disconnected.", "warning");
            showToast("Wallet disconnected.", "warning");
            return;
        }
        await initializeConnectedAccount();
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}

setConnectedUI(false);
