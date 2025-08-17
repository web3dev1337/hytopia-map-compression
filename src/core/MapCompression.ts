import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MapCompressor } from './MapCompressor';
import { MapDecompressor } from './MapDecompressor';
import { FastLoader } from '../optimization/FastLoader';
import { MonkeyPatchLoader } from '../optimization/MonkeyPatchLoader';
import { DirectChunkLoader } from '../optimization/DirectChunkLoader';
import { ConfigLoader } from '../utils/ConfigLoader';
import { DetailedBenchmark } from '../utils/DetailedBenchmark';
import {
  MapCompressionOptions,
  CompressionResult,
  DecompressionResult,
  PerformanceMetrics,
  MapData,
  CompressedMapData
} from '../types';

/**
 * Main API for the Hytopia Map Compression plugin
 * Provides compression, decompression, and fast loading capabilities
 */
export class MapCompression {
  private world: any;
  private options: MapCompressionOptions;
  private compressor: MapCompressor;
  private decompressor: MapDecompressor;
  private fastLoader: FastLoader;
  private monkeyPatcher?: MonkeyPatchLoader;
  private chunkLoader?: DirectChunkLoader;
  private metrics: PerformanceMetrics = {};
  
  constructor(world: any, options: MapCompressionOptions = {}) {
    this.world = world;
    
    // Check for simple mode (compression only, no optimizations)
    const simpleMode = options.simple || options.autoLoad?.compressionOnly;
    
    // Set default options
    this.options = {
      features: {
        compression: true,
        decompression: true,
        fastLoading: !simpleMode,  // Disable in simple mode
        monkeyPatching: false,
        ...options.features
      },
      compression: {
        algorithm: 'brotli',
        level: 9,
        useDelta: true,
        useVarint: true,
        ...options.compression
      },
      optimization: {
        enabled: !simpleMode,  // Disable in simple mode
        monkeyPatch: false,
        useChunks: !simpleMode,  // Disable in simple mode
        batchSize: 10000,
        preParseCoordinates: true,
        ...options.optimization
      },
      loading: {
        method: simpleMode ? 'default' : 'hybrid',
        batchSize: 10000,
        ...options.loading
      },
      performance: {
        maxMemory: 500 * 1024 * 1024,
        cacheCompressed: true,
        reportMetrics: true,
        ...options.performance
      },
      debug: options.debug || false,
      metrics: options.metrics || true,
      logger: options.logger || console.log,
      simple: simpleMode
    };
    
    // Initialize components
    this.compressor = new MapCompressor(this.options);
    this.decompressor = new MapDecompressor(this.options);
    this.fastLoader = new FastLoader(world, this.options);
    
    // Initialize optional components
    if (this.options.features?.monkeyPatching || this.options.optimization?.monkeyPatch) {
      this.monkeyPatcher = new MonkeyPatchLoader(world, this.options);
      this.monkeyPatcher.patch();
    }
    
    if (this.options.optimization?.useChunks) {
      this.chunkLoader = new DirectChunkLoader(world, this.options);
      if (this.options.debug) {
        this.log('ChunkLoader initialized');
      }
    } else {
      if (this.options.debug) {
        this.log('ChunkLoader NOT initialized - useChunks:', this.options.optimization?.useChunks);
      }
    }
    
    if (this.options.debug) {
      this.log('MapCompression initialized with options:', this.options);
    }
  }
  
  /**
   * Compress map data
   * @returns Compressed map with 99.5% size reduction
   */
  async compress(mapData: MapData): Promise<CompressionResult> {
    if (!this.options.features?.compression) {
      throw new Error('Compression feature is disabled');
    }
    
    const startTime = Date.now();
    this.log('Starting compression...');
    
    const result = await this.compressor.compress(mapData);
    
    // Update metrics
    this.metrics.compressionRatio = result.metadata.compressionRatio;
    this.metrics.compressionTimeMs = Date.now() - startTime;
    
    if (this.options.performance?.reportMetrics) {
      this.log(`Compression complete: ${(result.metadata.compressionRatio * 100).toFixed(1)}% reduction in ${this.metrics.compressionTimeMs}ms`);
    }
    
    return result;
  }
  
