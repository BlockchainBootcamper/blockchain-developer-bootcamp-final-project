import Web3 from "web3";

const Contract = require('@truffle/contract');

export default class Web3Helper {
    static web3 : any;
    static websocketProvider : any;
    static contracts : any = {};
    static smartContractArtifactFilepaths : any;
    
    public static configure(web3ProviderURLs : {http: string, websocket: string}, smartContractArtifactFilepaths : any){
        Web3Helper.web3 = new Web3(web3ProviderURLs.http);
        Web3Helper.websocketProvider = new Web3.providers.WebsocketProvider(web3ProviderURLs.websocket);
        Web3Helper.smartContractArtifactFilepaths = smartContractArtifactFilepaths;
    }

    public static getAccounts(){return Web3Helper.web3.eth.getAccounts();}
    public static checkConnection(){return Web3Helper.web3.eth.net.isListening();}
    public static cleanup(){Web3Helper.websocketProvider.disconnect();}

    public static async getContract(id : string){
        if(typeof(Web3Helper.contracts[id]) == 'undefined'){
            Web3Helper.contracts[id] = await Web3Helper.loadContract(id);
        }
        return Web3Helper.contracts[id];
    }

    public static async getContractAddress(contractName : string) : Promise<string>{
        return (await Web3Helper.getContract(contractName)).address;
    }

    static async loadContract(id : string) : Promise<object> {
        if(typeof(Web3Helper.smartContractArtifactFilepaths[id]) == 'undefined') {
            throw Error(id+' contract artifact unknown'); 
        }
        let contractJSON;
        try {contractJSON = require(Web3Helper.smartContractArtifactFilepaths[id]);}
        catch(e){throw new Error(id+' contract artifact not found (path: '+Web3Helper.smartContractArtifactFilepaths[id]+')');}
        let contract = Contract(contractJSON);
        contract.setProvider(Web3Helper.websocketProvider);
        return contract.deployed();
    }
}