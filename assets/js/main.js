/* FilePath */
var filepath = "hivaids-deaths-and-averted_2022.csv";
/*
Code...国コード
Deaths...数値

feature.properties.ISO_A3;
*/

/* --------------------
　地図設定パラメータ
-------------------- */

/* MapObject */
var mapObject;
var minZoomLevel = 2;
var maxZoomLevel = 5;

/* Map Tile */
// var mapDomain = "http://127.0.0.1:5500";
var mapDomain = "https://n1n9-jp.github.io";
var mapPath = "/jcie/{z}/{x}/{y}.pbf";
var maptileURL = mapDomain + mapPath;

var POI = [
  {
    city: "Tokyo Station",
    longitude: 139.767125,
    latitude: 35.681236,
    zoom: 3,
    pitch: 60,
    bearing: 0,
  }
];



/* ------------------------------
　データ保存
------------------------------ */

/* Data Object */
var dataObjTheme;           // Theme Data
var dataObjThemeFiltered;   // Theme Data Filtered

var countryArray = []
var countryIndex = 217;

const themeDataMapping = {};



/* --------------------
　スケール：データ
-------------------- */

/* Color Data Scale */
// 0 の場合は、固定値の最小値と最大値
// 1 の場合は、テーマデータ内の実際の最小値と最大値

var _obj1 = {minData: 0.0, maxData: 300.0};
var minDataFixed = 0.0;
var maxDataFixed = 10.0;
var _obj2 = {minData: minDataFixed, maxData: maxDataFixed};

var colorDataScaleArray = [];
colorDataScaleArray.push(_obj1);
colorDataScaleArray.push(_obj2);



/* Depth Data Scale */
// 0 の場合は、固定値の最小値と最大値
// 1 の場合は、テーマデータ内の実際の最小値と最大値

var _depthobj1 = {minData: 0.0, maxData: 300.0};
var minDepthDataFixed = 0.0;
var maxDepthDataFixed = 10.0;
var _depthobj2 = {minData: minDepthDataFixed, maxData: maxDepthDataFixed};

var depthDataScaleArray = [];
depthDataScaleArray.push(_depthobj1);
depthDataScaleArray.push(_depthobj2);



/* --------------------
　スケール：表現
-------------------- */

/* Color */
var minColor = "#FFFFFF";
var maxColor = "#000000";
var nullColor = "#c3c7c9";

/* Height */
var minHeight = 0;
var maxHeight = 50000;



/* ------------------------------
　データの変更
------------------------------ */

// 変数名リスト
var varList = [];
// var varListRemove = ['Year', 'Code', 'Entity'];  // 不要な列を削除
var valueNameArray = ['Deaths'];  // Deathsのみを使用

// 色と高さへ割り当てる変数管理
var colorIndex = 0;  // Deathsを色に使用
var depthIndex = 0;  // Deathsを高さにも使用

// 詳細データを取り出す際のURL
var fullAddress = "";



/* ------------------------------
　可視化の変更
------------------------------ */

/* Swiper UI Visualization Scale */
var scaleArray = ["Relative","Absolute"]
var scaleIndex = 1;

/* Swiper UI Dimension Change */
var dimensionArray = ["3D","2D"]
var dimensionArrayIndex = 0;

/* Flag */
// var fl_firsttime = true;
var fl_map = "";
// 新規にマップを描画する必要がある場合は "drawMap"
// 既存のマップを更新する場合は "updateMap"




/* ------------------------------
　ユーティリティ関数
------------------------------ */
// 数字の加工
function formatNumber(num) {
    return num.toString().padStart(2, '0');
}
var formatTwoDecimal = d3.format(".2f");

// デバウンス関数
function debounce(func, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    }
}

  

/* ------------------------------
　関数
------------------------------ */

var initBaseMap = function() {
    console.log("initBaseMap");

    mapObject = new maplibregl.Map({
        "container": "mapContainer",
        "center": [POI[0]["longitude"], POI[0]["latitude"]],
        "zoom": POI[0]["zoom"],
        "minZoom": minZoomLevel,
        "maxZoom": maxZoomLevel,
        "pitch": POI[0]["pitch"], 
        "minPitch": 0,
        "maxPitch": 85,
        "bearing": POI[0]["bearing"], 
        "hash": true,
        "interactive": true,
        transformRequest: (url, resourceType) => {
            if (resourceType === 'Tile') {
                return {
                    url: url,
                    mode: 'no-cors',
                    credentials: 'omit'
                };
            }
        },
        "style": {
            version: 8,
            sources: {
              "vector-tiles": {
                type: "vector",
                tiles: [maptileURL],
                minzoom: minZoomLevel,
                maxzoom: maxZoomLevel
              }
            },
            layers: [
              {
                id: "naro_prob",
                type: "fill-extrusion",
                source: "vector-tiles",
                "source-layer": "arg",
                paint: {
                    "fill-extrusion-color": nullColor,
                    "fill-extrusion-opacity": 0.6,
                    // "fill-extrusion-outline-color": "#ffffff"
                }
              }
            ]
        }
    });

    // 初期ロード時のみ実行されるように変更
    let initialLoadComplete = false;
    mapObject.on('sourcedata', function(e) {
        if (!initialLoadComplete && e.sourceId === 'vector-tiles' && e.isSourceLoaded) {
            initialLoadComplete = true;
            PubSub.publish('load:filelist');
        }
    });

    mapObject.on('pitchend', () => {
        if (dimensionArrayIndex === 1 && mapObject.getPitch() !== 0) {
            mapObject.setPitch(0);
        }
    });
}



