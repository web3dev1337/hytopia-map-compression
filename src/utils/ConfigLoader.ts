import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { MapCompressionOptions } from '../types';

/**
 * Configuration loader for map compression settings
 * Supports YAML config files with sensible defaults
 */
export class ConfigLoader {
  private static defaultConfigPath = path.join(__dirname, '../../assets/config/default.yaml');
  
  /**
   * Load configuration from YAML file
   * @param configPath Path to custom config file (optional)
   * @returns Merged configuration with defaults
   */
  static loadConfig(configPath?: string): MapCompressionOptions {
    // Load default config
    const defaultConfig = this.loadYamlFile(this.defaultConfigPath);
    
    // If no custom config specified, check for convention-based config
    if (!configPath) {
      // Convention: look for assets/config/map-compression.yaml
      const conventionPath = path.join(process.cwd(), 'assets/config/map-compression.yaml');
      if (fs.existsSync(conventionPath)) {
        try {
          const customConfig = this.loadYamlFile(conventionPath);
          const merged = this.deepMerge(defaultConfig, customConfig);
          console.log('[MapCompression] Using config from assets/config/map-compression.yaml');
          return this.parseConfig(merged);
        } catch (error) {
          console.warn('[MapCompression] Found config but failed to load, using defaults');
        }
      }
      return this.parseConfig(defaultConfig);
    }
    
    // Load and merge custom config
    try {
      const customConfig = this.loadYamlFile(configPath);
      const merged = this.deepMerge(defaultConfig, customConfig);
      return this.parseConfig(merged);
    } catch (error) {
      console.warn(`[ConfigLoader] Could not load custom config from ${configPath}, using defaults`);
      return this.parseConfig(defaultConfig);
    }
  }
  
  /**
   * Load and parse a YAML file
   */
  private static loadYamlFile(filePath: string): any {
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.parse(content);
  }
  
  /**
   * Parse raw config into MapCompressionOptions
   */
  private static parseConfig(config: any): MapCompressionOptions {
    return {
      features: config.features,
      compression: config.compression,
      optimization: config.optimization,
      loading: config.loading,
      performance: config.performance,
      paths: config.paths,
      autoLoad: config.autoLoad,
      debug: config.logging?.enabled || false,
      metrics: config.logging?.metrics || true,
      logger: config.logging?.enabled ? console.log : undefined
    };
  }
  
  /**
   * Deep merge two objects (custom overrides default)
   */
  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * Create a custom config file from current options
   */
  static saveConfig(options: MapCompressionOptions, filePath: string): void {
    const config = {
      features: options.features,
      compression: options.compression,
      optimization: options.optimization,
      loading: options.loading,
      performance: options.performance,
      paths: options.paths,
      autoLoad: options.autoLoad,
      logging: {
        enabled: options.debug || false,
        metrics: options.metrics || true,
        level: 'info'
      }
    };
    
    const yamlContent = yaml.stringify(config);
    fs.writeFileSync(filePath, yamlContent);
  }
  
  /**
   * Get path to default config file
   */
  static getDefaultConfigPath(): string {
    return this.defaultConfigPath;
  }
}