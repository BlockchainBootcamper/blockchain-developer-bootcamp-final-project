// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.10;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract UoA is Ownable, ERC20 {
    /**
    * @dev contract constructor. Set the owner and the token contract and the name/symbol of the ERC20
    */
    constructor() ERC20('UnitOfAccounting', 'UoA') Ownable() {}

    /**
    * @dev token mint function. Can only be called by the contract owner
    * @param recipient address for which the tokens are minted
    * @param value amount of tokens minted for the recipient
    */
    function mint(address recipient, uint value) public onlyOwner {
        _mint(recipient, value);
    }

    /**
    * @dev token burn function
    * @param value amount of tokens burned for the caller
    */
    function burn(uint value) public {
        _burn(msg.sender, value);
    }
}