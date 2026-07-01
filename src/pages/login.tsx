import { useState, useEffect } from "react";
import useAuthStore from "@/store/useAuthStore";
import Cookies from "js-cookie";
import { apiUrl } from "@/utils/env";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/components/Toast/ToastProvider";
import { useRouter } from "next/router";
import { useDarkMode } from "@/hooks/useDarkMode";
import { SubmitButton } from "@/components/atomComponents/SubmitButton";
import { preload } from "swr";
import { fetcherWithToken } from "@/utils/fetcher";

const images = [
  "/presentation.jpg",
  "/hackerspaceSession.jpg",
  "/weijie.jpg",
  "/willie.jpg",
];

export default function LoginPage() {
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [waitMessage, setWaitMessage] = useState<boolean>(false);
  const { setToken, setAdmin, setValidUntil } = useAuthStore();
  const { isDarkMode } = useDarkMode();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeToken = Cookies.get("token");
    if (activeToken && activeToken !== "0") {
      router.push("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  async function LoginUser(e: React.FormEvent) {
    e.preventDefault();

    setIsSubmitting(true);
    setWaitMessage(false);

    setTimeout(() => {
      setWaitMessage(true);
    }, 5000);

    try {
      const response = await axios.post(
        `${apiUrl}/api/v1/login`,
        {
          session: {
            password: password,
            remember_me: rememberMe,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data) {
        showToast(
          "Login successfully! Redirecting you to main page",
          "success",
        );
        setIsSubmitting(false);
        setToken(response.data.token, rememberMe);

        setAdmin(response.data.isAdmin, rememberMe);
        setValidUntil(response.data.valid_until, rememberMe);

        preload([`${apiUrl}/api/v1/members`, response.data.token], ([url, t]) =>
          fetcherWithToken(url, t),
        );
        preload([`${apiUrl}/api/v1/meetups`, response.data.token], ([url, t]) =>
          fetcherWithToken(url, t),
        );
        router.push("/dashboard");
      }
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setIsSubmitting(false);

      if (
        error.response &&
        error.response?.data?.message === "Invalid password"
      ) {
        showToast("Invalid password. Try again.", "error");
      }
    }
  }
  if (isChecking) {
    return <div className="min-h-screen bg-white dark:bg-[#111]" />;
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Image carousel column */}
      <div className="hidden md:block relative overflow-hidden">
        {images.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt={`Login visual ${index + 1}`}
            width={1080}
            height={1080}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
              index === currentImageIndex ? "opacity-100" : "opacity-0"
            }`}
            priority={index === 0}
          />
        ))}
      </div>

      {/* Login column */}
      <div className="flex flex-col justify-center items-center p-8 bg-white dark:bg-[#111]">
        <div className="w-full max-w-md">
          {/* Logo placeholder */}
          {isDarkMode ? (
            <Image
              src="/hackerspaceLogoWhite.svg"
              alt="Hacktrack MMU"
              className="flex justify-center items-center mx-auto"
              width={130}
              height={130}
            />
          ) : (
            <Image
              src="/hackerspaceLogo.svg"
              alt="Hacktrack MMU"
              className="flex justify-center items-center mx-auto"
              width={150}
              height={150}
            />
          )}

          {/* Welcome text */}
          <h2 className="mt-6 text-center text-3xl font-extrabold dark:text-white text-gray-900">
            Welcome to Hacktrack MMU
          </h2>
          {/* Login form */}
          <p className="mt-1 text-lg text-center">
            Please input password to login.
          </p>

          <form className="mt-8 space-y-6" onSubmit={LoginUser}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 flex w-full dark:bg-[#333] dark:border-[#555] rounded-full border border-input bg-background px-6 py-[14px] text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus:ring-blue-400 dark:focus:ring-blue-500"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-4 flex items-center justify-center text-gray-500 dark:text-gray-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="flex items-center space-x-2 mt-4 mb-4 ml-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-[#333]"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm text-gray-700 dark:text-gray-300 select-none cursor-pointer"
              >
                Remember me
              </label>
            </div>
            <SubmitButton isSubmitting={isSubmitting} isLogin={true} />
            <div className="text-center h-[24px]">
              <p
                className={`text-gray-400 italic transition-opacity duration-1000 ${waitMessage && isSubmitting ? "opacity-100" : "opacity-0"}`}
              >
                This may take a while...
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
