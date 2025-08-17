/**
 * Basic compression example
 * Shows how to compress and decompress a map
 */

import { MapCompression } from '../src';

// Example map data
const mapData = {
  blocks: {
    "0,0,0": 1,
    "0,0,1": 1,
    "0,0,2": 1,
    "1,0,0": 2,
    "1,0,1": 2,
    "1,0,2": 2,
    // ... imagine thousands more blocks
  },
  blockTypes: {
    "1": "stone",
    "2": "dirt", 
    "3": "grass"
  },
  entities: {
    "spawn": { x: 10, y: 5, z: 10, type: "spawn_point" }
  },
  version: "1.0.0"
};

async function example(world: any) {
  // Initialize the compression plugin
  const mc = new MapCompression(world, {
    debug: true, // Enable debug logging
    metrics: true // Track performance
  });
  
  console.log('Original map size:', JSON.stringify(mapData).length, 'bytes');
  
  // Compress the map
  console.log('\nCompressing map...');
  const compressed = await mc.compress(mapData);
  
  console.log('Compressed size:', compressed.metadata.compressedSize, 'bytes');
  console.log('Compression ratio:', (compressed.metadata.compressionRatio * 100).toFixed(1) + '%');
  console.log('Compression time:', compressed.metadata.compressionTime + 'ms');
  
  // Decompress the map
  console.log('\nDecompressing map...');
  const decompressed = await mc.decompress({
    version: compressed.version,
    algorithm: 'brotli',
    data: compressed.data as string,
    blockTypes: compressed.blockTypes,
    bounds: compressed.bounds,
    entities: mapData.entities,
    mapVersion: mapData.version
  });
  
  console.log('Decompressed blocks:', Object.keys(decompressed.blocks).length);
  console.log('Decompression time:', decompressed.metadata?.decompressionTime + 'ms');
  
  // Verify integrity
  const originalBlocks = Object.keys(mapData.blocks).sort();
  const decompressedBlocks = Object.keys(decompressed.blocks).sort();
  const isIdentical = JSON.stringify(originalBlocks) === JSON.stringify(decompressedBlocks);
  
  console.log('\nIntegrity check:', isIdentical ? '✅ PASSED' : '❌ FAILED');
  
  // Get metrics
  const metrics = mc.getMetrics();
  console.log('\nPerformance Metrics:');
  console.log('- Compression ratio:', (metrics.compressionRatio! * 100).toFixed(1) + '%');
  console.log('- Compression time:', metrics.compressionTimeMs + 'ms');
  console.log('- Decompression time:', metrics.decompressionTimeMs + 'ms');
  
  // Clean up
  mc.cleanup();
}

// Usage
// const world = /* your Hytopia world instance */;
// example(world);