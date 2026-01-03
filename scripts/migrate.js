const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Use environment variable for database path if available (for production)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database', 'masterclass.db');
const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`✓ Created database directory: ${dbDir}`);
}

console.log(`Database will be created at: ${dbPath}`);

// Read schema file
const schema = fs.readFileSync(schemaPath, 'utf8');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Connected to SQLite database');
});

// Run migrations
db.exec(schema, (err) => {
    if (err) {
        console.error('Error running migrations:', err);
        process.exit(1);
    }
    console.log('✓ Database schema created successfully');

    // Insert some default categories
    const insertCategories = `
        INSERT OR IGNORE INTO categories (name, slug, description, access_level, display_order) VALUES
        ('Business Fundamentals', 'business-fundamentals', 'Learn the foundations of building a successful business', 'free', 1),
        ('Advanced Marketing', 'advanced-marketing', 'Master advanced marketing strategies', 'premium', 2),
        ('Sales Mastery', 'sales-mastery', 'Become a sales expert', 'premium', 3),
        ('Faith & Wealth', 'faith-wealth', 'Build wealth while staying true to your values', 'free', 4),
        ('Community Corner', 'community', 'Connect with fellow entrepreneurs', 'free', 5);
    `;

    db.exec(insertCategories, (err) => {
        if (err) {
            console.error('Error inserting categories:', err);
        } else {
            console.log('✓ Default categories created');
        }

        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            console.log('\n✅ Database setup complete!');
            console.log('You can now start the server with: npm start');
        });
    });
});
