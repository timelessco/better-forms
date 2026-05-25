import type { useAppForm } from "@/components/ui/tanstack-form";

interface DefaultValues {
  [key: string]: unknown;
}

/**
 * Extended AppForm type that includes additional state and component properties
 * used for rendering form elements.
 */
export type AppForm = ReturnType<typeof useAppForm> & {
  baseStore: {
    state: {
      values: DefaultValues;
      isSubmitting: boolean;
      isSubmitted: boolean;
    };
  };
  handleSubmit: () => void;
  AppForm: React.ComponentType<React.PropsWithChildren>;
  AppField: React.ComponentType<{
    name: string;
    children: (field: {
      FormItem: React.ComponentType<React.PropsWithChildren>;
      FormLabel: React.ComponentType<React.PropsWithChildren>;
      FormControl: React.ComponentType<React.PropsWithChildren>;
      FormDescription: React.ComponentType<React.PropsWithChildren>;
      FormMessage: React.ComponentType<React.PropsWithChildren>;
      state: {
        value: unknown;
        meta: {
          errors: unknown[];
          isTouched: boolean;
        };
      };
      handleChange: (value: unknown) => void;
      handleBlur: () => void;
    }) => React.ReactElement;
  }>;
  reset: () => void;
};
