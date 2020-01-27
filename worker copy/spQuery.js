// Functionaility for extracting information from SharePoint and building timeline objects from the resulting data
//*only accessed from web worker so that all communication is done in the background
//**web worker cannot access any DOM functions or process XML directly, so regex used instead
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
function buildMsnQuery(pastTime, futureTime) {
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
        '</Where><OrderBy>' +
        '<FieldRef Ascending="TRUE" Name="schedOn" />' +
        '<FieldRef Ascending="False" Name="schedOff" />' +
        '<FieldRef Ascending="TRUE" Name="actOn" />' +
        '</OrderBy ></Query > ';
    return queryString;
}

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
                //pass the xml to a specialized subroutine to handle
                callback(this.responseText, callbackParams);
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

    //if synchronous, return the results (already parsed as xml) back to the caller
    if (!async) {
        return xhttp.responseText;
    }
}

//---Specialized return data handlers for parsing query response and building displays

//builds event list from mission table response
//if station option is chosen, stations will be loaded asynchronously for each event before the event is drawn (from the asynch handler)
//if stations will not be displayed, all events are redrawn from here
function buildEventsList(rText) {
    var tEventList = []; //temporary list for events

    //iterate through every row and build objects
    var rowList = rText.split("<z:row");
    for (let row of rowList) {
        //*response from missing attribute is "null" which is equivalent to "undefined"

        //collect basic info
        var msnID = searchSPValues("ows_ID", row)[0];
        if (msnID != undefined) { //test for existing data - first round will almost always be empty because it contains headers, not data
            var msnNumber = searchSPValues("ows_msnNumber", row)[0];
            var airfield = searchSPValues("ows_fkAirfield", row)[1];//1 gets lookup value
            var squadron = searchSPValues("ows_fkSquadron", row)[1];
            var schedStartTime = parseSPDateTime(searchSPValues("ows_schedTakeoff", row)[0]);
            var schedEndTime = parseSPDateTime(searchSPValues("ows_schedLand", row)[0]);
            var actStartTime = parseSPDateTime(searchSPValues("ows_actTakeoff", row)[0]);
            var actEndTime = parseSPDateTime(searchSPValues("ows_actLand", row)[0]);
            var groundStationNumber = searchSPValues("ows_fkMCE_x003a_shelter", row)[1];
            var tailNumber = searchSPValues("ows_fkTailNumber", row)[1];
            var sortieNote = searchSPValues("ows_Title", row)[0];
            var msnEffective = searchSPValues("ows_fkMsnEffective", row)[1];

            var rowIndex;
            var colorCode;
            var cocomCode = searchSPValues("ows_fkCOCOM", row)[0]; //for COCOM values, it's easier to match to an ID than a name
            if (msnNumber.search("BX") == 0) {
                //           rowIndex = 5; //BX names must start with BX so that false positives don't get thrown in here
                colorCode = 5;
            } else if (cocomCode == 1) {
                //            rowIndex = 0;
                colorCode = 0;
            } else if (cocomCode == 6) {
                //            rowIndex = 1;
                colorCode = 1;
            } else if (cocomCode == 2) {
                //            rowIndex = 2;
                colorCode = 2;
            } else if (cocomCode == 3) {
                //           rowIndex = 3
                colorCode = 3;
            } else {
                //            rowIndex = 4; //local row catches all extras until new categories are built
                colorCode = 4;
            }

            //add to the events list
            let tEvent = new Sortie(msnID, cocomCode, airfield, colorCode, squadron, schedStartTime, schedEndTime, msnNumber, groundStationNumber, tailNumber, sortieNote, actStartTime, actEndTime, msnEffective);
            if (tEvent != undefined) {
                tEventList.push(tEvent);
            }
        }
    }

    return tEventList;
}

function buildStations(rText, msnID) {
    var sortie;
    var stationMsg = new Object();

    //try to find sortie by the msnID passed in
    for (let s of tempEventList) {
        if (s.id == msnID) {
            sortie = s;
            break;
        }
    }

    //iterate through every row (if there are any) to add stations to the event
    var rowList = rText.split("<z:row");
    for (let row of rowList) {
        if (sortie == undefined) {
            //get the parent event by finding the matching msnID
            var msnID = searchSPValues("ows_fkMsn", row)[0];
            for (let s of tempEventList) {
                if (s.id == msnID) {
                    sortie = s;
                    break;
                }
            }
        }

        //if we didn't find a sortie, we're probably not going to be that useful anyway
        if (sortie != undefined) {
            var stationID = searchSPValues("ows_ID", row)[0];
            var stationName = searchSPValues("ows_stationName", row, row)[0];
            var schedStartTime = parseSPDateTime(searchSPValues("ows_schedOn", row)[0]);
            var schedEndTime = parseSPDateTime(searchSPValues("ows_schedOff", row)[0]);
            var actStartTime = parseSPDateTime(searchSPValues("ows_actOn", row)[0]);
            var actEndTime = parseSPDateTime(searchSPValues("ows_actOff", row)[0]);

            var station = new Station(stationID, stationName, schedStartTime, schedEndTime, actStartTime, actEndTime);
            sortie.addStation(station);
        }
    }

    stationMsg.eventID = msnID;
    stationMsg.eventList = tempEventList;
    postMessage(stationMsg);

}

//builds a list of rows for Airfields
function buildRowsAirfields(rText) {
    var rowInfo = new Object(); //object to pass data back
    rowInfo.rowLookup = ["NONE"];
    rowInfo.rowHeadings = ["NONE"];

    //iterate through every row (if there are any) to add Airfield ICAO/names to lists
    var rowList = rText.split("<z:row");
    for (let row of rowList) {
        var rowVal = searchSPValues("ows_cvum", row)[0];
        if (rowVal != undefined) {
            rowInfo.rowLookup.push(rowVal);
            rowInfo.rowHeadings.push(rowVal + "<br/>" + searchSPValues("ows_Title", row)[0]);
        }
    }

    return rowInfo;
}

//builds a list of rows for MCEs
function buildRowsMCEs(rText) {
    var rowInfo = new Object(); //object to pass data back
    rowInfo.rowHeadings = ["NONE"];

    //iterate through every row (if there are any) to add MCE names to list
    var rowList = rText.split("<z:row");
    for (let row of rowList) {
        var rowVal = searchSPValues("ows_shelter", row)[0];
        if (rowVal != undefined) {
            rowInfo.rowHeadings.push(rowVal);
        }
    }

    return rowInfo;
}


//---Utility functions--------------------------------------------------------------------------------------

//uses searchTerm to retrieve the value held in a SharePoint List Field corresponding to the name
//returns an array [value,lookup value]
function searchSPValues(searchTerm, searchStr) {
    var regex = new RegExp(searchTerm + "='([^';]*)(?:;#)?([^']*)'");
    var returnArray = [];
    var found = regex.exec(searchStr);

    if (found != undefined) {
        returnArray[0] = found[1];
        returnArray[1] = found[2];
    }

    return returnArray;
}

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