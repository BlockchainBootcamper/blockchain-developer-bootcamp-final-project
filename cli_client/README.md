# CLI clients

## Installation & setup
- In this folder, run `npm install --only=production` (the `--only=production` avoids installing the Typescript dev dependencies). Installs packages for `web3` and `@truffle/contract`
- Create a `settings.js` from the `settings.template.js` and adapt it as explained in the file

It's ready to go. 

## Usage
Execute the scripts explained below (output of `help.js`):
```
Files & Parameters for the escrow & payment splitter contract:
 - openEscrowSlot.js (no parameters)
   opens an escrow slot with the paymentSplittingDefinition defined in the settings, from the contract owner account

 - fillEscrowSlot.js <account ID> <slot ID>
   fills escrow slot from that account - UoA transfer has to be approved calling approveEscrowContractTokenRetrieval.js before

 - settleEscrowSlot.js <account ID> <slot ID>
   settles escrow slot from that account - only the account which filled the slot can call it successfully

 - getPaymentSplittingDefinition.js <slot ID>

 - getEscrowedValue.js <account ID> <slot ID>
   get the value escrowed in the slot for account

 - isEscrowSlotFilled.js <slot ID>

Files & Parameters for the token contract UoA:
 - approveEscrowContractTokenRetrieval.js <account ID> <amount of UoA>
   allows the escrow & payment splitter contract to transfer the amount from the account to itself

 - listTokenBalances.js (no parameters)

 - mintToken.js <account ID> <amount of UoA>

The account IDs are defined in settings.js
 ```