CREATE TABLE "household_photos" (
	"household_id" uuid PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"mime" text DEFAULT 'image/webp' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_photos" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"mime" text DEFAULT 'image/webp' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty" double precision NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chores" ADD COLUMN "group_size" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "map_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "entrance" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "apartment" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "floor" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "rent_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "rent_day" integer;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "utilities_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "household_photos" ADD CONSTRAINT "household_photos_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_photos" ADD CONSTRAINT "member_photos_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_items_item_idx" ON "purchase_items" USING btree ("item_id");