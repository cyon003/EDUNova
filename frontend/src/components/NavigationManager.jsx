import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function NavigationManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior = reduceMotion ? "auto" : "smooth";
      if (hash) {
        const target = document.getElementById(hash.slice(1));
        if (target) target.scrollIntoView({ behavior, block: "start" });
        return;
      }
      window.scrollTo({ top: 0, behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}

export default NavigationManager;
