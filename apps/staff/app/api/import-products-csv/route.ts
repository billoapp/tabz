import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side use
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('=== CSV IMPORT START ===');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const barId = formData.get('barId') as string;
    const mappingStr = formData.get('mapping') as string;
    
    console.log('CSV file received:', file?.name, file?.size);
    console.log('Bar ID:', barId);
    
    if (!file || !barId) {
      return NextResponse.json({ error: 'Missing file or bar ID' }, { status: 400 });
    }

    let mapping;
    try {
      mapping = JSON.parse(mappingStr || '{}');
    } catch (error) {
      mapping = {
        name: 'name',
        category: 'category', 
        description: 'description',
        price: 'price',
        sku: 'sku',
        image_url: 'image_url'
      };
    }

    // Parse CSV
    const csvText = await file.text();
    const rows = parseCSV(csvText);
    
    console.log('Parsed CSV rows:', rows.length);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      imported: [] as any[]
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Extract data using mapping
        const name = row[mapping.name] || '';
        const category = row[mapping.category] || '';
        const description = row[mapping.description] || '';
        const priceStr = row[mapping.price] || '';
        const sku = row[mapping.sku] || `CUSTOM-${Date.now()}-${i}`;
        const imageUrl = row[mapping.image_url] || '';

        // Validate required fields
        if (!name || !category || !priceStr) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Missing required fields (name, category, price)`);
          continue;
        }

        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 0) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Invalid price: ${priceStr}`);
          continue;
        }

        // Create custom product
        const { data: customProduct, error: customError } = await supabase
          .from('custom_products')
          .insert({
            bar_id: barId,
            name: name.trim(),
            category: category.trim(),
            description: description.trim() || null,
            image_url: imageUrl.trim() || null,
            sku: sku.trim(),
            active: true,
          })
          .select()
          .single();

        if (customError) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Failed to create custom product - ${customError.message}`);
          continue;
        }

        // Add to bar products
        const { error: barProductError } = await supabase
          .from('bar_products')
          .insert({
            bar_id: barId,
            product_id: null,
            custom_product_id: customProduct.id,
            name: name.trim(),
            description: description.trim() || null,
            category: category.trim(),
            image_url: imageUrl.trim() || null,
            sku: sku.trim(),
            sale_price: price,
            active: true,
          });

        if (barProductError) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Failed to add to menu - ${barProductError.message}`);
          // Clean up the custom product if bar product creation failed
          await supabase.from('custom_products').delete().eq('id', customProduct.id);
          continue;
        }

        results.success++;
        results.imported.push(customProduct);
        console.log(`Successfully imported: ${name}`);

      } catch (error: any) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${error.message}`);
      }
    }

    console.log('=== CSV IMPORT COMPLETE ===');
    console.log(`Success: ${results.success}, Failed: ${results.failed}`);

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('CSV import error:', error);
    return NextResponse.json({ 
      error: 'Failed to process CSV import',
      details: error.message 
    }, { status: 500 });
  }
}

function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] || '';
    });
    
    results.push(row);
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
