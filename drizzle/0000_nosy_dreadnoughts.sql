CREATE TABLE "chore_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chore_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"period_days" integer DEFAULT 7 NOT NULL,
	"order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_photos" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"mime" text DEFAULT 'image/webp' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"unit" text DEFAULT 'шт' NOT NULL,
	"check_interval_days" integer DEFAULT 7 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"oauth_sub" text,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_shares" (
	"purchase_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "purchase_shares_purchase_id_member_id_pk" PRIMARY KEY("purchase_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" text DEFAULT 'purchase' NOT NULL,
	"payer_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"bought_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"qty" double precision NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chore_events" ADD CONSTRAINT "chore_events_chore_id_chores_id_fk" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chore_events" ADD CONSTRAINT "chore_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chores" ADD CONSTRAINT "chores_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shares" ADD CONSTRAINT "purchase_shares_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shares" ADD CONSTRAINT "purchase_shares_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payer_id_members_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_events" ADD CONSTRAINT "stock_events_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_events" ADD CONSTRAINT "stock_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chore_events_chore_idx" ON "chore_events" USING btree ("chore_id","done_at");--> statement-breakpoint
CREATE INDEX "chores_household_idx" ON "chores" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "households_invite_code_idx" ON "households" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "items_household_idx" ON "items" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "members_household_idx" ON "members" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "purchase_shares_member_idx" ON "purchase_shares" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "purchases_household_idx" ON "purchases" USING btree ("household_id","bought_at");--> statement-breakpoint
CREATE INDEX "sessions_member_idx" ON "sessions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "stock_events_item_idx" ON "stock_events" USING btree ("item_id","at");