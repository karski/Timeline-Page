<?php
include "log_config.php";
/*get variables should be in the following formats (JSON Date String):
    getsorteitimespan.php?start="2019-04-16"&end="2019-04-20"
    getsorteitimespan.php?start="2019-04-16T00:00:00.000Z"&end="2019-04-20T00:00:00.000Z"
*/

//get variables from get parameters - if they don't exist, default to +/- 1 day
$startTime = json_decode($_GET["start"]);
if(!isset($startTime)||$startTime==null){
    $startTime=gmdate("Y/m/d H:i:s", gmmktime(0,0,0,gmdate("n"),gmdate("j")-1,gmdate("Y")));
}
$endTime = json_decode($_GET["end"]);
if(!isset($endTime)||$endTime==null){
    $endTime=gmdate("Y/m/d H:i:s", gmmktime(0,0,0,gmdate("n"),gmdate("j")+1,gmdate("Y")));
}

//plug our interpreted parameters into the SQL query
$sql = "SELECT tblMsn.ID, tblMsn.Title, tblMsn.schedTakeoff, tblMsn.actTakeoff, tblMsn.schedLand, tblMsn.actLand, tblMsn.msnNumber, tblMsn.callsign, tblMsn.cancelled, tblMsn.fkCOCOM, tblMsn.fkSquadron, tblMsn.fkAirfield, 
reftblCOCOM.cocom, reftblTailNumbers.tail, reftblMsnCodes.code, reftblSquadron.Title AS squadron, reftblShelter.shelter, reftblAirfield.ICAO
FROM tblMsn
LEFT JOIN reftblSqudron ON tblMsn.fkSquadron = reftblSquadron.ID
LEFT JOIN reftblCOCOM ON tblMsn.fkCOCOM = reftblCOCOM.ID
LEFT JOIN reftblTailNumbers ON tblMsn.fkTailNumber = reftblTailNumbers.ID
LEFT JOIN reftblMsnCodes ON tblMsn.fkMsnEffective = reftblMsnCodes.ID
LEFT JOIN reftblShelter ON tblMsn.fkMCE = reftblShelter.ID
LEFT JOIN reftblAirfield ON tblMsn.fkAirfield = reftblAirfield.ID
WHERE (((tblMsn.schedTakeoff)<='".$endTime."') AND
((tblMsn.schedLand)>='".$startTime."'))
ORDER BY tblMsn.schedTakeoff;";

$result = sqlsrv_query($conn,$sql);
$data=[];
while($row=sqlsrv_fetch_object($result)){
    $data[]=$row;
}
sqlsrv_close($conn);

header("Content-Type: application/json; charset=UTF-8");
echo json_encode($data,JSON_PRETTY_PRINT);

?>