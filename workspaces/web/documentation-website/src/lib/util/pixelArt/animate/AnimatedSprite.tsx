import { useEffect, useRef, useState } from "react";
import { loadSpritesheet, type Spritesheet } from "./spritesheet";

export interface AnimatedSpriteProps {
  spritesheetFileName: string;
  width: number;
  startDelay?: number;
  height?: number;
  onFinish?: () => void;
  loop?: boolean;
  fps: number;
  frameLengths?: Record<number, number | (() => number)>;
  canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
  reducedMotionFrame: number;
  forceReduceMotion?: boolean;
}

export const AnimatedSprite = ({
  spritesheetFileName,
  width,
  startDelay = 0,
  height,
  onFinish,
  loop,
  fps,
  frameLengths,
  canvasProps,
  reducedMotionFrame,
  forceReduceMotion = false,
}: AnimatedSpriteProps) => {
  const [spritesheetData, setSpritesheetData] = useState<Spritesheet | null>(
    null,
  );
  const [canvasHeight, setCanvasHeight] = useState(height ?? width);

  useEffect(() => {
    loadSpritesheet(spritesheetFileName).then((spritesheet) => {
      setSpritesheetData(spritesheet);
      setCanvasHeight(
        spritesheet.metadata.frames[0]
          ? (spritesheet.metadata.frames[0].h /
              spritesheet.metadata.frames[0].w) *
              width
          : width,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spritesheetFileName]);

  const isDrawingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !spritesheetData) return;
    const canvas = canvasRef.current;

    const canvasWidth = width;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const isReducedMotion =
      forceReduceMotion ||
      window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;

    if (isReducedMotion) {
      ctx.drawImage(
        spritesheetData.frameBitmaps[reducedMotionFrame],
        0,
        0,
        spritesheetData.metadata.frames[reducedMotionFrame].w,
        spritesheetData.metadata.frames[reducedMotionFrame].h,
        0,
        0,
        width,
        canvasHeight,
      );
      return;
    }

    const frameDurationMs = 1000 / fps;

    isDrawingRef.current = true;
    let frameIndex = 0;
    let lastFrameTime: number | undefined = undefined;
    let lastFrameLength = 1;
    const startTime = performance.now();
    const draw = (time: number) => {
      if (startDelay > 0 && time < startTime + startDelay) {
        requestAnimationFrame(draw);
        return;
      }

      if (!isDrawingRef.current) {
        onFinish?.();
        return;
      }

      if (
        !lastFrameTime ||
        time - lastFrameTime >= frameDurationMs * lastFrameLength
      ) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(
          spritesheetData.frameBitmaps[frameIndex],
          0,
          0,
          spritesheetData.metadata.frames[frameIndex].w,
          spritesheetData.metadata.frames[frameIndex].h,
          0,
          0,
          width,
          canvasHeight,
        );

        lastFrameTime = time;
        const frameLength = frameLengths?.[frameIndex];
        lastFrameLength = frameLength
          ? typeof frameLength === "function"
            ? frameLength()
            : frameLength
          : 1;

        frameIndex++;

        if (frameIndex >= spritesheetData.metadata.frames.length) {
          if (loop) {
            frameIndex = 0;
          } else {
            isDrawingRef.current = false;
          }
        }
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spritesheetData, canvasHeight]);

  useEffect(() => {
    return () => {
      isDrawingRef.current = false;
    };
  }, []);

  return (
    <div className="animated-sprite-container">
      <canvas
        ref={canvasRef}
        width={width}
        height={canvasHeight}
        {...canvasProps}
      />
    </div>
  );
};
