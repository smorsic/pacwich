import { useEffect, type EffectCallback } from "react";

export const useOnMount = (callback: () => EffectCallback | void) => {
  useEffect(() => {
    callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
