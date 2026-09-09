import { getStore } from '@edgeone/pages-blob';

// 统一存储服务 (使用 EdgeOne Blob)
class StorageService {
  constructor() {
    const storeName = process.env.BLOB_STORE_NAME;
    if (!storeName) {
      throw new Error('BLOB_STORE_NAME environment variable is required');
    }
    this.store = getStore({
      name: storeName,
      consistency: 'strong', // 强一致性
    });
    // 实验批次前缀
    this.runId = process.env.EXPERIMENT_RUN_ID || 'default';
    this.rootPrefix = `runs/${this.runId}`;
  }

  // 内部方法：拼接完整路径
  _getFullPath(path) {
    // path 应该是相对路径，如 'logs/S01/...'
    return `${this.rootPrefix}/${path}`;
  }

  // 写入对象 (content 为字符串或 Buffer)
  async putObject(path, content) {
    const fullPath = this._getFullPath(path);
    let value = content;

    // 如果 content 是 Buffer，转换为 ArrayBuffer (SDK 要求)
    if (Buffer.isBuffer(content)) {
      value = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
      );
    }

    try {
      await this.store.set(fullPath, value);
    } catch (err) {
      console.error(`Blob put error: ${fullPath}`, err);
      throw new Error('存储写入失败');
    }
  }

  // 读取对象 (返回字符串)
  async getObject(path) {
    const fullPath = this._getFullPath(path);
    try {
      const result = await this.store.get(fullPath, { type: 'text' });
      if (result === undefined || result === null) return null;
      return result;
    } catch (err) {
      if (err.message && err.message.includes('not found')) return null;
      console.error(`Blob get error: ${fullPath}`, err);
      throw new Error('存储读取失败');
    }
  }

  // 读取对象为 Buffer (图片)
  async getObjectBuffer(path) {
    const fullPath = this._getFullPath(path);
    try {
      const result = await this.store.get(fullPath, { type: 'arrayBuffer' });
      if (result === undefined || result === null) return null;
      return Buffer.from(result);
    } catch (err) {
      if (err.message && err.message.includes('not found')) return null;
      console.error(`Blob get buffer error: ${fullPath}`, err);
      throw new Error('存储读取失败');
    }
  }

  // 删除对象
  async deleteObject(path) {
    const fullPath = this._getFullPath(path);
    try {
      await this.store.delete(fullPath);
    } catch (err) {
      console.error(`Blob delete error: ${fullPath}`, err);
      throw new Error('存储删除失败');
    }
  }

  // 列出对象，返回相对当前 run 的 key
  async listObjects(prefix, limit = 1000) {
    const fullPrefix = this._getFullPath(prefix);
    try {
      const result = await this.store.list({
        prefix: fullPrefix,
        limit,
        consistency: 'strong'
      });
      const root = `${this.rootPrefix}/`;
      // 转换返回的 blob key 为相对路径
      return (result.blobs || []).map(blob => ({
        ...blob,
        key: blob.key.startsWith(root)
          ? blob.key.slice(root.length)
          : blob.key
      }));
    } catch (err) {
      console.error(`Blob list error: ${fullPrefix}`, err);
      throw new Error('存储列表失败');
    }
  }
}

export const storageService = new StorageService();
