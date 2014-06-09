var s,
Gasloc = (function(document, window){
    "use strict";
    var app = {
        settings: {
            mapCanvas: document.getElementById("map-canvas"),
            mapOptions: {
                zoom: 14,
                center: new google.maps.LatLng(37.774929, -122.419416)
            },
            dist: 100,
            radius: 5000,
            loading: $("#loading"),
            routeButton: $("#route"),
            viaButton: $("#via-button"),
            startLoc: $("#start-loc"),
            endLoc: $("#end-loc"),
            gasTier: $("#gas-tier"),
            viaPointsElement: $(".via-point", "#sidebar"),
            infoBox: $("#info"),
            distanceInfo: $("#distance"),
            directionsRenderer: new google.maps.DirectionsRenderer(),
            infoWindow: new google.maps.InfoWindow(),
            directionsService: new google.maps.DirectionsService(),
            geocoder: new google.maps.Geocoder(),
            map: null,
            gMarkers: [],
            overlays: [],
            viaPoints: []
        },

        init: function() {
            s = this.settings;
            s.map = new google.maps.Map(s.mapCanvas, s.mapOptions);
            console.log(s);

            this.addListeners();
            s.directionsRenderer.setMap(s.map);
            this.calcRoute();

            $('.handle').drags();
        },

        addListeners: function() {
            google.maps.event.addListener(s.map, 'loading', function(){
                console.log("loading");
                s.loading.show();
            });
            google.maps.event.addListener(s.map, 'loaded', function(){
                console.log("done");
                s.loading.hide();
            });
            s.routeButton.click(function(){
                app.calcRoute();
            });
            s.viaButton.click(function(){
                s.viaButton.before('<input type="text" class="via-point pure-input-1" placeholder="Via">');
            });
        },

        clearData: function() {
            try{
                while(s.overlays[0]){
                    s.overlays.pop().setMap(null);
                }
                s.gMarkers = [];
                s.viaPoints = [];
            } catch(e) {}

            s.infoBox.html("");
            s.distanceInfo.html("");
        },

        googleRoute: function(request, callback) {
            s.directionsService.route(request, function(result, status) {
                if (status == google.maps.DirectionsStatus.OK) {
                    console.log(result);
                    s.directionsRenderer.setDirections(result);

                    callback(result);
                }
            });
        },

        calcRoute: function() {
            app.mapLoading();
            app.clearData();

            s.viaPointsElement.each(function(i, val){
                var p = val.value;
                if(p !== "")
                    s.viaPoints.push({location: p, stopover: false});
            });

            var request = {
                origin: s.startLoc.val(),
                destination: s.endLoc.val(),
                travelMode: google.maps.TravelMode.DRIVING,
                waypoints: s.viaPoints
            };

            app.googleRoute(request, function(result) {
                var route = result.routes[0];
                var pathPoints = route.overview_path;

                var pt = app.whichPoint(pathPoints, s.dist);

                for (var i = 0; i < pathPoints.length; i+=pt)
                {
                    var pPoint = pathPoints[i];
                    //(new google.maps.Marker({position: pathPoints[i]})).setMap(map);
                    // anonymous wrapper to preserve loop counter in async function
                    (function(id) {
                        var circle = new google.maps.Circle({
                                    center: pPoint,
                                    radius: s.radius,
                                    map: s.map
                        });
                        s.overlays.push(circle);

                        app.geocode(id, circle, pathPoints.length-pt);
                    })(i);
                }

                app.calcDistance(route);
            });
        },

        calcDistance: function(route) {
            var pathPoints = route.overview_path;
            var pt = app.whichPoint(pathPoints, s.dist);
            var len = pathPoints.length;
            var i = 1;
            var k = pt;

            while (k < len+pt)
            {
                var dist;
                if(k <= len) {
                    dist = google.maps.geometry.spherical.computeLength(pathPoints.slice(k-pt, k));
                }
                else {
                    dist = google.maps.geometry.spherical.computeLength(pathPoints.slice(k-pt, len));
                }
                s.distanceInfo.append("Stretch " + i + ": " + Math.round(dist*0.000621371192) + " miles<br />");

                k+= pt;
                i++;
            }

            s.distanceInfo.append("Total: " + route.legs[0].distance.text + "<br />");
        },

        geocode: function(id, circle, max) {
            var gastier = s.gasTier.val();
            var pPoint = circle.center;
            var circleBounds = circle.getBounds();
            var swPoint = circleBounds.getSouthWest(); // dMin
            var nePoint = circleBounds.getNorthEast(); // dMax

            s.geocoder.geocode({'latLng': pPoint, 'bounds': circleBounds }, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                    s.infoBox.append('<div class="area"><h3 class="area-title">'
                         + results[0].formatted_address
                         + '</h3><table class="pure-table" id="'+ id + '"><thead><tr><td>#</td><td>Price</td><td>Station</td></tr></thead><tbody></tbody></table></div>');

                    $.ajax({
                        url: app.buildYQL([gastier, swPoint, nePoint, "48"], "gus"),
                        beforeSend: function(xhr) {
                            app.mapLoading();
                        }
                    }).done(function(data) {
                        data = app.makeJSON(data);
                        $.each(data, function(j, val) {
                            var marker = new google.maps.Marker({
                                position: new google.maps.LatLng(val.lat, val.lng),
                                title: val.station_nm,
                                map: s.map,
                                id: val.id
                            });
                            marker.price = val.price;
                            google.maps.event.addListener(marker, 'click', function(){
                                app.getInfoWindowEvent(marker);
                            });
                            s.gMarkers.push(marker);
                            s.overlays.push(marker);
                            var markerID = (s.gMarkers.length-1);
                            var markerList = $("#" + id + " tbody", "#info");
                            markerList.append('<tr id="marker-' + (markerID) + '"><td>' + (val.id) + '</td><td>'
                                                + val.price + '</td><td>'
                                                + val.station_nm + '</td></tr>'
                            );
                            $("#marker-"+markerID, markerList).click( function() { app.clickHandler(markerID);});
                        });

                        if(id >= max)
                        {
                            app.mapLoaded();
                        }

                        app.sortTables();
                    });
            } else if (status == google.maps.GeocoderStatus.OVER_QUERY_LIMIT ) {
                //console.log(id + " " + status);
                app.sleep(function() {app.geocode(id, circle, max)});

            } else {
                console.log(id + " " + status);
                app.mapLoaded();
                alert("Geocoder failed due to: " + status);
            }
            });
        },

        buildYQL: function(data, type) {
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
        },

        makeJSON: function(response) {
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
            if(info === undefined)
            {
                console.log("No stations found");
            }
            else {
                for(var j = 0; j < info.length; j++)    // loop trough points
                {
                    var temp = {};
                    for(var k = 0; k < structure.length; k++)// structure
                    {
                        var current = structure[k];
                        var type = app.cleanString(current[1]);
                        var ident = app.cleanString(current[0]);

                        switch(type) {
                        case "System.Int32": case "System.Int16":
                            temp[ident] = parseInt(info[j][k]);
                            break;
                        case "System.Decimal":
                            temp[ident] = parseFloat(info[j][k]);
                            break;
                        case "System.Boolean":
                            temp[ident] = app.parseBool(info[j][k]);
                            break;
                        case "System.String":
                            temp[ident] = app.cleanString(info[j][k]);
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
            }

            console.log(JSONobj);
            return JSONobj;
        },

        parseBool: function(string) {
            //try {
            //    return !!JSON.parse(string.toLowerCase());
            //} catch (e) { }
            return !!(string.toLowerCase() == "true" ? 1 : 0);
        },

        cleanString: function(string) {
            //return string.substring(1, string.length-1);\
            return string.replace(/"/g, "");
        },

        whichPoint: function(path, distance) {
            distance *= 1609.34; // to meters
            var i = 0;
            while(google.maps.geometry.spherical.computeLength(path.slice(0, i)) < distance)
            {
                i+= 1;
            }

            return i;
        },

        sleep: function(callback) {
            setTimeout(function()
                    { callback(); }
            , (Math.random() * 1000) + 200);
        },

        clickHandler: function(id) {
            google.maps.event.trigger(s.gMarkers[id], "click");
        },

        getInfoWindowEvent: function(marker) {
            var data;
            $.ajax({
                url: app.buildYQL(marker.id, "gusd"),
                beforeSend: function(xhr) {
                    app.mapLoading();
                    s.infoWindow.close();
                }
            })
            .done(function(data) {
                data = app.makeJSON(data)[0];
                console.log(data);

                var string = "<div class='infowindow'><h2>" + marker.title + "</h2>"
                    + data.address + ", " + data.city + "<br/>"
                    + "(Cross street: " + data.cross2 + ")<br/><br/>";

                if(data.regular_gas && data.reg_price !== 0) { string += "Regular: $" + data.reg_price + " (" + data.reg_tme.toLocaleString() + ")<br />" }
                if(data.midgrade_gas && data.mid_price !== 0) { string +=  "Mid Tier: $" + data.mid_price + " (" + data.mid_tme.toLocaleString() + ")<br />" }
                if(data.premium_gas && data.prem_price !== 0) { string +=  "Premium: $" + data.prem_price + " (" + data.prem_tme.toLocaleString() + ")<br />" }
                if(data.diesel && data.diesel_price !== 0) { string +=  "Diesel: $" + data.diesel_price + " (" + data.diesel_tme.toLocaleString() + ")<br />" }
                string += "</div>";

                s.infoWindow.setContent(string);
                s.infoWindow.open(s.map, marker);
            })
            .always(function(){
                app.mapLoaded();
            });
        },

        mapLoading: function() {
            google.maps.event.trigger(s.map, 'loading');
        },

        mapLoaded: function()
        {
            google.maps.event.trigger(s.map, 'loaded');
        },

        sortTables: function() {
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
    }
    return app;
})(document, window);

google.maps.event.addDomListener(window, 'load', Gasloc.init());
