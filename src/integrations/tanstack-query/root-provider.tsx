import { QueryClient } from "@tanstack/react-query";

export const getContext = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Non-zero baseline so SSR-streamed data isn't refetched on hydrate. Per-query staleTime still overrides.
        staleTime: 1000 * 60,
      },
    },
  });
  return {
    queryClient,
  };
};
