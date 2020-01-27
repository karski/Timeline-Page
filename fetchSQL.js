/*
* Use fetch to make calls to the SQL server and parallelize our requests
*/
var sortieURL = "./getSortieTimespan.php";
var stationsURL = "./getSortieStations.php";

function buildTimelineURLQuery() {
    let today = new Date();
    let start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
    let end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
    return sortieURL + "?start=" + JSON.stringify(start) + "&end=" & JSON.stringify(end);
}
function buildStationsURLQuery(sortie) {
    return stationsURL + "?ID=" + sortie.ID;
}

// Returns a promise that resolves when sortie station info has been ingested into the global EventList
function fetchStation(sortie) {
    let p = fetch(buildStationsURLQuery(sortie))
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return Promise.reject(response.status + ":" + response.statusText);
            }
        })
        .then(data => {
            console.log("received station data");
            console.log(data);
            console.log("do I have access to passed sortie? ");
            console.log(sortie);
            
            //find the correct sortie - get the msnID from the first station entry
            //let sortie;
            if (data !== undefined && data.length > 0) {
                //sortie = eventList.find(s=>{return s.id == data[0].fkMsn});
                /* for (let s of eventList) {
                    if (s.id == data[0].fkMsn) {
                        sortie = s;
                        break;
                    }
                } */

                //create and add stations to the sortie
                if (sortie !== undefined) {
                    for (let station of data) {
                        sortie.addStation(
                            new Station(
                                station.ID,
                                station.stationName,
                                parseSQLServDate(station.schedOn),
                                parseSQLServDate(station.schedOff),
                                parseSQLServDate(station.actOn),
                                parseSQLServDate(station.actOff)
                            )
                        );
                    }
                }
            }
            return Promise.resolve(sortie);

        })
        .catch(err => {
            return Promise.resolve("fetchStation failed: " + err);
        });

    return p;
}

function fetchAll() {
    fetch(buildTimelineURLQuery())
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return Promise.reject(response.status + ":" + response.statusText);
            }
        })
        .then(data => {
            //build your list of sorties for display
            eventList = []; //clear out any existing events

            for (const row of data) {
                let colorCode; //for now, color is completely tied to COCOM, but could include squadron or other variables
                if (row.msnNumber.search("BX") == 0) {
                    colorCode = 5; //BX names must start with BX so that false positives don't get thrown in here
                } else if (row.fkCOCOM == 1) {
                    colorCode = 0;
                } else if (row.fkCOCOM == 6) {
                    colorCode = 1;
                } else if (row.fkCOCOM == 2) {
                    colorCode = 2;
                } else if (row.fkCOCOM == 3) {
                    colorCode = 3
                } else {
                    colorCode = 4; //local row catches all extras until new categories are built
                }

                eventList.push(new Sortie(
                    row.ID,
                    row.fkCOCOM,
                    row.ICAO,
                    null, //replaced with row values, since they were already identical
                    row.squadron,
                    parseSQLServDate(row.schedTakeoff),
                    parseSQLServDate(row.schedLand),
                    row.msnNumber,
                    row.shelter,
                    row.tail,
                    row.Title,
                    parseSQLServDate(row.actTakeoff),
                    parseSQLServDate(row.actLand),
                    row.code
                ));
            }

            //get stations if required
            let promiseList = [];
            if (document.getElementById("checkboxStations").checked) {
                //build a list of async calls for sorties
                eventList.map(sortie=>promiseList.push(fetchStation(sortie)));
            }
            return Promise.all(promiseList);
        })
        .then(result => {
            console.log("redrawing after all sorties received");
            redrawEvents();
        })
        .catch(error => {
            console.log('fetch error: ', error);
            if (confirm("Error getting data from database - Click OK to Refresh Page")) {
                location.reload();
            }
        })
}

function parseSQLServDate(d) {
    if (d !== null) { //add timezone onto the end of the date portion to fix auto local conversions
        return new Date(d.date + " " + d.timezone);
    } else {//provide null or undefined value so that the draw functions can tell there's nothing there
        return undefined;
    }
}