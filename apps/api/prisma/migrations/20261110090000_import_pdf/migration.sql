-- Sprint 7: text-based PDF statements go through the same parse → review → confirm flow.
-- Adding an enum value is non-breaking; nothing in this migration uses it.
ALTER TYPE "ImportFormat" ADD VALUE IF NOT EXISTS 'pdf';
