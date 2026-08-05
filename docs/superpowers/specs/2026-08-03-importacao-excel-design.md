# Importação em massa via planilha Excel — Design

**Contexto:** hoje o cadastro de Processo, Perícia, Perito e Colaborador é feito um a um pelo formulário, o que é custoso quando existe uma planilha já mantida à mão com dezenas/centenas de registros. Esta spec cobre um novo comportamento de cadastro em massa via upload de planilhas `.xlsx`, substituindo o cadastro manual repetitivo — não substituindo o cadastro manual em si, que continua existindo para os casos do dia a dia.

Esta é a "Spec B" mencionada na spec de campos pontuais (`2026-08-03-campos-pontuais-cadastro-design.md`), cujas mudanças (Perícia.observacoes, Processo.escritorio, remoção de Colaborador.interno) já estão implementadas, revisadas e em produção. Também depende da mudança na trava de conflito de Colaborador (commit `f050bef`, já em produção), que permite o mesmo colaborador em duas perícias no mesmo horário quando é o mesmo processo — cenário raro mas real que a própria importação pode produzir.

## Escopo

Uma nova tela **"Importar planilha"**, acessível pelo menu, com duas abas independentes:

1. **Perícias e Processos** — planilha única com colunas PERÍCIA, DATA, HORA, LOCAL, PERITO, CAMPO (Colaborador), SITUAÇÃO, OBS, ESCRITÓRIOS.
2. **Peritos e Colaboradores** — planilha única com duas tabelas empilhadas na mesma aba: Colaboradores (Ética) e Peritos.

As duas abas podem ser usadas em qualquer ordem — a resolução de Perito/Colaborador por nome (com criação automática de registro mínimo quando não encontrado) garante que importar "Perícias e Processos" primeiro não trava por falta de peritos/colaboradores ainda não cadastrados, e importar "Peritos e Colaboradores" depois apenas completa os dados desses registros criados automaticamente.

Feature recorrente (não é uma migração única) — fica disponível permanentemente no sistema para uso contínuo pela equipe.

## Arquitetura

Fluxo comum às duas abas, em duas etapas de servidor:

1. **`processarPlanilhaXPreview(file)`** (server action): recebe o arquivo, parseia com `exceljs` (já é dependência do projeto, usado hoje na exportação), resolve tudo que dá pra resolver contra o banco (via `requireRole(['admin','gerencia'])`, como toda action mutável do projeto), e devolve:
   - `linhas: PreviewRow[]` — uma entrada por linha processável, já com os valores prontos para gravar, um `status: 'ok' | 'atencao' | 'duplicada'` e, quando `'atencao'`, um `motivo` legível.
   - `naoProcessadas: { linhaOriginal: number; texto: string; motivo: string }[]` — linhas que nem chegaram a virar uma entrada estruturada.
2. **`confirmarImportacaoX(linhas: PreviewRow[])`** (server action): recebe as linhas (possivelmente editadas pelo usuário na tela), refaz a checagem de duplicidade contra o estado atual do banco (não confia na checagem feita na prévia, que pode estar desatualizada), grava tudo, e devolve um relatório: quantos Processos/Perícias/Peritos/Colaboradores foram criados, quantos atualizados, quantas linhas puladas por duplicidade.

O componente de tela (`ImportarPlanilhaScreen`, client component) faz upload → chama a action de preview → renderiza uma tabela editável (Base UI `Table` com `Input`/`Select` por célula, seguindo os componentes já usados nos formulários do projeto) → no clique de "Confirmar importação", chama a action de confirmação → mostra o relatório final.

Nenhuma das duas etapas cria RLS/políticas novas — usa o client Supabase já autenticado do usuário logado, como todo o resto do projeto.

## Aba 1: Perícias e Processos

### Parsing da coluna PERÍCIA

Formato esperado: `AUTOR x RÉU - NÚMERO DO PROCESSO`.

1. Localiza o último `" - "` do texto para separar o nome das partes do número do processo. Se não encontrar nenhum `" - "`, a linha é malformada → vai para `naoProcessadas` com o motivo "não foi possível identificar o número do processo".
2. No texto antes do `" - "`, procura `" x "` (sem diferenciar maiúsculo/minúsculo) para separar Autor de Réu.
3. Se não encontrar `" x "`: Réu = `"Vale"`, Autor = o texto inteiro.

### Resolução do Processo

Busca um processo existente com o número exatamente igual ao extraído.

