//Contains objects and methods for timeline sorties

//quick lookup for color codes
var colorCodeValues = ["brown", "purple", "pink", "green", "blue", "grey", "lightblue"];

//Defines Sortie object type
//Sorties have 3 expected elements: ID, schedStart, and schedEnd
//everything else can be filled in later
function Sortie(msnID, cocomID, eventAirfield, eventColor, squadron, schedStartTime, schedEndTime, missionNumber, groundStationNumber, tailNumber, sortieNote, actStartTime, actEndTime, msnEffective) {

        this.id = msnID;
        this.squad = squadron;
        //this.row = rowNumber; - use rowMode selection to determine row during draw
        this.colorCode = eventColor;
        this.msnNum = missionNumber;
        this.tNum = tailNumber;
        this.note = sortieNote;
        this.effective = msnEffective;

        //row discriminators
        this.gsNum = groundStationNumber;
        this.airfield = eventAirfield;
        //determine COCOM based on ID and msn name
        if (this.msnNum.search("BX") == 0) {
            this.cocomRow = 5; //BX names must start with BX so that false positives don't get thrown in here
        } else if (cocomID == 1) {
            this.cocomRow = 0;
        } else if (cocomID == 6) {
            this.cocomRow = 1;
        } else if (cocomID == 2) {
            this.cocomRow = 2;
        } else if (cocomID == 3) {
            this.cocomRow = 3
        } else {
            this.cocomRow = 4; //local row catches all extras until new categories are built
        }

        this.schedStart = new Date(schedStartTime);
        this.schedEnd = new Date(schedEndTime);

        this.actStart = actStartTime;
        this.actEnd = actEndTime;

        this.stations = [];
    //}
}

//A second Sortie Object constructor that uses a generic object to build the Sortie object
//This allows us to rebuild a sortie after it has been passed (serialized) via a post
//includes two methods for acheiving so that speed of each approach can be tested
//   1: build new objects through the Sortie and Station constructors
//   2 (or anything else): use Object.assign to map attributes and functions to the prototypes
function buildSortieFromSerializedObj(obj, method) {
    if (method == 1) {
        //build new objects using the values inside the current object
        var sortieObj = new Sortie(
            obj.id,
            undefined,
            obj.airfield,
            obj.colorCode,
            obj.squad,
            obj.schedStart,
            obj.schedEnd,
            obj.msnNum,
            obj.gsNum,
            obj.tNum,
            obj.note,
            obj.actStart,
            obj.actEnd,
            obj.effective
        );
        sortieObj.cocomRow = obj.cocomRow;//COCOM is mapped to a row ID, so this needs to be added separately
        //add in stations
        for (let s of obj.stations) {
            sortieObj.addStation(new Station(s.id, s.name, s.schedStart, s.schedEnd, s.actStart, s.actEnd));
        }
        return sortieObj;
    } else {
        //Assign parameters to the object protoype mapping
        var sortieObj = Object.assign(Sortie.prototype, obj);
        //do the same for any stations that may exist
        for (let s of sortieObj.stations) {
            s = Object.assign(Station.prototype, s);
        }
        return sortieObj;
    }
}

//Sortie drawing functions - higher level and should be accessed directly more often than the ones below

