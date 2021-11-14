// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


contract EscrowPaymentSplitter is Ownable {
    
    struct PaymentSplittingDefinition {
        address[] recipients;
        uint[] amounts;
    }
    
    struct EscrowSlot {
        uint id;
        bool filled;
        PaymentSplittingDefinition paymentSplittingDefinition;
    }

    EscrowSlot[] escrowSlots;
    uint lastEscrowSlotId;

    function openEscrowSlot(PaymentSplittingDefinition memory paymentSplittingDefinition) public onlyOwner returns(uint) {
        uint slotId = lastEscrowSlotId++;
        EscrowSlot memory slot;
        slot.id = slotId;
        escrowSlots.push(slot);
        escrowSlots[escrowSlots.length - 1].paymentSplittingDefinition = paymentSplittingDefinition;
        return slotId;
    }

    function getPaymentSplittingDefition(uint slotId) public view returns(PaymentSplittingDefinition memory){
        for(uint i = 0; i < escrowSlots.length; i++){
            if(escrowSlots[i].id == slotId){
                return escrowSlots[i].paymentSplittingDefinition;
            }
        }
        PaymentSplittingDefinition memory paymentSplittingDefinition;
        return paymentSplittingDefinition;
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