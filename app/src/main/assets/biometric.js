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
  function enrolled() { return available() && nativeBool('enrolled'); }
  function enroll(token) {
    if (!available() || !token || typeof token !== 'string') return false;
    try { native.enroll(token); return true; } catch (_) { return false; }
  }
  function unlock() {
    if (!enrolled()) return false;
    try { native.unlock(); return true; } catch (_) { return false; }
  }
  function clear() {
    if (!native || typeof native.clear !== 'function') return;
    try { native.clear(); } catch (_) {}
  }
  function rotateToken(token) {
    if (!enrolled() || !token || typeof token !== 'string') return;
    try { native.rotateToken(token); } catch (_) {}
  }
  window.KanonhaBiometric=Object.freeze({
    available,enrolled,enroll,unlock,clear,rotateToken,
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
