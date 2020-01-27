// Functionaility for extracting information from SharePoint and building timeline objects from the resulting data

var siteURL = "[[SharePoint Site URL]]";
var msnList = "tblMsn";
var stationList = "tblStation";
var airfieldList = "reftblAirfield";
var mceList = "reftblShelter";
var msnFields = '<ViewFields>' +
    '<FieldRef Name="ID" />' +
    '<FieldRef Name="Title" />' +
    '<FieldRef Name="msnNumber" />' +
    '<FieldRef Name="fkMCE" />' +
    '<FieldRef Name="fkMCE_x003a_shelter" />' +
    '<FieldRef Name="fkTailNumber" />' +
    '<FieldRef Name="fkCOCOM" />' +
    '<FieldRef Name="fkAirfield" />' +
    '<FieldRef Name="fkSquadron" />' +
    '<FieldRef Name="fkMsnEffective" />' +
    '<FieldRef Name="calcSchedDuration" />' +
    '<FieldRef Name="calcActDuration" />' +
    '<FieldRef Name="schedTakeoff" />' +
    '<FieldRef Name="schedLand" />' +
    '<FieldRef Name="actTakeoff" />' +
    '<FieldRef Name="actLand" />' +
    '</ViewFields>';
var stationFields = '<ViewFields>' +
    '<FieldRef Name="ID" />' +
    '<FieldRef Name="fkMsn" />' +
    '<FieldRef Name="stationName" />' +
    '<FieldRef Name="schedOn" />' +
    '<FieldRef Name="schedOff" />' +
    '<FieldRef Name="actOn" />' +
    '<FieldRef Name="actOff" />' +
    '</ViewFields>';
var airfieldFields = '<ViewFields>' +
    '<FieldRef Name="ID" />' +
    '<FieldRef Name="cvum" />' +
    '<FieldRef Name="Title" />' +
    '</ViewFields>';
var mceFields = '<ViewFields>' +
    '<FieldRef Name="ID" />' +
    '<FieldRef Name="shelter" />' +
    '<FieldRef Name="type" />' +
    '</ViewFields>';
var airfieldQuery = '<Query><OrderBy><FieldRef Ascending="TRUE" Name="cvum" /></OrderBy></Query>';
var mceQuery = '<Query><Where>' +
    '<Eq><FieldRef Name="type" /><Value Type="Text">MCE</Value></Eq>' +
    '</Where></Query>';

//builds a query to get missions using the current time variables
function buildMsnQuery() {
    return '<Query><Where>' +
        '<And><Or>' +
        '<Geq><FieldRef Name="schedLand" /><Value Type="Dattime" IncludeTimeValue="TRUE">' + formatSPDatetime(pastTime) + '</Value></Geq>' +
        '<Geq><FieldRef Name="actLand" /><Value Type="Dattime" IncludeTimeValue="TRUE">' + formatSPDatetime(pastTime) + '</Value></Geq>' +
        '</Or><Or>' +
        '<Leq><FieldRef Name="schedTakeoff" /><Value Type="Dattime" IncludeTimeValue="TRUE">' + formatSPDatetime(futureTime) + '</Value></Leq>' +
        '<Leq><FieldRef Name="actTakeoff" /><Value Type="Dattime" IncludeTimeValue="TRUE">' + formatSPDatetime(futureTime) + '</Value></Leq>' +
        '</Or></And>' +
        '</Where></Query>';
}

//builds a query to find stations for a specific msnID
function buildStationQuery(msnID) {
    var queryString = '<Query><Where>' +
        '<Eq><FieldRef Name="fkMsn" LookupId="TRUE" /><Value Type="Lookup">' + msnID + '</Value></Eq>' +
        '</Where></Query>';
    return queryString;
}

