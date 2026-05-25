import type { MutationOptions, QueryOptions } from "@tanstack/react-query";
import type { HasRequiredKeys } from "type-fest";

type OMIT_BETTER_AUTH_CLIENT_KEYS =
  | "$ERROR_CODES"
  | "$Infer"
  | "$fetch"
  | "$store"
  | `use${Capitalize<string>}` // Match React hooks like useSession, not username
  | "fetchOptions";

// Match any method starting with 'get' or 'list', plus specific read-only methods from plugins
type QueryMethod = `get${string}` | `list${string}` | "state" | "portal";

// Extract data type from better-auth's generic functions
// Constrain the options arg to throw: false to resolve the conditional return type
type InferBetterAuthData<TFn> = TFn extends (
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  data: any,
  options?: { throw?: false },
) => Promise<infer R>
  ? R extends { data: infer D }
    ? NonNullable<D>
    : R
  : never;

type InferBetterAuthError<TFn> = TFn extends (
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  data: any,
  options?: { throw?: true },
) => Promise<infer R>
  ? R extends { error: infer E }
    ? NonNullable<E>
    : R
  : never;

interface InferQueryOptions<
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  TFn extends (...args: any[]) => any,
  TPath extends readonly string[],
  TData = InferBetterAuthData<TFn>,
  TError = InferBetterAuthError<TFn>,
> extends QueryOptions<TData, TError, TData, TPath> {
  queryKey: TPath;
  queryFn: () => Promise<TData>;
}

interface InferMutationOptions<
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  TFn extends (...args: any[]) => any,
  TData = InferBetterAuthData<TFn>,
  TError = InferBetterAuthError<TFn>,
  TVariables = Parameters<TFn>[0],
> extends MutationOptions<TData, TError, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
}

type TransformFunction<
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  TFn extends (...args: any[]) => any,
  Path extends string[],
  TParams extends Parameters<TFn>[0] = Parameters<TFn>[0],
  TData = InferBetterAuthData<TFn>,
  TError = InferBetterAuthError<TFn>,
  // eslint-disable-next-line typescript-eslint/no-explicit-any
> = Path extends [...any[], QueryMethod]
  ? {
      queryOptions: TParams extends undefined
        ? () => InferQueryOptions<TFn, Path>
        : TParams extends HasRequiredKeys<TParams>
          ? (
              input: TParams,
              options?: Omit<QueryOptions<TData, TError, TData, Path>, "queryKey" | "queryFn">,
            ) => InferQueryOptions<TFn, Path>
          : (
              input?: TParams,
              options?: Omit<QueryOptions<TData, TError, TData, Path>, "queryKey" | "queryFn">,
            ) => InferQueryOptions<TFn, Path>;
      queryKey: TParams extends undefined
        ? () => Path
        : TParams extends HasRequiredKeys<TParams>
          ? (input: TParams) => [...Path, TParams]
          : (input?: TParams) => [...Path, TParams];
    }
  : {
      mutationOptions: (
        options?: Omit<MutationOptions<TData, TError, TParams>, "mutationFn">,
      ) => InferMutationOptions<TFn, TData, TError>;
    };

// Built-in keys that exist on all functions - we want to ignore these
// eslint-disable-next-line typescript-eslint/no-explicit-any
type BuiltinFunctionKeys = keyof ((...args: any[]) => any);

// Helper: check if T has any meaningful keys beyond built-in function properties
type HasExtraKeys<T> = Exclude<keyof T, BuiltinFunctionKeys> extends never ? false : true;

/* eslint-disable typescript-eslint/no-explicit-any */
type AuthClientToQuery<T, Path extends string[] = []> = {
  [K in keyof T as K extends OMIT_BETTER_AUTH_CLIENT_KEYS ? never : K]: T[K] extends (
    ...args: any[]
  ) => any
    ? // Check if this callable also has extra properties (intersection from plugins)
      HasExtraKeys<T[K]> extends true
      ? TransformFunction<T[K], [...Path, K & string]> &
          AuthClientToQuery<T[K], [...Path, K & string]>
      : TransformFunction<T[K], [...Path, K & string]>
    : T[K] extends object
      ? AuthClientToQuery<T[K], [...Path, K & string]>
      : never;
};
/* eslint-enable typescript-eslint/no-explicit-any */

/**
 * Creates a TanStack Query client for a Better Auth client.
 *
 * ```ts
 * const client = createAuthQueryClient(betterAuthClient)
 *
 * useMutation(client.signIn.email.mutationOptions())
 * ```
 */
// eslint-disable-next-line typescript-eslint/no-explicit-any
export const createAuthQueryClient = <TClient extends Record<string, any>>(
  client: TClient,
  path: string[] = [],
): AuthClientToQuery<TClient> =>
  new Proxy(() => {}, {
    get(_, key: string) {
      const newPath = [...path, key];
      // eslint-disable-next-line typescript-eslint/no-explicit-any
      const getTarget = () => path.reduce((acc, k) => acc?.[k], client as any);

      if (key === "queryKey") {
        return (input?: unknown) => (input !== undefined ? [...path, input] : path);
      }

      if (key === "queryOptions") {
        const target = getTarget();
        return (input?: unknown, options?: object) => ({
          ...options,
          queryKey: input !== undefined ? [...path, input] : path,
          queryFn: async () => {
            const result = await target(input);
            if (result.error) throw result.error;
            return result.data;
          },
        });
      }

      if (key === "mutationOptions") {
        const target = getTarget();
        return (options?: object) => ({
          ...options,
          mutationKey: path,
          mutationFn: async (variables: unknown) => {
            const result = await target(variables);
            if (result.error) throw result.error;
            return result.data;
          },
        });
      }

      return createAuthQueryClient(client, newPath);
    },
  }) as unknown as AuthClientToQuery<TClient>;
