const { generateYoutubeExplanation } = require('./src/utils/youtubeEngine');

async function run() {
  console.log('Testing transcript fetch...');
  try {
    const res = await generateYoutubeExplanation('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('RESULT:', res.fallbackReason || 'Success no fallback');
  } catch (err) {
    console.error('ERROR:', err);
  }
}
run();
