/**
 * @module core/findingFilter
 * Filters findings by severity and impact thresholds.
 */
// Copyright (c) 2025 Jon Verrier

import {
   FindingImpact,
   FindingSeverity,
   IFinding,
   IMPACT_ORDER,
   IReviewResult,
   SEVERITY_ORDER
} from '../schemas/finding';

/**
 * Returns the numeric rank of a severity level.
 * @param level - Severity or impact level
 */
export function levelRank(level: FindingSeverity | FindingImpact): number {
   const order = SEVERITY_ORDER as readonly string[];
   const index = order.indexOf(level);
   return index >= 0 ? index : 0;
}

/**
 * Returns true if `value` meets or exceeds `minimum`.
 * @param value - Actual level
 * @param minimum - Minimum required level
 */
export function meetsMinimum(
   value: FindingSeverity | FindingImpact,
   minimum: FindingSeverity | FindingImpact
): boolean {
   return levelRank(value) >= levelRank(minimum);
}

/**
 * Filters findings that meet both severity and impact thresholds.
 * @param findings - All findings
 * @param minSeverity - Minimum severity
 * @param minImpact - Minimum impact
 */
export function filterFindings(
   findings: IFinding[],
   minSeverity: FindingSeverity,
   minImpact: FindingImpact
): IFinding[] {
   return findings.filter(
      (finding) =>
         meetsMinimum(finding.severity, minSeverity) && meetsMinimum(finding.impact, minImpact)
   );
}

/**
 * Applies filtering and max-findings limit to a review result.
 * @param result - Full review result
 * @param minSeverity - Minimum severity
 * @param minImpact - Minimum impact
 * @param maxFindings - Maximum findings to include
 */
export function applyFindingFilters(
   result: IReviewResult,
   minSeverity: FindingSeverity,
   minImpact: FindingImpact,
   maxFindings: number
): IReviewResult {
   const filtered = filterFindings(result.findings, minSeverity, minImpact).slice(0, maxFindings);
   const highSeverityCount = filtered.filter((f) => f.severity === 'high').length;
   const criticalSeverityCount = filtered.filter((f) => f.severity === 'critical').length;

   return {
      ...result,
      summary: {
         ...result.summary,
         findingCount: filtered.length,
         highSeverityCount,
         criticalSeverityCount
      },
      findings: filtered
   };
}

/** Exported for tests — impact uses same ordering as severity. */
export { IMPACT_ORDER };
