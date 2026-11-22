// Loads the sample data, emptying the table first. Run with: npm run seed
import { rows, seedDatabase } from './sampleData.js';

seedDatabase();
console.log(`Seeded ${rows.length} transactions (table emptied first).`);
