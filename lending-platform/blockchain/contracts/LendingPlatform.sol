// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/AggregatorV3Interface.sol";
import "./libraries/LoanMath.sol";

/**
 * @title  LendingPlatform
 * @author LendChain
 * @notice Peer-to-peer ETH lending with:
 *           • Collateral locking (minimum 50% of principal)
 *           • Chainlink ETH/USD price-based liquidation (below 120%)
 *           • Simple interest accrual
 *           • Reputation tracking (completions / defaults)
 *           • getUserLoans index for easy front-end queries
 *
 * ─── FLOW ───────────────────────────────────────────────────────────
 *  1. Borrower calls createLoan(principal, durationDays, interestRateBps)
 *       + sends ETH as msg.value (must be ≥ 50% of principal).
 *       Contract holds the collateral.
 *
 *  2. Lender calls fundLoan(loanId)
 *       + sends exactly loan.principal ETH.
 *       Contract forwards the principal to the borrower immediately.
 *       Collateral stays locked.
 *
 *  3a. Borrower calls repayLoan(loanId)
 *       + sends principal + accrued interest.
 *       Lender receives repayment; borrower gets collateral back.
 *
 *  3b. Anyone calls liquidateLoanIfNeeded(loanId)
 *       • If the ETH/USD price has dropped so that collateral value
 *         is below 120% of remaining principal → liquidate.
 *       • Lender gets entire collateral; borrower's default count rises.
 *       • Also triggered after dueDate (time-based default).
 *
 *  4.  Borrower can cancelLoan(loanId) while still Pending (not yet funded).
 * ────────────────────────────────────────────────────────────────────
 *
 * CHAINLINK PRICE FEED ADDRESSES (Sepolia testnet):
 *   ETH/USD: 0x694AA1769357215DE4FAC081bf1f309aDC325306
 *
 * For local Hardhat testing pass a MockV3Aggregator address instead.
 */
