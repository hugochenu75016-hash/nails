"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "@/lib/handLandmarker";
import { CARD_WIDTH_MM, CARD_HEIGHT_MM } from "@/lib/calibration";
import { FINGERS, measureFingerWidths } from "@/lib/nailMeasurement";

type Step = "intro" | "loading" | "calibrate" | "scan" | "results";

/** Fraction of the video frame width the calibration guide rectangle
 * covers. The user aligns their card to this box, which fixes the
 * px-per-mm ratio for whatever is at that distance from the camera. */
const CARD_FRACTION_W = 0.55;

interface Result {
  name: string;
  widthMm: number;
  confident: boolean;
}

function draw(
  canvas: HTMLCanvasElement,
  result: HandLandmarkerResult,
  currentStep: Step
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentStep === "calibrate") {
    const rectW = canvas.width * CARD_FRACTION_W;
    const rectH = rectW * (CARD_HEIGHT_MM / CARD_WIDTH_MM);
    const x = (canvas.width - rectW) / 2;
    const y = (canvas.height - rectH) / 2;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = Math.max(2, canvas.width * 0.004);
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(x, y, rectW, rectH);
    ctx.setLineDash([]);
    return;
  }

  const landmarks = result.landmarks[0];
  if (!landmarks) return;

  ctx.fillStyle = "#22c55e";
  for (const { dip, tip } of FINGERS) {
    const d = landmarks[dip];
    const t = landmarks[tip];
    ctx.beginPath();
    ctx.moveTo(d.x * canvas.width, d.y * canvas.height);
    ctx.lineTo(t.x * canvas.width, t.y * canvas.height);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = Math.max(2, canvas.width * 0.003);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.x * canvas.width, t.y * canvas.height, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function NailScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestResultRef = useRef<HandLandmarkerResult | null>(null);
  const pxPerMmRef = useRef<number | null>(null);
  const stepRef = useRef<Step>("intro");

  const [step, setStep] = useState<Step>("intro");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // Start camera + hand landmark model, then run a continuous detection loop.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
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
      } catch {
        if (!cancelled) {
          setError(
            "Impossible d'accéder à la caméra. Vérifie les autorisations de ton navigateur."
          );
        }
        return;
      }

      try {
        const landmarker = await getHandLandmarker();
        if (cancelled) return;

        if (!cancelled) setStep("calibrate");

        const loop = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= 2) {
            if (canvas.width !== video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const result = landmarker.detectForVideo(video, performance.now());
            latestResultRef.current = result;
            setHandDetected(result.landmarks.length > 0);
            draw(canvas, result, stepRef.current);
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) {
          setError(
            "Impossible de charger le modèle de détection de main. Vérifie ta connexion internet."
          );
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [started]);

  const beginScan = useCallback(() => {
    setStep("loading");
    setStarted(true);
  }, []);

  const confirmCalibration = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const rectW = video.videoWidth * CARD_FRACTION_W;
    pxPerMmRef.current = rectW / CARD_WIDTH_MM;
    setStep("scan");
  }, []);

  const captureMeasurement = useCallback(() => {
    const video = videoRef.current;
    const pxPerMm = pxPerMmRef.current;
    const result = latestResultRef.current;
    const landmarks = result?.landmarks[0];
    if (!video || !pxPerMm || !landmarks) return;

    const off = document.createElement("canvas");
    off.width = video.videoWidth;
    off.height = video.videoHeight;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, off.width, off.height);
    const imageData = ctx.getImageData(0, 0, off.width, off.height);

    const maxScanPx = pxPerMm * 12; // widest plausible half-finger-width, in mm
    const raw = measureFingerWidths(imageData, landmarks, maxScanPx);

    setResults(
      raw.map((r) => ({
        name: r.name,
        widthMm: Math.round((r.widthPx / pxPerMm) * 10) / 10,
        confident: r.confident,
      }))
    );
    setStep("results");
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
            <li>• Paume (ou dos de la main) bien face à la caméra</li>
            <li>• Doigts écartés, main centrée dans le cadre</li>
            <li>• Fond uni et bonne lumière, sans ombre dure</li>
            <li>• Garde la même distance à la calibration et au scan</li>
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
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
            />
          </div>

          <div className="mt-6">
            {step === "loading" && (
              <p className="text-center text-neutral-500">
                Chargement de la caméra et du modèle de détection…
              </p>
            )}

            {step === "calibrate" && (
              <div className="text-center">
                <h2 className="font-semibold">Calibration</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Place une carte bancaire ou d&apos;identité dans le
                  rectangle vert, à la même distance de la caméra que tu
                  tiendras ta main ensuite.
                </p>
                <button
                  onClick={confirmCalibration}
                  className="mt-4 rounded-full bg-neutral-900 px-6 py-2.5 text-white font-medium hover:bg-neutral-700 transition-colors"
                >
                  Carte alignée, continuer
                </button>
              </div>
            )}

            {step === "scan" && (
              <div className="text-center">
                <h2 className="font-semibold">Scan de la main</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  {handDetected
                    ? "Main détectée. Garde la même distance qu'à la calibration, puis capture."
                    : "Présente ta main, paume ou dos face à la caméra, doigts écartés."}
                </p>
                <button
                  onClick={captureMeasurement}
                  disabled={!handDetected}
                  className="mt-4 rounded-full bg-neutral-900 px-6 py-2.5 text-white font-medium hover:bg-neutral-700 transition-colors disabled:opacity-40 disabled:hover:bg-neutral-900"
                >
                  Capturer la mesure
                </button>
              </div>
            )}

            {step === "results" && results && (
              <div>
                <h2 className="text-center font-semibold">Résultats</h2>
                <ul className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
                  {results.map((r) => (
                    <li
                      key={r.name}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span>{r.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono">{r.widthMm} mm</span>
                        {!r.confident && (
                          <span
                            title="Bord peu contrasté détecté — mesure moins fiable"
                            className="text-xs text-amber-600"
                          >
                            ⚠
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-center text-xs text-neutral-400">
                  Estimation V1 — précision indicative. Un fond uni et un bon
                  éclairage améliorent le résultat.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => setStep("scan")}
                    className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50"
                  >
                    Rescanner
                  </button>
                  <button
                    onClick={() => setStep("calibrate")}
                    className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50"
                  >
                    Recalibrer
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
