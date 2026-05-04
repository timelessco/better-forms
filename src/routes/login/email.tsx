import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { Loader2Icon } from "@/components/ui/icons";
import * as React from "react";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { revalidateLogic, useAppForm } from "@/components/ui/tanstack-form";
import { authClient } from "@/lib/auth/auth-client";
import { guestMiddleware } from "@/lib/auth/middleware";
import { Logo } from "@/components/ui/logo";

const emailSchema = z.object({
  email: z.email({ error: "Please enter a valid email address" }),
});

const SAFE_REDIRECT_PATTERN = /^\/[a-zA-Z0-9\-_/$.~]+$/;

const EmailLoginPage = () => {
  const [sent, setSent] = React.useState(false);
  const [sentEmail, setSentEmail] = React.useState("");
  const { redirect: redirectTo } = Route.useSearch();

  const callbackURL =
    redirectTo && SAFE_REDIRECT_PATTERN.test(redirectTo) ? redirectTo : "/dashboard";

  const magicLinkMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      const result = await authClient.signIn.magicLink({
        email: emailAddress,
        callbackURL,
      });
      if (result.error) {
        throw new Error(result.error.message || "Failed to send magic link");
      }
      return result;
    },
    onError: (error: Error) => {
      form.setFieldMeta("email", (prev) => ({
        ...prev,
        errors: [{ message: error.message }],
        isTouched: true,
      }));
    },
  });

  const form = useAppForm({
    defaultValues: { email: "" } as z.input<typeof emailSchema>,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: emailSchema, onDynamicAsyncDebounceMs: 500 },
    onSubmit: async ({ value }) => {
      const result = await magicLinkMutation.mutateAsync(value.email);
      if (result) {
        setSentEmail(value.email);
        setSent(true);
      }
    },
  });

  const isPending = magicLinkMutation.isPending;

  if (sent) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[300px] flex-col justify-center">
        <header className="mb-[54px] flex items-center justify-center">
          <Logo className="h-10 w-6 text-foreground/90" />
        </header>

        <main className="flex flex-col items-center justify-center gap-4">
          <div className="space-y-2 text-center">
            <h2 className="text-sm font-semibold text-foreground">Check your email</h2>
            <p className="text-xs text-muted-foreground">
              We sent a sign-in link to <span className="text-foreground/80">{sentEmail}</span>
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSent(false);
              magicLinkMutation.reset();
            }}
          >
            Try a different email
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[300px] flex-col justify-center">
      <header className="mb-[54px] flex items-center justify-center">
        <Logo className="h-10 w-6 text-foreground/90" />
      </header>

      <main className="flex flex-col items-center justify-center gap-4">
        <form.AppForm>
          <form.Form className="flex w-full flex-col gap-4">
            <form.AppField name="email">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <field.FieldSet className="gap-1">
                    <field.Field data-invalid={isInvalid}>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        aria-label="Email address"
                        autoComplete="email"
                        name="email"
                        autoFocus
                        value={field.state.value ?? ""}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        disabled={isPending}
                        aria-invalid={isInvalid}
                        className="h-9 rounded-xl"
                      />
                    </field.Field>
                    <field.FieldError />
                  </field.FieldSet>
                );
              }}
            </form.AppField>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl font-sans text-base font-medium"
              size="lg"
            >
              {isPending ? (
                <Loader2Icon className="h-4 w-4 animate-spin" aria-label="Loading" />
              ) : (
                "Continue with Email"
              )}
            </Button>
          </form.Form>
        </form.AppForm>
      </main>
    </div>
  );
};

export const Route = createFileRoute("/login/email")({
  server: {
    middleware: [guestMiddleware],
  },
  validateSearch: zodValidator(
    z.object({
      redirect: z.string().optional(),
    }),
  ),
  component: EmailLoginPage,
});
