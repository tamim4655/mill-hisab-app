# Stable Android Debug Signing Setup

The CI workflow supports an optional stable signing key for debug APKs. Without all four secrets, GitHub Actions falls back to the runner's temporary Android debug key, so the APK certificate fingerprint changes between clean runners.

## 1. Create a keystore locally

Run this on a trusted computer. Keep the generated `mill-hisab-release.jks` private and keep a secure offline backup.

```bash
keytool -genkeypair -v -keystore mill-hisab-release.jks -alias millhisab -keyalg RSA -keysize 2048 -validity 10000
```

Use passwords you have not shared in chat. Do not commit or upload the keystore file to the repository.

## 2. Encode the keystore

Linux/macOS/Git Bash:

```bash
base64 -w 0 mill-hisab-release.jks
```

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("mill-hisab-release.jks"))
```

Copy the complete output privately. It is sensitive: anyone with the file and passwords can sign APKs as this app.

## 3. Add GitHub Actions repository secrets

Open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `ANDROID_KEYSTORE_BASE64`: complete Base64 output
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: `millhisab` (or the alias you selected)
- `ANDROID_KEY_PASSWORD`: key password

Never paste these values into an issue, pull request, chat, or source file.

## 4. Register the certificate in Firebase

After creating the keystore, get its SHA fingerprints:

```bash
keytool -list -v -keystore mill-hisab-release.jks -alias millhisab
```

In Firebase Console → Project settings → Your apps → Android app (`com.tamim.millhisab`), add the SHA-1 and SHA-256 fingerprints. Then download the updated `google-services.json` and replace `app/google-services.json` in the repository through a secure, trusted workflow.

## 5. Verify

Push a new commit to the feature branch and inspect the **Configure optional stable signing key** step. It should report that the stable key is configured. Download the resulting APK and verify its signer with:

```bash
keytool -printcert -jarfile app-debug.apk
```

The certificate SHA-1/SHA-256 should match the fingerprints registered in Firebase. Test Google Sign-In on a real device afterward.

**Important:** This workflow configures the debug APK signing identity. Before a public Play Store release, configure a separate production release signing process and protect its key independently.
