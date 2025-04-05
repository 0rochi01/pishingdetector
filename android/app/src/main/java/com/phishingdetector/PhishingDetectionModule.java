package com.phishingdetector;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.URLUtil;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PhishingDetectionModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PhishingDetectionModule";
    private static final String PREF_NAME = "phishing_detector_prefs";
    private static final String CACHE_KEY = "phishing_detection_cache";
    private static final int CACHE_SIZE = 500;

    private final ReactApplicationContext reactContext;
    private final ExecutorService executorService;
    private final Map<String, DetectionResult> detectionCache;
    
    // Lista de palavras suspeitas em português
    private static final String[] SUSPICIOUS_WORDS = {
        "senha", "credenciais", "cartão", "crédito", "débito", "banco", "segurança", 
        "verificação", "confirmar", "urgente", "suspensão", "bloqueio", "fraude", 
        "clique", "link", "oferta", "prêmio", "ganhou", "grátis", "promoção", 
        "transferência", "pix", "boleto", "conta", "atualizar", "vencimento"
    };
    
    // Padrões de URLs maliciosos
    private static final String[] SUSPICIOUS_URL_PATTERNS = {
        ".tk", ".gq", ".ml", ".ga", ".cf", ".xyz", "bit.ly", "tinyurl", "goo.gl", 
        "shorturl", "clique", "acessar", "acesso", "login", "entrar", "senha"
    };
    
    // Padrões para extração de URLs
    private static final Pattern URL_PATTERN = 
        Pattern.compile("(https?://|www\\.)[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)");

    // Bancos de dados para consulta de domínios suspeitos
    private static final String[] PHISHING_DATABASES = {
        "https://api.x.ai/v1/messages",
        "https://api.phishtank.com/checkurl/",
        "https://safebrowsing.googleapis.com/v4/threatMatches:find"
    };

    // Configurações da API Grok
    private static final String GROK_API_KEY = "xai-9fOa8EaaRAld0KTZlKBmdsIZGUFymL9UAhal8n2eauwxJqwUykzlFOxbKFiMTeKp4sn2XO8JgtgziXA2";
    private static final String GROK_CHAT_URL = "https://api.x.ai/v1/messages";
    private static final String GROK_MODEL = "grok-2-latest";

    public static class DetectionResult {
        public boolean isPhishing;
        public double confidence;
        public Map<String, Object> details;
        public long timestamp;

        public DetectionResult(boolean isPhishing, double confidence, Map<String, Object> details) {
            this.isPhishing = isPhishing;
            this.confidence = confidence;
            this.details = details;
            this.timestamp = System.currentTimeMillis();
        }
    }

    public PhishingDetectionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.executorService = Executors.newFixedThreadPool(2);
        this.detectionCache = new HashMap<>();
        
        // Carregar cache
        loadCache();
    }

    @Override
    public String getName() {
        return "PhishingDetectionModule";
    }

    @ReactMethod
    public void detectPhishing(String content, Promise promise) {
        if (TextUtils.isEmpty(content)) {
            promise.reject("EMPTY_CONTENT", "Conteúdo vazio");
            return;
        }

        // Verificar cache primeiro
        String cacheKey = generateCacheKey(content);
        DetectionResult cachedResult = detectionCache.get(cacheKey);
        if (cachedResult != null) {
            // Verificar se o cache ainda é válido (24 horas)
            if ((System.currentTimeMillis() - cachedResult.timestamp) < 24 * 60 * 60 * 1000) {
                Log.d(TAG, "Usando resultado em cache para: " + cacheKey);
                promise.resolve(convertResultToMap(cachedResult));
                return;
            } else {
                // Remover resultado expirado
                detectionCache.remove(cacheKey);
            }
        }

        // Executar detecção em uma thread separada
        executorService.execute(() -> {
            try {
                DetectionResult result = analyzeContent(content);
                
                // Adicionar ao cache
                detectionCache.put(cacheKey, result);
                if (detectionCache.size() > CACHE_SIZE) {
                    // Remover entradas mais antigas se o cache ficar muito grande
                    pruneCache();
                }
                
                // Salvar cache
                saveCache();
                
                // Retornar resultado
                promise.resolve(convertResultToMap(result));
            } catch (Exception e) {
                Log.e(TAG, "Erro ao detectar phishing", e);
                promise.reject("DETECTION_ERROR", "Erro ao analisar conteúdo: " + e.getMessage());
            }
        });
    }

    @ReactMethod
    public void checkUrl(String url, Promise promise) {
        if (TextUtils.isEmpty(url)) {
            promise.reject("EMPTY_URL", "URL vazia");
            return;
        }

        executorService.execute(() -> {
            try {
                Map<String, Object> details = new HashMap<>();
                boolean isPhishing = false;
                double confidence = 0.0;
                
                // Normalizar URL
                if (!url.startsWith("http")) {
                    url = "http://" + url;
                }
                
                // Verificar se URL é válida
                if (!URLUtil.isValidUrl(url)) {
                    details.put("reason", "URL inválida");
                    isPhishing = true;
                    confidence = 0.95;
                } else {
                    // Verificar URL contra padrões suspeitos
                    for (String pattern : SUSPICIOUS_URL_PATTERNS) {
                        if (url.toLowerCase().contains(pattern)) {
                            confidence += 0.2;
                            details.put("suspiciousPattern", pattern);
                        }
                    }
                    
                    // Verificar URL em banco de dados externo
                    try {
                        JSONObject result = checkUrlInDatabase(url);
                        if (result.optBoolean("matches", false)) {
                            isPhishing = true;
                            confidence += 0.6;
                            details.put("databaseMatch", result.toString());
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Erro ao verificar URL em banco de dados", e);
                    }
                    
                    // Se a confiança for alta o suficiente, considerar phishing
                    if (confidence >= 0.7) {
                        isPhishing = true;
                    }
                }
                
                DetectionResult result = new DetectionResult(isPhishing, confidence, details);
                promise.resolve(convertResultToMap(result));
            } catch (Exception e) {
                Log.e(TAG, "Erro ao verificar URL", e);
                promise.reject("URL_CHECK_ERROR", "Erro ao verificar URL: " + e.getMessage());
            }
        });
    }

    @ReactMethod
    public void clearCache(Promise promise) {
        detectionCache.clear();
        saveCache();
        promise.resolve(true);
    }

    private DetectionResult analyzeContent(String content) {
        Map<String, Object> details = new HashMap<>();
        boolean isPhishing = false;
        double confidence = 0.0;
        
        // 1. Procurar por palavras suspeitas
        List<String> foundWords = new ArrayList<>();
        for (String word : SUSPICIOUS_WORDS) {
            if (content.toLowerCase().contains(word.toLowerCase())) {
                foundWords.add(word);
                confidence += 0.05; // Aumentar a confiança para cada palavra suspeita
            }
        }
        
        if (!foundWords.isEmpty()) {
            details.put("suspiciousWords", foundWords);
        }
        
        // 2. Extrair e verificar URLs no conteúdo
        List<String> suspiciousUrls = new ArrayList<>();
        Matcher matcher = URL_PATTERN.matcher(content);
        while (matcher.find()) {
            String url = matcher.group();
            boolean urlSuspicious = false;
            
            // Verificar URL contra padrões suspeitos
            for (String pattern : SUSPICIOUS_URL_PATTERNS) {
                if (url.toLowerCase().contains(pattern)) {
                    urlSuspicious = true;
                    confidence += 0.1; // Aumentar mais a confiança para URLs suspeitos
                    break;
                }
            }
            
            if (urlSuspicious) {
                suspiciousUrls.add(url);
            }
        }
        
        if (!suspiciousUrls.isEmpty()) {
            details.put("suspiciousUrls", suspiciousUrls);
        }
        
        // 3. Verificar padrões de solicitação de informações sensíveis
        if (containsSensitiveDataRequest(content)) {
            confidence += 0.25;
            details.put("requestsSensitiveData", true);
        }
        
        // 4. Urgência e pressão
        if (containsUrgencyPatterns(content)) {
            confidence += 0.15;
            details.put("createsUrgency", true);
        }
        
        // 5. Determinar se é phishing com base na confiança
        if (confidence >= 0.6) {
            isPhishing = true;
        }
        
        // Limitar confiança a 1.0 (100%)
        confidence = Math.min(confidence, 1.0);
        
        // Adicionar outros detalhes
        details.put("contentLength", content.length());
        details.put("analysisTimestamp", System.currentTimeMillis());
        
        return new DetectionResult(isPhishing, confidence, details);
    }

    private boolean containsSensitiveDataRequest(String content) {
        String contentLower = content.toLowerCase();
        return contentLower.contains("senha") || 
               contentLower.contains("código") || 
               contentLower.contains("login") || 
               contentLower.contains("cpf") || 
               contentLower.contains("cartão") || 
               contentLower.contains("atualizar dados") ||
               contentLower.contains("confirme seus dados") ||
               contentLower.contains("validar acesso");
    }

    private boolean containsUrgencyPatterns(String content) {
        String contentLower = content.toLowerCase();
        return contentLower.contains("urgente") || 
               contentLower.contains("imediato") || 
               contentLower.contains("limitado") || 
               contentLower.contains("bloqueado") || 
               contentLower.contains("suspenso") ||
               contentLower.contains("agora") ||
               contentLower.contains("última chance");
    }

    private JSONObject checkUrlInDatabase(String url) throws Exception {
        // Primeiro tentar verificar online com a API Grok
        JSONObject onlineResult = null;
        try {
            onlineResult = checkUrlWithGrokAPI(url);
            if (onlineResult != null && onlineResult.has("matches")) {
                return onlineResult;
            }
        } catch (Exception e) {
            Log.w(TAG, "Erro ao verificar URL com a API Grok, usando fallback offline", e);
        }
        
        // Se a verificação online falhar, usar o modo offline como fallback
        JSONObject response = new JSONObject();
        boolean matches = false;
        String matchType = "";
        
        // Lista de domínios maliciosos conhecidos
        String[] knownPhishingDomains = {
            "malware.testing.google.test",
            "bank-secure-login.tk",
            "account-verify.ml",
            "login-secure-server.ga",
            "banking-secure.cf",
            "security-check.xyz",
            "verification-account.gq"
        };
        
        // Extrair domínio da URL
        String domain = "";
        try {
            Uri uri = Uri.parse(url);
            domain = uri.getHost();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao extrair domínio da URL", e);
        }
        
        if (!TextUtils.isEmpty(domain)) {
            // Verificar em nossa lista local
            for (String phishingDomain : knownPhishingDomains) {
                if (domain.equals(phishingDomain) || domain.endsWith("." + phishingDomain)) {
                    matches = true;
                    matchType = "LOCAL_DATABASE";
                    break;
                }
            }
            
            // Verificar heurísticas adicionais
            if (!matches) {
                // Verificar número excessivo de subdomínios
                int dots = 0;
                for (char c : domain.toCharArray()) {
                    if (c == '.') dots++;
                }
                
                if (dots >= 4) {  // domínios com muitos níveis são suspeitos
                    matches = true;
                    matchType = "EXCESSIVE_SUBDOMAINS";
                }
                
                // Verificar domínios com números e traços (comum em phishing)
                int digits = 0;
                int hyphens = 0;
                for (char c : domain.toCharArray()) {
                    if (Character.isDigit(c)) digits++;
                    if (c == '-') hyphens++;
                }
                
                if (digits > 5 || (hyphens >= 2 && digits >= 3)) {
                    matches = true;
                    matchType = "SUSPICIOUS_DOMAIN_PATTERN";
                }
            }
        }
        
        // Construir resposta
        response.put("matches", matches);
        if (matches) {
            response.put("matchType", matchType);
            response.put("threatType", "SOCIAL_ENGINEERING");
        }
        
        return response;
    }
    
    private JSONObject checkUrlWithGrokAPI(String url) throws Exception {
        // Preparar mensagens para o modelo
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", GROK_MODEL);
        requestBody.put("stream", false);
        requestBody.put("max_tokens", 1000);
        requestBody.put("temperature", 0.7);
        
        // Mensagens no formato esperado pela API
        JSONArray messages = new JSONArray();
        
        // Mensagem do sistema
        JSONObject systemMessage = new JSONObject();
        systemMessage.put("role", "system");
        systemMessage.put("content", "Você é um analisador de segurança especializado em detectar URLs de phishing. " +
                          "Analise a URL fornecida e determine se é phishing ou não. Responda apenas com um JSON simples " +
                          "contendo {\"isPhishing\": true/false, \"confidence\": 0.0-1.0, \"reason\": \"explicação\"}");
        messages.put(systemMessage);
        
        // Mensagem do usuário
        JSONObject userMessage = new JSONObject();
        userMessage.put("role", "user");
        userMessage.put("content", "Analise esta URL para phishing: " + url);
        messages.put(userMessage);
        
        requestBody.put("messages", messages);
        
        // Configurar e fazer a requisição
        URL apiUrl = new URL(GROK_CHAT_URL);
        HttpURLConnection connection = (HttpURLConnection) apiUrl.openConnection();
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + GROK_API_KEY);
        connection.setDoOutput(true);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = requestBody.toString().getBytes("utf-8");
            os.write(input, 0, input.length);
        }
        
        int responseCode = connection.getResponseCode();
        if (responseCode >= 200 && responseCode < 300) {
            StringBuilder response = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), "utf-8"))) {
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }
            }
            
            JSONObject responseJson = new JSONObject(response.toString());
            
            // Extrair a resposta do modelo
            String assistantResponse = responseJson
                .getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content");
            
            // Tentar extrair o JSON da resposta do assistente
            try {
                return new JSONObject(assistantResponse);
            } catch (JSONException e) {
                Log.e(TAG, "Erro ao parsear resposta do assistente: " + assistantResponse, e);
                
                // Criar uma resposta padrão
                JSONObject standardResponse = new JSONObject();
                standardResponse.put("isPhishing", false);
                standardResponse.put("confidence", 0.5);
                standardResponse.put("reason", "Não foi possível determinar com certeza");
                return standardResponse;
            }
        } else {
            Log.w(TAG, "API Grok retornou código de erro: " + responseCode);
            
            // Em caso de erro, verificar o corpo da resposta
            StringBuilder errorResponse = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(connection.getErrorStream(), "utf-8"))) {
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    errorResponse.append(responseLine.trim());
                }
            }
            
            Log.e(TAG, "Erro da API Grok: " + errorResponse.toString());
            return null;
        }
    }

    @ReactMethod
    public void detectPhishingWithGrok(String content, Promise promise) {
        if (TextUtils.isEmpty(content)) {
            promise.reject("EMPTY_CONTENT", "Conteúdo vazio");
            return;
        }

        // Executar detecção em uma thread separada
        executorService.execute(() -> {
            try {
                // Construir requisição para a API Grok
                JSONObject requestBody = new JSONObject();
                requestBody.put("model", GROK_MODEL);
                requestBody.put("stream", false);
                requestBody.put("max_tokens", 1000);
                requestBody.put("temperature", 0.7);
                
                // Mensagens no formato esperado pela API
                JSONArray messages = new JSONArray();
                
                // Mensagem do sistema
                JSONObject systemMessage = new JSONObject();
                systemMessage.put("role", "system");
                systemMessage.put("content", "Você é um analisador de segurança especializado em detectar phishing e conteúdo malicioso. " +
                                  "Analise o texto fornecido e determine se contém phishing ou não. Responda apenas com um JSON simples " +
                                  "contendo {\"isPhishing\": true/false, \"confidence\": 0.0-1.0, \"reason\": \"explicação\", " + 
                                  "\"suspiciousWords\": [\"palavra1\", \"palavra2\"], \"suspiciousUrls\": [\"url1\", \"url2\"], " +
                                  "\"requestsSensitiveData\": true/false, \"createsUrgency\": true/false}");
                messages.put(systemMessage);
                
                // Mensagem do usuário
                JSONObject userMessage = new JSONObject();
                userMessage.put("role", "user");
                userMessage.put("content", "Analise este texto para phishing: \n\n" + content);
                messages.put(userMessage);
                
                requestBody.put("messages", messages);
                
                // Configurar e fazer a requisição
                URL apiUrl = new URL(GROK_CHAT_URL);
                HttpURLConnection connection = (HttpURLConnection) apiUrl.openConnection();
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Authorization", "Bearer " + GROK_API_KEY);
                connection.setDoOutput(true);
                connection.setConnectTimeout(8000);  // Timeout maior para análise de conteúdo
                connection.setReadTimeout(8000);
                
                try (OutputStream os = connection.getOutputStream()) {
                    byte[] input = requestBody.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                
                int responseCode = connection.getResponseCode();
                
                if (responseCode >= 200 && responseCode < 300) {
                    StringBuilder response = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(connection.getInputStream(), "utf-8"))) {
                        String responseLine;
                        while ((responseLine = br.readLine()) != null) {
                            response.append(responseLine.trim());
                        }
                    }
                    
                    JSONObject responseJson = new JSONObject(response.toString());
                    
                    // Extrair a resposta do modelo
                    String assistantResponse = responseJson
                        .getJSONArray("choices")
                        .getJSONObject(0)
                        .getJSONObject("message")
                        .getString("content");
                    
                    // Tentar extrair o JSON da resposta do assistente
                    try {
                        JSONObject analysisResult = new JSONObject(assistantResponse);
                        boolean isPhishing = analysisResult.optBoolean("isPhishing", false);
                        double confidence = analysisResult.optDouble("confidence", 0);
                        
                        // Criar detalhes da análise
                        Map<String, Object> details = new HashMap<>();
                        details.put("source", "GROK_API");
                        details.put("reason", analysisResult.optString("reason", ""));
                        
                        // Extrair palavras suspeitas
                        if (analysisResult.has("suspiciousWords")) {
                            JSONArray wordsArray = analysisResult.getJSONArray("suspiciousWords");
                            List<String> suspiciousWords = new ArrayList<>();
                            for (int i = 0; i < wordsArray.length(); i++) {
                                suspiciousWords.add(wordsArray.getString(i));
                            }
                            details.put("suspiciousWords", suspiciousWords);
                        }
                        
                        // Extrair URLs suspeitas
                        if (analysisResult.has("suspiciousUrls")) {
                            JSONArray urlsArray = analysisResult.getJSONArray("suspiciousUrls");
                            List<String> suspiciousUrls = new ArrayList<>();
                            for (int i = 0; i < urlsArray.length(); i++) {
                                suspiciousUrls.add(urlsArray.getString(i));
                            }
                            details.put("suspiciousUrls", suspiciousUrls);
                        }
                        
                        // Outros sinais relevantes
                        if (analysisResult.has("requestsSensitiveData")) {
                            details.put("requestsSensitiveData", analysisResult.getBoolean("requestsSensitiveData"));
                        }
                        
                        if (analysisResult.has("createsUrgency")) {
                            details.put("createsUrgency", analysisResult.getBoolean("createsUrgency"));
                        }
                        
                        // Criar resultado
                        DetectionResult result = new DetectionResult(isPhishing, confidence, details);
                        promise.resolve(convertResultToMap(result));
                    } catch (JSONException e) {
                        Log.e(TAG, "Erro ao parsear resposta do assistente: " + assistantResponse, e);
                        
                        // Se falhar a análise da resposta, usar análise local
                        DetectionResult result = analyzeContent(content);
                        promise.resolve(convertResultToMap(result));
                    }
                } else {
                    // Se a API falhar, usar análise local
                    Log.w(TAG, "API Grok retornou código de erro: " + responseCode + ", usando análise local");
                    
                    // Em caso de erro, verificar o corpo da resposta
                    StringBuilder errorResponse = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(connection.getErrorStream(), "utf-8"))) {
                        String responseLine;
                        while ((responseLine = br.readLine()) != null) {
                            errorResponse.append(responseLine.trim());
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Erro ao ler resposta de erro", e);
                    }
                    
                    Log.e(TAG, "Erro da API Grok: " + errorResponse.toString());
                    
                    DetectionResult result = analyzeContent(content);
                    promise.resolve(convertResultToMap(result));
                }
            } catch (Exception e) {
                Log.e(TAG, "Erro ao usar API Grok, usando análise local", e);
                try {
                    DetectionResult result = analyzeContent(content);
                    promise.resolve(convertResultToMap(result));
                } catch (Exception e2) {
                    promise.reject("DETECTION_ERROR", "Erro na análise: " + e2.getMessage());
                }
            }
        });
    }

    private String generateCacheKey(String content) {
        // Gerar uma chave simplificada, usando apenas os primeiros caracteres
        int maxLength = Math.min(content.length(), 100);
        String key = content.substring(0, maxLength).trim();
        return key.hashCode() + "";
    }

    private void pruneCache() {
        // Manter apenas as entradas mais recentes
        if (detectionCache.size() <= CACHE_SIZE) {
            return;
        }
        
        // Ordenar por timestamp e remover as mais antigas
        List<Map.Entry<String, DetectionResult>> entries = new ArrayList<>(detectionCache.entrySet());
        entries.sort((a, b) -> Long.compare(a.getValue().timestamp, b.getValue().timestamp));
        
        // Remover as mais antigas
        int toRemove = entries.size() - CACHE_SIZE;
        for (int i = 0; i < toRemove; i++) {
            detectionCache.remove(entries.get(i).getKey());
        }
    }

    private WritableMap convertResultToMap(DetectionResult result) {
        WritableMap map = Arguments.createMap();
        map.putBoolean("isPhishing", result.isPhishing);
        map.putDouble("confidence", result.confidence);
        
        WritableMap details = Arguments.createMap();
        for (Map.Entry<String, Object> entry : result.details.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            if (value instanceof String) {
                details.putString(key, (String) value);
            } else if (value instanceof Integer) {
                details.putInt(key, (Integer) value);
            } else if (value instanceof Double) {
                details.putDouble(key, (Double) value);
            } else if (value instanceof Boolean) {
                details.putBoolean(key, (Boolean) value);
            } else if (value instanceof List) {
                // Converter lista para array
                List<?> list = (List<?>) value;
                if (!list.isEmpty()) {
                    if (list.get(0) instanceof String) {
                        details.putArray(key, convertStringListToArray((List<String>) list));
                    }
                }
            }
        }
        
        map.putMap("details", details);
        return map;
    }

    private WritableMap convertDetailsToMap(Map<String, Object> details) {
        WritableMap map = Arguments.createMap();
        for (Map.Entry<String, Object> entry : details.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            if (value instanceof String) {
                map.putString(key, (String) value);
            } else if (value instanceof Integer) {
                map.putInt(key, (Integer) value);
            } else if (value instanceof Double) {
                map.putDouble(key, (Double) value);
            } else if (value instanceof Boolean) {
                map.putBoolean(key, (Boolean) value);
            } else if (value instanceof List) {
                // Converter lista para array
                List<?> list = (List<?>) value;
                if (!list.isEmpty()) {
                    if (list.get(0) instanceof String) {
                        map.putArray(key, convertStringListToArray((List<String>) list));
                    }
                }
            }
        }
        
        return map;
    }

    private void saveCache() {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            
            // Converter cache para JSON
            JSONObject cacheJson = new JSONObject();
            for (Map.Entry<String, DetectionResult> entry : detectionCache.entrySet()) {
                JSONObject resultJson = new JSONObject();
                resultJson.put("isPhishing", entry.getValue().isPhishing);
                resultJson.put("confidence", entry.getValue().confidence);
                resultJson.put("timestamp", entry.getValue().timestamp);
                
                // Converter details
                JSONObject detailsJson = new JSONObject();
                for (Map.Entry<String, Object> detail : entry.getValue().details.entrySet()) {
                    Object value = detail.getValue();
                    if (value instanceof List) {
                        JSONArray array = new JSONArray();
                        for (Object item : (List<?>) value) {
                            array.put(item.toString());
                        }
                        detailsJson.put(detail.getKey(), array);
                    } else {
                        detailsJson.put(detail.getKey(), value);
                    }
                }
                
                resultJson.put("details", detailsJson);
                cacheJson.put(entry.getKey(), resultJson);
            }
            
            editor.putString(CACHE_KEY, cacheJson.toString());
            editor.apply();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao salvar cache", e);
        }
    }

    private void loadCache() {
        try {
            SharedPreferences prefs = reactContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String cacheString = prefs.getString(CACHE_KEY, "");
            
            if (!TextUtils.isEmpty(cacheString)) {
                JSONObject cacheJson = new JSONObject(cacheString);
                
                // Iterar chaves
                for (String key : cacheJson.keySet()) {
                    JSONObject resultJson = cacheJson.getJSONObject(key);
                    boolean isPhishing = resultJson.getBoolean("isPhishing");
                    double confidence = resultJson.getDouble("confidence");
                    long timestamp = resultJson.getLong("timestamp");
                    
                    // Converter details
                    Map<String, Object> details = new HashMap<>();
                    JSONObject detailsJson = resultJson.getJSONObject("details");
                    for (String detailKey : detailsJson.keySet()) {
                        Object value = detailsJson.get(detailKey);
                        if (value instanceof JSONArray) {
                            List<String> list = new ArrayList<>();
                            JSONArray array = (JSONArray) value;
                            for (int i = 0; i < array.length(); i++) {
                                list.add(array.getString(i));
                            }
                            details.put(detailKey, list);
                        } else {
                            details.put(detailKey, value);
                        }
                    }
                    
                    // Criar resultado e adicionar ao cache
                    DetectionResult result = new DetectionResult(isPhishing, confidence, details);
                    result.timestamp = timestamp;
                    detectionCache.put(key, result);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao carregar cache", e);
        }
    }

    private WritableArray convertStringListToArray(List<String> list) {
        WritableArray array = Arguments.createArray();
        for (String item : list) {
            array.pushString(item);
        }
        return array;
    }
} 