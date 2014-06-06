// split into objects: match(/([^{}]+)?(",*)/g)
// jsonify- matches commas not in parenthesis: .split(/,(?![^(]*\))/g)
// '{25127,-97.493526,35.405439,3.38,newDate(2014,4,17,7,26,20,437),false,"Phillips 66","Briscoes 66",false,false,0,0,"USA"}, {25127,-97.493526,35.405439,3.38,newDate(2014,4,17,7,26,20,437),false,"Phillips 66","Briscoes 66",false,false,0,0,"USA"}'.match(/([^{}]+)?(",*)/g)[0].split(/,(?![^(]*\))/g);
// ["25127", "-97.493526", "35.405439", "3.38", "newDate(2014,4,17,7,26,20,437)", "false", ""Phillips 66"", ""Briscoes 66"", "false", "false", "0", "0", ""USA""]
// .substring(417).replace(/\[/g, "{").replace(/\]/g, "}").match(/([^{}]+)?(",*)/g)[0].split(/,(?![^(]*\))/g)
// $.get("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xClient%20where%20url%3D%22http%3A%2F%2Fwww.gasbuddy.com%2Fajaxpro%2FGasBuddy_ASPX.GasTempMap%2CGasBuddy_ASPX.ashx%22%20and%20method%3D%22post%22%20and%20param%3D'%7B%22X-AjaxPro-Method%22%3A%20%22gus%22%7D'%20and%20content%3D'%7B%22sFuelType%22%3A%22A%22%2C%22dMinX%22%3A-97.52362377941608%2C%22dMaxX%22%3A-97.45667584240435%2C%22dMinY%22%3A35.396331149505535%2C%22dMaxY%22%3A35.43214586672435%2C%22sTimeLimit%22%3A%2248%22%7D'&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&format=json", function(result) { console.log(result.query.results.resources.content.substring(417).replace(/\[/g, "{").replace(/\]/g, "}").match(/([^{}]+)?(",*)/g)[0].split(/,(?![^(]*\))/g)) });
//{"Viewport":{"Density":2.0,"Height":1208,"Width":768},"UserLocation":{"Longitude":-122.1124116,"Latitude":37.6968401,"Accuracy":16},"AuthId":"gpPIqDoqSrAseO2k5Zbs9Q==","DateDevice":"2014-05-18 12:52:19","DateEastern":"2014-05-18 15:52:19","Parameters":{"City":"","Coordinate":{"Longitude":-122.1124116,"Latitude":37.6968401,"A":1},"Country":"","Zip":"","State":"","SearchTerms":"","PriceId":0,"SearchType":1,"IsPreload":false,"FuelId":1},"Key":"502928bdb67a2ad69dbbb30a987b45dd98cbdabb8a7f922d8ae35dfc3dcc432d","MemberId":"","Debug":false,"AppVersion":4.12,"Source":3,"AppSource":1,"WebServiceVersion":1}


var directionsDisplay;
var infowindow = new google.maps.InfoWindow();
var directionsService = new google.maps.DirectionsService();
var geocoder;
var map;
var gMarkers = [];
var overlays = [];
var sf = new google.maps.LatLng(37.774929, -122.419416);
var la = new google.maps.LatLng(34.052234, -118.243685);
function initialize() {
    directionsDisplay = new google.maps.DirectionsRenderer();
    geocoder = new google.maps.Geocoder();
    var mapOptions = {
        zoom: 14,
        center: sf
    }
    map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions);
    google.maps.event.addListener(map, 'loading', function(){
        console.log("loading");
        $("#loading").show();
    });
    google.maps.event.addListener(map, 'loaded', function(){
        console.log("done");
        $("#loading").hide();
    });
    directionsDisplay.setMap(map);
    $("#route").click(function(){calcRoute()});
    $("#via-button").click(function(){$("#via-button").before('<input type="text" class="via-point pure-input-1" placeholder="Via">')});
    calcRoute();


    $('.handle').drags();
}

