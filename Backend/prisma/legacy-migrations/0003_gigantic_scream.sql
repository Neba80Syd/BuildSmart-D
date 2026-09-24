CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"architect_id" text NOT NULL,
	"client_id" text,
	"project_id" text,
	"title" text NOT NULL,
	"type" text DEFAULT 'MEETING' NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text,
	"method" text DEFAULT 'VIDEO' NOT NULL,
	"location" text,
	"notes" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boq_items" (
	"id" text PRIMARY KEY NOT NULL,
	"boq_id" text NOT NULL,
	"category" text NOT NULL,
	"material" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"source" text,
	"notes" text,
	"linked_product_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boqs" (
	"id" text PRIMARY KEY NOT NULL,
	"architect_id" text NOT NULL,
	"project_id" text,
	"name" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"architect_id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_name" text NOT NULL,
	"project_type" text NOT NULL,
	"description" text,
	"location" text,
	"budget" double precision,
	"style" text,
	"site_area" double precision,
	"floors" integer,
	"rooms" integer,
	"requirements" jsonb,
	"status" text DEFAULT 'NEW' NOT NULL,
	"timeline" text,
	"price" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" text PRIMARY KEY NOT NULL,
	"architect_id" text NOT NULL,
	"project_id" text,
	"client_id" text,
	"name" text NOT NULL,
	"category" text DEFAULT 'Residential' NOT NULL,
	"type" text,
	"thumbnail" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tags" jsonb,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"requirements" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'EARNING' NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"status" text DEFAULT 'SUCCEEDED' NOT NULL,
	"description" text,
	"project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "education" jsonb;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "memberships" jsonb;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "languages" jsonb;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "service_areas" jsonb;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "visibility" text DEFAULT 'PUBLIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "credentials" jsonb;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "verification_docs" jsonb;--> statement-breakpoint
ALTER TABLE "architect_profiles" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_type" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_area" double precision;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "floors" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "rooms" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "style" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "requirements" jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_project_idx" ON "activities" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "appointments_architect_idx" ON "appointments" USING btree ("architect_id");--> statement-breakpoint
CREATE INDEX "boq_items_boq_idx" ON "boq_items" USING btree ("boq_id");--> statement-breakpoint
CREATE INDEX "boqs_architect_idx" ON "boqs" USING btree ("architect_id");--> statement-breakpoint
CREATE INDEX "boqs_project_idx" ON "boqs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requests_architect_idx" ON "design_requests" USING btree ("architect_id");--> statement-breakpoint
CREATE INDEX "requests_client_idx" ON "design_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "designs_architect_idx" ON "designs" USING btree ("architect_id");--> statement-breakpoint
CREATE INDEX "designs_project_idx" ON "designs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");