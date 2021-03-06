//Contains objects and methods for timeline Rows

var rowMode = "COCOM"; //default to COCOM layout until overridden
//IDs for rows when searching dynamically
var rowIDList = [];


//generates the list of rows by query or hardcoded values
//returns an object with rowHeadings and (optional) rowLookup
function updateTimelineRows(mode, rowMode) {
    var rowXML;
    //only go through this process if rowMode is different
    if (mode != rowMode) {
        //rowMode = mode; //update the rowMode

        //determine how to get the new row headers - query functions will call redrawRows to complete actions
        switch (mode) {
            case "Airfield":
                rowXML = retrieveListItems(siteURL, airfieldList, airfieldQuery, airfieldFields, false, buildRowsAirfields);
                return buildRowsAirfields(rowXML);
                break;
            case "MCE":
                rowXML = retrieveListItems(siteURL, mceList, mceQuery, mceFields, false, buildRowsMCEs);
                return buildRowsMCEs(rowXML);
                break;
            default: //use COCOM as default since it's hardcoded
                var rowObj = new Object;
                rowObj.rowHeadings = ["CENTCOM", "AFRICOM", "EUCOM", "PACOM", "Ferry/LOCAL</br>N/SCOM", "BACN"];
                return rowObj;
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

//remove rows that don't have any events (and ensure rows with events are drawn)
function hideEmptyRows() {
    var rowCollection = document.getElementsByClassName("timelineRow");
    for (let rowEntry of rowCollection) {
        if (rowEntry.getElementsByClassName("eventContainer").length > 0) {
            //there are events in this row
            rowEntry.classList.remove("empty");
        } else {
            //no events in this row, hide it
            rowEntry.classList.add("empty");
        }
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
