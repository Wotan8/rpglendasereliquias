import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

const items = [
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\babosa_1786237825444.jpg', name: 'Babosa' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\bandagens_de_linho_1786237836403.jpg', name: 'Bandagens de Linho' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\beladona_1786237846406.jpg', name: 'Beladona' }
];

for (const item of items) {
    console.log(`\nProcessando ${item.name}...`);
    const dest = `avulsos-imagens/${item.name}.png`;
    
    if (existsSync(item.src)) {
        copyFileSync(item.src, dest);
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
