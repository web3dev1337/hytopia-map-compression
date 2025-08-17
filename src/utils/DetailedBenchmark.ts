/**
 * Detailed benchmarking utilities for map compression
 * Tracks every step of the loading process like HyFire8 did
 */

export interface BenchmarkStep {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  details?: any;
}

export interface BenchmarkResults {
  totalTime: number;
  steps: BenchmarkStep[];
  summary: {
    fileReadMs?: number;
    hashingMs?: number;
    compressionMs?: number;
    decompressionMs?: number;
    brotliMs?: number;
    varintMs?: number;
    deltaMs?: number;
    chunkGroupingMs?: number;
    blockPlacementMs?: number;
    cacheWriteMs?: number;
    cacheReadMs?: number;
  };
}

export class DetailedBenchmark {
  private steps: BenchmarkStep[] = [];
  private currentStep: BenchmarkStep | null = null;
  private startTime: number = 0;
  private enabled: boolean = true;
  
  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }
  
  /**
   * Start the overall benchmark
   */
  start(): void {
    if (!this.enabled) return;
    this.startTime = Date.now();
    this.steps = [];
    console.log('\n📊 DETAILED BENCHMARK STARTED');
    console.log('=' .repeat(50));
  }
  
  /**
   * Start tracking a specific step
   */
  startStep(name: string, details?: any): void {
    if (!this.enabled) return;
    
    // Finish previous step if exists
    if (this.currentStep) {
      this.finishStep();
    }
    
    this.currentStep = {
      name,
      startTime: Date.now(),
      details
    };
    
    console.log(`\n⏱️  [${name}] Started...`);
    if (details) {
      Object.entries(details).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
  }
  
  /**
   * Finish the current step
   */
  finishStep(additionalDetails?: any): void {
    if (!this.enabled || !this.currentStep) return;
    
    this.currentStep.endTime = Date.now();
    this.currentStep.duration = this.currentStep.endTime - this.currentStep.startTime;
    
    if (additionalDetails) {
      this.currentStep.details = {
        ...this.currentStep.details,
        ...additionalDetails
      };
    }
    
    console.log(`✅ [${this.currentStep.name}] Completed in ${this.currentStep.duration}ms`);
    if (this.currentStep.details) {
      Object.entries(this.currentStep.details).forEach(([key, value]) => {
        if (typeof value === 'number' && key.includes('size')) {
          // Format sizes
          const mb = (value / 1024 / 1024).toFixed(2);
          const kb = (value / 1024).toFixed(1);
          console.log(`   ${key}: ${mb} MB (${kb} KB)`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      });
    }
    
    this.steps.push(this.currentStep);
    this.currentStep = null;
  }
  
  /**
   * Log progress update without creating a new step
   */
  logProgress(message: string, current?: number, total?: number): void {
    if (!this.enabled) return;
    
    if (current !== undefined && total !== undefined) {
      const percent = ((current / total) * 100).toFixed(1);
      console.log(`   📊 ${message}: ${percent}% (${current.toLocaleString()} / ${total.toLocaleString()})`);
    } else {
      console.log(`   📊 ${message}`);
    }
  }
  
  /**
   * Finish the benchmark and return results
   */
  finish(): BenchmarkResults {
    if (!this.enabled) {
      return {
        totalTime: 0,
        steps: [],
        summary: {}
      };
    }
    
    // Finish any pending step
    if (this.currentStep) {
      this.finishStep();
    }
    
    const totalTime = Date.now() - this.startTime;
    
    // Calculate summary
    const summary: any = {};
    this.steps.forEach(step => {
      const key = this.stepNameToSummaryKey(step.name);
      if (key && step.duration) {
        summary[key] = step.duration;
      }
    });
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 BENCHMARK COMPLETE');
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log('\n📈 Step Breakdown:');
    
    this.steps.forEach(step => {
      if (step.duration) {
        const percent = ((step.duration / totalTime) * 100).toFixed(1);
        console.log(`   ${step.name}: ${step.duration}ms (${percent}%)`);
      }
    });
    
    // Show speedup if we have comparison data
    if (summary.cacheReadMs && summary.fileReadMs) {
      const speedup = (summary.fileReadMs / summary.cacheReadMs).toFixed(1);
      console.log(`\n🚀 Cache speedup: ${speedup}x faster`);
    }
    
    console.log('=' .repeat(50) + '\n');
    
    return {
      totalTime,
      steps: this.steps,
      summary
    };
  }
  
  private stepNameToSummaryKey(name: string): string | null {
    const mapping: Record<string, string> = {
      'File Read': 'fileReadMs',
      'Hash Calculation': 'hashingMs',
      'Compression': 'compressionMs',
      'Decompression': 'decompressionMs',
      'Brotli Decompression': 'brotliMs',
      'Varint Decoding': 'varintMs',
      'Delta Decoding': 'deltaMs',
      'Chunk Grouping': 'chunkGroupingMs',
      'Block Placement': 'blockPlacementMs',
      'Cache Write': 'cacheWriteMs',
      'Cache Read': 'cacheReadMs'
    };
    
    return mapping[name] || null;
  }
  
  /**
   * Create a child benchmark for sub-operations
   */
  createChild(name: string): DetailedBenchmark {
    const child = new DetailedBenchmark(this.enabled);
    child.start();
    console.log(`\n📦 [${name}] Sub-benchmark started`);
    return child;
  }
}