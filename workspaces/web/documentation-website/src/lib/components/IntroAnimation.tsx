import { Link } from "@rspress/core/theme-original";
import { useState } from "react";
import { create } from "zustand";
import { AnimatedSprite } from "../util/pixelArt";

import("../../theme/css/home.css");

const useRanOnceStore = create<{ ranOnce: boolean; setRanOnce: () => void }>(
  (set) => ({
    ranOnce: false,
    setRanOnce: () => set({ ranOnce: true }),
  }),
);

export const IntroAnimation = () => {
  const [isIdle, setIsIdle] = useState(false);

  const { ranOnce, setRanOnce } = useRanOnceStore();

  return (
    <>
      <h1 className="home-title">Pacwich</h1>
      <div className="intro-anim-container-mobile">
        <div className="intro-anim-bwunster-container">
          <AnimatedSprite
            spritesheetFileName="anim-intro_64x106"
            width={64 * 2}
            height={106 * 2}
            fps={15}
            onFinish={() => {
              setTimeout(() => {
                setIsIdle(true);
                setRanOnce();
              }, 500);
            }}
            reducedMotionFrame={11}
            forceReduceMotion={ranOnce}
          />
          {isIdle && (
            <div className="bwunster-idle">
              <AnimatedSprite
                spritesheetFileName="anim-blink_64x70"
                width={64 * 2}
                height={106 * 2}
                fps={10}
                loop
                frameLengths={{
                  0: () => Math.round(Math.random() * 80),
                  1: 2,
                }}
                reducedMotionFrame={0}
              />
            </div>
          )}
        </div>
        <div className="dark-only">
          <AnimatedSprite
            spritesheetFileName="anim-title--dark_46x12"
            startDelay={500}
            width={46 * 5}
            height={12 * 5}
            fps={24}
            canvasProps={{
              "aria-labelledby": "home-title",
            }}
            reducedMotionFrame={17}
            forceReduceMotion={ranOnce}
          />
        </div>
        <div className="light-only">
          <AnimatedSprite
            spritesheetFileName="anim-title--light_46x12"
            startDelay={500}
            width={46 * 5}
            height={12 * 5}
            fps={24}
            canvasProps={{
              "aria-labelledby": "home-title",
            }}
            reducedMotionFrame={17}
            forceReduceMotion={ranOnce}
          />
        </div>
        <div className="intro-subtitle-container">
          <h2 className="intro-subtitle">
            Monorepo tooling that works on top of <b>Bun</b>, <b>npm</b>, and{" "}
            <b>pnpm</b> workspaces.
          </h2>
        </div>
        <div className="intro-links-container">
          <Link href="/intro/overview" className="intro-overview">
            Overview
          </Link>
          <Link href="/intro/getting-started" className="intro-getting-started">
            Getting Started
          </Link>
        </div>
      </div>
      <div className="intro-anim-container">
        <div className="intro-anim-bwunster-container">
          <AnimatedSprite
            spritesheetFileName="anim-intro_64x106"
            width={64 * 4}
            height={106 * 4}
            fps={11}
            onFinish={() => {
              setTimeout(() => setIsIdle(true), 250);
            }}
            reducedMotionFrame={11}
            forceReduceMotion={ranOnce}
          />
          {isIdle && (
            <div className="bwunster-idle">
              <AnimatedSprite
                spritesheetFileName="anim-blink_64x70"
                width={64 * 4}
                height={106 * 4}
                fps={10}
                loop
                frameLengths={{
                  0: () => Math.round(Math.random() * 80),
                  1: 2,
                }}
                reducedMotionFrame={0}
              />
            </div>
          )}
        </div>
        <div className="intro-anim-title-container">
          <div className="dark-only">
            <AnimatedSprite
              startDelay={500}
              spritesheetFileName="anim-title--dark_46x12"
              width={46 * 11}
              height={12 * 11}
              fps={24}
              canvasProps={{
                "aria-labelledby": "home-title",
              }}
              reducedMotionFrame={17}
              forceReduceMotion={ranOnce}
            />
          </div>
          <div className="light-only">
            <AnimatedSprite
              startDelay={500}
              spritesheetFileName="anim-title--light_46x12"
              width={46 * 11}
              height={12 * 11}
              fps={24}
              canvasProps={{
                "aria-labelledby": "home-title",
              }}
              reducedMotionFrame={17}
              forceReduceMotion={ranOnce}
            />
          </div>
          <div className="intro-subtitle-container">
            <h2 className={`intro-subtitle ${ranOnce ? "" : "animated"}`}>
              Monorepo tooling that works on top of <b>Bun</b>, <b>npm</b>, and{" "}
              <b>pnpm</b> workspaces.
            </h2>
          </div>
          <div className="intro-links-container">
            <Link href="/intro/overview" className="intro-overview">
              Overview
            </Link>
            <Link
              href="/intro/getting-started"
              className="intro-getting-started"
            >
              Getting Started
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};
