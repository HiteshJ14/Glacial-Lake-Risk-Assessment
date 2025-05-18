// Define the region of interest (Sikkim)
var sikkim = ee.FeatureCollection("FAO/GAUL/2015/level1")
                .filter(ee.Filter.eq('ADM1_NAME', 'Sikkim'));

// Center the map on the Sikkim region
Map.centerObject(sikkim, 9);

// -----------------------------------------------
// 1. Elevation (SRTM DEM)
// -----------------------------------------------
var elevation = ee.Image("USGS/SRTMGL1_003").clip(sikkim);

// -----------------------------------------------
// 2. Slope and Aspect (Derived from Elevation)
// -----------------------------------------------
var slope = ee.Terrain.slope(elevation).clip(sikkim);
var aspect = ee.Terrain.aspect(elevation).clip(sikkim);

// -----------------------------------------------
// 3. NDWI (Normalized Difference Water Index)
// -----------------------------------------------
var startDate = '2025-01-01';
var endDate = '2025-05-01';

var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(sikkim)
            .filterDate(startDate, endDate)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

// Calculate NDWI
var calculateNDWI = function(image) {
  return image.normalizedDifference(['B3', 'B8']).rename('NDWI');
};

var ndwi = s2.map(calculateNDWI).qualityMosaic('NDWI').select('NDWI').clip(sikkim);

// Dynamically calculate the NDWI threshold for water detection
var ndwiThreshold = ndwi.reduceRegion({
  reducer: ee.Reducer.percentile([85]), // 85th percentile
  geometry: sikkim,
  scale: 30,
  maxPixels: 1e9
}).values().get(0);

var glacialLakes = ndwi.gte(ee.Number(ndwiThreshold)).updateMask(ndwi.gte(ee.Number(ndwiThreshold)));

// -----------------------------------------------
// 4. Land Cover (ESA WorldCover 2020)
// -----------------------------------------------
var landCover = ee.Image("ESA/WorldCover/v100/2020").clip(sikkim);

// -----------------------------------------------
// 5. Glacier Proximity (RGI v6.0 dataset)
// -----------------------------------------------
var glaciers = ee.FeatureCollection("GLIMS/current").filterBounds(sikkim);

// Convert glaciers to a binary raster (1 for glacier presence, 0 for absence)
var glacierRaster = glaciers.map(function(feature) {
  return ee.Feature(feature).set('constant', 1); // Set a constant property
}).reduceToImage({
  properties: ['constant'], // Use the property set above
  reducer: ee.Reducer.first() // Use the first reducer to retain the constant value
}).rename('Glacier').clip(sikkim);

// Calculate distance to glaciers
var glacierDistance = glacierRaster.fastDistanceTransform().sqrt().rename('Glacier_Distance').clip(sikkim);

// -----------------------------------------------
// 6. Glacial Lake Proximity
// -----------------------------------------------
var lakeDistance = glacialLakes.fastDistanceTransform().sqrt().rename('Lake_Distance').clip(sikkim);

// -----------------------------------------------
// 7. Historical Flood Occurrence (JRC Global Surface Water)
// -----------------------------------------------
var floodOccurrence = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
                          .select('occurrence')
                          .clip(sikkim);

// -----------------------------------------------
// Combine Features into a Single Image
// -----------------------------------------------
var featureStack = elevation.rename('Elevation')
                .addBands(slope.rename('Slope'))
                .addBands(aspect.rename('Aspect'))
                .addBands(ndwi.rename('NDWI'))
                .addBands(landCover.rename('Land_Cover'))
                .addBands(glacierDistance)
                .addBands(lakeDistance)
                .addBands(floodOccurrence.rename('Flood_Occurrence'));

// -----------------------------------------------
// Dynamically Calculate Number of Points to Sample
// -----------------------------------------------
var sikkimArea = sikkim.geometry().area().divide(1e6); // Area in square kilometers
var pointsToSample = ee.Number(sikkimArea).multiply(10).int(); // 10 points per km²

// -----------------------------------------------
// Sample Data for ML Model
// -----------------------------------------------
var points = featureStack.sample({
  region: sikkim,
  scale: 30,
  numPixels: pointsToSample, // Dynamically calculate the number of points
  projection: 'EPSG:4326',
  seed: 42,
  geometries: true
});

// -----------------------------------------------
// Export the Dataset to a CSV File
// -----------------------------------------------
Export.table.toDrive({
  collection: points,
  description: 'GLOF_Risk_Assessment_Dataset',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'GLOF_Risk_Assessment_Sikkim_2025',
  fileFormat: 'CSV'
});

// -----------------------------------------------
// Add Layers to Map for Visualization
// -----------------------------------------------
Map.addLayer(elevation, {min: 0, max: 5000, palette: ['blue', 'green', 'yellow', 'orange', 'red']}, 'Elevation');
Map.addLayer(slope, {min: 0, max: 60, palette: ['white', 'yellow', 'orange', 'red']}, 'Slope');
Map.addLayer(aspect, {min: 0, max: 360, palette: ['blue', 'green', 'red', 'purple']}, 'Aspect');
Map.addLayer(ndwi, {min: -1, max: 1, palette: ['white', 'blue']}, 'NDWI');
Map.addLayer(glacialLakes, {palette: 'cyan'}, 'Glacial Lakes');
