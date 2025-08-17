# Hytopia Map Compression Plugin - Implementation Plan

## Overview
Converting the HyFire2-work8 map compression system (99.5% compression, 50x faster loading) into a reusable NPM plugin for Hytopia.

## Architecture: Single Unified Plugin
```
hytopia-map-compression/
├── src/
│   ├── index.ts                  # Main exports
│   ├── core/
│   │   ├── MapCompression.ts     # Main API class
│   │   ├── MapCompressor.ts      # Compression engine
│   │   └── MapDecompressor.ts    # Decompression engine
│   ├── optimization/
│   │   ├── MonkeyPatchLoader.ts  # SDK monkey patching
│   │   ├── DirectChunkLoader.ts  # Direct chunk injection
│   │   └── FastLoader.ts         # Combined optimizations
│   ├── encoders/
│   │   ├── VarintEncoder.ts      # Varint encoding/decoding
│   │   ├── DeltaEncoder.ts       # Delta encoding/decoding
│   │   └── BrotliWrapper.ts      # Brotli compression wrapper
│   └── types/
│       └── index.ts              # TypeScript definitions
├── examples/
│   ├── basic-compression.ts
│   ├── fast-loading.ts
│   └── full-pipeline.ts
├── tests/
│   └── compression.test.ts
└── README.md
```

## Core Features (from HyFire2-work8)

### 1. Compression Pipeline (99.5% reduction)
- **Varint Encoding**: Variable-length integers for small numbers
- **Delta Encoding**: Store differences between consecutive positions
- **Brotli Compression**: Maximum quality setting for final compression
- **Result**: 131MB → 638KB (tested with 6.5M blocks)

### 2. Fast Loading Optimizations (50x faster)
- **MonkeyPatch SDK**: Override world.loadMap() for optimized loading
- **Direct Chunk Injection**: Bypass individual setBlock calls
- **Pre-computed Chunks**: Load pre-processed chunk data
- **Result**: 36s → 0.7s load time

### 3. Data Preservation
- Preserves ALL map data (blocks, entities, metadata)
- Perfect lossless compression/decompression
- Hash-based verification for integrity

## API Design

```typescript
import { MapCompression } from 'hytopia-map-compression';

// Initialize with options
const mc = new MapCompression(world, {
  compression: {
    enabled: true,
    algorithm: 'brotli',
    level: 9,
    useDelta: true,
    useVarint: true
  },
  optimization: {
    enabled: true,
    monkeyPatch: true,
    useChunks: true,
    batchSize: 10000
  },
  performance: {
    maxMemory: 500 * 1024 * 1024,
    reportMetrics: true
  }
});

// Compress
const compressed = await mc.compress(mapData);

// Decompress
const decompressed = await mc.decompress(compressed);

// Fast load
await mc.loadMap(compressedOrUncompressed);

// Metrics
const metrics = mc.getMetrics();
```

## Implementation Steps

### Phase 1: Core Compression (CURRENT)
1. ✅ Create project structure
2. ⏳ Port VarintEncoder from HyFire2-work8
3. ⏳ Port DeltaEncoder
4. ⏳ Port BrotliWrapper
5. ⏳ Implement MapCompressor class
6. ⏳ Implement MapDecompressor class

### Phase 2: Optimization Strategies
1. Port MonkeyPatchLoader
2. Port DirectChunkLoader
3. Implement FastLoader (combines strategies)
4. Add pre-computed chunk support

### Phase 3: Main API
1. Create MapCompression main class
2. Add options handling
3. Implement performance metrics
4. Add auto-detection for compressed maps

### Phase 4: Testing & Documentation
1. Port test cases from HyFire2-work8
2. Create examples
3. Write comprehensive README
4. Add JSDoc comments

### Phase 5: Polish & Publish
1. Add error handling
2. Optimize performance
3. Create npm package
4. Publish to NPM

## Performance Targets (matching HyFire2-work8)
- Compression ratio: 99.5% (131MB → 638KB)
- Decompression time: ~20ms for 6.5M blocks
- Load time improvement: 50x faster (36s → 0.7s)
- Memory efficiency: Reduced during loading

## Dependencies
- Node.js built-in zlib (for Brotli)
- Hytopia SDK (peer dependency)
- TypeScript (dev dependency)

## Success Criteria
- ✅ Achieves same compression ratio as HyFire2-work8
- ✅ Maintains perfect lossless compression
- ✅ Works as drop-in replacement for world.loadMap()
- ✅ Easy to use API
- ✅ Well documented
- ✅ Published to NPM