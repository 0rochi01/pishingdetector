package com.phishingdetector;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Serviço que executa em segundo plano para monitorar e detectar phishing
 * em mensagens e comunicações.
 */
public class PhishingDetectionService extends Service {
    private static final String TAG = "PhishingDetectionService";
    private static final String CHANNEL_ID = "phishing_detection_channel";
    private static final int NOTIFICATION_ID = 1;
    private static final int WAKE_LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutos
    
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Serviço de detecção de phishing criado");
        
        // Criar canal de notificação (Android 8.0+)
        createNotificationChannel();
        
        // Iniciar serviço em primeiro plano com notificação
        startServiceInForeground();
        
        // Adquirir wake lock para garantir operação em segundo plano
        acquireWakeLock();
        
        // Solicitar ao usuário para desativar otimizações de bateria
        requestBatteryOptimizationExemption();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Serviço de detecção de phishing iniciado");
        
        // Se o serviço for morto pelo sistema, reiniciar
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Detecção de Phishing",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Serviço de detecção de phishing em segundo plano");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startServiceInForeground() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Proteção Ativa")
            .setContentText("Monitorando mensagens para detectar phishing")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();

        // Para Android 12 (API 31) ou superior, especificar o tipo de serviço
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } catch (Exception e) {
                // Fallback para versões mais antigas ou em caso de erro
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "PhishingDetector:DetectionWakeLock"
                );
                
                // Wake lock com timeout para evitar drenar bateria
                wakeLock.acquire(WAKE_LOCK_TIMEOUT);
                Log.d(TAG, "Wake lock adquirido");
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao adquirir wake lock", e);
        }
    }

    private void requestBatteryOptimizationExemption() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    boolean isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(
                        getPackageName()
                    );
                    
                    if (!isIgnoringBatteryOptimizations) {
                        Log.d(TAG, "Solicitando permissão para ignorar otimizações de bateria");
                        
                        // Nota: Isso irá funcionar apenas se o usuário tiver concedido a permissão
                        // REQUEST_IGNORE_BATTERY_OPTIMIZATIONS no AndroidManifest
                        Intent intent = new Intent();
                        intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao solicitar isenção de otimização de bateria", e);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Serviço de detecção de phishing destruído");
        
        // Liberar wake lock se estiver ativo
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "Wake lock liberado");
        }
        
        // Garantir que o serviço seja reiniciado se for encerrado
        Intent restartServiceIntent = new Intent(getApplicationContext(), PhishingDetectionService.class);
        startService(restartServiceIntent);
    }
} 