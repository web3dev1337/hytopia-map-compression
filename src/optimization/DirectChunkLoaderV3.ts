/**
 * DirectChunkLoaderV3 - Exactly like HyFire8's implementation
 * Directly manipulates chunkLattice instead of using setBlock
 */
export class DirectChunkLoaderV3 {
  private world: any;
  private options: any;
  
  constructor(world: any, options: any = {}) {
    this.world = world;
    this.options = options;
  }
  
  /**
   * Load precomputed chunks directly into chunkLattice (HyFire8 style)
   */
  loadDirectly(chunksData: any): void {
    const startTime = Date.now();
    console.log(`[DirectChunkLoaderV3] Loading precomputed chunks...`);
    
    const chunkLattice = this.world.chunkLattice;
    if (!chunkLattice) {
      throw new Error('World does not have chunkLattice');
    }
    
    // Clear existing
    if (chunkLattice.clear) {
      chunkLattice.clear();
    }
    
    // Initialize maps
    if (!chunkLattice._chunks) chunkLattice._chunks = new Map();
    if (!chunkLattice._blockTypeColliders) chunkLattice._blockTypeColliders = new Map();
    if (!chunkLattice._blockTypeCounts) chunkLattice._blockTypeCounts = new Map();
    
    // Parse chunks data
    let chunks: any[] = [];
    if (typeof chunksData === 'string') {
      const parsed = JSON.parse(chunksData);
      chunks = parsed.chunks || [];
    } else if (chunksData.chunks) {
      chunks = chunksData.chunks;
    } else {
      // Binary format - need to parse it
      chunks = this.parseBinaryChunks(chunksData);
    }
    
    console.log(`[DirectChunkLoaderV3] Loading ${chunks.length} chunks...`);
    
    // Load chunks into memory
    let totalBlocks = 0;
    for (const chunkData of chunks) {
      const { origin, blocks: blockArray } = chunkData;
      
      // Convert to Uint8Array
      let typedBlockArray: Uint8Array;
      if (blockArray instanceof Uint8Array) {
        typedBlockArray = blockArray;
      } else if (Array.isArray(blockArray)) {
        typedBlockArray = new Uint8Array(blockArray);
      } else {
        typedBlockArray = new Uint8Array(4096);
        for (let i = 0; i < 4096; i++) {
          typedBlockArray[i] = blockArray[i] || 0;
        }
      }
      
      // Create chunk object (exactly like HyFire8)
      const chunkKey = `${origin.x},${origin.y},${origin.z}`;
      const chunk = {
        _blocks: typedBlockArray,
        _originCoordinate: origin,
        blocks: typedBlockArray,
        originCoordinate: origin,
        getBlockId: function(localCoord: any) {
          const index = localCoord.x + (localCoord.y << 4) + (localCoord.z << 8);
          return this._blocks[index];
        },
        hasBlock: function(localCoord: any) {
          const index = localCoord.x + (localCoord.y << 4) + (localCoord.z << 8);
          return this._blocks[index] !== 0;
        },
        setBlock: function(localCoord: any, blockId: number) {
          const index = localCoord.x + (localCoord.y << 4) + (localCoord.z << 8);
          this._blocks[index] = blockId;
        },
        serialize: function() {
          return {
            c: [this._originCoordinate.x, this._originCoordinate.y, this._originCoordinate.z],
            b: Array.from(this._blocks)
          };
        }
      };
      
      // Add to chunkLattice
      chunkLattice._chunks.set(chunkKey, chunk);
      
      // Emit event if possible
      if (chunkLattice.emitWithWorld) {
        chunkLattice.emitWithWorld(this.world, "CHUNK_LATTICE.ADD_CHUNK", {
          chunkLattice: chunkLattice,
          chunk: chunk
        });
      }
      
      // Count non-zero blocks
      for (let i = 0; i < typedBlockArray.length; i++) {
        if (typedBlockArray[i] !== 0) {
          totalBlocks++;
        }
      }
    }
    
    const loadTime = Date.now() - startTime;
    console.log(`[DirectChunkLoaderV3] Loaded ${chunks.length} chunks with ${totalBlocks} blocks in ${loadTime}ms`);
  }
  
  /**
   * Parse binary chunk format into chunk objects
   * Our format: [chunkX, chunkZ, block1.x, block1.y, block1.z, block1.id, ...]
   */
  private parseBinaryChunks(chunkData: Buffer): any[] {
    const chunks = new Map<string, Uint8Array>();
    let offset = 0;
    let totalBlocks = 0;
    
    console.log(`[DirectChunkLoaderV3] Parsing binary chunks, buffer size: ${chunkData.length}`);
    
    while (offset < chunkData.length) {
      if (offset + 8 > chunkData.length) break;
      
      // Read chunk coordinates
      const chunkX = chunkData.readInt32LE(offset);
      offset += 4;
      const chunkZ = chunkData.readInt32LE(offset);
      offset += 4;
      
      const chunkKey = `${chunkX},0,${chunkZ}`;
      
      // Initialize chunk blocks if not exists
      if (!chunks.has(chunkKey)) {
        chunks.set(chunkKey, new Uint8Array(4096));
      }
      const blockArray = chunks.get(chunkKey)!;
      
      // Read blocks for this chunk
      let blocksInChunk = 0;
      while (offset + 14 <= chunkData.length) {
        // Peek at next values to see if it's a new chunk header
        const nextX = chunkData.readInt32LE(offset);
        const nextY = chunkData.readInt32LE(offset + 4);
        
        // If nextY looks like a chunk Z coordinate (small value) and we have blocks, it's probably a new chunk
        if (blocksInChunk > 0 && Math.abs(nextY) < 100 && Math.abs(nextX) < 100) {
          // This is likely a new chunk header
          break;
        }
        
        // Read block data
        const blockX = nextX;
        const blockY = nextY;
        const blockZ = chunkData.readInt32LE(offset + 8);
        const blockId = chunkData.readUInt16LE(offset + 12);
        offset += 14;
        
        // Calculate local position in chunk
        const localX = blockX & 15;  // blockX % 16
        const localY = blockY & 15;
        const localZ = blockZ & 15;
        
        // Store in chunk array
        const index = localX + (localY << 4) + (localZ << 8);
        if (index >= 0 && index < 4096) {
          blockArray[index] = blockId;
          blocksInChunk++;
          totalBlocks++;
        }
      }
    }
    
    console.log(`[DirectChunkLoaderV3] Parsed ${chunks.size} chunks with ${totalBlocks} total blocks`);
    
    // Convert to array format
    const result: any[] = [];
    for (const [key, blocks] of chunks) {
      const [x, y, z] = key.split(',').map(Number);
      result.push({
        origin: { x: x * 16, y: y * 16, z: z * 16 },
        blocks: blocks
      });
    }
    
    return result;
  }
}