let provider;
let signer;
let nftContract;
let governorContract;
let currentAccount = "";
let requiredDepositEth = "0.1";
const proposalCache = new Map();
let currentChainId = "";

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
    const stateBadge = document.getElementById("walletConnectionState");
    const walletAddressEl = document.getElementById("walletAddress");
    const mintBtn = document.getElementById("mintBtn");
    const proposeBtn = document.getElementById("proposeBtn");

    if (!connectBtn || !stateBadge || !walletAddressEl || !mintBtn || !proposeBtn) return;

    if (connected) {
        connectBtn.textContent = "Connected";
        connectBtn.classList.remove("btn-outline");
        connectBtn.classList.add("btn-success");

        stateBadge.textContent = "Connected";
        stateBadge.className = "badge badge-outline badge-success";

        walletAddressEl.textContent = shortAddr(currentAccount);
        walletAddressEl.title = currentAccount;

        mintBtn.disabled = false;
        proposeBtn.disabled = false;
    } else {
        proposalCache.clear();
        connectBtn.textContent = "Connect Wallet";
        connectBtn.classList.remove("btn-success");
        connectBtn.classList.add("btn-outline");

        stateBadge.textContent = "Disconnected";
        stateBadge.className = "badge badge-outline badge-warning";

        walletAddressEl.textContent = "Not connected";
        walletAddressEl.removeAttribute("title");

        mintBtn.disabled = true;
        proposeBtn.disabled = true;
        document.getElementById("treasuryBalance").textContent = "0.00 ETH";
        document.getElementById("proposalList").innerHTML = `<div class="alert alert-info shadow-sm"><span>Please connect wallet to load proposals.</span></div>`;
        setText("networkInfo", "Network: Not connected", "text-xs text-base-content/60");
    }
}

async function refreshTreasuryBalance() {
    if (!provider) return;

    const balanceInWei = await provider.getBalance(CONTRACT_ADDRESSES.governor);
    document.getElementById("treasuryBalance").textContent = `${parseFloat(ethers.formatEther(balanceInWei)).toFixed(4)} ETH`;
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

async function connectWallet() {
    if (!window.ethereum) {
        setGlobalStatus("MetaMask is not detected. Please install MetaMask first.", "error");
        return;
    }

    setButtonLoading("connectBtn", true, "Connecting...", "Connect Wallet");
    try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
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
        setText("proposeStatus", "Fill in description, target address, and amount.", "text-sm mt-2 text-base-content/70");
        setText("networkInfo", `Network: Chain ID ${currentChainId}`, "text-xs text-base-content/60");

        await refreshTreasuryBalance();
        await loadProposals();
    } catch (err) {
        const msg = getErrorMessage(err, "Connection failed.");
        setGlobalStatus(`Wallet connection failed: ${msg}`, "error");
        currentAccount = "";
        setConnectedUI(false);
    } finally {
        setButtonLoading("connectBtn", false, "", "Connect Wallet");
        if (currentAccount && governorContract) {
            setConnectedUI(true);
        }
    }
}

