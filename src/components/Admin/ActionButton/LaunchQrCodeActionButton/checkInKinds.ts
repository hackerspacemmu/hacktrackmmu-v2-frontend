// Kinds of QR self check-in. The backend signs the kind into the QR token and
// uses it to decide the status members move to (see CheckInsController::KINDS).
export type CheckInKind = "session" | "meet_and_greet";

export const CHECK_IN_KINDS: Record<
  CheckInKind,
  {
    buttonLabel: string;
    /** Heading on the projected QR and the member's check-in page. */
    title: string;
    /** Shown to the member after a successful check-in. */
    welcome: string;
    /** "...check in for <eventName>" */
    eventName: string;
    /** "...already checked in at <pastEventName>" */
    pastEventName: string;
    borderColor: string;
    textColor: string;
    hoverShadowColor: string;
  }
> = {
  session: {
    buttonLabel: "Session QR Code",
    title: "Session Check-in",
    welcome: "Welcome to today's session.",
    eventName: "today's session",
    pastEventName: "a regular session",
    borderColor: "border-orange-500",
    textColor: "text-orange-500",
    hoverShadowColor: "hover:shadow-orange-500/50",
  },
  meet_and_greet: {
    buttonLabel: "M&G QR Code",
    title: "Meet & Greet Check-in",
    welcome: "Welcome to the Meet & Greet.",
    eventName: "the Meet & Greet",
    pastEventName: "the Meet & Greet",
    borderColor: "border-teal-500",
    textColor: "text-teal-500",
    hoverShadowColor: "hover:shadow-teal-500/50",
  },
};

export const isCheckInKind = (value: unknown): value is CheckInKind =>
  typeof value === "string" && value in CHECK_IN_KINDS;
