/**
 * Test the full pipeline step by step
 */

import { MapCompression } from './src/index';
import * as fs from 'fs';

async function testPipeline() {
  console.log('=== PIPELINE TEST ===\n');
  
  // Load the original map
  const mapPath = '../HyFire2-work9/assets/map.json';
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  
  const originalCount = Object.keys(mapData.blocks).length;
  console.log(`Original blocks: ${originalCount}`);
  
  // Create compressor
  const world = { blocks: {} };
  const mc = new MapCompression(world, {
    compression: {
      algorithm: 'brotli',
      level: 9,
      useDelta: true,
      useVarint: true
    },
    debug: true  // Enable debug
  });
  
  // Compress
  console.log('\n=== COMPRESSION ===');
  const compressed = await mc.compress(mapData);
  
  console.log('\nCompressed object structure:');
  console.log('- data length:', compressed.data?.length);
  console.log('- bounds:', JSON.stringify(compressed.bounds));
  console.log('- metadata.blockCount:', compressed.metadata.blockCount);
  console.log('- version:', compressed.version);
  console.log('- blockTypes:', compressed.blockTypes ? 'present' : 'missing');
  
  // Create the full compressed map structure (like the working version does)
  const compressedMap = {
    version: compressed.version || 2,
    algorithm: 'brotli',
    data: compressed.data,
    blockTypes: compressed.blockTypes || mapData.blockTypes,
    bounds: compressed.bounds,
    entities: mapData.entities || {},
    mapVersion: mapData.version || '1.0.0',
    metadata: compressed.metadata,
    options: {
      useDelta: true,
      useVarint: true
    }
  };
  
  console.log('\nFull compressed map structure:');
  console.log('- bounds:', JSON.stringify(compressedMap.bounds));
  console.log('- options:', JSON.stringify(compressedMap.options));
  
  // Decompress
  console.log('\n=== DECOMPRESSION ===');
  const decompressed = await mc.decompress(compressedMap);
  
  console.log('\nDecompressed blocks:', Object.keys(decompressed.blocks).length);
  
  // Check first few blocks
  const origKeys = Object.keys(mapData.blocks).slice(0, 5);
  const decompKeys = Object.keys(decompressed.blocks).slice(0, 5);
  
  console.log('\nFirst 5 original keys:', origKeys);
  console.log('First 5 decompressed keys:', decompKeys);
}

testPipeline().catch(console.error);