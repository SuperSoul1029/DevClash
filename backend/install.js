const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Running npm install youtube-transcript...');
  const output = execSync('npm install youtube-transcript', { encoding: 'utf-8', stdio: 'pipe' });
  fs.writeFileSync('install_log.txt', output);
  console.log('Install successful');
} catch (error) {
  fs.writeFileSync('install_log.txt', error.output ? error.output.join('\n') : error.message);
  console.error('Install failed. Check install_log.txt');
}
