import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import LendingPlatformABI from '../abi/LendingPlatform.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

// Sepolia chain ID (hex and decimal)
const SEPOLIA_CHAIN_ID     = 11155111;
const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

/**
 * useWallet — MetaMask connection + smart contract calls.
 *
 * Returns:
 *  account      — connected wallet address (or null)
 *  connecting   — loading state
 *  chainOk      — true if user is on Sepolia
 *  connect()    — prompt MetaMask, checks network
 *  disconnect() — clear state
 *  switchToSepolia() — ask MetaMask to switch chains
 *  getContract  — returns a signer-connected contract instance
 *  callCreateLoan(principal, collateral, durationDays, interestRateBps)
 *  callFundLoan(onChainId, principal)
 *  callRepayLoan(onChainId, totalOwedEth)
 *  callLiquidateLoanIfNeeded(onChainId)
 *  callCancelLoan(onChainId)
 */
export function useWallet() {
  const [account,    setAccount]    = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [signer,     setSigner]     = useState(null);
  const [chainOk,    setChainOk]    = useState(false);

  // ── Listen for MetaMask account / chain changes ─────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setAccount(null);
        setSigner(null);
        setChainOk(false);
      } else {
        setAccount(accounts[0]);
        // Re-init signer when account switches
        const provider = new ethers.BrowserProvider(window.ethereum);
        provider.getSigner().then(s => {
          setSigner(s);
        }).catch(() => {});
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const id = parseInt(chainIdHex, 16);
      setChainOk(id === SEPOLIA_CHAIN_ID);
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged',    handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged',    handleChainChanged);
    };
  }, []);

  /** Ask MetaMask to switch to Sepolia */
  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return false;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      return true;
    } catch (switchErr) {
      // Chain not added yet — add it
      if (switchErr.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId:         SEPOLIA_CHAIN_ID_HEX,
              chainName:       'Sepolia Testnet',
              nativeCurrency:  { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
              rpcUrls:         ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask not installed! Please install it from https://metamask.io');
      return null;
    }
    setConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);

      // Check network
      const network = await provider.getNetwork();
      const isCorrectChain = Number(network.chainId) === SEPOLIA_CHAIN_ID;
      setChainOk(isCorrectChain);

      if (!isCorrectChain) {
        const switched = await switchToSepolia();
        if (!switched) {
          throw new Error('Please switch MetaMask to the Sepolia testnet to use Go Secure.');
        }
        // Re-init provider after switch
        const freshProvider = new ethers.BrowserProvider(window.ethereum);
        const s = await freshProvider.getSigner();
        const addr = await s.getAddress();
        setSigner(s);
        setAccount(addr);
        setChainOk(true);
        return addr;
      }

      const s    = await provider.getSigner();
      const addr = await s.getAddress();
      setSigner(s);
      setAccount(addr);
      return addr;
    } catch (err) {
      console.error('Wallet connect error:', err);
      throw err; // Let callers surface the error to the user
    } finally {
      setConnecting(false);
    }
  }, [switchToSepolia]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setChainOk(false);
  }, []);

  /** Returns a signer-connected contract instance (auto-connects if needed) */
  const getContract = useCallback(async () => {
    if (!CONTRACT_ADDRESS) throw new Error('VITE_CONTRACT_ADDRESS not set in frontend/.env');
    let s = signer;
    if (!s) {
      await connect();
      const provider = new ethers.BrowserProvider(window.ethereum);
      s = await provider.getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
    }
    if (!chainOk) {
      const switched = await switchToSepolia();
      if (!switched) throw new Error('Please switch to Sepolia testnet.');
    }
    return new ethers.Contract(CONTRACT_ADDRESS, LendingPlatformABI.abi, s);
  }, [signer, chainOk, connect, switchToSepolia]);

  // ── Contract method wrappers ──────────────────────────

  /**
   * Borrower: create loan on-chain
   * @param principal       ETH to borrow (as string, e.g. "0.5")
   * @param collateral      ETH to lock  (as string, e.g. "0.8")
   * @param durationDays    number
   * @param interestRateBps number (e.g. 1200 for 12%)
   * @returns { onChainId, txHash }
   */
  const callCreateLoan = useCallback(async (principal, collateral, durationDays, interestRateBps) => {
    const contract      = await getContract();
    const principalWei  = ethers.parseEther(String(principal));
    const collateralWei = ethers.parseEther(String(collateral));

    const tx = await contract.createLoan(
      principalWei,
      Number(durationDays),
      Number(interestRateBps),
      { value: collateralWei }
    );
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error('createLoan transaction reverted on-chain');

    // Parse LoanCreated event to get onChainId
    const iface = contract.interface;
    let onChainId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'LoanCreated') {
          onChainId = Number(parsed.args.loanId);
          break;
        }
      } catch { /* skip non-matching logs */ }
    }

    return { onChainId, txHash: receipt.hash };
  }, [getContract]);

  /**
   * Lender: fund a loan on-chain
   * @param onChainId  uint256 loanId from smart contract
   * @param principal  ETH to send (as string)
   * @returns { txHash }
   */
  const callFundLoan = useCallback(async (onChainId, principal) => {
    const contract = await getContract();
    const tx = await contract.fundLoan(
      Number(onChainId),
      { value: ethers.parseEther(String(principal)) }
    );
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error('fundLoan transaction reverted on-chain');
    return { txHash: receipt.hash };
  }, [getContract]);

  /**
   * Borrower: repay loan on-chain
   * @param onChainId    uint256 loanId
   * @param totalOwedEth total ETH to send (principal + interest, as string)
   * @returns { txHash }
   */
  const callRepayLoan = useCallback(async (onChainId, totalOwedEth) => {
    const contract = await getContract();
    const tx = await contract.repayLoan(
      Number(onChainId),
      { value: ethers.parseEther(String(totalOwedEth)) }
    );
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error('repayLoan transaction reverted on-chain');
    return { txHash: receipt.hash };
  }, [getContract]);

  /**
   * Liquidate overdue or undercollateralised loan (callable by anyone)
   * Maps to the renamed contract function liquidateLoanIfNeeded()
   * @returns { txHash }
   */
  const callLiquidateLoanIfNeeded = useCallback(async (onChainId) => {
    const contract = await getContract();
    const tx = await contract.liquidateLoanIfNeeded(Number(onChainId));
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error('liquidateLoanIfNeeded transaction reverted on-chain');
    return { txHash: receipt.hash };
  }, [getContract]);

  /**
   * Send ETH directly to a wallet address (no contract interaction).
   * Used for guarantor loans where there is no on-chain loan record.
   * MetaMask pops up, lender signs, ETH goes straight to borrower.
   * @param toAddress  recipient wallet address
   * @param amountEth  ETH amount as string or number (e.g. "0.05")
   * @returns txHash
   */
  const sendEthDirect = useCallback(async (toAddress, amountEth) => {
    let s = signer;
    if (!s) {
      await connect();
      const provider = new ethers.BrowserProvider(window.ethereum);
      s = await provider.getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
    }
    if (!chainOk) {
      const switched = await switchToSepolia();
      if (!switched) throw new Error('Please switch to Sepolia testnet.');
    }
    const tx = await s.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(String(amountEth)),
    });
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error('ETH transfer failed on-chain');
    return receipt.hash;
  }, [signer, chainOk, connect, switchToSepolia]);

  /**
   * Borrower: cancel pending loan before it's funded
   * @returns { txHash }
   */
  const callCancelLoan = useCallback(async (onChainId) => {
    const contract = await getContract();
    const tx = await contract.cancelLoan(Number(onChainId));
    const receipt = await tx.wait();
    if (receipt.status === 0) throw new Error('cancelLoan transaction reverted on-chain');
    return { txHash: receipt.hash };
  }, [getContract]);

  return {
    account, connecting, signer, chainOk,
    connect, disconnect, switchToSepolia, getContract,
    callCreateLoan, callFundLoan, callRepayLoan,
    callLiquidateLoanIfNeeded, callCancelLoan, sendEthDirect,
  };
}
