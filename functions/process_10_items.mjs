import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

const items = [
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\hidromel_da_casa_1787528954272.jpg', name: 'Hidromel da Casa' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\hortela_brava_1787528964408.jpg', name: 'Hortelã-Brava' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\incenso_consagrado_1787528973815.jpg', name: 'Incenso Consagrado' }
];

for (const item of items) {
    console.log(`\nProcessando ${item.name}...`);
    const dest = `avulsos-imagens/${item.name}.png`;
    
    if (existsSync(item.src)) {
        copyFileSync(item.src, dest);
        try {
            copyFileSync(item.src, `D:\\Imagem\\US - Universo Soberano\\RPG\\Reliera\\10 🗃️ Anexos\\Itens do Gemini\\Com Fundo (Originais)\\${item.name}.jpg`);
        } catch (e) {
            console.error(`Erro ao salvar imagem original em anexos para ${item.name}`, e);
        }
    } else {
        console.error(`Source not found: ${item.src}`);
        continue;
    }
    
    try {
        console.log(`Removendo fundo...`);
        execSync(`python ../functions/remove-bg.py "${dest}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Erro ao remover fundo para ${item.name}`, e);
    }

    try {
        console.log(`Fazendo upload...`);
        execSync(`node upload-and-update.mjs "${dest}" "system/data/equipment" "${item.name}"`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`Erro ao fazer upload para ${item.name}`, e);
    }
}
