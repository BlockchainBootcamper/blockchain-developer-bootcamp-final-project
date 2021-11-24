# Design pattern decisions

## Inheritance and Interfaces
The "UnitOfAccounting" (`UoA`) contract inherits OpenZeppelin's ERC20 implementation. The `EscrowPaymentSplitter` contract uses the IERC20 interface to call UoA methods. The EscrowPaymentSplitter contract also leverages OpenZeppelin's `SafeMath` library for arithmetic operations with over- & underflow checks and the `string` utility to be able to print more specific revert & require error messages.

## Inter contract execution
The `EscrowPaymentSplitter` smart-contract calls the UoA/ERC20 `transferFrom()` method to fund escrow slots. When payment recipients claim their funds using the `getReceivedFunds()` method, the UoA/ERC20 `transfer()` method is called.

## Access control
Both contracts inherit OpenZeppelin's Ownable pattern and use the `onlyOwner` modifier:
- in the `UoA`: on the `mint()` method
- in the `EscrowPaymentSplitter`: on the `openEscrowSlot()` and `fundEscrowSlotFrom()` methods

The `EscrowPaymentSplitter`'s `settleEscrowSlot()` method is restricted to the address which funded the slot (stored in the contract's state) via a `require()`.

For the `EscrowPaymentSplitter`, these access controls are covered in dedicated unit tests.