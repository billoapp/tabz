    -- Fix bar context permissions for anonymous users
    -- This allows customer app to set bar context without authentication

    -- Grant execute permission to anonymous users
    GRANT EXECUTE ON FUNCTION set_bar_context TO anon;

    -- Success message
    SELECT 'Bar context permissions fixed for anonymous users' as status;