- **Encontrado**: reaproveita o `id`, e os campos Autor/Réu/Escritório desse processo são **sobrescritos** pelos valores da planilha (a planilha é a fonte da verdade também para processos já cadastrados).
- **Não encontrado**: será criado na confirmação com Autor/Réu/Escritório extraídos da linha.

A coluna ESCRITÓRIOS da planilha alimenta `Processo.escritorio` diretamente (texto livre, igual ao campo já existente no formulário manual).

### Resolução do Município (coluna LOCAL)

Busca por nome na base de municípios do IBGE (mesmo mecanismo já usado pelo `MunicipioCombobox`/`searchMunicipios`, reutilizado no lado servidor), sem diferenciar maiúsculo/minúsculo/acento.

- Um resultado único → usa.
- Mais de um resultado (nome de cidade repetido em outro estado) → prefere o de UF = MG.
- Nenhum resultado → linha entra na prévia com `status: 'atencao'`, motivo "município não encontrado", e a célula correspondente vira um combobox de município (igual ao do formulário manual) para escolha manual antes de confirmar.

### Resolução de Perito e Colaborador (colunas PERITO e CAMPO)

Busca por nome completo, sem diferenciar maiúsculo/minúsculo, contra os cadastros existentes.

- **Colaborador (CAMPO) é opcional** — célula vazia na planilha = perícia sem colaborador, igual ao formulário manual.
- **Perito é obrigatório** (é `not null` no banco, igual ao formulário manual) — célula vazia deixa a linha em `'atencao'` com motivo "perito não informado", e a célula correspondente na prévia vira o mesmo seletor de Perito já usado no formulário manual, para escolha obrigatória antes de confirmar (mesmo tratamento dado ao Município não encontrado).
- Nome não encontrado (Perito ou Colaborador preenchido): a linha é marcada para criar um registro mínimo (só o nome) na confirmação. A prévia mostra uma indicação "(novo)" ao lado do nome para deixar isso visível.

### Mapeamento da coluna SITUAÇÃO

| Valor na planilha | `situacao` no sistema |
|---|---|
| `CAMPO` (sem diferenciar maiúsculo) | `marcada` |
| vazio | `pendente` |
| qualquer outro valor | `pendente` (valor inicial), linha marcada `'atencao'` com motivo "situação não reconhecida", célula vira o seletor de Situação já usado no formulário manual |

### Colunas DATA, HORA, OBS

Mapeiam diretamente para `dataAgendada`, `horaAgendada` e `observacoes` da Perícia. Uma linha com DATA preenchida mas em formato não reconhecível como data também entra em `'atencao'` (nunca em `naoProcessadas`, já que o resto da linha normalmente ainda é utilizável).

### Duplicidade de Perícia

Uma linha é considerada "já importada" quando existe uma perícia com **todos** os seguintes campos iguais: processo, data, hora, perito, colaborador, observações. Esse conjunto de campos foi escolhido especificamente porque o sistema permite (desde a mudança na trava de colaborador) duas perícias idênticas em processo/data/hora/perito/colaborador quando a Observação as distingue (ex: "civil" vs. "agronômica", caso de dois especialistas examinando o mesmo caso) — por isso a observação entra na chave, senão esse cenário legítimo seria descartado como duplicata.

Linha considerada duplicada aparece na prévia com `status: 'duplicada'` e não é enviada para gravação na confirmação (a menos que o usuário a edite, alterando algum dos campos da chave, o que a torna uma linha nova aos olhos do sistema).

## Aba 2: Peritos e Colaboradores

Uma única planilha, duas tabelas na mesma aba, identificadas por conteúdo (não por posição fixa de linha):

1. O parser varre a aba célula a célula procurando a primeira linha em que alguma célula tem o texto exatamente igual a `"PERITO"` (sem diferenciar maiúsculo/minúsculo, ignorando espaços nas pontas) — essa é a linha de cabeçalho da segunda tabela.
2. Toda linha de dados **antes** dessa linha pertence à tabela de Colaboradores (colunas identificadas pelos cabeçalhos "Colaborador"/nome e "Contato" dessa primeira tabela).
3. A partir da linha do cabeçalho "PERITO" (inclusive), as colunas são identificadas pelos próprios cabeçalhos dessa segunda tabela (PERITO, CONTATO, FORMAÇÃO, CREA, CPF, JÁ TRABALHAMOS?, RELAÇÃO, RESULTADOS) — a leitura por nome de cabeçalho, não por posição de coluna, torna o parser tolerante a reordenação de colunas na planilha real.

### Colaborador

