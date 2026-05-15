package com.hexon.beta;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * HEXON BETA — minimal WebView wrapper for the bundled HTML5 game.
 *
 * The whole game (HTML/CSS/JS) lives under assets/web/. We point the
 * WebView at file:///android_asset/web/index.html and let it run.
 *
 * Targets Android 5.0 (API 21) through Android 15 (API 35).
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/web/index.html";

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "ObsoleteSdkInt"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge dark background (matches the in-game theme).
        getWindow().setBackgroundDrawableResource(R.drawable.splash_bg);
        getWindow().setStatusBarColor(0xFF0B0F1A);
        getWindow().setNavigationBarColor(0xFF0B0F1A);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        configureWebView();

        /* Expose a tiny JS bridge so the in-game "Exit" button can
           actually close the application, and so coin-pack purchases
           can hand the URL off to the system Telegram app. The bridge
           is namespaced under window.AndroidHexon in JavaScript. */
        webView.addJavascriptInterface(new HexonBridge(this), "AndroidHexon");

        /* Ask for legacy WRITE_EXTERNAL_STORAGE on API 23..28 so the
           device ID file can be created in the public Documents/
           folder. API 29+ uses MediaStore which doesn't need any
           runtime permission, so the request is skipped entirely. */
        maybeRequestLegacyStoragePermission();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    private static final int REQ_LEGACY_STORAGE = 0x42;

    private void maybeRequestLegacyStoragePermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;   // <23: granted at install
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return;   // 29+: MediaStore, no perm
        String[] perms = {
                Manifest.permission.WRITE_EXTERNAL_STORAGE,
                Manifest.permission.READ_EXTERNAL_STORAGE,
        };
        boolean needs = false;
        for (String p : perms) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) { needs = true; break; }
        }
        if (needs) {
            try { requestPermissions(perms, REQ_LEGACY_STORAGE); }
            catch (Throwable ignored) { /* nothing useful to do here */ }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // Modern WebView (Chromium) already disallows cross-origin file
        // access by default; the legacy getters/setters were removed in
        // newer SDKs so we only call them on older devices.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            try {
                s.setAllowFileAccessFromFileURLs(false);
                s.setAllowUniversalAccessFromFileURLs(false);
            } catch (Throwable ignored) { /* no-op on stripped builds */ }
        }
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setBackgroundColor(0xFF0B0F1A);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(false);

        // Enable WebView contents debugging only in debug builds.
        if (BuildConfig.DEBUG && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                // Forwards JS console output to logcat under tag "HEXON".
                android.util.Log.d("HEXON", cm.message()
                        + " (line " + cm.lineNumber() + ")");
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternal(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view,
                                                    android.webkit.WebResourceRequest request) {
                if (request == null || request.getUrl() == null) return false;
                return handleExternal(request.getUrl().toString());
            }

            private boolean handleExternal(String url) {
                if (url == null) return false;
                if (url.startsWith("file://") || url.startsWith("about:")) {
                    return false;
                }
                if (url.startsWith("http://") || url.startsWith("https://")
                        || url.startsWith("mailto:") || url.startsWith("tel:")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(i);
                    } catch (Throwable ignored) { /* nothing to do */ }
                    return true;
                }
                return false;
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /**
     * Small JS bridge invoked from the WebView for OS-level actions.
     * Annotated with @JavascriptInterface so the methods are reachable
     * from JavaScript on API 17+.
     */
    public static final class HexonBridge {
        private final Activity host;
        HexonBridge(Activity activity) { this.host = activity; }

        /**
         * Returns the device ID stored in the public Documents folder
         * (i.e. outside the app sandbox), or empty string when none.
         * The file survives uninstall + reinstall of the .apk so the
         * player keeps their identity across reinstalls.
         */
        @JavascriptInterface
        public String readDeviceId() {
            if (host == null) return "";
            String id = HexonStorage.readDeviceId(host);
            return id != null ? id : "";
        }

        /**
         * Mirrors the device ID into the public Documents folder. The
         * JS side calls this every time loadDeviceId() runs so the
         * external copy stays in sync with localStorage.
         */
        @JavascriptInterface
        public void writeDeviceId(String id) {
            if (host == null) return;
            HexonStorage.writeDeviceId(host, id);
        }

        /**
         * Closes the application. We post to the main thread because
         * @JavascriptInterface callbacks come in on a binder thread
         * and finishAndRemoveTask() must run on the UI thread.
         */
        @JavascriptInterface
        public void exit() {
            if (host == null) return;
            host.runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            host.finishAndRemoveTask();
                        } else {
                            host.finish();
                        }
                    } catch (Throwable ignored) { host.finish(); }
                }
            });
        }

        /**
         * Hands a URL off to the system (e.g. open Telegram for the
         * coin-pack purchase flow). Falls back silently if no app can
         * handle the intent.
         */
        @JavascriptInterface
        public void openUrl(final String url) {
            if (host == null || url == null || url.isEmpty()) return;
            host.runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        host.startActivity(i);
                    } catch (Throwable ignored) { /* nothing to do */ }
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
