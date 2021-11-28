var web3;
var contracts = {uoa: null, escrowPaymentSplitter: null};
var chainIDs = {required: null, current: null, ok: false};
var messageID = 0;      // Activity stream handler, see notify()

const onLoadHandler = function(){
    notify('Welcome to the supply consolidation service demonstration!');
    showElement('activityStreamContainer');

    let walletMsgID = notify('Ethereum wallet detection ... ')
    if(typeof(ethereum) == 'object'){
        web3 = new Web3(ethereum);
        notify('OK', walletMsgID);
        ethereum.on("accountsChanged", accounts => {handleWeb3AccountsChange(accounts);});
        ethereum.on("chainChanged", chainID => {
            chainIDs.current = Number(chainID);
            updateChainIdsState();
            handleWeb3NetworkChange(chainIDs.current);
        });
        getNetworkID();
    }
    else notify('Error: Please install one, Metamask for example, and reload the page.', walletMsgID, true);
    loadExpectedChainID();
};

const getNetworkID = function(){
    let msgID = notify('Loading network ID from Ethereum provider ... ');
    web3.eth.getChainId().then(chainID => {
        chainIDs.current = chainID;
        updateChainIdsState();
        notify('OK - chain has ID '+chainIDs.current, msgID);
    }).catch(error => notify([error, createButton('Retry', {onclick: 'getNetworkID();', style: 'margin-left: 10px;'})], msgID, true));
}

const loadExpectedChainID = function(){
    let msgID = notify('API: loading expected chain ID ... ');
    callAPI('chainID').then(response => {
        if(response.success){
            chainIDs.required = response.chainID;
            updateChainIdsState();
        }
        else throw Error('API returned an error');
        notify('OK - chain has to have ID '+chainIDs.required, msgID);
    }).catch(error => notify([error, createButton('Retry', {onclick: 'loadExpectedChainID();', style: 'margin-left: 10px;'})], msgID, true));
}

const updateChainIdsState = function(){
    chainIDs.ok = chainIDs.current == chainIDs.required;
    if(chainIDs.ok){initializeSmartContracts();}
    else contracts = {uoa: null, escrowPaymentSplitter: null};
}

const connectWallet = function(){
    let msgID = notify('Requesting wallet connection...');
    if(!chainIDs.ok){
        alert('Please connect to the right Ethereum network! Web3 returns network ID '+chainIDs.current+' but required one is '+chainIDs.required);
        notify('Error: Wrong network - Web3 returns network ID '+chainIDs.current+' but required one is '+chainIDs.required, msgID, true);
        return;
    }
    ethereum.request({method: 'eth_requestAccounts'}).then(accounts => {
        handleWeb3AccountsChange(accounts);         // needs to be called because the "accountsChanged" event is not fired if the wallet considers the address as connected already
        notify('OK - connected with address '+accounts[0], msgID);
    }).catch((error) => notify('Failure - reason: "'+error.message+'". dApp can\'t run without wallet connection', msgID, true));
};

const initializeSmartContracts = function(){
    for(let contractID in contracts){
        let msgID = notify('API: load '+contractID+' smart contract details ...');
        callAPI('contractDetails?name='+contractID).then(response => {
            if(response.success){
                notify('OK', msgID);
                contracts[contractID] = new web3.eth.Contract(response.abi, response.address);
                initializeSmartContract(contractID);
            }
            else notify('Failure', msgID, true);
        }).catch(error => notify('Failure '+error, msgID, true));
    }
}

const callAPI = function(url, options = {}){
    if(typeof(options.body) == 'object'){options.body = JSON.stringify(options.body);}
    if(typeof(options.headers) == 'undefined'){options.headers = {'Content-Type': 'application/json'};}
    return new Promise((resolve, reject) => {
        fetch('api/'+url, options).then((response) => {
            if(response.ok){response.json().then(json => resolve(json)).catch(error => reject('JSON parsing of API response failed ('+error+')'));}
            else reject('Error: API call to api/'+url+' failed (Status: '+response.status+' - "'+response.statusText+'")');
        }).catch(error => reject('Error: API call to api/'+url+' failed ('+error+')'));
    });
};

const compareAddresses = function(addr1, addr2){
    return addr1.toLowerCase() == addr2.toLowerCase();
}

const toBN = function(value){
    if(typeof(value) == 'number'){console.log(value, typeof(value)); value = parseInt(value);}  // just a safeguard because BN.js can't handle any number with decimals
    return web3.utils.toBN(value);
}

const notify = function(message, appendToID = null, isError = false){
    let msgDiv = appendToID != null ? document.getElementById('message'+appendToID) : createTag('div', {id: 'message'+messageID, style: 'padding: 5px; margin: 0px;'});
    //msgDiv.appendChild(document.createTextNode((appendToID != null ? ' ' : '- ')+message));
    addChildren(msgDiv, message);
    if(isError){msgDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';}
    if(appendToID == null){
        document.getElementById('activityStream').prepend(msgDiv);
        return messageID++;
    }
};

const clearActivityStream = function(){
    resetElement(document.getElementById('activityStream'), document.createTextNode(''));
}

const closePopup = function(event = null){
    if(event == null || (event != null && event.target.id == 'modalLayer')){
        document.getElementById('modalLayer').style.display = 'none';
    }
}

const labelTokenAmount = function(amount, withTokenDecimals = false){
    if(token.decimalsFactor == null || currencyDecimals == null || token.symbol == null){console.log(token.decimalsFactor, currencyDecimals, token.symbol);}
    return (withTokenDecimals ? toBN(amount).div(token.decimalsFactor) : amount.toFixed(currencyDecimals))+' '+token.symbol;
}