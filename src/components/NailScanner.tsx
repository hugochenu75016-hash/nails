"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CARD_WIDTH_MM, CARD_HEIGHT_MM } from "@/lib/calibration";
import {
  FINGER_ORDER,
  BOX_WIDTH_FRAC,
  BOX_HEIGHT_FRAC,
  MIN_WIDTH_MM,
  MAX_WIDTH_MM,
  scanFingerBox,
} from "@/lib/fingerBox";
import { saveMeasurements, type FingerMeasurementMm } from "@/lib/measurementsStore";
import HandCue from "@/components/HandCue";

type Step = "intro" | "loading" | "calibrate" | "fingerScan";

/** Fraction of the video frame width the calibration guide rectangle
 * covers. The user aligns their card to this box, which fixes the
 * px-per-mm ratio for whatever is at that distance from the camera. */
const CARD_FRACTION_W = 0.55;

/** How long a finger must sit "good" in the box (in ms) before we
 * auto-capture it and move to the next one. */
const STABLE_MS = 700;
const SCAN_INTERVAL_MS = 180;

/** How long the ghost-hand cue is shown before live scanning starts,
 * for a given finger. */
const CUE_MS = 1300;

export default function NailScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pxPerMmRef = useRef<number | null>(null);
  const measurementsRef = useRef<FingerMeasurementMm[]>([]);
  const goodSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const cueActiveRef = useRef(true);

  const [step, setStep] = useState<Step>("intro");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fingerIndex, setFingerIndex] = useState(0);
  const [fingerGood, setFingerGood] = useState(false);
  const [cueVisible, setCueVisible] = useState(true);

  const finishAndClose = useCallback(() => {
    saveMeasurements(measurementsRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    // The global door transition (src/components/PageTransition.tsx) covers
    // this navigation — nothing measured is ever shown on this screen.
    router.push("/recommandations");
  }, [router]);

  // Start the camera once the client has read the instructions.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            aspectRatio: { ideal: 4 / 3 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setStep("calibrate");
      } catch {
        if (!cancelled) {
          setError(
            "Impossible d'accéder à la caméra. Vérifie les autorisations de ton navigateur."
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [started]);

  // While scanning a given finger, repeatedly crop the guide box out of the
  // live video and look for a stable, plausible edge-to-edge width in it.
  useEffect(() => {
    if (step !== "fingerScan") return;

    goodSinceRef.current = null;
    capturingRef.current = false;
    cueActiveRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting UI feedback for the newly-targeted finger, not derived data
    setFingerGood(false);
    setCueVisible(true);

    const cueTimer = setTimeout(() => {
      cueActiveRef.current = false;
      setCueVisible(false);
    }, CUE_MS);

    const tick = () => {
      const video = videoRef.current;
      const pxPerMm = pxPerMmRef.current;
      if (
        !video ||
        !pxPerMm ||
        video.readyState < 2 ||
        capturingRef.current ||
        cueActiveRef.current
      ) {
        return;
      }

      const boxW = Math.round(video.videoWidth * BOX_WIDTH_FRAC);
      const boxH = Math.round(video.videoHeight * BOX_HEIGHT_FRAC);
      const boxX = Math.round((video.videoWidth - boxW) / 2);
      const boxY = Math.round((video.videoHeight - boxH) / 2);

      if (!cropCanvasRef.current) cropCanvasRef.current = document.createElement("canvas");
      const crop = cropCanvasRef.current;
      crop.width = boxW;
      crop.height = boxH;
      const ctx = crop.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, boxX, boxY, boxW, boxH, 0, 0, boxW, boxH);
      const imageData = ctx.getImageData(0, 0, boxW, boxH);

      const result = scanFingerBox(imageData);
      const widthMm = result.widthPx / pxPerMm;
      const good = result.confident && widthMm >= MIN_WIDTH_MM && widthMm <= MAX_WIDTH_MM;

      setFingerGood((prev) => (prev === good ? prev : good));

      if (!good) {
        goodSinceRef.current = null;
        return;
      }

      if (goodSinceRef.current === null) {
        goodSinceRef.current = performance.now();
        return;
      }

      if (performance.now() - goodSinceRef.current >= STABLE_MS) {
        capturingRef.current = true;
        measurementsRef.current = [
          ...measurementsRef.current,
          {
            name: FINGER_ORDER[fingerIndex],
            widthMm: Math.round(widthMm * 10) / 10,
            confident: true,
          },
        ];
        if (fingerIndex >= FINGER_ORDER.length - 1) {
          finishAndClose();
        } else {
          setFingerIndex((i) => i + 1);
        }
      }
    };

    const interval = setInterval(tick, SCAN_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(cueTimer);
    };
  }, [step, fingerIndex, finishAndClose]);

  const beginScan = useCallback(() => {
    setStep("loading");
    setStarted(true);
  }, []);

  const confirmCalibration = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const rectW = video.videoWidth * CARD_FRACTION_W;
    pxPerMmRef.current = rectW / CARD_WIDTH_MM;
    measurementsRef.current = [];
    setFingerIndex(0);
    setStep("fingerScan");
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {error ? (
        <p className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>
      ) : step === "intro" ? (
        <div className="text-center">
          <h2 className="font-semibold">Avant de commencer</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hand-guide.png"
            alt="Exemple de bonne position : paume face à la caméra, doigts écartés, main centrée dans le cadre, fond uni"
            className="mx-auto mt-4 w-full max-w-sm rounded-2xl border border-neutral-200"
          />
          <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-neutral-600">
            <li>• On scanne chaque doigt un par un (pouce, index, majeur, annulaire, auriculaire)</li>
            <li>• Approche un seul doigt à la fois, bien centré dans le cadre</li>
            <li>• Fond uni et bonne lumière, sans ombre dure</li>
            <li>• Garde la même distance à la calibration et à chaque doigt</li>
          </ul>
          <button
            onClick={beginScan}
            className="mt-6 rounded-full bg-neutral-900 px-6 py-2.5 text-white font-medium hover:bg-neutral-700 transition-colors"
          >
            Commencer le scan
          </button>
        </div>
      ) : (
        <>
          <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />

            {step === "calibrate" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div
                  className="rounded-lg border-4 border-dashed border-green-500"
                  style={{
                    width: `${CARD_FRACTION_W * 100}%`,
                    aspectRatio: `${CARD_WIDTH_MM} / ${CARD_HEIGHT_MM}`,
                  }}
                />
              </div>
            )}

            {step === "fingerScan" && cueVisible && (
              <HandCue target={FINGER_ORDER[fingerIndex]} />
            )}

            {step === "fingerScan" && !cueVisible && (
              <>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={`rounded-2xl border-4 border-dashed transition-colors duration-200 ${
                      fingerGood ? "border-green-500" : "border-white/80"
                    }`}
                    style={{
                      width: `${BOX_WIDTH_FRAC * 100}%`,
                      height: `${BOX_HEIGHT_FRAC * 100}%`,
                    }}
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-12">
                  <p
                    className={`text-center text-base font-semibold transition-colors ${
                      fingerGood ? "text-green-400" : "text-white"
                    }`}
                  >
                    {fingerGood
                      ? "Parfait, ne bouge pas…"
                      : `Place ton ${FINGER_ORDER[fingerIndex]} dans le cadre`}
                  </p>
                  <p className="mt-1 text-center text-xs text-white/70">
                    Doigt {fingerIndex + 1} / {FINGER_ORDER.length}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-6">
            {step === "loading" && (
              <p className="text-center text-neutral-500">
                Chargement de la caméra…
              </p>
            )}

            {step === "calibrate" && (
              <div className="text-center">
                <h2 className="font-semibold">Calibration</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Place une carte bancaire ou d&apos;identité dans le
                  rectangle vert, à la même distance de la caméra que tu
                  tiendras ton doigt ensuite.
                </p>
                <button
                  onClick={confirmCalibration}
                  className="mt-4 rounded-full bg-neutral-900 px-6 py-2.5 text-white font-medium hover:bg-neutral-700 transition-colors"
                >
                  Carte alignée, continuer
                </button>
              </div>
            )}

            {step === "fingerScan" && !cueVisible && (
              <p className="text-center text-xs text-neutral-400">
                Le scan se lance automatiquement dès que le doigt est bien
                placé, pas besoin d&apos;appuyer sur un bouton.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
