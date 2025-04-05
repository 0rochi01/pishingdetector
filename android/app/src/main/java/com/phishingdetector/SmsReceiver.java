package com.phishingdetector;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsReceiver";
    private static final String EVENT_SMS_RECEIVED = "sms_received";
    private static final ExecutorService executorService = Executors.newSingleThreadExecutor();
    private static ReactContext reactContext;

    public static void setReactContext(ReactContext context) {
        reactContext = context;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent.getAction().equals(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)) {
            executorService.execute(() -> {
                try {
                    Bundle bundle = intent.getExtras();
                    if (bundle != null) {
                        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                        processSmsMessages(messages);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao processar SMS recebido", e);
                }
            });
        }
    }

    private void processSmsMessages(SmsMessage[] messages) {
        if (messages == null || messages.length == 0 || reactContext == null) {
            return;
        }

        for (SmsMessage sms : messages) {
            String sender = sms.getOriginatingAddress();
            String body = sms.getMessageBody();
            long timestamp = sms.getTimestampMillis();

            // Criar objeto para enviar ao JavaScript
            WritableMap params = Arguments.createMap();
            params.putString("address", sender);
            params.putString("body", body);
            params.putDouble("date", timestamp);
            params.putString("type", "received");

            // Enviar evento para React Native
            sendEvent(reactContext, EVENT_SMS_RECEIVED, params);

            // Verificar phishing em background
            checkForPhishing(reactContext, body, sender);
        }
    }

    private static void sendEvent(ReactContext reactContext, String eventName, WritableMap params) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao enviar evento para React Native", e);
        }
    }

    private void checkForPhishing(ReactContext reactContext, String content, String sender) {
        if (reactContext == null) return;

        try {
            PhishingDetectionModule phishingModule = reactContext.getNativeModule(PhishingDetectionModule.class);
            if (phishingModule != null) {
                // Criar uma promise para receber o resultado
                phishingModule.detectPhishing(content, new com.facebook.react.bridge.Promise() {
                    @Override
                    public void resolve(Object value) {
                        try {
                            if (value instanceof WritableMap) {
                                WritableMap result = (WritableMap) value;
                                boolean isPhishing = result.getBoolean("isPhishing");
                                double confidence = result.getDouble("confidence");

                                if (isPhishing) {
                                    // Notificar o usuário sobre phishing
                                    sendPhishingAlert(reactContext, content, sender, confidence);
                                }
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Erro ao processar resultado de phishing", e);
                        }
                    }

                    @Override
                    public void reject(String code, String message) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code + " - " + message);
                    }

                    @Override
                    public void reject(String code, Throwable throwable) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code, throwable);
                    }

                    @Override
                    public void reject(String code, String message, Throwable throwable) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code + " - " + message, throwable);
                    }

                    @Override
                    public void reject(Throwable throwable) {
                        Log.e(TAG, "Erro na detecção de phishing", throwable);
                    }

                    @Override
                    public void reject(Throwable throwable, WritableMap userInfo) {
                        Log.e(TAG, "Erro na detecção de phishing", throwable);
                    }

                    @Override
                    public void reject(String code, WritableMap userInfo) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code);
                    }

                    @Override
                    public void reject(String code, Throwable throwable, WritableMap userInfo) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code, throwable);
                    }

                    @Override
                    public void reject(String code, String message, WritableMap userInfo) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code + " - " + message);
                    }

                    @Override
                    public void reject(String code, String message, Throwable throwable, WritableMap userInfo) {
                        Log.e(TAG, "Erro na detecção de phishing: " + code + " - " + message, throwable);
                    }
                });
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao verificar phishing", e);
        }
    }

    private void sendPhishingAlert(ReactContext reactContext, String content, String sender, double confidence) {
        try {
            WritableMap params = Arguments.createMap();
            params.putString("content", content);
            params.putString("sender", sender);
            params.putDouble("confidence", confidence);
            params.putString("source", "SMS_REALTIME");
            
            sendEvent(reactContext, "phishing_detected", params);
        } catch (Exception e) {
            Log.e(TAG, "Erro ao enviar alerta de phishing", e);
        }
    }
} 