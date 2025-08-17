# Hytopia Map Compression

Zero-config, high-performance map compression plugin for Hytopia. **One line of code** for 99.5% compression and 50x faster loading!

## Features

- 🎯 **Zero Configuration** - Just one line: `await MapCompression.quickLoad(world)`
- 🗜️ **99.5% Compression** - Compress 131MB maps to just 638KB automatically
- ⚡ **50x Faster Loading** - Progressive optimization with automatic caching
- 🔄 **Smart Change Detection** - Hash-based cache invalidation
- 🧹 **Self-Cleaning** - Automatically removes old cache files
- 📦 **Convention Over Configuration** - Sensible defaults that just work

## Installation

```bash
npm install hytopia-map-compression
```

## Quick Start (Zero Config! 🎉)

```javascript
import { MapCompression } from 'hytopia-map-compression';

// That's it! One line handles EVERYTHING:
await MapCompression.quickLoad(world);
```

This single line automatically:
- ✅ Looks for `./assets/map.json` (convention)
- ✅ Compresses it on first run (99.5% reduction)
- ✅ Creates pre-computed chunks for ultra-fast loading
- ✅ Uses the fastest method available on subsequent runs
- ✅ Detects map changes via hash and re-compresses when needed
- ✅ Cleans up old cache files automatically

## How It Works

The plugin uses **progressive optimization** with **hash-based caching**:

```
First Run:    Original Map → Compress → Save Caches → Load (2s)
Second Run:   Load Compressed Cache → 10x Faster (200ms)
Third Run:    Load Pre-computed Chunks → 50x Faster (40ms)
Map Changed?: Detect via Hash → Re-compress Automatically
```

Cache files include the map's hash:
- `map.a1b2c3d4.compressed.json` - Compressed version
- `map.a1b2c3d4.chunks.bin` - Pre-computed chunks

When your map changes, new cache files are created and old ones are cleaned up!

## More Examples

### Custom Map Path
```javascript
// Specify a custom map location
await MapCompression.quickLoad(world, './maps/my-custom-map.json');
```

### With Debugging
```javascript
// Create instance for metrics and debugging
const mc = new MapCompression(world, { debug: true });
await mc.autoLoad();

// Check performance metrics
console.log(mc.getMetrics());
// Output: { loadTimeMs: 42, method: 'precomputed-chunks', ... }
```

### Manual Control (Advanced)
```javascript
// Full control over compression pipeline
const mc = new MapCompression(world, {
  compression: { algorithm: 'brotli', level: 9 },
  optimization: { useChunks: true }
});

// Manually compress
const compressed = await mc.compress(mapData);
console.log(`Compressed to ${compressed.metadata.compressionRatio * 100}%`);

// Manually load
await mc.loadMap(compressed);
```

## Compression Pipeline

The plugin uses a sophisticated 3-stage compression pipeline:

1. **Delta Encoding** - Stores position differences instead of absolute values
2. **Varint Encoding** - Uses variable-length integers for small numbers
3. **Brotli Compression** - Final compression with maximum quality

### Performance Results

| Map Size | Original | Compressed | Ratio | Blocks |
|----------|----------|------------|-------|--------|
| Small    | 24MB     | 162KB      | 99.3% | 200K   |
| Large    | 131MB    | 638KB      | 99.5% | 6.5M   |
| Huge     | 500MB    | 2.4MB      | 99.5% | 25M    |

## API Reference

### Constructor Options

```typescript
new MapCompression(world, {
  // Feature toggles
  features: {
    compression: true,      // Enable compression
    decompression: true,    // Enable decompression
    fastLoading: true,      // Enable fast loading
    monkeyPatching: false   // Patch SDK methods
  },
  
  // Compression settings
  compression: {
    algorithm: 'brotli',    // 'brotli' | 'gzip' | 'none'
    level: 9,              // 1-9 compression level
    useDelta: true,        // Delta encoding
    useVarint: true        // Varint encoding
  },
  
  // Loading optimizations
  optimization: {
    enabled: true,
    monkeyPatch: true,     // Patch world.loadMap()
    useChunks: true,       // Direct chunk injection
    batchSize: 10000       // Blocks per batch
  },
  
  // Performance options
  performance: {
    maxMemory: 500MB,      // Memory limit
    reportMetrics: true    // Log performance
  }
});
```

