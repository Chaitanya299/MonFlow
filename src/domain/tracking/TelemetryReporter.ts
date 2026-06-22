export interface ObservabilityMetrics {
  totalScanned: number;
  totalParsed: number;
  totalFailures: number;
  templateHits: Record<string, number>;
  anomalies: { text: string; reason: string; timestamp: number }[];
}

export class TelemetryReporter {
  private static metrics: ObservabilityMetrics = {
    totalScanned: 0,
    totalParsed: 0,
    totalFailures: 0,
    templateHits: {},
    anomalies: []
  };

  private static MAX_ANOMALIES = 100;

  static logScan(): void {
    this.metrics.totalScanned++;
  }

  static logParse(templateId: string | null): void {
    this.metrics.totalParsed++;
    if (templateId) {
      this.metrics.templateHits[templateId] = (this.metrics.templateHits[templateId] || 0) + 1;
    }
  }

  static logFailure(): void {
    this.metrics.totalFailures++;
  }

  /**
   * Logs an anomaly after running a strict redaction scrubber to prevent PII
   * (phone numbers, account numbers, amounts, UPI IDs) from leaking into memory or telemetry stores.
   */
  static logAnomaly(text: string, reason: string): void {
    const scrubbed = this.redactPII(text);
    this.metrics.anomalies.push({
      text: scrubbed,
      reason,
      timestamp: Date.now()
    });

    if (this.metrics.anomalies.length > this.MAX_ANOMALIES) {
      this.metrics.anomalies.shift();
    }
  }

  /**
   * Returns a deep, immutable copy of the telemetry metrics to prevent state mutation.
   */
  static getMetrics(): ObservabilityMetrics {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  static clear(): void {
    this.metrics = {
      totalScanned: 0,
      totalParsed: 0,
      totalFailures: 0,
      templateHits: {},
      anomalies: []
    };
  }

  private static redactPII(text: string): string {
    if (!text) return '';
    let clean = text;

    // 1. Scrub UPI IDs
    clean = clean.replace(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g, 'user@upi');

    // 2. Scrub Indian Phone Numbers
    clean = clean.replace(/(?:\+91|0)?[6-9]\d{9}/g, '+91-XXXXX-XXXXX');

    // 3. Scrub Account/Card masks
    clean = clean.replace(/\b(?:A\/c|account|card|a\/c)\s+(?:X+|x+|\*+)?(\d+)\b/gi, (match) => {
      return match.replace(/\d+$/, 'XXXX');
    });

    // 4. Scrub raw transaction amounts / numbers
    clean = clean.replace(/(?:₹|Rs|INR)\s*[\d,]+(?:\.\d+)?/gi, '₹XX.XX');

    return clean;
  }
}
