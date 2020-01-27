//Asynchronous update worker that handles collecting all information for operations in the background
// Worker is required to ensure that certain operations occur in a reliable order - especially retrieving the list of rows prior to building the events
//  Updating the page based on worker results is handled in the timelineScript

//  SPQuery is used to initiate queries
//  timeLineEvents is used to create events
//  timelineRows is used to take correct action for row sources
importScripts('spQuery.js', 'timelineEvents.js', 'timelineRows.js');

//temporary event list that stores all the updates to pass back to the timelineScript
var tempEventList;

//handles all messages passed (this is the updater) - takes appropriate actions based on message contents
//expects input to be an object with (any inputs optional):
//  rowMode - currently displayed row mode
//  rowSelect - currently selected row mode (from dropdown or URL parameters)
//    *A mismatch between row variables will trigger row query
//  stations - T/F - retrieves station data if true, otherwise, only sortie info returned
//  refreshEvents - T/F - retrieves event data if true, otherwise (refresh timer or stations added)
//-Sends messages back with output object:--------------
//  rowHeadingList - list of headings for displaying/searching rows
//  rowHeadingHTML - if provided, row display is different than the searchable headings that are provided by queries
//  eventList - list of all events (as currently known)
//  eventID - single event that should be updated - this is used to draw an event when its station query data becomes available
//----Errors---
//  Error is thrown when bad reply is received - this can be assumed to be due to certificate timing out, should perform a page refresh to resolve
onmessage = function (e) {
    var inMsg = e.data; //access input msg info
    var oMsg = new Object(); //use this to pass data back

    //determine Row status
    if (inMsg.rowMode != undefined && inMsg.rowSelect != undefined) {
        if (inMsg.rowMode != inMsg.rowSelect) {
            //rowMode/rowSelect don't match (and both exist)
            //update rows to new selection
            var rowInfo = updateTimelineRows(inMsg.rowSelect, inMsg.rowMode);
            oMsg.rowHeadings = rowInfo.rowHeadings;
            oMsg.rowLookup = rowInfo.rowLookup;
            oMsg.rowMode = inMsg.rowSelect;
        }
    }

    //determine if events need to be queried - only if refreshEvents is defined and true
    if (inMsg.refreshEvents) {
        //request the event data asynchronously so that we can build the list prior to getting stations
        var eventXML = retrieveListItems(siteURL, msnList, buildMsnQuery(inMsg.pastTime, inMsg.futureTime), msnFields, false);
        tempEventList = buildEventsList(eventXML);
        oMsg.eventList = tempEventList; //add the events list to the return message

        //if stations are required, query them asynchronously - only if stations is defined and true
        if (inMsg.showStations) {
            for (let e of tempEventList) {
                //each sortie will post back its own station updates to the main thread
                retrieveListItems(siteURL, stationList, buildStationQuery(e.id), stationFields, true, buildStations, e.id);
            }
        }
    }

    //send return message (stations will send their own return messages from the asynch instances)
    postMessage(oMsg);
};