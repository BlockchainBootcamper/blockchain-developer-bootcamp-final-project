// SPDX-License-Identifier: Unlicensed
pragma solidity 0.8.10;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Strings.sol';

/**
 * @title Escrow & payment splitter smart contract for a supply consolidation service usecase
 * @author DonTseTse
 * @notice Escrow working with 'slots', which are created with a payment splitting definition, funded and finally settled. Maintains a recipient balance which is credited on settlement
 */
contract EscrowPaymentSplitter is Ownable {
    ///@dev uses OpenZeppelin's SafeMath for arithmetics in the contract
    using SafeMath for uint;
    ///@dev uses OpenZeppelin's Strings utility to be able to have numbers (the slot ID) in revert messages
    using Strings for uint256;

    // ***** Data type definitions *****
    /** 
     * @dev data structure to represent recipients and amounts in an array of native Solidity types instead of an array of custom type => see ../design_choices.md for the reasons
     * @dev each payment splitter is the one index in both arrays, i.e. splitter = <recipients[i], amounts[i]>
     */
    struct PaymentSplittingDefinition {
        address[] recipients;
        uint[] amounts;
    }
    
    ///@dev data structure to represent an escrow slot. Payer address is the only one allowed to settle the slot once funded
    struct EscrowSlot {
        uint id;
        bool funded;
        address payer;
        PaymentSplittingDefinition paymentSplittingDefinition;
    }

    /**
     * @dev emitted when a slot is opened
     * @param externalId ID with which the escrow slot is linked in the calling system (usually an order ID). Has no meaning inside the contract
     * @param slotId ID of the opened escrow slot - used in all escrow specific methods
     */
    event EscrowSlotOpened(uint indexed externalId, uint indexed slotId);
    /**
     * @dev emitted when a slot is funded
     * @param slotId ID of the slot which was funded
     */
    event EscrowSlotFunded(uint indexed slotId);
    /**
     * @dev emitted when a recipient balance is modified during settlement or on fund withdrawal
     * @param recipient address of which the balance is modified
     * @param balance new withdrawal allowance
     */
    event WithdrawalAllowance(address indexed recipient, uint balance);
    /**
     * @dev emitted when a slot is settled
     * @param slotId ID of the slot which was settled
     */
    event EscrowSlotSettled(uint indexed slotId);

    // ***** State in storage *****
    /// Escrow slot state variable
    EscrowSlot[] private escrowSlots;
    /// Escrow slot counter state variable, used to give each slot a unique ID
    uint private lastEscrowSlotId;
    /// Address of the ERC20 token contract
    address public tokenContractAddress;
    /// Balance mapping for funds received upon escrow slot settlement
    mapping (address => uint) public recipientFunds;

    // ***** Methods *****

    /**
    * @dev contract constructor. Sets the owner via Ownable() as well as the token contract address
    * @param tokenContract address of the token contract
    */
    constructor(address tokenContract) Ownable(){
        tokenContractAddress = tokenContract;
    }

    /* Note: the goal is to return more specific error messages on error / Ether transfer than the basic undifferentiated revert which gets triggered if fallback() and/or receive() are not implemented
             Weird: if both are implemented the criteria which one is called is not msg.value, but msg.data 
             => if there's no data receive() is called, even if there's no Ether
             => even with receive() implemented fallback() should be declared payable otherwise calls with data and value still get the basic revert
             A fallback() handling it all would be more comprehensive but when it's payable the compiler warns it would like to see a receive() as well :(
    */
    /// @dev gets executed when the contract is called with data which doesn't match a function signature (regardless whether there's Ether sent or not, see note above)
    fallback() external payable {revert('Erronous call, fallback() triggered');}
    /// @dev gets executed when there's no data sent in the transaction (even if there's no Ether, see note above)
    receive() external payable {revert(msg.value > 0 ? 'Contract doesn\'t accept Ether' : 'Erronous call without data nor value, receive() triggered');}
    
    /**
    * @notice opens an escrow slot
    * @dev only accessible to the contract owner (i.e. the supply consolidation service)
    * @param externalId ID of external source passed through to the EscrowSlotOpened event
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
    * @notice getter for a slot's payment splitting definition
    * @param slotId ID of the escrow slot
    * @return payment splitting definition - a struct with attributes recipients (type address[]) and amounts (uint[])
    */
    function getPaymentSplittingDefinition(uint slotId) public view returns(PaymentSplittingDefinition memory){
        uint slotIndex = getEscrowSlotIndex(slotId);                   // reverts if slot doesn't exist
        return escrowSlots[slotIndex].paymentSplittingDefinition;
    }

    /**
    * @notice funds the escrow slot from the caller (i.e. transfers the value from the caller to the contract)
    * @param slotId ID of the escrow slot
    */
    function fundEscrowSlot(uint slotId) public {
        handleEscrowSlotFunding(slotId, msg.sender);
    }

    /**
    * @notice funds the escrow slot from the payer address (i.e. transfers the value from the payer address to the contract)
    * @dev can only be called by the contract owner (i.e. the supply consolidation service)
    * @param slotId ID of the escrow slot
    * @param payer address of the escrow slot payer
    */
    function fundEscrowSlotFrom(uint slotId, address payer) public onlyOwner {
        handleEscrowSlotFunding(slotId, payer);
    }

    /**
    * @notice getter for a slot's funding status
    * @param slotId ID of the escrow slot
    * @return funding status of the slot - if true, slot value is escrowed by the contract
    */
    function isEscrowSlotFunded(uint slotId) public view returns(bool) {
        uint slotIndex = getEscrowSlotIndex(slotId);
        return escrowSlots[slotIndex].funded;
    }

    /**
    * @notice getter returning a slot's escrowed amount for the caller
    * @param slotId ID of the escrow slot
    * @return a uint for the amount escrowed by the contract for the caller, 0 if the slot has not been funded or if the caller is not a recipient in the payment splitting definition
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
    * @notice executes the payment splitting definition (i.e. credits the escrowed amounts to the recipient's balances)
    * @dev Can only be called by the address that funded the slot. Deletes the slot if successful.
    * @param slotId ID of the escrow slot
    */
    function settleEscrowSlot(uint slotId) public {
        uint slotIndex = getEscrowSlotIndex(slotId);            // reverts if slot doesn't exist
        // validate conditions for settling: slot was funded + it's the address that funded it that is calling
        require(escrowSlots[slotIndex].funded, string(abi.encodePacked("Slot with ID ", slotId.toString(), " was not funded and can't be settled")));
        require(escrowSlots[slotIndex].payer == msg.sender, "Slot can only be settled by payer");
        // execute payment splitting definition
        for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
            recipientFunds[escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i]] = SafeMath.add(recipientFunds[escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i]], escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i]);
            emit WithdrawalAllowance(escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i], recipientFunds[escrowSlots[slotIndex].paymentSplittingDefinition.recipients[i]]);
        }
        // Remove escrow slot
        for(uint i = slotIndex; i < (escrowSlots.length - 1); i++){
            escrowSlots[i] = escrowSlots[i+1];
        }
        escrowSlots.pop();
        emit EscrowSlotSettled(slotId);
    }

    /// @notice transfers all funds held for the caller.  Reverts if the caller has no funds awaiting
    function withdrawReceivedFunds() public {
        require(recipientFunds[msg.sender] > 0, 'No funds to withdraw');
        IERC20 tokenContract = IERC20(tokenContractAddress);
        bool success = tokenContract.transfer(msg.sender, recipientFunds[msg.sender]);
        if(success){
            recipientFunds[msg.sender] = 0;
            emit WithdrawalAllowance(msg.sender, 0);
        }
    }

    // *** Internal helpers
    /**
    * @dev internal handler which funds the escrow slot (i.e. transfers the value from the payer address to the contract) and updates escrow slot state
    * @param slotId ID of the escrow slot
    * @param payer address of the escrow slot payer/funder
    */
    function handleEscrowSlotFunding(uint slotId, address payer) private {
        uint slotIndex = getEscrowSlotIndex(slotId);                   // reverts if slot doesn't exist
        require(!escrowSlots[slotIndex].funded, string(abi.encodePacked("Slot with ID ", slotId.toString(), " was already funded")));
        // compute total slot value from payment splitting definition
        uint val;
        for(uint i = 0; i < escrowSlots[slotIndex].paymentSplittingDefinition.recipients.length; i++){
            val = SafeMath.add(val, escrowSlots[slotIndex].paymentSplittingDefinition.amounts[i]);
        }
        // transfer value into tbis contract to escrow it
        IERC20 tokenContract = IERC20(tokenContractAddress);
        bool success = tokenContract.transferFrom(payer, address(this), val);     // reverts if value can't be collected
        // update state if successful
        if(success){
            escrowSlots[slotIndex].payer = payer;
            escrowSlots[slotIndex].funded = true;
            emit EscrowSlotFunded(slotId);
        }
    }

    /**
    * @dev internal function to find the index inside the state's dynamic array of an escrow slot with a given ID. Reverts if the ID doesn't exist
    * @param slotId ID of the escrow slot
    * @return uint the index of the slot inside the state's escrowSlots dynamic array
    */
    function getEscrowSlotIndex(uint slotId) private view returns(uint){
        for(uint i = 0; i < escrowSlots.length; i++){
            if(escrowSlots[i].id == slotId){
                return i;
            }
        }
        revert(string(abi.encodePacked("Slot with ID ", slotId.toString(), " doesn't exist")));
    }
}