// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/AggregatorV3Interface.sol";

// Minimal Chainlink price feed mock for local Hardhat testing.
// Does NOT require the chainlink/contracts package.
//
// Usage in tests:
//   const Mock = await ethers.getContractFactory("MockV3AggregatorMinimal");
//   const feed = await Mock.deploy(8, ethers.parseUnits("2000", 8)); // $2000 ETH
//   await feed.updateAnswer(ethers.parseUnits("1500", 8));           // price drops to $1500
contract MockV3AggregatorMinimal is AggregatorV3Interface {
    uint8   public override decimals;
    int256  public latestAnswer;
    uint256 public latestTimestamp;
    uint80  public latestRound;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals        = _decimals;
        latestAnswer    = _initialAnswer;
        latestTimestamp = block.timestamp;
        latestRound     = 1;
    }

    /// @notice Update the mock price (used in tests to simulate price movements)
    function updateAnswer(int256 _answer) external {
        latestAnswer    = _answer;
        latestTimestamp = block.timestamp;
        latestRound++;
    }

    function description() external pure override returns (string memory) {
        return "MockV3Aggregator ETH / USD";
    }

    function version() external pure override returns (uint256) {
        return 4;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        )
    {
        return (_roundId, latestAnswer, latestTimestamp, latestTimestamp, _roundId);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        )
    {
        return (latestRound, latestAnswer, latestTimestamp, latestTimestamp, latestRound);
    }
}
