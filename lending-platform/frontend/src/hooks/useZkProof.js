/**
 * useZkProof.js
 *
 * Manages the ZK anonymous verification flow:
 *  1. submitProof()  — calls backend /api/zk/submit-proof
 *  2. checkStatus()  — polls /api/zk/status for current user
 *  3. anchorOnChain()— calls smart contract submitZkProof(proofHash)
 *  4. checkWallet()  — verifies another wallet's ZK status (for lenders)
 *
 * Simulates Reclaim Protocol flow locally for hackathon demo.
 * Replace simulateReclaimFlow() with real @reclaimprotocol/js-sdk for prod.
 */

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Minimal ABI — only the ZK functions we need
const ZK_ABI = [
  'function submitZkProof(bytes32 proofHash) external',
  'function isZkVerified(address borrower) external view returns (bool)',
  'function zkProofHash(address) external view returns (bytes32)',
  'function isLoanDefaulted(uint256 loanId) external view returns (bool)',
];

export function useZkProof() {
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);
  const [zkStatus, setZkStatus] = useState(null); // { verified, attestation, proofHash, ... }

  /**
   * Simulates the Reclaim Protocol / zkPass browser flow.
   *
   * In production:
   *   import { ReclaimClient } from '@reclaimprotocol/js-sdk';
   *   const client = new ReclaimClient(APP_ID);
   *   const proof  = await client.zkFetch(providerUrl, { ...params });
   *   return { hasValidId: true, incomeUsd: proof.parameters.income, ... }
   *
   * For hackathon: shows a modal prompting user to "log in to their bank",
   * then returns simulated attestation data after a delay.
   */
  async function simulateReclaimFlow(onProgress) {
    // Simulate the steps of the ZK oracle flow
    const steps = [
      { msg: 'Opening secure browser session…', delay: 800 },
      { msg: 'Connecting to identity provider…', delay: 1000 },
      { msg: 'Generating ZK proof (zkTLS)…', delay: 1200 },
      { msg: 'Attesting income & ID without revealing data…', delay: 1000 },
      { msg: 'Proof generated ✓', delay: 400 },
    ];

    for (const step of steps) {
      onProgress?.(step.msg);
      await new Promise(r => setTimeout(r, step.delay));
    }

    // Return simulated claim data (in prod: comes from Reclaim oracle)
    return {
      hasValidId: true,
      incomeUsd: 5000,
      countryCode: 'IN',
    };
  }

  /**
   * submitProof — full ZK verification flow:
   *  1. Simulate Reclaim oracle (or call real SDK)
   *  2. POST to backend /api/zk/submit-proof
   *  3. Anchor proofHash on smart contract
   *
   * @param {object} opts
   * @param {string} opts.token          - JWT for API auth
   * @param {object|null} opts.piiData   - optional PII for Lit backup { name, idHash, incomeProof }
   * @param {function} opts.onProgress   - (message: string) => void
   * @param {object|null} opts.signer    - ethers signer for on-chain anchor
   */
  const submitProof = useCallback(async ({ token, piiData = null, onProgress, signer = null } = {}) => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Run Reclaim Protocol simulation
      onProgress?.('Step 1/3 — Running ZK oracle (Reclaim Protocol)…');
      const claimData = await simulateReclaimFlow(onProgress);

      // Step 2: Submit to backend
      onProgress?.('Step 2/3 — Submitting proof to backend…');
      const { data } = await axios.post(
        `${API}/zk/submit-proof`,
        { claimData, piiData },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!data.success) throw new Error(data.message);

      const { proofHash, attestation, expiresAt } = data;

      // Step 3: Anchor on smart contract (optional but recommended)
      if (signer && proofHash) {
        onProgress?.('Step 3/3 — Anchoring proof hash on-chain…');
        try {
          const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
          const contract = new ethers.Contract(contractAddress, ZK_ABI, signer);
          const proofBytes32 = proofHash.startsWith('0x')
            ? proofHash.padEnd(66, '0')  // ensure 32 bytes
            : '0x' + proofHash.padEnd(64, '0');
          const tx = await contract.submitZkProof(proofBytes32);
          await tx.wait();
          onProgress?.('Proof anchored on-chain ✓');
        } catch (chainErr) {
          // Non-fatal: proof is still valid off-chain
          console.warn('[ZK] On-chain anchor failed (non-fatal):', chainErr.message);
          onProgress?.('On-chain anchor skipped (network issue) — proof still valid');
        }
      } else {
        onProgress?.('Step 3/3 — Skipped on-chain anchor (connect wallet to anchor)');
      }

      const result = { proofHash, attestation, expiresAt };
      setZkStatus({ verified: true, ...result });
      return result;
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'ZK verification failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * checkStatus — fetches current ZK status for the authenticated user.
   */
  const checkStatus = useCallback(async (token) => {
    try {
      const { data } = await axios.get(`${API}/zk/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setZkStatus(data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /**
   * checkWalletVerified — lets lenders check if a borrower wallet is ZK-verified.
   * Returns { verified, attestation } — no PII.
   */
  const checkWalletVerified = useCallback(async (walletAddress) => {
    try {
      const { data } = await axios.get(`${API}/zk/verify/${walletAddress}`);
      return data;
    } catch {
      return { verified: false };
    }
  }, []);

  return {
    loading,
    error,
    zkStatus,
    submitProof,
    checkStatus,
    checkWalletVerified,
  };
}
