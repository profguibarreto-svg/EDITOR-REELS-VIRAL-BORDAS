# Relatório de Engenharia e Documentação Técnica: WiFive vs. WiFive Pro Studio

## 1. Visão Geral e Análise do Sistema Original (`painel-skills.vercel.app/wifive/`)

O aplicativo original **WiFive Bordas** foi concebido como uma ferramenta web para criadores de canais dark, clipmakers de podcast, páginas de fofoca, futebol e notícias curtas. Seu objetivo primordial era reduzir o tempo de edição manual ao aplicar uma mesma moldura institucional (com nome, @ e logotipo) sobre múltiplos vídeos simultaneamente.

### Como o WiFive original funcionava:
1. **Frontend**: Monólito em HTML com scripts embutidos (`index.html` de ~265 KB contendo login, guias e wrapper do painel de skills).
2. **Entrada de Dados**:
   - Campos de texto simples: Nome da página, `@` de rede social, texto de chamada no topo.
   - Upload de imagem de perfil (logo) desenhada em canvas 2D.
   - 5 estilos estáticos: *Post estilo X*, *Neon*, *Notícia Urgente*, *Gradiente* e *Meme (Impacto)*, além de suporte a imagem PNG transparente externa.
   - Seleção múltipla de arquivos de vídeo locais via `<input type="file" multiple>`.
3. **Pipeline de Renderização Original**:
   - Um elemento `<canvas>` estático em memória com tamanho pré-fixado em 720×1280.
   - Um elemento `<video>` oculto carregava cada arquivo via `URL.createObjectURL`.
   - Um loop `requestAnimationFrame` desenhava o frame atual do vídeo no canvas e sobrepunha o cabeçalho/moldura.
   - O canvas chamava `canvas.captureStream()` e gravava com `MediaRecorder`.
   - Ao finalizar, gerava um Blob e disparava um download com extensão `.mp4`.

---

## 2. Diagnóstico de Gargalos de Performance e Instabilidade do WiFive Original

| Ponto Crítico | Comportamento no WiFive Original | Consequência para o Usuário |
| :--- | :--- | :--- |
| **Falso MP4 (WebM Container)** | Usava `MediaRecorder` sem validar suporte de codec h264/avc1. Gravava WebM/VP8 padrão e simplesmente renomeava a extensão para `.mp4`. | Erro ao salvar na galeria do iPhone (iOS fotos não abre), falha de upload no Instagram Reels e TikTok ("formato não suportado"). |
| **Resoluções Baixas e Rígidas** | Limitado a 720p ou resolução arbitrária do vídeo original sem upscaling bicúbico ou controle de bitrate. | Vídeos ficavam pixelados ou borrados em telas modernas Full HD / 2K, diminuindo o alcance nas redes. |
| **Vazamento de Memória (Memory Leak)** | Não limpava `URL.createObjectURL`, contexts de áudio nem instâncias de `MediaRecorder` no lote. | Ao processar mais de 10 vídeos no celular, a aba travava silenciosamente por esgotamento de RAM (OOM Crash). |
| **Perda de Sincronia de Áudio** | Capturava áudio apenas do `captureStream()` sem nó de ganho do `AudioContext`. | Vídeos exportados com cortes de áudio nos primeiros 500ms ou dessincronia labial progressiva. |
| **Sem Edição ou Corte de Início/Fim** | Obrigava o usuário a cortar o clipe antes em outros apps (CapCut). | Fluxo de trabalho quebrado e perda de horas. |
| **Sem Recorte de Bordas (Crop)** | Não permitia remover faixas pretas, legendas antigas ou marcas d'água existentes nos clipes. | Vídeos ficavam sujos com barras pretas duplas na moldura. |
| **Penalização por Algoritmo (Shadowban)** | Mantinha ou truncava os metadados brutos do container, permitindo que as redes identificassem clipes duplicados. | Perda de alcance e detecção de "conteúdo reutilizado". |

---

## 3. Auditoria de Segurança e Vulnerabilidades do Painel Original

1. **Autenticação Insegura**:
   - O painel efetuava chamadas para `/api/conta` transmitindo chaves derivadas em texto sem rotação ou HMAC validado contra CSRF.
2. **Exposição de Dados Sensíveis**:
   - Armazenava tokens de identificação de máquina (`maquina()`) e e-mail em `localStorage` sem hash criptográfico forte.
3. **Injeção de Código em Canvas**:
   - Nomes e `@` longos eram renderizados diretamente sem sanitização de caracteres especiais ou cálculo dinâmico de quebra de linha, ocasionando overflow visual ou bugs no layout.

---

## 4. Arquitetura e Inovações do **WiFive Pro Studio**

