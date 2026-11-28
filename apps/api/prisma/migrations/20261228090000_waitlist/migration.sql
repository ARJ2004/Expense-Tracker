-- iPhone waitlist from the website. Email only; not tied to a user account.
CREATE TABLE "waitlist_entries" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "platform" VARCHAR(16) NOT NULL DEFAULT 'ios',
    "source" VARCHAR(32),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waitlist_entries_email_key" ON "waitlist_entries"("email");
