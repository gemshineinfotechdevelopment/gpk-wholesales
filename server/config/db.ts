import mongoose from 'mongoose';
import dns from 'dns';

// Fix for querySrv ECONNREFUSED on local ISP / Windows DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if not supported in environment
}

const ATLAS_DEFAULT_URI =
  'mongodb+srv://heamanthprabhu59_db_user:heamanth007@cluster0.zr2dveb.mongodb.net/gpk_wholesales?retryWrites=true&w=majority';

export const connectDB = async (retryCount = 0): Promise<void> => {
  let uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'mongodb://127.0.0.1:27017/gpk_billing'
      : ATLAS_DEFAULT_URI);

  // Check if placeholder password hasn't been replaced yet
  if (uri.includes('<db_password>') || uri.includes('<password>')) {
    console.error('========================================================================');
    console.error('[Database Warning] Found placeholder password in MONGODB_URI!');
    console.error('Please replace <db_password> in server/.env with your actual Atlas password.');
    console.error('========================================================================');
  }

  // Strip accidental angle brackets if user typed e.g. <mypassword>
  if (uri.includes('<') && uri.includes('>') && !uri.includes('<db_password>') && !uri.includes('<password>')) {
    uri = uri.replace(/<([^>]+)>/g, '$1');
  }

  // Ensure DB name is explicitly set to gpk_wholesales if not specified on Atlas
  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/gpk_wholesales?');
  } else if (uri.endsWith('.mongodb.net/')) {
    uri = `${uri}gpk_wholesales?retryWrites=true&w=majority`;
  } else if (uri.endsWith('.mongodb.net')) {
    uri = `${uri}/gpk_wholesales?retryWrites=true&w=majority`;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 6000,
      socketTimeoutMS: 45000,
    });
    console.log(`=============================================`);
    console.log(`[Database] MongoDB Connected Successfully!`);
    console.log(`[Database Host] ${conn.connection.host}`);
    console.log(`[Database Name] ${conn.connection.name}`);
    console.log(`=============================================`);
  } catch (error: any) {
    console.error(`[Database Error] Failed to connect to MongoDB (${error.message}) - Attempt ${retryCount + 1}`);

    // Fallback: If local 127.0.0.1 was specified but is not running on this machine (e.g. in local development),
    // automatically fall back to MongoDB Atlas so the app continues working smoothly.
    const isLocalhostUri = uri.includes('127.0.0.1') || uri.includes('localhost');
    const fallbackUri = process.env.MONGODB_ATLAS_URI || ATLAS_DEFAULT_URI;

    if (isLocalhostUri && fallbackUri && uri !== fallbackUri) {
      console.warn(`[Database] Local MongoDB is not reachable. Falling back to MongoDB Atlas...`);
      try {
        const fallbackConn = await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        });
        console.log(`=============================================`);
        console.log(`[Database] Connected to Fallback MongoDB Atlas!`);
        console.log(`[Database Host] ${fallbackConn.connection.host}`);
        console.log(`[Database Name] ${fallbackConn.connection.name}`);
        console.log(`=============================================`);
        return;
      } catch (fallbackError: any) {
        console.error(`[Database Error] Fallback Atlas connection also failed:`, fallbackError.message);
      }
    }

    if (retryCount < 5) {
      console.log(`[Database] Retrying connection in 3 seconds...`);
      setTimeout(() => connectDB(retryCount + 1), 3000);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB disconnected. Attempting reconnection...');
});

mongoose.connection.on('error', (err: any) => {
  console.error('[Database Error] MongoDB connection error:', err);
});
