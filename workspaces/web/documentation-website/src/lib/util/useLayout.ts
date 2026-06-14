import throttle from "lodash/throttle";
import { useEffect, useState } from "react";
import { useOnMount } from "./useOnMount";

export const FOOTER_HEIGHT_PX = 50;

export const useLayout = () => {
  const win = typeof window !== "undefined" ? window : null;

  const [windowSize, setWindowSize] = useState({
    width: win?.innerWidth ?? 0,
    height: win?.innerHeight ?? 0,
  });

  useOnMount(() => {
    const resizeListener = throttle(() => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }, 100);

    const scrollListener = () => {
      document.body.classList.toggle("scrolled", window.scrollY > 20);
    };

    window.addEventListener("resize", resizeListener);
    window.addEventListener("scroll", scrollListener);
    return () => {
      window.removeEventListener("resize", resizeListener);
      window.removeEventListener("scroll", scrollListener);
    };
  });

  useEffect(() => {
    const rspressNav = document.querySelector(".rspress-nav") as HTMLElement;
    const rspressDoc = document.querySelector(".rspress-doc") as HTMLElement;

    if (rspressDoc && rspressNav) {
      const height =
        windowSize.height - rspressNav.clientHeight - FOOTER_HEIGHT_PX;
      rspressDoc.style.minHeight = `${height}px`;
    }
  }, [windowSize]);
};