var loadFileList = function() {
    console.log("loadFileList");

    return Promise.all([
        // d3.csv("data/data_lib/prefecture.csv")
        d3.csv("data/data_lib/countrylist.csv")
    ]).then(function (_data) {

        countryArray = _.cloneDeep(_data[0]);
        countryArray.forEach(function(_row) {
            // _row["id"]  = parseInt(_row["id"]);
            _row["lat"] = parseFloat(_row["lat"]);
            _row["lon"] = parseFloat(_row["lon"]);
        });

        console.log("countryArray", countryArray);
        return {countryArray: countryArray };
    })
    .then(function () {
        PubSub.publish('init:mapui');
    })
    .catch(function(err) {
        console.error("loadFileList でエラーが発生しました:", err);
    });
}

  

var initMapUI = function() {
    console.log("initMapUI");

    if (!mapObject._navControlAdded) {
        var navControl = new maplibregl.NavigationControl();
        mapObject.addControl(navControl, 'top-right');
        mapObject._navControlAdded = true;
    }

    PubSub.publish('load:themedata');
}




var loadThemeData = function() {
    console.log("loadThemeData");

    // load: theme data
    return Promise.all([
        d3.csv("data/data_index/" + filepath)
    ]).then(function (_data) {
  
        dataObjTheme = _.cloneDeep(_data[0]);

        varList = _data[0].columns;
        valueNameArray = ['Deaths'];  // Deathsのみを使用
        console.log("valueNameArray", valueNameArray);

        // Deathsの値を数値に変換
        for (var i=0; i<dataObjTheme.length; i++){
            var _row = dataObjTheme[i];
            _row["Deaths"] = parseFloat(_row["Deaths"]) || 0;  // 数値に変換できない場合は0を設定
        }          

        _data = null;

        console.log("loadThemeData 完了:", valueNameArray);
        return;
    })
    .then(function() {
        PubSub.publish('init:vizslider');
    }).catch(function(err) {
        console.error("loadThemeData でエラーが発生しました:", err);
    });
}



var initVizSlider = function() {
    console.log("initVizSlider");

    /* Prefecture Slider */
    d3.select("#swiperPref").selectAll("div").remove();
  
    d3.select("#swiperPref")
      .selectAll("div")
      .data(countryArray)
      .enter()
      .append("div")
      .attr("class", "swiper-slide")
      .text(function(d) { 
        return d["country"];
    });
  
    if (swiperPref && typeof swiperPref.destroy === "function") {
        swiperPref.destroy(true, true);
    }

    swiperPref = new Swiper('#swiper-container-pref', {
      slidesPerView: 7,
      spaceBetween: 1,
      centeredSlides: true,
      initialSlide: countryIndex,
      slideToClickedSlide: true,
      navigation: {
        nextEl: '#swiper-button-next-pref',
        prevEl: '#swiper-button-prev-pref',
      },
      on: {
        slideChange: debounce(function(e) {
            countryIndex = e.activeIndex;
            console.log("countryArray[countryIndex]", countryArray[countryIndex]);

            var _lon = countryArray[countryIndex]["lon"];
            var _lat = countryArray[countryIndex]["lat"]

            mapObject.flyTo({
                center: [_lon, _lat],
                speed: 0.4,
                curve: 2,
                essential: true
            });

            // moveendイベントのリスナーを一度だけ設定
            const onMoveEnd = function() {
                fl_map = "drawMap";
                PubSub.publish('join:data');
                mapObject.off('moveend', onMoveEnd);
            };
            
            mapObject.on('moveend', onMoveEnd);
        }, 300)
      }
    });

    PubSub.publish('filter:bydata');
};



