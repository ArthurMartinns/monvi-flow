CREATE TABLE app_user (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_app_user_name_not_blank CHECK (length(trim(name)) > 0),

    CONSTRAINT ck_app_user_email_not_blank CHECK (length(trim(email)) > 0),

    CONSTRAINT ck_app_user_email_normalized CHECK (email = lower(trim(email))),

    CONSTRAINT ck_app_user_password_hash_not_blank CHECK (length(trim(password_hash)) > 0)
);

CREATE UNIQUE INDEX ux_app_user_email ON app_user (lower(email));