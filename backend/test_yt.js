async function test() {
  try {
    const yt = await import('youtube-transcript/dist/youtube-transcript.esm.js');
    console.log('KEYS:', Object.keys(yt));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
test();
