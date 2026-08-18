"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Global "doors closing/opening" branded transition, played on every page
 * navigation (including the very first load) — two black panels meet in
 * the middle with the ONE STUD' wordmark, then reopen on the new page. */
export default function PageTransition() {
  const pathname = usePathname();
  const [closed, setClosed] = useState(true);
  const prevPathname = useRef(pathname);

  // Initial reveal, on mount only. Deliberately not folded into the
  // pathname-change effect below: React (dev-mode StrictMode) mounts every
  // component twice, and a ref-based "is this the first run" guard shared
  // between the two effects would desync across that double-invoke and
  // silently skip scheduling the open — an empty-deps effect doesn't have
  // that problem since it doesn't branch on mutated ref state.
  useEffect(() => {
    const openTimer = setTimeout(() => setClosed(false), 350);
    return () => clearTimeout(openTimer);
  }, []);

  useEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;

    setClosed(true);
    const openTimer = setTimeout(() => setClosed(false), 550);
    return () => clearTimeout(openTimer);
  }, [pathname]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div
        className={`absolute inset-x-0 top-0 h-1/2 bg-black transition-transform duration-500 ease-out ${
          closed ? "translate-y-0" : "-translate-y-full"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 bg-black transition-transform duration-500 ease-out ${
          closed ? "translate-y-0" : "translate-y-full"
        }`}
      />
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          closed ? "opacity-100 delay-150" : "opacity-0"
        }`}
      >
        <span className="text-3xl font-black tracking-tight text-white">
          ONE STUD&apos;
        </span>
      </div>
    </div>
  );
}