function calcRoute() {
    google.maps.event.trigger(map, 'loading');

    try{
        while(overlays[0]){
            overlays.pop().setMap(null);
        }
    } catch(e) {}
    $("#info").html("");
    $("#distance").html("");

    var viapoints = [];

    $(".via-point", "#sidebar").each(function(i, val){
        var p = val.value;
        if(p !== "")
        viapoints.push({location: p, stopover: false});
    });

    var request = {
        origin: $("#start-loc").val(),
        destination: $("#end-loc").val(),
        travelMode: google.maps.TravelMode.DRIVING
    };
    var gastier = $("#gas-tier").val();

    if(viapoints.length !== 0) { request.waypoints = viapoints; }

    directionsService.route(request, function(result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            console.log(result);
            directionsDisplay.setDirections(result);
            var route = result.routes[0];
            var pathPoints = route.overview_path;

            var pt = whichPoint(pathPoints, 100);

            k = 0;
            for (var i = 0; i < pathPoints.length; i+=pt)
            //for(var i = 0; i < 5; i++)
            {
                //var pPoint = google.maps.geometry.spherical.interpolate(route.start_location, route.end_location, i * (.2));
                var pPoint = pathPoints[i];
                // console.log(pPoint);
                //(new google.maps.Marker({position: pathPoints[i]})).setMap(map);
                // anonymous wrapper to preserve loop counter in async function
                // pathPoints[i]
                (function(id){
                    var circle = new google.maps.Circle({
                                center: pPoint,
                                radius: 5000,
                                map: map
                    });
                    overlays.push(circle);

                    var start = (k == 0) ? 0 : (i-pt);
                    console.log("from " + start + " to " + i)
                    var dist = google.maps.geometry.spherical.computeLength(pathPoints.slice(start, i));
                    if(k !== 0)
                        $("#distance").append("Stretch " + k + ": " + Math.round(dist*0.000621371192) + " miles<br />");
                    k++;

                    function geocod() {
                        geocoder.geocode({'latLng': pPoint, 'bounds': circle.getBounds()}, function(results, status) {
                        if (status == google.maps.GeocoderStatus.OK) {
                                $("#info").append('<div class="area"><h3 class="area-title">'
                                     + results[0].formatted_address
                                     + '</h3><table class="pure-table" id="'+ id + '"><thead><tr><td>#</td><td>Price</td><td>Station</td></tr></thead><tbody></tbody></table></div>');

                                var circleBounds = circle.getBounds();
                                var swPoint = circleBounds.getSouthWest(); // dMin
                                var nePoint = circleBounds.getNorthEast(); // dMax

                                (function(s){
                                    $.ajax({
                                        url: buildYQL([gastier, swPoint, nePoint, "48"], "gus")
                                    }).done(function(data) {
                                        data = makeJSON(data);
                                        $.each(data, function(j, val) {
                                            var marker = new google.maps.Marker({
                                                position: new google.maps.LatLng(val.lat, val.lng),
                                                title: val.station_nm,
                                                map: map,
                                                id: val.id
                                            });
                                            marker.price = val.price;
                                            marker.sID = s;
                                            google.maps.event.addListener(marker, 'click', function(){
                                                getInfoWindowEvent(marker);
                                            });
                                            gMarkers.push(marker);
                                            overlays.push(marker);
                                            var markerID = (gMarkers.length-1);
                                            var markerList = $("#"+marker.sID + " tbody", "#info");
                                            markerList.append('<tr id="marker-' + (markerID) + '"><td>' + (val.id) + '</td><td>'
                                                                + val.price + '</td><td>'
                                                                + val.station_nm + '</td></tr>'
                                            );
                                            $("#marker-"+markerID, markerList).click( function() {myclick(markerID);});
                                        });
                                        sortTables();
                                    });
                                })(id);
                        } else if (status == google.maps.GeocoderStatus.OVER_QUERY_LIMIT ) {
                            //console.log(id + " " + status);
                            sleep(geocod);

                        } else {
                            console.log(id + " " + status);
                            alert("Geocoder failed due to: " + status);
                        }
                        });
                    }
                    geocod();
                })(i);
            }
            // for (var i = 0; i < pathPoints.length; i+=Math.round(pathPoints.length/5))
            // {
            //     var start = (k == 0) ? 0 : i-Math.round(pathPoints.length/5);
            //     console.log("from " + start + " to " + i)
            //     var dist = google.maps.geometry.spherical.computeLength(pathPoints.slice(start, i));
            //     if(k !== 0)
            //         $("#distance").append("Stretch " + k + ": " + Math.round(dist*0.000621371192) + " miles<br />");
            //     k++;
            // }

            $("#distance").append("Total: " + route.legs[0].distance.text + "<br />");
        }
        google.maps.event.trigger(map, 'loaded');
    });
}

