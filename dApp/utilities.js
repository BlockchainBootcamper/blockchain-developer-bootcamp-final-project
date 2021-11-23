class ObjectSetHelper {
    static sets = {};
    
    static getSet(dataStructureType){
        if(typeof(ObjectSetHelper.sets[dataStructureType]) == 'undefined'){ObjectSetHelper.sets[dataStructureType] = {}}
        return ObjectSetHelper.sets[dataStructureType];
    }

    static addObjectToSet(dataStructureType, instance){
        if(typeof(ObjectSetHelper.sets[dataStructureType]) == 'undefined'){ObjectSetHelper.sets[dataStructureType] = {}}
        let id = Object.keys(ObjectSetHelper.sets[dataStructureType]).length;
        ObjectSetHelper.sets[dataStructureType][id] = instance;
        return id;
    }
}

class VariableSharepoint {
    static shares = {};
    static get(name){return VariableSharepoint.shares[name];}
    static share(name, variable){VariableSharepoint.shares[name] = variable;}
}

module.exports = {ObjectSetHelper, VariableSharepoint};