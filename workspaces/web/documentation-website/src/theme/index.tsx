import { PACWICH_VERSION } from "@pacwich/common/version";
import { useLocation } from "@rspress/core/runtime";
import { Layout as RspressLayout, Link } from "@rspress/core/theme-original";
import { useEffect, useRef } from "react";
import "@fontsource/unifontex";
// Shared web theme tokens (Web CLI palette, code colors, terminal fonts/sizing).
import "@pacwich/web-common/theme.css";
import { Footer } from "../lib/components/Footer";
import { BUILD_ID } from "../lib/util/env";
import { PixelArtImage } from "../lib/util/pixelArt";
import { useLayout } from "../lib/util/useLayout";

const OnPageChange = () => {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
    }
  }, [location]);
  return null;
};

/** @todo The href-related code is all a pretty terrible hack to get around "/index" being forced as the home link. */
const HomeLink = () => {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.setAttribute("href", "/");
    }
  }, []);

  return (
    <Link href="/." ref={ref}>
      <div className="nav-title-container">
        <PixelArtImage
          path="/images/png/bwaby_20x22.png"
          style={{
            width: "2.5rem",
          }}
          height="auto"
        />
        <div className="nav-title-text-container">
          <div className="nav-title-text-container-inner">
            <PixelArtImage
              path="/images/png/title--dark_46x12.png"
              style={{
                width: "7.5rem",
              }}
              height="auto"
              className="dark-only nav-title-text"
              alt="pacwich"
            />
            <PixelArtImage
              path="/images/png/title--light_46x12.png"
              style={{
                width: "7.5rem",
              }}
              height="auto"
              className="light-only nav-title-text"
              alt="pacwich"
            />
          </div>
          <div className="nav-title-version">v{PACWICH_VERSION}</div>
        </div>
      </div>
    </Link>
  );
};

const Layout = () => {
  useLayout();
  return (
    <>
      <OnPageChange />
      <RspressLayout navTitle={<HomeLink />} />
      <Footer />
    </>
  );
};

export { Layout };

export * from "@rspress/core/theme-original";

// eslint-disable-next-line no-console
console.log("\n" + process.env.BWUNSTER_ASCII?.replace(/%%/g, "%%%"));
// eslint-disable-next-line no-console
console.log("pacwich Documentation:", BUILD_ID);
