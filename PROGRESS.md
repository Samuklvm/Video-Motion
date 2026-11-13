# Estado em 13/11/2026

## Distribuição

- Release pública recomendada: `v0.1.3`.
- Instalador, `latest.yml` e blockmap publicados juntos. Nomes dos assets conferidos com o manifesto de atualização.
- Instalador baixado do GitHub, SHA-512 comparado com o manifesto e instalação silenciosa concluída com código 0 neste PC.
- A abertura da versão instalada ainda não foi confirmada: nenhuma janela apareceu na tentativa observada. Não considerar instalação/atualização ponta a ponta validada.

## Verificação interativa realizada

No aplicativo Electron em desenvolvimento: criação de projeto e forma; ajuste da escala vinculada para 199,5%; salvamento; retorno à biblioteca; reabertura com valores preservados; criação de um segundo keyframe em aproximadamente 2 segundos; aplicação do preset Suave; confirmação dos valores Bézier salvos.

Corrigidos durante a inspeção: corte da timeline em janela baixa, barra de rolagem externa e fontes alternativas dos títulos.

## Mudanças em main posteriores à release

- Painel de parâmetros refeito: campos e sliders respeitando limites, seletores, switches, vetores com limites por eixo, cores ARGB com alpha e restauração por parâmetro/efeito.
- Padrões de vetores e hue-disc preservados em vez de substituídos por zero ou uma cor arbitrária. Hue-disc permanece com componentes numéricos; a roda original ainda não foi reproduzida.
- Teste interativo de Curvar: seis controles exibidos, ângulo alterado para 96,6 e salvo, depois restaurado para zero e confirmado no arquivo. Shader Curvar segue indisponível.
- Quatorze testes automatizados passando, incluindo inicialização de todos os parâmetros do catálogo, limites vetoriais, alpha e switches.

- Catálogo: 31 nomes genéricos corrigidos, 259 definições com prévias existentes e quatro novas associações explícitas. As 303 definições permanecem preservadas; 13 internas/experimentais ficam fora da biblioteca normal.
- Categorias e modos de mesclagem com nomes em português. Nomes recuperados e nomes editoriais têm origem registrada no catálogo.
- Efeitos importados consultam o catálogo para exibir nome e prévia. Controles numéricos deixam de aparecer como listas de uma única opção.
- Nove testes automatizados passando, incluindo integridade dos vínculos entre definições, parâmetros e arquivos de prévia. Isso verifica referências, não equivalência visual dos shaders.

- Oito presets de curva com miniaturas, copiar/colar, inverter e presets pessoais persistidos no navegador local do aplicativo.
- Nomes das propriedades animadas em português.
- Melhorias de contraste, hierarquia visual, tamanho de textos e acabamento dos painéis pretos.
- Nome de artefato fixado com hífens para próximas releases.

Essas mudanças posteriores precisam de nova release para chegar ao instalador. Presets pessoais ficam neste computador; não estão embutidos nas cópias de projeto.

## Pendências principais

Exportação de vídeo, composição completa, shaders, fidelidade da importação Alight, referência visual fornecida pelo usuário e atualização real entre duas instalações ainda exigem implementação/validação. Não há evidência de paridade completa com Alight Motion.
