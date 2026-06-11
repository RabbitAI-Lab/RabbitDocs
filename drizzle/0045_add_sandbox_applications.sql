CREATE TABLE IF NOT EXISTS "sandbox_applications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "sandbox_url" text,
  "reason" text,
  "reviewed_by" text REFERENCES "users"("id"),
  "reviewed_at" text,
  "review_note" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  UNIQUE("user_id")
);
