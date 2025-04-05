package com.phishingdetector;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.ArrayList;
import java.util.List;

public class EmailModule extends ReactContextBaseJavaModule {
    private static final String TAG = "EmailModule";
    private final ReactApplicationContext reactContext;

    public EmailModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "EmailModule";
    }

    @ReactMethod
    public void getRecentEmails(long since, int limit, Promise promise) {
        try {
            // Verificar permissão
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de armazenamento não concedida");
                return;
            }

            ContentResolver contentResolver = reactContext.getContentResolver();
            
            // Consultar emails recebidos
            Uri inboxUri = Uri.parse("content://com.android.email.provider/message");
            String[] inboxProjection = {
                    "_id",
                    "subject",
                    "body",
                    "fromAddress",
                    "toAddresses",
                    "ccAddresses",
                    "bccAddresses",
                    "dateReceived",
                    "read",
                    "attachments"
            };
            String inboxSelection = "dateReceived > ? AND folderType = ?";
            String[] inboxSelectionArgs = {String.valueOf(since), "1"}; // 1 = Inbox
            String inboxSortOrder = "dateReceived DESC LIMIT " + limit;

            // Consultar emails enviados
            Uri sentUri = Uri.parse("content://com.android.email.provider/message");
            String[] sentProjection = {
                    "_id",
                    "subject",
                    "body",
                    "fromAddress",
                    "toAddresses",
                    "ccAddresses",
                    "bccAddresses",
                    "dateSent",
                    "read",
                    "attachments"
            };
            String sentSelection = "dateSent > ? AND folderType = ?";
            String[] sentSelectionArgs = {String.valueOf(since), "2"}; // 2 = Sent
            String sentSortOrder = "dateSent DESC LIMIT " + limit;

            WritableArray emails = Arguments.createArray();

            // Processar emails recebidos
            try (Cursor inboxCursor = contentResolver.query(inboxUri, inboxProjection, inboxSelection, inboxSelectionArgs, inboxSortOrder)) {
                if (inboxCursor != null) {
                    while (inboxCursor.moveToNext()) {
                        WritableMap email = createEmailMap(inboxCursor, "received");
                        emails.pushMap(email);
                    }
                }
            }

            // Processar emails enviados
            try (Cursor sentCursor = contentResolver.query(sentUri, sentProjection, sentSelection, sentSelectionArgs, sentSortOrder)) {
                if (sentCursor != null) {
                    while (sentCursor.moveToNext()) {
                        WritableMap email = createEmailMap(sentCursor, "sent");
                        emails.pushMap(email);
                    }
                }
            }

            promise.resolve(emails);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao obter emails", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    private WritableMap createEmailMap(Cursor cursor, String type) {
        WritableMap email = Arguments.createMap();
        
        // Informações básicas
        email.putString("subject", cursor.getString(cursor.getColumnIndexOrThrow("subject")));
        email.putString("body", cursor.getString(cursor.getColumnIndexOrThrow("body")));
        email.putString("sender", cursor.getString(cursor.getColumnIndexOrThrow("fromAddress")));
        email.putBoolean("read", cursor.getInt(cursor.getColumnIndexOrThrow("read")) == 1);
        email.putString("type", type);
        
        // Data
        if (type.equals("received")) {
            email.putDouble("date", cursor.getLong(cursor.getColumnIndexOrThrow("dateReceived")));
        } else {
            email.putDouble("date", cursor.getLong(cursor.getColumnIndexOrThrow("dateSent")));
        }
        
        // Destinatários
        WritableArray recipients = Arguments.createArray();
        String toAddresses = cursor.getString(cursor.getColumnIndexOrThrow("toAddresses"));
        if (toAddresses != null) {
            String[] addresses = toAddresses.split(",");
            for (String address : addresses) {
                recipients.pushString(address.trim());
            }
        }
        email.putArray("recipients", recipients);
        
        // CC
        WritableArray ccRecipients = Arguments.createArray();
        String ccAddresses = cursor.getString(cursor.getColumnIndexOrThrow("ccAddresses"));
        if (ccAddresses != null) {
            String[] addresses = ccAddresses.split(",");
            for (String address : addresses) {
                ccRecipients.pushString(address.trim());
            }
        }
        email.putArray("cc", ccRecipients);
        
        // BCC
        WritableArray bccRecipients = Arguments.createArray();
        String bccAddresses = cursor.getString(cursor.getColumnIndexOrThrow("bccAddresses"));
        if (bccAddresses != null) {
            String[] addresses = bccAddresses.split(",");
            for (String address : addresses) {
                bccRecipients.pushString(address.trim());
            }
        }
        email.putArray("bcc", bccRecipients);
        
        // Anexos
        WritableArray attachments = Arguments.createArray();
        String attachmentString = cursor.getString(cursor.getColumnIndexOrThrow("attachments"));
        if (attachmentString != null) {
            String[] files = attachmentString.split(",");
            for (String file : files) {
                attachments.pushString(file.trim());
            }
        }
        email.putArray("attachments", attachments);
        
        return email;
    }

    @ReactMethod
    public void getUnreadEmails(Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de armazenamento não concedida");
                return;
            }

            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Uri.parse("content://com.android.email.provider/message");
            String[] projection = {
                    "_id",
                    "subject",
                    "body",
                    "fromAddress",
                    "toAddresses",
                    "dateReceived",
                    "read",
                    "attachments"
            };
            String selection = "read = ? AND folderType = ?";
            String[] selectionArgs = {"0", "1"}; // 0 = não lido, 1 = Inbox
            String sortOrder = "dateReceived DESC";

            try (Cursor cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)) {
                if (cursor == null) {
                    promise.reject("QUERY_FAILED", "Falha ao consultar emails não lidos");
                    return;
                }

                WritableArray emails = Arguments.createArray();
                while (cursor.moveToNext()) {
                    WritableMap email = createEmailMap(cursor, "unread");
                    emails.pushMap(email);
                }
                promise.resolve(emails);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao obter emails não lidos", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void markEmailAsRead(String emailId, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de armazenamento não concedida");
                return;
            }

            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Uri.withAppendedPath(Uri.parse("content://com.android.email.provider/message"), emailId);
            android.content.ContentValues values = new android.content.ContentValues();
            values.put("read", 1);
            
            int updated = contentResolver.update(uri, values, null, null);
            promise.resolve(updated > 0);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao marcar email como lido", e);
            promise.reject("ERROR", e.getMessage());
        }
    }
} 