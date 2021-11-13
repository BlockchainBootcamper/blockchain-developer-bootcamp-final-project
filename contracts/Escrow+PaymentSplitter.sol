// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


contract EscrowPaymentSplitter is Ownable {
    function openEscrowSlot() public onlyOwner returns(uint) {
        // What parameters for the payment splitting definition? storage would be an array where the element is a struct with address and amount
        // add the payment splitting definition to storage
        // return slotId
    }

    function getPaymentSplittingDefition(uint slotId) public view {
        // return payment splitting definition from storage
    }

    function fillEscrowSlot(uint slotId) public {
        // call the token contract's transferFrom(...)
        // store msg_sender as the only address allowed to call settle
        // mark slot as filled
    }

    function getEscrowedValue() public view returns(uint) {
        // iterate through open slots, if the slot has been filled but not settled, iterate through the payment splitter definition looking for the msg_sender
        // sum up values
        // return total
    }

    function settle(uint escrowSlotId) public {
        // check that slot was filled but not settled
        // check that msg.sender is the address that filled the slot
        // iterate through the payment splitting definition and call the token contract's transfer() for each element
    }
}