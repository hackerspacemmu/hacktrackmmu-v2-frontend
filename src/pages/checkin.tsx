import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import axios from "axios";
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { apiUrl } from "@/utils/env";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  CHECK_IN_KINDS,
  isCheckInKind,
  type CheckInKind,
} from "@/components/Admin/ActionButton/LaunchQrCodeActionButton/checkInKinds";

// Public page opened by scanning a check-in QR code (regular session or Meet &
// Greet) on the admin dashboard. The `token` query param (signed by the backend,
// valid for an hour) authorises the check-in and fixes which event it is for.
// Members must type their exact registered email: there is no search, so the
// link can't be used to browse the membership list.

// Final results for an email that belongs to a member (see the `reason` codes
// in the backend's CheckInsController#create). Not-found and other retryable
// errors stay inline on the form instead.
type CheckInOutcome =
  | { reason: "checked_in"; name: string }
  | { reason: "already_checked_in"; name: string }
  | {
      reason: "checked_in_other_event";
      name: string;
      checkedInAt: CheckInKind;
    }
  | { reason: "already_onboarded"; name: string };

type PageState =
  | { kind: "verifying" }
  | { kind: "invalid"; message: string }
  | { kind: "form"; event: CheckInKind }
  | { kind: "done"; event: CheckInKind; outcome: CheckInOutcome };

const EMAIL_NOT_FOUND_MESSAGE =
  "This email doesn't exist, are you sure you registered with this email?";

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.error as string) || fallback;
  }
  return fallback;
}

