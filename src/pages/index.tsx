import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";

const AnimatedTitle = ({ title }: { title: string }) => {
  const words = title.split(" ");

  return (
    <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter">
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block mr-4 last:mr-0">
          {word.split("").map((letter, letterIndex) => (
            <motion.span
              key={`${wordIndex}-${letterIndex}`}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                delay: wordIndex * 0.1 + letterIndex * 0.03,
                type: "spring",
                stiffness: 150,
                damping: 25,
              }}
              className="inline-block text-white drop-shadow-lg"
            >
              {letter}
            </motion.span>
          ))}
        </span>
      ))}
    </h1>
  );
};

export default function BackgroundPaths({
  title = "Hacktrack MMU",
}: {
  title?: string;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <Image
        src="/hacktrack_landing_image.jpg"
        alt="Hacktrack MMU background"
        fill
        loading="lazy"
        className="object-cover object-center"
      />

      {/* Gradient overlay: dark at bottom, transparent at top */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto"
        >
          {isMounted ? (
            <AnimatedTitle title={title} />
          ) : (
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter text-white drop-shadow-lg">
              {title}
            </h1>
          )}

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
            className="text-white/80 text-lg sm:text-xl mb-10 tracking-wide drop-shadow"
          >
            Remembering and celebrating every shared talk
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6, ease: "easeOut" }}
            className="inline-block group relative p-px rounded-2xl overflow-hidden
                        shadow-lg hover:shadow-xl transition-shadow duration-300"
          >
            <button
              className="rounded-[1.15rem] px-8 py-6 text-lg font-semibold
                          bg-white hover:bg-gray-100
                          text-black transition-all duration-300
                          group-hover:-translate-y-0.5
                          border border-white/20
                          hover:shadow-md shadow-black/30"
              onClick={() => router.push("/login")}
            >
              <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                Login
              </span>
              <span
                className="ml-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-1.5
                              transition-all duration-300"
              >
                →
              </span>
            </button>
          </motion.div>
        </motion.div>
      </div>
      {/* Footer */}
      <div className="absolute bottom-4 w-full text-center z-10">
        <p className="text-white/40 text-sm tracking-wide">
          © 2026 Hackerspace MMU
        </p>
      </div>
    </div>
  );
}
