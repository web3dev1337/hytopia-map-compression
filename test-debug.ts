/**
 * Debug test to find where blocks are being lost
 */

import { MapCompression } from './src/index';
import { DeltaEncoder } from './src/encoders/DeltaEncoder';
import * as fs from 'fs';

async function debugTest() {
  console.log('=== DEBUG TEST ===\n');
  
  // Load the original map
  const mapPath = '../HyFire2-work9/assets/map.json';
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  
  const originalCount = Object.keys(mapData.blocks).length;
  console.log(`Original blocks: ${originalCount}`);
  
  // Test DeltaEncoder directly
  console.log('\nTesting DeltaEncoder directly:');
  const { deltas, blockIds, bounds } = DeltaEncoder.encodePositions(mapData.blocks);
  console.log(`Encoded: ${blockIds.length} blocks`);
  console.log(`Deltas length: ${deltas.length} (should be ${blockIds.length * 3})`);
  console.log(`Bounds: ${JSON.stringify(bounds)}`);
  
  // Decode
  const decoded = DeltaEncoder.decodePositions(deltas, blockIds, bounds);
  console.log(`Decoded: ${Object.keys(decoded).length} blocks`);
  
  // Check if they match
  let mismatches = 0;
  for (const key in mapData.blocks) {
    if (mapData.blocks[key] !== decoded[key]) {
      mismatches++;
      if (mismatches <= 3) {
        console.log(`Mismatch at ${key}: ${mapData.blocks[key]} vs ${decoded[key]}`);
      }
    }
  }
  console.log(`Total mismatches: ${mismatches}`);
  
  // Check if all decoded blocks exist in original
  let foundInOriginal = 0;
  for (const key in decoded) {
    if (mapData.blocks[key] !== undefined) {
      foundInOriginal++;
    }
  }
  console.log(`Decoded blocks found in original: ${foundInOriginal}/${Object.keys(decoded).length}`);
}

debugTest().catch(console.error);