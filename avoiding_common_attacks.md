# SWC registry review

### SWC-100: Function default visibility
All functions in the contract have a visibility type specified. In the EscrowPaymentSplitter contract, the `handleEscrowSlotFunding()` and `getEscrowSlotIndex()` are specified as internal to allow potential derived contracts to call them. 

### SWC-101: Integer overflow and underflow
There's are arithmetic operations in the EscrowPaymentSplitter contract's `handleEscrowSlotFunding()` and `settleEscrowSlot()` methods which have been protected by using OpenZeppelin's SafeMath library.

### SWC-102: Outdated compiler version
The contracts pragma specifies the use of the latest Solidity compiler version as of writing, version 0.8.10. 

### SWC-103: Floating pragma
The contracts pragma is fixed to version 0.8.10.

### SWC-105: Unprotected Ether withdrawal
No Ether involved in the contracts. Regarding the UoA ERC20 and its use in the EscrowPaymentSplitter, the `getReceivedFunds()` function can't have any special access control but it reverts if the caller address has no funds.

### SWC-107: Reentrancy
EscrowPaymentSplitter only calls the UoA which is derived from OpenZeppelin's ERC20 implementation and doesn't call any other contract(s). 

### SWC-108: State variable default visibility
All state variables in the EscrowPaymentSplitter have a visiblity defined: the dynamic array of escrow slots and the slot ID counter are private because even derived contracts should not be allowed to mess with them; the `tokenContractAddress` and the `recipientFunds` mapping are public because it can help user interfaces interacting with the contract. The UoA contract has no state variable definitions. 

### SWC-110: Assert violation
No asserts in the code, uses `require()` where approriate.

### SWC-111: Use of deprecated Solidity functions
No such function used: all variables are typed (no `var`), read-only functions are marked as `view` and `revert()` is used instead of `throw`.

### SWC-113: Denial of service with failed call
Initial implementations of the EscrowPaymentSplitter were vulnerable to this attack because the `settleEscrowSlot()` method directly sent funds in a for loop, which is pretty much the essence of this vulnerability. Now, it maintains a `recipientFunds` balance mapping which is updated by `settleEscrowSlot()` and recipients can collect their funds calling `getReceivedFunds()`.

### SWC-114: Transaction order dependance
In the EscrowPaymentSplitter, there's the logic flow `openEscrowSlot() -> fundEscrowSlot() / fundEscrowSlotFrom() -> settleEscrowSlot() -> getReceivedFunds()` but it's hard to imagine a situation where a party could profit if they managed to trigger a race condition to make steps occur out of order. A slot which doesn't exist can't be funded, a slot which has not been funded can't be settled, and `getReceivedFunds()` only sends funds of settled slots. The UoA contract, as all ERC20s, is vulnerable to the `approve()` race condition and the supply consolidation service could indeed use this draw more tokens from a customer than latter intended (using `fundEscrowSlotFrom()`). However, such a supply consolidation service is always linked to a formal B2B contract since there's much more involved than the payment flow considered here - it's hence unlikely the service would exploit this vulnerability. The frontend further takes care that the approval & escrow slot funding step happen order by order (and not cumulated accross orders) which leads to the fact that the customer's UoA allowance for the the escrow payment splitter contract returns to 0 when the slot is funded (except if the customer set it to a value above the funding required for that slot, but the UI doesn't requests that). 

### SWC-119: Shadowing state variables
Thanks to Consensys Diligence's VS Code extension, shadowing within a contract can be visualized and removed easily and there's no complex contract inheritance with cross contract shadowing risks. 

### SWC-124: Write to arbitrary storage location
There's no method in the EscrowPaymentSplitter contract which allows to write to an arbitrary location - `openEscrowSlot()` adds a new escrow slot to the dynamic escrow slot array, the funding only acts on existing slots and the settling removes the slot from the array once the payment splitting definition was executed. All methods acting on existing slots revert if the provided slot ID can't be found in the contract's state.

### SWC-125: Incorrect inheritance order
- The EscrowPaymentSplitter only inherits `Ownable` so it's not at risk
- The UoA inherits `Ownable` and `ERC20`, in that order, to respect the "general to specific" rule, but these widespread OpenZeppelin implementation don't collide anyway

### SWC-128: DoS with block gas limit
The EscrowPaymentSplitter contract takes care to keep its state at the bare minimum - once a slot is settled, it's removed from the dynamic array in storage. To protect against spam, the only function allowed to create escrow slots is access controlled by `onlyOwner`.

### SWC-129: Typographical error
All arithmetic operations rely on OpenZeppelin's SafeMath library, which replaces the operators by explicit function names.

### SWC-131: Presence of unused variable
Thanks to Consensys Diligence's VS Code extension, these are detected easily and were removed.

### SWC-133: Hash collision with multiple variable length arguments
The EscrowPaymentSplitter contract uses `abi.encodePacked()` with OpenZeppelin's string library to generate more specific error messages but the length of the arguments is static.

## Not applicable SWCs
Solved in/by up-to-date Solidity versions and code constructs:
- SWC-109: Uninitialized storage pointer
- SWC-118: Incorrect constructor name

No signature based logic is used in the contract:
- SWC-117: Signature malleability
- SWC-121: Missing protection against signature replay attacks
- SWC-122: Lack of proper signature verification
- SWC-123: Requirement violation

Referring to situations or constructs the contracts don't use:
- SWC-104: Unchecked call return value
- SWC-106: Unprotected SELFDESTRUCT
- SWC-112: Delegatecall to untrusted callee
- SWC-115: Authorization through tx.origin
- SWC-116: Block values as proxy for time
- SWC-120: Weak source of randomness from chain attributes
- SWC-126: Insufficient gas griefing
- SWC-127: Arbitrary jump with function type variable
- SWC-130: Right-to-Left override control character
- SWC-132: Unexpected Ether balance
- SWC-134: Message call with hardcorded gas amount
- SWC-135: Code with no effects
- SWC-136: Unencrypted private data on-chain