import { MapCompressionOptions } from '../types';

/**
 * Direct chunk injection - bypasses individual setBlock calls
 * Loads blocks in batches directly into the world's internal structures
 */
export class DirectChunkLoader {
  private world: any;
  private options: MapCompressionOptions;
  private chunkSize: number = 16; // Default Minecraft-style chunk size
  
  constructor(world: any, options: MapCompressionOptions = {}) {
    this.world = world;
    this.options = options;
  }
  
  /**
   * Load blocks using direct chunk injection
   */
  async loadChunks(blocks: { [key: string]: number }, blockTypes?: any): Promise<void> {
    const startTime = Date.now();
    const batchSize = this.options.optimization?.batchSize || 10000;
    // Ensure block types are registered before any placement
    this.registerBlockTypes(blockTypes);
    
    if (this.options.debug) {
      console.log(`[DirectChunkLoader] Loading ${Object.keys(blocks).length} blocks in chunks`);
      console.log(`[DirectChunkLoader] Batch size: ${batchSize}`);
    }
    
    // Group blocks by chunk
    const chunks = this.groupBlocksByChunk(blocks);
    
    if (this.options.debug) {
      console.log(`[DirectChunkLoader] Grouped into ${chunks.size} chunks`);
    }
    
    // Process chunks in batches
    const chunkArray = Array.from(chunks.entries());
    for (let i = 0; i < chunkArray.length; i += batchSize) {
      const batch = chunkArray.slice(i, i + batchSize);
      
      // Try to access internal chunk structure if available
      if (this.world._chunks || this.world.chunks) {
        await this.loadChunksDirect(batch);
      } else {
        // Fallback to batch setBlock calls
        await this.loadChunksBatched(batch);
      }
      
      if (this.options.debug && i % 100000 === 0) {
        console.log(`[DirectChunkLoader] Loaded ${i + batch.length}/${chunkArray.length} chunks`);
      }
    }
    
    if (this.options.debug || this.options.metrics) {
      console.log(`[DirectChunkLoader] Chunk loading complete in ${Date.now() - startTime}ms`);
    }
  }
  
  /**
   * Group blocks by chunk coordinates
   */
  private groupBlocksByChunk(blocks: { [key: string]: number }): Map<string, Array<{x: number, y: number, z: number, id: number}>> {
    const chunks = new Map<string, Array<{x: number, y: number, z: number, id: number}>>();
    
    for (const [key, id] of Object.entries(blocks)) {
      const [x, y, z] = key.split(',').map(Number);
      
      // Calculate chunk coordinates
      const chunkX = Math.floor(x / this.chunkSize);
      const chunkY = Math.floor(y / this.chunkSize);
      const chunkZ = Math.floor(z / this.chunkSize);
      const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
      
      // Add to chunk
      if (!chunks.has(chunkKey)) {
        chunks.set(chunkKey, []);
      }
      
      chunks.get(chunkKey)!.push({ x, y, z, id });
    }
    
    return chunks;
  }
  
  /**
   * Load chunks directly into internal structure (if accessible)
   */
  private async loadChunksDirect(chunks: Array<[string, Array<{x: number, y: number, z: number, id: number}>]>): Promise<void> {
    const chunkStorage = this.world._chunks || this.world.chunks;
    
    for (const [chunkKey, blocks] of chunks) {
      // Try to create or access chunk directly
      if (typeof chunkStorage.getOrCreate === 'function') {
        const chunk = chunkStorage.getOrCreate(chunkKey);
        
        // Set blocks directly in chunk
        for (const block of blocks) {
          if (chunk.setBlock) {
            const localX = ((block.x % this.chunkSize) + this.chunkSize) % this.chunkSize;
            const localY = ((block.y % this.chunkSize) + this.chunkSize) % this.chunkSize;
            const localZ = ((block.z % this.chunkSize) + this.chunkSize) % this.chunkSize;
            chunk.setBlock({ x: localX, y: localY, z: localZ }, block.id);
          }
        }
      } else {
        // Fallback to batched loading
        await this.loadBlocksBatched(blocks);
      }
    }
  }
  
  /**
   * Load chunks using batched setBlock calls
   */
  private async loadChunksBatched(chunks: Array<[string, Array<{x: number, y: number, z: number, id: number}>]>): Promise<void> {
    for (const [_, blocks] of chunks) {
      await this.loadBlocksBatched(blocks);
    }
  }
  
  /**
   * Load blocks in batches (fallback method)
   */
  private async loadBlocksBatched(blocks: Array<{x: number, y: number, z: number, id: number}>): Promise<void> {
    const batchSize = this.options.optimization?.batchSize || 10000;
    
    // Process in batches to avoid blocking
    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);
      
      // Use requestAnimationFrame or setImmediate for non-blocking
      await new Promise(resolve => {
        if (typeof setImmediate !== 'undefined') {
          setImmediate(resolve);
        } else {
          setTimeout(resolve, 0);
        }
      });
      
