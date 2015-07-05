// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var map;
var view;
var osmLayer;
var vectorSource;
var zoom = 15;
var maxInf = 15;
var numlist = ['[1]','[2]','[3]','[4]','[5]','[6]','[7]','[8]','[9]','[10]',
               '[11]','[12]','[13]','[14]','[15]'];

var dbpedia_err = '<br/>DBpediaとの通信に失敗しました。';
var footer_dbpedia = 'DBpedia Japanese by ' +
      '<a href="http://ja.dbpedia.org/" target="_blank">DBpedia Community</a> ' +
      'is licensed under a ' +
      '<a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank">' +
      'Creative Commons 表示 - 継承 3.0 非移植 License</a><br/><br/>';
var no_inf = '<br/>この地図の範囲の情報はありません。';
var origin = [139.741357, 35.658099]; // 日本経緯度原点
var server = 'http://ja.dbpedia.org/sparql';
var lang_filter = 'FILTER (LANG(?name)=\'ja\' && LANG(?abstract)=\'ja\')';
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
    controls: new ol.control.defaults({rotate:false}).extend([
      new ol.control.ScaleLine()
    ]),
    interactions: ol.interaction.defaults({pinchRotate:false})
  });
  osmLayer = new ol.layer.Tile({
    source: new ol.source.OSM({
      attributions: [
        new ol.Attribution({
          html: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">'
        }),
        new ol.Attribution({
          html: 'Map data &copy; <a href="http://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, <a href="http://www.opendatacommons.org/licenses/odbl" target="_blank">ODbL</a>'
        })
      ],
      url: 'http://otile{1-4}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.jpg'
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
    'SELECT distinct ?name, ?abstract, ?lat, ?lon, ?url, ?link ' + 
    'WHERE { ' +
    '?s rdfs:label ?name ; ' +
    'dbpedia-owl:abstract ?abstract ; ' +
    'foaf:isPrimaryTopicOf ?url ; ' +
    'geo:lat ?lat ; ' +
    'geo:long ?lon . ' +
    'OPTIONAL { ?s foaf:homepage ?link } ' +
    'FILTER ( ?lon > "' + rect[0] + '"^^xsd:float && ?lon < "' + rect[2] + '"^^xsd:float && ' +
    '?lat > "' + rect[1] + '"^^xsd:float && ?lat < "' + rect[3] + '"^^xsd:float ) ' +
    lang_filter +
    '} ' +
    'LIMIT ' + maxInf;
  var query = {
    query : sparql,
    format: 'application/sparql-results+json'
  };

  req = $.getJSON(server, query, function(data){

    req = null;
    vectorSource.clear();
    var list = data.results.bindings;

    bodydiv.innerHTML = '';             // clear
    for(i=0 ; i<list.length ; i++) {
      var topic = '<strong>' + numlist[i] + ' ' + 
        '<a href="' + list[i].url.value + '" target="_blank">' +
        list[i].name.value + '</a></strong><p></p>';
      bodydiv.innerHTML += topic;

      bodydiv.innerHTML += '<p>' + list[i].abstract.value + '</p>';

      if(list[i].link) {
        bodydiv.innerHTML += '<p>' +
          '<a href="' + list[i].link.value + '" target="_blank">' + 
        list[i].link.value + '</a></p>';
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
    if(list.length > 0) {
      bodydiv.innerHTML += '<hr/>' + footer_dbpedia;
    } else {
      bodydiv.innerHTML = no_inf;
    }

  })
  .error(function() {
    req = null;
    vectorSource.clear();
    bodydiv.innerHTML = dbpedia_err;
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
