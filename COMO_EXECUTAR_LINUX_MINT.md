# WiFive Pro Studio - Guia para Linux Mint

O aplicativo agora conta com o **pacote pré-compilado (`dist/`) e servidor nativo (`servidor.mjs`)**, o que significa que:
- **NÃO precisa compilar com Vite**.
- **NÃO precisa de Node.js v20+** (funciona perfeitamente no Node.js v18, v16, v20 ou v22 que vem no Linux Mint).
- **Inicia instantaneamente** em menos de 1 segundo!

---

## 🚀 Como Iniciar

1. Abra a pasta `wifive-pro-studio-linux` no Terminal.
2. Execute o comando:

```bash
./iniciar.sh
```

Ou execute diretamente o servidor nativo com o próprio Node.js:

```bash
node servidor.mjs
```

O navegador abrirá automaticamente em **`http://localhost:3000`** com o editor pronto para uso!

---

## ⚡ Se o seu navegador não abrir sozinho
Basta abrir o Google Chrome, Edge ou Firefox e digitar na barra de endereço:
```
http://localhost:3000
```

---

## 🛑 Para Fechar o Programa
No terminal onde o programa está rodando, basta pressionar as teclas `Ctrl` + `C`.
