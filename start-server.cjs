#!/usr/bin/env node

// =====================================================
// Concurrent Server Starter
// Runs both Vite preview and Agent API server
// =====================================================

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Blitzboard servers...');

// Start Agent API server on port 3001
const agentApi = spawn('node', ['scripts/agent-api.cjs'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Start Vite preview server on port (from PORT env or 4173)
const vitePreview = spawn('npm', ['run', 'preview', '--', '--host', '0.0.0.0'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  agentApi.kill('SIGTERM');
  vitePreview.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  agentApi.kill('SIGINT');
  vitePreview.kill('SIGINT');
  process.exit(0);
});

agentApi.on('exit', (code) => {
  console.log(`Agent API exited with code ${code}`);
  if (code !== 0) {
    vitePreview.kill();
    process.exit(code);
  }
});

vitePreview.on('exit', (code) => {
  console.log(`Vite preview exited with code ${code}`);
  if (code !== 0) {
    agentApi.kill();
    process.exit(code);
  }
});
