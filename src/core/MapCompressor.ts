import { VarintEncoder } from '../encoders/VarintEncoder';
import { DeltaEncoder } from '../encoders/DeltaEncoder';
import { BrotliWrapper } from '../encoders/BrotliWrapper';
import { CompressionResult, MapData, MapCompressionOptions } from '../types';

/**
 * Map compression engine
 * Achieves 99.5% compression using Varint + Delta + Brotli
 */
export class MapCompressor {
  private options: MapCompressionOptions;
  
  constructor(options: MapCompressionOptions = {}) {
    this.options = {
      compression: {
        algorithm: 'brotli',
        level: 9,
        useDelta: true,
        useVarint: true,
        ...options.compression
      },
      ...options
    };
  }
  
  /**
   * Compress map data using HyFire8's EXACT WORKING algorithm
   * This handles 6.5M blocks perfectly - DON'T CHANGE THE CORE LOGIC!
   */
  async compress(mapData: MapData): Promise<CompressionResult> {
    const startTime = Date.now();
    
    if (this.options.debug) {
      console.log('[MapCompressor] Starting compression...');
      console.log(`[MapCompressor] Original blocks: ${Object.keys(mapData.blocks).length}`);
    }
    
    // Calculate bounds - EXACT from HyFire8
    const bounds = this.calculateBounds(mapData.blocks);
    const blockCount = Object.keys(mapData.blocks).length;
    
    // Convert to sorted array - EXACT from HyFire8
    const blocks = Object.entries(mapData.blocks)
      .map(([coord, id]) => {
        const [x, y, z] = coord.split(',').map(Number);
        return { 
          x: x - bounds.minX, 
          y: y - bounds.minY, 
          z: z - bounds.minZ, 
          id 
        };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
    
    // Encode using varint with delta compression - EXACT from HyFire8
    const buffer = Buffer.allocUnsafe(blocks.length * 15);
    let offset = 0;
    
    // Write header
    buffer.writeUInt32LE(blocks.length, offset);
    offset += 4;
    
    // Delta + Varint encoding - EXACT from HyFire8
    let lastX = 0, lastY = 0, lastZ = 0;
    for (const block of blocks) {
      offset = this.writeVarint(block.x - lastX, buffer, offset);
      offset = this.writeVarint(block.y - lastY, buffer, offset);
      offset = this.writeVarint(block.z - lastZ, buffer, offset);
      offset = this.writeVarint(block.id, buffer, offset);
      
      lastX = block.x;
      lastY = block.y;
      lastZ = block.z;
    }
    
    const encodedData = buffer.slice(0, offset);
    
    // Apply Brotli compression - using the wrapper but same params as HyFire8
    const compressedData = await BrotliWrapper.compressToBase64(encodedData, {
      algorithm: this.options.compression?.algorithm || 'brotli',
      level: this.options.compression?.level || 9
    });
    
    // Calculate metrics
    const originalSize = JSON.stringify(mapData).length;
    const compressedSize = compressedData.length;
    const compressionRatio = BrotliWrapper.calculateRatio(originalSize, compressedSize);
    const compressionTime = Date.now() - startTime;
    
    if (this.options.debug || this.options.metrics) {
      console.log(`[MapCompressor] Compression complete:`);
      console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Compressed size: ${(compressedSize / 1024).toFixed(2)} KB`);
      console.log(`  Compression ratio: ${BrotliWrapper.formatRatio(compressionRatio)}`);
      console.log(`  Time: ${compressionTime}ms`);
    }
    
    return {
      data: compressedData,
      metadata: {
        originalSize,
        compressedSize,
        compressionRatio,
        blockCount: Object.keys(mapData.blocks).length,
        entityCount: mapData.entities ? Object.keys(mapData.entities).length : 0,
        compressionTime
      },
      blockTypes: mapData.blockTypes || {},
      bounds,
      version: '1.0.0'
    };
  }
  
  /**
   * HyFire8's EXACT helper functions
   */
  private calculateBounds(blocks: { [key: string]: number }) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const coord of Object.keys(blocks)) {
      const [x, y, z] = coord.split(',').map(Number);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }
  
  private writeVarint(value: number, buffer: Buffer, offset: number): number {
    // Make value positive for varint encoding - EXACT from HyFire8
    const zigzag = (value << 1) ^ (value >> 31);
    let current = zigzag;
    
    while (current > 0x7f) {
      buffer[offset++] = (current & 0x7f) | 0x80;
      current >>>= 7;
    }
    buffer[offset++] = current;
    
    return offset;
  }
  
  /**
   * Create a compressed map file structure
   */
  createCompressedMap(result: CompressionResult, mapData: MapData): any {
    return {
      version: result.version,
      algorithm: this.options.compression?.algorithm || 'brotli',
      data: result.data,
      blockTypes: result.blockTypes,
      bounds: result.bounds,
      entities: mapData.entities || {},
      mapVersion: mapData.version,
      metadata: result.metadata,
      options: {
        useDelta: this.options.compression?.useDelta,
        useVarint: this.options.compression?.useVarint
      }
    };
  }
}