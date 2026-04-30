import { Link } from "@tanstack/react-router";

export const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background">
    <div className="text-center">
      <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
      <p className="mb-8 text-xl text-muted-foreground">Page not found</p>
      <Link
        to="/"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        Go home
      </Link>
    </div>
  </div>
);
