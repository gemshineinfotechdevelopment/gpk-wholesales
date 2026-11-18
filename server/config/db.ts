import mongoose from 'mongoose';
import dns from 'dns';

// Fix for querySrv ECONNREFUSED on local ISP / Windows DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if not supported in environment
}

export const connectDB = async (retryCount = 0): Promise<void> => {
  let uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/gpk_wholesales';

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

  // Ensure DB name is explicitly set to gpk_wholesales if not specified
  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/gpk_wholesales?');
  } else if (uri.endsWith('.mongodb.net/')) {
    uri = `${uri}gpk_wholesales?retryWrites=true&w=majority`;
  } else if (uri.endsWith('.mongodb.net')) {
    uri = `${uri}/gpk_wholesales?retryWrites=true&w=majority`;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log(`=============================================`);
    console.log(`[Database] MongoDB Atlas Connected Successfully!`);
    console.log(`[Database Host] ${conn.connection.host}`);
    console.log(`[Database Name] ${conn.connection.name}`);
    console.log(`=============================================`);
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB Atlas (Attempt ${retryCount + 1}):`, error);
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

