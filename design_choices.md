# Design choices

## Payment splitter definition data structure
Initially, the following naive definition was used:
```
struct PaymentSplitter {
    address recipient;
    uint amount;
}

struct EscrowSlot {
    uint id;
    PaymentSplitter[] paymentSplitters;
    ...
}
```
The contract state contains a dynamic array of escrow states and `openEscrowSlot()` was defined as shown below:
```
// Inside the contract definition
EscrowSlot[] escrowSlots;

function openEscrowSlot(PaymentSplitter[] memory paymentSplitters) public onlyOwner returns(uint) {
    uint slotId = lastEscrowSlotId++;
    escrowSlots.push(EscrowSlot(slotId, paymentSplitters, ...)); 
    return slotId;
}
```
This fails with an `UnimplementedFeatureError` because it copies `struct memory[] to storage`. It's also not possible to initialize EscrowSlot with an empty dynamic array f.ex. `EscrowSlot memory slot = EscrowSlot(slotId, PaymentSplitter[], false);` because it's considered an invalid implicit conversion. 
The technique explained on this [Ethereum stackoverflow post](https://ethereum.stackexchange.com/questions/30857/how-to-initialize-an-empty-array-inside-a-struct/40292) where a memory object is pushed onto storage doesn't work. The difference with the example shown on that post is that `EscrowSlot` contains a dynamic array of a custom struct and not of simple type(s):
```sol
function openEscrowSlot(PaymentSplitter[] memory paymentSplitters) public onlyOwner returns(uint) {
    uint slotId = lastEscrowSlotId++;
    EscrowSlot memory slot;
    slot.id = slotId;
    escrowSlots.push(slot);
    // ^^^ should work according to the post, but fails because Escrow slot contains a dynamic array of a struct
    return slotId;
    }
```

Switching to dynamic arrays of simple types, which is possible given that `PaymentSplitter` is just a combination of an `address` and a `uint`, solves it. It was decided to opt for a separate `PaymentSplittingDefinition` struct instead of adding the `address[]` and `uint[]` directly to `EscrowSlot` because it allows `openEscrowSlot()` and `getEscrowSlotPaymentDefinition()` to have cleaner function signatures where the two arrays are encapsulated. 