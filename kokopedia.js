// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var map;
var view;
var osmLayer;
var vectorSource;
var zoom = 15;
var maxInf = 20;
var numlist = ['[1]','[2]','[3]','[4]','[5]','[6]','[7]','[8]','[9]','[10]',
               '[11]','[12]','[13]','[14]','[15]','[16]','[17]','[18]','[19]','[20]'];

var dbpedia_err = '<br/>Wikidataとの通信に失敗しました。';
var no_inf = '<br/>この地図の範囲の情報はありません。';
var origin = [139.741357, 35.658099]; // 日本経緯度原点
var server = 'https://query.wikidata.org/sparql';
var req;

$(function(){

  $.ajaxSetup({
    timeout: 6000
  });

  view = new ol.View( {
    minZoom: 11
  } );
  map = new ol.Map({
    target: 'map',
    view: view,
    controls: new ol.control.defaults({rotate:false, attributionOptions:({collapsible: false})}).extend([
      new ol.control.ScaleLine()
    ]),
    interactions: ol.interaction.defaults({pinchRotate:false})
  });
  osmLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      attributions: [
        new ol.Attribution({
          html: '<a href="http://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html" target="_blank">国土地理院</a>'
        })
      ],
      projection: 'EPSG:3857',
      url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
    })
  });
  map.addLayer(osmLayer);
  map.on('moveend', function() {
    showContent();
  });

  vectorSource = new ol.source.Vector();
  var markerLayer = new ol.layer.Vector( {
    source: vectorSource
  });
  map.addLayer(markerLayer);

  view.setCenter(ol.proj.transform(origin, 'EPSG:4326', 'EPSG:3857'));
  view.setZoom(zoom);

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      view.setCenter(
        ol.proj.transform([pos.coords.longitude, pos.coords.latitude],
          'EPSG:4326', 'EPSG:3857'
        )
      );
      view.setZoom(zoom);
    },
    function(err) {
      // do nothing
    },
    {maximumAge: 5000, timeout: 3000, enableHighAccuracy: true}
  );
});

function showContent() {

  if(req) {
    req.abort();
  }
  var zoom = view.getZoom();
  var rect = getRect();
  var sparql = 
    'SELECT DISTINCT ?sLabel ?lat ?lon ?dsc ?wp WHERE { ' +
    '  ?wp schema:about ?s . ' +
    '  ?wp schema:inLanguage "ja" . ' +
    '  FILTER (SUBSTR(str(?wp), 1, 25) = "https://ja.wikipedia.org/") ' +
    '  OPTIONAL { ' +
    '    ?s schema:description ?dsc . ' +
    '    FILTER (lang(?dsc) = "ja") ' +
    '  } ' +
    '  SERVICE wikibase:box { ' +
    '    ?s wdt:P625 ?location . ' +
    '    bd:serviceParam wikibase:cornerSouthWest "Point(' +
           rect[0] + ' ' +  rect[1] +
    '    )"^^geo:wktLiteral . ' +
    '    bd:serviceParam wikibase:cornerNorthEast "Point(' +
           rect[2] + ' ' + rect[3] +
    '    )"^^geo:wktLiteral . ' +
    '  } ' +
    '  BIND(geof:latitude(?location) as ?lat) ' +
    '  BIND(geof:longitude(?location) as ?lon) ' +
    '  SERVICE wikibase:label { ' +
    '    bd:serviceParam wikibase:language "ja, en" . ' +
    '  } ' +
    '} ' +
    'LIMIT ' + maxInf;
  var query = {
    query : sparql,
    format: 'json'
  };

  req = $.getJSON(server, query, function(data){

    req = null;
    vectorSource.clear();
    var list = data.results.bindings;

    bodydiv.innerHTML = '';             // clear
    for(i=0 ; i<list.length ; i++) {
      var topic = '<strong>' + numlist[i] + ' ' + 
        '<a href="' + list[i].wp.value + '" target="_blank">' +
        list[i].sLabel.value + '</a></strong><p></p>';
      bodydiv.innerHTML += topic;

      if(list[i].dsc) {
        bodydiv.innerHTML += '<p>' + list[i].dsc.value + '</p>';
      }

      var iconFeature = new ol.Feature({
      geometry: new ol.geom.Point(
        ol.proj.transform(
          [parseFloat(list[i].lon.value), parseFloat(list[i].lat.value)],
          'EPSG:4326', 'EPSG:3857'))
      });

      var iconStyle = new ol.style.Style({
        text: new ol.style.Text({
          fill: new ol.style.Fill({
            color: '#FFF',
            opacity: 0.5}),
          stroke: new ol.style.Stroke({
            color: '#00F',
            opacity: 0.5,
            width: 5}),
          text: i+1,
          opacity: 0.5,
          font: '20px Verdana'
        }),
        opacity: 0.5
      });

      iconFeature.setStyle(iconStyle);
      vectorSource.addFeature(iconFeature);

    }

  })
  .error(function(jqXHR, textStatus, errorThrown) {
    req = null;
    vectorSource.clear();
//    bodydiv.innerHTML = "エラー：" + textStatus + "<br/>テキスト：" + jqXHR.responseText;
    bodydiv.innerHTML = "";
  });

  $('#contentdiv').scrollTop(0);

}

function getRect() {
  var lon1 = ol.proj.transform(map.getCoordinateFromPixel([0, 0]),
          'EPSG:3857', 'EPSG:4326')[0];
  var lat1 = ol.proj.transform(map.getCoordinateFromPixel([0, 0]),
          'EPSG:3857', 'EPSG:4326')[1];
  var lon2 = ol.proj.transform(map.getCoordinateFromPixel(map.getSize()),
          'EPSG:3857', 'EPSG:4326')[0];
  var lat2 = ol.proj.transform(map.getCoordinateFromPixel(map.getSize()),
          'EPSG:3857', 'EPSG:4326')[1];
  var minLon = lon1 < lon2 ? lon1 : lon2;
  var maxLon = lon1 > lon2 ? lon1 : lon2;
  var minLat = lat1 < lat2 ? lat1 : lat2;
  var maxLat = lat1 > lat2 ? lat1 : lat2;
  return new Array(minLon, minLat, maxLon, maxLat);
}
