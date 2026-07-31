// Uso: node gerar-imagem.mjs "prompt da imagem" [caminho-saida.png] [imagem-referencia]
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Defina a variável de ambiente GEMINI_API_KEY antes de rodar.");
  process.exit(1);
}

let prompt = process.argv[2];
if (!prompt) {
  console.error('Uso: node gerar-imagem.mjs "prompt da imagem" [caminho-saida.png] [imagem-referencia]');
  process.exit(1);
}
// Prompt longo com aspas/acento quebra na linha de comando: passe "@arquivo.txt" (UTF-8).
if (prompt.startsWith("@")) {
  const { readFile } = await import("node:fs/promises");
  prompt = await readFile(prompt.slice(1), "utf8");
}

const saida = process.argv[3] || "imagem-gerada.png";

const referencia = process.argv[4];
const partes = [{ text: prompt }];
if (referencia) {
  const { readFile } = await import("node:fs/promises");
  partes.unshift({
    inlineData: {
      mimeType: referencia.toLowerCase().endsWith(".jpg") || referencia.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : "image/png",
      data: (await readFile(referencia)).toString("base64"),
    },
  });
}

const resp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview"}:generateContent`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({ contents: [{ parts: partes }] }),
  }
);

if (!resp.ok) {
  console.error(`Erro da API (${resp.status}): ${await resp.text()}`);
  process.exit(1);
}

const data = await resp.json();
const parte = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
if (!parte) {
  console.error("A resposta não trouxe nenhuma imagem:", JSON.stringify(data, null, 2));
  process.exit(1);
}

const { writeFile } = await import("node:fs/promises");
await writeFile(saida, Buffer.from(parte.inlineData.data, "base64"));
console.log(`Imagem salva em ${saida}`);