//TODO: future features for sortie details - consider getting all the data in the initial query and building directly into the event (slower first query, but no additional queries needed)
//          or build another set of query handlers for getting more detailed information about a single sortie (and the sortie stations) that would only be called when the user requests details (may affect responsiveness of details popover)
//TODO: future feature for getting row information - build in handler to generate grid rows and headings based on list returns(consider hiding rows using visibilty attribute that don't contain any events)
//function for querying Sharepoint lists and passing results to appropriate handlers
//calls on specialized functions to handle the response depending on the source - these functions will be handed the parsed XML response from the query
function retrieveListItems(siteAddress, listName, listQuery, listFields, async, callback, callbackParams) {
    var xhttp = new XMLHttpRequest();
    //generate the payload for the request using the input parameters
    //note: row limit to 500 fixed - this is probably the largest batch that can be handled in a reasonable time - I don't expect any queries to come back with this many results
    //QueryOptions don't appear to be doing anything, but if we need to add it back in, here it is:
    //'<queryOptons><QueryOptions><IncludeMandatoryColumns>FALSE</IncludeMandatoryColumns></QueryOptions></queryOptions>'
    var payloadQuery = '<GetListItems xmlns="http://schemas.microsoft.com/sharepoint/soap/">' +
        '<listName>' + listName + '</listName>' +
        '<rowLimit>500</rowLimit>' +
        '<viewName></viewName>' +
        '<viewFields>' + listFields + '</viewFields>' +
        '<query>' + listQuery + '</query>' +
        '<webID></webID>' +
        '</GetListItems>';
    var xmlEnvelope = '<?xml version="1.0" encoding="utf-8"?>' +
        '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
        '<soap:Body>' + payloadQuery + '</soap:Body></soap:Envelope>';
    var targetAddress = siteAddress + (siteAddress.slice(-1) == '/' ? '' : '/') + '_vti_bin/Lists.asmx';
    var targetRoot = siteAddress.substring(0, siteAddress.indexOf("sites/"));

    //response handler
    if (async) {
        xhttp.onreadystatechange = function () {
            if (this.readyState == XMLHttpRequest.DONE && this.status == 200) {
                //build an xml parser to handle the returned data DOM
                var xmlParse = new DOMParser();
                var xmlData = xmlParse.parseFromString(this.responseText, "text/xml");
                //pass the xml to a specialized subroutine to handle
                callback(xmlData, callbackParams);
            } else if (this.readyState == XMLHttpRequest.DONE && this.status != 200) {
                //alert("Error getting data from SharePoint - Click OK to Refresh Page");
                //location.reload();
            } else if (this.readyState == 4) {
                //received an error reply
                console.log(this.responseText);
            }
        };
    }

    xhttp.open("POST", targetAddress, async);
    xhttp.setRequestHeader("Content-Type", "text/xml; charset=utf-8");

    xhttp.send(xmlEnvelope);

    //if synchronous, return the results back to the caller
    if (!async) {
        return xhttp.responseText;
    }
}

//---Specialized return data handlers for parsing query response and building displays

//builds event list from mission table response
//if station option is chosen, stations will be loaded asynchronously for each event before the event is drawn (from the asynch handler)
//if stations will not be displayed, all events are redrawn from here
function buildEvents(xmlData) {
    var showStations = document.getElementById("checkboxStations").checked; //save status of stations option (so it doesn't change during processing)
    var gridMode = document.getElementById("selectRowMode").selectedOptions[0].value;
    var squadronSelect = document.getElementById("selectSquadron").selectedOptions[0].value;

    //iterate through every row and build objects
    var rowList = xmlData.getElementsByTagName("z:row");
    for (let row of rowList) {
        //*response from missing attribute is "null" which is equivalent to "undefined"

        //collect basic info
        var msnID = row.getAttribute("ows_ID");
        var msnNumber = row.getAttribute("ows_msnNumber");
        var airfield = getLookupValue(row.getAttribute("ows_fkAirfield"));
        var squadron = getLookupValue(row.getAttribute("ows_fkSquadron"));
        var schedStartTime = parseSPDateTime(row.getAttribute("ows_schedTakeoff"));
        var schedEndTime = parseSPDateTime(row.getAttribute("ows_schedLand"));
        var actStartTime = parseSPDateTime(row.getAttribute("ows_actTakeoff"));
        var actEndTime = parseSPDateTime(row.getAttribute("ows_actLand"));
        var groundStationNumber = getLookupValue(row.getAttribute("ows_fkMCE_x003a_shelter"));
        var tailNumber = getLookupValue(row.getAttribute("ows_fkTailNumber"));
        var sortieNote = row.getAttribute("ows_Title");
        var msnEffective = getLookupValue(row.getAttribute("ows_fkMsnEffective"));

        var rowIndex;
        var colorCode;
        var rowAttribute = getLookupID(row.getAttribute("ows_fkCOCOM")); //for COCOM values, it's easier to match to an ID than a name
        if (msnNumber.search("BX") == 0) {
            //           rowIndex = 5; //BX names must start with BX so that false positives don't get thrown in here
            colorCode = 5;
        } else if (rowAttribute == 1) {
            //            rowIndex = 0;
            colorCode = 0;
        } else if (rowAttribute == 6) {
            //            rowIndex = 1;
            colorCode = 1;
        } else if (rowAttribute == 2) {
            //            rowIndex = 2;
            colorCode = 2;
        } else if (rowAttribute == 3) {
            //           rowIndex = 3
            colorCode = 3;
        } else {
            //            rowIndex = 4; //local row catches all extras until new categories are built
            colorCode = 4;
        }

        //add to the events list
        let tEvent = new Sortie(msnID, rowIndex, colorCode, squadron, schedStartTime, schedEndTime, msnNumber, groundStationNumber, tailNumber, sortieNote, actStartTime, actEndTime, msnEffective);
        if (tEvent != undefined) {
            eventList.push(tEvent);
        }

        //if stations display option selected, make a new query to get stations, then allow drawing from there
        if (showStations) {
            retrieveListItems(siteURL, stationList, buildStationQuery(msnID), stationFields, true, buildStations, msnID);
        }

    }

    //erase all the displayed events that aren't in the event list
    var drawnEvents = document.getElementsByClassName("eventContainer");
    for (let eventElement of drawnEvents) {
        let dID = eventElement.id;
        let found = false;
        //search eventList for corresponding ID - if not found, delete
        for (let event of eventList) {
            if (event.id == dID) {
                found = true;
                break;
            }
        }
        if (!found) {
            //didn't find event described by drawn element in the current event list - erase it
            eventElement.outerHTML = "";
        }
    }

    //if stations are not displayed, iterate through the event list, calling draw for each one
    //(do this all at once, so there isn't a delay when updating)
    if (!showStations) {
        for (let event of eventList) {
            if (event != undefined) {
                event.draw(squadronSelect);
            }
        }
    }


    //TODO: future option - hide gridRows (using attribute visibility) that don't have any events assigned to them
    //      use the 

}