      // Set blocks
      for (const block of batch) {
        try {
          this.world.setBlock({ x: block.x, y: block.y, z: block.z }, block.id);
        } catch (e) {
          console.error(`[DirectChunkLoader] Failed to setBlock at (${block.x}, ${block.y}, ${block.z}) with id ${block.id}:`, e);
          throw e;
        }
      }
    }
  }
  
  /**
   * Pre-compute chunks for even faster loading
   */
  async precomputeChunks(blocks: { [key: string]: number }): Promise<Buffer> {
    const chunks = this.groupBlocksByChunk(blocks);
    const buffers: Buffer[] = [];
    const magicHeader = Buffer.allocUnsafe(8);
    magicHeader.writeUInt32LE(0x3142434d, 0); // "MCB1" little-endian
    magicHeader.writeUInt32LE(chunks.size, 4);
    buffers.push(magicHeader);
    
    for (const [chunkKey, blockList] of chunks) {
      const [chunkX, chunkY, chunkZ] = chunkKey.split(',').map(Number);
      
      const header = Buffer.allocUnsafe(16);
      header.writeInt32LE(chunkX, 0);
      header.writeInt32LE(chunkY, 4);
      header.writeInt32LE(chunkZ, 8);
      header.writeUInt32LE(blockList.length, 12);
      buffers.push(header);
      
      const blocksBuffer = Buffer.allocUnsafe(blockList.length * 14);
      let offset = 0;
      for (const block of blockList) {
        blocksBuffer.writeInt32LE(block.x, offset);
        offset += 4;
        blocksBuffer.writeInt32LE(block.y, offset);
        offset += 4;
        blocksBuffer.writeInt32LE(block.z, offset);
        offset += 4;
        blocksBuffer.writeUInt16LE(block.id, offset);
        offset += 2;
      }
      
      buffers.push(blocksBuffer);
    }
    
    // Combine all chunks
    return Buffer.concat(buffers);
  }
  
  /**
   * Register block types before loading chunks
   */
  private registerBlockTypes(blockTypes?: any[]): void {
    // Check if world has setBlock method
    if (!this.world.setBlock) {
      console.error('[DirectChunkLoader] ERROR: world.setBlock method does not exist!');
      console.log('[DirectChunkLoader] Available world methods:', Object.getOwnPropertyNames(this.world));
      throw new Error('world.setBlock method not available');
    }
    
    if (!blockTypes || !this.world.blockTypeRegistry) {
      console.log('[DirectChunkLoader] No block types to register or no registry available');
      return;
    }
    
    const list = Array.isArray(blockTypes) ? blockTypes : Object.values(blockTypes);
    if (list.length === 0) {
      console.log('[DirectChunkLoader] No block types to register');
      return;
    }
    
    console.log(`[DirectChunkLoader] Registering ${list.length} block types...`);
    for (const blockType of list) {
      try {
        this.world.blockTypeRegistry.registerGenericBlockType({
          id: blockType.id,
          isLiquid: blockType.isLiquid || false,
          name: blockType.name || `block_${blockType.id}`,
          textureUri: blockType.textureUri || 'blocks/stone.png'
        });
      } catch (e) {
        // Already registered or error, skip
      }
    }
  }
  
  /**
   * Load pre-computed chunks
   */
  async loadPrecomputedChunks(chunkData: Buffer, blockTypes?: any[]): Promise<void> {
    // Register block types first!
    this.registerBlockTypes(blockTypes);
    
    let offset = 0;
    const startTime = Date.now();
    let chunksLoaded = 0;
    
    const magic = 0x3142434d; // "MCB1"
    if (chunkData.length >= 8 && chunkData.readUInt32LE(0) === magic) {
      offset = 4;
      const chunkCount = chunkData.readUInt32LE(offset);
      offset += 4;
      
      for (let c = 0; c < chunkCount; c++) {
        if (offset + 16 > chunkData.length) break;
        const chunkX = chunkData.readInt32LE(offset);
        offset += 4;
        const chunkY = chunkData.readInt32LE(offset);
        offset += 4;
        const chunkZ = chunkData.readInt32LE(offset);
        offset += 4;
        const blockCount = chunkData.readUInt32LE(offset);
        offset += 4;
        
        const blocks: Array<{x: number, y: number, z: number, id: number}> = new Array(blockCount);
        for (let i = 0; i < blockCount; i++) {
          if (offset + 14 > chunkData.length) break;
          const x = chunkData.readInt32LE(offset);
          offset += 4;
          const y = chunkData.readInt32LE(offset);
          offset += 4;
          const z = chunkData.readInt32LE(offset);
          offset += 4;
          const id = chunkData.readUInt16LE(offset);
          offset += 2;
          blocks[i] = { x, y, z, id };
        }
        
        await this.loadBlocksBatched(blocks);
        chunksLoaded++;
        
        if (this.options.debug && chunksLoaded % 100 === 0) {
          console.log(`[DirectChunkLoader] Loaded ${chunksLoaded} chunks`);
        }
      }
    } else {
      while (offset < chunkData.length) {
        const chunkX = chunkData.readInt32LE(offset);
        offset += 4;
        const chunkZ = chunkData.readInt32LE(offset);
        offset += 4;
        
        const blocks: Array<{x: number, y: number, z: number, id: number}> = [];
        
        while (offset < chunkData.length) {
          if (offset + 14 <= chunkData.length) {
            const x = chunkData.readInt32LE(offset);
            const y = chunkData.readInt32LE(offset + 4);
            const z = chunkData.readInt32LE(offset + 8);
            const id = chunkData.readUInt16LE(offset + 12);
            
            blocks.push({ x, y, z, id });
            offset += 14;
            
            if (offset + 8 <= chunkData.length) {
              const nextX = chunkData.readInt32LE(offset);
              const nextZ = chunkData.readInt32LE(offset + 4);
              
              if (Math.abs(nextX) < 1000 && Math.abs(nextZ) < 1000) {
                break;
              }
            }
          } else {
            break;
          }
        }
        
        await this.loadBlocksBatched(blocks);
        chunksLoaded++;
        
        if (this.options.debug && chunksLoaded % 100 === 0) {
          console.log(`[DirectChunkLoader] Loaded ${chunksLoaded} chunks`);
        }
      }
    }
    
    if (this.options.debug || this.options.metrics) {
      console.log(`[DirectChunkLoader] Loaded ${chunksLoaded} pre-computed chunks in ${Date.now() - startTime}ms`);
    }
  }
}
