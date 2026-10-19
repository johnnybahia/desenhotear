# Desenho para fita

PWA (celular e PC, funciona offline) que gera o desenho alto e baixo para teares de fita a partir de um desenho pintado em grade.

## O que faz
- Pinta o desenho numa grade (modelos prontos: A, losango, cruz, coração, diagonal, xadrez), com **Desfazer**, girar 90° (↻ ↺), espelhar (↔ ↕) e inverter cores.
- **Texto ou imagem → desenho**, com prévia ao vivo antes de aplicar:
  - Texto: fonte de pixel 5×7 (nítida, tamanhos 1× a 4×) ou fonte do aparelho (4 estilos, altura livre).
  - Imagem: foto, logotipo ou silhueta reduzida para a grade, com quantidade de preto, pontilhado e proporção da imagem.
  - Opções: engrossar, afinar, só contorno, inverter claro/escuro, correção da proporção do pixel (pode ser calculada pela produção).
  - Limite de quadros opcional: a prévia mostra quadros, corrente, fios e flutuação em tempo real, e "Simplificar" junta colunas parecidas para caber.
  - Depois de aplicar, tudo continua editável à mão.
- Estruturas: chapado (só frente), duplo (desenho dos dois lados, 2 camadas) e tubular.
- 10 ligamentos de fundo com miniatura: tafetá, sarja 2/1, 1/2, 3/1, 2/2, cetim 5, cetim 8, esteira, espinha de peixe, rips.
- Calcula quadros, liços, total de fios (fios por liço de fundo, detalhe e ourela), peças da corrente e flutuação.
- Corrente com mínimo de peças configurável (padrão 8). O ligamento precisa fechar: se não fecha, o desenho é repetido até fechar.
- Limites opcionais de quadros e peças. Se estourar, sugere ligamento, estrutura ou distância que cabem.
- Prévia frente e verso fio a fio, com cores configuráveis.
- Tabela alto/baixo (A/B) por peça, passagem nos liços, cópia, CSV, PNG, impressão.
- Produção: batidas/min, batidas/cm, fios/cm → cm/min, m/h, tempo por metro, passo do desenho em mm, largura.
- Projetos salvos no aparelho + exportar/importar JSON.

## Convenções
- **A** = alto (fio levantado), **B** = baixo. Uma peça da corrente = uma passada (batida de trama).
- Pintado = o fio de detalhe sobe e aparece na frente.
- Quadro = conjunto de liços com a mesma sequência A/B.

## Limitações conhecidas
- Duplo e tubular usam um modelo simplificado (passadas alternando frente e verso; no tubular, uma borda de tubo em cada ponta). **Validar com uma corrente real** antes de produzir.
- A prévia é uma simulação, sem espessura ou título real do fio.
- A velocidade do tear não é sugerida pelo sistema, só calculada a partir dos valores informados.

## Rodar
Abrir `index.html` funciona, mas para instalar como app é preciso HTTPS (service worker). Com GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.

Servidor local: `python3 -m http.server 8000` e abrir `http://localhost:8000`.

## Testes
```
node tests/engine.test.js
```

## Arquivos
- `engine.js` — motor de cálculo e conversão de texto/imagem em grade (sem dependências, roda no navegador e no Node)
- `app.js`, `index.html`, `style.css` — interface
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA
- `tests/` — testes do motor e gerador de ícones
