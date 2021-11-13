// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract UoA is ERC20 {
    constructor() ERC20('UnitOfAccounting', 'UoA') {}
}