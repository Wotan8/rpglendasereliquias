import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

const items = [
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faca_1786828263908.jpg', name: 'Faca' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faca_celene_1786828271092.jpg', name: 'Faca celene' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faca_de_arremesso_1786828277766.jpg', name: 'Faca de Arremesso' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faca_de_caca_1786828285904.jpg', name: 'Faca de Caça' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faca_de_sangria_1786828292193.jpg', name: 'Faca de Sangria' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faixa_do_trovador_viajante_1786828300029.jpg', name: 'Faixa do Trovador Viajante' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\faldar_de_placas_1786828307431.jpg', name: 'Faldar de Placas' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\farpa_uqata_1786828316588.jpg', name: 'Farpa Uqatá' }
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
