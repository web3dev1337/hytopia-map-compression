# Hytopia Map Compression - System Catalog

## Overview

High-performance map compression plugin for Hytopia achieving 99.5% compression ratios with 50x faster loading. Zero-config design with automatic optimization and hash-based caching.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MapCompression (Facade)                          │
│                     src/core/MapCompression.ts:615                       │
│  - quickLoad() / autoLoad() / loadMap() / compress() / decompress()     │
└────────────────┬─────────────────────────────────────┬──────────────────┘
                 │                                     │
    ┌────────────▼────────────┐           ┌───────────▼────────────┐
    │     MapCompressor       │           │    MapDecompressor     │
    │ src/core/MapCompressor  │           │ src/core/MapDecompressor│
    │      .ts:167            │           │      .ts:225           │
    │ 3-stage compression     │           │ Reverse pipeline       │
    └────────────┬────────────┘           └───────────┬────────────┘
                 │                                     │
    ┌────────────▼─────────────────────────────────────▼────────────┐
    │                    Encoder Pipeline                            │
    │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐     │
    │  │DeltaEncoder │→ │VarintEncoder │→ │  BrotliWrapper    │     │
    │  │ encoders/   │  │  encoders/   │  │   encoders/       │     │
    │  │DeltaEncoder │  │VarintEncoder │  │  BrotliWrapper    │     │
    │  │  .ts:209    │  │   .ts:125    │  │     .ts:101       │     │
    │  └─────────────┘  └──────────────┘  └───────────────────┘     │
    └───────────────────────────────────────────────────────────────┘

    ┌───────────────────────────────────────────────────────────────┐
    │                   Optimization Layer                           │
    │  ┌─────────────────────────────────────────────────────────┐  │
    │  │                    FastLoader                            │  │
    │  │            src/optimization/FastLoader.ts:206            │  │
    │  │     Strategy selector: chunks / monkeypatch / hybrid     │  │
    │  └──────────────────────────┬──────────────────────────────┘  │
    │                              │                                 │
    │  ┌──────────────────────────┼──────────────────────────────┐  │
    │  │                          ▼                               │  │
    │  │  ┌───────────────┐ ┌───────────────┐ ┌────────────────┐ │  │
    │  │  │DirectChunk    │ │DirectChunk    │ │ MonkeyPatch    │ │  │
    │  │  │Loader (v1)    │ │LoaderV3       │ │ Loader         │ │  │
    │  │  │optimization/  │ │optimization/  │ │ optimization/  │ │  │
    │  │  │DirectChunk    │ │DirectChunk    │ │ MonkeyPatch    │ │  │
    │  │  │Loader.ts:284  │ │LoaderV3.ts:195│ │ Loader.ts:116  │ │  │
    │  │  └───────────────┘ └───────────────┘ └────────────────┘ │  │
    │  └─────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────┘
```

---

## Component Catalog

### 1. Core Components

#### MapCompression (Main API Facade)
**File:** `src/core/MapCompression.ts` (615 lines)

**Purpose:** Single entry point for all compression/decompression/loading operations

**Key Methods:**
| Method | Description | Return Type |
|--------|-------------|-------------|
| `quickLoad(world, mapPath?)` | Static zero-config loading | `Promise<MapCompression>` |
| `autoLoad(mapPath?, configPath?)` | Smart loading with caching | `Promise<void>` |
| `compress(mapData)` | Compress map data | `Promise<CompressionResult>` |
| `decompress(compressedData)` | Decompress map data | `Promise<DecompressionResult>` |
| `loadMap(data)` | Load with optimizations | `Promise<void>` |
| `getMetrics()` | Get performance stats | `PerformanceMetrics` |
| `cleanup()` | Release resources | `void` |

**Auto-Loading Strategy (lines 312-543):**
```
1. Calculate MD5 hash of map file (8 chars)
2. Check for .chunks.bin → DirectChunkLoaderV3 (fastest, 50x)
3. Check for .compressed.json → FastLoader (fast, 10x)
4. Fallback: compress original, create both caches
5. Clean up old cache files with different hashes
```

**Cache File Naming:**
- Compressed: `{basename}.{hash}.{version}.compressed.json`
- Chunks: `{basename}.{hash}.{version}.chunks.bin`

---

#### MapCompressor
**File:** `src/core/MapCompressor.ts` (167 lines)

**Purpose:** 3-stage compression pipeline achieving 99.5% ratio

**Compression Pipeline:**
```
Input (blocks object)
    │
    ▼
1. Calculate Bounds    ─────→ minX, minY, minZ, maxX, maxY, maxZ
    │
    ▼
2. Sort Spatially      ─────→ Y, then X, then Z (locality)
    │
    ▼
3. Shift to Positive   ─────→ Subtract min bounds
    │
    ▼
4. Delta Encode        ─────→ Store differences, not absolutes
    │
    ▼
5. Zigzag + Varint     ─────→ Small numbers = fewer bytes
    │
    ▼
6. Brotli Compress     ─────→ Quality level 9 (maximum)
    │
    ▼
