/**
 * Plugin Registry — Allows third-party detectors to be registered at runtime.
 *
 * USAGE (from any backend integrating this system):
 *
 *   const { pluginRegistry } = require('./core/pluginRegistry');
 *
 *   pluginRegistry.register({
 *     name: 'my-custom-detector',
 *     version: '1.0.0',
 *     detect(activity, profile) {
 *       // Return array of anomaly signals (or empty array)
 *       if (someCondition) {
 *         return [{ type: 'custom_threat', severity: 'high', description: '...', metadata: {}, anomalyScore: 0.9 }];
 *       }
 *       return [];
 *     }
 *   });
 *
 * Built-in plugins are loaded automatically. Custom plugins can be added
 * by placing files in the `plugins/` directory following the same interface.
 */

const fs = require('fs');
const path = require('path');

class PluginRegistry {
  constructor() {
    this._plugins = new Map();
    this._hooks = {
      beforeAnalyze: [],
      afterAnalyze: [],
      onBlock: [],
      onAllow: [],
    };
  }

  /**
   * Register a detector plugin.
   * @param {object} plugin - Must have name, version, and detect(activity, profile) => Signal[]
   */
  register(plugin) {
    if (!plugin?.name) throw new Error('Plugin must have a name');
    if (typeof plugin?.detect !== 'function') throw new Error('Plugin must export a detect(activity, profile) function');
    this._plugins.set(plugin.name, plugin);
    console.log(`[PluginRegistry] Registered plugin: ${plugin.name} v${plugin.version || '?'}`);
    return this;
  }

  unregister(name) {
    this._plugins.delete(name);
    return this;
  }

  /** Register a lifecycle hook */
  on(event, fn) {
    if (!this._hooks[event]) this._hooks[event] = [];
    this._hooks[event].push(fn);
    return this;
  }

  async emit(event, ...args) {
    for (const fn of (this._hooks[event] || [])) {
      try { await fn(...args); } catch (_) { }
    }
  }

  /** Return all active plugin detector functions */
  getDetectors() {
    return [...this._plugins.values()];
  }

  /** Load all plugins from a directory */
  loadDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const plugin = require(path.join(dir, file));
        if (plugin?.name && typeof plugin?.detect === 'function') {
          this.register(plugin);
        }
      } catch (e) {
        console.warn(`[PluginRegistry] Failed to load plugin ${file}:`, e.message);
      }
    }
  }

  list() {
    return [...this._plugins.values()].map(p => ({
      name: p.name,
      version: p.version || '?',
      description: p.description || '',
    }));
  }
}

const pluginRegistry = new PluginRegistry();

// Auto-load built-in plugins from plugins/ directory
pluginRegistry.loadDirectory(path.join(__dirname, '..', 'plugins'));

module.exports = { pluginRegistry, PluginRegistry };
