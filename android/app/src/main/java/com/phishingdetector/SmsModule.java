package com.phishingdetector;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Context;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.ArrayList;
import java.util.List;

public class SmsModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
    private static final String TAG = "SmsModule";
    private final ReactApplicationContext reactContext;
    private SmsReceiver smsReceiver;
    private boolean receiverRegistered = false;

    public SmsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        reactContext.addLifecycleEventListener(this);
        
        // Inicializar e configurar o receptor de SMS
        smsReceiver = new SmsReceiver();
        SmsReceiver.setReactContext(reactContext);
    }

    @Override
    public String getName() {
        return "SmsModule";
    }

    @ReactMethod
    public void startRealTimeMonitoring(Promise promise) {
        try {
            // Verificar permissão
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECEIVE_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de recebimento de SMS não concedida");
                return;
            }

            // Registrar receptor se ainda não estiver registrado
            if (!receiverRegistered) {
                IntentFilter intentFilter = new IntentFilter();
                intentFilter.addAction(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
                reactContext.registerReceiver(smsReceiver, intentFilter);
                receiverRegistered = true;
            }

            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao iniciar monitoramento em tempo real", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopRealTimeMonitoring(Promise promise) {
        try {
            if (receiverRegistered) {
                reactContext.unregisterReceiver(smsReceiver);
                receiverRegistered = false;
            }
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao parar monitoramento em tempo real", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getRecentMessages(long since, int limit, Promise promise) {
        try {
            // Verificar permissão
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de SMS não concedida");
                return;
            }

            ContentResolver contentResolver = reactContext.getContentResolver();
            
            // Consultar SMS recebidos
            Uri inboxUri = Telephony.Sms.Inbox.CONTENT_URI;
            String[] inboxProjection = {
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.TYPE
            };
            String inboxSelection = Telephony.Sms.DATE + " > ? AND " + Telephony.Sms.TYPE + " = ?";
            String[] inboxSelectionArgs = {String.valueOf(since), String.valueOf(Telephony.Sms.MESSAGE_TYPE_INBOX)};
            String inboxSortOrder = Telephony.Sms.DATE + " DESC LIMIT " + limit;

            // Consultar SMS enviados
            Uri sentUri = Telephony.Sms.Sent.CONTENT_URI;
            String[] sentProjection = {
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.TYPE
            };
            String sentSelection = Telephony.Sms.DATE + " > ? AND " + Telephony.Sms.TYPE + " = ?";
            String[] sentSelectionArgs = {String.valueOf(since), String.valueOf(Telephony.Sms.MESSAGE_TYPE_SENT)};
            String sentSortOrder = Telephony.Sms.DATE + " DESC LIMIT " + limit;

            WritableArray messages = Arguments.createArray();

            // Processar SMS recebidos
            try (Cursor inboxCursor = contentResolver.query(inboxUri, inboxProjection, inboxSelection, inboxSelectionArgs, inboxSortOrder)) {
                if (inboxCursor != null) {
                    while (inboxCursor.moveToNext()) {
                        WritableMap message = Arguments.createMap();
                        message.putString("address", inboxCursor.getString(inboxCursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)));
                        message.putString("body", inboxCursor.getString(inboxCursor.getColumnIndexOrThrow(Telephony.Sms.BODY)));
                        message.putDouble("date", inboxCursor.getLong(inboxCursor.getColumnIndexOrThrow(Telephony.Sms.DATE)));
                        message.putString("type", "received");
                        messages.pushMap(message);
                    }
                }
            }

            // Processar SMS enviados
            try (Cursor sentCursor = contentResolver.query(sentUri, sentProjection, sentSelection, sentSelectionArgs, sentSortOrder)) {
                if (sentCursor != null) {
                    while (sentCursor.moveToNext()) {
                        WritableMap message = Arguments.createMap();
                        message.putString("address", sentCursor.getString(sentCursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)));
                        message.putString("body", sentCursor.getString(sentCursor.getColumnIndexOrThrow(Telephony.Sms.BODY)));
                        message.putDouble("date", sentCursor.getLong(sentCursor.getColumnIndexOrThrow(Telephony.Sms.DATE)));
                        message.putString("type", "sent");
                        messages.pushMap(message);
                    }
                }
            }

            promise.resolve(messages);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao obter mensagens SMS", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getUnreadMessages(Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de SMS não concedida");
                return;
            }

            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Telephony.Sms.Inbox.CONTENT_URI;
            String[] projection = {
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.READ
            };
            String selection = Telephony.Sms.READ + " = ?";
            String[] selectionArgs = {"0"};
            String sortOrder = Telephony.Sms.DATE + " DESC";

            try (Cursor cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)) {
                if (cursor == null) {
                    promise.reject("QUERY_FAILED", "Falha ao consultar SMS não lidos");
                    return;
                }

                WritableArray messages = Arguments.createArray();
                while (cursor.moveToNext()) {
                    WritableMap message = Arguments.createMap();
                    message.putString("address", cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)));
                    message.putString("body", cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)));
                    message.putDouble("date", cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)));
                    message.putString("type", "unread");
                    messages.pushMap(message);
                }
                promise.resolve(messages);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao obter mensagens SMS não lidas", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void markMessageAsRead(String messageId, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Permissão de SMS não concedida");
                return;
            }

            ContentResolver contentResolver = reactContext.getContentResolver();
            Uri uri = Uri.withAppendedPath(Telephony.Sms.CONTENT_URI, messageId);
            android.content.ContentValues values = new android.content.ContentValues();
            values.put(Telephony.Sms.READ, 1);
            
            int updated = contentResolver.update(uri, values, null, null);
            promise.resolve(updated > 0);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao marcar mensagem como lida", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Implementado para compatibilidade com o novo sistema de eventos do React Native
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // Implementado para compatibilidade com o novo sistema de eventos do React Native
    }

    @Override
    public void onHostResume() {
        // Reiniciar monitoramento quando o app voltar ao primeiro plano
        try {
            if (!receiverRegistered && ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECEIVE_SMS)
                    == PackageManager.PERMISSION_GRANTED) {
                IntentFilter intentFilter = new IntentFilter();
                intentFilter.addAction(Telephony.Sms.Intents.SMS_RECEIVED_ACTION);
                reactContext.registerReceiver(smsReceiver, intentFilter);
                receiverRegistered = true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao reiniciar monitoramento em tempo real", e);
        }
    }

    @Override
    public void onHostPause() {
        // Pode-se optar por manter o receptor registrado para monitoramento em segundo plano
    }

    @Override
    public void onHostDestroy() {
        // Desregistrar o receptor quando o host for destruído
        try {
            if (receiverRegistered) {
                reactContext.unregisterReceiver(smsReceiver);
                receiverRegistered = false;
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao desregistrar receptor", e);
        }
    }
} 