async function loadProposals() {
    const proposalListEl = document.getElementById("proposalList");
    if (!proposalListEl || !governorContract) return;

    proposalListEl.innerHTML = `<div class="alert alert-info shadow-sm"><span>Loading proposals...</span></div>`;

    try {
        const events = await governorContract.queryFilter(
            governorContract.filters.ProposalCreated(),
            0,
            "latest"
        );

        if (!events.length) {
            proposalListEl.innerHTML = `<div class="alert alert-info shadow-sm"><span>No proposals yet. Submit the first one.</span></div>`;
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
                let deposit = 0n;
                if (typeof governorContract.deposits === "function") {
                    try {
                        deposit = await governorContract.deposits(proposalIdRaw);
                    } catch (_err) {
                        deposit = 0n;
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
        proposalListEl.innerHTML = `<div class="alert alert-info shadow-sm"><span>No proposals yet.</span></div>`;
        return;
    }

    proposalListEl.innerHTML = proposals.map((p) => {
        const canVote = p.state === 1;
        const canExecute = p.state === 4;
        const canClaimRefund =
            currentAccount &&
            p.proposer.toLowerCase() === currentAccount.toLowerCase() &&
            [3, 4, 7].includes(p.state) &&
            p.depositWei !== "0";

        return `
        <div class="card bg-base-100 shadow-xl border border-base-300">
            <div class="card-body gap-3">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <h3 class="card-title text-xl">Proposal #${p.proposalId}</h3>
                    <div class="badge ${stateBadgeClass(p.state)}">${stateText(p.state)}</div>
                </div>

                <p class="text-sm md:text-base text-base-content/70"><span class="font-semibold text-base-content">Proposer:</span> ${shortAddr(p.proposer)}</p>
                <p class="text-sm md:text-base"><span class="font-semibold">Description:</span> ${escapeHtml(p.description)}</p>
                <p class="text-sm md:text-base"><span class="font-semibold">Target:</span> ${shortAddr(p.requestedTarget)}</p>
                <p class="text-sm md:text-base"><span class="font-semibold">Requested Amount:</span> ${p.requestedAmount} ETH</p>
                <p class="text-sm md:text-base"><span class="font-semibold">Deposit:</span> ${p.deposit} ETH</p>
                <p class="text-sm md:text-base"><span class="font-semibold">Voting Window:</span> Block ${p.snapshot} to ${p.deadline}</p>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1 text-center">
                    <div class="stat bg-base-200 rounded-box py-3 px-2">
                        <div class="stat-title text-sm">For</div>
                        <div class="stat-value text-2xl text-success">${p.forVotes}</div>
                    </div>
                    <div class="stat bg-base-200 rounded-box py-3 px-2">
                        <div class="stat-title text-sm">Against</div>
                        <div class="stat-value text-2xl text-error">${p.againstVotes}</div>
                    </div>
                    <div class="stat bg-base-200 rounded-box py-3 px-2">
                        <div class="stat-title text-sm">Abstain</div>
                        <div class="stat-value text-2xl text-info">${p.abstainVotes}</div>
                    </div>
                </div>

                <div class="card-actions flex-wrap justify-start md:justify-end mt-2">
                    <button class="btn btn-success btn-sm" onclick="voteProposal('${p.proposalId}', 1)" ${canVote ? "" : "disabled"}>Vote For</button>
                    <button class="btn btn-error btn-sm" onclick="voteProposal('${p.proposalId}', 0)" ${canVote ? "" : "disabled"}>Vote Against</button>
                    <button class="btn btn-info btn-sm" onclick="voteProposal('${p.proposalId}', 2)" ${canVote ? "" : "disabled"}>Abstain</button>
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
        await loadProposals();
    } catch (err) {
        const msg = getErrorMessage(err, "Vote failed.");
        setGlobalStatus(`Vote failed: ${msg}`, "error");
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
    } catch (err) {
        const msg = getErrorMessage(err, "Execute failed.");
        setGlobalStatus(`Execute failed: ${msg}`, "error");
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
    } catch (err) {
        const msg = getErrorMessage(err, "Claim refund failed.");
        setGlobalStatus(`Claim refund failed: ${msg}`, "error");
    }
};

document.getElementById("connectBtn").onclick = connectWallet;

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

        setText("status", "Success: you now have voting rights.", "text-sm mt-2 text-success");
        setGlobalStatus("Membership NFT minted and voting rights activated.", "success");
    } catch (err) {
        const msg = getErrorMessage(err, "Mint or delegation failed.");
        setText("status", `Failed: ${msg}`, "text-sm mt-2 text-error");
        setGlobalStatus(`Mint flow failed: ${msg}`, "error");
    } finally {
        setButtonLoading("mintBtn", false, "", "Mint NFT & Delegate Votes");
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
            "text-sm mt-2 text-info"
        );

        const tx = await governorContract.proposeWithDeposit(
            [target],
            [ethers.parseEther(amount)],
            ["0x"],
            desc,
            { value: ethers.parseEther(requiredDepositEth) }
        );

        setText("proposeStatus", "Step 2/2: Waiting for transaction confirmation...", "text-sm mt-2 text-info");
        await tx.wait();

        setText("proposeStatus", "Proposal submitted successfully.", "text-sm mt-2 text-success");
        setGlobalStatus("Proposal created. Move to Proposal Board to vote once active.", "success");

        document.getElementById("descInput").value = "";
        document.getElementById("amountInput").value = "";
        await loadProposals();
        await refreshTreasuryBalance();
    } catch (err) {
        const msg = getErrorMessage(err, "Proposal submission failed.");
        setText("proposeStatus", `Failed: ${msg}`, "text-sm mt-2 text-error");
        setGlobalStatus(`Proposal failed: ${msg}`, "error");
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
    await loadProposals();
    await refreshTreasuryBalance();
    setGlobalStatus("Proposal board updated.", "success");
};

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
            return;
        }
        await connectWallet();
    });

    window.ethereum.on("chainChanged", () => {
        window.location.reload();
    });
}

setConnectedUI(false);
