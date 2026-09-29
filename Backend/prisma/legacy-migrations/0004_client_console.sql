CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "floor_plan_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"floor_plan_id" text NOT NULL,
	"client_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"floor" text,
	"area" text,
	"category" text DEFAULT 'General Feedback' NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"marker" jsonb,
	"attachments" jsonb,
	"architect_response" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"number" text NOT NULL,
	"project_id" text,
	"order_id" text,
	"description" text,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"fees" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "kind" text DEFAULT '2D' NOT NULL;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "status" text DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "review_status" text DEFAULT 'NOT_STARTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "resource_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "settings" jsonb;--> statement-breakpoint
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "favorites_resource_idx" ON "favorites" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "fp_feedback_plan_idx" ON "floor_plan_feedback" USING btree ("floor_plan_id");--> statement-breakpoint
CREATE INDEX "fp_feedback_project_idx" ON "floor_plan_feedback" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "fp_feedback_client_idx" ON "floor_plan_feedback" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_user_idx" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "floor_plans_project_idx" ON "floor_plans" USING btree ("project_id");