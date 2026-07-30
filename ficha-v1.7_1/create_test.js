const fs = require('fs');
let code = fs.readFileSync('js/mechanics-engine.js', 'utf8');

// strip out window references that break node
code = code.replace(/window\./g, 'global.');
code = code.replace(/document\./g, 'global.document.');

code += `
global.document = { querySelectorAll: () => [], getElementById: () => null };
global.state = {
    mecanicasAplicadas: {
        'mech1': {
            aplicada: true,
            alvosEscolhidos: [ { nome: 'Atletismo', valor: '1' } ]
        }
    },
    mechanicBonuses: {}
};
global.TARGET_MAP = {
    'Atletismo': 'sk_fisico_atletismo'
};
const mech = {
    id: 'mech1',
    tipo: 'distribuir',
    duracao: 'permanente',
    config: { operacao: '+' }
};

// run
applyMechanicToSheet(mech, null);
console.log('Result bonuses:', state.mechanicBonuses);
`;
fs.writeFileSync('test.js', code);