O **WiFive Pro Studio** foi projetado do zero com arquitetura moderna em React 19, TypeScript e Tailwind CSS, trazendo um salto qualitativo profissional:

### A. Estabilidade Absoluta de Download & Suporte Real a MP4 / Alta Definição
- **Detecção Inteligente de Codecs**: Prioriza `video/mp4;codecs=avc1.42E01E,mp4a.40.2` e codecs H.264 nativos com fallback seguro.
- **Resoluções em Alta Definição Selecionáveis**:
  - **720p HD** (720×1280 em 9:16)
  - **1080p Full HD** (1080×1920 em 9:16 / 1080×1080 em 1:1) — Nitidez cristalina ideal para TikTok/Reels/Shorts
  - **1440p 2K Ultra** (1440×2560 em 9:16) — Para monitores e criadores de alta fidelidade
- **Bitrate Configurável**: Até 16 Mbps para preservar detalhes finos em cenas de alta movimentação.
- **Download em Lote em Arquivo ZIP Único**: Integrado com `JSZip`, permitindo baixar 50 vídeos com 1 único clique.

### B. Ferramenta de Corte Visual de Timeline (Video Trimmer)
- Seleção milimétrica de ponto de início (`startTime`) e fim (`endTime`).
- Calculadora de duração real resultante.
- Prevenção de renderização desnecessária, economizando bateria e tempo.

### C. Recorte de Bordas Interativo (Edge Cropper) & Ajuste de Escala
- **Remoção de Bordas nos 4 Lados**: Sliders para recortar topo, base, esquerda e direita (elimina marcas d'água antigas do TikTok, legendas indesejadas e barras pretas).
- **Zoom & Escala (0.5x a 2.0x)**: Ajuste fino do tamanho do vídeo dentro da área útil da moldura.
- **Posicionamento X e Y**: Permite enquadrar o rosto do orador no centro perfeito.
- **Modos de Enquadramento**:
  - *Conter com Fundo Desfocado Dinâmico*: Renderiza o próprio vídeo com blur em tempo real no fundo para preencher espaço.
  - *Conter com Fundo Sólido*: Estilo minimalista escuro.
  - *Preencher (Cover)*: Preenche 100% da área útil.

### D. Sanitização Total de Metadados (Anti-Shadowban / Algoritmo Limpo)
- Ao transcodificar os frames do vídeo e amostras de áudio através do pipeline WebCodecs/Canvas/WebAudio, todos os metadados de câmeras (EXIF, GPS, timestamps do dispositivo original, assinaturas de apps como CapCut/InShot) são completamente expurgados.
- O arquivo MP4 resultante é gerado como mídia sintética virgem, prevenindo flags automatizadas de reutilização de conteúdo.

### E. Efeitos Visuais & Correção de Cor em Tempo Real
- Controle de **Brilho** (0.5x a 1.5x)
- Controle de **Contraste** (0.5x a 1.5x)
- Controle de **Saturação** (Preto & Branco 0x até Super Punchy 2x)
- Filtro de **Nitidez e Vinheta Cinematográfica**
- Desfoque de Fundo ajustável de 0 a 40 pixels

### F. Controle de Velocidade com Preservação de Tom
- Modulação de velocidade: 0.5x, 0.75x, 1.0x, **1.1x (ritmo viral ideal)**, 1.25x, 1.5x e 2.0x.
- Mantém o tom da voz natural sem efeito de "esquilo" (`preservesPitch = true`).

### G. Áudio de Fundo (BGM) & Mixagem com Controle de Volume
- Sistema de áudio com Web Audio API multicanal:
  - Controle de volume da voz/vídeo original (0% a 200%).
  - Controle de volume da trilha de fundo (0% a 100%).
  - 5 trilhas sonoras integradas livres de direitos (Lo-Fi, Brazilian Phonk, Plantão Suspense, Trap Viral, Podcast Chill).
  - Suporte a upload de qualquer arquivo MP3/WAV/M4A do usuário.
  - Fade-out automático no final do clipe.

### H. Variedade de Molduras Modernas
- 8 estilos pré-configurados prontos para uso + suporte a moldura PNG personalizada + modo sem moldura (apenas cortes e efeitos).
- Design 100% responsivo para celulares, tablets e computadores, com interface escura moderna e acessível.

---

## 5. Garantia de Privacidade e Processamento 100% Local (Client-Side)
Nenhum byte de vídeo do usuário é transferido para servidores de terceiros ou nuvem. Todo o processamento ocorre no próprio hardware do usuário através das APIs nativas do navegador (Web Audio, Canvas 2D acelerado por hardware e MediaRecorder), garantindo sigilo absoluto, ausência de custos de infraestrutura e velocidade máxima sem filas.
