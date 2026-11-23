import { QrCode } from "lucide-react";
import { useCallback, useState } from "react";
import axios from "axios";
import { ActionButton } from "..";
import { CheckInQrOverlay } from "./CheckInQrOverlay";
import useAuthStore from "@/store/useAuthStore";
import { useToast } from "@/components/Toast/ToastProvider";
import { apiUrl } from "@/utils/env";
import { CHECK_IN_KINDS, type CheckInKind } from "./checkInKinds";

interface CheckInSession {
  url: string;
  expiresAt: string;
}

export function LaunchQrCodeActionButton({ kind }: { kind: CheckInKind }) {
  const config = CHECK_IN_KINDS[kind];
  const { token } = useAuthStore();
  const { showToast } = useToast();
  const [session, setSession] = useState<CheckInSession | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  // Each session token is valid for 30 minutes (set by the backend) and is tied
  // to this kind, which decides the status members are moved to.
  const requestSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await axios.post(
        `${apiUrl}/api/v1/check_ins/session`,
        { kind },
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
  }, [token, kind]);

  const handleLaunch = async () => {
    if (isLaunching) return;
    setIsLaunching(true);
    const ok = await requestSession();
    setIsLaunching(false);
    if (!ok) {
      showToast("Couldn't launch the check-in QR code. Try again.", "error");
    }
  };

  // The two QR buttons share one grid slot, so the label always breaks after
  // its first word ("Meetup / First Timers", "M&G / First Timers") to keep
  // both buttons the same shape.
  const [firstWord, ...restWords] = config.buttonLabel.split(" ");
  const label = isLaunching ? (
    "Launching..."
  ) : (
    <>
      {firstWord} <br />
      {restWords.join(" ")}
    </>
  );

  return (
    <>
      <ActionButton
        label={label}
        icon={<QrCode />}
        onClick={handleLaunch}
        bgColor={config.borderColor}
        textColor={config.textColor}
        hoverShadowColor={config.hoverShadowColor}
      />

      {session && (
        <CheckInQrOverlay
          title={config.title}
          url={session.url}
          expiresAt={session.expiresAt}
          onRefresh={requestSession}
          onClose={() => setSession(null)}
        />
      )}
    </>
  );
}
