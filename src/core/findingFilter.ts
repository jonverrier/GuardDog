/**
 * @module core/findingFilter
 * Filters findings by severity and impact thresholds.
 */
// Copyright (c) 2025 Jon Verrier

// ===Start StrongAI Generated Comment (20260524)===
// This module filters review findings by minimum severity and impact thresholds, and can also cap the number of findings returned. It relies on schema types and constants from ../schemas/finding, including IFinding and IReviewResult shapes, the FindingSeverity and FindingImpact string unions, and the ordering arrays used to compare levels.
// 
// levelRank converts a severity or impact label into a numeric rank based on the configured ordering. Unknown values fall back to rank 0. meetsMinimum compares two levels and returns whether the actual value meets or exceeds the required minimum using levelRank.
// 
// filterFindings takes a list of IFinding records and returns only those whose severity and impact both satisfy the minimum thresholds. applyFindingFilters applies filterFindings to an IReviewResult, slices the results to maxFindings, and returns a new review result with an updated summary. The summary’s findingCount, highSeverityCount, and criticalSeverityCount are recomputed from the filtered list.
// 
// IMPACT_ORDER is re-exported for testing to confirm ordering behavior.
// ===End StrongAI Generated Comment===


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
