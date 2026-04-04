// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LendingPlatform
 * @notice Peer-to-peer lending with collateral lock, auto-liquidation logic,
 *         interest accrual, and reputation tracking.
 *
 * FLOW:
 *  1. Borrower calls createLoan(duration, interestRate) + sends ETH as collateral
 *     — collateral must be >= 150% of requested loan amount
 *  2. Lender calls fundLoan(loanId) + sends ETH equal to loan.amount
 *     — borrower instantly receives the loan ETH
 *  3. Borrower calls repayLoan(loanId) + sends ETH (principal + interest)
 *     — lender receives repayment; borrower gets collateral back
 *  4. Anyone can call liquidate(loanId) after deadline if not repaid
 *     — lender gets collateral; borrower's defaultCount goes up
 */
contract LendingPlatform {

    // ─────────────────────── CONSTANTS ───────────────────────
    uint256 public constant MIN_COLLATERAL_RATIO = 150; // 150% — borrower must lock 1.5x loan amount
    uint256 public constant PRECISION = 100;

    // ─────────────────────── STRUCTS ─────────────────────────
    enum LoanStatus { Pending, Active, Repaid, Defaulted, Cancelled }

    struct Loan {
        uint256 id;
        address payable borrower;
        address payable lender;
        uint256 principal;        // ETH amount borrower wants (wei)
        uint256 collateral;       // ETH locked as insurance (wei)
        uint256 interestRateBps;  // Annual interest in basis points (e.g. 1200 = 12%)
        uint256 durationDays;     // Loan duration in days
        uint256 startTime;        // When lender funded the loan
        uint256 dueDate;          // startTime + durationDays
        LoanStatus status;
    }

    // ─────────────────────── STATE ───────────────────────────
    uint256 public loanCounter;
    mapping(uint256 => Loan) public loans;

    // Reputation tracking
    mapping(address => uint256) public loansCompleted;
    mapping(address => uint256) public loansDefaulted;
    mapping(address => uint256) public totalLent;   // in wei
    mapping(address => uint256) public totalBorrowed; // in wei

    // ─────────────────────── EVENTS ──────────────────────────
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 collateral,
        uint256 interestRateBps,
        uint256 durationDays
    );
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 dueDate);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalPaid);
    event LoanLiquidated(uint256 indexed loanId, address indexed lender, uint256 collateralReceived);
    event LoanCancelled(uint256 indexed loanId, address indexed borrower);

    // ─────────────────────── MODIFIERS ───────────────────────
    modifier loanExists(uint256 loanId) {
        require(loanId < loanCounter, "Loan does not exist");
        _;
    }

    // ═══════════════════════════════════════════════════
    // STEP 1 — Borrower creates loan request
    // ═══════════════════════════════════════════════════
    /**
     * @param principal     How much ETH borrower wants to receive (in wei)
     * @param durationDays  Loan duration (1–365 days)
     * @param interestRateBps Annual rate in basis points (e.g. 1200 = 12%)
     *
     * msg.value = collateral ETH deposited. Must be >= 150% of principal.
     *
     * Example: borrower wants 1 ETH loan.
     *   → must send at least 1.5 ETH as msg.value (collateral)
     *   → call: createLoan(1 ether, 30, 1200) with {value: 1.5 ether}
     */
    function createLoan(
        uint256 principal,
        uint256 durationDays,
        uint256 interestRateBps
    ) external payable returns (uint256 loanId) {
        require(principal > 0, "Principal must be > 0");
        require(durationDays >= 1 && durationDays <= 730, "Duration: 1-730 days");
        require(interestRateBps > 0 && interestRateBps <= 10000, "Rate: 1-10000 bps");
        require(msg.value > 0, "Must deposit collateral");

        // ── Collateral ratio check ──
        // ratio = (collateral * 100) / principal >= 150
        uint256 ratio = (msg.value * PRECISION) / principal;
        require(ratio >= MIN_COLLATERAL_RATIO, "Collateral must be >= 150% of principal");

        loanId = loanCounter++;

        loans[loanId] = Loan({
            id:               loanId,
            borrower:         payable(msg.sender),
            lender:           payable(address(0)),
            principal:        principal,
            collateral:       msg.value,    // collateral is locked in contract
            interestRateBps:  interestRateBps,
            durationDays:     durationDays,
            startTime:        0,
            dueDate:          0,
            status:           LoanStatus.Pending
        });

        totalBorrowed[msg.sender] += principal;

        emit LoanCreated(loanId, msg.sender, principal, msg.value, interestRateBps, durationDays);
    }

    // ═══════════════════════════════════════════════════
    // STEP 2 — Lender funds the loan
    // ═══════════════════════════════════════════════════
    /**
     * Lender sends exactly loan.principal ETH.
     * Contract immediately forwards it to the borrower.
     * Collateral remains locked until repayment or liquidation.
     */
    function fundLoan(uint256 loanId) external payable loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Pending, "Loan not pending");
        require(msg.sender != loan.borrower, "Borrower cannot fund own loan");
        require(msg.value == loan.principal, "Must send exact principal amount");

        loan.lender    = payable(msg.sender);
        loan.startTime = block.timestamp;
        loan.dueDate   = block.timestamp + (loan.durationDays * 1 days);
        loan.status    = LoanStatus.Active;

        totalLent[msg.sender] += loan.principal;

        // Immediately send principal to borrower
        (bool sent, ) = loan.borrower.call{value: loan.principal}("");
        require(sent, "Transfer to borrower failed");

        emit LoanFunded(loanId, msg.sender, loan.dueDate);
    }

    // ═══════════════════════════════════════════════════
    // STEP 3 — Borrower repays loan
    // ═══════════════════════════════════════════════════
    /**
     * Borrower sends principal + interest.
     * Contract sends repayment to lender and returns collateral to borrower.
     *
     * Interest formula: principal * rate * timeElapsed / (10000 * 365 days)
     */
    function repayLoan(uint256 loanId) external payable loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Active, "Loan not active");
        require(msg.sender == loan.borrower, "Only borrower can repay");

        uint256 interest       = calculateInterest(loanId);
        uint256 totalOwed      = loan.principal + interest;

        require(msg.value >= totalOwed, "Insufficient repayment amount");

        loan.status = LoanStatus.Repaid;
        loansCompleted[loan.borrower]++;

        // Send repayment to lender
        (bool toL, ) = loan.lender.call{value: totalOwed}("");
        require(toL, "Transfer to lender failed");

        // Return collateral to borrower
        (bool toB, ) = loan.borrower.call{value: loan.collateral}("");
        require(toB, "Collateral return failed");

        // Refund any excess sent by borrower
        if (msg.value > totalOwed) {
            (bool refund, ) = loan.borrower.call{value: msg.value - totalOwed}("");
            require(refund, "Refund failed");
        }

        emit LoanRepaid(loanId, loan.borrower, totalOwed);
    }

    // ═══════════════════════════════════════════════════
    // STEP 4 — Liquidate overdue loan
    // ═══════════════════════════════════════════════════
    /**
     * Anyone can call this after dueDate if loan not repaid.
     * Collateral goes to lender. Borrower default count increases.
     *
     * NOTE: In a real system you'd call a Chainlink oracle price feed here
     * to compare collateral VALUE vs current ETH price. For simplicity,
     * liquidation happens based on time (past dueDate) only.
     */
    function liquidate(uint256 loanId) external loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Active, "Loan not active");
        require(block.timestamp > loan.dueDate, "Loan not yet overdue");

        loan.status = LoanStatus.Defaulted;
        loansDefaulted[loan.borrower]++;

        // Send collateral to lender as compensation
        uint256 collateral = loan.collateral;
        (bool sent, ) = loan.lender.call{value: collateral}("");
        require(sent, "Transfer to lender failed");

        emit LoanLiquidated(loanId, loan.lender, collateral);
    }

    // ═══════════════════════════════════════════════════
    // CANCEL — Borrower cancels before funded
    // ═══════════════════════════════════════════════════
    function cancelLoan(uint256 loanId) external loanExists(loanId) {
        Loan storage loan = loans[loanId];

        require(loan.status == LoanStatus.Pending, "Can only cancel pending loans");
        require(msg.sender == loan.borrower, "Only borrower can cancel");

        loan.status = LoanStatus.Cancelled;

        // Return collateral to borrower
        (bool sent, ) = loan.borrower.call{value: loan.collateral}("");
        require(sent, "Collateral return failed");

        emit LoanCancelled(loanId, loan.borrower);
    }

    // ═══════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════

    /**
     * Calculate current interest owed on an active loan.
     * Uses simple annual interest: I = P * R * T / (10000 * 365 days)
     */
    function calculateInterest(uint256 loanId) public view loanExists(loanId) returns (uint256) {
        Loan storage loan = loans[loanId];
        if (loan.status != LoanStatus.Active) return 0;

        // Use actual elapsed time, capped at dueDate  
        uint256 elapsed = block.timestamp > loan.dueDate
            ? (loan.dueDate - loan.startTime)
            : (block.timestamp - loan.startTime);

        // interest = principal * rateBps * elapsed / (10000 * 365 days)
        return (loan.principal * loan.interestRateBps * elapsed) / (10000 * 365 days);
    }

    /**
     * Total amount borrower must repay right now.
     */
    function totalOwed(uint256 loanId) external view loanExists(loanId) returns (uint256) {
        Loan storage loan = loans[loanId];
        return loan.principal + calculateInterest(loanId);
    }

    /**
     * Current collateral ratio (how safe this loan is right now).
     * ratio = collateral * 100 / principal
     * >= 150 = safe, < 120 = liquidation zone
     */
    function collateralRatio(uint256 loanId) external view loanExists(loanId) returns (uint256) {
        Loan storage loan = loans[loanId];
        if (loan.principal == 0) return 0;
        return (loan.collateral * PRECISION) / loan.principal;
    }

    /**
     * Risk score for a borrower (0–100). Higher = safer to lend to.
     * Formula: starts at 80, +5 per completion (max 100), -25 per default.
     */
    function riskScore(address borrower) external view returns (uint256) {
        uint256 score = 80;
        uint256 completed = loansCompleted[borrower];
        uint256 defaulted = loansDefaulted[borrower];

        // Bonus for repaying
        uint256 bonus = completed * 5;
        if (score + bonus > 100) score = 100;
        else score += bonus;

        // Penalty for defaults
        uint256 penalty = defaulted * 25;
        if (penalty >= score) return 0;
        return score - penalty;
    }

    /**
     * Get all fields of a loan in one call.
     */
    function getLoan(uint256 loanId) external view loanExists(loanId) returns (
        uint256 id,
        address borrower,
        address lender,
        uint256 principal,
        uint256 collateral,
        uint256 interestRateBps,
        uint256 durationDays,
        uint256 startTime,
        uint256 dueDate,
        uint8   status
    ) {
        Loan storage l = loans[loanId];
        return (
            l.id, l.borrower, l.lender,
            l.principal, l.collateral,
            l.interestRateBps, l.durationDays,
            l.startTime, l.dueDate,
            uint8(l.status)
        );
    }

    receive() external payable {}
}
