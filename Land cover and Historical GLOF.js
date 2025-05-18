// Define the Sikkim region
var aoi = ee.FeatureCollection("FAO/GAUL/2015/level1")
                .filter(ee.Filter.eq('ADM1_NAME', 'Sikkim'));

// Center the map on the AOI
Map.centerObject(aoi, 9);

// Function to mask clouds in Sentinel-2 imagery using MSK_CLDPRB
function maskSentinel2Clouds(image) {
  var cloudProb = image.select('MSK_CLDPRB');
  var isNotCloud = cloudProb.lt(20); // Cloud probability threshold
  return image.updateMask(isNotCloud);
}

// Define date range dynamically
var startDate = ee.Date('2025-01-01');
var endDate = ee.Date('2025-04-01');

// Sentinel-2 collection with cloud masking
var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterBounds(aoi)
            .filterDate(startDate, endDate)
            .map(maskSentinel2Clouds);

// Calculate NDWI for water bodies
var calculateNdwi = function(image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
};
s2 = s2.map(calculateNdwi);

// Extract water bodies with adaptive NDWI threshold
var waterMask = s2.qualityMosaic('NDWI').select('NDWI').gt(0.35);
var waterBodies = waterMask.updateMask(waterMask);

// Add water bodies to the map
Map.addLayer(waterBodies.clip(aoi), {palette: ['blue'], opacity: 0.6}, 'Glacial Lakes');

// Add elevation data (ALOS DEM)
var elevation = ee.Image('JAXA/ALOS/AW3D30_V1_1').select('AVE').clip(aoi);
Map.addLayer(elevation, {min: 0, max: 6000, palette: ['white', 'brown']}, 'Elevation');

// Calculate slope from elevation
var terrain = ee.Terrain.products(elevation);
var slope = terrain.select('slope');
Map.addLayer(slope, {min: 0, max: 60, palette: ['yellow', 'red']}, 'Slope');

// Add land cover dataset (ESA WorldCover)
var landCover = ee.Image('ESA/WorldCover/v200/2021').select('Map').clip(aoi);
Map.addLayer(landCover, {min: 10, max: 100, palette: ['green', 'yellow', 'blue', 'brown']}, 'Land Cover');

// Add historical glacier lake data (GLIMS)
var glacierLakes = ee.FeatureCollection('GLIMS/current').filterBounds(aoi);
Map.addLayer(glacierLakes, {color: 'cyan'}, 'Historical Glacier Lakes');

// Combine features for export
var combined = elevation.addBands(slope)
                         .addBands(landCover.rename('land_cover'))
                         .addBands(waterBodies.rename('water_bodies'));

// Export combined dataset
Export.image.toDrive({
  image: combined,
  description: 'Updated_GLOF_Risk_Assessment',
  folder: 'GLOF_Risk_Assessment',
  fileNamePrefix: 'Updated_GLOF_Risk_Assessment_Sikkim',
  region: aoi.geometry().bounds(),
  scale: 10,  // Adjust scale for higher resolution
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