//redraws or creates visualization of event
//need to know the bounds of the drawing window to properly trim events and assign them to columns
Sortie.prototype.draw = function (squadronSelect, currentRowMode) {
    //only draw if the event belongs to the current display squadron (or if the selection wasn't passed)
    if (squadronSelect == undefined || squadronSelect == "All" || squadronSelect == this.squad) {
        //it looks like the drawing speed isn't impacted much by redrawing, and erasing the entry prevents it sticking in the wrong row
        //erase existing events so that they show up on the correct row in case info changed
        this.erase();

        var eventElement = document.getElementById(this.id);


        if (eventElement == null || eventElement == undefined) {
            //drawing hasn't been created yet, create eventElement inside the correct row
            eventElement = document.createElement("div");
            eventElement.id = this.id;
            eventElement.className = "eventContainer";
            //add to DOM now so that we don't have to do it later - in the future, think about doing all the updating first, then drawing all at once...
            document.getElementsByClassName("timelineRow")[this.getRowNum(currentRowMode)].appendChild(eventElement);
        }

        //reset color class based on color code
        eventElement.classList.remove(...colorCodeValues);
        if (this.colorCode != undefined) {
            eventElement.classList.add(colorCodeValues[this.colorCode]);
        } else {
            eventElement.classList.add(colorCodeValues[6]);
        }

        //update start and end in case times have changed since last draw
        eventElement.style.gridColumnStart = this.getFirstGrid();
        eventElement.style.gridColumnEnd = this.getFirstGrid() + this.getEventGridLength();

        //we now have an empty eventContainer on our page, start filling it in
        //create items from top to bottom
        //scheduled time labels
        var schedTimeElement = document.createElement("div");
        schedTimeElement.className = "schedTimeContainer";
        var schedStartTimeElement = document.createElement("span");
        schedStartTimeElement.className = "timeLabel";
        schedStartTimeElement.innerText = formatTime(this.schedStart);
        var schedEndTimeElement = document.createElement("span");
        schedEndTimeElement.className = "timeLabel endTime";
        schedEndTimeElement.innerText = formatTime(this.schedEnd);

        schedTimeElement.appendChild(schedStartTimeElement);
        schedTimeElement.appendChild(schedEndTimeElement);
        eventElement.appendChild(schedTimeElement);

        //sortie bar
        var sortieElement = document.createElement("div");
        sortieElement.className = "sortieBar";
        if (pastTime != undefined && this.schedStart < pastTime) {
            sortieElement.classList.add("past");
        } else if (futureTime != undefined && this.schedEnd > futureTime) {
            sortieElement.classList.add("future");
        }
        sortieElement.style.left = this.getSortiePercentLeft();
        sortieElement.style.width = this.getSortiePercentWidth();

        //fill in contents that exist
        if (this.msnNum != undefined) {
            var sortieHeader = document.createElement("h3");
            sortieHeader.innerText = this.msnNum;
            //add effectiveness if it exists
            if (this.effective != undefined) {
                sortieHeader.innerText += " - " + this.effective;
                //color code - only use cnx color because the other colors blend too much
                if (this.effective == "Effective") {
                    //sortieHeader.classList.add("success");
                } else if (this.effective == "Parially Effective") {
                    //sortieHeader.classList.add("partial");
                } else { //assumes all other values are bad
                    sortieHeader.classList.add("cnx");
                }
            }
            sortieElement.appendChild(sortieHeader);
        }
        if (this.gsNum != undefined || this.tNum != undefined) {
            var tailElement = document.createElement("p");
            tailElement.innerText = ((this.gsNum != undefined) ? this.gsNum : "") +
                ((this.gsNum != undefined && this.tNum != undefined) ? " / " : "") +
                ((this.tNum != undefined) ? this.tNum : "");
            if (squadronSelect == "All" && this.squad != undefined) {
                tailElement.innerHTML = "<b>" + this.squad + "</b> | " + tailElement.innerText;
            }
            sortieElement.appendChild(tailElement);
        }
        if (this.note != undefined) {
            var noteElement = document.createElement("p");
            noteElement.innerText = this.note;
            sortieElement.appendChild(noteElement);
        }

        eventElement.appendChild(sortieElement);

        //progress bar - only add if start time exists
        if (pastTime != undefined && this.actStart != undefined && this.actStart != 0) {
            var progressElement = document.createElement("div");
            progressElement.className = "sortieProgress";
            if (pastTime != undefined && this.actStart != undefined && this.actStart != 0 && this.actStart < pastTime) {
                progressElement.classList.add("past");
            } else if (futureTime != undefined && this.actEnd != undefined && this.actEnd != 0 && this.actEnd > futureTime) {
                progressElement.classList.add("future");
            }
            progressElement.style.left = this.getSortieProgPercentLeft();
            progressElement.style.width = this.getSortieProgPercentWidth();

            eventElement.appendChild(progressElement);
        } else { //put in an empty bar to preserve spacing
            var progressElement = document.createElement("div");
            progressElement.className = "sortieProgress";
            progressElement.style.left = 0;
            progressElement.style.width = 0;
            eventElement.appendChild(progressElement);
        }

        //actual times
        var actualElement = document.createElement("div");
        actualElement.className = "actTimeContainer";
        if (this.actStart != undefined && this.actStart != 0) {
            var actStartElement = document.createElement("span");
            actStartElement.className = "timeLabel";
            actStartElement.innerText = formatTime(this.actStart);
            if (Math.abs(this.actStart - this.schedStart) / 3600000 > .5) {
                //mark as "offTime" if not on schedule (.5 hours off)
                actStartElement.classList.add("offTime");
            }
            actualElement.appendChild(actStartElement);
        }
        if (this.actEnd != undefined && this.actEnd != 0) {
            var actEndElement = document.createElement("span");
            actEndElement.className = "endTime timeLabel";
            actEndElement.innerText = formatTime(this.actEnd);
            if (Math.abs(this.actEnd - this.schedEnd) / 3600000 > .5) {
                //mark as "offTime" if not on schedule (.5 hours off)
                actEndElement.classList.add("offTime");
            }
            actualElement.appendChild(actEndElement);
        }
        eventElement.appendChild(actualElement);


        //loop through the collection of stations and draw each one
        //gather event length and first hour so that stations don't have to figure out parent attributes
        //TODO: draw events in start time order
        var eventLength = this.getEventLength();
        var eventFirstHour = this.getFirstHour();
        for (let s of this.stations) {
            if (s != undefined) {
                //it's somewhat common for stations not to include all the time fiels, so be careful!
                //use corrected times for all tests
                if (s.correctedSchedStart() != undefined && s.correctedSchedEnd() != undefined) {
                    var stationElement = document.createElement("div");
                    stationElement.className = "stationBar";

                    //determine past/future
                    if (pastTime != undefined && s.correctedSchedStart() < pastTime) {
                        stationElement.classList.add("past");
                    } else if (futureTime != undefined && s.correctedSchedEnd() > futureTime) {
                        stationElement.classList.add("future");
                    }

                    stationElement.style.left = s.getStationPercentLeft(eventLength, eventFirstHour);
                    stationElement.style.width = s.getStationPercentWidth(eventLength);

                    if (s.name != undefined) {
                        stationElement.innerText = s.name;
                    }
                    eventElement.appendChild(stationElement);

                    //check actual times
                    if (s.correctedActStart() != undefined) {
                        var stationProgressElement = document.createElement("div");
                        stationProgressElement.className = "stationProgress";

                        //can only be in the past
                        if (pastTime != undefined && s.correctedActStart() < pastTime) {
                            stationProgressElement.classList.add("past");
                        }

                        stationProgressElement.style.left = s.getStationProgPercentLeft(eventLength, eventFirstHour);
                        stationProgressElement.style.width = s.getStationProgPercentWidth(eventLength);

                        eventElement.appendChild(stationProgressElement);
                    }
                }
            }
        }
    } else {
        //squadron not the one selected - erase self if existing in the page
        var eventElement = document.getElementById(this.id);
        if (eventElement != undefined) {
            eventElement.outerHTML = "";
        }
    }
}

