ALTER TABLE "items" ADD COLUMN "no_restock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "password_hash" text;