ALTER TABLE app_user ADD COLUMN email character varying(255);
ALTER TABLE app_user ADD CONSTRAINT app_user_email_key UNIQUE (email);