Nome + Contato.

- Nome já existe (sem diferenciar maiúsculo) → **sobrescreve** o Contato com o da planilha.
- Nome não existe → cria novo.

### Perito

Nome, Contato, Formação, CREA, CPF (mapeia para o campo `documento` já existente), Já trabalhamos?, Relação, Resultados.

- Mesma regra de match/sobrescrita por nome do Colaborador — **todos os campos** são sobrescritos pelos valores da planilha quando o nome já existe.
- **Já trabalhamos?**: `"SIM"` ou `"X"` (sem diferenciar maiúsculo) → `true`; vazio ou `"NÃO"` → `false`.
- **Relação**: espera-se que a planilha já use os valores do sistema (`ruim`/`neutra`/`boa`/`otima`), só padronizados para minúsculo; vazio → `neutra`; valor não reconhecido → linha marcada `'atencao'`, mesmo tratamento de seletor editável da Aba 1.
- **Resultados**: mesma lógica, valores `negativo`/`parcial`/`positivo`; vazio → `parcial`.

### Duplicidade

Não aplicável no mesmo sentido da Aba 1 — como o comportamento já definido é "sobrescrever quando o nome já existe", reimportar a mesma planilha várias vezes é seguro por natureza (idempotente): sempre resulta no mesmo estado final, não em registros duplicados.

## Tela de prévia editável

Uma tabela por aba (Perícias/Processos tem uma tabela; Peritos/Colaboradores tem duas, uma para cada tipo), reaproveitando os componentes de formulário já existentes no projeto para cada tipo de célula (combobox de município, seletor de situação, campos de texto simples). Linhas com `status: 'atencao'` ganham destaque visual (mesma paleta de aviso já usada no projeto, ex. a mensagem de conflito de colaborador no formulário manual). Linhas com `status: 'duplicada'` aparecem esmaecidas, com uma explicação do porquê não serão importadas, mas continuam clicáveis/editáveis caso o usuário queira forçar a importação mudando algum valor.

Abaixo da tabela principal, uma lista simples (não editável) das linhas em `naoProcessadas`, com o texto original da célula PERÍCIA e o motivo.

Botão "Confirmar importação" desabilitado enquanto não houver ao menos uma linha `'ok'` ou `'atencao'` (editada) pronta para gravação.

## Relatório final

Após a confirmação, um resumo: quantidade de Processos criados/atualizados, Perícias criadas, Peritos/Colaboradores criados/atualizados, linhas puladas por duplicidade, linhas que ficaram de fora (não processadas). Fica visível na própria tela, sem necessidade de download.

## Testes

- **Funções puras de parsing** (extração de autor/réu/número da coluna PERÍCIA, mapeamento de SITUAÇÃO, mapeamento de JÁ TRABALHAMOS?/RELAÇÃO/RESULTADOS, detecção do cabeçalho "PERITO" para dividir as duas tabelas da Aba 2): testadas isoladamente, sem banco, cobrindo os casos-limite documentados nesta spec (sem "x", sem "-", situação não reconhecida, valores vazios).
- **Server actions de resolução** (`processarPlanilhaXPreview`): testes de integração com o client Supabase mockado, cobrindo município ambíguo (prefere MG), município não encontrado, perito/colaborador novo vs. existente (com sobrescrita), processo já existente (com sobrescrita), e a chave composta de duplicidade de perícia.
- **Server action de confirmação** (`confirmarImportacaoX`): cobre a re-checagem de duplicidade no momento de confirmar (não só a da prévia).
- **Componente de prévia editável**: testes de interação (edição de célula, exclusão/inclusão de uma linha duplicada ao editá-la, habilitação do botão de confirmar).
- Toda a validação manual desta feature (upload real de planilha no navegador) roda contra o banco de **desenvolvimento** (`wpssipdxpfmvcamldpum`), nunca produção — mesma convenção já seguida em todo o projeto nesta sessão.

## Fora de escopo

- Suporte a outros formatos além de `.xlsx` (ex. `.csv`, `.ods`).
- Desfazer uma importação já confirmada (rollback em massa) — se algo for importado errado, a correção é manual (editar/excluir os registros pela tela normal).
- Qualquer alteração de layout nas planilhas de origem além do já assumido (cabeçalhos por nome na Aba 2; formato "Autor x Réu - Número" na coluna PERÍCIA da Aba 1).
- Importação incremental/agendada automática (ex. monitorar uma pasta) — o fluxo é sempre upload manual disparado pelo usuário.
