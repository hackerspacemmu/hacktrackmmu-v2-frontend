import { QrCode } from "lucide-react";
import { useCallback, useState } from "react";
import axios from "axios";
import { ActionButton } from "..";
import { CheckInQrOverlay } from "./CheckInQrOverlay";
import useAuthStore from "@/store/useAuthStore";
import { useToast } from "@/components/Toast/ToastProvider";
import { apiUrl } from "@/utils/env";

interface CheckInSession {
  url: string;
  expiresAt: string;
}

export function LaunchQrCodeActionButton() {
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [session, setSession] = useState<CheckInSession | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // Each session token is valid for an hour (set by the backend).
  const requestSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await axios.post(
        `${apiUrl}/api/v1/check_ins/session`,
        {},
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const url = `${window.location.origin}/checkin?token=${encodeURIComponent(res.data.token)}`;
      setSession({ url, expiresAt: res.data.expires_at });
      return true;
    } catch {
      return false;
    }
  }, [token]);

  const handleLaunch = async () => {
    if (isLaunching) return;
    setIsLaunching(true);
    const ok = await requestSession();
    setIsLaunching(false);
    if (!ok) {
      showToast("Couldn't launch the check-in QR code. Try again.", "error");
    }
  };

  return (
    <>
      <ActionButton
        label={isLaunching ? "Launching..." : "Launch QR Code"}
        icon={<QrCode />}
        onClick={handleLaunch}
        bgColor="border-teal-500"
        textColor="text-teal-500"
        hoverShadowColor="hover:shadow-teal-500/50"
      />

      {session && (
        <CheckInQrOverlay
          url={session.url}
          expiresAt={session.expiresAt}
          onRefresh={requestSession}
          onClose={() => setSession(null)}
        />
      )}
    </>
  );
}
