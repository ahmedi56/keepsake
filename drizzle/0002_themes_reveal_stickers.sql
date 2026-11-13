ALTER TABLE "contributions" ADD COLUMN "sticker" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "theme" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "reveal_at" timestamp;