//erases the drawn event if it exists on the page
Sortie.prototype.erase = function () {
    var eventElement = document.getElementById(this.id);
    if (eventElement != null && eventElement != undefined) {
        eventElement.outerHTML = "";
        //alternative option:
        //eventElement.parentNode.removeChild(eventElement);
    }
};


//Sortie funcitons - use these to update so that changes can be directly applied to the page

//Determines the correct row based on current rowMode
Sortie.prototype.getRowNum = function (currentRowMode) {
    //determine row based on selection
    var rowLabel;
    if (currentRowMode == "Airfield") {
        if (this.airfield == undefined) {
            rowLabel = "None";
        } else {
            rowLabel = this.airfield;
        }
    } else if (currentRowMode == "MCE") {
        if (this.gsNum == undefined) {
            rowLabel = "None";
        } else {
            rowLabel = this.gsNum;
        }
    } else {
        //use COCOM as default - this row value is saved to the event variable
        return this.cocomRow;
    }
    //use find rownum to search for row number if a fixed value wasn't already returned
    return findRowNum(rowLabel);
}


//"corrected" functions return times corrected for boundaries provided (and current time for actuals)
//expect timeOverrun in hours since basic blocks are an hour long
Sortie.prototype.correctedSchedStart = function () {
    var cSchedStart = this.schedStart //assume we have a start time
    if (cSchedStart < pastTime) {
        //starts in the past, trim to beginning of past overrun
        cSchedStart = new Date(pastTime.getTime() - (timeOverrun * 3600000));
    } else if (cSchedStart > futureTime) {
        //starts in the future, trim to beginning of future overrun
        cSchedStart = futureTime;
    }
    return cSchedStart;
}
Sortie.prototype.correctedSchedEnd = function () {
    var cSchedEnd = this.schedEnd; //assume we have an end time
    if (cSchedEnd < pastTime) {
        //ends in the past, trim to end of past overrun
        cSchedEnd = pastTime;
    } else if (cSchedEnd > futureTime) {
        //ends in the future, trim to end of future overrun
        cSchedEnd = new Date(futureTime.getTime() + (timeOverrun * 3600000));
    }
    return cSchedEnd;
}
Sortie.prototype.correctedActStart = function () {
    var cActStart = this.actStart;
    //check to see if we have a stored start time
    if (cActStart == undefined || cActStart == 0 || cActStart > currentTime || cActStart > futureTime) {
        //nothing stored (or invalid future value), 
        //   return scheduled start so that we can make assumptions elsewhere (especially with length calcs)
        cActStart = this.correctedSchedStart();
    } else if (cActStart < pastTime) {
        //started in the past, trim to beginning of past overrun
        cActStart = new Date(pastTime.getTime() - (timeOverrun * 3600000));
    }
    return cActStart;
}
Sortie.prototype.correctedActEnd = function () {
    var cActEnd = this.actEnd;
    if (this.actStart == undefined || this.actStart == 0 || this.actStart > currentTime || this.actStart > futureTime) {
        //event hasn't started yet, so we can't have an end point,
        //   return scheduled start so that we can make assumptions elsewhere (especially with length calcs)
        cActEnd = this.correctedActStart();
    } else if (cActEnd == undefined || cActEnd == 0 || cActEnd > currentTime || cActEnd > futureTime) {
        //we have a start, but the end is not stored (or invalid future value), 
        //  provide the current time, since that's the latest it could possibly be
        cActEnd = currentTime;
    } else if (cActEnd < pastTime) {
        //ended in the past, trim to end of past overrun
        cActEnd = pastTime;
    }
    return cActEnd;
}


