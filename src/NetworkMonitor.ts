// src/NetworkMonitor.ts
// Wraps navigator.onLine with event listeners for reactivity in a WebView context

export class NetworkMonitor {
  private static _instance: NetworkMonitor
  private _isOnline: boolean

  // Public so tests can instantiate directly; prefer NetworkMonitor.instance for production use.
  constructor() {
    this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this._isOnline = true })
      window.addEventListener('offline', () => { this._isOnline = false })
    }
  }

  static get instance(): NetworkMonitor {
    if (!NetworkMonitor._instance) {
      NetworkMonitor._instance = new NetworkMonitor()
    }
    return NetworkMonitor._instance
  }

  get isOnline(): boolean {
    return this._isOnline
  }

  // Allow test/env override
  setOnline(value: boolean): void {
    this._isOnline = value
  }
}