function buildStations(xmlData, msnID) {
    var squadronSelect = document.getElementById("selectSquadron").selectedOptions[0].value;
    var sortie;

    //try to find sortie by the msnID passed in
    for (let s of eventList) {
        if (s.id == msnID) {
            sortie = s;
            break;
        }
    }

    //iterate through every row (if there are any) to add stations to the event
    var rowList = xmlData.getElementsByTagName("z:row");
    for (let row of rowList) {
        if (sortie == undefined) {
            //get the parent event by finding the matching msnID
            var msnID = getLookupID(row.getAttribute("ows_fkMsn"));
            for (let s of eventList) {
                if (s.id == msnID) {
                    sortie = s;
                    break;
                }
            }
        }

        //if we didn't find a sortie, we're probably not going to be that useful anyway
        if (sortie != undefined) {
            var stationID = row.getAttribute("ows_ID");
            var stationName = row.getAttribute("ows_stationName");
            var schedStartTime = parseSPDateTime(row.getAttribute("ows_schedOn"));
            var schedEndTime = parseSPDateTime(row.getAttribute("ows_schedOff"));
            var actStartTime = parseSPDateTime(row.getAttribute("ows_actOn"));
            var actEndTime = parseSPDateTime(row.getAttribute("ows_actOff"));

            var station = new Station(stationID, stationName, schedStartTime, schedEndTime, actStartTime, actEndTime);
            sortie.addStation(station);
        }
    }

    //draw the event
    if (sortie != undefined) {
        sortie.draw(squadronSelect);
    }
}

//builds a list of rows for Airfields
function buildRowsAirfields(xmlData) {

}

//builds a list of rows for MCEs
function buildRowsMCEs(xmlData) {

}


//---Utility functions--------------------------------------------------------------------------------------

//formats a JavaScript date into format needed for SharePoint Query
function formatSPDatetime(d) {
    return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate() + " " + d.getUTCHours() + ":" + d.getUTCMinutes() + ":" + d.getUTCSeconds();
}

//parses SharePoint DateTime value (retrieved from query) into a JavaScript Date format
function parseSPDateTime(dString) {
    if (dString != undefined) {
        return new Date(dString.replace(" ", "T") + "Z");
    } else {
        return undefined;
    }
}

//returns the user-readable portion of the value of a SharePoint lookup response field (for display on the page)
function getLookupValue(lookupString) {
    if (lookupString != undefined) {
        var sArray = lookupString.split(";#");
        if (sArray.length > 1) {
            return sArray[1];
        } else {
            return ""; //couldn't find useful data, so leave as blank
        }
    }
}

function getLookupID(lookupString) {
    if (lookupString != undefined) {
        var sArray = lookupString.split(";#");
        return sArray[0];
    }
}