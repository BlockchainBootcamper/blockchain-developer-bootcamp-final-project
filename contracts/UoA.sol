// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract UoA is ERC20, Ownable {
    constructor() ERC20('UnitOfAccounting', 'UoA') {}

    function mint(address recipient, uint value) public onlyOwner {
        _mint(recipient, value);
    }

    function burn(uint value) public {
        _burn(msg.sender, value);
    }
}