CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'FLASH_SALE' NOT NULL,
	"discount_type" text DEFAULT 'PERCENT' NOT NULL,
	"discount_value" double precision DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"code" text NOT NULL,
	"type" text DEFAULT 'PERCENT' NOT NULL,
	"value" double precision DEFAULT 0 NOT NULL,
	"min_order" double precision DEFAULT 0 NOT NULL,
	"max_uses" integer DEFAULT 0 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_sells" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"product_id" text NOT NULL,
	"related_product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"order_id" text,
	"product_id" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"messages" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"product_id" text NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"order_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"items" jsonb,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"resolution_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendor_traffic" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"day" text NOT NULL,
	"source" text NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_stock" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" text NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'BANK' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"account" jsonb,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "attributes" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "backorderable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "response" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "social_links" jsonb;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "shipping_policy" jsonb;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "tax_settings" jsonb;--> statement-breakpoint
CREATE INDEX "campaigns_vendor_idx" ON "campaigns" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "coupons_vendor_idx" ON "coupons" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "cross_sells_product_idx" ON "cross_sells" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "cross_sells_vendor_idx" ON "cross_sells" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "inquiries_vendor_idx" ON "inquiries" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "product_media_product_idx" ON "product_media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_media_vendor_idx" ON "product_media" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "returns_vendor_idx" ON "returns" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_traffic_vendor_idx" ON "vendor_traffic" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "warehouse_stock_wh_idx" ON "warehouse_stock" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "warehouse_stock_product_idx" ON "warehouse_stock" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "warehouses_vendor_idx" ON "warehouses" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "withdrawals_vendor_idx" ON "withdrawals" USING btree ("vendor_id");