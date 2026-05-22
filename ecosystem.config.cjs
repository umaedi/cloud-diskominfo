module.exports = {
  apps: [
    {
      name: 'cloud-api-diskominfo',
      script: './dist/index.js',
      instances: 'max',       // Run in cluster mode utilizing all CPU cores
      exec_mode: 'cluster',   // Cluster mode for load balancing and high availability
      watch: false,           // Do not watch files in production
      max_memory_restart: '1G', // Restart app if memory exceeds 1GB
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
