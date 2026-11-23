import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Maximize, Minimize, RefreshCw, X } from "lucide-react";
import Image from "next/image";
import dayjs from "dayjs";

interface CheckInQrOverlayProps {
  url: string;
  expiresAt: string;
  /** Fetches a new code; resolves false if it couldn't. */
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}

// Swap in a fresh code a little before the current one expires, so the
// projected QR never goes stale.
const REFRESH_BEFORE_MS = 60_000;

// Covers the whole screen so it can be projected at the Meet & Greet.
// Always light-on-dark-text regardless of theme: QR scanners need contrast.
export function CheckInQrOverlay({
  url,
  expiresAt,
  onRefresh,
  onClose,
}: CheckInQrOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [refreshFailed, setRefreshFailed] = useState(false);
  const isRefreshing = useRef(false);

  const msLeft = new Date(expiresAt).getTime() - now;
  const isExpired = msLeft <= 0;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (msLeft > REFRESH_BEFORE_MS || refreshFailed || isRefreshing.current)
      return;
    isRefreshing.current = true;
    onRefresh().then((ok) => {
      isRefreshing.current = false;
      if (!ok) setRefreshFailed(true);
    });
  }, [msLeft, refreshFailed, onRefresh]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // While in browser fullscreen, the browser uses Escape to exit fullscreen.
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    const onFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      overlayRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Meet & Greet check-in QR code"
      data-testid="checkin-qr-overlay"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white text-gray-900 p-6"
    >
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          className="rounded-full p-3 text-gray-600 hover:bg-gray-100 transition"
        >
          {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR code"
          className="rounded-full p-3 text-gray-600 hover:bg-gray-100 transition"
        >
          <X size={24} />
        </button>
      </div>

      <Image
        src="/hackerspaceLogo.svg"
        alt="Hackerspace MMU"
        width={90}
        height={90}
      />
      <h1 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-center">
        Meet &amp; Greet Check-in
      </h1>
      <p className="mt-2 text-lg sm:text-2xl text-gray-600 text-center">
        Scan with your phone camera, then enter the email you registered with.
      </p>

      <div className="mt-6 rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        {isExpired ? (
          <div
            data-testid="checkin-qr-expired"
            className="flex flex-col items-center justify-center gap-4 text-center"
            style={{ width: "min(62vh, 80vw)", height: "min(62vh, 80vw)" }}
          >
            <p className="text-2xl font-bold">This QR code has expired</p>
            <p className="text-gray-600">
              {refreshFailed
                ? "We couldn't get a new code. You may need to sign in again."
                : "Getting a new code..."}
            </p>
            {refreshFailed && (
              <button
                type="button"
                onClick={() => setRefreshFailed(false)}
                className="flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 font-semibold text-white hover:bg-gray-700 transition"
              >
                <RefreshCw size={18} />
                Generate new code
              </button>
            )}
          </div>
        ) : (
          <QRCodeSVG
            value={url}
            level="M"
            marginSize={0}
            // Largest square that leaves room for the heading and footer.
            style={{ width: "min(62vh, 80vw)", height: "min(62vh, 80vw)" }}
            data-testid="checkin-qr-code"
          />
        )}
      </div>

      <p className="mt-5 text-sm text-gray-500 text-center">
        {isExpired
          ? "Codes are valid for one hour."
          : `Valid until ${dayjs(expiresAt).format("h:mm A")} · a new code appears automatically`}
      </p>
    </div>,
    document.body,
  );
}
