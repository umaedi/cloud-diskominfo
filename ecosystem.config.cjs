module.exports = {
  apps: [
    {
      name: 'cloud-api-diskominfo',
      script: './dist/index.js',
      // instances: 'max',       // Run in cluster mode utilizing all CPU cores (Overkill)
      // exec_mode: 'cluster',   // Cluster mode for load balancing (Overkill)
      // max_memory_restart: '1G', // Restart app if memory exceeds 1GB (Overkill)
      instances: 1,          // Hanya 1 instance saja
      exec_mode: 'fork',     // Mode sederhana (fork), hemat penggunaan RAM & CPU
      watch: false,
      max_memory_restart: '200M', // Batas aman 200MB untuk service ringan
      env: {
        NODE_ENV: 'production',
        PORT: 9932
      }
    }
  ]
};
