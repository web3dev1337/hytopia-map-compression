/**
 * Simple integrity test - compress and decompress, verify data matches
 */

import { MapCompression } from './src/index';
import * as fs from 'fs';
import * as crypto from 'crypto';

async function testIntegrity() {
  console.log('=== COMPRESSION INTEGRITY TEST ===\n');
  
  // Load the original map
  const mapPath = '../HyFire2-work9/assets/map.json';
  console.log('Loading map...');
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  
  // Get original hash
  const originalBlocks = JSON.stringify(mapData.blocks, Object.keys(mapData.blocks).sort());
  const originalHash = crypto.createHash('sha256').update(originalBlocks).digest('hex');
  const blockCount = Object.keys(mapData.blocks).length;
  
  console.log(`Original: ${blockCount} blocks`);
  console.log(`Original hash: ${originalHash}\n`);
  
  // Create compressor
  const world = { blocks: {} };
  const mc = new MapCompression(world, {
    compression: {
      algorithm: 'brotli',
      level: 9,
      useDelta: true,
      useVarint: true
    }
  });
  
  // Compress
  console.log('Compressing...');
  const compressed = await mc.compress(mapData);
  console.log(`Compressed: ${compressed.metadata.blockCount} blocks\n`);
  
  // Create proper compressed map structure (like HyFire8 does)
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
  
  // Decompress
  console.log('Decompressing...');
  const decompressed = await mc.decompress(compressedMap);
  
  // Get decompressed hash
  const decompressedBlocks = JSON.stringify(decompressed.blocks, Object.keys(decompressed.blocks).sort());
  const decompressedHash = crypto.createHash('sha256').update(decompressedBlocks).digest('hex');
  const decompressedCount = Object.keys(decompressed.blocks).length;
  
  console.log(`Decompressed: ${decompressedCount} blocks`);
  console.log(`Decompressed hash: ${decompressedHash}\n`);
  
  // Compare
  if (originalHash === decompressedHash) {
    console.log('✅ SUCCESS: Data integrity verified!');
    console.log('All blocks match perfectly after compression/decompression');
  } else {
    console.log('❌ FAILURE: Data mismatch!');
    console.log(`Original blocks: ${blockCount}`);
    console.log(`Decompressed blocks: ${decompressedCount}`);
    
    // Find first mismatch
    for (const key in mapData.blocks) {
      if (mapData.blocks[key] !== decompressed.blocks[key]) {
        console.log(`First mismatch at ${key}: ${mapData.blocks[key]} vs ${decompressed.blocks[key]}`);
        break;
      }
    }
  }
}

testIntegrity().catch(console.error);