7. Base64 Encode       ─────→ Safe for JSON storage
```

**Key Algorithm (line 30-112):**
- Zigzag encoding: `(value << 1) ^ (value >> 31)`
- Varint: continuation bit 0x80, 7 data bits per byte
- Block format: 4-byte header (block count) + deltas

---

#### MapDecompressor
**File:** `src/core/MapDecompressor.ts` (225 lines)

**Purpose:** Reverse pipeline with ~20ms decompression for 6.5M blocks

**Decompression Modes:**
| Mode | Condition | Method |
|------|-----------|--------|
| Full | `useDelta && useVarint` | `decodeVarintDelta()` |
| Delta Only | `useDelta && !useVarint` | `decodeDeltaOnly()` |
| Direct | else | `decodeDirect()` |

**Fast Decoder (lines 131-186):**
- Inline varint reading (no function calls)
- String pooling for coordinate keys (up to 100K entries)
- Pre-allocated result object

---

### 2. Encoders

#### DeltaEncoder
**File:** `src/encoders/DeltaEncoder.ts` (209 lines)

**Algorithm:**
```
Sorted blocks: [pos1, pos2, pos3, ...]
Deltas:        [pos1, pos2-pos1, pos3-pos2, ...]
```

**Why Effective:** Voxel maps have spatial locality. Adjacent blocks have small coordinate differences (often 0, 1, or -1).

**Methods:**
| Method | Purpose |
|--------|---------|
| `encodePositions(blocks)` | Sort spatially, compute deltas |
| `decodePositions(deltas, blockIds, bounds?)` | Reconstruct absolute positions |
| `encodeBlockIds(ids)` | RLE for repeated IDs |
| `decodeBlockIds(encoded, isRLE)` | Expand RLE |

---

#### VarintEncoder
**File:** `src/encoders/VarintEncoder.ts` (125 lines)

**Byte Usage:**
| Value Range | Bytes Used |
|-------------|------------|
| 0-127 | 1 |
| 128-16383 | 2 |
| 16384-2097151 | 3 |
| 2097152-268435455 | 4 |
| 268435456+ | 5 |

**Key Methods:**
| Method | Purpose |
|--------|---------|
| `encodeZigzag(value)` | Convert signed to unsigned |
| `decodeZigzag(value)` | Convert unsigned to signed |
| `writeVarint(buffer, offset, value)` | Write to buffer |
| `readVarintFast(buffer, offset)` | Optimized inline reading |

---

#### BrotliWrapper
**File:** `src/encoders/BrotliWrapper.ts` (101 lines)

**Configuration:**
- Mode: `BROTLI_MODE_GENERIC`
- Quality: 9 (maximum, default)
- Size Hint: Input buffer length

**Methods:**
| Method | Purpose |
|--------|---------|
| `compress(data, options?)` | Brotli/Gzip/None |
| `decompress(data, algorithm)` | Reverse compression |
| `compressToBase64(data, options?)` | Compress + encode |
| `decompressFromBase64(base64, algorithm)` | Decode + decompress |

---

### 3. Optimization Loaders

#### FastLoader
**File:** `src/optimization/FastLoader.ts` (206 lines)

**Strategy Selection (lines 103-118):**
| Block Count | Strategy |
|-------------|----------|
| >1,000,000 | `chunks` |
| >100,000 | `hybrid` |
| <100,000 | `monkeypatch` |

**Methods:**
| Method | Purpose |
|--------|---------|
| `load(mapData)` | Auto-select and apply strategy |
| `prewarm()` | Initialize optimizations |
| `cleanup()` | Remove patches |

---

#### DirectChunkLoader (v1)
**File:** `src/optimization/DirectChunkLoader.ts` (284 lines)

**Purpose:** Batched chunk loading with setBlock fallback

**Binary Chunk Format:**
```
┌─────────────────────────────────────────┐
│ Chunk Header (8 bytes)                  │
│  ├─ chunkX (int32 LE)                   │
│  └─ chunkZ (int32 LE)                   │
├─────────────────────────────────────────┤
│ Block Data (14 bytes each)              │
│  ├─ x (int32 LE)                        │
│  ├─ y (int32 LE)                        │
│  ├─ z (int32 LE)                        │
│  └─ id (uint16 LE)                      │
└─────────────────────────────────────────┘
```

---

#### DirectChunkLoaderV3
**File:** `src/optimization/DirectChunkLoaderV3.ts` (195 lines)

**Purpose:** HyFire8-style direct chunkLattice manipulation (fastest)

**How It Works (lines 17-116):**
1. Access `world.chunkLattice` directly
2. Clear existing chunks
3. Create chunk objects with `_blocks` Uint8Array (4096 bytes)
4. Set blocks via index: `x + (y << 4) + (z << 8)`
5. Add to `chunkLattice._chunks` Map
6. Emit `CHUNK_LATTICE.ADD_CHUNK` events

**Performance:** 50x faster than standard loading (bypasses decompression entirely)

---

#### MonkeyPatchLoader
**File:** `src/optimization/MonkeyPatchLoader.ts` (116 lines)

**Purpose:** Runtime patching of `world.loadMap()` for transparent compressed map support

**Patch Behavior:**
1. Store original `world.loadMap`
2. Replace with function that:
   - Detects compressed format (has `version`, `algorithm`, `data`, `bounds`)
   - Decompresses if needed
   - Calls original with decompressed data

---

### 4. Utilities

#### ConfigLoader
**File:** `src/utils/ConfigLoader.ts`

**Config Locations (in order):**
1. Explicit `configPath` parameter
2. `./assets/config/map-compression.yaml`
3. Built-in defaults

---

#### DetailedBenchmark
**File:** `src/utils/DetailedBenchmark.ts`

**Tracked Steps:**
- Config Loading
- File Read
- Hash Calculation
- Chunks Cache Read
- Chunk Loading
- Compressed Cache Read
- Fast Loading
- Cache Write

---

## Type Definitions

**File:** `src/types/index.ts` (135 lines)

### MapCompressionOptions
```typescript
{
  features?: {
    compression?: boolean;
    decompression?: boolean;
    fastLoading?: boolean;
    monkeyPatching?: boolean;
  };
  compression?: {
    algorithm?: 'brotli' | 'gzip' | 'none';
    level?: number;              // 1-9
    useDelta?: boolean;
    useVarint?: boolean;
  };
  optimization?: {
    enabled?: boolean;
    monkeyPatch?: boolean;
    useChunks?: boolean;
    batchSize?: number;          // Default: 10000
  };
  loading?: {
    method?: 'default' | 'chunks' | 'monkeypatch' | 'hybrid';
    batchSize?: number;
  };
  autoLoad?: {
    compressionOnly?: boolean;   // Simple mode
  };
  debug?: boolean;
  simple?: boolean;              // Compression only, no optimizations
}
```

### CompressionResult
```typescript
{
  data: Buffer | string;         // Base64 compressed
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;    // 0.995 = 99.5%
    blockCount: number;
    compressionTime: number;
  };
  blockTypes: { [key: string]: number };
  bounds: { minX, minY, minZ, maxX, maxY, maxZ };
  version: string;
}
```

### CompressedMapData (on-disk format)
```typescript
{
  version: string;
  algorithm: string;
  data: string;                  // Base64
  blockTypes: any;
  bounds: { minX, minY, minZ, maxX, maxY, maxZ };
  entities?: any;
  metadata?: {...};
  options?: {
    useDelta?: boolean;
    useVarint?: boolean;
  };
  sourceHash?: string;           // MD5 of original file
}
```

---

## File Structure

```
src/
├── index.ts                     # Exports
├── core/
│   ├── MapCompression.ts        # Main API (615 lines)
│   ├── MapCompressor.ts         # Compression (167 lines)
│   ├── MapCompressorFixed.ts    # Test implementation
│   └── MapDecompressor.ts       # Decompression (225 lines)
├── encoders/
│   ├── BrotliWrapper.ts         # Brotli/Gzip (101 lines)
│   ├── DeltaEncoder.ts          # Delta encoding (209 lines)
│   └── VarintEncoder.ts         # Varint encoding (125 lines)
├── optimization/
│   ├── DirectChunkLoader.ts     # Batch loading (284 lines)
│   ├── DirectChunkLoaderV3.ts   # Direct lattice (195 lines)
│   ├── FastLoader.ts            # Strategy selector (206 lines)
│   └── MonkeyPatchLoader.ts     # SDK patching (116 lines)
├── types/
│   └── index.ts                 # Type definitions (135 lines)
├── utils/
│   ├── ConfigLoader.ts          # YAML config
│   └── DetailedBenchmark.ts     # Performance tracking
└── tools/
    └── PrecomputeChunks.ts      # CLI chunk generator

Test Files:
├── test-integrity.ts            # Compression integrity
├── test-pipeline.ts             # Full pipeline
├── test-final-speed.ts          # Performance
├── test-hyfire8-exact.ts        # HyFire8 compatibility
├── benchmark-real-map.ts        # Real-world perf
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Compression Ratio | 99.5% (131MB → 638KB) |
| First Load | ~2s (creates caches) |
| Cached Load | ~40ms (from chunks) |
| Block Support | 6.5M+ blocks |
| Memory Peak | 180MB (vs 2.1GB without) |

---

## Usage Summary

### Zero-Config
```javascript
await MapCompression.quickLoad(world);
```

### With Options
```javascript
const mc = new MapCompression(world, {
  debug: true,
  compression: { level: 9 },
  optimization: { useChunks: true }
});
await mc.autoLoad('./assets/map.json');
console.log(mc.getMetrics());
```

### Simple Mode (No Optimizations)
```javascript
const mc = new MapCompression(world, { simple: true });
const compressed = await mc.compress(mapData);
const decompressed = await mc.decompress(compressed);
```

---

*Generated: 2026-01-04*
*Total Source Lines: ~2,400*
