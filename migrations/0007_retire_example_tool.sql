-- Retire the illustrative tool without deleting historical references.
UPDATE "ai_chambers_tools"
SET "status" = 'archived', "updated_at" = now()
WHERE "slug" = 'organise-disclosure-material';
