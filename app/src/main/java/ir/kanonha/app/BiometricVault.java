package ir.kanonha.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Explicit opt-in biometric vault. Refresh tokens are encrypted at rest with a
 * random per-installation AES-256 data key, itself wrapped by an Android Keystore
 * AES key requiring a BIOMETRIC_STRONG CryptoObject on every cold unlock.
 *
 * No password, token or key is ever put into JavaScript localStorage or backups.
 * Token rotation is possible within the authenticated, in-memory session.
 */
final class BiometricVault {
    private static final String KEY_ALIAS = "kanonha.biometric.v1";
    private static final String PREFS = "kanonha.biometric.v1.prefs";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private final FragmentActivity activity;
    private final WebView web;
    private final SharedPreferences prefs;
    private volatile SecretKeySpec unlockedKey;

    BiometricVault(FragmentActivity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        this.prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean correctOrigin() {
        String url = web.getUrl();
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "https".equals(uri.getScheme())
            && "appassets.androidplatform.net".equals(uri.getHost())
            && "/assets/index.html".equals(uri.getPath());
    }

    private boolean available() {
        try {
            return BiometricManager.from(activity).canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
            ) == BiometricManager.BIOMETRIC_SUCCESS;
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean enrolled() {
        return prefs.contains("wrapped") && prefs.contains("wrapped_iv")
            && prefs.contains("refresh") && prefs.contains("refresh_iv");
    }

    private static String encode(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
    }

    private static byte[] decode(String value) {
        return Base64.decode(value, Base64.DEFAULT);
    }

    private void send(String method, String value) {
        if (!correctOrigin()) return;
        web.evaluateJavascript("window.KanonhaBiometric&&window.KanonhaBiometric."
            +method+"("+JSONObject.quote(value)+");", null);
    }

    private void status(String value) {
        send("nativeStatus", value);
    }

    private SecretKey getKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
        }
        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationValidityDurationSeconds(-1)
            .setInvalidatedByBiometricEnrollment(true)
            .build();
        generator.init(spec);
        return generator.generateKey();
    }

    private BiometricPrompt prompt(String title, Cipher cipher,
                                    java.util.function.Consumer<Cipher> onSuccess) {
        BiometricPrompt biometric = new BiometricPrompt(activity,
            ContextCompat.getMainExecutor(activity), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(
                    @NonNull BiometricPrompt.AuthenticationResult result) {
                Cipher authorized = result.getCryptoObject() == null
                    ? null : result.getCryptoObject().getCipher();
                if (authorized == null) { status("error"); return; }
                try { onSuccess.accept(authorized); }
                catch (Exception ex) { status("error"); }
            }
            @Override public void onAuthenticationError(int errorCode,
                                                          @NonNull CharSequence errorString) {
                status("cancelled");
            }
            @Override public void onAuthenticationFailed() {
                status("retry");
            }
        });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle("احراز هویت امن برای اپ کانون‌ها")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setNegativeButtonText("ورود با رمز عبور")
            .build();
        biometric.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
        return biometric;
    }

    private void storeRefresh(SecretKeySpec key, String token) throws Exception {
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] bytes = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        if (!prefs.edit().putString("refresh", encode(bytes))
            .putString("refresh_iv", encode(cipher.getIV())).commit()) {
            throw new IllegalStateException("Could not save encrypted refresh token");
        }
    }

    private void beginEnroll(String token) {
        if (!correctOrigin() || !available()) { status("unavailable"); return; }
        try {
            final byte[] randomKey = new byte[32];
            new SecureRandom().nextBytes(randomKey);
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.ENCRYPT_MODE, getKey());
            prompt("فعال‌سازی ورود با اثر انگشت", cipher, authorized -> {
                try {
                    byte[] wrapped = authorized.doFinal(randomKey);
                    SecretKeySpec secret = new SecretKeySpec(randomKey, "AES");
                    Cipher tokenCipher = Cipher.getInstance(CIPHER);
                    tokenCipher.init(Cipher.ENCRYPT_MODE, secret);
                    byte[] encryptedToken = tokenCipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
                    // One atomic commit avoids a half-updated credential envelope on crash.
                    if (!prefs.edit().putString("wrapped", encode(wrapped))
                        .putString("wrapped_iv", encode(authorized.getIV()))
                        .putString("refresh", encode(encryptedToken))
                        .putString("refresh_iv", encode(tokenCipher.getIV())).commit())
                        throw new IllegalStateException("Could not save encrypted credential");
                    unlockedKey = secret;
                    java.util.Arrays.fill(randomKey, (byte)0);
                    status("enabled");
                } catch (Exception ex) {
                    java.util.Arrays.fill(randomKey, (byte)0);
                    status("error");
                }
            });
        } catch (Exception ex) {
            status("unavailable");
        }
    }

    private void beginUnlock() {
        if (!correctOrigin() || !available() || !enrolled()) { status("unavailable"); return; }
        try {
            Cipher cipher = Cipher.getInstance(CIPHER);
            cipher.init(Cipher.DECRYPT_MODE, getKey(),
                new GCMParameterSpec(128, decode(prefs.getString("wrapped_iv",""))));
            prompt("ورود با اثر انگشت", cipher, authorized -> {
                try {
                    byte[] randomKey = authorized.doFinal(
                        decode(prefs.getString("wrapped","")));
                    SecretKeySpec key = new SecretKeySpec(randomKey, "AES");
                    java.util.Arrays.fill(randomKey, (byte)0);
                    Cipher tokenCipher = Cipher.getInstance(CIPHER);
                    tokenCipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,
                        decode(prefs.getString("refresh_iv",""))));
                    String token = new String(tokenCipher.doFinal(
                        decode(prefs.getString("refresh",""))),StandardCharsets.UTF_8);
                    unlockedKey = key;
                    // The caller refreshes with Supabase and updates our encrypted token.
                    send("nativeToken", token);
                } catch (Exception ex) {
                    unlockedKey = null;
                    status("invalidated");
                }
            });
        } catch (Exception ex) {
            unlockedKey = null;
            status("invalidated");
        }
    }

    private void rotate(String token) {
        if (!correctOrigin() || !enrolled()) return;
        SecretKeySpec key = unlockedKey;
        if (key == null || token == null || token.length() < 8 || token.length() > 8192) return;
        try { storeRefresh(key, token); }
        catch (Exception ex) { status("error"); }
    }

    private void clearVault() {
        unlockedKey = null;
        prefs.edit().clear().commit();
        try {
            KeyStore ks=KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {}
        status("cleared");
    }

    void destroy() { unlockedKey = null; }

    final class Bridge {
        @JavascriptInterface public boolean available() { return BiometricVault.this.available(); }
        @JavascriptInterface public boolean enrolled() { return BiometricVault.this.enrolled(); }
        @JavascriptInterface public void enroll(String token) {
            if (token == null || token.length() < 8 || token.length() > 8192) return;
            activity.runOnUiThread(() -> beginEnroll(token));
        }
        @JavascriptInterface public void unlock() {
            activity.runOnUiThread(() -> beginUnlock());
        }
        @JavascriptInterface public void rotateToken(String token) {
            activity.runOnUiThread(() -> rotate(token));
        }
        @JavascriptInterface public void clear() {
            activity.runOnUiThread(() -> { if (correctOrigin()) clearVault(); });
        }
    }
}
