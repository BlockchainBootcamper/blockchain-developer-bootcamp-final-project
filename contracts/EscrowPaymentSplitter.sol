// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Strings.sol';


contract EscrowPaymentSplitter is Ownable {
    
    struct PaymentSplittingDefinition {
        address[] recipients;
        uint[] amounts;
    }
    
    struct EscrowSlot {
        uint id;
        bool filled;
        address payer;          // Set in fillEscrowSlot(), the only address allowed to call settle()
        PaymentSplittingDefinition paymentSplittingDefinition;
    }

    EscrowSlot[] escrowSlots;
    uint lastEscrowSlotId;
    address tokenContractAddress;
    using Strings for uint256;

    constructor(address tokenContract){
        tokenContractAddress = tokenContract;
    }

    function openEscrowSlot(PaymentSplittingDefinition memory paymentSplittingDefinition) public onlyOwner returns(uint) {
        // determine slot ID, instantiate struct and set ID
        uint slotId = lastEscrowSlotId++;
        EscrowSlot memory slot;
        slot.id = slotId;
        // add slot to storage and add payment splitting definition with its dynamic arrays (can only be done on storage)
        escrowSlots.push(slot);
        escrowSlots[escrowSlots.length - 1].paymentSplittingDefinition = paymentSplittingDefinition;
        return slotId;
    }

    function getPaymentSplittingDefition(uint slotId) public view returns(PaymentSplittingDefinition memory){
        uint slotIndex = getEscrowSlotIndex(slotId);                   // reverts if slot doesn't exist
        return escrowSlots[slotIndex].paymentSplittingDefinition;
    }

    function fillEscrowSlot(uint slotId) public {
        uint slotIndex = getEscrowSlotIndex(slotId);                   // reverts if slot doesn't exist
        // compute total slot value from payment splitting definition
        uint val;
        for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
            val += escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i];
        }
        // transfer value into tbis contract to escrow it
        IERC20 tokenContract = IERC20(tokenContractAddress);
        tokenContract.transferFrom(msg.sender, address(this), val);     // reverts if value can't be collectedd
        // update state
        escrowSlots[slotIndex].payer = msg.sender;
        escrowSlots[slotIndex].filled = true;
    }

    function isEscrowSlotFilled(uint slotId) public view returns(bool) {
        uint slotIndex = getEscrowSlotIndex(slotId);
        return escrowSlots[slotIndex].filled;
    }

    /**  Returns the value escrowed for the caller
         If the slot is not filled or the caller is not in the payment splitting definition, returns 0
     */
    function getEscrowedValue(uint slotId) public view returns(uint) {
        uint slotIndex = getEscrowSlotIndex(slotId);
        if(escrowSlots[slotIndex].filled){
            for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
                if(escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i] == msg.sender){
                    return escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i];
                }
            }
        }
        return 0;
    }

    function settleEscrowSlot(uint slotId) public {
        uint slotIndex = getEscrowSlotIndex(slotId);            // reverts if slot doesn't exist
        // validate conditions for settling: slot was filled + it's the address that filled it that is calling
        require(escrowSlots[slotIndex].filled, string(abi.encodePacked("Slot with ID ", slotId.toString(), " was not filled and can't be settled")));
        require(escrowSlots[slotIndex].payer == msg.sender, "Slot can only be settled by payer");
        // execute payment splitting definition
        IERC20 tokenContract = IERC20(tokenContractAddress);
        for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
            tokenContract.transfer(escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i], escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i]);
        }
        // Remove escrow slot
        for(uint i = slotIndex; i < (escrowSlots.length - 1); i++){
            escrowSlots[i] = escrowSlots[i+1];
        }
        escrowSlots.pop();
    }

    function getEscrowSlotIndex(uint slotId) internal view returns(uint){
        for(uint i = 0; i < escrowSlots.length; i++){
            if(escrowSlots[i].id == slotId){
                return i;
            }
        }
        revert(string(abi.encodePacked("Slot with ID ", slotId.toString(), " doesn't exist")));
    }
}