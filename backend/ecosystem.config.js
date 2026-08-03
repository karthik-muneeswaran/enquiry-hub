module.exports = {
  apps: [
    {
      name: 'property-api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      kill_timeout: 30000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
