// Loads the sample data, emptying the table first. Run with: npm run seed

// rows is the sample data; seedDatabase empties the table and inserts it.
import { rows, seedDatabase } from './sampleData.js';

// Runs the seed. Importing sampleData.js already opened the database through db.js.
seedDatabase();
// Reports how many rows went in.
console.log(`Seeded ${rows.length} transactions (table emptied first).`);
