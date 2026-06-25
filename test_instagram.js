const assert = require('assert');
const { collectVideos, bestVideoUrl, shortcodeFromPath } = require('./instagram.js');

// bestVideoUrl picks the first entry (IG lists highest quality first)
assert.strictEqual(bestVideoUrl([{ type: 101, url: 'A' }, { type: 102, url: 'B' }]), 'A');
assert.strictEqual(bestVideoUrl([]), null);
assert.strictEqual(bestVideoUrl(undefined), null);

// shortcode extraction across IG URL shapes
assert.strictEqual(shortcodeFromPath('/reels/DXWytFFjEEG/'), 'DXWytFFjEEG');
assert.strictEqual(shortcodeFromPath('/reel/AbC-d_1/'), 'AbC-d_1');
assert.strictEqual(shortcodeFromPath('/p/XYZ123/'), 'XYZ123');
assert.strictEqual(shortcodeFromPath('/tv/QwE/'), 'QwE');
assert.strictEqual(shortcodeFromPath('/sidorin.aa/'), null);

// collectVideos walks nested Relay-shaped payloads (matches the real page JSON)
const media = (code, ...urls) => ({ node: { media: { code, video_versions: urls.map((url, i) => ({ type: 101 + i, url })) } } });
const payload = { data: { conn: { edges: [media('DXWytFFjEEG', 'MP4_HI', 'MP4_LO'), media('OTHER1', 'MP4_2')] } } };
assert.deepStrictEqual(collectVideos(payload), { DXWytFFjEEG: 'MP4_HI', OTHER1: 'MP4_2' });

// ignores nodes missing either key
assert.deepStrictEqual(collectVideos({ code: 'X' }), {});
assert.deepStrictEqual(collectVideos({ video_versions: [{ url: 'Y' }] }), {});

console.log('instagram.js: all tests passed');
