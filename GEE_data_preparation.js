// Define the Sikkim region
var sikkim = ee.FeatureCollection("FAO/GAUL/2015/level1")
                .filter(ee.Filter.eq('ADM1_NAME', 'Sikkim'));

// Center the map on Sikkim
Map.centerObject(sikkim, 9);

// Function for cloud masking in Sentinel-2
function maskClouds(image) {
  var cloudProb = image.select('MSK_CLDPRB');  // Cloud probability band
  var isNotCloud = cloudProb.lt(20);          // Threshold for cloud masking
  return image.updateMask(isNotCloud);
}

// Sentinel-2 data for current glacial lakes
var startDate = '2025-01-01';
var endDate = '2025-05-01';

var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(sikkim)
            .filterDate(startDate, endDate)
            .map(maskClouds);

// Add NDWI (Normalized Difference Water Index) band
var addNDWI = function(image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
};

s2 = s2.map(addNDWI);

// Extract water bodies using NDWI
var waterBodies = s2.qualityMosaic('NDWI').select('NDWI').gt(0.35)
                    .updateMask(s2.qualityMosaic('NDWI').select('NDWI').gt(0.35));

// Clip water bodies to Sikkim region
waterBodies = waterBodies.clip(sikkim);

// Add water bodies to the map
Map.addLayer(waterBodies, {palette: ['blue'], opacity: 0.6}, 'Current Glacial Lakes');

// Add GLIMS dataset for historical glacial lakes
var glacialLakes = ee.FeatureCollection('GLIMS/current').filterBounds(sikkim);

// Add historical glacial lakes to the map
Map.addLayer(glacialLakes, {color: 'cyan'}, 'Historical Glacial Lakes');

// Elevation and Slope Data (ALOS DEM)
var elevation = ee.Image('JAXA/ALOS/AW3D30_V1_1').select('AVE').clip(sikkim);
var terrain = ee.Terrain.products(elevation);
var slope = terrain.select('slope');

// Historical Flood Extents (JRC Global Surface Water)
var historicalFloodExtents = ee.ImageCollection('JRC/GSW1_3/MonthlyHistory')
                                .filterBounds(sikkim)
                                .filterDate('1990-01-01', '2025-01-01')
                                .mean()
                                .clip(sikkim);

// Reduce glacial lakes to feature collection for CSV export
var reduceToFeatures = function(feature) {
  var lakeArea = feature.geometry().area().divide(1e6); // Area in sq. km
  var elevationRed = elevation.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: feature.geometry(),
    scale: 30
  }).get('AVE');
  
  var slopeRed = slope.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: feature.geometry(),
    scale: 30
  }).get('slope');
  
  var floodOccurrence = historicalFloodExtents.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: feature.geometry(),
    scale: 30
  }).get('water');
  
  return feature.set({
    'Lake_Area_km2': lakeArea,
    'Mean_Elevation_m': elevationRed,
    'Mean_Slope_deg': slopeRed,
    'Flood_Occurrence': floodOccurrence
  });
};

var glacialLakeFeatures = glacialLakes.map(reduceToFeatures);

// Export reduced dataset as a CSV file
Export.table.toDrive({
  collection: glacialLakeFeatures,
  description: 'Risk_Assessment_ML_Dataset',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'Risk_Assessment_ML_Dataset_Sikkim',
  fileFormat: 'CSV'
});

// Export the current glacial lakes map for risk level marking
Export.image.toDrive({
  image: waterBodies.rename('current_glacial_lakes'),
  description: 'Current_Glacial_Lakes_Map',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'Current_Glacial_Lakes_Sikkim',
  region: sikkim.geometry().bounds(),
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
