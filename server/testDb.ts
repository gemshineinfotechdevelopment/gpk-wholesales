import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {}

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function test() {
  let uri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  console.log('Original URI:', uri.replace(/:([^@]+)@/, ':****@'));

  if (uri.includes('<db_password>') || uri.includes('<password>')) {
    console.error('ERROR: You still have placeholder <db_password> in your connection string!');
    console.error('Please update server/.env with your real MongoDB Atlas password.');
    process.exit(1);
  }

  if (uri.includes('<') && uri.includes('>')) {
    uri = uri.replace(/<([^>]+)>/g, '$1');
  }

  // ensure database name is present
  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/gpk_wholesales?');
  } else if (uri.endsWith('.mongodb.net/')) {
    uri = `${uri}gpk_wholesales?retryWrites=true&w=majority`;
  }
  console.log('Sanitized URI:', uri.replace(/:([^@]+)@/, ':****@'));

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('CONNECTED SUCCESSFULLY to:', conn.connection.host, 'DB:', conn.connection.name);
    process.exit(0);
  } catch (err: any) {
    console.error('CONNECTION FAILED:', err.message);
    process.exit(1);
  }
}

test();