function whichPoint(path, distance)
{
    distance *= 1609.34; // to meters
    var i = 0;
    while(google.maps.geometry.spherical.computeLength(path.slice(0, i)) < distance)
    {
        i+= 1;
    }

    return i;
}

function sortTables() {
    $("table", "#info").each(function(i, val) {
        var obj = $(val);
        obj.tablesorter({
           //theme: 'bootstrap',
           // hidden filter input/selects will resize the columns, so try to minimize the change
           widthFixed : true,
           // initialize zebra striping and filter widgets
           widgets: ["filter"],
           ignoreCase: false,
           sortList: [[1,0]],
           sortAppend: [[1,0]],
           widgetOptions : {
             // if true, a filter will be added to the top of each table column;
             // disabled by using -> headers: { 1: { filter: false } } OR add class="filter-false"
             // if you set this to false, make sure you perform a search using the second method below
             filter_columnFilters : false,
             // extra css class name(s) applied to the table row containing the filters & the inputs within that row
             // this option can either be a string (class applied to all filters) or an array (class applied to indexed filter)
             filter_cssFilter : '', // or []
             // jQuery selector (or object) pointing to an input to be used to match the contents of any column
             // please refer to the filter-any-match demo for limitations - new in v2.15
             filter_external : '',
             // class added to filtered rows (rows that are not showing); needed by pager plugin
             filter_filteredRow   : 'filtered',
             // if true, filters are collapsed initially, but can be revealed by hovering over the grey bar immediately
             // below the header row. Additionally, tabbing through the document will open the filter row when an input gets focus
             filter_hideFilters : false,
             // Set this option to false to make the searches case sensitive
             filter_ignoreCase : true,
             // if true, search column content while the user types (with a delay)
             filter_liveSearch : true,
             // a header with a select dropdown & this class name will only show available (visible) options within that drop down.
             filter_onlyAvail : 'filter-onlyAvail',
             // jQuery selector string of an element used to reset the filters
             filter_reset : 'button.reset',
             // Use the $.tablesorter.storage utility to save the most recent filters (default setting is false)
             filter_saveFilters : true,
             // Delay in milliseconds before the filter widget starts searching; This option prevents searching for
             // every character while typing and should make searching large tables faster.
             filter_searchDelay : 300,
         }
       });
       obj.trigger("update");
   });
}

function myclick(i) {
    google.maps.event.trigger(gMarkers[i], "click");
}

function sIDHelper(i) {
    var obj;
    obj.results = results;
    obi.sID = i;
    return obj;
}

function sleep(callback) {
    setTimeout(function()
            { callback(); }
    , (Math.random() * 1000) + 200);
}

function getInfoWindowEvent(marker) {
    var data;
    $.ajax({
        url: buildYQL(marker.id, "gusd"),
        beforeSend: function( xhr ) {
            google.maps.event.trigger(map, 'loading');
            infowindow.close();
        }
    })
    .done(function(data) {
        data = makeJSON(data)[0];
        console.log(data);

        var string = "<div class='infowindow'><h2>" + marker.title + "</h2>"
            + data.address + ", " + data.city + "<br/>"
            + "(Cross street: " + data.cross2 + ")<br/><br/>";

        if(data.regular_gas && data.reg_price !== 0) { string += "Regular: $" + data.reg_price + " (" + data.reg_tme.toLocaleString() + ")<br />" }
        if(data.midgrade_gas && data.mid_price !== 0) { string +=  "Mid Tier: $" + data.mid_price + " (" + data.mid_tme.toLocaleString() + ")<br />" }
        if(data.premium_gas && data.prem_price !== 0) { string +=  "Premium: $" + data.prem_price + " (" + data.prem_tme.toLocaleString() + ")<br />" }
        if(data.diesel && data.diesel_price !== 0) { string +=  "Diesel: $" + data.diesel_price + " (" + data.diesel_tme.toLocaleString() + ")<br />" }
        string += "</div>";

        infowindow.setContent(string);
        infowindow.open(map, marker);
    })
    .always(function(){
            google.maps.event.trigger(map, 'loaded');
    });
}

