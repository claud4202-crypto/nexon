package com.hexon.beta;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.regex.Pattern;

/**
 * Stores the player's device ID in the public Documents folder so it
 * survives an uninstall + reinstall of the game.
 *
 *  - API 29+ (Android 10+): uses MediaStore.Files in Documents/HexonBeta/
 *    — no runtime permission needed, and the file survives uninstall.
 *  - API 21..28: writes directly to
 *    /storage/emulated/0/Documents/HexonBeta/device_id.txt with
 *    legacy WRITE_EXTERNAL_STORAGE permission (declared in the
 *    manifest with maxSdkVersion=28).
 *
 * The device ID format mirrors the JS side
 * (storage.js: /^HX-[A-Z0-9]{5}-[A-Z0-9]{5}$/) so we never persist
 * garbage values.
 */
final class HexonStorage {

    /** Tag used for all logcat messages from this helper. */
    private static final String TAG = "HEXON-Storage";

    /** Folder name under public Documents/. */
    private static final String DIR_NAME = "HexonBeta";
    /** File name we keep the ID in. */
    private static final String FILE_NAME = "device_id.txt";
    /** MIME we tag the row with on Android 10+. */
    private static final String MIME = "text/plain";

    /** Same regex enforced by the JS side. */
    private static final Pattern ID_RE =
            Pattern.compile("^HX-[A-Z0-9]{5}-[A-Z0-9]{5}$");

    private HexonStorage() { /* utility class */ }

    static boolean isValidDeviceId(String id) {
        return id != null && ID_RE.matcher(id).matches();
    }

    /**
     * Read the device ID from the public Documents folder, if any.
     * Returns null when no valid ID is stored or access is denied.
     */
    static String readDeviceId(Context ctx) {
        if (ctx == null) return null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return readViaMediaStore(ctx);
            } else {
                return readViaLegacyFs(ctx);
            }
        } catch (Throwable t) {
            Log.w(TAG, "readDeviceId failed", t);
            return null;
        }
    }

    /**
     * Persist the device ID to the public Documents folder.
     * Silently no-ops on permission failure — the JS side keeps the
     * value in localStorage as a fallback for the rest of the install.
     */
    static void writeDeviceId(Context ctx, String id) {
        if (ctx == null || !isValidDeviceId(id)) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                writeViaMediaStore(ctx, id);
            } else {
                writeViaLegacyFs(ctx, id);
            }
        } catch (Throwable t) {
            Log.w(TAG, "writeDeviceId failed", t);
        }
    }

    /* ----------------------------------------------------------------
     * API 29+ : MediaStore.Files
     * Files end up at /storage/emulated/0/Documents/HexonBeta/device_id.txt.
     * No runtime permission needed for our own rows.
     * ---------------------------------------------------------------- */

    private static String readViaMediaStore(Context ctx) {
        ContentResolver cr = ctx.getContentResolver();
        Uri uri = locateRow(cr);
        if (uri == null) return null;
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) return null;
            String value = readAll(in).trim();
            return isValidDeviceId(value) ? value : null;
        } catch (IOException ioe) {
            Log.w(TAG, "readViaMediaStore failed", ioe);
            return null;
        }
    }

    private static void writeViaMediaStore(Context ctx, String id) {
        ContentResolver cr = ctx.getContentResolver();
        Uri uri = locateRow(cr);

        if (uri == null) {
            // Create a fresh row.
            ContentValues row = new ContentValues();
            row.put(MediaStore.MediaColumns.DISPLAY_NAME, FILE_NAME);
            row.put(MediaStore.MediaColumns.MIME_TYPE, MIME);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                row.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOCUMENTS + "/" + DIR_NAME);
            }
            uri = cr.insert(MediaStore.Files.getContentUri("external"), row);
            if (uri == null) {
                Log.w(TAG, "insert into MediaStore returned null URI");
                return;
            }
        }

        try (OutputStream out = cr.openOutputStream(uri, "wt")) {
            if (out == null) {
                Log.w(TAG, "openOutputStream returned null");
                return;
            }
            out.write(id.getBytes("UTF-8"));
            out.flush();
        } catch (IOException ioe) {
            Log.w(TAG, "writeViaMediaStore failed", ioe);
        }
    }

    private static Uri locateRow(ContentResolver cr) {
        // Query Files collection for our (folder, filename) pair.
        Uri collection = MediaStore.Files.getContentUri("external");
        String[] proj = { MediaStore.MediaColumns._ID };

        String selection;
        String[] args;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            selection = MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ? AND "
                    + MediaStore.MediaColumns.DISPLAY_NAME + "=?";
            args = new String[] {
                    Environment.DIRECTORY_DOCUMENTS + "/" + DIR_NAME + "/%",
                    FILE_NAME,
            };
        } else {
            // Should never run on <Q (callers route to legacy path), but
            // keep a sane fallback selection just in case.
            selection = MediaStore.MediaColumns.DISPLAY_NAME + "=?";
            args = new String[] { FILE_NAME };
        }

        try (Cursor c = cr.query(collection, proj, selection, args, null)) {
            if (c != null && c.moveToFirst()) {
                long id = c.getLong(0);
                return Uri.withAppendedPath(collection, String.valueOf(id));
            }
        } catch (Throwable t) {
            Log.w(TAG, "locateRow query failed", t);
        }
        return null;
    }

    /* ----------------------------------------------------------------
     * API 21..28 : legacy filesystem access.
     * Requires WRITE/READ_EXTERNAL_STORAGE permission which is
     * declared in the manifest with maxSdkVersion=28.
     * ---------------------------------------------------------------- */

    @SuppressWarnings("deprecation")
    private static File legacyFile() {
        File docs = Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOCUMENTS);
        return new File(new File(docs, DIR_NAME), FILE_NAME);
    }

    private static boolean haveLegacyPermission(Context ctx, String perm) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true; // pre-M is granted at install
        return ctx.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    private static String readViaLegacyFs(Context ctx) {
        if (!haveLegacyPermission(ctx, Manifest.permission.READ_EXTERNAL_STORAGE)) return null;
        File f = legacyFile();
        if (!f.isFile() || !f.canRead()) return null;
        try (FileInputStream in = new FileInputStream(f)) {
            String value = readAll(in).trim();
            return isValidDeviceId(value) ? value : null;
        } catch (IOException ioe) {
            Log.w(TAG, "readViaLegacyFs failed", ioe);
            return null;
        }
    }

    private static void writeViaLegacyFs(Context ctx, String id) {
        if (!haveLegacyPermission(ctx, Manifest.permission.WRITE_EXTERNAL_STORAGE)) return;
        File f = legacyFile();
        File parent = f.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            Log.w(TAG, "could not create parent dir " + parent);
            return;
        }
        try (FileOutputStream out = new FileOutputStream(f, /*append=*/false)) {
            out.write(id.getBytes("UTF-8"));
            out.flush();
        } catch (IOException ioe) {
            Log.w(TAG, "writeViaLegacyFs failed", ioe);
        }
    }

    /* ---------------------------------------------------------------- */

    private static String readAll(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder(64);
        try (BufferedReader br = new BufferedReader(new InputStreamReader(in, "UTF-8"))) {
            char[] buf = new char[128];
            int n;
            while ((n = br.read(buf)) != -1) sb.append(buf, 0, n);
        }
        return sb.toString();
    }
}
