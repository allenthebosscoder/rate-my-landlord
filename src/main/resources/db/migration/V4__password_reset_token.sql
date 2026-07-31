CREATE TABLE passwordresettoken (
    used boolean NOT NULL,
    expiresat timestamp(6) without time zone,
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token character varying(255),
    CONSTRAINT passwordresettoken_pkey PRIMARY KEY (id),
    CONSTRAINT fk_passwordresettoken_user FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE SEQUENCE passwordresettoken_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