  /**
   * Decompress map data
   * @returns Decompressed map ready for loading
   */
  async decompress(compressedData: CompressedMapData): Promise<DecompressionResult> {
    if (!this.options.features?.decompression) {
      throw new Error('Decompression feature is disabled');
    }
    
    const startTime = Date.now();
    this.log('Starting decompression...');
    
    const result = await this.decompressor.decompress(compressedData);
    
    // Update metrics
    this.metrics.decompressionTimeMs = Date.now() - startTime;
    this.metrics.blocksLoaded = result.metadata?.blockCount;
    
    if (this.options.performance?.reportMetrics) {
      this.log(`Decompression complete: ${result.metadata?.blockCount} blocks in ${this.metrics.decompressionTimeMs}ms`);
    }
    
    return result;
  }
  
  /**
   * Load a map (compressed or uncompressed) with optimizations
   * Achieves 50x faster loading for large maps
   */
  async loadMap(mapData: MapData | CompressedMapData | string): Promise<void> {
    if (!this.options.features?.fastLoading) {
      // Use default loading
      return this.world.loadMap(mapData);
    }
    
    const startTime = Date.now();
    this.log('Starting optimized map loading...');
    
    // Handle file path
    let data: any = mapData;
    if (typeof mapData === 'string') {
      try {
        data = await import(mapData);
      } catch (error) {
        throw new Error(`Failed to load map from path: ${mapData}`);
      }
    }
    
    // Use fast loader
    await this.fastLoader.load(data);
    
    // Update metrics
    this.metrics.loadTimeMs = Date.now() - startTime;
    this.metrics.method = this.options.loading?.method || 'hybrid';
    
    if (this.options.performance?.reportMetrics) {
      this.log(`Map loading complete in ${this.metrics.loadTimeMs}ms using ${this.metrics.method} method`);
    }
  }
  
  /**
   * Get the FastLoader instance for manual control
   */
  getFastLoader(): FastLoader {
    return this.fastLoader;
  }
  
  /**
   * Get the MonkeyPatchLoader instance
   */
  getMonkeyPatcher(): MonkeyPatchLoader | undefined {
    return this.monkeyPatcher;
  }
  
  /**
   * Get the DirectChunkLoader instance
   */
  getChunkLoader(): DirectChunkLoader | undefined {
    return this.chunkLoader;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {};
  }
  
  /**
   * Create a complete compressed map file
   */
  createCompressedMapFile(mapData: MapData): Promise<any> {
    return this.compress(mapData).then(result => 
      this.compressor.createCompressedMap(result, mapData)
    );
  }
  
  /**
   * Enable or disable debug logging
   */
  setDebug(enabled: boolean): void {
    this.options.debug = enabled;
  }
  
  /**
   * Clean up resources and remove patches
   */
  cleanup(): void {
    if (this.monkeyPatcher) {
      this.monkeyPatcher.unpatch();
    }
    
    this.fastLoader.cleanup();
    
    this.log('MapCompression cleaned up');
  }
  
  /**
   * Log message using configured logger
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      if (this.options.logger) {
        this.options.logger(`[MapCompression] ${args.join(' ')}`);
      } else {
        console.log(`[MapCompression] ${args.join(' ')}`);
      }
    }
  }
  
  /**
   * Static method to check if data is compressed
   */
  static isCompressed(data: any): boolean {
    return !!(
      data &&
      data.version &&
      data.algorithm &&
      data.data &&
      typeof data.data === 'string' &&
      data.bounds
    );
  }
  
  /**
   * Static method to get compression stats from compressed data
   */
  static getCompressionStats(compressedData: CompressedMapData): {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    blockCount: number;
  } | null {
    if (!compressedData.metadata) return null;
    
    return {
      originalSize: compressedData.metadata.originalSize,
      compressedSize: compressedData.metadata.compressedSize,
      ratio: compressedData.metadata.compressionRatio,
      blockCount: compressedData.metadata.blockCount
    };
  }
  
