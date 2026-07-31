-- Column name matches the existing naming convention for other booleans on
-- this table's siblings (isreported, showname on "review"): no underscore.
ALTER TABLE app_user ADD COLUMN isadmin boolean NOT NULL DEFAULT false;
