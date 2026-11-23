import { useCallback, useEffect, useId, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import axios from "axios";
import { CircleAlert, CircleCheck, LoaderCircle, Search } from "lucide-react";
import { apiUrl } from "@/utils/env";
import { useDarkMode } from "@/hooks/useDarkMode";

// Public page opened by scanning the Meet & Greet QR code on the admin dashboard.
// The `token` query param (signed by the backend) authorises search + check-in.

interface Candidate {
  id: number;
  name: string;
  masked_email: string | null;
}

type PageState =
  | { kind: "verifying" }
  | { kind: "invalid"; message: string }
  | { kind: "searching" }
  | { kind: "done"; name: string; alreadyCheckedIn: boolean };

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;
const EMAIL_NOT_FOUND_MESSAGE =
  "This email doesn't exist, are you sure you registered with this email?";

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.error as string) || fallback;
  }
  return fallback;
}

function isUnauthorized(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
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

  // Stable so CheckInForm's search effect doesn't re-run on every render.
  const handleTokenRejected = useCallback(
    (message: string) => setState({ kind: "invalid", message }),
    [],
  );

  // ---- verify the QR token once the router has parsed the query string
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${apiUrl}/api/v1/check_ins/verify`, { params: { token } })
      .then(() => setState({ kind: "searching" }))
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

  return (
    <>
      <Head>
        <title>Meet &amp; Greet Check-in | HackTrack MMU</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
          <h1 className="mt-4 text-center text-3xl font-extrabold">
            Meet &amp; Greet Check-in
          </h1>

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

          {view.kind === "searching" && token && (
            <CheckInForm
              token={token}
              onDone={(name, alreadyCheckedIn) =>
                setState({ kind: "done", name, alreadyCheckedIn })
              }
              onTokenRejected={handleTokenRejected}
            />
          )}

          {view.kind === "done" && (
            <StatusCard
              tone="success"
              title={
                view.alreadyCheckedIn
                  ? `You're already checked in, ${view.name}!`
                  : `You're checked in, ${view.name}!`
              }
            >
              Welcome to the Meet &amp; Greet. You can close this page now.
            </StatusCard>
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
  onDone: (name: string, alreadyCheckedIn: boolean) => void;
  onTokenRejected: (message: string) => void;
}) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  const [query, setQuery] = useState("");
  // Results are stored with the query they answer, so stale or short queries
  // simply don't match and render as "no results yet".
  const [searchResult, setSearchResult] = useState<{
    query: string;
    data: Candidate[];
  } | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showNotListed, setShowNotListed] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmed = query.trim();
  const isQueryLongEnough = trimmed.length >= MIN_QUERY_LENGTH;
  const hasSearched = isQueryLongEnough && searchResult?.query === trimmed;
  const isSearching = isQueryLongEnough && !selected && !hasSearched;
  const results = hasSearched ? searchResult.data : [];

  // ---- debounced search; only the latest request's response is applied
  useEffect(() => {
    if (selected || trimmed.length < MIN_QUERY_LENGTH) return;
    const seq = ++searchSeq.current;

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/v1/check_ins/search`, {
          params: { token, query: trimmed },
        });
        if (seq !== searchSeq.current) return;
        setSearchResult({ query: trimmed, data: res.data.data ?? [] });
        setActiveIndex(-1);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        if (isUnauthorized(err)) {
          onTokenRejected(
            errorMessage(err, "This QR code is no longer valid."),
          );
          return;
        }
        setSearchResult({ query: trimmed, data: [] });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, token, selected, onTokenRejected]);

  const choose = (candidate: Candidate) => {
    setSelected(candidate);
    setQuery(candidate.name);
    setIsListOpen(false);
    setShowNotListed(false);
    setSubmitError(null);
  };

  const showNotListedMessage = () => {
    setShowNotListed(true);
    setIsListOpen(false);
  };

  const clearSelection = () => {
    setSelected(null);
    setSubmitError(null);
    setIsListOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isListOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      choose(results[activeIndex]);
    } else if (e.key === "Escape") {
      setIsListOpen(false);
    }
  };

  const confirm = async () => {
    if (!selected || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await axios.post(`${apiUrl}/api/v1/check_ins`, {
        token,
        member_id: selected.id,
      });
      onDone(res.data.name, Boolean(res.data.already_checked_in));
    } catch (err) {
      if (isUnauthorized(err)) {
        onTokenRejected(errorMessage(err, "This QR code is no longer valid."));
        return;
      }
      setSubmitError(
        errorMessage(err, "Something went wrong. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const noMatches =
    !selected && hasSearched && !isSearching && results.length === 0;
  const dropdownVisible =
    !selected &&
    isListOpen &&
    trimmed.length >= MIN_QUERY_LENGTH &&
    (isSearching || results.length > 0);

  return (
    <div className="mt-8">
      <label htmlFor="checkin-search" className="block font-semibold mb-1">
        Find your name
      </label>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Type your name (or the email you registered with), then pick yourself
        from the list.
      </p>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          id="checkin-search"
          type="text"
          role="combobox"
          aria-expanded={dropdownVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          value={query}
          readOnly={Boolean(selected)}
          placeholder="e.g. Jason Lee"
          onChange={(e) => {
            setQuery(e.target.value);
            setIsListOpen(true);
            setShowNotListed(false);
          }}
          onFocus={() => !selected && setIsListOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-full border border-gray-300 dark:border-[#555] bg-white dark:bg-[#333] pl-11 pr-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 read-only:bg-gray-100 dark:read-only:bg-[#222]"
        />

        {dropdownVisible && (
          <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1c1c1c] shadow-lg">
            <ul id={listboxId} role="listbox" aria-label="Matching members">
              {isSearching && results.length === 0 ? (
                <li className="px-5 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <LoaderCircle size={16} className="animate-spin" />
                  Searching...
                </li>
              ) : (
                results.map((c, i) => (
                  <li
                    key={c.id}
                    id={`${listboxId}-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    // mousedown so the choice lands before the input blurs
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(c);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`px-5 py-3 cursor-pointer border-b last:border-b-0 border-gray-100 dark:border-[#333] ${
                      i === activeIndex ? "bg-blue-50 dark:bg-[#2a2a2a]" : ""
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    {c.masked_email && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {c.masked_email}
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
            {results.length > 0 && (
              <button
                type="button"
                // mousedown so it fires before the input loses focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  showNotListedMessage();
                }}
                className="w-full px-5 py-3 text-left text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-[#333] underline underline-offset-2"
              >
                My email isn&apos;t listed
              </button>
            )}
          </div>
        )}
      </div>

      {!selected &&
        !dropdownVisible &&
        trimmed.length > 0 &&
        trimmed.length < MIN_QUERY_LENGTH && (
          <p className="mt-3 text-sm text-gray-500">Keep typing...</p>
        )}

      {(noMatches || showNotListed) && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200"
        >
          <CircleAlert className="shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold">{EMAIL_NOT_FOUND_MESSAGE}</p>
            <p className="mt-1 text-sm">
              Try the name you used when registering, or ask an organiser for
              help.
            </p>
          </div>
        </div>
      )}

      {!selected &&
        !dropdownVisible &&
        results.length > 0 &&
        !showNotListed && (
          <button
            type="button"
            onClick={showNotListedMessage}
            className="mt-3 text-sm text-gray-500 dark:text-gray-400 underline underline-offset-2"
          >
            My email isn&apos;t listed
          </button>
        )}

      {selected && (
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-[#444] p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Checking in as
          </p>
          <p className="mt-1 text-xl font-bold">{selected.name}</p>
          {selected.masked_email && (
            <p className="text-gray-500 dark:text-gray-400">
              {selected.masked_email}
            </p>
          )}

          {submitError && (
            <p role="alert" className="mt-3 text-sm text-red-500">
              {submitError}
            </p>
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={isSubmitting}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed py-3 font-semibold text-white transition"
          >
            {isSubmitting && (
              <LoaderCircle size={20} className="animate-spin" />
            )}
            {isSubmitting ? "Confirming..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={isSubmitting}
            className="mt-2 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Not you? Search again
          </button>
        </div>
      )}
    </div>
  );
}

function StatusCard({
  tone,
  title,
  children,
}: {
  tone: "success" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200"
      : "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
  const Icon = tone === "success" ? CircleCheck : CircleAlert;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-8 rounded-2xl border p-6 text-center ${styles}`}
    >
      <Icon className="mx-auto" size={40} />
      <h2 className="mt-3 text-xl font-bold">{title}</h2>
      <p className="mt-2">{children}</p>
    </div>
  );
}
