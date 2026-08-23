import { execSync } from 'child_process';
import { copyFileSync, existsSync } from 'fs';

const items = [
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\gibao_acolchoado_1787528065326.jpg', name: 'Gibão Acolchoado' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\giz_de_selos_1787528074581.jpg', name: 'Giz de Selos' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\glaive_1787528083738.jpg', name: 'Glaive' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\gola_de_couro_1787528193844.jpg', name: 'Gola de Couro' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\gorjal_de_aco_1787528201930.jpg', name: 'Gorjal de Aço' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\gorjal_de_malha_1787528211683.jpg', name: 'Gorjal de Malha' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\grevas_de_placas_1787528220591.jpg', name: 'Grevas de Placas' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\grimorio_de_aprendiz_1787528339060.jpg', name: 'Grimório de Aprendiz' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\grimorio_dos_ecos_cifrados_1787528347544.jpg', name: 'Grimório dos Ecos Cifrados' },
    { src: 'C:\\Users\\Soberano\\.gemini\\antigravity\\brain\\109cdc47-385e-44dc-8c3c-894a32dc8518\\harpa_de_colo_1787528357228.jpg', name: 'Harpa de Colo' }
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
