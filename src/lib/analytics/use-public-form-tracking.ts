import { useEffect, useRef, useState } from "react";
import {
  fireRecordVisit,
  fireUpdateVisitBeacon,
  flushQuestionProgressBuffer,
} from "./track-client";
import { getOrCreateSessionId, getOrCreateVisitorHash } from "./visitor-id";

interface PublicFormTracking {
  visitId: string | null;
  visitorHash: string;
}

interface Args {
  formId: string;
  enabled?: boolean; // default true; allows preview mode to disable tracking
}

const MAX_DURATION_MS = 86_400_000; // 24h

export const usePublicFormTracking = ({ formId, enabled = true }: Args): PublicFormTracking => {
  const [visitId, setVisitId] = useState<string | null>(null);
  const [visitorHash, setVisitorHash] = useState<string>("");

  const visitIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);

  // NOTE: in dev StrictMode this fires twice and creates two visit rows.
  // Production single-mount makes this a non-issue; the cron aggregation
  // dedupes by visitorHash so analytics counts remain correct.
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
    startedAtRef.current = Date.now();

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
      // Drain any buffered per-Question events first so the visit-end beacon
      // doesn't race ahead of (and effectively cancel) their delivery.
      flushQuestionProgressBuffer();
      const id = visitIdRef.current;
      if (!id) {
        return;
      }
      fireUpdateVisitBeacon({
        visitId: id,
        visitEndedAt: new Date().toISOString(),
        durationMs: Math.min(Date.now() - startedAtRef.current, MAX_DURATION_MS),
      });
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
  }, [formId, enabled]);

  return { visitId, visitorHash };
};
