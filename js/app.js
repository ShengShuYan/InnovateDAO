// js/app.js

// Global Variables
let signer;
let nftContract;
let governorContract;

// 1. Wallet Connection Logic
document.getElementById("connectBtn").onclick = async () => {
    if (window.ethereum) {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            
            // Initialize contracts using configurations from config.js
            nftContract = new ethers.Contract(CONTRACT_ADDRESSES.nft, CONTRACT_ABIS.nft, signer);
            governorContract = new ethers.Contract(CONTRACT_ADDRESSES.governor, CONTRACT_ABIS.governor, signer);
            
            // Update UI
            const address = signer.address;
            document.getElementById("connectBtn").innerText = `${address.substring(0,6)}...${address.substring(38)}`;
            document.getElementById("connectBtn").classList.remove("btn-outline");
            
            // Read Treasury Balance
            const balanceInWei = await provider.getBalance(CONTRACT_ADDRESSES.governor);
            document.getElementById("treasuryBalance").innerText = `${parseFloat(ethers.formatEther(balanceInWei)).toFixed(2)} ETH`;
            
            document.getElementById("mintBtn").disabled = false;
            document.getElementById("proposeBtn").disabled = false;
        } catch (err) { 
            console.error(err); 
            alert("Connection failed. Please check the console for details.");
        }
    } else { 
        alert("Please install MetaMask!"); 
    }
};

// 2. Mint NFT & Delegate Logic
document.getElementById("mintBtn").onclick = async () => {
    try {
        const statusEl = document.getElementById("status");
        statusEl.innerText = "Confirming mint transaction...";
        await (await nftContract.safeMint(signer.address)).wait(); 
        
        statusEl.innerText = "Activating voting rights...";
        await (await nftContract.delegate(signer.address)).wait();
        
        statusEl.innerText = "🎉 Success! You now have voting rights.";
        statusEl.classList.add("text-success");
    } catch (err) { 
        console.error(err);
        document.getElementById("status").innerText = "❌ Transaction failed."; 
    }
};

// 3. Submit Proposal Logic
document.getElementById("proposeBtn").onclick = async () => {
    const desc = document.getElementById("descInput").value;
    if (!desc) return alert("Please enter a proposal description.");
    
    try {
        const proposeStatusEl = document.getElementById("proposeStatus");
        proposeStatusEl.innerText = "Waiting for wallet confirmation to pay deposit...";
        
        const tx = await governorContract.proposeWithDeposit(
            [signer.address], [0], ["0x"], desc, 
            { value: ethers.parseEther("0.1") }
        );
        
        proposeStatusEl.innerText = "Mining transaction...";
        await tx.wait();
        
        proposeStatusEl.innerText = "✅ Proposal submitted successfully!";
        proposeStatusEl.classList.add("text-success");
    } catch (err) { 
        console.error(err);
        document.getElementById("proposeStatus").innerText = "❌ Proposal failed."; 
    }
};