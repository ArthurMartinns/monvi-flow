CREATE TABLE account (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
    initial_balance NUMERIC(19, 2) NOT NULL CHECK (initial_balance <> 'NaN'::numeric)
);

CREATE INDEX ix_account_user_id ON account (user_id, id);
