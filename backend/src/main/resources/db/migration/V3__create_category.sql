CREATE TABLE category (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
    type VARCHAR(7) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE'))
);

CREATE INDEX ix_category_user_id ON category (user_id, id);
