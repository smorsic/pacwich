export interface SpritesheetFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RawSpritesheetMetadata {
  frames: Record<
    string,
    {
      frame: SpritesheetFrame;
    }
  >;
  meta: {
    size: {
      w: number;
      h: number;
    };
  };
}

export interface SpritesheetMetadata {
  frames: SpritesheetFrame[];
  width: number;
  height: number;
}

export interface Spritesheet {
  metadata: SpritesheetMetadata;
  frameBitmaps: ImageBitmap[];
}

export const loadSpritesheetMetadata = async (
  fileName: string,
): Promise<SpritesheetMetadata> => {
  let data: RawSpritesheetMetadata;
  try {
    const response = await fetch(
      `/images/spritesheets/metadata/${fileName}.json`,
    );
    data = (await response.json()) as RawSpritesheetMetadata;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to load spritesheet metadata for ${fileName}`, error);
    return {
      frames: [],
      width: 0,
      height: 0,
    };
  }
  return {
    frames: Object.values<{ frame: SpritesheetFrame }>(data.frames).map(
      (rawFrame) => rawFrame.frame,
    ),
    width: data.meta.size.w,
    height: data.meta.size.h,
  };
};

export const loadSpritesheet = async (
  fileName: string,
): Promise<Spritesheet> => {
  let metadata: SpritesheetMetadata;
  let imageBlob: Blob;
  try {
    metadata = await loadSpritesheetMetadata(fileName);
    const imageData = await fetch(`/images/spritesheets/${fileName}.png`);
    imageBlob = await imageData.blob();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to load spritesheet data for ${fileName}`, error);
    return Promise.reject(error);
  }
  const imageBitmap = await createImageBitmap(imageBlob, {
    resizeQuality: "pixelated",
  });

  const frameBitmaps: ImageBitmap[] = [];

  for (let i = 0; i < metadata.frames.length; i++) {
    const frame = metadata.frames[i];
    frameBitmaps.push(
      await createImageBitmap(imageBitmap, frame.x, frame.y, frame.w, frame.h, {
        resizeQuality: "pixelated",
      }),
    );
  }

  return { metadata, frameBitmaps };
};
