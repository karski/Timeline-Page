var currentTime; //use to store current time so we don't keep querying a changing value during drawing calculations
var autoUpdateTimer;
var startGridNum = 4; //beginning of "in zone" time area
var timeOverrun = 2; //number of hour's worth of space in each "out of bounds" overrun
var pastTime;
var futureTime;
var eventList; //place to store all the events so they can be drawn together


//Set up initial conditions
//parse any location bar parameters for user selection info
//Don't initialize rowMode variable so that the first updatePage can ensure the rows are correct
var tParam = getParameterByName("rowMode");
if (tParam != undefined && tParam != '') {
    //select display mode
    document.querySelector('#selectRowMode [value="' + tParam + '"]').selected = true;
    //rowMode = tParam;
} 
tParam = getParameterByName("squadron");
if (tParam != undefined && tParam != '') {
    //select squadron
    document.querySelector('#selectSquadron [value="' + tParam + '"]').selected = true;
}
tParam = getParameterByName("showStations");
if (tParam != undefined && tParam != '') {
    //check or uncheck stations - use a test, since a string won't be interpreted as boolean
    document.getElementById("checkboxStations").checked = (tParam=="true");
}


//run the initial update
updatePage();

//initiate auto update intervals
autoUpdateTimer = setInterval(updatePage, 60000); //run update every minute

//input handlers
function clickStations() {
    //record selection for reloads
    addParamter("showStations", document.getElementById("checkboxStations").checked);
    //update page to requery with additional station queries
    updatePage();
}
function changeSquadron() {
    //record selection for reloads
    addParamter("squadron", document.getElementById("selectSquadron").selectedOptions[0].value);
    //simply redraw since we are never filtering queries by squadron
    redrawEvents();
}
function changeRowMode() {
    //record selection for reloads
    addParamter("rowMode", document.getElementById("selectRowMode").selectedOptions[0].value);

    getTimelineRows(document.getElementById("selectRowMode").selectedOptions[0].value);

    //full requery no longer required since row data will exist in event, we just need to redraw to assign to the correct new rows
    redrawEvents();
}

//this function should be run on an interval to keep page info up to date as time and flight data changes
function updatePage() {
    updateTimeHeader();

    //delete old list of events first - we are refreshing all the data anyway, so this will make removing unused events faster
    eventList = [];

    //determine desired row mode
    var rowModeSelect = document.getElementById("selectRowMode").selectedOptions[0].value;
    if (rowModeSelect != rowMode) {
        updateTimelineRows(rowModeSelect);
    }

    //query database for flight data
    retrieveListItems(siteURL, msnList, buildMsnQuery(), msnFields, true, buildEvents);    
}

//calls redraw for all events - useful if new data doesn't need to be pulled (like squadron change or row swapout)
function redrawEvents() {
    //get the squadron setting so it can be passed to the events and they can manage themselves
    var squadronSelect = document.getElementById("selectSquadron").selectedOptions[0].value;

    //determine desired row mode
    var rowModeSelect = document.getElementById("selectRowMode").selectedOptions[0].value;
    if (rowModeSelect != rowMode) {
        updateTimelineRows(rowModeSelect);
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

    //draw each event in the list
    for (let event of eventList) {
        if (event != undefined) {
            event.draw(squadronSelect);
        }
    }

    //remove rows that don't have any events (and ensure rows with events are drawn)
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

//in the future, if we want to dynamically resize the grid and show more days, the timeline headers should be completely automated, and this will need to be reworked 
function updateTimeHeader() {
    //could define past and future first, which might make building a dynamically sized timeline easier:
    //var d = new Date();
    //var dateRange = 1; //define the number of days on either side of today
    //pastTime = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dateRange));
    //futureTime = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dateRange+1));
    //then use for to loop through the difference between the two dates to build the tables and assign headers

    /*position nowMarker*/
    var d = new Date();
    currentTime = new Date(d); //set current time for drawings
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
    document.getElementById("nowMarker").setAttribute("style", "grid-column:" + (startGridNum + 24 + h) + ";");
    document.getElementById("nowLine").style.left = (m / 60 * 100) + "%";
    /*date labels and time limit global variables*/
    document.getElementById("todayHeader").innerHTML = formatDate(d);
    d.setUTCDate(d.getUTCDate() - 1);
    document.getElementById("yesterdayHeader").innerHTML = formatDate(d);
    pastTime = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),0,0));
    d.setUTCDate(d.getUTCDate() + 2);
    document.getElementById("tomorrowHeader").innerHTML = formatDate(d);
    d.setUTCDate(d.getUTCDate() + 1);
    futureTime = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0));
}


function formatDate(d) {
    var mmm = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return d.getUTCDate() + " " + mmm[d.getUTCMonth()];
}

//uses regular expression to get parameter from URL
//if parameter is not found, returns NULL
//Source: Jolly.exe's answer on https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript/21152762#21152762
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

//adds parameter to location or updates the existing value
//modified regexp from Jolly.exe's answer on https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript/21152762#21152762
function addParamter(name, value, addParamHeader) {
    var url = window.location.href.substr(window.location.href.lastIndexOf("/") + 1); //window.location.href;

    //if this is the first parameter, add #param modifier so that the page doesn't reload (if option selected)
    //this is only necessary if history replacement isn't being used
    //if (addParamHeader) {
    //    if (!(/#/.test(url))) {
    //        //internal link not set, put a dummy placemark in the url to prevent reloads when modifying parameters
    //        if (/\?/.test(url)) {
    //            //already has some params, add the param header in front of them
    //            url.substr(0, url.indexOf("?")) + "#param" + url.substr(a.indexOf("?"))
    //        } else {
    //            //simply place at end
    //            url = url + "#param";
    //        }
            
    //    }
    //}

    //check if already in location
    var regex = new RegExp("([?&]" + name + "=)(([^&#]*)|&|#|$)");
    if (regex.test(url)){
        //replace the existing value
        //window.location.href = url.replace(regex, '$1' + value);
        history.replaceState(null, "", url.replace(regex, '$1' + value));
    } else {
        //append to the end of the url
        //window.location.href = url + (/\?/.test(url) ? "&" : "?") + name + "=" + value;
        history.replaceState(null, "", url + (/\?/.test(url) ? "&" : "?") + name + "=" + value);
    }
}