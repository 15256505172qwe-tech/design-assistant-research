import { promises as fs } from 'node:fs';
import path from 'node:path';

class StorageService {
  constructor() {
    this.runId = process.env.EXPERIMENT_RUN_ID || 'default';
    this.rootPrefix = `runs/${this.runId}`;
    this.localRoot = process.env.LOCAL_STORAGE_DIR || path.resolve(process.cwd(), 'data');
    this.forceLocal = process.env.USE_LOCAL_STORAGE === '1' || process.env.NODE_ENV === 'test';
    this._store = null;
  }

  async blobStore() {
    if (this.forceLocal) return null;
    if (this._store) return this._store;
    const name = process.env.BLOB_STORE_NAME;
    if (!name) {
      if (process.env.NODE_ENV !== 'production') return null;
      throw new Error('BLOB_STORE_NAME environment variable is required');
    }
    const { getStore } = await import('@edgeone/pages-blob');
    this._store = getStore({ name, consistency: 'strong' });
    return this._store;
  }

  fullKey(key) {
    return `${this.rootPrefix}/${String(key).replace(/^\/+/, '')}`;
  }

  localPath(key) {
    return path.join(this.localRoot, ...this.fullKey(key).split('/'));
  }

  async putObject(key, content) {
    const store = await this.blobStore();
    if (store) {
      let value = content;
      if (Buffer.isBuffer(content)) value = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
      await store.set(this.fullKey(key), value);
      return;
    }
    const target = this.localPath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.isBuffer(content) ? content : String(content));
  }

  async getObject(key) {
    const store = await this.blobStore();
    if (store) {
      try {
        const value = await store.get(this.fullKey(key), { type: 'text' });
        return value ?? null;
      } catch (err) {
        if (/not found/i.test(err?.message || '')) return null;
        throw err;
      }
    }
    try { return await fs.readFile(this.localPath(key), 'utf8'); }
    catch (err) { if (err.code === 'ENOENT') return null; throw err; }
  }

  async getObjectBuffer(key) {
    const store = await this.blobStore();
    if (store) {
      try {
        const value = await store.get(this.fullKey(key), { type: 'arrayBuffer' });
        return value == null ? null : Buffer.from(value);
      } catch (err) {
        if (/not found/i.test(err?.message || '')) return null;
        throw err;
      }
    }
    try { return await fs.readFile(this.localPath(key)); }
    catch (err) { if (err.code === 'ENOENT') return null; throw err; }
  }

  async deleteObject(key) {
    const store = await this.blobStore();
    if (store) {
      try { await store.delete(this.fullKey(key)); } catch (_) {}
      return;
    }
    try { await fs.unlink(this.localPath(key)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
  }

  async listObjects(prefix = '', limit = 5000) {
    const store = await this.blobStore();
    if (store) {
      const result = await store.list({ prefix: this.fullKey(prefix), limit, consistency: 'strong' });
      const root = `${this.rootPrefix}/`;
      return (result.blobs || []).map(item => ({ ...item, key: item.key.startsWith(root) ? item.key.slice(root.length) : item.key }));
    }
    const rootDir = this.localPath(prefix);
    const results = [];
    const walk = async dir => {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (err) { if (err.code === 'ENOENT') return; throw err; }
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(p);
        else {
          const rel = path.relative(path.join(this.localRoot, ...this.rootPrefix.split('/')), p).split(path.sep).join('/');
          results.push({ key: rel });
          if (results.length >= limit) return;
        }
      }
    };
    await walk(rootDir);
    return results;
  }
}

export const storageService = new StorageService();
