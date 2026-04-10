const SUPABASE_MODULE_URL = 'https://esm.sh/@supabase/supabase-js@2';

function normalizeLeaderboardRow(row) {
    return {
        playerId: row && typeof row.player_id === 'string' && row.player_id.trim()
            ? row.player_id.trim()
            : 'Guest',
        score: row && Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
        result: row && typeof row.result === 'string' && row.result.trim() ? row.result.trim() : '-',
        createdAt: row && row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
}

function normalizeEntry(entry) {
    return {
        playerId: entry && typeof entry.playerId === 'string' && entry.playerId.trim()
            ? entry.playerId.trim()
            : 'Guest',
        score: entry && Number.isFinite(Number(entry.score)) ? Number(entry.score) : 0,
        result: entry && typeof entry.result === 'string' && entry.result.trim() ? entry.result.trim() : '-',
        createdAt: entry && Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : Date.now()
    };
}

export function createSupabaseLeaderboardService({ config = {}, tableName = 'rhythm_leaderboard' } = {}) {
    const supabaseUrl = typeof config.url === 'string' ? config.url.trim() : '';
    const supabaseAnonKey = typeof config.anonKey === 'string' ? config.anonKey.trim() : '';
    const table = typeof tableName === 'string' && tableName.trim() ? tableName.trim() : 'rhythm_leaderboard';

    let clientPromise = null;
    let subscriptionChannel = null;

    function isConfigured() {
        return Boolean(supabaseUrl && supabaseAnonKey);
    }

    async function getClient() {
        if (!isConfigured()) return null;
        if (!clientPromise) {
            clientPromise = import(SUPABASE_MODULE_URL).then(({ createClient }) => {
                return createClient(supabaseUrl, supabaseAnonKey);
            });
        }
        return clientPromise;
    }

    async function loadEntries(limit = 10) {
        const client = await getClient();
        if (!client) return null;

        const { data, error } = await client
            .from(table)
            .select('player_id, score, result, created_at')
            .order('score', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return Array.isArray(data) ? data.map(normalizeLeaderboardRow) : [];
    }

    async function submitEntry(entry) {
        const client = await getClient();
        if (!client) return null;

        const nextEntry = normalizeEntry(entry);
        const payload = {
            player_id: nextEntry.playerId,
            score: nextEntry.score,
            result: nextEntry.result,
            created_at: new Date(nextEntry.createdAt).toISOString()
        };

        const { error } = await client.from(table).insert(payload);
        if (error) throw error;
        return payload;
    }

    async function subscribe(onChange) {
        const client = await getClient();
        if (!client) return null;
        if (subscriptionChannel) return subscriptionChannel;

        subscriptionChannel = client
            .channel(`rhythm-leaderboard-${table}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                if (typeof onChange === 'function') {
                    onChange();
                }
            })
            .subscribe();

        return subscriptionChannel;
    }

    async function disconnect() {
        if (!subscriptionChannel) return;
        const client = await getClient();
        if (client && typeof client.removeChannel === 'function') {
            await client.removeChannel(subscriptionChannel);
        } else if (typeof subscriptionChannel.unsubscribe === 'function') {
            await subscriptionChannel.unsubscribe();
        }
        subscriptionChannel = null;
    }

    return {
        isConfigured,
        loadEntries,
        submitEntry,
        subscribe,
        disconnect
    };
}
