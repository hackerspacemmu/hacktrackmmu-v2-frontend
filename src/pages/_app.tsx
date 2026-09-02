import { ToastProvider } from "@/components/Toast/ToastProvider";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Hanken_Grotesk } from "next/font/google";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useAuthStore from "@/store/useAuthStore";
import { useToast } from "@/components/Toast/ToastProvider";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
});

function AuthRedirectHandler() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const { showToast } = useToast();

  const {
    isValidToken,
    isCheckingToken,
    checkToken,
    clearToken,
    clearAdmin,
    clearValidUntil,
    token,
  } = useAuthStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      checkToken();
    }
  }, [isClient, checkToken, token]);

  useEffect(() => {
    if (
      !isCheckingToken &&
      !isValidToken &&
      router.pathname !== "/login" &&
      router.pathname !== "/"
    ) {
      clearToken();
      clearAdmin();
      clearValidUntil();

      // Check for manual logout flag
      setTimeout(() => {
        const manualLogout = localStorage.getItem("manualLogout");
        if (manualLogout) {
          showToast(
            "Logout successfully! Redirecting you to main page",
            "success",
          );
          localStorage.removeItem("manualLogout");
        } else {
          showToast("You must be signed in to access this page.", "error");
        }
        router.replace("/login");
      }, 200);
    }
  }, [
    isValidToken,
    isCheckingToken,
    router,
    clearToken,
    clearAdmin,
    clearValidUntil,
    showToast,
  ]);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.body.classList.add(hankenGrotesk.className);
  }, []);

  return (
    <ToastProvider>
      <main className={hankenGrotesk.className}>
        <>
          <AuthRedirectHandler />
          <Component {...pageProps} />
        </>
      </main>
    </ToastProvider>
  );
}
