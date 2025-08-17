/**
 * Fast loading example
 * Shows how to use optimized loading for large maps
 */

import { MapCompression } from '../src';
import * as fs from 'fs';
import * as path from 'path';

async function example(world: any) {
  // Initialize with fast loading optimizations
  const mc = new MapCompression(world, {
    features: {
      compression: true,
      fastLoading: true,
      monkeyPatching: true // Enable SDK patching
    },
    optimization: {
      monkeyPatch: true,
      useChunks: true,     // Use chunk-based loading
      batchSize: 50000     // Large batch size for faster loading
    },
    loading: {
      method: 'hybrid'     // Use best available method
    },
    debug: true,
    metrics: true
  });
  
  // Example 1: Load a compressed map file
  console.log('Loading compressed map...');
  const compressedPath = './maps/large-map.compressed.json';
  
  if (fs.existsSync(compressedPath)) {
    const startTime = Date.now();
    await mc.loadMap(compressedPath);
    console.log(`Map loaded in ${Date.now() - startTime}ms`);
  }
  
  // Example 2: Load uncompressed map (will still use optimizations)
  console.log('\nLoading uncompressed map with optimizations...');
  const mapData = {
    blocks: generateLargeMap(1000000), // 1 million blocks
    blockTypes: { "1": "stone", "2": "dirt" },
    entities: {},
    version: "1.0.0"
  };
  
  const loadStart = Date.now();
  await mc.loadMap(mapData);
  console.log(`Uncompressed map loaded in ${Date.now() - loadStart}ms`);
  
  // Example 3: Compress, save, and load
  console.log('\nFull pipeline example...');
  
  // Compress the map
  const compressed = await mc.compress(mapData);
  console.log(`Compressed to ${(compressed.metadata.compressedSize / 1024).toFixed(2)}KB`);
  
  // Save to file
  const outputPath = './maps/test-map.cmap';
  const compressedMap = {
    version: compressed.version,
    algorithm: 'brotli',
    data: compressed.data,
    blockTypes: compressed.blockTypes,
    bounds: compressed.bounds,
    entities: mapData.entities,
    mapVersion: mapData.version,
    metadata: compressed.metadata
  };
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(compressedMap));
  console.log(`Saved compressed map to ${outputPath}`);
  
  // Load the compressed map
  const finalLoadStart = Date.now();
  await mc.loadMap(outputPath);
  console.log(`Compressed map loaded in ${Date.now() - finalLoadStart}ms`);
  
  // Show metrics
  const metrics = mc.getMetrics();
  console.log('\nPerformance Summary:');
  console.log('- Compression ratio:', (metrics.compressionRatio! * 100).toFixed(1) + '%');
  console.log('- Compression time:', metrics.compressionTimeMs + 'ms');
  console.log('- Load time:', metrics.loadTimeMs + 'ms');
  console.log('- Loading method:', metrics.method);
  console.log('- Blocks loaded:', metrics.blocksLoaded);
  
  // Clean up
  mc.cleanup();
}

// Helper function to generate a large map for testing
function generateLargeMap(blockCount: number): { [key: string]: number } {
  const blocks: { [key: string]: number } = {};
  const size = Math.cbrt(blockCount);
  
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const blockType = Math.random() > 0.5 ? 1 : 2;
        blocks[`${x},${y},${z}`] = blockType;
        
        if (Object.keys(blocks).length >= blockCount) {
          return blocks;
        }
      }
    }
  }
  
  return blocks;
}

// Usage
// const world = /* your Hytopia world instance */;
// example(world);