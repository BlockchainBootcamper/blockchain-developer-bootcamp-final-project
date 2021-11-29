# dApp documentation

Webservice implemented in plain Javascript. Uses Express (NodeJS webserver) with the Twig templating framework. Codebase initialized using the [express-generator](https://expressjs.com/en/starter/generator.html) utility; `web3`, Truffle's `HDWalletProvider` and the secret management `dotenv` packages installed on top.

A supply consolidation service has 3 types of actors: 1. suppliers 2. customers and the service provider itself. This codebase provides a user interface and API for the customers and suppliers and contains a blockchain client implementation which takes over the tasks of the service provider.

To install the dependencies, go to the `dApp` folder (the one where this file is in) and run `npm install`. If you don't have NodeJS ready, please check out the [main repository documentation](../README.md) for instructions on how to install it.

To run the backend, you'll also need:
- the compiled contracts - please check out the [main repository documentation](../README.md) for a guide on how to compile them
- to adapt `configuration.js`, which contains sections for both local testing blockchains as well as public networks. If you plan to use a public network, please create a `.env` from `.env.template` and add the secrets there. One important thing to keep in mind is that the account/address which runs the service must be the same than the one which deployed (owns) the smart-contracts because these contain several methods which can only be called by the owner. 

To run the dApp, execute `npm start` or, if you wish the debugging mode, `DEBUG=dapp:* npm start`.

The predefined datasets (parts, items, suppliers) can be found in `./data.js`, the API implementation is in `./routes/api.js` and the user interfaces are delivered in `./routes/pages.js`, with the Twig templates in `./views/`. Each of the pages has a dedicated javascript file to handle the interactive parts, these can be found in `./public/javascripts/`. 