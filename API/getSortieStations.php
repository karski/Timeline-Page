<?php
include "log_config.php";
// get variable from GET parameters - die if not found
if(isset($_GET["ID"]) && $_GET["ID"]!=null && is_numeric($_GET["ID"])){
    $msnID = intval($_Get["ID"]);
    $sql = "SELECT tblStation.fkMsn, tblStation.ID, tblStation.Title, tblStation.stationName, tblStation.schedOn, tblStation.actOn, tblStation.schedOff, tblStation.actOff
    FROM tblStation
    WHERE (((tblStation.fkMsn)='".$msnID."'))
    ORDER BY tblStation.schedOn, tblStation.actOn"

    $result = sqlsrv_query($conn,$sql);
    $data=[];
    while($row=sqlsrv_fetch_object($result)){
        $data[]=$row;
    }
    sqlsrv_close($conn);

    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode($data,JSON_PRETTY_PRINT);

}else{
    die("Missing ID parameter");
}
?>