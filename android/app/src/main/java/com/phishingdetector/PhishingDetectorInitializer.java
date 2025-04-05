package com.phishingdetector;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.startup.Initializer;

import java.util.Collections;
import java.util.List;

/**
 * Inicializador que garante que o serviço de detecção de phishing
 * seja inicializado corretamente quando o aplicativo é iniciado.
 */
public class PhishingDetectorInitializer implements Initializer<Void> {
    private static final String TAG = "PhishingDetectorInit";

    @NonNull
    @Override
    public Void create(@NonNull Context context) {
        try {
            Log.d(TAG, "Inicializando serviço de detecção de phishing");
            
            // Iniciar o serviço em primeiro plano para Android 8.0 (API 26) ou superior
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(new Intent(context, PhishingDetectionService.class));
            } else {
                context.startService(new Intent(context, PhishingDetectionService.class));
            }
            
            // Registrar o receptor de SMS
            SmsReceiver.setReactContext(null); // Será atualizado quando o contexto React estiver disponível
            
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Erro ao inicializar serviço de detecção de phishing", e);
            return null;
        }
    }

    @NonNull
    @Override
    public List<Class<? extends Initializer<?>>> dependencies() {
        // Este inicializador não tem dependências
        return Collections.emptyList();
    }
} 