//returns the first event time (rounded down to the hour) in the sortie
//trimmed to time limits
Sortie.prototype.getFirstHour = function () {
    var firstTime = this.correctedSchedStart(); //if nothing else, sched start should exist and be before other events

    if (this.correctedActStart() < firstTime) { //compare actual start
        firstTime = this.correctedActStart();
    }

    //go through list of events to ensure none occur before this (they shouldn't)
    for (let s of this.stations) {
        if (s.correctedSchedStart() < firstTime) {
            firstTime = s.correctedSchedStart();
        }
        if (s.correctedActStart() < firstTime) {
            firstTime = s.correctedActStart();
        }
    }

    //round down to hour
    firstTime = new Date(Date.UTC(firstTime.getUTCFullYear(), firstTime.getUTCMonth(), firstTime.getUTCDate(), firstTime.getUTCHours(), 0, 0));
    return firstTime;
};

//provides the grid number of the start of the event
//doesn't work right if the event starts in the future (it shouldn't be drawn then)
//startGridNum is the grid number of the first "inbounds" time (not including time overrun)
Sortie.prototype.getFirstGrid = function () {
    var firstTime = this.getFirstHour();
    if (firstTime < pastTime) {//event starts in the past
        return startGridNum - timeOverrun;
    } else {//use the difference in hours between the startTime and eventFirstTime then add that to the start gridNum
        return ((firstTime - pastTime) / 3600000) + startGridNum;
    }
};