var filterByYear = function() {
    console.log("filterByYear");
    
    // 以前のデータをクリア
    for (let key in themeDataMapping) {
        delete themeDataMapping[key];
    }
    dataObjThemeFiltered = [];

    // フィルタリングなしでデータをそのまま使用
    dataObjThemeFiltered = dataObjTheme;
    
    // デバッグ用：データの内容を詳しく表示
    console.log("テーマデータの全カラム:", dataObjThemeFiltered[0] ? Object.keys(dataObjThemeFiltered[0]) : "データなし");
    console.log("テーマデータの最初の3件:", dataObjThemeFiltered.slice(0, 3));
    console.log("Code列の一意な値（ソート済み）:", [...new Set(dataObjThemeFiltered.map(d => d.Code))].sort());

    //扱いやすいよう加工する
    dataObjThemeFiltered.forEach(record => {
        themeDataMapping[record.Code] = record;
    });

    //内容の確認
    console.log("themeDataMappingのキー一覧（ソート済み）:", Object.keys(themeDataMapping).sort());

    PubSub.publish('join:data');
}



var joinData = function() {
    console.log("joinData");
    
    return new Promise((resolve, reject) => {
      try {
        // 現在の描画済みフィーチャーを取得
        const features = mapObject.queryRenderedFeatures({ layers: ["naro_prob"] });
  
        // 結合失敗のISO_A3を収集する配列を初期化
        const failedISOCodes = new Set();
  
        // デバッグ用：地図データの内容を詳しく表示
        console.log("地図データの最初のフィーチャーの全プロパティ:", features[0] ? Object.keys(features[0].properties) : "データなし");
        console.log("地図データの国名一覧（ソート済み）:", features.map(f => f.properties.NAME_LONG).sort());
  
        // 以前のデータの初期状態を設定
        mapObject.setPaintProperty("naro_prob", 'fill-extrusion-color', nullColor);
        mapObject.setPaintProperty("naro_prob", 'fill-extrusion-height', 0);
  
        features.forEach(feature => {
          if (feature && feature.id !== undefined) {
            const _tileKey = feature.properties.ISO_A3;
            console.log("地図データのキー(ISO_A3):", _tileKey);
            
            let themeRecord = themeDataMapping[_tileKey];
            console.log("テーマデータの結合結果:", {
              ISO_A3: _tileKey,
              対応するテーマデータ: themeRecord,
              結合成功: themeRecord ? "成功" : "失敗"
            });
            
            // 結合の成功/失敗を集計
            if (!window.joinStats) {
              window.joinStats = { 成功: 0, 失敗: 0 };
            }
            if (themeRecord) {
              window.joinStats.成功++;
            } else {
              window.joinStats.失敗++;
              failedISOCodes.add(_tileKey);
            }

            let colorVal = null;
            let depthVal = null;
            if (themeRecord) {
              colorVal = parseFloat(themeRecord[valueNameArray[colorIndex]]);
              depthVal = parseFloat(themeRecord[valueNameArray[depthIndex]]);
              console.log("結合後の値:", {
                colorIndex: valueNameArray[colorIndex],
                colorValue: colorVal,
                depthIndex: valueNameArray[depthIndex],
                depthValue: depthVal
              });
              if (isNaN(colorVal)) { colorVal = null; }
              if (isNaN(depthVal)) { depthVal = null; }
            }
            // すべてのフィーチャーに対して state を設定する
            mapObject.setFeatureState({
              source: 'vector-tiles',
              id: feature.id,
              sourceLayer: 'arg'
            }, {
              [ valueNameArray[colorIndex] ]: colorVal,
              [ valueNameArray[depthIndex] ]: depthVal
            });
          }
        });

        // 結合の集計結果を出力
        console.log("テーマデータの結合結果集計:", window.joinStats);
        console.log("結合に失敗した国のISO_A3コード一覧:", Array.from(failedISOCodes).sort());

        fl_map = "drawMap";
        resolve();
      } catch (e) {
        reject(e);
      }
    })
    .then(() => {
        PubSub.publish('draw:map');
    }).catch(error => {
        console.error("joinData でエラーが発生しました", error);
    });
};
  


