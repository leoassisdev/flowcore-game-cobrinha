# Cobrinha

> O jogo da cobrinha no estilo do clássico dos celulares, com modo parede ou atravessa, obstáculos e níveis de velocidade. Ideal pra página 404 e telas de espera.

**Ver ao vivo, com preview e manual:** https://flowcoresolucoes.com.br/codigos/game-cobrinha

Criado por **FlowCore Soluções LTDA**.

## Como jogar

- `←` `↑` `→` `↓` mover (ou W A S D)
- `Espaço` começar
- `P` pausar
- **No celular:** D-pad na tela ou deslize o dedo no tabuleiro.

## Arquivos

- [`src/Cobrinha.tsx`](src/Cobrinha.tsx)

## Como instalar

1. **Tenha um projeto React com Tailwind** Já tem (Vite, Next.js, Remix)? Pule este passo. Se não, crie um em 1 minuto e adicione ./src/**/*.{ts,tsx} ao content do tailwind.config.

   ```bash
   npm create vite@latest minha-app -- --template react-ts
   cd minha-app
   npm install -D tailwindcss@3 postcss autoprefixer
   npx tailwindcss init -p
   ```

2. **Crie o arquivo src/components/Cobrinha.tsx** Copie o conteúdo de `src/Cobrinha.tsx` deste repositório. Ele é um arquivo só, sem dependência além de React.
3. **Use na sua página**

   ```tsx
   import Cobrinha from "./components/Cobrinha";
   
   <Cobrinha accent="#0057FF" variacao="Turbo" paredes={false} />
   ```

4. **Personalize** Textos, dados e a cor de destaque (prop accent) são props com valor padrão. Troque pelos da sua marca ou ligue na sua API.

## Tema e cor

Abre em tema claro. Use `tema="escuro"` para o escuro e `accent` para a cor de destaque:

```tsx
<Cobrinha accent="#0057FF" variacao="Turbo" paredes={false} />
```

## Licença

MIT. Pode usar em projeto pessoal ou comercial, de graça. A única condição é manter a linha **“Criado por FlowCore Soluções LTDA”** (ou o crédito de adaptação) onde ela está.

---

Precisa disso integrado no seu sistema? A [FlowCore](https://flowcoresolucoes.com.br) desenvolve sob medida.
