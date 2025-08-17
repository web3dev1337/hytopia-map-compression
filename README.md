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

The plugin uses **automatic optimization** with **hash-based caching**:

```
First Run:    Original Map → Create BOTH Caches → Load (2s)
              ├─ map.<hash>.compressed.json (99.5% smaller)
              └─ map.<hash>.chunks.bin (pre-computed for ultra-fast loading)

Next Runs:    Load from Chunks → 50x Faster (40ms) ⚡

Map Changed?: New Hash → Create New Caches → Auto-cleanup Old Files
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

### Configuration (Optional)

The plugin works perfectly with zero configuration, but you can customize it:

**Option 1: Convention-based config** (Recommended)
Create `assets/config/map-compression.yaml` and it will be loaded automatically:

```yaml
# Example: Enable debug logging
logging:
  enabled: true
```

**Option 2: Code-based config**
```javascript
new MapCompression(world, {
  debug: true,
  metrics: true
});
```

See `assets/config/map-compression.yaml.example` for all options.

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

## Under the Hood

The plugin uses intelligent loading strategies that are **automatically selected**:

- **Pre-computed Chunks**: Direct binary loading, bypasses decompression entirely (50x faster)
- **Compressed Loading**: Fast decompression with optimizations (10x faster)
- **Automatic Fallback**: Regenerates missing cache files seamlessly

All of this happens automatically with `quickLoad()` - you don't need to configure anything!

## Examples Beyond QuickLoad

While `quickLoad()` handles everything automatically, you can also use the plugin manually:

### Manual Compression

```javascript
const mc = new MapCompression(world);

// Compress a map
const compressed = await mc.compress(mapData);
console.log(`Compressed to ${compressed.metadata.compressionRatio * 100}% of original`);

// Save compressed data
fs.writeFileSync('my-map.compressed.json', JSON.stringify(compressed));
```

### Manual Loading

```javascript
const mc = new MapCompression(world);

// Load any map (auto-detects if compressed)
await mc.loadMap(mapData);

// Get performance metrics
const metrics = mc.getMetrics();
console.log(`Loaded in ${metrics.loadTimeMs}ms`);
```

### Simple Mode (Compression Only)

If you only want compression/decompression without any loading optimizations:

```javascript
// Simple mode - no chunks, no optimizations, just compression
const mc = new MapCompression(world, { simple: true });

// Or via config:
const mc = new MapCompression(world, {
  autoLoad: { compressionOnly: true }
});

// Compress and decompress as normal
const compressed = await mc.compress(mapData);
const decompressed = await mc.decompress(compressed);
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