var drawMap = function() {
    console.log("drawMap");

    if (!valueNameArray[colorIndex] || !valueNameArray[depthIndex]) {
        console.warn("valueNameArray の値が未定義です。", valueNameArray, colorIndex, depthIndex);
        return;
    }


    /* draw: basemap */



    /* --------------------
        メイン用
    -------------------- */

    var _colorMin = parseFloat(colorDataScaleArray[scaleIndex].minData);
    var _colorMax = parseFloat(colorDataScaleArray[scaleIndex].maxData);
    var _depthMin = parseFloat(depthDataScaleArray[scaleIndex].minData);
    var _depthMax = parseFloat(depthDataScaleArray[scaleIndex].maxData);

    mapObject.setPaintProperty(
        "naro_prob",
        'fill-extrusion-color',
        ['case',
        ['==', ['coalesce', ['feature-state', valueNameArray[colorIndex]], null], null],
        nullColor,
            ['interpolate', ['linear'],
            ['coalesce', ['feature-state', valueNameArray[colorIndex]], 0],
            _colorMin, minColor,
            _colorMax, maxColor
            ]
        ]
    );

    mapObject.setPaintProperty(
        "naro_prob",
        'fill-extrusion-height',
        ['case',
            ['==', ['coalesce', ['feature-state', valueNameArray[depthIndex]], null], null],
            0,
            ['interpolate', ['linear'],
            ['coalesce', ['feature-state', valueNameArray[depthIndex]], 0],
            _depthMin, minHeight,
            _depthMax, maxHeight
            ]
        ]
    );

}



var updateMap = function() {
    console.log("updateMap");

    var _colorMin = parseFloat(colorDataScaleArray[scaleIndex].minData);
    var _colorMax = parseFloat(colorDataScaleArray[scaleIndex].maxData);
    var _depthMin = parseFloat(depthDataScaleArray[scaleIndex].minData);
    var _depthMax = parseFloat(depthDataScaleArray[scaleIndex].maxData);


    mapObject.setPaintProperty(
        "naro_prob",
        'fill-extrusion-color',
        ['case',
        ['==', ['coalesce', ['feature-state', valueNameArray[colorIndex]], null], null],
          nullColor,
          ['interpolate', ['linear'],
            ['coalesce', ['feature-state', valueNameArray[colorIndex]], 0],
            _colorMin, minColor,
            _colorMax, maxColor
          ]
        ]
    );

    mapObject.setPaintProperty(
        "naro_prob",
        'fill-extrusion-height',
        ['case',
        ['==', ['coalesce', ['feature-state', valueNameArray[depthIndex]], null], null],
          0,
          ['interpolate', ['linear'],
            ['coalesce', ['feature-state', valueNameArray[depthIndex]], 0],
            _depthMin, minHeight,
            _depthMax, maxHeight
          ]
        ]
    );

    // PubSub.publish('update:legend');
}





var updateLegend = function() {

};






var changeColor = function() {
    console.log("changeColor");

    if (scaleIndex == 0) { // 0 の場合は、固定値の最小値と最大値

        colorDataScaleArray[scaleIndex].minData = minDataFixed;
        colorDataScaleArray[scaleIndex].maxData = maxDataFixed;

    } else if (scaleIndex == 1) { // 1 の場合は、テーマデータ内の実際の最小値と最大値

            var _ddd = valueNameArray[colorIndex];

            var _columnValues = dataObjThemeFiltered.map(function(d) {
                return +d[_ddd];
            });

            colorDataScaleArray[scaleIndex].minData = d3.min(_columnValues);
            colorDataScaleArray[scaleIndex].maxData = d3.max(_columnValues);
    }

    if (fl_map == "drawMap") {
        PubSub.publish('draw:map');
    } else if (fl_map == "updateMap") {
        PubSub.publish('update:map');
    }
}



var changeDepth = function() {
    console.log("changeDepth");

    if (scaleIndex == 0) { // 0 の場合は、固定値の最小値と最大値

        depthDataScaleArray[scaleIndex].minData = minDataFixed;
        depthDataScaleArray[scaleIndex].maxData = maxDataFixed;

    } else if (scaleIndex == 1) { // 1 の場合は、テーマデータ内の実際の最小値と最大値

            var _ddd = valueNameArray[depthIndex];

            var _columnValues = dataObjThemeFiltered.map(function(d) {
                return +d[_ddd];
            });

            depthDataScaleArray[scaleIndex].minData = d3.min(_columnValues);
            depthDataScaleArray[scaleIndex].maxData = d3.max(_columnValues);
    }

    if (fl_map == "drawMap") {
        PubSub.publish('draw:map');
    } else if (fl_map == "updateMap") {
        PubSub.publish('update:map');
    }
}



PubSub.subscribe('init:basemap', initBaseMap);
PubSub.subscribe('load:filelist', loadFileList);
PubSub.subscribe('init:mapui', initMapUI);
PubSub.subscribe('load:themedata', loadThemeData);
PubSub.subscribe('init:vizslider', initVizSlider);

PubSub.subscribe('filter:bydata', filterByYear);
PubSub.subscribe('join:data', joinData);

PubSub.subscribe('draw:map', drawMap);
PubSub.subscribe('update:map', updateMap);
PubSub.subscribe('change:color', changeColor);
PubSub.subscribe('change:depth', changeDepth);



PubSub.publish('init:basemap');