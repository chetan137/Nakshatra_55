// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LoanMath
 * @notice Pure math helpers for the lending platform.
 *         All arithmetic uses Solidity ^0.8.x built-in overflow checks.
 */
library LoanMath {

    uint256 internal constant BPS_DENOMINATOR = 10_000;   // basis-point scale
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant PRICE_DECIMALS    = 1e8;    // Chainlink 8-decimal prices

    /**
     * @notice Simple interest: I = P * rate(bps) * elapsed / (10000 * 365 days)
     * @param principal     Loan principal in wei
     * @param rateBps       Annual interest rate in basis points (e.g. 1200 = 12%)
     * @param elapsed       Seconds elapsed since loan start
     * @return interest     Interest owed in wei
     */
    function simpleInterest(
        uint256 principal,
        uint256 rateBps,
        uint256 elapsed
    ) internal pure returns (uint256 interest) {
        interest = (principal * rateBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    /**
     * @notice Collateral value in USD (8-decimal fixed point).
     * @param collateralWei   Amount of ETH collateral in wei
     * @param ethPriceUsd8    ETH/USD price from Chainlink (8 decimals, e.g. 200000000000 = $2000)
     * @return valueUsd8      Collateral value in USD with 8 decimals
     *
     * Example:
     *   collateralWei  = 1.5e18   (1.5 ETH)
     *   ethPriceUsd8   = 2000e8   ($2000 per ETH)
     *   → valueUsd8    = 1.5e18 * 2000e8 / 1e18 = 3000e8  ($3000)
     */
    function collateralValueUsd(
        uint256 collateralWei,
        uint256 ethPriceUsd8
    ) internal pure returns (uint256 valueUsd8) {
        valueUsd8 = (collateralWei * ethPriceUsd8) / 1 ether;
    }

    /**
     * @notice Principal value in USD (8-decimal fixed point).
     * @param principalWei    Loan principal in wei
     * @param ethPriceUsd8    ETH/USD price from Chainlink (8 decimals)
     * @return valueUsd8      Principal value in USD with 8 decimals
     */
    function principalValueUsd(
        uint256 principalWei,
        uint256 ethPriceUsd8
    ) internal pure returns (uint256 valueUsd8) {
        valueUsd8 = (principalWei * ethPriceUsd8) / 1 ether;
    }

    /**
     * @notice Collateral ratio as a percentage (e.g. 150 = 150%).
     *         ratio = collateralValueUsd * 100 / principalValueUsd
     *
     * @param collateralWei   ETH collateral in wei
     * @param principalWei    Loan principal in wei
     * @param ethPriceUsd8    Current ETH/USD price (Chainlink, 8 decimals)
     * @return ratio          Ratio as integer percentage (e.g. 150)
     *
     * NOTE: Both values use same ETH price so it cancels out — ratio is
     *       simply collateral/principal * 100.  The price feed is still
     *       passed in for future multi-asset support.
     */
    function collateralRatioWithPrice(
        uint256 collateralWei,
        uint256 principalWei,
        uint256 ethPriceUsd8
    ) internal pure returns (uint256 ratio) {
        if (principalWei == 0) return type(uint256).max;
        uint256 cVal = collateralValueUsd(collateralWei, ethPriceUsd8);
        uint256 pVal = principalValueUsd(principalWei,   ethPriceUsd8);
        ratio = (cVal * 100) / pVal;
    }
}