export default function CheckInPage() {
  const router = useRouter();
  const { isDarkMode } = useDarkMode();
  const [state, setState] = useState<PageState>({ kind: "verifying" });

  const token =
    router.isReady && typeof router.query.token === "string"
      ? router.query.token
      : null;
  const missingToken = router.isReady && !token;

  const handleTokenRejected = useCallback(
    (message: string) => setState({ kind: "invalid", message }),
    [],
  );

  // ---- verify the QR token once the router has parsed the query string
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${apiUrl}/api/v1/check_ins/verify`, { params: { token } })
      .then((res) =>
        isCheckInKind(res.data.kind)
          ? setState({ kind: "form", event: res.data.kind })
          : setState({
              kind: "invalid",
              message: "We couldn't verify this QR code. Please try again.",
            }),
      )
      .catch((err) =>
        setState({
          kind: "invalid",
          message: errorMessage(
            err,
            "We couldn't verify this QR code. Please try again.",
          ),
        }),
      );
  }, [token]);

  const view: PageState = missingToken
    ? {
        kind: "invalid",
        message:
          "This check-in link is incomplete. Please scan the QR code again.",
      }
    : state;
  const title =
    view.kind === "form" || view.kind === "done"
      ? CHECK_IN_KINDS[view.event].title
      : "Check-in";

  return (
    <>
      <Head>
        <title>{`${title} | HackTrack MMU`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-white dark:bg-[#111] text-gray-900 dark:text-white flex flex-col items-center px-5 py-10">
        <div className="w-full max-w-md">
          <Image
            src={
              isDarkMode ? "/hackerspaceLogoWhite.svg" : "/hackerspaceLogo.svg"
            }
            alt="Hackerspace MMU"
            width={80}
            height={80}
            className="mx-auto"
          />
          <h1 className="mt-4 text-center text-3xl font-extrabold">{title}</h1>

          {view.kind === "verifying" && (
            <div className="mt-10 flex justify-center text-gray-500">
              <LoaderCircle className="animate-spin" />
            </div>
          )}

          {view.kind === "invalid" && (
            <StatusCard tone="error" title="QR code not valid">
              {view.message}
              <span className="block mt-2 text-sm">
                If this keeps happening, ask an organiser to show a new QR code.
              </span>
            </StatusCard>
          )}

          {view.kind === "form" && token && (
            <CheckInForm
              token={token}
              onDone={(outcome) =>
                setState({ kind: "done", event: view.event, outcome })
              }
              onTokenRejected={handleTokenRejected}
            />
          )}

          {view.kind === "done" && (
            <OutcomeCard
              event={view.event}
              outcome={view.outcome}
              onUseDifferentEmail={() =>
                setState({ kind: "form", event: view.event })
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

function CheckInForm({
  token,
  onDone,
  onTokenRejected,
}: {
  token: string;
  onDone: (outcome: CheckInOutcome) => void;
  onTokenRejected: (message: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{
    message: string;
    notFound: boolean;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !email.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await axios.post(`${apiUrl}/api/v1/check_ins`, {
        token,
        email: email.trim(),
      });
      onDone({
        reason: res.data.already_checked_in
          ? "already_checked_in"
          : "checked_in",
        name: res.data.name,
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : null;
      const data = axios.isAxiosError(err) ? err.response?.data : null;
      if (status === 401) {
        onTokenRejected(errorMessage(err, "This QR code is no longer valid."));
        return;
      }
      // The email belongs to a member, but there's nothing to check in.
      if (
        status === 409 &&
        data?.reason === "checked_in_other_event" &&
        isCheckInKind(data.checked_in_at)
      ) {
        onDone({
          reason: "checked_in_other_event",
          name: data.name,
          checkedInAt: data.checked_in_at,
        });
        return;
      }
      if (status === 409 && data?.reason === "already_onboarded") {
        onDone({ reason: "already_onboarded", name: data.name });
        return;
      }
      setError(
        status === 404
          ? { message: EMAIL_NOT_FOUND_MESSAGE, notFound: true }
          : {
              message: errorMessage(
                err,
                "Something went wrong. Please try again.",
              ),
              notFound: false,
            },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8" onSubmit={submit} noValidate>
      <label htmlFor="checkin-email" className="block font-semibold mb-1">
        Your email
      </label>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Enter the email you registered with.
      </p>

      <div className="relative">
        <Mail
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          id="checkin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={254}
          value={email}
          placeholder="you@example.com"
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "checkin-error" : undefined}
          className="w-full rounded-full border border-gray-300 dark:border-[#555] bg-white dark:bg-[#333] pl-11 pr-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
        />
      </div>

      {error && (
        <div
          id="checkin-error"
          role="alert"
          className={`mt-4 flex gap-3 rounded-2xl border p-4 ${
            error.notFound
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          <CircleAlert className="shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold">{error.message}</p>
            {error.notFound && (
              <p className="mt-1 text-sm">
                Check for typos, or ask an organiser for help.
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !email.trim()}
        className="mt-5 w-full flex items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed py-3 font-semibold text-white transition"
      >
        {isSubmitting && <LoaderCircle size={20} className="animate-spin" />}
        {isSubmitting ? "Checking in..." : "Check in"}
      </button>
    </form>
  );
}

function OutcomeCard({
  event,
  outcome,
  onUseDifferentEmail,
}: {
  event: CheckInKind;
  outcome: CheckInOutcome;
  onUseDifferentEmail: () => void;
}) {
  const kind = CHECK_IN_KINDS[event];

  if (outcome.reason === "checked_in") {
    return (
      <StatusCard tone="success" title={`You're checked in, ${outcome.name}!`}>
        {kind.welcome} You can close this page now.
      </StatusCard>
    );
  }

  // The remaining outcomes aren't errors: the member exists and there's simply
  // nothing to do. Offer a way back in case they typed someone else's email.
  const differentEmail = (
    <button
      type="button"
      onClick={onUseDifferentEmail}
      className="mt-4 text-sm underline underline-offset-2"
    >
      Not you? Use a different email
    </button>
  );

  if (outcome.reason === "already_checked_in") {
    return (
      <StatusCard
        tone="info"
        icon={BadgeCheck}
        title={`You're already checked in, ${outcome.name}!`}
        action={differentEmail}
      >
        You checked in to {kind.eventName} earlier, so there&apos;s nothing else
        to do. You can close this page now.
      </StatusCard>
    );
  }

  if (outcome.reason === "checked_in_other_event") {
    return (
      <StatusCard
        tone="info"
        icon={Info}
        title={`You've already checked in, ${outcome.name}`}
        action={differentEmail}
      >
        You checked in at {CHECK_IN_KINDS[outcome.checkedInAt].pastEventName}{" "}
        earlier, so you can&apos;t also check in for {kind.eventName}. If
        that&apos;s not right, please ask an organiser.
      </StatusCard>
    );
  }

  return (
    <StatusCard
      tone="info"
      icon={Info}
      title={`No need to check in, ${outcome.name}`}
      action={differentEmail}
    >
      You&apos;re already past this stage of onboarding, so you don&apos;t need
      to check in for {kind.eventName}. Enjoy!
    </StatusCard>
  );
}

const STATUS_CARD_TONES = {
  success: {
    styles:
      "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200",
    icon: CircleCheck,
  },
  info: {
    styles:
      "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    icon: Info,
  },
  error: {
    styles:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
    icon: CircleAlert,
  },
};

function StatusCard({
  tone,
  title,
  icon,
  action,
  children,
}: {
  tone: keyof typeof STATUS_CARD_TONES;
  title: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { styles, icon: defaultIcon } = STATUS_CARD_TONES[tone];
  const Icon = icon ?? defaultIcon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-8 rounded-2xl border p-6 text-center ${styles}`}
    >
      <Icon className="mx-auto" size={40} />
      <h2 className="mt-3 text-xl font-bold">{title}</h2>
      <p className="mt-2">{children}</p>
      {action}
    </div>
  );
}
