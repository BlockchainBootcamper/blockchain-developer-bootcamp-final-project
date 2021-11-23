const {Supplier, Part, Item} = require('./data_structures');
const {ObjectSetHelper} = require('./utilities');

// Initialize static ObjectSetHelper which providers containers for the sets of suppliers, etc. without having to pass variables around in the constructors
//ObjectSetHelper.setupSets(['suppliers', 'parts', 'items']);

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

module.exports = {suppliers: ObjectSetHelper.getSet('suppliers'), parts: ObjectSetHelper.getSet('parts'), items: ObjectSetHelper.getSet('items')};