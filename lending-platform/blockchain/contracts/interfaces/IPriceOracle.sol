// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceOracle
 * @notice Interface for getting price feeds from external oracles like Chainlink.
 */
interface IPriceOracle {
    /**
     * @notice Get the latest price of the asset
     * @return price The current price with 8 decimal places
     * @return timestamp The timestamp of the price update
     */
    function getLatestPrice() external view returns (uint256 price, uint256 timestamp);

    /**
     * @notice Get historical price at a specific round
     * @param roundId The round ID
     * @return price The price at that round
     */
    function getPriceAtRound(uint80 roundId) external view returns (uint256 price);
}
