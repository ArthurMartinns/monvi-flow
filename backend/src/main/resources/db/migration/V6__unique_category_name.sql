CREATE UNIQUE INDEX ux_category_user_type_name
    ON category (user_id, type, lower(btrim(name)));
