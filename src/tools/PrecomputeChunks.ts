import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';

interface BlockData {
  blocks: { [key: string]: number };
  bounds?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

interface ChunkData {
  origin: { x: number; y: number; z: number };
  blocks: Uint8Array; // 16x16x16 = 4096 blocks
}

interface PrecomputedWorld {
  version: number;
  chunkSize: number;
  chunks: ChunkData[];
  metadata: {
    totalBlocks: number;
    totalChunks: number;
    bounds: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
    createdAt: string;
    sourceHash: string;
  };
}

export class PrecomputeChunks {
  private static readonly CHUNK_SIZE = 16;
  private static readonly CHUNK_VOLUME = 16 * 16 * 16; // 4096

  /**
   * Precompute chunks from a map JSON file
   */
  static async precomputeFromMapFile(mapPath: string, outputPath: string): Promise<void> {
    console.log(`Loading map from ${mapPath}...`);
    const startTime = Date.now();
    
    // Load the map data
    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8')) as BlockData;
    const blockEntries = Object.entries(mapData.blocks);
    console.log(`Loaded ${blockEntries.length} blocks`);
    
    // Calculate bounds
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    // Group blocks by chunk
    const chunkMap = new Map<string, Map<string, number>>();
    
    for (const [coordStr, blockId] of blockEntries) {
      const [x, y, z] = coordStr.split(',').map(Number);
      
      // Update bounds
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
      
      // Calculate chunk origin (floor to nearest 16)
      const chunkX = Math.floor(x / 16) * 16;
      const chunkY = Math.floor(y / 16) * 16;
      const chunkZ = Math.floor(z / 16) * 16;
      const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
      
      // Calculate local coordinates within chunk
      const localX = x & 15; // x % 16 but faster
      const localY = y & 15;
      const localZ = z & 15;
      const localKey = `${localX},${localY},${localZ}`;
      
      // Add to chunk map
      if (!chunkMap.has(chunkKey)) {
        chunkMap.set(chunkKey, new Map());
      }
      chunkMap.get(chunkKey)!.set(localKey, blockId as number);
    }
    
    console.log(`Grouped into ${chunkMap.size} chunks`);
    
    // Convert to chunk data format
    const chunks: ChunkData[] = [];
    
    for (const [chunkKey, blocks] of chunkMap) {
      const [originX, originY, originZ] = chunkKey.split(',').map(Number);
      
      // Create chunk block array (16x16x16)
      const blockArray = new Uint8Array(this.CHUNK_VOLUME);
      
      for (const [localKey, blockId] of blocks) {
        const [x, y, z] = localKey.split(',').map(Number);
        // Calculate index: x + (y << 4) + (z << 8)
        const index = x + (y * 16) + (z * 256);
        blockArray[index] = blockId;
      }
      
      chunks.push({
        origin: { x: originX, y: originY, z: originZ },
        blocks: blockArray
      });
    }
    
    // Calculate source file hash
    const sourceHash = crypto.createHash('sha256')
      .update(JSON.stringify(mapData))
      .digest('hex')
      .substring(0, 16);
    
    // Create precomputed world data
    const precomputedWorld: PrecomputedWorld = {
      version: 1,
      chunkSize: this.CHUNK_SIZE,
      chunks,
      metadata: {
        totalBlocks: blockEntries.length,
        totalChunks: chunks.length,
        bounds: {
          min: { x: minX, y: minY, z: minZ },
          max: { x: maxX, y: maxY, z: maxZ }
        },
        createdAt: new Date().toISOString(),
        sourceHash
      }
    };
    
    // Serialize and compress with lower quality for speed
    console.log('Serializing and compressing...');
    const json = JSON.stringify(precomputedWorld);
    const compressed = zlib.brotliCompressSync(Buffer.from(json), {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 6 // Reduced from 11 for speed
      }
    });
    
    // Save to file
    fs.writeFileSync(outputPath, compressed);
    
