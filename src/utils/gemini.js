/**
 * Gemini AI utility — thin wrapper around @google/generative-ai.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Analyze a new member's first message.
 * Returns { safe: boolean, raw: string }.
 *  - safe = true  → message looks legitimate, no action needed.
 *  - safe = false → message is suspicious, moderation action should be taken.
 */
async function analyzeFirstMessage(messageContent, username) {
    const prompt = [
        'You are a Discord server moderation assistant.',
        'A user who just joined the server has sent their very first message.',
        'Your job is to decide whether this message is legitimate and appropriate.',
        '',
        'Flag a message as NOT safe if it contains any of the following:',
        '- Spam or self-promotion (unsolicited links, ads, crypto/NFT scams)',
        '- Phishing or malicious links',
        '- Hate speech, slurs, or targeted harassment',
        '- NSFW or sexually explicit content',
        '- Mass-mention spam or raid-style messages',
        '- Gibberish with suspicious links',
        '',
        'A message IS safe if it is a normal greeting, introduction, question, or conversation.',
        '',
        `Username: ${username}`,
        `Message: ${messageContent}`,
        '',
        'Respond with ONLY "Yes" if the message is safe, or "No" if it is not safe.',
    ].join('\n');

    try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim();
        const safe = raw.toLowerCase().startsWith('yes');
        return { safe, raw };
    } catch (error) {
        console.error('Gemini API error:', error.message);
        // On API failure, default to safe to avoid false positives.
        return { safe: true, raw: 'ERROR' };
    }
}

module.exports = { analyzeFirstMessage };
