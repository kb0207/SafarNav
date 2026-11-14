import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
export const journeyFeedback = pgTable(
  "journey_feedback",
  {
    id: uuid("id").primaryKey(),
    journeyHash: text("journey_hash").notNull(),
    region: text("region").notNull(),
    mode: text("mode").notNull(),
    rating: integer("rating").notNull(),
    lighting: text("lighting").notNull(),
    activity: text("activity").notNull(),
    concern: text("concern").notNull(),
    comments: text("comments").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("feedback_region_idx").on(t.region),
    uniqueIndex("feedback_journey_idx").on(t.journeyHash),
  ],
);
export const segmentObservations = pgTable(
  "segment_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    feedbackId: uuid("feedback_id")
      .references(() => journeyFeedback.id, { onDelete: "cascade" })
      .notNull(),
    coarseCell: text("coarse_cell").notNull(),
    concern: text("concern").notNull(),
  },
  (t) => [index("observations_cell_idx").on(t.coarseCell)],
);
export const aggregateSegmentMetrics = pgTable("aggregate_segment_metrics", {
  coarseCell: text("coarse_cell").primaryKey(),
  sampleCount: integer("sample_count").notNull().default(0),
  ratingSum: integer("rating_sum").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
