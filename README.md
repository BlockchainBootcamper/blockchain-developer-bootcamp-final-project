# Blockchain Developer Bootcamp - Final project

## Project idea
The goal is to build a dApp for the financial flows of a supply consolidation service (SCS). In manufacturing industries, supply consolidation describes a type of service where the provider takes the role of a one-stop-shop encapsulating multiple supplier relationships for its customers. The easiest way to explain this is an example:
- imagine a manufacturing company mounts a part into one of its products, and that mounting requires a certain amount of screws, nuts, washers, bolts, cables, glue and so on (let's call them by-components)
- instead of managing the stocks of the part and each of the by-components themselves, they turn to a SCS and agree to define an item encompassing the part and the exact right amount of by-components
- from there on, the supply chain complexity can be outsourced to the SCS and the manufacturing company simply orders that defined item without having to worry about the individual components, their availability and the stocks

Although largely unknown to the public such services are actually widespread and used in a many industries: Tesla uses some f.ex. to manage the supply of certain components built into their cars and many companies making low-volume electronic products wouldn't even exist if such services would not manage the tremendous supply chain complexity for them. 

From a financial point of view, the service corresponds to a sort of payment splitting where the consolidation service bills the customer and splits the received amount into payments for each of the suppliers, plus its own service fee. This involves a lot of trust: depending whether orders are pre- or post-paid, the customer has to trust the consolidation service or vice-versa, and the customers as well as the suppliers have to trust the service will execute the payments correctly. The potential of a blockchain implementation is to make this payment flow largely trustless by leveraging the fact that a smart-contract can act as an escrow. The plan is to associate each order to an escrow "slot" containing a payment splitting definition (PSD) which is immutable once set up. The flow of an order becomes:
- the customer requests a quotation for a certain amount of an item from the SCS, which computes the bill of materials, the fees and the total amount as well as the corresponding PSD
- upon approval, the SCS calls the smart-contract to open an escrow slot with that PSD and notifies suppliers about the incoming order
- the customer can inspect the slot's PSD and if it's acceptable, fund the slot by sending the correct amount of value into the smart-contract
- the suppliers are notified that the value is escrowed and goods can be shipped (off-chain)
- if a directy supplier to customer delivery is used, the supplier can call the smart-contract to counter-check that "their" amount has been properly escrowed before shipping the goods
- the goods are shipped and arrive at the customer (off-chain)
- the customer marks the order as complete which settles the escrow slot, thereby executing the PSD
- the suppliers receive their money, the SCS its fees and the transaction is concluded

For obvious reasons, the "value" mentioned here has to be a stable asset.

## Design
The flow described in the introduction will require a combination of Web2 and Web3 elements. For the Web3 part, two smart-contracts will be required: 
1. a contract representing a stable asset that we'll call *unit of accounting (UoA)* to stay currency agnostic. It was chosen to be fully ERC20 compliant (Ethereum's standard for fungible assets) such that the concept would also work with existing stable assets like DAI, USDC, etc.
2. the escrow and payment splitter contract, which, parsing through the flow explained in the introduction, will need the methods 
    - `openEscrowSlot(... some way to pass the payment splitting definition ...)` called by the SCS once an order is confirmed
    - `getPaymentSplittingDefition(...)` called by the customer to inspect the slot's payment splitting
    - `fundEscrowSlot(...)` called by the customer to transfer the amount of ERC20 to the smart-contract. The amount has to be `approve`d on the ERC20 contract before
    - `getEscrowedValue(...)` called by the supplier to verify that its amount of ERC20 for an order is escrowed
    - `settleEscrowSlot(...)` called by the customer once the goods have arrived, to execute the payment splitting
    
    For trustlessness, the `settleEscrowSlot()` method should only be executed when called from the address which called `fundEscrowSlot()`. 

