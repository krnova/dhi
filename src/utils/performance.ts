// Performance Monitoring Utility

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private warningThreshold = 16; // 60fps threshold

  mark(name: string) {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark: string) {
    try {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name);
      
      if (entries.length > 0) {
        const entry = entries[entries.length - 1];
        
        this.metrics.push({
          name,
          duration: entry.duration,
          timestamp: Date.now(),
        });

        // Warn if slower than 60fps
        if (entry.duration > this.warningThreshold) {
          console.warn(
            `⚠️  Slow operation: ${name} took ${entry.duration.toFixed(2)}ms (threshold: ${this.warningThreshold}ms)`
          );
        }

        // Keep only last 100 metrics
        if (this.metrics.length > 100) {
          this.metrics.shift();
        }
      }
    } catch (err) {
      console.error('Performance measurement failed:', err);
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getSlowOperations(threshold = 16) {
    return this.metrics.filter(m => m.duration > threshold);
  }

  clear() {
    this.metrics = [];
    performance.clearMarks();
    performance.clearMeasures();
  }
}

export const perfMonitor = new PerformanceMonitor();
