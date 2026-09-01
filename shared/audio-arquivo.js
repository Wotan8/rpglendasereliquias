/* =====================================================================
   🔊 ARQUIVO DE ÁUDIO — uma pasta só, para os dois lugares que tocam som
   ---------------------------------------------------------------------
   O Tabuleiro tem playlist de mesa; o capítulo do Cronista tem trilha. São
   a mesma coisa: um som que o mestre escolhe e a mesa ouve. Então é uma
   pasta só (`audio/`), uma regra só no storage.rules, e uma validação só —
   duas pastas com o mesmo propósito viram duas regras que divergem, e um
   dia o áudio funciona num lugar e não no outro.

   O QUE ESTAVA QUEBRADO. A playlist subia em `tabuleiro-images/`, e a
   regra dessa pasta passou a exigir `contentType.matches('image/.*')`.
   Ou seja: subir mp3 na mesa parou de funcionar, em silêncio, para todo
   mundo. O comentário no código já previa isto —
   "se um dia quiser um prefixo próprio, é criar a regra e trocar aqui".
   O dia chegou.

   O CONTENTTYPE É CARIMBADO AQUI, e não deixado por conta do navegador,
   pelo mesmo motivo da imagem (shared/campo-imagem.js): `file.type` vem
   vazio em vários seletores reais, e a regra do Storage nega por um motivo
   que não tem nada a ver com o arquivo.
   ===================================================================== */

/** A pasta. Está liberada no storage.rules para leitura de quem está
 *  logado e escrita do mestre — som de mesa é escolha do mestre. */
export const PASTA_AUDIO = 'audio';

/* 25 MB e não 10: uma faixa de 5 minutos a 256 kbps passa de 9 MB, e o teto
   da imagem deixaria de fora justamente a música de qualidade que alguém
   escolheria para ambientar uma cena. */
export const MAX_AUDIO = 25 * 1024 * 1024;

export const EXT_AUDIO = /\.(mp3|ogg|oga|wav|m4a|mp4|aac|flac|opus|weba|webm)$/i;

const TIPO_POR_EXT = {
    mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
    wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac',
    flac: 'audio/flac', weba: 'audio/webm', webm: 'audio/webm',
};

/** Recusa o que não é som ou não cabe. `null` quando está tudo bem. */
export function validarAudio(file) {
    if (!file) return 'Nenhum arquivo escolhido.';
    const ehAudio = /^audio\//.test(file.type || '') || EXT_AUDIO.test(file.name || '');
    if (!ehAudio) return 'Isso não é um arquivo de som.';
    if (file.size > MAX_AUDIO) return 'Som acima de 25 MB. Comprima antes de enviar.';
    return null;
}

/** O tipo que vai no Storage, carimbado pela extensão quando o navegador
 *  não soube dizer. */
export function tipoDeAudio(file) {
    if (/^audio\//.test(file?.type || '')) return file.type;
    const ext = String(file?.name || '').split('.').pop().toLowerCase();
    return TIPO_POR_EXT[ext] || '';
}

/** `audio/<carimbo>_<nome higienizado>`. */
export function caminhoAudio(nome) {
    const seguro = String(nome || 'som').replace(/[^\w.-]/g, '_').slice(-80);
    return `${PASTA_AUDIO}/${Date.now()}_${seguro}`;
}

/**
 * Sobe e devolve a URL. `st` são as peças do Storage de quem chama
 * ({ storage, ref, uploadBytes, getDownloadURL }) — cada tela carrega o SDK
 * do seu jeito, como já acontece em avisar-livro.js.
 */
export async function subirAudio(st, file) {
    const erro = validarAudio(file);
    if (erro) throw new Error(erro);
    const alvo = st.ref(st.storage, caminhoAudio(file.name));
    const tipo = tipoDeAudio(file);
    try {
        await st.uploadBytes(alvo, file, tipo ? { contentType: tipo } : undefined);
    } catch (e) {
        if (e && e.code === 'storage/unauthorized') {
            throw new Error('Sem permissão para enviar som. A pasta "audio/" precisa estar '
                + 'liberada no storage.rules, e a regra pede papel de mestre.');
        }
        throw e;
    }
    return await st.getDownloadURL(alvo);
}
