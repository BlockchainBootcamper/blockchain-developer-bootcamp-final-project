const {suppliers, parts, items} = require('./data');

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

    initialize(){
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

    // Not implemented, for now all get the same items
    getCustomerItems(address){return items;}

    getItem(itemID){return typeof(items[itemID]) == 'object' ? items[itemID]  : null;}

    updateSupplierAddress(supplierId, newAddress){
        let addr = newAddress.toLowerCase();
        suppliers[supplierId].address = addr;
        this.supplierOrderIndex[supplierId] = [];
        this.supplierAddressIndex[addr] = supplierId;
    }

    getSupplierAddress(supplierID){return typeof(suppliers[supplierID]) == 'object' ? suppliers[supplierID].address : null;}

    getSupplierByAddress(address){
        let addr = address.toLowerCase();
        return (typeof(this.supplierAddressIndex[addr]) == 'object' && typeof(suppliers[this.supplierAddressIndex[addr]]) == 'object') ? suppliers[this.supplierAddressIndex[addr]] : null;
    }

    getSupplierParts(supplierId){return typeof(suppliers[supplierID]) == 'object' ? this.supplierPartIndex[supplierId] : null;}

    createOrder(customerAddress, itemID, amount, partsTotalPrice, fees){
        let id = this.nextOrderId++;
        this.orders[id] = {id, customerAddress, itemID, amount, escrowSlotId: null, partsTotalPrice, fees, state: 'unconfirmed'};
        this.customerOrderIndex[customerAddress.toLowerCase()].push(id);
        let supplierIDs = items[itemID].getSupplierIDs();
        for(let supplierID in supplierIDs){
            this.supplierOrderIndex[supplierID].push(id);
        }
        return id;
    }

    getOrder(id){return this.orders[id];}

    setOrderEscrowSlotID(orderID, slotID){
        this.orders[orderID].escrowSlotId = slotID;
        this.orderEscrowSlotIndex[slotID] = orderID;
    }

    getOrderByEscrowSlotId(slotId){return typeof(this.orderEscrowSlotIndex[slotId]) != 'undefined' && typeof(this.orders[this.orderEscrowSlotIndex[slotId]]) != 'undefined' ? this.orders[this.orderEscrowSlotIndex[slotId]] : null;}

    updateOrderState(orderID, newState){
        this.orders[orderID].state = newState;
    }

    getCustomerOrders(customerAddress){
        let customerOrders = [];
        for(let orderID of this.customerOrderIndex[customerAddress]){
            customerOrders.push(this.orders[orderID]);
        }
        return customerOrders;
    }

    getSupplierOrders(supplierID){
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