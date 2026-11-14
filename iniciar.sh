#!/usr/bin/env bash
# ==============================================================================
# WiFive Pro Studio - Inicializador Universal para Linux Mint / Ubuntu / Debian
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "   🚀 WiFive Pro Studio - Editor de Cortes & Molduras HD"
echo "=========================================================="
echo ""

PORT=3000

# Criar atalho na Área de Trabalho se ainda não existir
DESKTOP_DIR="$HOME/Área de Trabalho"
if [ ! -d "$DESKTOP_DIR" ]; then
    DESKTOP_DIR="$HOME/Desktop"
fi

SHORTCUT_FILE="$DESKTOP_DIR/WiFive-Pro-Studio.desktop"

if [ -d "$DESKTOP_DIR" ] && [ ! -f "$SHORTCUT_FILE" ]; then
    cat <<EOF > "$SHORTCUT_FILE"
[Desktop Entry]
Version=1.0
Type=Application
Name=WiFive Pro Studio
Comment=Editor de Cortes e Molduras em Lote para Redes Sociais
Exec=bash -c "cd '$DIR' && ./iniciar.sh"
Icon=video-x-generic
Terminal=true
Categories=AudioVideo;Video;AudioVideoEditing;
StartupNotify=true
EOF
    chmod +x "$SHORTCUT_FILE"
    echo "📌 Atalho criado na sua Área de Trabalho: WiFive-Pro-Studio"
    echo ""
fi

# Abrir no navegador padrão após 1.2 segundos
(sleep 1.2 && (xdg-open "http://localhost:$PORT" 2>/dev/null || google-chrome "http://localhost:$PORT" 2>/dev/null || firefox "http://localhost:$PORT" 2>/dev/null)) &

echo "⚡ Iniciando servidor local ultra-rápido..."
echo "🌐 Endereço no navegador: http://localhost:$PORT"
echo "Pressione Ctrl+C a qualquer momento para fechar o programa."
echo "----------------------------------------------------------"

# Executar primeiro via servidor nativo (compatível com Node 14, 16, 18, 20, 22+)
if command -v node >/dev/null 2>&1 && [ -f "servidor.mjs" ] && [ -d "dist" ]; then
    PORT=$PORT node servidor.mjs
    exit 0
fi

# Fallback se tiver python3
if command -v python3 >/dev/null 2>&1 && [ -d "dist" ]; then
    python3 -m http.server $PORT --directory dist
    exit 0
fi

# Fallback se for executado com npm
npm run dev -- --host 0.0.0.0 --port $PORT
