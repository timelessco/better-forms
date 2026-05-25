CREATE TABLE "upload_rate_limits" (
	"ip" text PRIMARY KEY,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
