/**
 * Gemini AI utility — thin wrapper around @google/generative-ai.
 *
 * Supports a global (bot-owner) key and optional per-guild keys.
 * When a guild supplies its own key, it gets its own model instance
 * and is exempt from the shared rate limit.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

const MODEL_NAME = 'gemini-3.1-flash-lite-preview';

// Global instance (bot-owner key)
const globalGenAI = new GoogleGenerativeAI(config.geminiApiKey);
const globalModel = globalGenAI.getGenerativeModel({ model: MODEL_NAME });

// Cache per-guild model instances so we don't recreate them on every call
/** @type {Map<string, import('@google/generative-ai').GenerativeModel>} */
const guildModels = new Map();

/**
 * Get the model instance for a guild.
 * Uses the guild's own key if provided, otherwise the global key.
 */
function getModel(guildApiKey) {
    if (!guildApiKey) return globalModel;

    if (!guildModels.has(guildApiKey)) {
        const genAI = new GoogleGenerativeAI(guildApiKey);
        guildModels.set(guildApiKey, genAI.getGenerativeModel({ model: MODEL_NAME }));
    }

    return guildModels.get(guildApiKey);
}

/**
 * Analyze a new member's first message.
 * @param {string} messageContent
 * @param {string} username
 * @param {string|null} [guildApiKey] Optional per-guild API key.
 * @returns {Promise<{ safe: boolean, raw: string }>}
 */
async function analyzeFirstMessage(messageContent, username, guildApiKey = null) {
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
        const model = getModel(guildApiKey);
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
