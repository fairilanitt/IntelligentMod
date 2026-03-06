/**
 * Per-guild rate limiter for AI moderation calls.
 *
 * Uses a sliding-window approach: tracks timestamps of recent calls
 * per guild, and rejects new calls if the limit is exceeded.
 *
 * Guilds that provide their own API key bypass this limiter entirely.
 */

/** @type {Map<string, number[]>} guildId → array of call timestamps */
const windows = new Map();

// Default: 20 AI checks per hour per guild
const DEFAULT_MAX_CALLS = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Attempt to consume a rate-limit token for a guild.
 * @param {string} guildId
 * @returns {{ allowed: boolean, remaining: number, resetInMs: number }}
 */
function consume(guildId) {
    const now = Date.now();

    if (!windows.has(guildId)) {
        windows.set(guildId, []);
    }

    const timestamps = windows.get(guildId);

    // Purge entries older than the window
    while (timestamps.length > 0 && timestamps[0] <= now - WINDOW_MS) {
        timestamps.shift();
    }

    if (timestamps.length >= DEFAULT_MAX_CALLS) {
        const resetInMs = timestamps[0] + WINDOW_MS - now;
        return {
            allowed: false,
            remaining: 0,
            resetInMs,
        };
    }

    timestamps.push(now);

    return {
        allowed: true,
        remaining: DEFAULT_MAX_CALLS - timestamps.length,
        resetInMs: timestamps[0] + WINDOW_MS - now,
    };
}

/**
 * Peek at current usage without consuming a token.
 * @param {string} guildId
 * @returns {{ used: number, max: number, remaining: number }}
 */
function peek(guildId) {
    const now = Date.now();
    const timestamps = windows.get(guildId) || [];
    const active = timestamps.filter((t) => t > now - WINDOW_MS);
    return {
        used: active.length,
        max: DEFAULT_MAX_CALLS,
        remaining: DEFAULT_MAX_CALLS - active.length,
    };
}

module.exports = { consume, peek, DEFAULT_MAX_CALLS, WINDOW_MS };
