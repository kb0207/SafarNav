CREATE TABLE "aggregate_segment_metrics" (
	"coarse_cell" text PRIMARY KEY NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"journey_hash" text NOT NULL,
	"region" text NOT NULL,
	"mode" text NOT NULL,
	"rating" integer NOT NULL,
	"lighting" text NOT NULL,
	"activity" text NOT NULL,
	"concern" text NOT NULL,
	"comments" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" uuid NOT NULL,
	"coarse_cell" text NOT NULL,
	"concern" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "segment_observations" ADD CONSTRAINT "segment_observations_feedback_id_journey_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."journey_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_region_idx" ON "journey_feedback" USING btree ("region");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_journey_idx" ON "journey_feedback" USING btree ("journey_hash");--> statement-breakpoint
CREATE INDEX "observations_cell_idx" ON "segment_observations" USING btree ("coarse_cell");