contract LendingPlatform {
    using LoanMath for uint256;

    // ═══════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Minimum collateral ratio in percent (50 = 50%)
    uint256 public constant MIN_COLLATERAL_RATIO  = 50;

    /// @notice Liquidation threshold in percent (120 = 120%)
    uint256 public constant LIQUIDATION_THRESHOLD = 120;

    /// @notice Staleness guard — reject Chainlink data older than 1 hour
    uint256 public constant PRICE_STALENESS_LIMIT = 1 hours;

    // ═══════════════════════════════════════════════════════════════
    //  ENUMS & STRUCTS
    // ═══════════════════════════════════════════════════════════════

    enum LoanStatus { Pending, Active, Repaid, Defaulted, Cancelled }

    /**
     * @notice Complete state for one loan.
     * @dev    Fields named to match the requested interface.
     *
     *  id               — auto-incrementing loan ID
     *  borrower         — address that deposited collateral
     *  lender           — address that funded the loan (0 while Pending)
     *  principal        — ETH the borrower wants to receive (wei)
     *  collateralAmount — ETH locked as insurance (wei)
     *  interestRate     — annual rate in basis points (1200 = 12%)
     *  startDate        — unix timestamp when lender funded
     *  dueDate          — startDate + durationDays
     *  repaid           — true after borrower fully repays
     *  completed        — true after any clean close (repaid or liquidated)
     *  defaulted        — true if closed via liquidation
     *  durationDays     — loan term in days (stored for display/re-calc)
     *  status           — canonical state machine value
     */
    struct Loan {
        uint256    id;
        address payable borrower;
        address payable lender;
        uint256    principal;
        uint256    collateralAmount;
        uint256    interestRate;      // bps
        uint256    startDate;
        uint256    dueDate;
        bool       repaid;
        bool       completed;
        bool       defaulted;
        uint256    durationDays;
        LoanStatus status;
    }

    // ═══════════════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice Chainlink ETH/USD price feed
    AggregatorV3Interface public immutable priceFeed;

    /// @notice Auto-incrementing loan counter (also = next loanId)
    uint256 public loanCounter;

    /// @notice loanId → Loan
    mapping(uint256 => Loan) public loans;

    /// @notice user → array of loanIds they are involved in (as borrower or lender)
    mapping(address => uint256[]) private _userLoans;

    // Reputation
    mapping(address => uint256) public loansCompleted;
    mapping(address => uint256) public loansDefaulted;
    mapping(address => uint256) public totalLent;      // cumulative wei lent
    mapping(address => uint256) public totalBorrowed;  // cumulative wei borrowed

    // ── ZK Anonymous Verification ────────────────────────────────────────
    // Stores the ZK proof hash per borrower address.
    // The hash commits to: wallet + attestation (income/ID) — NO PII on-chain.
    // Generated by Reclaim Protocol / zkPass oracle off-chain.
    mapping(address => bytes32) public zkProofHash;

    // Whether a loan has been ZK-verified (proof submitted before funding)
    mapping(uint256 => bool) public loanZkVerified;

    // Whether a loan has defaulted (used as Lit Protocol access condition)
    mapping(uint256 => bool) public loanDefaulted;

    // ═══════════════════════════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════════════════════════

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 collateralAmount,
        uint256 interestRate,
        uint256 durationDays
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        uint256 amount
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amountPaid
    );

    event LoanLiquidated(
        uint256 indexed loanId,
        uint256 collateralSoldFor,
        bool    priceTriggered   // true = price drop, false = time overdue
    );

    event LoanCancelled(uint256 indexed loanId, address indexed borrower);

    /// @notice Emitted when borrower submits their ZK proof hash on-chain.
    /// The proofHash is publicly verifiable but reveals NO personal data.
    event ZkProofSubmitted(address indexed borrower, bytes32 proofHash);

    /// @notice Emitted on loan default — triggers Lit Protocol conditional decrypt.
    /// Backend listens for this event to open the Lit gate for the lender.
    event ProofRevealTriggered(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender,
        bytes32 proofHash
    );

    // ═══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier loanExists(uint256 loanId) {
        require(loanId < loanCounter, "Loan does not exist");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    /**
     * @param _priceFeed  Chainlink AggregatorV3Interface address for ETH/USD.
     *                    Sepolia: 0x694AA1769357215DE4FAC081bf1f309aDC325306
     *                    Mainnet: 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
     *                    Local:   deploy MockV3Aggregator from test helpers
     */
    constructor(address _priceFeed) {
        require(_priceFeed != address(0), "Invalid price feed address");
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    // ═══════════════════════════════════════════════════════════════
    //  STEP 1 — Borrower creates a loan request
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Borrower locks ETH collateral and advertises a loan request.
     *
     * @param principal       How much ETH the borrower wants to receive (wei).
     * @param durationDays    Loan term in days (1 – 730).
     * @param interestRateBps Annual interest in basis points (1 – 10000).
     *
     * msg.value = collateral to lock. Must satisfy:
     *   collateral ≥ principal × 150 / 100
     *
     * Example — borrower wants 1 ETH for 30 days at 12% APR:
     *   createLoan(1 ether, 30, 1200)  { value: 0.5 ether }
     *
     * @return loanId  The newly created loan ID.
     */
    function createLoan(
        uint256 principal,
        uint256 durationDays,
        uint256 interestRateBps
    ) external payable returns (uint256 loanId) {
        require(principal > 0,                                  "Principal must be > 0");
        require(durationDays >= 1 && durationDays <= 730,       "Duration: 1-730 days");
        require(interestRateBps > 0 && interestRateBps <= 10_000, "Rate: 1-10000 bps");
        require(msg.value > 0,                                  "Must deposit collateral");

        // Collateral must be >= 50% of principal
        // ratio = collateral * 100 / principal >= 50
        require(
            (msg.value * 100) / principal >= MIN_COLLATERAL_RATIO,
            "Collateral must be >= 50% of principal"
        );

        loanId = loanCounter++;

        loans[loanId] = Loan({
            id:               loanId,
            borrower:         payable(msg.sender),
            lender:           payable(address(0)),
            principal:        principal,
            collateralAmount: msg.value,
            interestRate:     interestRateBps,
            startDate:        0,
            dueDate:          0,
            repaid:           false,
            completed:        false,
            defaulted:        false,
            durationDays:     durationDays,
            status:           LoanStatus.Pending
        });

        totalBorrowed[msg.sender] += principal;
        _userLoans[msg.sender].push(loanId);

        emit LoanCreated(loanId, msg.sender, principal, msg.value, interestRateBps, durationDays);
    }

    // ═══════════════════════════════════════════════════════════════
    //  STEP 2 — Lender funds the loan
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Lender sends exactly loan.principal ETH; borrower receives it instantly.
     *
     * @param loanId  The loan to fund.
     *
     * Collateral remains locked in the contract until repayment or liquidation.
     * The lender's address is recorded; repayment and liquidation proceeds go to them.
     */
    function fundLoan(uint256 loanId) external payable loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Pending,       "Loan not pending");
        require(msg.sender != loan.borrower,             "Borrower cannot fund own loan");
        require(msg.value  == loan.principal,            "Must send exact principal amount");

        loan.lender    = payable(msg.sender);
        loan.startDate = block.timestamp;
        loan.dueDate   = block.timestamp + (loan.durationDays * 1 days);
        loan.status    = LoanStatus.Active;

        totalLent[msg.sender] += loan.principal;
        _userLoans[msg.sender].push(loanId);

        // Forward principal to borrower immediately
        (bool sent, ) = loan.borrower.call{value: loan.principal}("");
        require(sent, "Transfer to borrower failed");

        emit LoanFunded(loanId, msg.sender, loan.principal);
    }

    // ═══════════════════════════════════════════════════════════════
    //  STEP 3a — Borrower repays the loan
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Borrower repays principal + accrued interest.
     *         Sends the repayment to lender and returns collateral to borrower.
     *
     * @param loanId  The loan to repay.
     *
     * msg.value must be >= principal + calculateInterest(...)
     * Any overpayment is refunded to the borrower.
     *
     * Interest formula (simple): I = P × rate(bps) × elapsed / (10000 × 365 days)
     */
    function repayLoan(uint256 loanId) external payable loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Active, "Loan not active");
        require(msg.sender  == loan.borrower,     "Only borrower can repay");

        uint256 interest   = calculateInterest(loan.principal, loan.interestRate,
                                               block.timestamp - loan.startDate);
        uint256 amountOwed = loan.principal + interest;

        require(msg.value >= amountOwed, "Insufficient repayment");

        // ── Update state before transfers (re-entrancy guard pattern) ──
        loan.status    = LoanStatus.Repaid;
        loan.repaid    = true;
        loan.completed = true;
        loansCompleted[loan.borrower]++;

        // Repayment to lender
        (bool toL, ) = loan.lender.call{value: amountOwed}("");
        require(toL, "Transfer to lender failed");

        // Collateral back to borrower
        (bool toB, ) = loan.borrower.call{value: loan.collateralAmount}("");
        require(toB, "Collateral return failed");

        // Refund overpayment
        if (msg.value > amountOwed) {
            (bool refund, ) = loan.borrower.call{value: msg.value - amountOwed}("");
            require(refund, "Refund failed");
        }

        emit LoanRepaid(loanId, loan.borrower, amountOwed);
    }

    // ═══════════════════════════════════════════════════════════════
    //  STEP 3b — Liquidate if price drops or overdue
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Anyone can call this to liquidate a loan when either:
     *           (a) Chainlink price feed shows collateral value < 120% of principal, OR
     *           (b) block.timestamp > loan.dueDate (time-based default)
     *
     * @param loanId  The loan to check and potentially liquidate.
     *
     * On liquidation:
     *   • Entire collateral is sent to the lender as compensation.
     *   • Borrower's defaulted count is incremented.
     *   • loan.defaulted and loan.completed flags are set.
     *
     * WHY anyone can call: This prevents lender from being the only one watching.
     *   Keepers / bots / users all have incentive to liquidate bad loans.
     */
    function liquidateLoanIfNeeded(uint256 loanId) external loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Active, "Loan not active");

        bool priceTriggered = false;
        bool timeTriggered  = block.timestamp > loan.dueDate;

        if (!timeTriggered) {
            // Check price-based liquidation
            (uint256 ethPrice, ) = getLatestPrice();
            uint256 ratio = LoanMath.collateralRatioWithPrice(
                loan.collateralAmount,
                loan.principal,
                ethPrice
            );
            priceTriggered = ratio < LIQUIDATION_THRESHOLD;
        }

        require(timeTriggered || priceTriggered, "Loan is not liquidatable");

        // ── Update state before transfers ──
        loan.status    = LoanStatus.Defaulted;
        loan.defaulted = true;
        loan.completed = true;
        loansDefaulted[loan.borrower]++;

        // Mark loan as defaulted — this is the Lit Protocol access condition
        loanDefaulted[loanId] = true;

        uint256 collateral = loan.collateralAmount;

        // Entire collateral goes to lender
        (bool sent, ) = loan.lender.call{value: collateral}("");
        require(sent, "Transfer to lender failed");

        emit LoanLiquidated(loanId, collateral, priceTriggered);

        // If borrower has ZK proof on-chain, trigger the Lit Protocol reveal gate.
        // Backend listens for ProofRevealTriggered to call Lit SDK and release
        // the encrypted identity data to the lender (ONLY if they defaulted).
        bytes32 proof = zkProofHash[loan.borrower];
        if (proof != bytes32(0)) {
            emit ProofRevealTriggered(loanId, loan.borrower, loan.lender, proof);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ZK ANONYMOUS VERIFICATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Borrower anchors their ZK proof hash on-chain before taking a loan.
     *
     * @param proofHash  SHA-256 hash from Reclaim Protocol / zkPass oracle.
     *                   Commits to: wallet + attestation (income/ID). NO PII.
     *
     * The lender sees this hash as a "verification badge" on the loan.
     * The actual identity data stays encrypted on the borrower's device,
     * locked via Lit Protocol — revealed ONLY if this loan defaults.
     *
     * Anyone can verify the attestation off-chain by querying the Reclaim
     * oracle with this hash, without ever seeing the borrower's documents.
     */
    function submitZkProof(bytes32 proofHash) external {
        require(proofHash != bytes32(0), "Invalid proof hash");
        zkProofHash[msg.sender] = proofHash;
        emit ZkProofSubmitted(msg.sender, proofHash);
    }

    /**
     * @notice Returns whether a borrower has submitted a ZK proof.
     * @param  borrower  Address to check
     * @return verified  true if a non-zero proof hash exists
     */
    function isZkVerified(address borrower) external view returns (bool verified) {
        return zkProofHash[borrower] != bytes32(0);
    }

    /**
     * @notice Read-only access condition for Lit Protocol.
     *         Lit nodes call this to decide whether to release the decrypt key.
     * @param  loanId  The defaulted loan ID
     * @return true if loan has defaulted (Lit gate opens)
     */
    function isLoanDefaulted(uint256 loanId) external view loanExists(loanId) returns (bool) {
        return loanDefaulted[loanId];
    }

    // ═══════════════════════════════════════════════════════════════
    //  CANCEL — Borrower cancels before anyone funds
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Borrower can cancel a Pending loan to recover collateral.
     *         Not allowed once a lender has funded.
     *
     * @param loanId  The loan to cancel.
     */
    function cancelLoan(uint256 loanId) external loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Pending, "Can only cancel pending loans");
        require(msg.sender  == loan.borrower,      "Only borrower can cancel");

        loan.status    = LoanStatus.Cancelled;
        loan.completed = true;

        (bool sent, ) = loan.borrower.call{value: loan.collateralAmount}("");
        require(sent, "Collateral return failed");

        emit LoanCancelled(loanId, loan.borrower);
    }

    // ═══════════════════════════════════════════════════════════════
    //  CHAINLINK PRICE FEED
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Fetch the latest ETH/USD price from Chainlink.
     * @return price      ETH price in USD with 8 decimal places
     *                    e.g. 200000000000 = $2000.00000000
     * @return updatedAt  Timestamp of the last price update
     *
     * Reverts if:
     *   • answer is zero or negative (invalid price)
     *   • data is stale (older than PRICE_STALENESS_LIMIT = 1 hour)
     */
    function getLatestPrice() public view returns (uint256 price, uint256 updatedAt) {
        (
            /* roundId */,
            int256 answer,
            /* startedAt */,
            uint256 _updatedAt,
            /* answeredInRound */
        ) = priceFeed.latestRoundData();

        require(answer > 0,                                   "Invalid price from oracle");
        require(block.timestamp - _updatedAt <= PRICE_STALENESS_LIMIT, "Price data is stale");

        price     = uint256(answer);   // already 8-decimal USD
        updatedAt = _updatedAt;
    }

    /**
     * @notice Calculate the USD value of a given ETH amount using current price.
     * @param  amountWei  Amount of ETH in wei
     * @return valueUsd8  Value in USD with 8 decimal places
     *
     * Example: 2 ETH at $2000 → 400000000000 (= $4000 × 1e8)
     */
    function getCollateralValue(uint256 amountWei) public view returns (uint256 valueUsd8) {
        (uint256 ethPrice, ) = getLatestPrice();
        valueUsd8 = LoanMath.collateralValueUsd(amountWei, ethPrice);
    }

    // ═══════════════════════════════════════════════════════════════
    //  PURE MATH VIEWS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Calculate simple interest.
     * @param  principal    Loan principal in wei
     * @param  annualRate   Annual rate in basis points (e.g. 1200 = 12%)
     * @param  timeElapsed  Seconds elapsed since loan start
     * @return interest     Interest owed in wei
     *
     * Formula: interest = principal × annualRate × timeElapsed / (10000 × 365 days)
     */
    function calculateInterest(
        uint256 principal,
        uint256 annualRate,
        uint256 timeElapsed
    ) public pure returns (uint256 interest) {
        interest = LoanMath.simpleInterest(principal, annualRate, timeElapsed);
    }

    /**
     * @notice Total amount the borrower must send to repayLoan right now.
     * @param  loanId  The active loan
     * @return owed    principal + accrued interest in wei
     */
    function totalOwed(uint256 loanId) external view loanExists(loanId) returns (uint256 owed) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        uint256 elapsed = block.timestamp - loan.startDate;
        owed = loan.principal + calculateInterest(loan.principal, loan.interestRate, elapsed);
    }

    /**
     * @notice Current collateral ratio without price feed (collateral/principal × 100).
     *         Used for quick checks not requiring USD conversion.
     * @param  loanId  The loan
     * @return ratio   Integer percentage (e.g. 150)
     */
    function collateralRatio(uint256 loanId) external view loanExists(loanId) returns (uint256 ratio) {
        Loan storage loan = loans[loanId];
        if (loan.principal == 0) return 0;
        ratio = (loan.collateralAmount * 100) / loan.principal;
    }

    /**
     * @notice Price-adjusted collateral ratio using Chainlink live price.
     *         This is what liquidateLoanIfNeeded uses.
     * @param  loanId  The loan
     * @return ratio   Integer percentage based on current USD values
     */
    function collateralRatioWithPrice(uint256 loanId) external view loanExists(loanId) returns (uint256 ratio) {
        Loan storage loan = loans[loanId];
        (uint256 ethPrice, ) = getLatestPrice();
        ratio = LoanMath.collateralRatioWithPrice(
            loan.collateralAmount,
            loan.principal,
            ethPrice
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  QUERY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Return all fields of a loan as a tuple.
     * @param  loanId  The loan to query
     */
    function getLoan(uint256 loanId) external view loanExists(loanId) returns (
        uint256    id,
        address    borrower,
        address    lender,
        uint256    principal,
        uint256    collateralAmount,
        uint256    interestRate,
        uint256    startDate,
        uint256    dueDate,
        bool       repaid,
        bool       completed,
        bool       defaulted,
        uint256    durationDays,
        uint8      status
    ) {
        Loan storage l = loans[loanId];
        return (
            l.id,
            l.borrower,
            l.lender,
            l.principal,
            l.collateralAmount,
            l.interestRate,
            l.startDate,
            l.dueDate,
            l.repaid,
            l.completed,
            l.defaulted,
            l.durationDays,
            uint8(l.status)
        );
    }

    /**
     * @notice Return all loan IDs where `user` is borrower OR lender.
     * @param  user     The address to query
     * @return loanIds  Array of loan IDs (unsorted, may contain duplicates if
     *                  same address borrows from themselves — prevented by fundLoan)
     */
    function getUserLoans(address user) external view returns (uint256[] memory loanIds) {
        return _userLoans[user];
    }

    /**
     * @notice Reputation score 0–100. Higher = safer borrower.
     *         Starts at 80, +5 per clean repayment (capped at 100), -25 per default.
     * @param  borrower  Address to score
     * @return score     0–100
     */
    function riskScore(address borrower) external view returns (uint256 score) {
        score = 80;
        uint256 bonus   = loansCompleted[borrower] * 5;
        uint256 penalty = loansDefaulted[borrower] * 25;

        score = (score + bonus > 100) ? 100 : score + bonus;
        score = (penalty >= score)    ? 0   : score - penalty;
    }

    // ═══════════════════════════════════════════════════════════════
    //  FALLBACK
    // ═══════════════════════════════════════════════════════════════

    /// @dev Accept plain ETH transfers (e.g. from test harness)
    receive() external payable {}
}