function buildYQL(data, type)
{
    /*
        Fuel Type:
        A: regular
        B: midgrade
        C: premium
        D: diesel
    */
    var method = type;
    var data;
    var yql = "//query.yahooapis.com/v1/public/yql?format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&q=";
    // http://m.gasbuddy.com/touch/ajaxpro/GasBuddyTouch._Default,GasBuddyTouch.ashx
    var string = 'select * from xClient where url="http://www.gasbuddy.com/ajaxpro/GasBuddy_ASPX.GasTempMap,GasBuddy_ASPX.ashx" and method="post" and param=\'{"X-AjaxPro-Method": "' + method + '"}\' and content=';
    if(type == "gus")
    {
        var fuelType = data[0];
        var swPoint = data[1];
        var nePoint = data[2];
        var age = data[3];

        data = JSON.stringify({
                sFuelType: fuelType,
                dMinX: swPoint.lng(),
                dMaxX: nePoint.lng(), // long
                dMinY: swPoint.lat(),
                dMaxY: nePoint.lat(), // lat
                sTimeLimit: age
        });
    } else if(type == "gusd") {
        data = JSON.stringify({
                id: parseInt(data),
                iFeedID: 0
        });
    } else {
        throw "Invaid query type";
    }

    return yql + encodeURIComponent(string + "'" + data + "'");
}

function makeJSON(response)
{
    var data = response.query.results.resources.content;    // traverse YQL crud
    var JSONobj = {};
    var array = data
                .substring(64)                              // trim AJAXPro crud
                .match(/(?:\[)(.+?)]]/g);
                //.match(/[^,](.+?)(?=]])/g);                // break down data structure
    //console.log(array);
    for(var i = 0; i < array.length; i++) {                // ^^^^^^
        var temp = array[i]
                .replace(/\[/g, "{").replace(/\]/g, "}")    // replace [] with {}
                .match(/([^{}]+)?(",*)/g);             // break into distinct pseudo-objects
        array[i] = [{}];
        for(var j = 0; j < temp.length; j++)
        {
            array[i][j] = temp[j].split(/,(?![^(]*\))/g);
        }
    }
    //console.log(array);

    var structure = array[0];
    var info = array[1];
    for(var j = 0; j < info.length; j++)    // loop trough points
    {
        var temp = {};
        for(var k = 0; k < structure.length; k++)// structure
        {
            var current = structure[k];
            var type = cleanString(current[1]);
            var ident = cleanString(current[0]);

            switch(type) {
            case "System.Int32": case "System.Int16":
                temp[ident] = parseInt(info[j][k]);
                break;
            case "System.Decimal":
                temp[ident] = parseFloat(info[j][k]);
                break;
            case "System.Boolean":
                temp[ident] = parseBool(info[j][k]);
                break;
            case "System.String":
                temp[ident] = cleanString(info[j][k]);
                break;
            case "System.DateTime":
                temp[ident] = eval(info[j][k].replace("newDate", "new Date"));
                break;
            default:
                temp[ident] = info[j][k];
                break;
            }
        }
        JSONobj[j] = temp;
    }

    console.log(JSONobj);
    return JSONobj;
}

function parseBool(string)
{
    //try {
    //    return !!JSON.parse(string.toLowerCase());
    //} catch (e) { }
    return !!(string.toLowerCase() == "true" ? 1 : 0);
}

function cleanString(string)
{
    //return string.substring(1, string.length-1);\
    return string.replace(/"/g, "");
}

google.maps.event.addDomListener(window, 'load', initialize);