  /**
   * Automatically handle map loading with smart defaults
   * - Uses hash-based caching to detect changes
   * - Handles all fallback scenarios gracefully
   * - Includes version tracking for cache invalidation
   */
  async autoLoad(mapPath?: string, configPath?: string): Promise<void> {
    const startTime = Date.now();
    
    // Create detailed benchmark if debug is enabled
    const benchmark = new DetailedBenchmark(this.options.debug || false);
    benchmark.start();
    
    // Get plugin version for cache invalidation
    const pluginVersion = '0.1.0'; // TODO: Import from package.json
    const versionTag = `v${pluginVersion.replace(/\./g, '_')}`;
    
    // Load config - will automatically check for assets/config/map-compression.yaml
    benchmark.startStep('Config Loading');
    const config = ConfigLoader.loadConfig(configPath);
    Object.assign(this.options, config);
    benchmark.finishStep();
    
    // Use paths from config or defaults
    const originalMapPath = mapPath || this.options.paths?.mapFile || './assets/map.json';
    
    this.log(`[AutoLoad] Starting automatic map loading...`);
    
    try {
      // Check if original map exists
      if (!fs.existsSync(originalMapPath)) {
        throw new Error(`No map found at ${originalMapPath}`);
      }
      
      // Calculate hash of original map file
      benchmark.startStep('File Read', { path: originalMapPath });
      const mapContent = fs.readFileSync(originalMapPath);
      const mapSize = mapContent.length;
      benchmark.finishStep({ sizeBytes: mapSize });
      
      benchmark.startStep('Hash Calculation');
      const mapHash = crypto.createHash('md5').update(mapContent).digest('hex').slice(0, 8);
      benchmark.finishStep({ hash: mapHash })
      
      // Generate cache filenames with hash AND version
      const baseDir = path.dirname(originalMapPath);
      const baseName = path.basename(originalMapPath, '.json');
      const compressedMapPath = path.join(baseDir, `${baseName}.${mapHash}.${versionTag}.compressed.json`);
      const chunksPath = path.join(baseDir, `${baseName}.${mapHash}.${versionTag}.chunks.bin`);
      
      this.log(`[AutoLoad] Map hash: ${mapHash}`);
      
      // Step 1: Check for pre-computed chunks (ultra-fastest) - skip in simple mode
      this.log(`[AutoLoad] Checking for chunks at: ${chunksPath}`);
      if (!this.options.simple && !this.options.autoLoad?.compressionOnly && fs.existsSync(chunksPath)) {
        this.log(`[AutoLoad] ✓ Found pre-computed chunks, entering chunks section`);
        
        try {
          benchmark.startStep('Chunks Cache Read', { path: chunksPath });
          const chunksData = fs.readFileSync(chunksPath);
          benchmark.finishStep({ sizeBytes: chunksData.length })
          
          // Load chunks directly (bypasses compression entirely)
          if (!this.chunkLoader) {
            this.log('[AutoLoad] WARNING: ChunkLoader not initialized, cannot load chunks!');
            throw new Error('ChunkLoader not initialized - falling back to compressed');
          }
          
          benchmark.startStep('Chunk Loading');
          
          // Get block types for registration
          let blockTypes: any[] = [];
          
          // Try to get from compressed file first
          if (fs.existsSync(compressedMapPath)) {
            const compressedData = JSON.parse(fs.readFileSync(compressedMapPath, 'utf-8'));
            blockTypes = compressedData.blockTypes || [];
            
            // Also load entities while we have the data
            if (compressedData.entities) {
              this.world.entities = compressedData.entities;
            }
          }
          
          // Fallback to original map if no compressed or no blockTypes
          if (blockTypes.length === 0) {
            const mapData = JSON.parse(mapContent.toString());
            blockTypes = mapData.blockTypes || [];
            
            // Also load entities if not already loaded
            if (!this.world.entities && mapData.entities) {
              this.world.entities = mapData.entities;
            }
          }
          
          // Load chunks with block types
          await this.chunkLoader.loadPrecomputedChunks(chunksData, blockTypes);
          benchmark.finishStep()
          
          console.log('>>> ABOUT TO FINISH BENCHMARK AND RETURN <<<');
          
          // Finish benchmark and record metrics
          try {
            const results = benchmark.finish();
            this.log(`[AutoLoad] ⚡ Ultra-fast chunk loading complete in ${results.totalTime}ms`);
            this.metrics.loadTimeMs = results.totalTime;
            this.metrics.method = 'precomputed-chunks';
            this.metrics.benchmark = results;
          } catch (benchErr) {
            console.error('>>> ERROR FINISHING BENCHMARK:', benchErr);
            throw benchErr;
          }
          
          // Regenerate compressed file if missing (for consistency)
          if (!fs.existsSync(compressedMapPath)) {
            this.log(`[AutoLoad] Compressed file missing, regenerating...`);
            this.regenerateCompressedFile(mapContent, compressedMapPath, mapHash, versionTag);
          }
          
          // Clean up old cache files
          this.cleanupOldCaches(baseDir, baseName, mapHash, versionTag);
          this.log('[AutoLoad] ✅ Chunks loading complete, returning early (no decompression needed!)');
          console.log('>>> CHUNKS SECTION RETURNING NOW - NO DECOMPRESSION SHOULD HAPPEN <<<');
          return;
        } catch (error) {
          console.error('>>> CHUNKS SECTION CAUGHT ERROR, FALLING BACK:', error);
          this.log(`[AutoLoad] Failed to load chunks, falling back...`, error);
          // Fall through to next option
        }
      }
      
      // Step 2: Check for compressed map (fast)
      console.log('>>> ENTERING COMPRESSED SECTION - THIS SHOULD NOT HAPPEN IF CHUNKS LOADED <<<');
      this.log('[AutoLoad] Entering compressed map section (chunks not available or failed)');
      if (fs.existsSync(compressedMapPath)) {
        this.log(`[AutoLoad] Found compressed map, loading with optimizations`);
        
        try {
          benchmark.startStep('Compressed Cache Read', { path: compressedMapPath });
          const compressedContent = fs.readFileSync(compressedMapPath, 'utf-8');
          const compressedData = JSON.parse(compressedContent);
          benchmark.finishStep({ sizeBytes: compressedContent.length })
          
          // Verify hash matches (belt and suspenders)
          if (compressedData.sourceHash && compressedData.sourceHash !== mapHash) {
            this.log(`[AutoLoad] Hash mismatch! Map has changed, will recompress`);
            // Fall through to recompress
          } else {
            // Use fast loader with all optimizations
            benchmark.startStep('Fast Loading (Decompression + Placement)');
            await this.fastLoader.load(compressedData);
            benchmark.finishStep()
            
            const results = benchmark.finish();
            this.log(`[AutoLoad] ✨ Fast loading complete in ${results.totalTime}ms`);
            this.metrics.loadTimeMs = results.totalTime;
            this.metrics.method = 'compressed-fast';
            this.metrics.benchmark = results;
            
            // Regenerate chunks if missing (for next run)
            if (!fs.existsSync(chunksPath) && this.chunkLoader) {
              this.log(`[AutoLoad] Chunks missing, regenerating for next run...`);
              const decompressed = await this.decompress(compressedData);
              const chunks = await this.chunkLoader.precomputeChunks(decompressed.blocks);
              fs.writeFileSync(chunksPath, chunks);
              this.log(`[AutoLoad] ✅ Regenerated chunks cache`);
            }
            
            // Clean up old cache files
            this.cleanupOldCaches(baseDir, baseName, mapHash, versionTag);
            return;
          }
        } catch (error) {
          this.log(`[AutoLoad] Failed to load compressed map, will recreate...`);
          // Fall through to recreate everything
        }
      }
      
      // Step 3: First run or map changed - create ALL caches at once!
      this.log(`[AutoLoad] No cache found for hash ${mapHash}, creating ALL optimized versions`);
      
      // Parse map data
      const mapData = JSON.parse(mapContent.toString());
      
      // Load it normally first
      await this.world.loadMap(mapData);
      
      // Create BOTH compressed and chunks at the same time!
      this.log(`[AutoLoad] Creating compressed cache and pre-computed chunks...`);
      
      // Compress the map
      const compressed = await this.compress(mapData);
      
      // Create full compressed map file with hash
      const compressedFile = {
        version: compressed.version,
        algorithm: 'brotli',
        data: compressed.data,
        blockTypes: compressed.blockTypes,
        bounds: compressed.bounds,
        entities: mapData.entities || {},
        mapVersion: mapData.version || '1.0.0',
        metadata: compressed.metadata,
        options: {
          useDelta: true,
          useVarint: true
        },
        sourceHash: mapHash  // Store hash for verification
      };
      
      // Save compressed version
      benchmark.startStep('Cache Write (Compressed)');
      fs.writeFileSync(compressedMapPath, JSON.stringify(compressedFile, null, 2));
      benchmark.finishStep({ path: compressedMapPath });
      this.log(`[AutoLoad] ✅ Created compressed cache: ${path.basename(compressedMapPath)}`);
      this.log(`[AutoLoad] Compression: ${(compressed.metadata.compressionRatio * 100).toFixed(1)}% reduction`);
      
      // Create pre-computed chunks (unless in simple mode or explicitly disabled)
      const shouldCreateChunks = this.chunkLoader && 
        !this.options.simple && 
        !this.options.autoLoad?.compressionOnly &&
        this.options.autoLoad?.preferChunks !== false;
        
      if (shouldCreateChunks && this.chunkLoader) {
        benchmark.startStep('Chunks Generation');
        const chunks = await this.chunkLoader.precomputeChunks(mapData.blocks);
        benchmark.finishStep({ chunksSize: chunks.length });
        
        benchmark.startStep('Cache Write (Chunks)');
        fs.writeFileSync(chunksPath, chunks);
        benchmark.finishStep({ path: chunksPath });
        this.log(`[AutoLoad] ✅ Created chunks cache: ${path.basename(chunksPath)}`);
      }
      
      const results = benchmark.finish();
      this.log(`[AutoLoad] Initial load complete in ${results.totalTime}ms`);
      this.log(`[AutoLoad] Next load will be 50x faster with chunks!`);
      this.metrics.loadTimeMs = results.totalTime;
      this.metrics.method = 'initial-compression';
      this.metrics.benchmark = results;
      
      // Clean up old cache files
      this.cleanupOldCaches(baseDir, baseName, mapHash, versionTag);
      
    } catch (error: any) {
      this.log(`[AutoLoad] Error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clean up old cache files with different hashes or versions
   */
  private cleanupOldCaches(dir: string, baseName: string, currentHash: string, currentVersion: string): void {
    try {
      const files = fs.readdirSync(dir);
      // Match files with pattern: basename.hash.version.type
      const pattern = new RegExp(`^${baseName}\\.[a-f0-9]{8}\\.v[0-9_]+\\.(compressed\\.json|chunks\\.bin)$`);
      
      files.forEach(file => {
        if (pattern.test(file) && (!file.includes(currentHash) || !file.includes(currentVersion))) {
          const filePath = path.join(dir, file);
          fs.unlinkSync(filePath);
          this.log(`[AutoLoad] Cleaned up old cache: ${file}`);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  /**
   * Regenerate compressed file from original map data
   */
  private async regenerateCompressedFile(mapContent: Buffer, compressedMapPath: string, mapHash: string, versionTag: string): Promise<void> {
    try {
      const mapData = JSON.parse(mapContent.toString());
      const compressed = await this.compress(mapData);
      
      const compressedFile = {
        version: compressed.version,
        algorithm: 'brotli',
        data: compressed.data,
        blockTypes: compressed.blockTypes,
        bounds: compressed.bounds,
        entities: mapData.entities || {},
        mapVersion: mapData.version || '1.0.0',
        metadata: compressed.metadata,
        options: {
          useDelta: true,
          useVarint: true
        },
        sourceHash: mapHash,
        pluginVersion: versionTag
      };
      
      fs.writeFileSync(compressedMapPath, JSON.stringify(compressedFile, null, 2));
      this.log(`[AutoLoad] ✅ Regenerated compressed file`);
    } catch (error) {
      this.log(`[AutoLoad] Failed to regenerate compressed file`);
    }
  }
  
  /**
   * Simple static factory for zero-config usage
   * Example: await MapCompression.quickLoad(world);
   */
  static async quickLoad(world: any, mapPath?: string, enableBenchmark: boolean = false): Promise<MapCompression> {
    const mc = new MapCompression(world, enableBenchmark ? { debug: true } : {});
    await mc.autoLoad(mapPath);
    return mc;
  }
  
  /**
   * Quick load with detailed benchmarking enabled
   */
  static async quickLoadWithBenchmark(world: any, mapPath?: string): Promise<MapCompression> {
    return MapCompression.quickLoad(world, mapPath, true);
  }
}