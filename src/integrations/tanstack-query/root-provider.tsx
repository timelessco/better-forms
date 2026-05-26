import { QueryClient } from "@tanstack/react-query";

export const getContext = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Non-zero baseline so data streamed from the server during SSR isn't
        // immediately considered stale and refetched on hydration. Per-query
        // staleTime in queryOptions/collections still overrides this.
        staleTime: 1000 * 60, // 1 minute
      },
    },
  });
  return {
    queryClient,
  };
};
