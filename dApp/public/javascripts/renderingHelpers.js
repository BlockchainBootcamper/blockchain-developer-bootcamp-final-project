class TableRow {
    constructor(header = false, attributes = {}){
        this.element = createTag('tr', attributes);
        this.header = header;
        return this;
    }

    addCell(childStructure, attributeSetter){
        let cell = document.createElement(this.header ? 'th' : 'td');
        if(!Array.isArray(childStructure)){
            childStructure = [childStructure];
        }
        for(let i = 0; i < childStructure.length; i++){
            cell.appendChild(typeof(childStructure[i]) == 'object' ? childStructure[i] : document.createTextNode(childStructure[i]));
        }
        if(attributeSetter){
            attributeSetter(cell);
        }
        this.element.appendChild(cell); 
        return this;
    }

    addCells(childrenArray, attributeSetter){
        for(let i = 0; i < childrenArray.length; i++) {
            this.addCell(childrenArray[i], attributeSetter);
        }
        return this;
    }

    addRowspanCell(childStructure, rowspan){return this.addCell(childStructure, (cell) => cell.setAttribute('rowspan', rowspan));}
    addRowspanCells(childStructure, rowspan){return this.addCells(childStructure, (cell) => cell.setAttribute('rowspan', rowspan));}
    addColspanCell(childStructure, colspan){return this.addCell(childStructure, (cell) => cell.setAttribute('colspan', colspan));}
    addColspanCells(childStructure, colspan){return this.addCells(childStructure, (cell) => cell.setAttribute('colspan', colspan));}
}

function createTag(tagType, attributes){
    let tag = document.createElement(tagType);
    applyMultipleAttributes(tag, attributes);
    return tag;
}

function createButton(text, attributes, disabled = false){
    let button = createTag('button', attributes);
    button.appendChild(document.createTextNode(text));
    if(disabled){button.setAttribute('disabled', '');}
    return button;
}

function applyMultipleAttributes(element, attributes){
    for(attributeName in attributes){
        element.setAttribute(attributeName, attributes[attributeName]);
    }
}

function resetElement(idOrElement, newChild){
    let el = getElement(idOrElement);
    el.innerHTML = '';
    el.appendChild(newChild);
}

function hideElement(id){
    document.getElementById(id).style.display = 'none';
}

function showElement(id){
    document.getElementById(id).style.display = '';
}

function setElementText(idOrElement, text){
    resetElement(getElement(idOrElement), document.createTextNode(text));
}

function setElementsVisibility(idsToShow, idsToHide = []){
    if(!Array.isArray(idsToShow)){
        idsToShow = [idsToShow];
    }
    if(!Array.isArray(idsToHide)){
        idsToHide = [idsToHide];
    }
    for(let elID of idsToShow){
        showElement(elID);
    }
    for(elID of idsToHide){
        hideElement(elID);
    }
}

function disableButton(id){
    document.getElementById(id).setAttribute('disabled', '');
}

function enableButton(id){
    document.getElementById(id).removeAttribute('disabled');
}

function setButtonStatus(id, isEnabled){
    isEnabled ? enableButton(id) : disableButton(id);
}

function setElementVisibility(id, isVisible){
    isVisible ? showElement(id) : hideElement(id);
}

function clearInput(id){
    document.getElementById(id).value = '';
}

function getElement(idOrElement){
    return typeof(idOrElement) == 'object' ? idOrElement : document.getElementById(idOrElement);
}