const {ObjectSetHelper} = require('./utilities');       // ObjectSetHelper takes care to provide a consistant ID attribution across instantions, and to retrieve the whole set in a single call if desired

class Supplier {
    id;
    name;
    address;

    constructor(name, address){
        this.id = ObjectSetHelper.addObjectToSet('suppliers', this);
        this.name = name;
        this.setAddress(address);
    }

    setAddress(address){
        this.address = address;
    }
}

class Part {
    id;
    name;
    supplierID;
    price;
    itemLinks = [];

    constructor(name, supplierID, price){
        this.id = ObjectSetHelper.addObjectToSet('parts', this);
        this.name = name;
        this.supplierID = supplierID;
        this.price = price;
    }

    addItemLink(itemID, amount){
        this.itemLinks.push({itemID, amount});
    }
}

class Item {
    id;
    name;
    composition = [];
    amountsPerSuppliers = {};

    constructor(name){
        this.id = ObjectSetHelper.addObjectToSet('items', this);
        this.name = name;
    }

    addComponent(part, amount){
        this.composition.push({part, amount});
        this.amountsPerSuppliers[part.supplierID] = typeof(this.amountsPerSuppliers[part.supplierID]) != 'undefined' ? this.amountsPerSuppliers[part.supplierID] + part.price * amount : part.price * amount;
        part.addItemLink(this.id, amount);
    }

    getSupplierIDs(){return Object.keys(this.amountsPerSuppliers);}
    getSupplierAmounts(){return this.amountsPerSuppliers;}
    
    computeOrderPrice(orderSize){
        let val = 0;
        for(let i = 0; i < this.composition.length; i++) {
            val += this.composition[i].part.price * this.composition[i].amount * orderSize;
        }
        return val;
    }

    computeOrderDetails(orderSize){
        let orderPositions = [], amountsPerSuppliers = {};
        for(let i = 0; i < this.composition.length; i++) {
            let component = this.composition[i];
            if(typeof(amountsPerSuppliers[component.part.supplierID]) == 'undefined') {
                amountsPerSuppliers[component.part.supplierID] = 0;
            }
            let price = component.part.price * component.amount * orderSize;
            amountsPerSuppliers[component.part.supplierID] += price;
            orderPositions.push({partID: component.part.id, supplierID: component.part.supplierID, amount: component.amount * orderSize, price});
        }
        return {orderPositions, amountsPerSuppliers};
    }
}

module.exports = {Supplier, Part, Item};