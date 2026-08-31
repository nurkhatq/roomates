CREATE TABLE "purchase_photos" (
	"purchase_id" uuid PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"mime" text DEFAULT 'image/jpeg' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_photos" ADD CONSTRAINT "purchase_photos_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;