//returns the last event time (rounded up to the hour) in the sortie
//trimmed to time limits
Sortie.prototype.getLastHour = function () {
    var lastTime = this.correctedSchedEnd(); //if nothing else sched end should exist and be after other events

    if (this.correctedActEnd() > lastTime) { //compare actual end
        lastTime = this.correctedActEnd();
    }

    //go through list of events to ensure none occur before this (they shouldn't)
    for (let s of this.stations) {
        if (s.correctedSchedEnd() > lastTime) {
            lastTime = s.correctedSchedEnd();
        }
        if (s.correctedActEnd() > lastTime) {
            lastTime = s.correctedActEnd();
        }
    }

    //round up to next hour
    lastTime = new Date(Date.UTC(lastTime.getUTCFullYear(), lastTime.getUTCMonth(), lastTime.getUTCDate(), lastTime.getUTCHours() + ((lastTime.getUTCMinutes() > 0) ? 1 : 0), 0, 0));
    return lastTime;
};

//returns the length of the event in time/grid units(hours)
//Trims length to the limits of the display
Sortie.prototype.getEventLength = function () {
    var eventStart = this.getFirstHour();
    var eventEnd = this.getLastHour();

    return (eventEnd - eventStart); //full time so that percentages can be accurate
};
//same as above, but provides grid units
Sortie.prototype.getEventGridLength = function () {
    var eventStart = this.getFirstHour();
    var eventEnd = this.getLastHour();

    return (eventEnd - eventStart) / 3600000; //number of Fractions (columns long)
};

//provides the relative left position of the sortie in percentage to the entire event
Sortie.prototype.getSortiePercentLeft = function () {
    var timeFromLeft = (this.correctedSchedStart() - this.getFirstHour());
    return ((timeFromLeft / this.getEventLength()) * 100) + "%";
};

//provides the relative width of the sortie in percentage to the entire event
Sortie.prototype.getSortiePercentWidth = function () {
    return (((this.correctedSchedEnd() - this.correctedSchedStart()) / this.getEventLength()) * 100) + "%";
};

//provides the relative left position of the sortie progress in percentage to the entire event
Sortie.prototype.getSortieProgPercentLeft = function () {
    if (this.actStart == 0 || this.actStart == undefined || this.actStart > currentTime || this.actStart < pastTime) {
        return "0%"; //overran past so anchor left, doesn't exist, or bad future value
    } else {
        var timeFromLeft = (this.correctedActStart() - this.getFirstHour());
        return ((timeFromLeft / this.getEventLength()) * 100) + "%";
    }
};

//provides the relative width of the sortie progress in percentage to the entire event
Sortie.prototype.getSortieProgPercentWidth = function () {
    if (this.actStart == 0 || this.actStart == undefined || this.actStart > currentTime) {
        return "0%"; //event hasn't started yet, or a bad start value, don't draw anything
    } else { //event has started
        return (((this.correctedActEnd() - this.correctedActStart()) / this.getEventLength()) * 100) + "%";
    }
};

//adds a station object to the current event
Sortie.prototype.addStation = function (station) {
    this.stations.push(station);
};

Sortie.prototype.clearStations = function () {
    this.stations = [];
};



//Defines Station object type
//Stations have 3 expected elements: ID, schedStart, and schedEnd
function Station(stationID, stationName, schedStartTime, schedEndTime, actStartTime, actEndTime) {
    this.id = stationID;
    this.name = stationName;

    this.schedStart = schedStartTime;
    this.schedEnd = schedEndTime;

    this.actStart = actStartTime;
    this.actEnd = actEndTime;
};


//second constructor so that a station can be built from a serialized object passed via post


//Station functions - use these to update so that changes can be directly applied to the page



