/**
 * Full pipeline example
 * Complete demonstration of compression, storage, and optimized loading
 */

import { MapCompression } from '../src';
import * as fs from 'fs';
import * as path from 'path';

// Configuration for different scenarios
const configs = {
  // Maximum compression
  maxCompression: {
    compression: {
      algorithm: 'brotli' as const,
      level: 9,
      useDelta: true,
      useVarint: true
    }
  },
  
  // Fastest loading
  fastestLoading: {
    optimization: {
      monkeyPatch: true,
      useChunks: true,
      batchSize: 100000
    },
    loading: {
      method: 'chunks' as const
    }
  },
  
  // Balanced performance
  balanced: {
    compression: {
      algorithm: 'brotli' as const,
      level: 6,
      useDelta: true,
      useVarint: true
    },
    optimization: {
      monkeyPatch: true,
      useChunks: true,
      batchSize: 50000
    },
    loading: {
      method: 'hybrid' as const
    }
  }
};

async function fullPipelineExample(world: any) {
  console.log('=== Hytopia Map Compression - Full Pipeline Demo ===\n');
  
  // Generate a large test map
  const mapData = generateRealisticMap();
  const originalSize = JSON.stringify(mapData).length;
  
  console.log(`Generated map with ${Object.keys(mapData.blocks).length} blocks`);
  console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB\n`);
  
  // Test different configurations
  for (const [configName, config] of Object.entries(configs)) {
    console.log(`\n--- Testing ${configName} configuration ---`);
    
    const mc = new MapCompression(world, {
      ...config,
      debug: false,
      metrics: true
    });
    
    // Compress
    const compressStart = Date.now();
    const compressed = await mc.compress(mapData);
    const compressTime = Date.now() - compressStart;
    
    console.log(`Compression:`);
    console.log(`  Size: ${(compressed.metadata.compressedSize / 1024).toFixed(2)}KB`);
    console.log(`  Ratio: ${(compressed.metadata.compressionRatio * 100).toFixed(1)}%`);
    console.log(`  Time: ${compressTime}ms`);
    
    // Create compressed map file structure
    const compressedMap = {
      version: compressed.version,
      algorithm: config.compression?.algorithm || 'brotli',
      data: compressed.data,
      blockTypes: compressed.blockTypes,
      bounds: compressed.bounds,
      entities: mapData.entities,
      mapVersion: mapData.version,
      metadata: compressed.metadata,
      options: {
        useDelta: config.compression?.useDelta,
        useVarint: config.compression?.useVarint
      }
    };
    
    // Decompress
    const decompressStart = Date.now();
    const decompressed = await mc.decompress(compressedMap);
    const decompressTime = Date.now() - decompressStart;
    
    console.log(`Decompression:`);
    console.log(`  Blocks: ${Object.keys(decompressed.blocks).length}`);
    console.log(`  Time: ${decompressTime}ms`);
    
    // Load map
    const loadStart = Date.now();
    await mc.loadMap(compressedMap);
    const loadTime = Date.now() - loadStart;
    
    console.log(`Loading:`);
    console.log(`  Method: ${config.loading?.method || 'default'}`);
    console.log(`  Time: ${loadTime}ms`);
    
    // Calculate total time
    const totalTime = compressTime + decompressTime + loadTime;
    console.log(`Total pipeline: ${totalTime}ms`);
    
    // Cleanup
    mc.cleanup();
  }
  
  // Demonstrate file operations
  console.log('\n--- File Operations Demo ---');
  
  const mc = new MapCompression(world, configs.balanced);
  
  // Compress and save
  const compressed = await mc.createCompressedMapFile(mapData);
  const outputPath = './maps/demo-map.cmap';
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(compressed, null, 2));
  console.log(`Saved compressed map to ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)}KB`);
  
  // Load from file
  const loadedData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  await mc.loadMap(loadedData);
  console.log('Successfully loaded map from file');
  
  // Show final metrics
  const metrics = mc.getMetrics();
  console.log('\n--- Final Metrics ---');
  console.log(`Compression ratio: ${(metrics.compressionRatio! * 100).toFixed(1)}%`);
  console.log(`Compression time: ${metrics.compressionTimeMs}ms`);
  console.log(`Decompression time: ${metrics.decompressionTimeMs}ms`);
  console.log(`Load time: ${metrics.loadTimeMs}ms`);
  console.log(`Blocks loaded: ${metrics.blocksLoaded}`);
  
  mc.cleanup();
  console.log('\n=== Demo Complete ===');
}

// Generate a realistic map with patterns
function generateRealisticMap(): any {
  const blocks: { [key: string]: number } = {};
  const size = 256; // 256x256x64 world
  const height = 64;
  
  // Generate terrain layers
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      // Bedrock layer
      blocks[`${x},0,${z}`] = 7; // bedrock
      
      // Stone layers
      for (let y = 1; y < 40; y++) {
        blocks[`${x},${y},${z}`] = 1; // stone
      }
      
      // Dirt layers
      for (let y = 40; y < 45; y++) {
        blocks[`${x},${y},${z}`] = 3; // dirt
      }
      
      // Grass on top
      blocks[`${x},45,${z}`] = 2; // grass
      
      // Random trees
      if (Math.random() < 0.01 && x > 5 && x < size - 5 && z > 5 && z < size - 5) {
        // Tree trunk
        for (let y = 46; y < 52; y++) {
          blocks[`${x},${y},${z}`] = 17; // wood
        }
        
        // Leaves
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dy = 0; dy <= 2; dy++) {
              if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) <= 3) {
                blocks[`${x + dx},${52 + dy},${z + dz}`] = 18; // leaves
              }
            }
          }
        }
      }
    }
  }
  
  // Add some structures
  addStructure(blocks, 128, 46, 128, 'house');
  addStructure(blocks, 64, 46, 64, 'tower');
  
  return {
    blocks,
    blockTypes: {
      "1": "stone",
      "2": "grass",
      "3": "dirt",
      "7": "bedrock",
      "17": "wood",
      "18": "leaves",
      "45": "brick",
      "98": "stone_brick"
    },
    entities: {
      "spawn": { x: 128, y: 46, z: 128, type: "spawn_point" },
      "chest1": { x: 130, y: 47, z: 130, type: "chest" }
    },
    version: "1.0.0"
  };
}

// Add a structure to the map
function addStructure(blocks: any, x: number, y: number, z: number, type: string) {
  if (type === 'house') {
    // Simple house
    for (let dx = 0; dx < 7; dx++) {
      for (let dz = 0; dz < 7; dz++) {
        for (let dy = 0; dy < 5; dy++) {
          if (dx === 0 || dx === 6 || dz === 0 || dz === 6 || dy === 0 || dy === 4) {
            blocks[`${x + dx},${y + dy},${z + dz}`] = 45; // brick
          }
        }
      }
    }
  } else if (type === 'tower') {
    // Tower
    for (let dy = 0; dy < 20; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
            blocks[`${x + dx},${y + dy},${z + dz}`] = 98; // stone brick
          }
        }
      }
    }
  }
}

// Usage
// const world = /* your Hytopia world instance */;
// fullPipelineExample(world);