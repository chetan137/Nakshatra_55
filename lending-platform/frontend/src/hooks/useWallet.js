import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import LendingPlatformABI from '../abi/LendingPlatform.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

/**
 * useWallet — MetaMask connection + smart contract calls.
 *
 * Returns:
 *  account      — connected wallet address (or null)
 *  connecting   — loading state
 *  connect()    — prompt MetaMask
 *  disconnect() — clear state
 *  getContract  — returns a signer-connected contract instance
 *  callCreateLoan(principal, collateral, durationDays, interestRateBps)
 *  callFundLoan(onChainId, principal)
 *  callRepayLoan(onChainId, totalOwedWei)
 *  callLiquidate(onChainId)
 *  callCancelLoan(onChainId)
 */
export function useWallet() {
  const [account,    setAccount]    = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [signer,     setSigner]     = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask not installed! Please install it from https://metamask.io');
      return null;
    }
    setConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const s = await provider.getSigner();
      const addr = await s.getAddress();
      setSigner(s);
      setAccount(addr);
      return addr;
    } catch (err) {
      console.error('Wallet connect error:', err);
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
  }, []);

  /** Returns a signer-connected contract instance (auto-connects if needed) */
  const getContract = useCallback(async () => {
    if (!CONTRACT_ADDRESS) throw new Error('VITE_CONTRACT_ADDRESS not set in frontend/.env');
    let s = signer;
    if (!s) {
      const addr = await connect();
      if (!addr) throw new Error('Wallet not connected');
      // Re-read signer after connect
      const provider = new ethers.BrowserProvider(window.ethereum);
      s = await provider.getSigner();
      setSigner(s);
      setAccount(await s.getAddress());
    }
    return new ethers.Contract(CONTRACT_ADDRESS, LendingPlatformABI.abi, s);
  }, [signer, connect]);

  // ── Contract method wrappers ──────────────────────────

  /**
   * Borrower: create loan on-chain
   * @param principal      ETH to borrow (as string, e.g. "0.5")
   * @param collateral     ETH to lock  (as string, e.g. "0.8")
   * @param durationDays   number
   * @param interestRateBps number (e.g. 1200 for 12%)
   * @returns { onChainId, txHash }
   */
  const callCreateLoan = useCallback(async (principal, collateral, durationDays, interestRateBps) => {
    const contract = await getContract();
    const principalWei  = ethers.parseEther(String(principal));
    const collateralWei = ethers.parseEther(String(collateral));

    const tx = await contract.createLoan(
      principalWei,
      Number(durationDays),
      Number(interestRateBps),
      { value: collateralWei }
    );
    const receipt = await tx.wait();

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
    return { txHash: receipt.hash };
  }, [getContract]);

  /**
   * Borrower: repay loan on-chain
   * @param onChainId   uint256 loanId
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
    return { txHash: receipt.hash };
  }, [getContract]);

  /**
   * Liquidate overdue loan (callable by anyone)
   * @returns { txHash }
   */
  const callLiquidate = useCallback(async (onChainId) => {
    const contract = await getContract();
    const tx = await contract.liquidate(Number(onChainId));
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }, [getContract]);

  /**
   * Borrower: cancel pending loan before it's funded
   * @returns { txHash }
   */
  const callCancelLoan = useCallback(async (onChainId) => {
    const contract = await getContract();
    const tx = await contract.cancelLoan(Number(onChainId));
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }, [getContract]);

  return {
    account, connecting, signer,
    connect, disconnect, getContract,
    callCreateLoan, callFundLoan, callRepayLoan,
    callLiquidate, callCancelLoan,
  };
}
