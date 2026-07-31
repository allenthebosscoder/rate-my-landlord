-- Baseline schema, captured from the Hibernate-generated dev database so it
-- matches exactly what the entities already produce (see the naming quirks
-- below before adding new columns by hand).
--
-- Note: Hibernate's default naming strategy here lowercases regular columns
-- without inserting underscores (passwordhash, isreported, showname, ...),
-- but DOES use "_id" for foreign-key/association columns (owner_id,
-- landlord_id, ...). Match that when adding columns, or set an explicit
-- @Column(name = "...") on the entity field.

CREATE TABLE app_user (
    id bigint NOT NULL,
    passwordhash character varying(255),
    username character varying(255) NOT NULL,
    CONSTRAINT app_user_pkey PRIMARY KEY (id),
    CONSTRAINT app_user_username_key UNIQUE (username)
);

CREATE SEQUENCE app_user_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE landlord (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    CONSTRAINT landlord_pkey PRIMARY KEY (id)
);

CREATE SEQUENCE landlord_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE property (
    id bigint NOT NULL,
    landlord_id bigint,
    city character varying(255),
    country character varying(255) NOT NULL,
    state character varying(255),
    zipcode character varying(255) NOT NULL,
    CONSTRAINT property_pkey PRIMARY KEY (id),
    CONSTRAINT fkbfs2qcd9dhgdh368emv23ggl6 FOREIGN KEY (landlord_id) REFERENCES landlord(id)
);

CREATE SEQUENCE property_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE authtoken (
    expiresat timestamp(6) without time zone,
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token character varying(255) NOT NULL,
    CONSTRAINT authtoken_pkey PRIMARY KEY (id),
    CONSTRAINT authtoken_token_key UNIQUE (token),
    CONSTRAINT fkdutfdoqfnb47r1jtm7jqux9tc FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE SEQUENCE authtoken_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE review (
    isreported boolean NOT NULL,
    rating double precision NOT NULL,
    showname boolean NOT NULL,
    createdat timestamp(6) without time zone,
    helpfulcount bigint NOT NULL,
    id bigint NOT NULL,
    owner_id bigint NOT NULL,
    property_id bigint,
    unhelpfulcount bigint NOT NULL,
    updatedat timestamp(6) without time zone,
    categories character varying(255),
    comment character varying(255),
    tenantlocation character varying(255),
    tenantname character varying(255),
    tenure character varying(255),
    CONSTRAINT review_pkey PRIMARY KEY (id),
    CONSTRAINT fk44y7vkv5225wg5tunne1vijkr FOREIGN KEY (property_id) REFERENCES property(id),
    CONSTRAINT fkh38vx2t2p9pqrdpxfa66lmuud FOREIGN KEY (owner_id) REFERENCES app_user(id)
);

CREATE SEQUENCE review_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE reviewvote (
    id bigint NOT NULL,
    review_id bigint NOT NULL,
    user_id bigint NOT NULL,
    votetype character varying(255),
    CONSTRAINT reviewvote_pkey PRIMARY KEY (id),
    CONSTRAINT reviewvote_review_id_user_id_key UNIQUE (review_id, user_id),
    CONSTRAINT fkgeg1mfudw89wg4q6ipqam8rg9 FOREIGN KEY (review_id) REFERENCES review(id),
    CONSTRAINT fkoie9691ismfg6tdev0xyp7t4q FOREIGN KEY (user_id) REFERENCES app_user(id)
);

CREATE SEQUENCE reviewvote_seq START WITH 1 INCREMENT BY 50 NO MINVALUE NO MAXVALUE CACHE 1;
