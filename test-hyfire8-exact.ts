/**
 * Test the EXACT HyFire8 code copy
 */

import { MapCompressionFixed } from './src/core/MapCompressorFixed';
import * as fs from 'fs';
import * as crypto from 'crypto';

async function testHyFire8Exact() {
  console.log('=== TESTING EXACT HYFIRE8 CODE ===\n');
  
  // Load the original map
  const mapPath = '../HyFire2-work9/assets/map.json';
  console.log('Loading 130MB map...');
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  
  // Get original hash
  const originalBlocks = JSON.stringify(mapData.blocks, Object.keys(mapData.blocks).sort());
  const originalHash = crypto.createHash('sha256').update(originalBlocks).digest('hex');
  const blockCount = Object.keys(mapData.blocks).length;
  
  console.log(`Original: ${blockCount.toLocaleString()} blocks`);
  console.log(`Original hash: ${originalHash}\n`);
  
  // Create compressor with EXACT HyFire8 code
  const mc = new MapCompressionFixed(null);
  
  // Compress
  console.log('COMPRESSING with HyFire8 exact code:');
  const startCompress = Date.now();
  const compressed = await mc.compress(mapData);
  const compressTime = Date.now() - startCompress;
  console.log(`Total compression time: ${compressTime}ms\n`);
  
  // Decompress
  console.log('DECOMPRESSING with HyFire8 exact code:');
  const startDecompress = Date.now();
  const decompressed = await mc.decompress(compressed);
  const decompressTime = Date.now() - startDecompress;
  console.log(`Total decompression time: ${decompressTime}ms\n`);
  
  // Get decompressed hash
  const decompressedBlocks = JSON.stringify(decompressed.blocks, Object.keys(decompressed.blocks).sort());
  const decompressedHash = crypto.createHash('sha256').update(decompressedBlocks).digest('hex');
  const decompressedCount = Object.keys(decompressed.blocks).length;
  
  console.log(`Decompressed: ${decompressedCount.toLocaleString()} blocks`);
  console.log(`Decompressed hash: ${decompressedHash}\n`);
  
  // Compare
  if (originalHash === decompressedHash) {
    console.log('✅ SUCCESS: HyFire8 exact code works perfectly!');
    console.log('All blocks match - this is what the plugin should have done!');
  } else {
    console.log('❌ FAILURE: Even the exact copy failed?!');
  }
  
  console.log('\n📊 PERFORMANCE SUMMARY:');
  console.log(`Compression: ${compressTime}ms for ${blockCount.toLocaleString()} blocks`);
  console.log(`Decompression: ${decompressTime}ms for ${blockCount.toLocaleString()} blocks`);
  console.log(`Compression ratio: ${((1 - compressed.compressedSize / compressed.originalSize) * 100).toFixed(1)}%`);
}

testHyFire8Exact().catch(console.error);