The Web2 part is a webserver which, beside the user interfaces (UIs) for customers and suppliers, provides an API with which these UIs interact and runs a blockchain client to handle the SCS part of the flow explained above. During the course of the development, the flow was slightly adapted:
- for user experience reasons, the `fundEscrowSlot()` call was "relocated" to the backend to avoid that the user has to call approve on the ERC20 followed by a second transaction, which can be confusing. Now, the user just calls approve and the server aka SCS takes care to fund the escrow slot executing an additional smart-contract method called `fundEscrowSlotFrom()`. It changes nothing to the fact that the customer address remains the only one able to call `settleEscrowSlot()`. 
- to comply with the smart-contract coding best practice "favor payment pull over push", `settleEscrowSlot()` was modified to credit a local ERC20 balance for the suppliers instead of sending the funds directly. Suppliers can then collect their funds calling `withdrawReceivedFunds()` with the additional advantage that the income of many orders can be bundled, reducing the gas cost impact. 

## How-to
To be able to run any of the operations in the subsections below, please
- install NodeJS or the node version manager NVM - turn to your favorite search engine to check out the instructions for your operating system
- if you installed NVM, make sure you configure it to provide a recent version of NodeJS
- use the NodeJS package manager `npm` to install Truffle with the instruction `npm install -g truffle`. The `-g` flag installs Truffle globally so that it can be called from any location in the filesystem. If you opted for NodeJS stand-alone and the install process has permission problems, either run it as superuser (f.ex. using `sudo`) or follow the instructions shown [here](https://makandracards.com/makandra/72209-how-to-install-npm-packages-globally-without-sudo-on-linux).

### Compile the smart-contracts
To compile the contracts, please
- check that you followed the instructions listed in the introduction of the how-to section
- run `npm install` in the main repository folder (the one where this file is in) to get the OpenZeppelin package used in the smart-contracts (you may run `npm install --only=production` if you don't plan to deploy the contracts to a public network)
- run `truffle compile` in the main repository folder

### Run the unit tests
To run the unit tests, please
- follow the instructions for the smart-contract compilation
- if you already have a local test blockchain installed, start it and adapt the `truffle-config.js` to match the ports and network ID. If you haven't one installed, run `npm install -g ganache-cli` followed by `ganache-cli` (no need to adapt the Truffle config, it's already setup for that)
- run `truffle test` in the main repository folder

### Deploy the contracts
Please follow the instructions for the smart-contract compilation first. 

- To a local test blockchain software you installed previously:
    - start the local test blockchain
    - if it's not Ganache, check the output to see on which port it listens and which network ID it uses and adapt the `truffle-config.js` to use the right settings
    - open a second terminal and run `truffle migrate`

- If you start from scratch:
    - run `npm install -g ganache-cli`
    - launch Ganache by executing `ganache-cli`
    - open a second terminal and run `truffle migrate`

- To a public network:
    - run `npm install` in the repository folder to make sure you have all dependencies installed, including those marked as development-only
    - choose on which network you want to deploy - [official guide](https://ethereum.org/en/developers/docs/networks/)
    - unless you know exactly what you're doing, create a separate wallet (f.ex. by installing Metamask) of which you export the 12 or 24 word mnemonic which has to be kept secret
    - if you target a testnet, use your favorite search engine to find a faucet for the network you selected and get some test Ether for the address you wish to use to deploy. Deployment costs should cost around 0.0114 Ether, migrations included.
    - unless you want to run a network node yourself, go to a service like Infura to get an access to the network - this kind of service will provide you with an API key that has to be kept secret
    - create a copy of `.env.example` and call it `.env`, put the mnemonic and the API key in the corresponding entries
    - if you selected another network than Ropsten: adapt the `truffle-config.js` by replacing the `ropsten` key by the name of the selected network and adapt the service provider URL as well
    - if you use another service than Infura: adapt the `truffle-config.js` by setting the correct URL for your provider
    - if you wish to use another address than the first one your wallet provides, adapt the `truffle-config.js` by setting the correct address index (0-based counter).

### Use the command-line client or front-end
Please check out the corresponding documentation in [dApp](./dApp) for the frontend and [cli_client](./cli_client) for the command-line client.

## Bootcamp specifics
### Screencast
TODO
### Mainnet Ethereum address
TODO