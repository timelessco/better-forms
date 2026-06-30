import { useEffect, useRef, useState } from "react";
import { onCLS, onINP, onLCP } from "web-vitals";
import {
  fireRecordVisit,
  fireUpdateVisitBeacon,
  flushQuestionProgressBuffer,
} from "./track-client";
import { cappedDurationMs } from "./duration";
import { getOrCreateSessionId, getOrCreateVisitorHash } from "./visitor-id";

interface SessionVitals {
  lcpMs?: number;
  inpMs?: number;
  cls?: number;
}

interface PublicFormTracking {
  visitId: string | null;
  visitorHash: string;
}

interface Args {
  formId: string;
  enabled?: boolean; // default true; allows preview mode to disable tracking
}

export const usePublicFormTracking = ({ formId, enabled = true }: Args): PublicFormTracking => {
  const [visitId, setVisitId] = useState<string | null>(null);
  const [visitorHash, setVisitorHash] = useState<string>("");

  const visitIdRef = useRef<string | null>(null);
  // Active-time tracking: only count foreground time. accumulatedRef holds completed visible spans;
  // resumeAtRef is the start of the current visible span (null while hidden/blurred).
  const accumulatedRef = useRef<number>(0);
  const resumeAtRef = useRef<number | null>(null);
  const vitalsRef = useRef<SessionVitals>({});

  // NOTE: dev StrictMode fires twice → two visit rows. Non-issue in prod
  // (single mount); cron dedupes by visitorHash so counts stay correct.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const hash = getOrCreateVisitorHash();
    const session = getOrCreateSessionId();
    setVisitorHash(hash);
    // Start the clock only if the page is actually visible on load.
    resumeAtRef.current = document.visibilityState === "visible" ? Date.now() : null;

    // Pause on hide/blur (tab switch, minimize, or focus moving to another window/devtools),
    // resume on show/focus — both transitions guard on resumeAtRef so the duplicate
    // visibilitychange+blur / visibilitychange+focus pairs can't double-count.
    const pauseTimer = () => {
      if (resumeAtRef.current !== null) {
        accumulatedRef.current += Date.now() - resumeAtRef.current;
        resumeAtRef.current = null;
      }
    };
    const resumeTimer = () => {
      if (resumeAtRef.current === null && document.visibilityState === "visible") {
        resumeAtRef.current = Date.now();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pauseTimer();
      else resumeTimer();
    };
    const activeDurationMs = () =>
      accumulatedRef.current +
      (resumeAtRef.current !== null ? Date.now() - resumeAtRef.current : 0);

    // CWV (RUM): web-vitals reports each metric once finalized (LCP on first
    // interaction/hide; INP/CLS on visibilitychange→hidden, before the pagehide
    // beacon). Stashed in a ref, shipped on the unload beacon (unfinalized omitted).
    // PerformanceObserver buffering means late registration still captures earlier entries.
    onLCP((metric) => {
      vitalsRef.current.lcpMs = Math.round(metric.value);
    });
    onINP((metric) => {
      vitalsRef.current.inpMs = Math.round(metric.value);
    });
    onCLS((metric) => {
      vitalsRef.current.cls = metric.value;
    });

    const params = new URLSearchParams(window.location.search);

    let cancelled = false;
    void fireRecordVisit({
      formId,
      visitorHash: hash,
      sessionId: session,
      referrer: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
    }).then((id) => {
      if (cancelled) {
        return;
      }
      visitIdRef.current = id;
      setVisitId(id);
    });

    const onUnload = () => {
      // Drain buffered per-Question events first so the visit-end beacon
      // doesn't race ahead of (and cancel) their delivery.
      flushQuestionProgressBuffer();
      const id = visitIdRef.current;
      if (!id) {
        return;
      }
      pauseTimer(); // fold the final visible span into the accumulated active time
      fireUpdateVisitBeacon({
        visitId: id,
        visitEndedAt: new Date().toISOString(),
        durationMs: cappedDurationMs(activeDurationMs()),
        lcpMs: vitalsRef.current.lcpMs,
        inpMs: vitalsRef.current.inpMs,
        cls: vitalsRef.current.cls,
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", resumeTimer);
    window.addEventListener("blur", pauseTimer);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", resumeTimer);
      window.removeEventListener("blur", pauseTimer);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [formId, enabled]);

  return { visitId, visitorHash };
};
