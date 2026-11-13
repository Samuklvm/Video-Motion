# Video Motion: estado da reconstrução

Este documento separa o que já funciona do que ainda precisa ser implementado. A meta de paridade total com o Alight Motion é extensa; a presença de uma tela ou de um controle não significa que o comportamento do aplicativo original já foi reproduzido.

## Já funciona nesta base

- Biblioteca local de projetos: criar, buscar, abrir, renomear e excluir.
- Salvamento automático de documentos `.vmproj` e cópia portátil com mídia anexada.
- Interface desktop com preview, timeline, biblioteca de mídia, navegador de efeitos e inspector.
- Importação inicial de XML e `.amproj` compactado, preservando o XML original e os arquivos de mídia identificados.
- Camadas básicas de texto, forma, imagem, vídeo e áudio; movimentação, aparo das bordas, divisão e duplicação de clipes.
- Keyframes básicos de transformação, interpolações lineares/ease/step e controles de curva.
- Catálogo local com 303 definições de efeitos, 350 imagens de prévia e controles extraídos dos metadados.
- Preview nativo para um conjunto pequeno de filtros CSS, prévia de vídeo sincronizada ao playhead e histórico básico de desfazer/refazer.
- Instalador Windows NSIS gerado localmente. O fluxo de release está configurado para publicar atualizações no GitHub Releases.

## Trabalho necessário para chegar ao objetivo

### P0 — Renderização e exportação de vídeo

- Implementar compositor por camadas para imagem, vídeo, texto, formas, transformações, alpha e ordem Z.
- Integrar áudio por faixa, volume, mute, sincronização e mixagem.
- Implementar render offline com resolução, FPS, codec, qualidade e progresso configuráveis.
- Garantir que a exportação gere arquivo reproduzível e acompanhe a prévia do editor.

### P0 — Efeitos realmente executáveis

- O catálogo e os controles foram recuperados, mas a maior parte dos efeitos ainda é apenas metadado; os arquivos de definição não são, por si só, um motor de renderização.
- Criar pipeline de textura e shaders para a cadeia de efeitos, traduzindo entradas, parâmetros, coordenadas e formatos de cor.
- Implementar e comparar os efeitos contra as prévias e projetos reais. Registrar compatibilidade por efeito para não apresentar controles sem resultado.
- Estender a prévia e o render offline para usarem a mesma implementação.

### P1 — Compatibilidade com projetos Alight Motion

- Validar variações reais de XML e `.amproj`, nomes e caminhos de mídia, fontes, máscaras, grupos, blending, áudio e atributos desconhecidos.
- Mapear keyframes, easing, propriedades animadas e parâmetros de efeitos sem perder valores nem unidades.
- Criar relatórios de importação com avisos específicos por camada e propriedade.
- A exportação atual é para `.vmproj`; escrever XML/`.amproj` compatível para reabrir no Alight Motion ainda não existe.

### P1 — Ferramentas de timeline e animação

- Adicionar snap, seleção múltipla, copiar/colar, aparo frame-accurate, divisão de áudio, marcadores e edição das bordas de keyframes.
- Implementar curvas editáveis de Bezier e keyframes de parâmetros de efeitos.
- Melhorar undo/redo para operações compostas e limites de histórico em projetos grandes.
- Implementar ferramentas de crop, ancoragem, máscaras, blend modes, transições e agrupamento.

### P1 — Controles de projeto e mídia

- Implementar propriedades completas de texto (fonte, tamanho, alinhamento, preenchimento, contorno), formas, recorte, rotação e volume.
- Tratar codecs e formatos incomuns, mídia ausente, substituição de arquivos, metadados e miniaturas.
- Ajustar desempenho e consumo de memória para projetos longos e mídias grandes.

### P2 — Distribuição e estabilidade

- Publicar uma primeira Release assinada e validar atualização em uma instalação limpa de outro PC.
- Adicionar testes de parser, formatos de projeto e renderização, além de testes manuais com projetos de referência.
- Verificar acessibilidade, atalhos, recuperação após falha, logs e migração entre versões do formato.

## Verificação feita até agora

- `npm run build` compila TypeScript e gera os recursos de produção.
- O aplicativo Electron abriu em modo de desenvolvimento.
- `npm run dist:win` gerou localmente `Video Motion Setup 0.1.0.exe`.
- Ainda não foi feita uma comparação visual/sônica automatizada contra o Alight Motion, e nenhum Release público foi criado.
