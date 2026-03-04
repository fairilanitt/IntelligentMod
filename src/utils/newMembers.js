/**
 * Tracks user IDs that have just joined a guild and haven't sent
 * their first message yet.
 *
 * Key:   guildId
 * Value: Set<userId>
 *
 * This is an in-memory store — it resets when the bot restarts,
 * which is acceptable because we only care about the very first
 * message after joining.
 */

/** @type {Map<string, Set<string>>} */
const pendingMembers = new Map();

function markPending(guildId, userId) {
    if (!pendingMembers.has(guildId)) {
        pendingMembers.set(guildId, new Set());
    }
    pendingMembers.get(guildId).add(userId);
}

function isPending(guildId, userId) {
    return pendingMembers.get(guildId)?.has(userId) ?? false;
}

function clearPending(guildId, userId) {
    pendingMembers.get(guildId)?.delete(userId);
}

module.exports = { markPending, isPending, clearPending };
