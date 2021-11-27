const {suppliers, parts, items} = require('./data');
const {VariableSharepoint} = require('./utilities');

class InMemoryDatabase {
    // suppliers object, imported
    customers = {};
    orders = {};

    // *** Database emulation artifacts
    nextOrderId = 1;
    customerOrderIndex = {};            // Maps address to array of order IDs
    orderEscrowSlotIndex = {};
    supplierAddressIndex = {};          // Maps address to supplier ID
    supplierOrderIndex = {};            // Maps supplier ID to array of order IDs
    supplierPartIndex = {};             // Maps supplier ID to array of parts

    constructor(){
        // Add supplier names to items
        for(let itemID in items){
            for(let i = 0; i < items[itemID].composition.length; i++){
                items[itemID].composition[i].part.supplierName = suppliers[items[itemID].composition[i].part.supplierID].name;
            }
        }
        // Initialize supplier related database artifacts (for customers it's done in the createCustomer() method since they are dynamic)
        for(let supplierID in suppliers){
            this.supplierOrderIndex[supplierID] = [];
            this.supplierPartIndex[supplierID] = [];
        }
        
        for(let partID in parts){
            this.supplierPartIndex[parts[partID].supplierID].push(parts[partID]);
            // Resolve part to item links
            parts[partID].items = {};
            for(let itemLinkIdx in parts[partID].itemLinks){
                parts[partID].items[parts[partID].itemLinks[itemLinkIdx].itemID] = {name: items[parts[partID].itemLinks[itemLinkIdx].itemID].name, amount: parts[partID].itemLinks[itemLinkIdx].amount};
            }
        }
        VariableSharepoint.share('database', this);
    }

    createCustomer(address, name){
        let addr = address.toLowerCase();
        this.customers[addr] = {name};
        this.customerOrderIndex[addr] = [];
    }

    isCustomerAddress(address){return typeof(this.customerOrderIndex[address.toLowerCase()]) != 'undefined';}

    getCustomer(address){
        let addr = address.toLowerCase();
        return typeof(this.customers[addr]) == 'object' ? this.customers[addr] : null;
    }

    isCustomerOrder(customerAddress, orderID){
        let addr = customerAddress.toLowerCase();
        if(typeof(this.customerOrderIndex[addr]) == 'undefined'){throw new Error('Attempt to check orders from unkown customer');}
        return this.customerOrderIndex[addr].includes(orderID);
    }

    // Not implemented, for now all get the same items
    getCustomerItems(address){return items;}

    getItem(itemID){return typeof(items[itemID]) == 'object' ? items[itemID]  : null;}

    updateSupplierAddress(supplierID, newAddress){
        if(typeof(suppliers[supplierID]) == 'undefined'){throw new Error('Attempt to update address of unkown supplier');}
        let addr = newAddress.toLowerCase();
        delete(this.supplierAddressIndex[suppliers[supplierID].address]);
        suppliers[supplierID].address = addr;
        this.supplierOrderIndex[supplierID] = [];
        this.supplierAddressIndex[addr] = supplierID;
    }

    getSupplierAddress(supplierID){return typeof(suppliers[supplierID]) == 'object' ? suppliers[supplierID].address : null;}

    getSupplierByAddress(address){
        let addr = address.toLowerCase();
        return (typeof(this.supplierAddressIndex[addr]) == 'object' && typeof(suppliers[this.supplierAddressIndex[addr]]) == 'object') ? suppliers[this.supplierAddressIndex[addr]] : null;
    }

    getSupplierParts(supplierID){return typeof(suppliers[supplierID]) == 'object' ? this.supplierPartIndex[supplierID] : null;}

    createOrder(customerAddress, itemID, amount, partsTotalPrice, fees){
        if(typeof(items[itemID]) == 'undefined'){throw new Error('Attempt to create order of unkown item');}
        let id = this.nextOrderId++;
        this.orders[id] = {id, customerAddress, itemID, amount, escrowSlotId: null, partsTotalPrice, fees, state: 'unconfirmed'};
        this.customerOrderIndex[customerAddress.toLowerCase()].push(id);
        let supplierIDs = items[itemID].getSupplierIDs();
        for(let supplierID in supplierIDs){
            this.supplierOrderIndex[supplierID].push(id);
        }
        return id;
    }

    isValidOrderID(id){return typeof(this.orders[id]) == 'object';}
    getOrder(id){return typeof(this.orders[id]) == 'object' ? this.orders[id] : null;}
    

    setOrderEscrowSlotID(orderID, slotID){
        if(typeof(this.orders[orderID]) == 'undefined'){throw new Error('Attempt to set escrow slot ID on unkown order')}
        this.orders[orderID].escrowSlotId = slotID;
        this.orderEscrowSlotIndex[slotID] = orderID;
    }

    getOrderByEscrowSlotId(slotId){return (typeof(this.orderEscrowSlotIndex[slotId]) != 'undefined' && typeof(this.orders[this.orderEscrowSlotIndex[slotId]]) == 'object') ? this.orders[this.orderEscrowSlotIndex[slotId]] : null;}

    updateOrderState(orderID, newState){
        if(typeof(this.orders[orderID]) == 'undefined'){throw new Error('Attempt to set update state on unkown order')}
        this.orders[orderID].state = newState;
    }

    getCustomerOrders(customerAddress){
        if(typeof(this.customerOrderIndex[customerAddress]) == 'undefined'){return null;}
        let customerOrders = [];
        for(let orderID of this.customerOrderIndex[customerAddress]){
            customerOrders.push(this.orders[orderID]);
        }
        return customerOrders;
    }

    getSupplierOrders(supplierID){
        if(typeof(this.supplierOrderIndex[supplierID]) == 'undefined'){return null;}
        let supplierOrders = [];
        for(let orderID of this.supplierOrderIndex[supplierID]){
            let order = orders[orderID];
            order.customerName = this.customers[order.customerAddress].name;
            supplierOrders.push(order);
        }
        return supplierOrders;
    }
}

module.exports = InMemoryDatabase;