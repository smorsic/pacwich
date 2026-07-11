import { localWebCliClient } from "@pacwich/web-common/web-cli-runtime";
import { create } from "zustand";
import { useOnMount } from "../util/useOnMount";

const useHealthStore = create<{
  isPending: boolean;
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  setIsPending: (isPending: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsReady: (isHealthy: boolean) => void;
  setError: (error: Error | null) => void;
}>((set) => ({
  isPending: true,
  isLoading: false,
  isReady: false,
  error: null,
  setIsPending: (isPending) => set({ isPending }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsReady: (isHealthy) => set({ isReady: isHealthy }),
  setError: (error) => set({ error }),
}));

export const useInitializeApi = () => {
  const isReady = useHealthStore((state) => state.isReady);
  const error = useHealthStore((state) => state.error);
  const isLoading = useHealthStore((state) => state.isLoading);
  const setIsReady = useHealthStore((state) => state.setIsReady);
  const setIsPending = useHealthStore((state) => state.setIsPending);
  const setError = useHealthStore((state) => state.setError);
  const setIsLoading = useHealthStore((state) => state.setIsLoading);

  useOnMount(() => {
    if (isLoading || isReady || error) return;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const healthResponse = localWebCliClient.health();

        let newError: Error | null = null;
        healthResponse
          .then((response) => {
            const newIsHealthy = response.status === "ok";
            if (!newIsHealthy) {
              newError = new Error("API is not healthy");
              // eslint-disable-next-line no-console
              console.error("API is not healthy", response);
              setIsReady(false);
            }
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error("Error loading API health", error);
            newError = error as Error;
          });

        const readyResponse = localWebCliClient.ready();
        readyResponse
          .then((response) => {
            if (!newError && !response.isReady) {
              newError = new Error("API is not ready");
              // eslint-disable-next-line no-console
              console.error("API is not ready", response);
            } else {
              setIsReady(true);
            }
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error("Error loading API ready", error);
            newError = error as Error;
          });

        await Promise.all([healthResponse, readyResponse]);
        setError(newError);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error loading API health", error);
        setError(error as Error);
      } finally {
        setIsPending(false);
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
};

export const useApiState = () => {
  const isPending = useHealthStore((state) => state.isPending);
  const isLoading = useHealthStore((state) => state.isLoading);
  const isReady = useHealthStore((state) => state.isReady);
  const error = useHealthStore((state) => state.error);

  return { isLoading: isPending || isLoading, isReady, error };
};
