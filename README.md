# Blockchain Developer Bootcamp - Final project

## Project idea
The goal is to build a dApp for a supply consolidation service. In manufacturing industries, supply consolidation describes a service where a company takes over the role of a one-stop-shop, encapsulating multiple supplier relationships for its customers. The easiest way to explain this is an example:
- imagine a manufacturing company mounts a part into one of its products, and that mounting requires a certain amount of screws and nuts, washers, bolts, cables, glue and so on (let's call them by-components)
- instead of managing the stocks of the part and each of the by-components individually, they turn to a supply consolidation service and agree to define an item encompassing the part and the exact right amount of by-components
- from there on, the supply chain complexity can be outsourced to the consolidation service and the manufacturing company simply orders that defined item without having to worry about the individual components and their stocks

From a financial point of view, the service corresponds to a sort of payment splitting where the consolidation service bills the customer and splits the received amount into payments for each of the suppliers, plus its own service fee. This involves a lot of trust: depending whether orders are pre- or post-paid, the customer has to trust the consolidation service or vice-versa, and the customers as well as the suppliers have to trust the service will execute the payments correctly. The potential of a blockchain implementation is to make this payment flow largely trustless by leveraging the fact that a smart-contract can act as an escrow. The plan is to associate each order to an escrow "slot" containing a payment splitting definition (PSD) which is immutable once set up. The flow of an order becomes:
- the customer requests a quotation for a certain amount of items at the consolidation service, which computes the bill of materials, the fees and the total amount as well as the corresponding PSD
- the consolidation service calls the smart-contract to open an escrow slot with that PSD
- the consolitation service communicates the escrow slot identifier to the customer and notifies the suppliers about a potential order (off-chain)
- the customer can inspect the slot's PSD and if it's acceptable, "fill" the slot by sending the correct amount of value to the smart-contract, thereby confirming the order
- the suppliers are notified that the value is escrowed and goods can be shipped (off-chain)
- the supplier can call the smart-contract to counter-check that "their" amount has been properly escrowed before shipping the goods
- the goods are shipped and arrive at the customer (off-chain)
- the customer marks the order as complete which releases the escrow slot, thereby executing the PSD
- the suppliers receive their money, the consolidation service its fees and the transaction is concluded

For obvious reasons, the "value" mentioned here has to be a stable asset.

## Workspace
### Preparation
`npm install -g truffle ganache-cli`