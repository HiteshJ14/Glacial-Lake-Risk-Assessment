// Define the Sikkim region
var sikkim = ee.FeatureCollection("FAO/GAUL/2015/level1")
                .filter(ee.Filter.eq('ADM1_NAME', 'Sikkim'));

// Center the map on the Sikkim region
Map.centerObject(sikkim, 9);

// -----------------------------------------------
// 1. Elevation (SRTM Digital Elevation Model)
// -----------------------------------------------
var elevation = ee.Image("USGS/SRTMGL1_003").clip(sikkim);

// Visualization parameters for elevation
var elevationVis = {
  min: 0,
  max: 5000,
  palette: ['blue', 'green', 'yellow', 'orange', 'red']
};

// Add Elevation layer to the map
Map.addLayer(elevation, elevationVis, 'Elevation');

// -----------------------------------------------
// 2. Glacial Lakes (Using NDWI for water detection)
// -----------------------------------------------
var startDate = '2024-01-01';
var endDate = '2025-05-01';

var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(sikkim)
            .filterDate(startDate, endDate)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

// Calculate NDWI (Normalized Difference Water Index)
var calculateNDWI = function(image) {
  return image.normalizedDifference(['B3', 'B8']).rename('NDWI');
};

var s2NDWI = s2.map(calculateNDWI).qualityMosaic('NDWI').select('NDWI');
var glacialLakes = s2NDWI.gte(0.3).updateMask(s2NDWI.gte(0.3)).clip(sikkim);

// Visualization parameters for NDWI
var ndwiVisParams = {
  min: -1,
  max: 1,
  palette: ['white', 'blue']
};

// Add Glacial Lakes layer to the map
Map.addLayer(glacialLakes, {palette: 'blue'}, 'Glacial Lakes');

// -----------------------------------------------
// 3. Historical Outburst Floods (Global River Discharge data proxy)
// -----------------------------------------------
var hydroData = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory").filterBounds(sikkim).mosaic();

// Visualize areas of high water occurrence
Map.addLayer(hydroData, {min: 0, max: 100, palette: ['white', 'blue']}, 'Historical Outburst Floods');

// -----------------------------------------------
// 4. Glaciers (RGI v6.0 dataset)
// -----------------------------------------------
var glaciers = ee.FeatureCollection("GLIMS/current").filterBounds(sikkim);

// Add Glaciers layer to the map
Map.addLayer(glaciers, {color: 'cyan'}, 'Glaciers');

// -----------------------------------------------
// 5. Land Cover (ESA WorldCover 2020)
// -----------------------------------------------
var landCover = ee.Image("ESA/WorldCover/v100/2020").clip(sikkim);

// Land cover visualization parameters
var landCoverVis = {
  min: 10,
  max: 100,
  palette: [
    '006400', // Tree cover
    'ffbb22', // Shrubland
    'ffff4c', // Grassland
    'f096ff', // Cropland
    'fa0000', // Built-up
    'b4b4b4', // Bare/sparse vegetation
    'f0f0f0', // Snow and ice
    '0064c8', // Permanent water
    '0096a0', // Herbaceous wetland
    '00cf75'  // Mangroves
  ]
};

// Add Land Cover layer to the map
Map.addLayer(landCover, landCoverVis, 'Land Cover');

// -----------------------------------------------
// 6. Slope (Derived from Elevation)
// -----------------------------------------------
var slope = ee.Terrain.slope(elevation);

// Visualization parameters for slope
var slopeVis = {
  min: 0,
  max: 60,
  palette: ['white', 'yellow', 'orange', 'red']
};

// Add Slope layer to the map
Map.addLayer(slope, slopeVis, 'Slope');

// -----------------------------------------------
// Add Sikkim Boundary
// -----------------------------------------------
Map.addLayer(sikkim, {color: 'white'}, 'Sikkim Boundary');

// -----------------------------------------------
// Export Maps (Optional)
// -----------------------------------------------
// Export Elevation
Export.image.toDrive({
  image: elevation,
  description: 'Elevation_Sikkim',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'Elevation_Sikkim',
  region: sikkim.geometry().bounds(),
  scale: 30,
  maxPixels: 1e13
});

// Export Glacial Lakes
Export.image.toDrive({
  image: glacialLakes,
  description: 'Glacial_Lakes_Sikkim',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'Glacial_Lakes_Sikkim',
  region: sikkim.geometry().bounds(),
  scale: 30,
  maxPixels: 1e13
});

// Export Slope
Export.image.toDrive({
  image: slope,
  description: 'Slope_Sikkim',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'Slope_Sikkim',
  region: sikkim.geometry().bounds(),
  scale: 30,
  maxPixels: 1e13
});
