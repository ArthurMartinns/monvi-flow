CREATE TABLE budget (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id),
    category_id BIGINT NOT NULL,
    month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
    limit_amount NUMERIC(19, 2) NOT NULL CHECK (limit_amount > 0 AND limit_amount <> 'NaN'::numeric),
    UNIQUE (user_id, category_id, month),
    FOREIGN KEY (category_id, user_id) REFERENCES category(id, user_id)
);
