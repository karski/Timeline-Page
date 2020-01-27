//Contains objects and methods for timeline Rows

var rowMode = "COCOM"; //default to COCOM layout until overridden
//IDs for rows when searching dynamically
var rowIDList = [];


//generates the list of rows by query or hardcoded values
function updateTimelineRows(mode) {
    //only go through this process if rowMode is different
    if (mode != rowMode) {
        rowMode = mode; //update the rowMode

        //determine how to get the new row headers - query functions will call redrawRows to complete actions
        switch (mode) {
            case "Airfield":
                retrieveListItems(siteURL, airfieldList, airfieldQuery, airfieldFields, false, buildRowsAirfields);
                break;
            case "MCE":
                retrieveListItems(siteURL, mceList, mceQuery, mceFields, false, buildRowsMCEs);
                break;
            default: //use COCOM as default since it's hardcoded
                var rowHeaderList = ["CENTCOM", "AFRICOM", "EUCOM", "PACOM", "Ferry/LOCAL</br>N/SCOM", "BACN"]
                redrawRows(rowHeaderList);
        }
    }

}

//redraws rows by erasing current rows, drawing the ones provided (via query or fixed values)
//rowHeaderList should be an array of strings containing names of rows or HTML if multilines are desired
//lookupList is the row ID that will be used for searching - this allows formatted headers that contain more info than the events know
//Note - events will have to be redrawn after this is called
function redrawRows(rowHeaderList, lookupList) {

    //erase previous rows
    var rowCollection = document.getElementsByClassName("timelineRow");
    while (rowCollection.length > 0) {
        rowCollection[0].remove();
    }

    //get the timeline container to add rows to
    var rowContainer = document.getElementById("timelineRowContainer");

    //fill in table with new row definitions
    //allow previous methods to determine rows - we'll just blindly draw
    for (let rowTitle of rowHeaderList) {
        var rowElement = document.createElement("div");
        rowElement.classList.add("timeline");
        rowElement.classList.add("timelineRow");
        var headerElement = document.createElement("div");
        headerElement.classList.add("rowHeader");
        headerElement.innerHTML = rowTitle;
        rowElement.appendChild(headerElement);
        rowContainer.appendChild(rowElement);
    }

    //save header list (or lookup list if provided) to rowIDList so that it can be used to find the right row by the events during drawing
    if (lookupList == null || lookupList == undefined) {
        rowIDList = rowHeaderList;
    } else {
        rowIDList = lookupList;
    }
}


//uses sortieRowLabel to find a row in the row array with matching value
function findRowNum(sortieRowLabel) {
    for (let r = 0; r < rowIDList.length; r++) {
        if (rowIDList[r] == sortieRowLabel) {
            return r;
        }
    }
    return 0; //give a default value
}
