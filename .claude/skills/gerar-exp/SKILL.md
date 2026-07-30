---
name: gerar-exp
description: Calcula e registra a distribuição de EXP de uma sessão da campanha Reliera (Lendas e Relíquias). Use quando o usuário pedir para gerar, calcular ou distribuir o EXP de uma sessão específica — ex. "gera o exp da sessão 46", "calcula o exp dos jogadores da sessão X", "distribui o exp dessa sessão".
---

# Gerar EXP de uma sessão

Este skill lê a rubrica do Mestre e o resumo de uma sessão, calcula a distribuição de EXP por jogador, apresenta o resultado, e — se aprovado — grava a distribuição no próprio docx do resumo.

## 1. Localizar os dois arquivos-fonte

**A rubrica (fixa, sempre a mesma):**
```
D:\Imagem\US - Universo Soberano\RPG\Reliera\0- Mestre\Sistema de EXP\Prompt_Distribuicao_de_EXP.docx
```

**O resumo da sessão pedida (varia por número):** procure com Glob dentro de
`D:\Imagem\US - Universo Soberano\RPG\Reliera\0- Mestre\` por uma pasta que bata com a mesa/sessão
(padrão observado: `Mesa1-Sessão<N>`, mas pode variar) e dentro dela um arquivo
`RESUMO_Sessao<N>*.docx` (aceite variações de acento/maiúsculas). Se houver mais de um
candidato ou nenhum, pergunte ao usuário em vez de adivinhar.

## 2. Ler o conteúdo dos dois .docx

O Read tool não lê `.docx` diretamente. Converta cada um para Markdown com pandoc antes de ler:

```bash
pandoc "<caminho_do_docx>" -t markdown -o "<scratch>/nome-temp.md"
```

Leia os `.md` gerados com a tool Read. **Não baixe suposição alguma que não esteja nos dois arquivos** — a rubrica define o método, o resumo é a única fonte de fatos sobre o que aconteceu (registro do Mestre + relatos em primeira pessoa dos jogadores que já tiverem sido adicionados).

## 3. Aplicar a rubrica

Siga exatamente o método do `Prompt_Distribuicao_de_EXP.docx`:
- decida o **teto da sessão** (0–12) com uma frase justificando a faixa;
- avalie cada jogador pelos 5 eixos (roleplay, combate, exploração, cooperação, iniciativa) dentro desse teto;
- some **+1 fixo** para quem escreveu o relato em primeira pessoa daquela sessão (é o bônus do resumo — pode estourar o teto, isso é intencional);
- aplique **penalidade só se o resumo relatar explicitamente** algo como distração real, ausência prolongada ou atrito que atrapalhou a mesa — não invente penalidade a partir de silêncio sobre um jogador;
- se um jogador não tiver relato em primeira pessoa ainda, ele participa da rubrica normalmente pelos fatos do registro do Mestre, só não recebe o +1.

## 4. Apresentar ao usuário

Responda em texto (não precisa de arquivo ainda) com:
1. O teto da sessão e por quê.
2. Uma tabela: Jogador | Personagem | Base | Resumo (+1) | Penalidade | **Total** | Justificativa.
3. Pergunte se aprova antes de gravar — ele pode querer ajustar algum número (ele estava na mesa, o skill não).

## 5. Gravar no docx do resumo

Só depois de aprovado (ou se o usuário disser para gravar direto). Converta o `.docx` do resumo
para `.md` (mesmo comando do passo 2, se ainda não tiver o arquivo), acrescente ao **final** do
markdown uma seção nova:

```markdown
\newpage

# EXP DA SESSÃO

| Jogador | Personagem | Base | Resumo (+1) | Penalidade | **Total** | Justificativa |
|---|---|:---:|:---:|:---:|:---:|---|
| ... |
```

Depois reconverta para sobrescrever o mesmo arquivo `.docx` original (mesmo caminho, mesmo nome):

```bash
pandoc "<scratch>/resumo-atualizado.md" -o "<caminho_original>/RESUMO_Sessao<N>....docx" -f markdown+pipe_tables+raw_tex --toc --toc-depth=1
```

**Nunca crie um arquivo novo para o EXP** — ele sempre vive dentro do mesmo docx de resumo da sessão, como seção final.

## Notas

- Se a pasta da sessão tiver uma subpasta de "Situação B" ou variação de plano, o resumo real (o que de fato aconteceu na mesa) é sempre o `RESUMO_Sessao<N>...docx` na raiz da pasta da sessão — ignore variações de planejamento alternativo.
- Se novos relatos de jogadores forem adicionados ao resumo depois da primeira geração de EXP, ao rodar de novo para a mesma sessão, recalcule do zero e substitua a seção "EXP DA SESSÃO" inteira, não duplique.
