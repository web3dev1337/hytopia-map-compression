# Hytopia Map Compression Codebase Documentation

## Quick Navigation
ENTRY:    src/index.ts, src/core/MapCompression.ts - Main API entry points
CORE:     src/core/*.ts - Compression/decompression core systems  
ENCODERS: src/encoders/*.ts - Encoding algorithms (Delta, Varint, Brotli)
LOADERS:  src/optimization/*.ts - Fast loading strategies
CONFIG:   assets/config/*.yaml - Configuration files
TESTS:    test-*.ts, benchmark-*.ts - Test and benchmark files
TOOLS:    src/tools/*.ts - Utility tools (PrecomputeChunks)

## Core Systems

### MapCompression (Main API)
src/core/MapCompression.ts - Main plugin API class
├─ Manages: Complete compression/decompression pipeline
├─ Methods: quickLoad(), compress(), decompress(), loadMap(), autoLoad()
├─ Pattern: Facade pattern with strategy selection
└─ Features: Auto-optimization, hash-based caching, metrics collection

### MapCompressor
src/core/MapCompressor.ts - Compression pipeline implementation
├─ Manages: 3-stage compression (Delta → Varint → Brotli)
├─ Methods: compress(), sortBlocks(), calculateDeltas()
├─ Pattern: Pipeline pattern with configurable stages
└─ Output: Base64-encoded compressed data with metadata

### MapCompressorFixed
src/core/MapCompressorFixed.ts - Fixed/improved compression implementation
├─ Manages: Bug fixes and optimizations for compression
├─ Methods: Same as MapCompressor with critical fixes
└─ Status: Test implementation (not yet integrated)

### MapDecompressor
src/core/MapDecompressor.ts - Decompression pipeline
├─ Manages: Reverse pipeline (Brotli → Varint → Delta)
├─ Methods: decompress(), rebuildPositions()
├─ Pattern: Inverse pipeline pattern
└─ Features: Streaming decompression, error recovery

## Encoding Systems

### DeltaEncoder
src/encoders/DeltaEncoder.ts - Delta encoding/decoding
├─ Manages: Position difference encoding
├─ Methods: encode(), decode()
└─ Algorithm: Stores deltas instead of absolute positions

### VarintEncoder
src/encoders/VarintEncoder.ts - Variable-length integer encoding
├─ Manages: Efficient small number encoding
├─ Methods: encode(), decode(), encodeValue(), decodeValue()
└─ Algorithm: 1-5 bytes per integer based on value size

### BrotliWrapper
src/encoders/BrotliWrapper.ts - Brotli compression wrapper
├─ Manages: Final compression stage
├─ Methods: compress(), decompress()
└─ Features: Quality level configuration, async operations

## Optimization Systems

### FastLoader
src/optimization/FastLoader.ts - Optimized map loading
├─ Manages: Batched block loading with optimizations
├─ Methods: loadCompressed(), loadUncompressed()
├─ Pattern: Batch processing with configurable size
└─ Features: Progress tracking, memory management

### DirectChunkLoader
src/optimization/DirectChunkLoader.ts - Direct binary chunk loading
├─ Manages: Pre-computed chunk loading (v1)
├─ Methods: loadFromChunks(), hasPrecomputedChunks()
└─ Performance: 10x faster than decompression

### DirectChunkLoaderV3
src/optimization/DirectChunkLoaderV3.ts - HyFire8-style chunk loading
├─ Manages: Ultra-fast direct chunk loading (v3)
├─ Methods: loadFromChunks(), registerBlockTypes()
├─ Pattern: Direct lattice manipulation
└─ Performance: 50x faster than standard loading

### MonkeyPatchLoader
src/optimization/MonkeyPatchLoader.ts - Runtime optimization patches
├─ Manages: Monkey-patching Hytopia internals
├─ Methods: patch(), unpatch()
└─ Features: Optional performance enhancement

## Utility Systems

### ConfigLoader
src/utils/ConfigLoader.ts - Configuration management
├─ Manages: YAML config loading and merging
├─ Methods: loadConfig(), mergeConfig()
├─ Convention: Looks for assets/config/map-compression.yaml
└─ Features: Deep merging, environment variables

### DetailedBenchmark
src/utils/DetailedBenchmark.ts - Performance benchmarking
├─ Manages: Detailed performance metrics
├─ Methods: start(), end(), report()
└─ Metrics: Time, memory, compression ratios

### PrecomputeChunks
src/tools/PrecomputeChunks.ts - Chunk pre-computation tool
├─ Manages: Generating optimized chunk files
├─ Methods: precompute(), saveChunks()
├─ Usage: bun src/tools/PrecomputeChunks.ts
└─ Output: Binary .chunks.bin files

## Type Definitions

### Core Types (src/types/index.ts)
- `MapData`: Raw map data structure
- `CompressedMapData`: Compressed map with metadata
- `CompressionResult`: Compression operation result
- `DecompressionResult`: Decompression operation result
- `MapCompressionOptions`: Configuration options
- `PerformanceMetrics`: Performance statistics

## Configuration

### Default Config
assets/config/default.yaml - Built-in defaults
├─ Compression settings
├─ Optimization flags
└─ Performance limits

### Example Config
assets/config/map-compression.yaml.example - User config template
├─ All available options
├─ Documentation comments
└─ Common presets

## Test Files

### Integration Tests
- test-integrity.ts - Compression/decompression integrity
- test-pipeline.ts - Full pipeline testing
- test-final-speed.ts - Performance benchmarking
- test-hyfire8-exact.ts - HyFire8 compatibility test
- test-debug.ts - Debug and troubleshooting

### Benchmarks
- benchmark-real-map.ts - Real-world map performance

## Examples

### Basic Usage
examples/simple-usage.js - JavaScript basic example
examples/basic-compression.ts - TypeScript compression

### Advanced Usage
examples/full-pipeline.ts - Complete pipeline example
examples/fast-loading.ts - Optimized loading strategies

## File Conventions
- Maps expected in: ./assets/map.json (default)
- Cache files: ./<mapname>.<sha256-16>.<version>.compressed.json
- Chunk files: ./<mapname>.<sha256-16>.<version>.chunks.bin (binary) or .chunks (Brotli JSON)
- Config: ./assets/config/map-compression.yaml

## Workflow
```bash
# Development
npm run dev          # Watch mode
npm run lint         # Check style
npm test            # Run tests

# Production
npm run build       # Build dist/
bun src/tools/PrecomputeChunks.ts  # Generate chunks

# Testing
bun test-integrity.ts     # Verify compression
bun benchmark-real-map.ts # Performance test
```

## Architecture Patterns

### Compression Pipeline
```
Map Data → Sort → Delta Encode → Varint Encode → Brotli → Base64
```

### Loading Strategy Selection
```
1. Check for .chunks.bin → Use DirectChunkLoaderV3 (fastest)
2. Check for .compressed.json → Use FastLoader (fast)
3. Fallback to raw .json → Compress first, then load
```

### Cache Management
```
Map File → SHA-256 Hash → Cache Key
├─ Hit: Load cached files
└─ Miss: Generate new cache, cleanup old files
```
