import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Maximize, Minimize, X } from "lucide-react";
import Image from "next/image";
import dayjs from "dayjs";

interface CheckInQrOverlayProps {
  url: string;
  expiresAt: string;
  onClose: () => void;
}

// Covers the whole screen so it can be projected at the Meet & Greet.
// Always light-on-dark-text regardless of theme: QR scanners need contrast.
export function CheckInQrOverlay({
  url,
  expiresAt,
  onClose,
}: CheckInQrOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        Scan with your phone camera, then pick your name.
      </p>

      <div className="mt-6 rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        <QRCodeSVG
          value={url}
          level="M"
          marginSize={0}
          // Largest square that leaves room for the heading and footer.
          style={{ width: "min(62vh, 80vw)", height: "min(62vh, 80vw)" }}
          data-testid="checkin-qr-code"
        />
      </div>

      <p className="mt-5 text-sm text-gray-500 text-center">
        Code valid until {dayjs(expiresAt).format("h:mm A")}
      </p>
    </div>,
    document.body,
  );
}
