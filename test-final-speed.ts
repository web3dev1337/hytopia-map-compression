/**
 * Final speed test with HyFire8's exact algorithms in the plugin architecture
 */

import { MapCompression } from './src/index';
import * as fs from 'fs';
import * as crypto from 'crypto';

async function testFinalSpeed() {
  console.log('=====================================');
  console.log('🚀 FINAL SPEED TEST - 130MB MAP');
  console.log('  Using HyFire8 Exact Algorithms');
  console.log('=====================================\n');
  
  // Load the 130MB map
  const mapPath = '../HyFire2-work9/assets/map.json';
  console.log('📁 Loading 130MB map...');
  const loadStart = Date.now();
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  const loadTime = Date.now() - loadStart;
  
  const blockCount = Object.keys(mapData.blocks).length;
  const fileSize = fs.statSync(mapPath).size;
  
  console.log(`  File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Blocks: ${blockCount.toLocaleString()}`);
  console.log(`  JSON load time: ${loadTime}ms\n`);
  
  // Get original hash for integrity check
  const originalBlocks = JSON.stringify(mapData.blocks, Object.keys(mapData.blocks).sort());
  const originalHash = crypto.createHash('sha256').update(originalBlocks).digest('hex');
  
  // Create plugin with HyFire8's algorithms
  const world = { blocks: {} };
  const mc = new MapCompression(world, {
    compression: {
      algorithm: 'brotli',
      level: 9,
      useDelta: true,
      useVarint: true
    },
    metrics: true
  });
  
  // TEST 1: COMPRESSION
  console.log('🗜️  TEST 1: COMPRESSION');
  console.log('------------------------');
  const compressStart = Date.now();
  const compressed = await mc.compress(mapData);
  const compressTime = Date.now() - compressStart;
  
  console.log(`  Time: ${compressTime}ms`);
  console.log(`  Speed: ${Math.round(blockCount / (compressTime / 1000)).toLocaleString()} blocks/sec`);
  console.log(`  Output size: ${(compressed.metadata.compressedSize / 1024).toFixed(2)} KB`);
  console.log(`  Compression ratio: ${(compressed.metadata.compressionRatio * 100).toFixed(1)}%\n`);
  
  // Create proper compressed map structure
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
  
  // TEST 2: DECOMPRESSION
  console.log('🔓 TEST 2: DECOMPRESSION');
  console.log('------------------------');
  const decompressStart = Date.now();
  const decompressed = await mc.decompress(compressedMap);
  const decompressTime = Date.now() - decompressStart;
  
  const decompressedCount = Object.keys(decompressed.blocks).length;
  console.log(`  Time: ${decompressTime}ms`);
  console.log(`  Speed: ${Math.round(decompressedCount / (decompressTime / 1000)).toLocaleString()} blocks/sec`);
  console.log(`  Blocks restored: ${decompressedCount.toLocaleString()}\n`);
  
  // TEST 3: INTEGRITY CHECK
  console.log('✅ TEST 3: INTEGRITY');
  console.log('--------------------');
  const decompressedBlocks = JSON.stringify(decompressed.blocks, Object.keys(decompressed.blocks).sort());
  const decompressedHash = crypto.createHash('sha256').update(decompressedBlocks).digest('hex');
  
  if (originalHash === decompressedHash && decompressedCount === blockCount) {
    console.log('  ✅ PERFECT: All blocks match!');
    console.log('  Hash verified: ' + (originalHash === decompressedHash ? '✅' : '❌'));
    console.log('  Count verified: ' + (decompressedCount === blockCount ? '✅' : '❌'));
  } else {
    console.log('  ❌ FAILED: Data mismatch!');
    console.log(`  Original: ${blockCount} blocks`);
    console.log(`  Restored: ${decompressedCount} blocks`);
  }
  
  // SUMMARY
  console.log('\n=====================================');
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('=====================================');
  console.log(`Map Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB → ${(compressed.metadata.compressedSize / 1024).toFixed(2)} KB`);
  console.log(`Compression Ratio: ${((1 - compressed.metadata.compressedSize / fileSize) * 100).toFixed(1)}%`);
  console.log(`Blocks: ${blockCount.toLocaleString()}`);
  console.log('');
  console.log(`Compression:   ${compressTime}ms (${(compressTime/1000).toFixed(1)}s)`);
  console.log(`Decompression: ${decompressTime}ms (${(decompressTime/1000).toFixed(1)}s)`);
  console.log(`Total:         ${compressTime + decompressTime}ms (${((compressTime + decompressTime)/1000).toFixed(1)}s)`);
  console.log('');
  
  // Compare with claims
  console.log('🎯 VS ORIGINAL CLAIMS:');
  console.log('----------------------');
  console.log('HyFire8 README claimed: 36s → <1s');
  console.log(`Plugin actual: ${(decompressTime/1000).toFixed(1)}s decompression`);
  
  if (decompressTime < 1000) {
    console.log('✅ MEETS <1s CLAIM!');
  } else {
    console.log(`⚠️  Slower than claimed (${(decompressTime/1000).toFixed(1)}s vs <1s)`);
  }
}

testFinalSpeed().catch(console.error);