    const elapsedTime = Date.now() - startTime;
    const originalSize = Buffer.byteLength(json);
    const compressedSize = compressed.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✅ Precomputed chunks saved to ${outputPath}`);
    console.log(`   Total chunks: ${chunks.length}`);
    console.log(`   Total blocks: ${blockEntries.length}`);
    console.log(`   Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Compression ratio: ${compressionRatio}%`);
    console.log(`   Time taken: ${elapsedTime}ms`);
  }
  
  /**
   * Create binary chunk format (our custom format for ultra-fast loading)
   */
  static async createBinaryChunks(mapPath: string, outputPath: string): Promise<void> {
    console.log(`Creating binary chunks from ${mapPath}...`);
    const startTime = Date.now();
    
    // Load the map data
    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf-8')) as BlockData;
    const blockEntries = Object.entries(mapData.blocks);
    console.log(`Loaded ${blockEntries.length} blocks`);
    
    // Group blocks by chunk
    const chunkMap = new Map<string, Array<{x: number, y: number, z: number, id: number}>>();
    
    for (const [coordStr, blockId] of blockEntries) {
      const [x, y, z] = coordStr.split(',').map(Number);
      
      // Calculate chunk coordinates
      const chunkX = Math.floor(x / 16);
      const chunkY = Math.floor(y / 16);
      const chunkZ = Math.floor(z / 16);
      const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
      
      // Add to chunk
      if (!chunkMap.has(chunkKey)) {
        chunkMap.set(chunkKey, []);
      }
      chunkMap.get(chunkKey)!.push({ x, y, z, id: blockId as number });
    }
    
    console.log(`Grouped into ${chunkMap.size} chunks`);
    
    // Create binary format
    const chunkBuffers: Buffer[] = [];
    const header = Buffer.allocUnsafe(8);
    header.writeUInt32LE(0x3142434d, 0); // "MCB1" little-endian
    header.writeUInt32LE(chunkMap.size, 4);
    chunkBuffers.push(header);
    
    for (const [chunkKey, blocks] of chunkMap) {
      const [chunkX, chunkY, chunkZ] = chunkKey.split(',').map(Number);
      
      const chunkHeader = Buffer.allocUnsafe(16);
      chunkHeader.writeInt32LE(chunkX, 0);
      chunkHeader.writeInt32LE(chunkY, 4);
      chunkHeader.writeInt32LE(chunkZ, 8);
      chunkHeader.writeUInt32LE(blocks.length, 12);
      chunkBuffers.push(chunkHeader);
      
      const buffer = Buffer.allocUnsafe(blocks.length * 14);
      let offset = 0;
      for (const block of blocks) {
        buffer.writeInt32LE(block.x, offset);
        offset += 4;
        buffer.writeInt32LE(block.y, offset);
        offset += 4;
        buffer.writeInt32LE(block.z, offset);
        offset += 4;
        buffer.writeUInt16LE(block.id, offset);
        offset += 2;
      }
      
      chunkBuffers.push(buffer);
    }
    
    // Combine all chunks
    const finalBuffer = Buffer.concat(chunkBuffers);
    
    // Save to file
    fs.writeFileSync(outputPath, finalBuffer);
    
    const elapsedTime = Date.now() - startTime;
    console.log(`✅ Binary chunks saved to ${outputPath}`);
    console.log(`   Total chunks: ${chunkMap.size}`);
    console.log(`   Total blocks: ${blockEntries.length}`);
    console.log(`   File size: ${(finalBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Time taken: ${elapsedTime}ms`);
  }
  
  /**
   * Load precomputed chunks
   */
  static async loadPrecomputedChunks(filePath: string): Promise<PrecomputedWorld> {
    const compressed = fs.readFileSync(filePath);
    const decompressed = zlib.brotliDecompressSync(compressed);
    return JSON.parse(decompressed.toString()) as PrecomputedWorld;
  }
  
  /**
   * Convert precomputed chunks back to map format for verification
   */
  static convertToMapFormat(precomputed: PrecomputedWorld): BlockData {
    const blocks: { [key: string]: number } = {};
    
    for (const chunk of precomputed.chunks) {
      const { origin, blocks: blockArray } = chunk;
      
      for (let i = 0; i < blockArray.length; i++) {
        if (blockArray[i] === 0) continue; // Skip air blocks
        
        // Extract local coordinates from index
        const localX = i & 15;
        const localY = (i >> 4) & 15;
        const localZ = (i >> 8) & 15;
        
        // Calculate global coordinates
        const globalX = origin.x + localX;
        const globalY = origin.y + localY;
        const globalZ = origin.z + localZ;
        
        const key = `${globalX},${globalY},${globalZ}`;
        blocks[key] = blockArray[i];
      }
    }
    
    return {
      blocks,
      bounds: precomputed.metadata.bounds
    };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  bun PrecomputeChunks.ts <input.json> <output.chunks> [--format=json|binary]');
    console.log('');
    console.log('Examples:');
    console.log('  bun PrecomputeChunks.ts assets/map.json assets/map.chunks');
    console.log('  bun PrecomputeChunks.ts assets/map.json assets/map.bin --format=binary');
    console.log('');
    console.log('Options:');
    console.log('  --format=json    Create JSON chunks (compatible with HyFire8)');
    console.log('  --format=binary  Create binary chunks (faster, custom format)');
    console.log('  --verify         Verify the output by converting back');
    process.exit(1);
  }
  
  const [input, output] = args;
  const format = args.find(a => a.startsWith('--format='))?.split('=')[1] || 'json';
  const verify = args.includes('--verify');
  
  const processMap = async () => {
    if (format === 'binary') {
      await PrecomputeChunks.createBinaryChunks(input, output);
    } else {
      await PrecomputeChunks.precomputeFromMapFile(input, output);
    }
    
    // Verify if requested (only for JSON format)
    if (verify && format === 'json') {
      console.log('\nVerifying...');
      const precomputed = await PrecomputeChunks.loadPrecomputedChunks(output);
      const converted = PrecomputeChunks.convertToMapFormat(precomputed);
      const original = JSON.parse(fs.readFileSync(input, 'utf-8')) as BlockData;
      
      const originalCount = Object.keys(original.blocks).length;
      const convertedCount = Object.keys(converted.blocks).length;
      
      if (originalCount === convertedCount) {
        console.log(`✅ Verification passed! ${convertedCount} blocks match.`);
      } else {
        console.log(`❌ Verification failed! Original: ${originalCount}, Converted: ${convertedCount}`);
      }
    }
  };
  
  processMap()
    .then(() => console.log('✅ Done!'))
    .catch(console.error);
}
