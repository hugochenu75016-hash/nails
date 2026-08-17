"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { getHandLandmarker } from "@/lib/handLandmarker";
import { CARD_WIDTH_MM, CARD_HEIGHT_MM } from "@/lib/calibration";
import { FINGERS, measureFingerWidths } from "@/lib/nailMeasurement";
import { assessPose, POSE_MESSAGES, type PoseIssue } from "@/lib/poseQuality";
import { saveMeasurements } from "@/lib/measurementsStore";

type Step = "intro" | "loading" | "calibrate" | "scan" | "closing";

/** How long the pose must stay "good" (in ms) before we auto-capture. */
const STABLE_MS = 900;

/** Fraction of the video frame width the calibration guide rectangle
 * covers. The user aligns their card to this box, which fixes the
 * px-per-mm ratio for whatever is at that distance from the camera. */
const CARD_FRACTION_W = 0.55;

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
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestResultRef = useRef<HandLandmarkerResult | null>(null);
  const pxPerMmRef = useRef<number | null>(null);
  const stepRef = useRef<Step>("intro");
  const goodSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const lastIssueRef = useRef<PoseIssue | null>(null);

  const [step, setStep] = useState<Step>("intro");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poseIssue, setPoseIssue] = useState<PoseIssue>("no-hand");
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const captureAndClose = useCallback(() => {
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

    saveMeasurements(
      raw.map((r) => ({
        name: r.name,
        widthMm: Math.round((r.widthPx / pxPerMm) * 10) / 10,
        confident: r.confident,
      }))
    );

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStep("closing");
  }, []);

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
            const now = performance.now();
            const result = landmarker.detectForVideo(video, now);
            latestResultRef.current = result;
            draw(canvas, result, stepRef.current);

            if (stepRef.current === "scan" && !capturingRef.current) {
              const issue = assessPose(result.landmarks[0]);
              if (issue !== lastIssueRef.current) {
                lastIssueRef.current = issue;
                setPoseIssue(issue);
              }
              if (issue === "good") {
                if (goodSinceRef.current === null) goodSinceRef.current = now;
                if (now - goodSinceRef.current >= STABLE_MS) {
                  capturingRef.current = true;
                  captureAndClose();
                }
              } else {
                goodSinceRef.current = null;
              }
            }
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
  }, [started, captureAndClose]);

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

  // Once the "doors" have shut on the confirmed scan, hold on the ONE STUD'
  // mark for a beat, then hand off to the recommendations page. Nothing
  // measured is ever surfaced to the client on this screen.
  useEffect(() => {
    if (step !== "closing") return;
    // "closing" is only ever entered once per scan, so `closed` starts at
    // its initial `false` — no need to reset it here.
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setClosed(true));
    });
    const redirectTimer = setTimeout(() => {
      router.push("/recommandations");
    }, 1500);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(redirectTimer);
    };
  }, [step, router]);

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

            {step === "closing" && (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className={`absolute inset-x-0 top-0 h-1/2 bg-black transition-transform duration-500 ease-out ${
                    closed ? "translate-y-0" : "-translate-y-full"
                  }`}
                />
                <div
                  className={`absolute inset-x-0 bottom-0 h-1/2 bg-black transition-transform duration-500 ease-out ${
                    closed ? "translate-y-0" : "translate-y-full"
                  }`}
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-500 delay-300 ${
                    closed ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  }`}
                >
                  <span className="text-3xl font-black tracking-tight text-white">
                    ONE STUD&apos;
                  </span>
                </div>
              </div>
            )}
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
                <p
                  className={`mt-1 text-sm font-medium ${
                    poseIssue === "good" ? "text-green-600" : "text-neutral-600"
                  }`}
                >
                  {POSE_MESSAGES[poseIssue]}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Le scan se lance automatiquement dès que la position est
                  bonne, pas besoin d&apos;appuyer sur un bouton.
                </p>
              </div>
            )}

            {step === "closing" && (
              <p className="text-center text-sm text-neutral-400">
                Mesures enregistrées.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
