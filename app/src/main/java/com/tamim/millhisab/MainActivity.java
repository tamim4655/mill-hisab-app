package com.tamim.millhisab;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import java.util.Calendar;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
import androidx.biometric.BiometricPrompt;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.SetOptions;
import org.json.JSONObject;
import com.google.gson.Gson;
import java.util.HashMap;
import java.util.Map;
import androidx.biometric.BiometricManager;
import androidx.fragment.app.FragmentActivity;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends FragmentActivity {
    private WebView webView;
    private static final int RC_GOOGLE_SIGN_IN = 9101;
    private FirebaseAuth firebaseAuth;
    private FirebaseFirestore firestore;
    private GoogleSignInClient googleSignInClient;
    private static final int REQUEST_NOTIFICATIONS = 8102;
    private static final String CHANNEL_ID = "mill_hisab_due_reminders";
    private String pendingTitle;
    private String pendingMessage;

    private class AppBridge {
        @JavascriptInterface
        public void startGoogleSignIn() {
            runOnUiThread(() -> {
                if (googleSignInClient == null) {
                    if (webView != null) webView.evaluateJavascript("window.onCloudAuthResult && window.onCloudAuthResult(false,'Google Login প্রস্তুত নয়')", null);
                    return;
                }
                startActivityForResult(googleSignInClient.getSignInIntent(), RC_GOOGLE_SIGN_IN);
            });
        }

        @JavascriptInterface
        public void checkCloudAuth() {
            runOnUiThread(() -> {
                if (firebaseAuth != null && firebaseAuth.getCurrentUser() != null) {
                    String email = JSONObject.quote(firebaseAuth.getCurrentUser().getEmail() == null ? "" : firebaseAuth.getCurrentUser().getEmail());
                    webView.evaluateJavascript("window.onCloudAuthState && window.onCloudAuthState(true," + email + ")", null);
                } else if (webView != null) webView.evaluateJavascript("window.onCloudAuthState && window.onCloudAuthState(false,'')", null);
            });
        }

        @JavascriptInterface
        public void signOutCloud() {
            runOnUiThread(() -> {
                if (firebaseAuth != null) firebaseAuth.signOut();
                if (googleSignInClient != null) googleSignInClient.signOut();
                if (webView != null) webView.evaluateJavascript("window.onCloudAuthState && window.onCloudAuthState(false,'')", null);
            });
        }

        @JavascriptInterface
        public void uploadCloudData(String json) {
            if (firebaseAuth == null || firebaseAuth.getCurrentUser() == null || firestore == null || json == null || json.length() > 700000) {
                if (webView != null) runOnUiThread(() -> webView.evaluateJavascript("window.onCloudUploadResult && window.onCloudUploadResult(false,'লগইন নেই অথবা ডেটা ৭০০KB-এর বেশি')", null));
                return;
            }
            String uid = firebaseAuth.getCurrentUser().getUid();
            try {
                Map<String, Object> payload = new HashMap<>();
                Map<String, Object> data = new Gson().fromJson(json, Map.class);
                payload.put("data", data);
                payload.put("updatedAt", System.currentTimeMillis());
                firestore.collection("users").document(uid).collection("appData").document("main")
                    .set(payload, SetOptions.merge())
                    .addOnSuccessListener(v -> runOnUiThread(() -> webView.evaluateJavascript("window.onCloudUploadResult && window.onCloudUploadResult(true,'ক্লাউডে সেভ হয়েছে')", null)))
                    .addOnFailureListener(e -> runOnUiThread(() -> webView.evaluateJavascript("window.onCloudUploadResult && window.onCloudUploadResult(false," + JSONObject.quote(e.getMessage()) + ")", null)));
            } catch (Exception e) {
                if (webView != null) runOnUiThread(() -> webView.evaluateJavascript("window.onCloudUploadResult && window.onCloudUploadResult(false," + JSONObject.quote(e.getMessage()) + ")", null));
            }
        }

        @JavascriptInterface
        public void downloadCloudData() {
            if (firebaseAuth == null || firebaseAuth.getCurrentUser() == null || firestore == null) return;
            String uid = firebaseAuth.getCurrentUser().getUid();
            firestore.collection("users").document(uid).collection("appData").document("main").get()
                .addOnSuccessListener(doc -> {
                    String json = "null";
                    if (doc.exists() && doc.get("data") instanceof java.util.Map) {
                        json = JSONObject.quote(new Gson().toJson(doc.get("data")));
                    }
                    final String result = json;
                    runOnUiThread(() -> webView.evaluateJavascript("window.onCloudDataResult && window.onCloudDataResult(" + result + ")", null));
                })
                .addOnFailureListener(e -> runOnUiThread(() -> webView.evaluateJavascript("window.onCloudDataResult && window.onCloudDataResult(null)", null)));
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, title == null ? "মিল হিসাব" : title);
                send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                startActivity(Intent.createChooser(send, "শেয়ার করুন"));
            });
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> ensureNotificationPermission());
        }

        @JavascriptInterface
        public void showDueReminder(String title, String message) {
            runOnUiThread(() -> {
                pendingTitle = title;
                pendingMessage = message;
                ensureNotificationPermission();
                if (Build.VERSION.SDK_INT < 33 ||
                        checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED) {
                    postDueNotification(pendingTitle, pendingMessage);
                    pendingTitle = null;
                    pendingMessage = null;
                }
            });
        }

        @JavascriptInterface
        public void updateDueReminder(boolean hasDue, String message) {
            getSharedPreferences("mill_hisab_reminders", MODE_PRIVATE).edit()
                    .putBoolean("has_due", hasDue)
                    .putString("due_message", message == null ? "বকেয়া হিসাব দেখে নিন।" : message)
                    .apply();
        }

        @JavascriptInterface
        public void scheduleDailyReminder(int hour, int minute) {
            runOnUiThread(() -> scheduleReminder(hour, minute));
        }

        @JavascriptInterface
        public void cancelDailyReminder() {
            runOnUiThread(() -> cancelReminder());
        }

        @JavascriptInterface
        public synchronized void saveAutoBackup(String json) {
            if (json == null || json.length() == 0 || json.length() > 10 * 1024 * 1024) return;
            File dir = new File(getFilesDir(), "auto-backups");
            if (!dir.exists() && !dir.mkdirs()) return;
            String day = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            File target = new File(dir, "backup-" + day + ".json");
            File temp = new File(dir, target.getName() + ".tmp");
            try {
                FileOutputStream out = new FileOutputStream(temp);
                out.write(json.getBytes("UTF-8")); out.flush(); out.close();
                if (target.exists()) target.delete();
                if (!temp.renameTo(target)) {
                    FileOutputStream fallback = new FileOutputStream(target);
                    fallback.write(json.getBytes("UTF-8")); fallback.flush(); fallback.close(); temp.delete();
                }
                File[] backups = dir.listFiles((folder, name) -> name.startsWith("backup-") && name.endsWith(".json"));
                if (backups != null) {
                    Arrays.sort(backups, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
                    for (int i = 30; i < backups.length; i++) backups[i].delete();
                }
            } catch (Exception ignored) { temp.delete(); }
        }

        @JavascriptInterface
        public String getLatestAutoBackup() {
            File dir = new File(getFilesDir(), "auto-backups");
            File[] backups = dir.listFiles((folder, name) -> name.startsWith("backup-") && name.endsWith(".json"));
            if (backups == null || backups.length == 0) return "";
            Arrays.sort(backups, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            try {
                FileInputStream in = new FileInputStream(backups[0]);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192]; int count;
                while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                in.close(); return out.toString("UTF-8");
            } catch (Exception ignored) { return ""; }
        }

        @JavascriptInterface
        public String getAutoBackupInfo() {
            File dir = new File(getFilesDir(), "auto-backups");
            File[] backups = dir.listFiles((folder, name) -> name.startsWith("backup-") && name.endsWith(".json"));
            if (backups == null || backups.length == 0) return "";
            Arrays.sort(backups, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            return new SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault()).format(new Date(backups[0].lastModified()));
        }

        @JavascriptInterface
        public void authenticateBiometric() {
            runOnUiThread(() -> startBiometricPrompt());
        }
    }

    private class PrintBridge {
        @JavascriptInterface
        public void printPage(final String jobName) {
            runOnUiThread(() -> {
                if (webView == null) return;
                PrintManager printManager = (PrintManager) getSystemService(PRINT_SERVICE);
                if (printManager == null) return;
                String safeName = (jobName == null || jobName.trim().isEmpty()) ? "মিল হিসাব" : jobName;
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(safeName);
                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                printManager.print(safeName, adapter, attributes);
            });
        }
    }

    private void scheduleReminder(int hour, int minute) {
        SharedPreferences p = getSharedPreferences("mill_hisab_reminders", MODE_PRIVATE);
        p.edit().putBoolean("enabled", true).putInt("hour", Math.max(0, Math.min(23, hour)))
                .putInt("minute", Math.max(0, Math.min(59, minute))).apply();
        AlarmManager alarm = (AlarmManager) getSystemService(ALARM_SERVICE);
        Intent intent = new Intent(this, DueReminderReceiver.class).setAction(DueReminderReceiver.ACTION_DAILY_REMINDER);
        PendingIntent pending = PendingIntent.getBroadcast(this, 8103, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Calendar when = Calendar.getInstance();
        when.set(Calendar.HOUR_OF_DAY, Math.max(0, Math.min(23, hour)));
        when.set(Calendar.MINUTE, Math.max(0, Math.min(59, minute)));
        when.set(Calendar.SECOND, 0);
        when.set(Calendar.MILLISECOND, 0);
        if (when.getTimeInMillis() <= System.currentTimeMillis()) when.add(Calendar.DAY_OF_YEAR, 1);
        if (alarm != null) alarm.setInexactRepeating(AlarmManager.RTC_WAKEUP, when.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pending);
    }

    private void cancelReminder() {
        getSharedPreferences("mill_hisab_reminders", MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
        AlarmManager alarm = (AlarmManager) getSystemService(ALARM_SERVICE);
        Intent intent = new Intent(this, DueReminderReceiver.class).setAction(DueReminderReceiver.ACTION_DAILY_REMINDER);
        PendingIntent pending = PendingIntent.getBroadcast(this, 8103, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        if (alarm != null) alarm.cancel(pending);
        pending.cancel();
    }

    private void restoreReminderSchedule() {
        SharedPreferences p = getSharedPreferences("mill_hisab_reminders", MODE_PRIVATE);
        if (p.getBoolean("enabled", false)) scheduleReminder(p.getInt("hour", 20), p.getInt("minute", 0));
    }

    private void startBiometricPrompt() {
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                if (webView != null) webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(true)", null);
            }
            @Override
            public void onAuthenticationError(int errorCode, CharSequence errString) {
                if (webView != null) webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(false)", null);
            }
            @Override
            public void onAuthenticationFailed() {
                if (webView != null) webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(false)", null);
            }
        });
        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("মিল হিসাব নিরাপত্তা")
                .setSubtitle("ফিঙ্গারপ্রিন্ট বা ফোনের নিরাপত্তা যাচাই করুন");
        if (Build.VERSION.SDK_INT >= 30) {
            builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK |
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        } else {
            builder.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    .setNegativeButtonText("PIN দিয়ে খুলুন");
        }
        try {
            prompt.authenticate(builder.build());
        } catch (Exception e) {
            if (webView != null) webView.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(false)", null);
        }
    }

    private void ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQUEST_NOTIFICATIONS);
        } else {
            createNotificationChannel();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "বকেয়া মনে করিয়ে দেওয়া",
                    NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("মিল হিসাব অ্যাপের দৈনিক বকেয়া নোটিফিকেশন");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void postDueNotification(String title, String message) {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
        createNotificationChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title == null ? "মিল হিসাব" : title)
                .setContentText(message == null ? "বকেয়া হিসাব দেখুন" : message)
                .setContentIntent(pending).setAutoCancel(true);
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(8102, builder.build());
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS && grantResults.length > 0 &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            postDueNotification(pendingTitle, pendingMessage);
            pendingTitle = null;
            pendingMessage = null;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(true);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS |
                    WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(android.graphics.Color.rgb(0, 105, 55));
            getWindow().setNavigationBarColor(android.graphics.Color.rgb(0, 105, 55));
            getWindow().getDecorView().setSystemUiVisibility(0);
        }
        firebaseAuth = FirebaseAuth.getInstance();
        firestore = FirebaseFirestore.getInstance();
        GoogleSignInOptions signInOptions = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(getString(R.string.default_web_client_id))
                .requestEmail()
                .build();
        googleSignInClient = GoogleSignIn.getClient(this, signInOptions);
        webView = new WebView(this);
        webView.setBackgroundColor(0xFFFFFFFF);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setTextZoom(100);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.addJavascriptInterface(new PrintBridge(), "AndroidPrint");
        webView.addJavascriptInterface(new AppBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
        restoreReminderSchedule();
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_GOOGLE_SIGN_IN) {
            try {
                com.google.android.gms.auth.api.signin.GoogleSignInAccount account =
                        GoogleSignIn.getSignedInAccountFromIntent(data).getResult(ApiException.class);
                if (account != null && account.getIdToken() != null) {
                    firebaseAuth.signInWithCredential(GoogleAuthProvider.getCredential(account.getIdToken(), null))
                        .addOnSuccessListener(auth -> {
                            String email = auth.getUser() == null ? "" : auth.getUser().getEmail();
                            String safeEmail = JSONObject.quote(email == null ? "" : email);
                            runOnUiThread(() -> webView.evaluateJavascript("window.onCloudAuthResult && window.onCloudAuthResult(true," + safeEmail + ")", null));
                        })
                        .addOnFailureListener(e -> runOnUiThread(() -> webView.evaluateJavascript("window.onCloudAuthResult && window.onCloudAuthResult(false," + JSONObject.quote(e.getMessage()) + ")", null)));
                } else if (webView != null) webView.evaluateJavascript("window.onCloudAuthResult && window.onCloudAuthResult(false,'Google token পাওয়া যায়নি')", null);
            } catch (Exception e) {
                if (webView != null) webView.evaluateJavascript("window.onCloudAuthResult && window.onCloudAuthResult(false," + JSONObject.quote(e.getMessage()) + ")", null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}