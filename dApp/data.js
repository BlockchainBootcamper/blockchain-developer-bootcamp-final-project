var suppliers = {}, parts = {}, items = {};

class Supplier {
    id;
    name;
    address;

    constructor(name, address){
        this.id = Object.keys(suppliers).length;
        this.name = name;
        this.setAddress(address);
        suppliers[this.id] = this;
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
        this.id = Object.keys(parts).length;
        this.name = name;
        this.supplierID = supplierID;
        this.price = price;
        parts[this.id] = this;
    }

    addItemLink(itemID, amount){
        this.itemLinks.push({itemID, amount});
    }
}

class Item {
    id;
    name;
    composition = [];

    constructor(name){
        this.id = Object.keys(items).length;
        this.name = name;
        items[this.id] = this;
    }

    addComponent(part, amount){
        this.composition.push({part, amount});
        part.addItemLink(this.id, amount);
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

mechaSupplier = new Supplier('RPM joy Inc.', '0x0e5658FD58DF4F5651A7732A007E9e13A1182780');
screwSupplier = new Supplier('Screwed Up Inc.', '0x69d796a13424bff54535Ab9792388456Dc43d0Cc');
cableSupplier = new Supplier('Tri-phased Inc.', '0xCc945723F42e76b05E6f0e055231fABD4d889e1f');

motor = new Part('Motor 12V 2A', mechaSupplier.id, 200);
gearbox = new Part('Gearbox 6-levels', mechaSupplier.id, 150);
screwM8 = new Part('Screw hex head M8', screwSupplier.id, 3);
washerM8 = new Part('Washer M8 thickness 2mm', screwSupplier.id, 1.8);
nutM8 = new Part('Nut hexagonal M8', screwSupplier.id, 2.2);
cable = new Part('Cable, dia. 4mm, 3m', cableSupplier.id, 6.2);

motorComposition = new Item('Motor with mounting material');
motorComposition.addComponent(motor, 1);
motorComposition.addComponent(screwM8, 15);
motorComposition.addComponent(washerM8, 15);
motorComposition.addComponent(nutM8, 15);
motorComposition.addComponent(cable, 3);

gearboxComposition = new Item('Gearbox with mounting material');
gearboxComposition.addComponent(gearbox, 1);
gearboxComposition.addComponent(screwM8, 20);
gearboxComposition.addComponent(nutM8, 20);

module.exports = {suppliers, parts, items};