# Detector de Phishing com Assistente de Segurança

Este aplicativo oferece proteção contra phishing e fraudes online utilizando tecnologia avançada de detecção e um assistente de segurança alimentado por IA.

## Principais Funcionalidades

### 1. Detecção de Phishing
- Análise avançada de mensagens e URLs para identificar tentativas de phishing
- Verificação offline e online usando múltiplas fontes
- Detecção rápida com cache para resultados frequentes

### 2. Assistente de Segurança com Grok AI
- Chat interativo para esclarecer dúvidas sobre segurança digital
- Explicações detalhadas sobre resultados de detecção de phishing
- Recomendações personalizadas de segurança
- Histórico de conversas para referência futura

### 3. Monitoramento Proativo
- Verificação em segundo plano de SMS e notificações
- Alertas em tempo real para ameaças detectadas
- Monitoramento inteligente com economia de bateria

## Tecnologias Utilizadas

- React Native para interface multiplataforma
- Módulos nativos Android para detecção avançada
- Integração com API Grok AI para:
  - Detecção de phishing avançada
  - Assistente de segurança por chat
  - Análise de conteúdo para explicação de resultados

## Como Usar o Assistente de Segurança

O assistente de segurança está disponível de duas maneiras:

1. **Acesso Direto**: Através da aba "Assistente" na navegação principal do aplicativo.
2. **Contextual**: Quando um resultado de detecção é exibido, um botão "Perguntar ao Assistente de Segurança" permite fazer perguntas específicas sobre a análise.

O assistente pode:
- Explicar em detalhes por que um conteúdo foi identificado como phishing
- Fornecer dicas de segurança personalizadas
- Ajudar a entender e se proteger contra novas ameaças
- Responder dúvidas gerais sobre segurança digital

## Configuração

Este aplicativo requer as seguintes configurações:

1. API Grok para detecção e assistente:
   - URL: https://api.x.ai/v1/messages
   - Token: Configurado nos módulos nativos e serviços
   - Modelo: grok-2-latest

2. Permissões Android:
   - SMS para monitoramento de mensagens
   - Notificações para análise de alertas recebidos

## Estrutura do Projeto

- `/services`: Serviços para detecção, assistente, monitoramento
- `/components`: Componentes de UI reutilizáveis
- `/screens`: Telas principais do aplicativo
- `/android`: Código nativo para detecção avançada

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Arquivos de Som Necessários

Para o funcionamento correto do aplicativo, você precisa adicionar os seguintes arquivos de som:

1. Criar o diretório: `assets/sounds/` na raiz do projeto

2. Adicionar o arquivo de som de alerta:
   - Nome do arquivo: `alert.mp3`
   - Local: `assets/sounds/alert.mp3`
   - Você pode usar qualquer som de alerta breve (~1-2 segundos)
   
3. Para testes rápidos, você pode usar um som gratuito de:
   - https://mixkit.co/free-sound-effects/alert/
   - https://freesound.org/ (procurar por "alert sound")
   - Ou gerar um tom básico com ferramentas online

A falta deste arquivo pode causar erros no sistema de notificações sonoras.

## Solução de Problemas

### Erro ao Carregar Som de Alerta

Se você encontrar erros relacionados a arquivos de som ao iniciar o aplicativo:

1. A aplicação agora usa apenas vibração como feedback, sem depender de arquivos de som externos
2. Isso foi implementado para evitar erros de compilação em diferentes ambientes
3. Em uma versão de produção, os arquivos de som deveriam ser incluídos no bundle da aplicação

### Erro no Assistente ao Processar Mensagem de Voz

A funcionalidade de processamento de voz foi modificada para:

1. Detectar automaticamente falhas no sistema de gravação
2. Fornecer um sistema de fallback que usa perguntas pré-definidas quando a gravação falha
3. Exibir mensagens de erro mais claras e detalhadas quando ocorrem problemas
4. Melhorar a experiência do usuário mesmo em emuladores com limitações de áudio

### Instruções para Testes em Emuladores

Para testar o aplicativo em seu emulador Android:

1. Execute o aplicativo com: `npx expo start`
2. Pressione `a` para iniciar no emulador Android
3. Navegue até a aba "Assistente" para testar o assistente de segurança
4. Se ocorrerem erros de gravação, o sistema usará perguntas simuladas automaticamente
5. Para testar a detecção de phishing, use a aba "Verificar" e insira textos suspeitos como:
   - "Clique neste link para atualizar seus dados bancários urgentemente: http://banco-falso.com"
   - "Parabéns, você ganhou um prêmio de R$1000! Clique aqui para resgatar: http://premio-falso.net"