//"corrected" functions return times corrected for boundaries provided (and current time for actuals)
//expect timeOverrun in hours since basic blocks are an hour long
Station.prototype.correctedSchedStart = function () {
    //figure out which times are available for start
    var cSchedStart;
    if (this.schedStart != undefined) {
        //if we have a scheduled start, use that
        cSchedStart = this.schedStart;
    } else if (this.actStart != undefined && this.actStart < currentTime) {
        //if there is no scheduled start, use actual start as long as it is in the past
        cSchedStart = this.actStart;
    }

    if (cSchedStart < pastTime) {
        //starts in the past, trim to beginning of past overrun
        cSchedStart = new Date(pastTime.getTime() - (timeOverrun * 3600000));
    } else if (cSchedStart > futureTime) {
        //starts in the future, trim to beginning of future overrun
        cSchedStart = futureTime;
    }
    return cSchedStart;
}
Station.prototype.correctedSchedEnd = function () {
    //figure out which times are available for end
    var cSchedEnd;
    if (this.schedEnd != undefined) {
        //if we have a scheduled end, use that
        cSchedEnd = this.schedEnd;
    } else if (this.actEnd != undefined && this.actEnd < currentTime) {
        //if there is no scheduled start, use actual start as long as it is in the past
        cSchedEnd = this.actEnd;
    } else if (this.correctedSchedStart() != undefined) {
        //there is a start time, but no end times, so match to current time
        cSchedEnd = currentTime;
    }

    if (cSchedEnd < pastTime) {
        //ends in the past, trim to end of past overrun
        cSchedEnd = pastTime;
    } else if (cSchedEnd > futureTime) {
        //ends in the future, trim to end of future overrun
        cSchedEnd = new Date(futureTime.getTime() + (timeOverrun * 3600000));
    }
    return cSchedEnd;
}
Station.prototype.correctedActStart = function () {
    var cActStart = this.actStart;
    //check to see if we have a stored start time
    if (cActStart == undefined || cActStart == 0 || cActStart > currentTime || cActStart > futureTime) {
        //nothing stored (or invalid future value), 
        //   return scheduled start so that we can make assumptions elsewhere (especially with length calcs)
        cActStart = undefined;
    } else if (cActStart < pastTime) {
        //started in the past, trim to beginning of past overrun
        cActStart = new Date(pastTime.getTime() - (timeOverrun * 3600000));
    }
    return cActStart;
}
Station.prototype.correctedActEnd = function () {
    var cActEnd = this.actEnd;
    if (this.actStart == undefined || this.actStart == 0 || this.actStart > currentTime || this.actStart > futureTime) {
        //event hasn't started yet, so we can't have an end point,
        //   return scheduled start so that we can make assumptions elsewhere (especially with length calcs)
        cActEnd = undefined;
    } else if (cActEnd == undefined || cActEnd == 0 || cActEnd > currentTime || cActEnd > futureTime) {
        //we have a start, but the end is not stored (or invalid future value), 
        //  provide the current time, since that's the latest it could possibly be
        cActEnd = currentTime;
    } else if (cActEnd < pastTime) {
        //ended in the past, trim to end of past overrun
        cActEnd = pastTime;
    }
    return cActEnd;
}

//functions for determining length of stations compared to total event
//takes into account that stations often don't have all the time fields filled in, so a little more flexible than sortie times
//need to be passed event length/starting position since it would poor form to include a pointer to the parent in all the Stations

//provides the relative left position of the station in percentage to the entire event
Station.prototype.getStationPercentLeft = function (eventLength, eventFirstHour) {
    var timeFromLeft = (this.correctedSchedStart() - eventFirstHour);
    return ((timeFromLeft / eventLength) * 100) + "%";
};

//provides the relative width of the station in percentage to the entire event
Station.prototype.getStationPercentWidth = function (eventLength) {
    return (((this.correctedSchedEnd() - this.correctedSchedStart()) / eventLength) * 100) + "%";
};

//provides the relative left position of the station progress in percentage to the entire event
Station.prototype.getStationProgPercentLeft = function (eventLength, eventFirstHour) {
    if (this.actStart == 0 || this.actStart == undefined || this.actStart > currentTime || this.actStart < pastTime) {
        return "0%"; //overran past so anchor left, doesn't exist, or bad future value
    } else {
        var timeFromLeft = (this.correctedActStart() - eventFirstHour);
        return ((timeFromLeft / eventLength) * 100) + "%";
    }
};

//provides the relative width of the station progress in percentage to the entire event
Station.prototype.getStationProgPercentWidth = function (eventLength) {
    if (this.actStart == 0 || this.actStart == undefined || this.actStart > currentTime) {
        return "0%"; //event hasn't started yet, or a bad start value, don't draw anything
    } else { //event has started
        return (((this.correctedActEnd() - this.correctedActStart()) / eventLength) * 100) + "%";
    }
};


//These functions are not directly tied to the object types, but are useful to them

//creates simple HHMM display of a time
function formatTime(t) {
    return ((t.getUTCHours() < 10) ? '0' : '') + t.getUTCHours() + ((t.getUTCMinutes() < 10) ? '0' : '') + t.getUTCMinutes();
}