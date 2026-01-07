module.exports = {
  apps: [{
    name: 'mbh-tools-api',
    script: 'server-unified.js',
    cwd: '/home/sam/chatbot-platform/mbh/commission-automator/upload-portal',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5011
    },
    error_file: '/home/sam/logs/mbh-tools-error.log',
    out_file: '/home/sam/logs/mbh-tools-out.log',
    log_file: '/home/sam/logs/mbh-tools-combined.log',
    time: true
  }]
};