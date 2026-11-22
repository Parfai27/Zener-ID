import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A round button, bottom right, that takes the reader back to the top of the
 * landing page. It appears once the first screen has scrolled away and shows how
 * far down the page the reader is with a ring around the arrow.
 */
export function BackToTop() {
  const [progress, setProgress] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      setShown(window.scrollY > window.innerHeight * 0.8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const toTop = () => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  };

  // The ring: a circle of radius 22 drawn as far round as the page is read.
  const r = 22;
  const length = 2 * Math.PI * r;

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`group fixed right-4 bottom-4 z-50 grid size-12 place-items-center rounded-full bg-brand-deep text-white shadow-[0_8px_24px_rgba(6,48,43,0.28)] transition-[opacity,translate,background-color] duration-300 hover:bg-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-sky/40 sm:right-6 sm:bottom-6 sm:size-14 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-brand-sky)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - progress)}
        />
      </svg>
      <ArrowUp className="relative size-5 transition-transform duration-200 group-hover:-translate-y-0.5" aria-hidden />
    </button>
  );
}