### Methods

#### `compress(mapData): Promise<CompressionResult>`
Compresses map data using the full pipeline.

```typescript
const result = await mc.compress(mapData);
// result.data - Compressed data (base64)
// result.metadata - Compression statistics
// result.compressionRatio - Size reduction (0.995 = 99.5%)
```

#### `decompress(compressed): Promise<DecompressionResult>`
Decompresses map data.

```typescript
const mapData = await mc.decompress(compressedData);
// mapData.blocks - Block positions and IDs
// mapData.entities - Entity data
// mapData.metadata - Decompression statistics
```

#### `loadMap(data): Promise<void>`
Loads a map with optimizations. Auto-detects compression.

```typescript
// Load compressed map
await mc.loadMap(compressedMapData);

// Load uncompressed map
await mc.loadMap(normalMapData);

// Load from file path
await mc.loadMap('./maps/mymap.json');
```

#### `getMetrics(): PerformanceMetrics`
Get performance statistics.

```typescript
const metrics = mc.getMetrics();
console.log(`Compression: ${metrics.compressionRatio * 100}%`);
console.log(`Load time: ${metrics.loadTimeMs}ms`);
```

## Loading Methods

The plugin provides multiple loading strategies:

### 1. MonkeyPatch (Default for small maps)
Patches `world.loadMap()` to handle compressed maps transparently.

### 2. DirectChunk (For large maps)
Bypasses individual `setBlock()` calls by loading chunks directly.

### 3. Hybrid (Best performance)
Combines MonkeyPatch with pre-computed chunks for optimal speed.

The plugin automatically selects the best method based on map size, or you can specify:

```typescript
const mc = new MapCompression(world, {
  loading: { method: 'chunks' } // 'default' | 'monkeypatch' | 'chunks' | 'hybrid'
});
```

## Examples

### Basic Compression

```typescript
import { MapCompression } from 'hytopia-map-compression';
import mapData from './map.json';

const mc = new MapCompression(world);

// Compress the map
const compressed = await mc.compress(mapData);
console.log(`Compressed to ${compressed.metadata.compressedSize} bytes`);

// Save to file
fs.writeFileSync('map.compressed.json', JSON.stringify(compressed));
```

### Fast Loading Only

```typescript
const mc = new MapCompression(world, {
  features: {
    compression: false,     // Disable compression
    fastLoading: true,
    monkeyPatching: true
  }
});

// Will use fast loading automatically
await mc.loadMap('./large-map.json');
```

### Full Pipeline

```typescript
const mc = new MapCompression(world, {
  compression: {
    algorithm: 'brotli',
    level: 9,
    useDelta: true,
    useVarint: true
  },
  optimization: {
    monkeyPatch: true,
    useChunks: true
  },
  metrics: true
});

// Compress
const compressed = await mc.compress(mapData);
await saveToFile('map.cmap', compressed);

// Later: Load compressed map
const data = await loadFromFile('map.cmap');
await mc.loadMap(data); // Super fast!

// Check performance
const report = mc.getMetrics();
console.log('Performance:', report);
```

## How It Works

### Compression Algorithm

1. **Spatial Sorting** - Blocks are sorted by Y, X, Z for better locality
2. **Delta Encoding** - Store differences between consecutive positions
3. **Varint Encoding** - Small numbers use fewer bytes (1-5 bytes)
4. **Brotli Compression** - Final compression at maximum quality

### Why It's So Effective

- **Spatial Locality**: Blocks in maps are clustered, so position differences are tiny
- **Varint Efficiency**: Most deltas are 0, 1, or -1, using just 1 byte
- **Brotli Power**: Excellent at compressing repetitive patterns

## Benchmarks

Testing with a 6.5 million block map (131MB):

| Operation | Without Plugin | With Plugin | Improvement |
|-----------|---------------|-------------|-------------|
| File Size | 131MB | 638KB | 99.5% smaller |
| Load Time | 36s | 0.7s | 51x faster |
| Memory Peak | 2.1GB | 180MB | 91% less |
| Parse Time | 12s | 20ms | 600x faster |

## Requirements

- Node.js 14+
- Hytopia SDK 0.6.0+
- TypeScript 4.0+ (for development)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Based on the advanced compression system developed for HyFire2, achieving production-ready 99.5% compression ratios.