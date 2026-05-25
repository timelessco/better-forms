import { QueryClient } from "@tanstack/react-query";

export const getContext = () => {
  const queryClient = new QueryClient();
  return {
    queryClient,
  };
};
