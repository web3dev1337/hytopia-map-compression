/**
 * Delta encoding - stores differences between consecutive values
 * Exploits spatial locality in block positions
 */
export class DeltaEncoder {
  /**
   * Encode positions using delta encoding
   * Sorts blocks spatially and stores differences
   */
  static encodePositions(blocks: { [key: string]: number }): {
    deltas: number[];
    blockIds: number[];
    bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  } {
    // Parse and sort blocks
    const sortedBlocks = this.sortBlocksSpatially(blocks);
    
    // Calculate bounds
    const bounds = this.calculateBounds(sortedBlocks);
    
    // Shift coordinates by bounds to make them all positive (like working version)
    const shiftedBlocks = sortedBlocks.map(block => ({
      x: block.x - bounds.minX,
      y: block.y - bounds.minY,
      z: block.z - bounds.minZ,
      id: block.id
    }));
    
    // Encode as deltas
    const deltas: number[] = [];
    const blockIds: number[] = [];
    
    let lastX = 0;
    let lastY = 0;
    let lastZ = 0;
    
    for (const block of shiftedBlocks) {
      // Store deltas
      deltas.push(block.x - lastX);
      deltas.push(block.y - lastY);
      deltas.push(block.z - lastZ);
      
      // Store block ID
      blockIds.push(block.id);
      
      // Update last position
      lastX = block.x;
      lastY = block.y;
      lastZ = block.z;
    }
    
    return { deltas, blockIds, bounds };
  }
  
  /**
   * Decode delta-encoded positions back to blocks
   */
  static decodePositions(
    deltas: number[],
    blockIds: number[],
    bounds?: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }
  ): { [key: string]: number } {
    const blocks: { [key: string]: number } = {};
    
    let x = 0;
    let y = 0;
    let z = 0;
    let deltaIndex = 0;
    
    for (let i = 0; i < blockIds.length; i++) {
      // Apply deltas
      x += deltas[deltaIndex++];
      y += deltas[deltaIndex++];
      z += deltas[deltaIndex++];
      
      // Store block
      blocks[`${x},${y},${z}`] = blockIds[i];
    }
    
    return blocks;
  }
  
  /**
   * Sort blocks spatially for better delta compression
   * Sort by Y, then X, then Z (vertical layers)
   */
  private static sortBlocksSpatially(blocks: { [key: string]: number }): Array<{
    x: number;
    y: number;
    z: number;
    id: number;
  }> {
    const parsed: Array<{ x: number; y: number; z: number; id: number }> = [];
    
    for (const [key, id] of Object.entries(blocks)) {
      const [x, y, z] = key.split(',').map(Number);
      parsed.push({ x, y, z, id });
    }
    
    // Sort by Y, X, Z for better locality
    parsed.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.z - b.z;
    });
    
    return parsed;
  }
  
  /**
   * Calculate bounds of all blocks
   */
  private static calculateBounds(
    blocks: Array<{ x: number; y: number; z: number; id: number }>
  ): { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } {
    if (blocks.length === 0) {
      return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
    }
    
    let minX = blocks[0].x;
    let minY = blocks[0].y;
    let minZ = blocks[0].z;
    let maxX = blocks[0].x;
    let maxY = blocks[0].y;
    let maxZ = blocks[0].z;
    
    for (const block of blocks) {
      minX = Math.min(minX, block.x);
      minY = Math.min(minY, block.y);
      minZ = Math.min(minZ, block.z);
      maxX = Math.max(maxX, block.x);
      maxY = Math.max(maxY, block.y);
      maxZ = Math.max(maxZ, block.z);
    }
    
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }
  
  /**
   * Encode with run-length encoding for repeated block IDs
   */
  static encodeBlockIds(blockIds: number[]): { encoded: number[]; isRLE: boolean } {
    const encoded: number[] = [];
    let i = 0;
    
    while (i < blockIds.length) {
      const currentId = blockIds[i];
      let count = 1;
      
      // Count consecutive same IDs
      while (i + count < blockIds.length && blockIds[i + count] === currentId) {
        count++;
      }
      
      // Store as [count, id] if beneficial
      if (count > 2) {
        encoded.push(-count); // Negative indicates RLE
        encoded.push(currentId);
      } else {
        // Store directly
        for (let j = 0; j < count; j++) {
          encoded.push(currentId);
        }
      }
      
      i += count;
    }
    
    // Check if RLE was beneficial
    const isRLE = encoded.length < blockIds.length;
    return { encoded: isRLE ? encoded : blockIds, isRLE };
  }
  
  /**
   * Decode run-length encoded block IDs
   */
  static decodeBlockIds(encoded: number[], isRLE: boolean): number[] {
    if (!isRLE) return encoded;
    
    const decoded: number[] = [];
    let i = 0;
    
    while (i < encoded.length) {
      const value = encoded[i];
      
      if (value < 0) {
        // RLE encoded
        const count = -value;
        const id = encoded[i + 1];
        for (let j = 0; j < count; j++) {
          decoded.push(id);
        }
        i += 2;
      } else {
        // Direct value
        decoded.push(value);
        i++;
      }
    }
    
    return decoded;
  }
}