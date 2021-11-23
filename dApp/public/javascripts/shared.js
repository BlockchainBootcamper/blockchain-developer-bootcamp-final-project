var web3;
var messageID = 0;      // Activity stream handler, see notify()

const onLoadHandler = function(smartContractInitializationHandler){
    let walletMsgID = notify('Ethereum wallet detection ...')
    if(typeof(ethereum) == 'object'){
        notify('OK', walletMsgID);
        web3 = new Web3(ethereum);
        for(let contractID in contracts){
            let msgID = notify('API: load '+contractID+' smart contract details ...');
            callAPI('contractDetails?name='+contractID).then(response => {
                if(response.success){
                    notify('OK', msgID);
                    contracts[contractID] = new web3.eth.Contract(response.abi, response.address);
                    smartContractInitializationHandler(contractID);
                }
                else notify('Failure', msgID, true);
            }).catch(error => notify('Failure '+error, msgID, true));
        }
        ethereum.on("accountsChanged", accounts => {handleWeb3AccountsEvent(accounts);});
    }
    else notify('Failure. Please install one, Metamask for example', walletMsgID, true);
};

const connectWallet = function(){
    let msgID = notify('Requesting wallet connection...');
    ethereum.request({method: 'eth_requestAccounts'}).then(accounts => {
        handleWeb3AccountsEvent(accounts);
        notify('OK - connected with address '+accounts[0], msgID);
    }).catch((error) => notify('Failure - reason: "'+error.message+'". dApp can\'t run without wallet connection', msgID, true));
};

const callAPI = function(url, options = {}){
    if(typeof(options.body) == 'object'){options.body = JSON.stringify(options.body);}
    if(typeof(options.headers) == 'undefined'){options.headers = {'Content-Type': 'application/json'};}
    return new Promise((resolve, reject) => {
        fetch('api/'+url, options).then((response) => {
            if(response.ok){response.json().then(json => resolve(json)).catch(error => reject('JSON parsing of API response failed ('+error+')'));}
            else reject('API call to api/'+url+' failed (Status: '+response.status+' - "'+response.statusText+'")');
        }).catch(error => reject('API call to api/'+url+' failed ('+error+')'));
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
    showElement('activityStreamContainer');
    let msgDiv = appendToID != null ? document.getElementById('message'+appendToID) : createTag('div', {id: 'message'+messageID, style: 'padding: 5px; margin: 0px;'});
    msgDiv.appendChild(document.createTextNode((appendToID != null ? ' ' : '- ')+message));
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
    return (withTokenDecimals ? toBN(amount).div(token.decimalsFactor) : amount.toFixed(currencyDecimals))+' '+token.symbol;
}