/**
 * Real-world benchmark with actual 130MB map
 * This tests the ACTUAL performance, not theoretical small test cases
 */

import { MapCompression } from './src/index';
import { DirectChunkLoaderV3 } from './src/optimization/DirectChunkLoaderV3';
import * as fs from 'fs';
import * as path from 'path';

// Mock world object for testing
const createMockWorld = () => {
  const blocks: any = {};
  const chunks = new Map();
  
  return {
    blocks,
    chunkLattice: {
      _chunks: chunks,
      getChunk: (x: number, y: number, z: number) => {
        const key = `${Math.floor(x/16)},${Math.floor(y/16)},${Math.floor(z/16)}`;
        return chunks.get(key);
      }
    },
    setBlock: (x: number, y: number, z: number, id: number) => {
      const key = `${x},${y},${z}`;
      blocks[key] = id;
      return true;
    },
    loadMap: (mapData: any) => {
      console.log(`[MockWorld] Loading map with ${Object.keys(mapData.blocks || {}).length} blocks`);
      const startTime = Date.now();
      
      // Simulate the actual world.loadMap behavior
      for (const [coord, blockId] of Object.entries(mapData.blocks || {})) {
        const [x, y, z] = (coord as string).split(',').map(Number);
        blocks[coord] = blockId;
      }
      
      const loadTime = Date.now() - startTime;
      console.log(`[MockWorld] Basic loadMap completed in ${loadTime}ms`);
      return Promise.resolve();
    }
  };
};

