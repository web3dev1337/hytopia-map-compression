# Hytopia Map Compression - Advanced Guide

This guide covers the advanced chunk loading system that achieves 97% performance improvement.

## Chunk Loading System

The plugin includes a powerful chunk loading system that bypasses Hytopia's public API for ultra-fast map loading.

### How DirectChunkLoaderV3 Works

Instead of using `world.setBlock()` (which is slow), the plugin directly manipulates Hytopia's internal `chunkLattice` structure:

```typescript
// Traditional approach (SLOW - 1800ms for 23k blocks)
for (const [coord, blockId] of Object.entries(blocks)) {
  const [x, y, z] = coord.split(',').map(Number);
  world.setBlock(x, y, z, blockId);
}

// DirectChunkLoaderV3 approach (FAST - 55ms for 23k blocks)
const chunk = {
  _blocks: typedBlockArray,
  _originCoordinate: origin,
  blocks: typedBlockArray,
  originCoordinate: origin,
  getBlockId: function(localCoord) {
    const index = localCoord.x + (localCoord.y << 4) + (localCoord.z << 8);
    return this._blocks[index];
  }
};
chunkLattice._chunks.set(chunkKey, chunk);
```

## Precomputing Chunks

For maximum performance, generate chunks at build time:

### Using the CLI Tool

```bash
# Install dependencies
cd hytopia-map-compression
npm install

# Generate JSON chunks (HyFire8 compatible format)
npm run precompute assets/map.json assets/map.chunks

# Generate binary chunks (custom ultra-fast format)
npm run precompute assets/map.json assets/map.bin -- --format=binary

# Verify the output
npm run precompute assets/map.json assets/map.chunks -- --verify
```

### Programmatic API

```typescript
import { PrecomputeChunks } from 'hytopia-map-compression/tools';

// Generate JSON chunks
await PrecomputeChunks.precomputeFromMapFile('map.json', 'map.chunks');

// Generate binary chunks
await PrecomputeChunks.createBinaryChunks('map.json', 'map.bin');

// Load precomputed chunks
const world = await PrecomputeChunks.loadPrecomputedChunks('map.chunks');
```

## Chunk Formats

### JSON Chunks Format
Compatible with HyFire8, uses Brotli compression:
```json
{
  "version": 1,
  "chunkSize": 16,
  "chunks": [
    {
      "origin": { "x": 0, "y": 0, "z": 0 },
      "blocks": [/* Uint8Array of 4096 blocks */]
    }
  ],
  "metadata": {
    "totalBlocks": 23867,
    "totalChunks": 32,
    "bounds": { /* min/max coordinates */ },
    "createdAt": "2024-01-01T00:00:00Z",
    "sourceHash": "a1b2c3d4"
  }
}
```

### Binary Chunks Format
Custom format optimized for speed:
```
[chunkX:i32][chunkZ:i32][block1.x:i32][block1.y:i32][block1.z:i32][block1.id:u16]...
```

## Integration Examples

### Basic Setup

```typescript
import { MapCompression } from 'hytopia-map-compression';

startServer(async world => {
  const mapCompressor = new MapCompression(world, {
    format: 'chunks',
    optimization: {
      precompute: true,
      enableChunking: true
    }
  });
  
  // This will use DirectChunkLoaderV3 internally
  await mapCompressor.loadCompressed('assets/map.chunks');
});
```

### Advanced Configuration

```typescript
const mapCompressor = new MapCompression(world, {
  format: 'binary',
  debug: false,
  metrics: true,
  optimization: {
    batchSize: 50000,
    enableChunking: true,
    precompute: true
  }
});

// Load binary chunks
await mapCompressor.loadCompressed('assets/map.bin');

// Get performance metrics
const metrics = mapCompressor.getMetrics();
console.log(`Loaded ${metrics.blocksLoaded} blocks in ${metrics.loadTimeMs}ms`);
```

## Performance Benchmarks

Testing with CS:GO Dust2 map (23,867 blocks):

| Method | Load Time | Details |
|--------|-----------|---------|
| world.setBlock() loop | 1847ms | Traditional approach |
| DirectChunkLoader (v1) | 600-1100ms | Batched setBlock calls |
| DirectChunkLoaderV3 | **55ms** | Direct chunkLattice manipulation |
| Binary Chunks | **40ms** | Optimized binary format |

### Breakdown of 55ms Load Time
- File read: 5ms
- Decompression: 12ms
- Chunk creation: 20ms
- ChunkLattice injection: 17ms
- Event emission: 1ms

## Troubleshooting

### Chunks Not Loading?

1. **Check Hytopia version**: Requires 0.6.0+
2. **Verify world.chunkLattice exists**:
```typescript
if (!world.chunkLattice) {
  console.error('ChunkLattice not available');
}
```

3. **Enable debug mode**:
```typescript
const mc = new MapCompression(world, { debug: true });
```

### Performance Not Improving?

1. **Ensure chunks are precomputed**: Check for `.chunks` or `.bin` files
2. **Verify DirectChunkLoaderV3 is used**: Look for `[DirectChunkLoaderV3]` in logs
3. **Check for other plugins**: Some plugins may interfere with chunk loading

### Memory Issues?

1. **Reduce batch size**:
```typescript
optimization: { batchSize: 10000 }
```

2. **Use binary format**: More memory efficient than JSON
3. **Load chunks progressively**: Split large maps into regions

## Internal Architecture

### Class Hierarchy
```
MapCompression
├── DirectChunkLoaderV3 (fast path)
├── DirectChunkLoader (fallback)
├── VarintCodec
├── DeltaEncoder
└── PrecomputeChunks (build tool)
```

### Loading Flow
```
loadCompressed()
├── Detect format (json/varint/chunks/binary)
├── If chunks: Use DirectChunkLoaderV3
│   ├── Parse chunk data
│   ├── Create chunk objects
│   └── Inject into chunkLattice
└── If compressed: Decompress then chunk load
```

## Contributing

When contributing chunk loading improvements:

1. **Benchmark before/after**: Use the included benchmark tools
2. **Test with large maps**: Ensure scalability
3. **Maintain compatibility**: Don't break existing formats
4. **Document internals**: Update this guide with changes

## Advanced Tips

### Conditional Chunk Loading
```typescript
// Only load chunks within view distance
const viewDistance = 5; // chunks
for (const chunk of chunks) {
  if (isWithinDistance(chunk, playerPos, viewDistance)) {
    loader.loadChunk(chunk);
  }
}
```

### Dynamic Chunk Generation
```typescript
// Generate chunks on-the-fly for procedural maps
const chunk = generateProceduralChunk(x, z);
loader.injectChunk(chunk);
```

### Chunk Streaming
```typescript
// Stream chunks from server
const stream = await fetch('/api/chunks/stream');
const reader = stream.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  loader.loadChunkFromBuffer(value);
}
```

## References

- HyFire8 implementation: Original chunk loading approach
- Hytopia SDK internals: ChunkLattice structure
- Minecraft chunk format: Inspiration for 16x16x16 chunks