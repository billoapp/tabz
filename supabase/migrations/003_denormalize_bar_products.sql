-- Add denormalized columns to bar_products table for optimized customer queries
-- This allows customer app to query single table without joins

ALTER TABLE bar_products 
ADD COLUMN name TEXT NOT NULL DEFAULT '',
ADD COLUMN description TEXT,
ADD COLUMN category TEXT NOT NULL DEFAULT '',
ADD COLUMN image_url TEXT,
ADD COLUMN sku TEXT;

-- Create index for faster customer queries
CREATE INDEX idx_bar_products_bar_active ON bar_products(bar_id, active);

-- Add comment explaining the denormalization strategy
COMMENT ON TABLE bar_products IS 'Denormalized product data for customer app - contains copied fields from products/custom_products tables';
