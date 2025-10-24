/* ═══════════════════════════════════════════════════════════════
   ⚡ CORREÇÃO IMEDIATA - ALAN BILTROX
   ═══════════════════════════════════════════════════════════════
   
   USE ESTE SCRIPT PARA CORRIGIR ALAN BILTROX AGORA!
   
   COMO USAR:
   1. Carregue a ficha do Alan Biltrox no navegador
   2. Pressione F12 para abrir o Console
   3. Copie TODO este código
   4. Cole no Console
   5. Pressione Enter
   6. Aguarde a mensagem de sucesso
   7. Página vai recarregar automaticamente
   8. ✅ Alan Biltrox estará corrigido!
   
   ═══════════════════════════════════════════════════════════════ */

(function() {
    console.log('%c⚡ INICIANDO CORREÇÃO DO PERSONAGEM', 'color: #8b5cf6; font-size: 16px; font-weight: bold');
    console.log('════════════════════════════════════════════════════════\n');
    
    // Verificar se character existe
    if (typeof window.character === 'undefined') {
        console.error('❌ window.character não existe!');
        console.error('Certifique-se de que a ficha está carregada.');
        return;
    }
    
    const char = window.character;
    console.log('✅ Personagem encontrado:', char.nome);
    console.log('\n📋 Verificando campos...\n');
    
    let needsSave = false;
    const fixes = [];
    
    // 1. Verificar e corrigir atributos
    const attrs = ['int', 'for', 'pre', 'rac', 'des', 'man', 'prs', 'vig', 'aut'];
    attrs.forEach(attr => {
        if (typeof char[attr] !== 'number' || isNaN(char[attr])) {
            console.warn(`⚠️ Atributo ${attr} inválido (${char[attr]}), corrigindo para 0`);
            char[attr] = 0;
            fixes.push(`Atributo ${attr} corrigido`);
            needsSave = true;
        }
    });
    
    // 2. Verificar e corrigir skills
    if (!char.skills || typeof char.skills !== 'object') {
        console.warn('⚠️ Skills ausentes, criando estrutura padrão');
        char.skills = {};
        fixes.push('Estrutura de skills criada');
        needsSave = true;
    }
    
    // Lista de skills necessárias
    const requiredSkills = [
        'atletismo', 'luta', 'pontaria', 'fortitude',
        'furtividade', 'crime', 'pilotagem', 'reflexos',
        'atuacao', 'intimidacao', 'intuicao', 'lbia',
        'percepcao', 'ciencias', 'diplomacia', 'medicina',
        'ocultismo', 'profissao', 'tecnologia', 'agilidade', 'abismo'
    ];
    
    requiredSkills.forEach(skill => {
        if (typeof char.skills[skill] !== 'number') {
            console.warn(`⚠️ Skill ${skill} ausente, adicionando com valor 0`);
            char.skills[skill] = 0;
            fixes.push(`Skill ${skill} adicionada`);
            needsSave = true;
        }
    });
    
    // 3. Verificar e corrigir campos básicos
    const basicFields = {
        nome: '',
        jogador: '',
        idade: 0,
        raca: '',
        classe: '',
        virtude: '',
        vicio: '',
        tamanho: 0,
        luns: 0,
        notas: '',
        blindagem: 0,
        exp: 0
    };
    
    Object.entries(basicFields).forEach(([field, defaultValue]) => {
        if (char[field] === undefined || char[field] === null) {
            console.warn(`⚠️ Campo ${field} ausente, definindo valor padrão`);
            char[field] = defaultValue;
            fixes.push(`Campo ${field} adicionado`);
            needsSave = true;
        }
    });
    
    // Garantir que números são realmente números
    ['idade', 'tamanho', 'luns', 'blindagem', 'exp'].forEach(field => {
        if (typeof char[field] !== 'number' || isNaN(char[field])) {
            console.warn(`⚠️ Campo ${field} não é número válido, corrigindo para 0`);
            char[field] = 0;
            fixes.push(`Campo ${field} corrigido para número`);
            needsSave = true;
        }
    });
    
    // 4. Calcular e corrigir valores de HP, DET, SAN
    const vig = char.vig || 0;
    const tamanho = char.tamanho || 0;
    const prs = char.prs || 0;
    const aut = char.aut || 0;
    const int = char.int || 0;
    const abismo = char.skills?.['abismo'] || 0;
    
    const calculatedMaxHP = vig + tamanho;
    const calculatedMaxDET = prs + aut;
    const calculatedMaxSAN = Math.max((int + aut - (abismo * 2)) * 10, 0);
    
    if (typeof char.hpCurrent !== 'number' || isNaN(char.hpCurrent)) {
        console.warn(`⚠️ hpCurrent ausente/inválido, calculando: ${calculatedMaxHP}`);
        char.hpCurrent = calculatedMaxHP;
        fixes.push(`HP atual definido como ${calculatedMaxHP}`);
        needsSave = true;
    }
    
    if (typeof char.detCurrent !== 'number' || isNaN(char.detCurrent)) {
        console.warn(`⚠️ detCurrent ausente/inválido, calculando: ${calculatedMaxDET}`);
        char.detCurrent = calculatedMaxDET;
        fixes.push(`Determinação atual definida como ${calculatedMaxDET}`);
        needsSave = true;
    }
    
    if (typeof char.sanCurrent !== 'number' || isNaN(char.sanCurrent)) {
        console.warn(`⚠️ sanCurrent ausente/inválido, calculando: ${calculatedMaxSAN}`);
        char.sanCurrent = calculatedMaxSAN;
        fixes.push(`Sanidade atual definida como ${calculatedMaxSAN}`);
        needsSave = true;
    }
    
    // Ajustar valores se excederem máximos
    if (char.hpCurrent > calculatedMaxHP) {
        char.hpCurrent = calculatedMaxHP;
        fixes.push(`HP ajustado para máximo (${calculatedMaxHP})`);
        needsSave = true;
    }
    
    if (char.detCurrent > calculatedMaxDET) {
        char.detCurrent = calculatedMaxDET;
        fixes.push(`DET ajustada para máximo (${calculatedMaxDET})`);
        needsSave = true;
    }
    
    if (char.sanCurrent > calculatedMaxSAN) {
        char.sanCurrent = calculatedMaxSAN;
        fixes.push(`SAN ajustada para máximo (${calculatedMaxSAN})`);
        needsSave = true;
    }
    
    // 5. Verificar containers
    if (!Array.isArray(char.containers) || char.containers.length === 0) {
        console.warn('⚠️ Containers ausentes, criando mochila padrão');
        char.containers = [{
            id: Date.now(),
            name: 'Mochila',
            maxCapacity: 6,
            items: []
        }];
        fixes.push('Mochila padrão criada');
        needsSave = true;
    }
    
    // 6. Verificar imagem do personagem
    if (char.characterImage && typeof char.characterImage !== 'string') {
        console.warn('⚠️ characterImage inválida, removendo');
        delete char.characterImage;
        fixes.push('Imagem inválida removida');
        needsSave = true;
    }
    
    // RELATÓRIO
    console.log('\n════════════════════════════════════════════════════════');
    console.log('%c📊 RELATÓRIO DE CORREÇÃO', 'color: #10b981; font-weight: bold');
    console.log('════════════════════════════════════════════════════════\n');
    
    if (needsSave) {
        console.log(`%c✅ ${fixes.length} correções aplicadas:`, 'color: #10b981; font-weight: bold');
        fixes.forEach((fix, i) => {
            console.log(`   ${i + 1}. ${fix}`);
        });
        
        console.log('\n💾 Salvando no Firebase...');
        
        // Tentar salvar
        if (typeof window.saveToFirebase === 'function') {
            try {
                window.saveToFirebase();
                
                console.log('\n%c✅ CORREÇÃO CONCLUÍDA COM SUCESSO!', 'color: #10b981; font-size: 14px; font-weight: bold');
                console.log('════════════════════════════════════════════════════════');
                console.log('\n📋 Dados corrigidos:');
                console.log('   Nome:', char.nome);
                console.log('   Nível:', Math.floor(char.exp / 10) || 0);
                console.log('   EXP:', char.exp);
                console.log('   HP:', char.hpCurrent + '/' + calculatedMaxHP);
                console.log('   DET:', char.detCurrent + '/' + calculatedMaxDET);
                console.log('   SAN:', char.sanCurrent + '/' + calculatedMaxSAN);
                console.log('\n🔄 Recarregando página em 3 segundos...\n');
                
                setTimeout(() => {
                    location.reload();
                }, 3000);
                
            } catch (error) {
                console.error('❌ Erro ao salvar no Firebase:', error);
                console.log('\n⚠️ Tente recarregar manualmente (F5)');
            }
        } else {
            console.error('❌ Função saveToFirebase não encontrada!');
            console.log('⚠️ As correções foram aplicadas na memória, mas não puderam ser salvas.');
            console.log('💡 Tente recarregar a página e executar este script novamente.');
        }
        
    } else {
        console.log('%c✅ Personagem já está correto!', 'color: #10b981; font-weight: bold');
        console.log('Nenhuma correção necessária.\n');
        console.log('Se ainda estiver com erro, verifique:');
        console.log('1. Se aplicou a correção do updateAllCalculations()');
        console.log('2. Se limpou o cache do navegador');
        console.log('3. Se está testando em aba anônima');
    }
    
    console.log('\n════════════════════════════════════════════════════════\n');
    
})();

/* ═══════════════════════════════════════════════════════════════
   
   APÓS EXECUTAR ESTE SCRIPT:
   
   1. Aguarde a mensagem de sucesso
   2. Página vai recarregar automaticamente
   3. Ficha do Alan Biltrox deve funcionar perfeitamente! ✅
   
   SE AINDA TIVER ERRO:
   
   1. Certifique-se de ter aplicado a correção em updateAllCalculations()
      (veja arquivo CORRECAO_DEFINITIVA.js ou CORRECAO_PERSONAGENS_ANTIGOS.js)
   
   2. Limpe o cache: Ctrl+Shift+Delete
   
   3. Teste em aba anônima: Ctrl+Shift+N
   
   4. Execute o TESTE_CONSOLE.js para diagnóstico completo
   
   ═══════════════════════════════════════════════════════════════ */