import { MapDecompressor } from '../core/MapDecompressor';
import { MapCompressionOptions } from '../types';

/**
 * Monkey patches the Hytopia SDK's world.loadMap() method
 * for optimized loading of compressed maps
 */
export class MonkeyPatchLoader {
  private world: any;
  private originalLoadMap: Function | null = null;
  private decompressor: MapDecompressor;
  private options: MapCompressionOptions;
  
  constructor(world: any, options: MapCompressionOptions = {}) {
    this.world = world;
    this.options = options;
    this.decompressor = new MapDecompressor(options);
  }
  
  /**
   * Apply the monkey patch to world.loadMap()
   */
  patch(): void {
    if (this.originalLoadMap) {
      console.warn('[MonkeyPatchLoader] Already patched');
      return;
    }
    
    // Store original method
    this.originalLoadMap = this.world.loadMap.bind(this.world);
    
    // Replace with optimized version
    this.world.loadMap = async (mapData: any) => {
      if (this.options.debug) {
        console.log('[MonkeyPatchLoader] Intercepted loadMap call');
      }
      
      // Check if it's compressed data
      if (this.isCompressedMap(mapData)) {
        const startTime = Date.now();
        
        if (this.options.debug) {
          console.log('[MonkeyPatchLoader] Detected compressed map, decompressing...');
        }
        
        // Decompress the map
        const decompressed = await this.decompressor.decompress(mapData);
        
        // Convert to SDK format
        const sdkFormat = {
          blocks: decompressed.blocks,
          blockTypes: decompressed.blockTypes || mapData.blockTypes,
          entities: decompressed.entities || {},
          version: decompressed.version
        };
        
        if (this.options.debug || this.options.metrics) {
          console.log(`[MonkeyPatchLoader] Decompression took ${Date.now() - startTime}ms`);
          console.log(`[MonkeyPatchLoader] Loading ${Object.keys(sdkFormat.blocks).length} blocks`);
        }
        
        // Call original with decompressed data
        return this.originalLoadMap!(sdkFormat);
      }
      
      // Not compressed, use original method
      return this.originalLoadMap!(mapData);
    };
    
    if (this.options.debug) {
      console.log('[MonkeyPatchLoader] Successfully patched world.loadMap()');
    }
  }
  
  /**
   * Remove the monkey patch
   */
  unpatch(): void {
    if (!this.originalLoadMap) {
      console.warn('[MonkeyPatchLoader] Not patched');
      return;
    }
    
    this.world.loadMap = this.originalLoadMap;
    this.originalLoadMap = null;
    
    if (this.options.debug) {
      console.log('[MonkeyPatchLoader] Removed patch from world.loadMap()');
    }
  }
  
  /**
   * Check if map data is compressed
   */
  private isCompressedMap(mapData: any): boolean {
    return !!(
      mapData &&
      mapData.version &&
      mapData.algorithm &&
      mapData.data &&
      typeof mapData.data === 'string' &&
      mapData.bounds
    );
  }
  
  /**
   * Load a map (compressed or uncompressed)
   */
  async loadMap(mapData: any): Promise<void> {
    if (!this.originalLoadMap) {
      this.patch();
    }
    
    return this.world.loadMap(mapData);
  }
}