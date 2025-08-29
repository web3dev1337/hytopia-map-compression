/**
 * DIRECT COPY of HyFire8's WORKING compression code
 * NO FANCY REFACTORING - JUST THE CODE THAT WORKS!
 */

import * as fs from 'fs';
import * as zlib from 'zlib';
import { promisify } from 'util';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

interface MapData {
  blockTypes: any[];
  blocks: { [key: string]: number };
  entities?: any;
  version?: string;
}

export class MapCompressorFixed {
  /**
   * EXACT COPY from HyFire8's compress-map-final.ts
   * This code handles 6.5M blocks perfectly - DON'T CHANGE IT!
   */
  async compress(mapData: MapData): Promise<any> {
    console.log(`🗜️  Compressing map...`);
    
    const startTime = Date.now();
    const jsonData = JSON.stringify(mapData);
    const originalSize = Buffer.byteLength(jsonData);
    
    // Calculate bounds and stats
    const bounds = this.calculateBounds(mapData.blocks);
    const blockCount = Object.keys(mapData.blocks).length;
    
    console.log(`📊 Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📦 Blocks: ${blockCount.toLocaleString()}`);
    
    // Convert to sorted array for better compression - EXACT COPY FROM HYFIRE8
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
    
    // Encode using varint with delta compression - EXACT COPY FROM HYFIRE8
    const buffer = Buffer.allocUnsafe(blocks.length * 15);
    let offset = 0;
    
    // Write header
    buffer.writeUInt32LE(blocks.length, offset);
    offset += 4;
    
    // Delta + Varint encoding - EXACT COPY FROM HYFIRE8
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
    
    // Apply Brotli compression - EXACT COPY FROM HYFIRE8
    const compressedData = await brotliCompress(encodedData, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
      }
    });
    
    // Create output object - EXACT COPY FROM HYFIRE8
    const output = {
      version: 2,
      method: 'varint-delta-brotli',
      blockTypes: mapData.blockTypes,
      entities: mapData.entities || {},
      mapVersion: mapData.version,
      bounds,
      data: compressedData.toString('base64'),
      originalSize,
      compressedSize: compressedData.length,
      blockCount
    };
    
    const compressionTime = Date.now() - startTime;
    const ratio = ((1 - output.compressedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✨ Compressed: ${(output.compressedSize / 1024).toFixed(2)} KB`);
    console.log(`📉 Ratio: ${ratio}% reduction`);
    console.log(`⏱️  Time: ${compressionTime}ms`);
    
    return output;
  }
  
  /**
   * EXACT COPY from HyFire8's decompress-map.ts
   */
  async decompress(compressedData: any): Promise<MapData> {
    console.log(`🔓 Decompressing map...`);
    const startTime = Date.now();
    
    // Decompress from base64 - EXACT COPY FROM HYFIRE8
    const compressed = Buffer.from(compressedData.data, 'base64');
    const decompressed = await brotliDecompress(compressed);
    
    // Read header - EXACT COPY FROM HYFIRE8
    let offset = 0;
    const blockCount = decompressed.readUInt32LE(offset);
    offset += 4;
    
    // Decode blocks - EXACT COPY FROM HYFIRE8
    const blocks: { [key: string]: number } = {};
    let lastX = 0, lastY = 0, lastZ = 0;
    
    for (let i = 0; i < blockCount; i++) {
      // Read deltas
      const deltaX = this.readVarint(decompressed, offset);
      offset = deltaX.offset;
      lastX += deltaX.value;
      
      const deltaY = this.readVarint(decompressed, offset);
      offset = deltaY.offset;
      lastY += deltaY.value;
      
      const deltaZ = this.readVarint(decompressed, offset);
      offset = deltaZ.offset;
      lastZ += deltaZ.value;
      
      const blockId = this.readVarint(decompressed, offset);
      offset = blockId.offset;
      
      // Restore original coordinates - THIS IS THE KEY PART HYFIRE8 DOES RIGHT!
      const x = lastX + compressedData.bounds.minX;
      const y = lastY + compressedData.bounds.minY;
      const z = lastZ + compressedData.bounds.minZ;
      
      blocks[`${x},${y},${z}`] = blockId.value;
    }
    
    const decompressionTime = Date.now() - startTime;
    console.log(`✅ Decompressed ${blockCount.toLocaleString()} blocks in ${decompressionTime}ms`);
    
    return {
      blocks,
      blockTypes: compressedData.blockTypes,
      entities: compressedData.entities,
      version: compressedData.mapVersion
    };
  }
  
  /**
   * Helper functions - EXACT COPIES FROM HYFIRE8
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
    // Make value positive for varint encoding
    const zigzag = (value << 1) ^ (value >> 31);
    let current = zigzag;
    
    while (current > 0x7f) {
      buffer[offset++] = (current & 0x7f) | 0x80;
      current >>>= 7;
    }
    buffer[offset++] = current;
    
    return offset;
  }
  
  private readVarint(buffer: Buffer, offset: number): { value: number; offset: number } {
    let value = 0;
    let shift = 0;
    let byte: number;
    
    do {
      byte = buffer[offset++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    
    // Decode zigzag
    const decoded = (value >>> 1) ^ -(value & 1);
    
    return { value: decoded, offset };
  }
}

/**
 * Plugin wrapper - just delegates to the WORKING code
 */
export class MapCompressionFixed {
  private compressor: MapCompressorFixed;
  
  constructor(world: any, options?: any) {
    // Don't care about options - just use what works!
    this.compressor = new MapCompressorFixed();
  }
  
  async compress(mapData: MapData) {
    return await this.compressor.compress(mapData);
  }
  
  async decompress(compressedData: any) {
    return await this.compressor.decompress(compressedData);
  }
}