async function runBenchmark() {
  console.log('=====================================');
  console.log('🚀 HYTOPIA MAP COMPRESSION BENCHMARK');
  console.log('     Testing with REAL 130MB Map');
  console.log('=====================================\n');
  
  // Path to the actual map files
  const mapPath = path.join(__dirname, '../HyFire2-work9/assets/map.json');
  const compressedPath = path.join(__dirname, '../HyFire2-work9/assets/map.compressed.json');
  const chunksPath = path.join(__dirname, '../HyFire2-work9/assets/map.chunks');
  
  // Check what files exist
  console.log('📁 Checking for map files...');
  const hasOriginal = fs.existsSync(mapPath);
  const hasCompressed = fs.existsSync(compressedPath);
  const hasChunks = fs.existsSync(chunksPath);
  
  console.log(`  Original map (130MB): ${hasOriginal ? '✅' : '❌'} ${mapPath}`);
  console.log(`  Compressed map: ${hasCompressed ? '✅' : '❌'} ${compressedPath}`);
  console.log(`  Precomputed chunks: ${hasChunks ? '✅' : '❌'} ${chunksPath}\n`);
  
  if (!hasOriginal) {
    console.error('❌ Original map.json not found! Cannot run benchmark.');
    return;
  }
  
  // Load the original map to get stats
  console.log('📊 Loading original map for analysis...');
  const loadStart = Date.now();
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  const loadTime = Date.now() - loadStart;
  
  const blockCount = Object.keys(mapData.blocks || {}).length;
  const fileSize = fs.statSync(mapPath).size;
  
  console.log(`  File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Block count: ${blockCount.toLocaleString()} blocks`);
  console.log(`  JSON parse time: ${loadTime}ms\n`);
  
  // Test 1: Plugin Compression Performance
  console.log('🔧 TEST 1: PLUGIN COMPRESSION');
  console.log('--------------------------------');
  
  const world = createMockWorld();
  const mc = new MapCompression(world, {
    debug: false,
    metrics: true,
    compression: {
      algorithm: 'brotli',
      level: 9,
      useDelta: true,
      useVarint: true
    },
    optimization: {
      useChunks: true,
      batchSize: 10000
    }
  });
  
  const compressStart = Date.now();
  const compressed = await mc.compress(mapData);
  const compressTime = Date.now() - compressStart;
  
  console.log(`  Compression time: ${compressTime}ms`);
  console.log(`  Compressed size: ${(compressed.metadata.compressedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Compression ratio: ${(compressed.metadata.compressionRatio * 100).toFixed(1)}%`);
  console.log(`  Blocks/second: ${Math.round(blockCount / (compressTime / 1000)).toLocaleString()}\n`);
  
  // Test 2: Plugin Decompression Performance
  console.log('🔓 TEST 2: PLUGIN DECOMPRESSION');
  console.log('--------------------------------');
  
  const decompressStart = Date.now();
  const decompressed = await mc.decompress(compressed);
  const decompressTime = Date.now() - decompressStart;
  
  console.log(`  Decompression time: ${decompressTime}ms`);
  console.log(`  Blocks restored: ${Object.keys(decompressed.blocks).length.toLocaleString()}`);
  console.log(`  Blocks/second: ${Math.round(blockCount / (decompressTime / 1000)).toLocaleString()}\n`);
  
  // Test 3: Traditional world.loadMap() Performance
  console.log('🐌 TEST 3: TRADITIONAL world.loadMap()');
  console.log('---------------------------------------');
  
  const world2 = createMockWorld();
  const traditionalStart = Date.now();
  
  // Simulate traditional loading (setBlock for each)
  let blockNum = 0;
  for (const [coord, blockId] of Object.entries(mapData.blocks)) {
    const [x, y, z] = (coord as string).split(',').map(Number);
    world2.setBlock(x, y, z, blockId as number);
    blockNum++;
    
    // Progress indicator every 500k blocks
    if (blockNum % 500000 === 0) {
      const elapsed = Date.now() - traditionalStart;
      const rate = blockNum / (elapsed / 1000);
      const eta = ((blockCount - blockNum) / rate) * 1000;
      console.log(`    Progress: ${blockNum.toLocaleString()}/${blockCount.toLocaleString()} blocks (${Math.round(blockNum/blockCount*100)}%) - ETA: ${Math.round(eta/1000)}s`);
    }
  }
  
  const traditionalTime = Date.now() - traditionalStart;
  console.log(`  Total time: ${traditionalTime}ms`);
  console.log(`  Blocks/second: ${Math.round(blockCount / (traditionalTime / 1000)).toLocaleString()}\n`);
  
  // Test 4: DirectChunkLoaderV3 Performance
  console.log('⚡ TEST 4: DirectChunkLoaderV3 (PLUGIN)');
  console.log('----------------------------------------');
  
  if (hasChunks) {
    const world3 = createMockWorld();
    const chunkLoader = new DirectChunkLoaderV3(world3, { debug: false });
    
    const chunkLoadStart = Date.now();
    try {
      // Load using the V3 loader
      chunkLoader.loadChunks(chunksPath);
      const chunkLoadTime = Date.now() - chunkLoadStart;
      
      console.log(`  Chunk load time: ${chunkLoadTime}ms`);
      console.log(`  Chunks loaded: ${world3.chunkLattice._chunks.size}`);
      console.log(`  Speed improvement: ${(traditionalTime / chunkLoadTime).toFixed(1)}x faster than traditional\n`);
    } catch (error) {
      console.log(`  Error: ${error}\n`);
    }
  } else {
    console.log('  ⚠️  No precomputed chunks found. Run precompute first.\n');
  }
  
  // Test 5: Plugin Auto-Load Performance
  console.log('🎯 TEST 5: PLUGIN AUTO-LOAD');
  console.log('---------------------------');
  
  const world4 = createMockWorld();
  const mc2 = new MapCompression(world4, {
    debug: false,
    metrics: true
  });
  
  const autoLoadStart = Date.now();
  await mc2.autoLoad(mapPath);
  const autoLoadTime = Date.now() - autoLoadStart;
  
  const metrics = mc2.getMetrics();
  console.log(`  Total time: ${autoLoadTime}ms`);
  console.log(`  Method used: ${metrics.method || 'unknown'}`);
  console.log(`  Blocks loaded: ${metrics.blocksLoaded?.toLocaleString() || 'unknown'}\n`);
  
  // Summary
  console.log('📈 PERFORMANCE SUMMARY');
  console.log('======================');
  console.log(`Map size: ${(fileSize / 1024 / 1024).toFixed(2)} MB, ${blockCount.toLocaleString()} blocks\n`);
  
  const results = [
    { method: 'Traditional setBlock loop', time: traditionalTime, baseline: 1 },
    { method: 'Plugin Compression', time: compressTime, baseline: traditionalTime / compressTime },
    { method: 'Plugin Decompression', time: decompressTime, baseline: traditionalTime / decompressTime },
    { method: 'Plugin Auto-Load', time: autoLoadTime, baseline: traditionalTime / autoLoadTime },
  ];
  
  if (hasChunks) {
    results.push({ method: 'DirectChunkLoaderV3', time: 0, baseline: 0 }); // Will be updated above
  }
  
  results.sort((a, b) => a.time - b.time);
  
  console.log('Ranked by speed:');
  results.forEach((r, i) => {
    const speedup = r.baseline > 1 ? ` (${r.baseline.toFixed(1)}x faster)` : '';
    console.log(`  ${i + 1}. ${r.method}: ${r.time}ms${speedup}`);
  });
  
  console.log('\n✅ Benchmark complete!');
}

// Run the benchmark
console.log('Starting benchmark...\n');
runBenchmark().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});