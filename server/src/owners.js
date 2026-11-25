// Owners: one per browser. Creating one copies the samples in; every other request finds the
// owner by the key the browser sends; owners unseen for 30 days are removed with their rows.

// Makes the random key; a version 4 UUID has 122 random bits, too many to guess.
import { randomUUID } from 'node:crypto';

// Lengths of time, in milliseconds.
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
// Owners not seen for this many days are deleted with everything they saved.
export const STALE_DAYS = 30;

// The owner queries for one database, prepared once.
export function ownerStore(db) {
  // Adds an owner and returns its new id.
  const insertOwner = db.prepare(`
    INSERT INTO owners (key, created_at, last_seen_at) VALUES (@key, @now, @now) RETURNING id
  `);
  // Adds one of the owner's transactions.
  const insertSample = db.prepare(`
    INSERT INTO transactions (owner_id, type, amount_cents, category, date, note)
    VALUES (@owner_id, @type, @amount_cents, @category, @date, @note)
  `);
  // Finds an owner by key.
  const findByKey = db.prepare('SELECT id, last_seen_at FROM owners WHERE key = ?');
  // Records a new last-seen time.
  const touch = db.prepare('UPDATE owners SET last_seen_at = ? WHERE id = ?');
  // Removes every owner last seen before a cutoff; the foreign key removes their rows too.
  const deleteBefore = db.prepare('DELETE FROM owners WHERE last_seen_at < ?');

  // The owner and its samples in one transaction: saved together or not at all.
  const create = db.transaction((key, now, samples) => {
    // The new owner's id, for the samples' owner_id.
    const { id } = insertOwner.get({ key, now: now.toISOString() });
    // Every sample, as this owner's row.
    samples.forEach((sample) => insertSample.run({ ...sample, owner_id: id }));
  });

  return {
    // Makes an owner holding a copy of `samples` and returns its key.
    createOwner(now, samples) {
      // The key the browser will keep and send back with every request.
      const key = randomUUID();
      // Saves the owner and the samples.
      create(key, now, samples);
      // Only the key leaves the server; the id stays private.
      return key;
    },

    // The id of the owner with this key, or null if there is none. It also records that the
    // owner was seen, but writes only when the last record is over an hour old: one small
    // write per hour of use instead of one per request, precise enough for a 30-day cutoff.
    findOwnerId(key, now) {
      // The owner row, or undefined.
      const owner = findByKey.get(key);
      // Unknown key.
      if (owner === undefined) return null;
      // How long ago the owner was last recorded.
      const sinceSeen = now.getTime() - Date.parse(owner.last_seen_at);
      // Only a stale record is refreshed.
      if (sinceSeen > HOUR_MS) touch.run(now.toISOString(), owner.id);
      // The id the routes filter by.
      return owner.id;
    },

    // Deletes owners not seen for STALE_DAYS days and returns how many went.
    deleteStaleOwners(now) {
      // The moment STALE_DAYS days before now, as an ISO time to compare with.
      const cutoff = new Date(now.getTime() - STALE_DAYS * DAY_MS).toISOString();
      // `changes` counts the owners removed; their transactions go by cascade.
      return deleteBefore.run(cutoff).changes;
    },
  };
}
