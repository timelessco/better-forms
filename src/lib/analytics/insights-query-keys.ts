import type { QueryClient } from "@tanstack/react-query";

export const insightsAvailabilityKey = (formId: string) =>
  ["insights-availability", formId] as const;

export const insightsKey = (formId: string) => ["insights", formId] as const;

export const dropoffKey = (formId: string) => ["dropoff", formId] as const;

export const vitalsKey = (formId: string) => ["vitals", formId] as const;

/**
 * Invalidates every Insights-tab query for a form. Used after analytics is
 * toggled (from either the share sidebar or the dashboard's empty state) so
 * an open Insights tab swaps prompt ↔ metrics without a manual reload.
 */
export const invalidateInsightsQueries = (queryClient: QueryClient, formId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: insightsAvailabilityKey(formId) }),
    queryClient.invalidateQueries({ queryKey: insightsKey(formId) }),
    queryClient.invalidateQueries({ queryKey: dropoffKey(formId) }),
    queryClient.invalidateQueries({ queryKey: vitalsKey(formId) }),
  ]);
