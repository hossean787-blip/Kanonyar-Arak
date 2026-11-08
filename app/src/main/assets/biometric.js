/* Native biometric bridge. Secrets never persist in WebView storage.
 * Native Android Keystore protection + system BiometricPrompt are mandatory.
 */
(() => {
  'use strict';
  const native = typeof window.AndroidBiometric !== 'undefined' ? window.AndroidBiometric : null;
  let onToken = null;
  let onStatus = null;
  const nativeBool = method => {
    if (!native || typeof native[method] !== 'function') return false;
    try { return native[method]() === true; } catch (_) { return false; }
  };
  function available() { return nativeBool('available'); }
  function present() { return Boolean(native); }
  function enrolled() { return available() && nativeBool('enrolled'); }
  function ownedBy(accountId) {
    if (!enrolled() || !accountId || typeof native.ownedBy !== 'function') return false;
    try { return native.ownedBy(accountId) === true; } catch (_) { return false; }
  }
  function enroll(token, accountId) {
    if (!available() || !token || typeof token !== 'string' ||
      !accountId || typeof accountId !== 'string') return false;
    try { native.enroll(token,accountId); return true; } catch (_) { return false; }
  }
  function unlock() {
    if (!enrolled()) return false;
    try { native.unlock(); return true; } catch (_) { return false; }
  }
  function clear() {
    if (!native || typeof native.clear !== 'function') return;
    try { native.clear(); } catch (_) {}
  }
  function lock() {
    if (!native || typeof native.lock !== 'function') return;
    try { native.lock(); } catch (_) {}
  }
  function rotateToken(token, accountId) {
    if (!enrolled() || !token || typeof token !== 'string' || !ownedBy(accountId)) return;
    try { native.rotateToken(token,accountId); } catch (_) {}
  }
  window.KanonhaBiometric=Object.freeze({
    available,present,enrolled,ownedBy,enroll,unlock,clear,lock,rotateToken,
    setHandlers(tokenHandler,statusHandler) {
      onToken=typeof tokenHandler==='function'?tokenHandler:null;
      onStatus=typeof statusHandler==='function'?statusHandler:null;
    },
    nativeToken(token) {
      if(typeof token==='string' && token.length>0 && token.length<=8192 && onToken)
        onToken(token);
    },
    nativeStatus(status) {
      if(typeof status==='string' && onStatus)onStatus(status);
    }
  });
  // Backend calls this only when a previously unlocked vault is in memory.
  window.KanonhaNativeBiometric=Object.freeze({rotateToken});
})();
