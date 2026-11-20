module.exports = {
  apps: [
    {
      name: 'gpk-billing-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5032,
        MONGODB_URI: 'mongodb://127.0.0.1:27017/gpk_billing',
      },
    },
  ],
};
