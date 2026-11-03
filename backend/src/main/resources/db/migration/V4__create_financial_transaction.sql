ALTER TABLE account ADD CONSTRAINT uq_account_id_user UNIQUE (id, user_id);
ALTER TABLE category ADD CONSTRAINT uq_category_id_user UNIQUE (id, user_id);

CREATE TABLE financial_transaction (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    account_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    description VARCHAR(255) NOT NULL CHECK (length(trim(description)) > 0),
    amount NUMERIC(19, 2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
    date DATE NOT NULL,
    FOREIGN KEY (account_id, user_id) REFERENCES account(id, user_id),
    FOREIGN KEY (category_id, user_id) REFERENCES category(id, user_id)
);

CREATE INDEX ix_transaction_user_date ON financial_transaction (user_id, date DESC, id DESC);
CREATE INDEX ix_transaction_account ON financial_transaction (account_id);
CREATE INDEX ix_transaction_category ON financial_transaction (category_id);
