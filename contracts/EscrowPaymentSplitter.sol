// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Strings.sol';


contract EscrowPaymentSplitter is Ownable {
    using Strings for uint256;

    // ***** Data type definitions *****
    /** Storage structure to represent recipients and amounts in an array of native Solidity types instead of an array of custom type => see ../design_choices.md 
     *  for the reasons
     *  each payment splitter is the one index in both arrays, i.e. splitter = <recipients[i], amounts[i]>
     */
    struct PaymentSplittingDefinition {
        address[] recipients;
        uint[] amounts;
    }
    
    // Main data storage structure
    struct EscrowSlot {
        uint id;
        bool funded;
        address payer;          // Set in handleEscrowSlotFunding(), the only address allowed to call settleEscrowSlot()
        PaymentSplittingDefinition paymentSplittingDefinition;
    }

    // Events: slot opened, funded, settled
    event EscrowSlotOpened(uint externalId, uint slotId);
    event EscrowSlotFunded(uint slotId);
    event EscrowSlotSettled(uint slotId);

    // ***** State in storage *****
    EscrowSlot[] escrowSlots;
    uint lastEscrowSlotId;
    address tokenContractAddress;

    // ***** Methods *****

    /**
    * @dev contract constructor. Set the owner and the token contract
    *
    * @param tokenContract address of the token contract
    */
    constructor(address tokenContract) Ownable(){
        tokenContractAddress = tokenContract;
    }

    /**
    * @dev opens an escrow slot. Only accessible to the contract owner (i.e. the supplier consolidator service)
    *
    * @param externalId ID of external source passed through to the EscrowSlotOpened
    * @param paymentSplittingDefinition struct to describe payment splitting
    * @return ID of the escrow slot
    */
    function openEscrowSlot(uint externalId, PaymentSplittingDefinition memory paymentSplittingDefinition) public onlyOwner returns(uint) {
        // determine slot ID, instantiate struct and set ID
        uint slotId = lastEscrowSlotId++;
        EscrowSlot memory slot;
        slot.id = slotId;
        // add slot to storage and add payment splitting definition with its dynamic arrays (can only be done on storage)
        escrowSlots.push(slot);
        escrowSlots[escrowSlots.length - 1].paymentSplittingDefinition = paymentSplittingDefinition;
        emit EscrowSlotOpened(externalId, slotId);
        return slotId;
    }

    /**
    * @dev getter for a slot's payment splitting definition
    *
    * @param slotId ID of the escrow slot
    * @return payment splitting definition - a struct with attributes recipients (type address[]) and amounts (uint[])
    */
    function getPaymentSplittingDefinition(uint slotId) public view returns(PaymentSplittingDefinition memory){
        uint slotIndex = getEscrowSlotIndex(slotId);                   // reverts if slot doesn't exist
        return escrowSlots[slotIndex].paymentSplittingDefinition;
    }

    /**
    * @dev funds the escrow slot (i.e. transfers the value from the caller to the contract)
    *
    * @param slotId ID of the escrow slot
    */
    function fundEscrowSlot(uint slotId) public {
        handleEscrowSlotFunding(slotId, msg.sender);
    }

    /**
    * @dev funds the escrow slot from another address than the caller. Can only be called by the contract owner (i.e. the supplier consolidator service)
    *
    * @param slotId ID of the escrow slot
    * @param payer address of the escrow slot payer
    */
    function fundEscrowSlotFrom(uint slotId, address payer) public onlyOwner {
        handleEscrowSlotFunding(slotId, payer);
    }

    /**
    * @dev Internal handler which funds the escrow slot (i.e. transfers the value from the payer address to the contract) and updates escrow slot state
    *
    * @param slotId ID of the escrow slot
    * @param payer address of the escrow slot payer
    */
    function handleEscrowSlotFunding(uint slotId, address payer) internal {
        uint slotIndex = getEscrowSlotIndex(slotId);                   // reverts if slot doesn't exist
        require(!escrowSlots[slotIndex].funded, string(abi.encodePacked("Slot with ID ", slotId.toString(), " was already funded")));
        // compute total slot value from payment splitting definition
        uint val;
        for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
            val += escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i];
        }
        // transfer value into tbis contract to escrow it
        IERC20 tokenContract = IERC20(tokenContractAddress);
        tokenContract.transferFrom(payer, address(this), val);     // reverts if value can't be collectedd
        // update state
        escrowSlots[slotIndex].payer = payer;
        escrowSlots[slotIndex].funded = true;
        emit EscrowSlotFunded(slotId);
    }

    /**
    * @dev getter for a slot's funding status
    *
    * @param slotId ID of the escrow slot
    * @return funding status of the slot - if true, slot value is escrowed by the contract
    */
    function isEscrowSlotFunded(uint slotId) public view returns(bool) {
        uint slotIndex = getEscrowSlotIndex(slotId);
        return escrowSlots[slotIndex].funded;
    }

    /**
    * @dev getter for a slot's escrowed amount for to the caller
    *
    * @param slotId ID of the escrow slot
    * @return a uint for the amount escrowed by the contract for the caller, 0 if the slot has not been funded or if the caller is not in the payment splitting 
    *         definition
    */
    function getEscrowedValue(uint slotId) public view returns(uint) {
        uint slotIndex = getEscrowSlotIndex(slotId);
        if(escrowSlots[slotIndex].funded){
            for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
                if(escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i] == msg.sender){
                    return escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i];
                }
            }
        }
        return 0;
    }

    /**
    * @dev executes the payment splitting definition (i.e. transfers the escrowed amount to the recipients). Can only be called by the address that funded the slot
    *
    * @param slotId ID of the escrow slot
    */
    function settleEscrowSlot(uint slotId) public {
        uint slotIndex = getEscrowSlotIndex(slotId);            // reverts if slot doesn't exist
        // validate conditions for settling: slot was funded + it's the address that funded it that is calling
        require(escrowSlots[slotIndex].funded, string(abi.encodePacked("Slot with ID ", slotId.toString(), " was not funded and can't be settled")));
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
        emit EscrowSlotSettled(slotId);
    }

    // *** Internal helper
    /**
    * @dev internal function to find the index inside the state's dynamic array of an EscrowSlot with given ID. Reverts if escrow slot ID doesn't exist
    *
    * @param slotId ID of the escrow slot
    * @return uint the index of the slot inside the state's escrowSlots dynamic array
    */
    function getEscrowSlotIndex(uint slotId) internal view returns(uint){
        for(uint i = 0; i < escrowSlots.length; i++){
            if(escrowSlots[i].id == slotId){
                return i;
            }
        }
        revert(string(abi.encodePacked("Slot with ID ", slotId.toString(), " doesn't exist")));
    }
}