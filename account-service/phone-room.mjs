import { DurableObject } from 'cloudflare:workers';
import { execute, tick, nextAlarm } from './phone-engine.mjs';

export class PhoneRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS phone_meta (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS phone_entries (chain INTEGER NOT NULL, round INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(chain,round))');
    this.entries = {
      get: (chain, round) => { const row = this.sql.exec('SELECT data FROM phone_entries WHERE chain=? AND round=?', chain, round).toArray()[0]; return row ? JSON.parse(row.data) : null; },
      put: (chain, round, value) => this.sql.exec('INSERT OR REPLACE INTO phone_entries(chain,round,data) VALUES(?,?,?)', chain, round, JSON.stringify(value)),
    };
  }
  #read() { const row = this.sql.exec('SELECT data FROM phone_meta WHERE id=1').toArray()[0]; return row ? JSON.parse(row.data) : null; }
  #write(s) { this.sql.exec('INSERT OR REPLACE INTO phone_meta(id,data) VALUES(1,?)', JSON.stringify(s)); }
  async command(actor, action, data = {}) {
    const now = Date.now();
    let result;
    try {
      // No await between read, validation and writes: competing ready requests
      // cannot both finalize a round. Failed commands roll back draft writes.
      this.ctx.storage.transactionSync(() => {
        const out = execute(this.#read(), actor, action, data, this.entries, now);
        this.#write(out.state); result = out.result;
      });
    } catch (e) {
      result = { error: e.status ? e.message : 'Room service is temporarily unavailable.', status: e.status || 500 };
    }
    // Re-read after the transaction; scheduling never writes stale metadata.
    const s = this.#read();
    if (s && now >= s.expiresAt) { await this.ctx.storage.deleteAll(); return { error: 'Room expired.', status: 404 }; }
    const alarm = nextAlarm(s, now);
    if (alarm) await this.ctx.storage.setAlarm(alarm);
    return result;
  }
  async alarm() {
    const now = Date.now(), s = this.#read();
    if (!s) return;
    if (now >= s.expiresAt) { await this.ctx.storage.deleteAll(); return; }
    this.ctx.storage.transactionSync(() => { const current = this.#read(); tick(current, this.entries, now); this.#write(current); });
    await this.ctx.storage.setAlarm(nextAlarm(this.#read(), now));
  }
}
