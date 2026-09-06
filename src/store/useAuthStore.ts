import { create } from "zustand";
import Cookies from "js-cookie";
import axios from "axios";
import { apiUrl } from "@/utils/env";

interface useAuthStoreProps {
  token: string;
  isAdmin: boolean; // Changed from "true" | "false" to boolean
  validUntil: string;
  isValidToken: boolean;
  isCheckingToken: boolean;

  setToken: (token: string, rememberMe: boolean) => void;
  setAdmin: (isAdmin: boolean, rememberMe?: boolean) => void; // Changed parameter type to boolean
  setValidUntil: (validUntil: string, rememberMe?: boolean) => void;

  clearToken: () => void;
  clearAdmin: () => void;
  clearValidUntil: () => void;

  setIsValidToken: (isValid: boolean) => void;
  checkToken: () => Promise<void>;
  setIsCheckingToken: (checking: boolean) => void;

  hydrateAuth: () => void;
}

// Tracks the most recent checkToken() invocation. Verify calls are fired from an effect
// that re-runs whenever `token` changes, so two can be in flight at once (typically the
// initial "0" placeholder followed by the real token straight after login). Without this
// counter, whichever response happened to land LAST won — so a slow 401 for the stale
// placeholder could overwrite a fresh 200 and bounce an authenticated user to /login.
let checkTokenSeq = 0;

const useAuthStore = create<useAuthStoreProps>((set, get) => {
  // Read initial values from cookies (if they exist)
  const storedToken = Cookies.get("token") || "0";
  const storedIsAdmin = Cookies.get("isAdmin") === "true";
  const storedValidUntil = Cookies.get("validUntil") || "0";

  return {
    token: storedToken,
    isAdmin: storedIsAdmin,
    validUntil: storedValidUntil,
    isValidToken: true,
    isCheckingToken: false,

    setToken: (token: string, rememberMe: boolean) => {
      set({ token });
      if (rememberMe) {
        Cookies.set("token", token, { expires: 30 });
      } else {
        Cookies.set("token", token);
      }
    },

    setAdmin: (isAdmin: boolean, rememberMe?: boolean) => {
      set({ isAdmin });
      if (rememberMe) {
        Cookies.set("isAdmin", isAdmin.toString(), { expires: 30 });
      } else {
        Cookies.set("isAdmin", isAdmin.toString());
      }
    },

    setValidUntil: (validUntil: string, rememberMe?: boolean) => {
      set({ validUntil });
      if (rememberMe) {
        Cookies.set("validUntil", validUntil, { expires: 30 });
      } else {
        Cookies.set("validUntil", validUntil);
      }
    },

    clearToken: () => {
      set({ token: "0" });
      Cookies.remove("token");
    },

    clearAdmin: () => {
      set({ isAdmin: false });
      Cookies.remove("isAdmin");
    },

    clearValidUntil: () => {
      set({ validUntil: "0" });
      Cookies.remove("validUntil");
    },

    setIsValidToken: (isValid: boolean) => set({ isValidToken: isValid }),
    setIsCheckingToken: (checking: boolean) =>
      set({ isCheckingToken: checking }),

    async checkToken() {
      const seq = ++checkTokenSeq;
      const token = get().token;

      // `token` is the "0" placeholder until a cookie exists. Verifying it always 401s,
      // so skip the pointless round trip -- and, more importantly, never let that 401
      // land after a real token's 200. The result is the same as before (not signed in),
      // it just no longer depends on which response wins a race.
      if (!token || token === "0") {
        if (seq === checkTokenSeq) {
          set({ isValidToken: false, isCheckingToken: false });
        }
        return;
      }

      set({ isCheckingToken: true });
      try {
        const res = await axios.get(`${apiUrl}/api/v1/sessions/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        // Discard the result if a newer checkToken() has started meanwhile.
        if (seq !== checkTokenSeq) return;
        set({ isValidToken: res.status === 200 });
      } catch {
        if (seq !== checkTokenSeq) return;
        set({ isValidToken: false });
      } finally {
        if (seq === checkTokenSeq) {
          set({ isCheckingToken: false });
        }
      }
    },

    hydrateAuth: () => {
      const storedToken = Cookies.get("token") || "0";
      const storedIsAdmin = Cookies.get("isAdmin") === "true";
      const storedValidUntil = Cookies.get("validUntil") || "0";

      set({
        token: storedToken,
        isAdmin: storedIsAdmin,
        validUntil: storedValidUntil,
      });
    },
  };
});

export default useAuthStore;
