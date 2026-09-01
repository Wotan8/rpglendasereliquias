"""Servidor dos harness __check-*.html — igual ao http.server, mas SEM CACHE.

Por que existe: o `python -m http.server` deixa o navegador guardar os
módulos, e um harness que roda contra o arquivo do cache testa o código de
ontem e passa. Isso já custou quatro rodadas de caça a bug inexistente nesta
frente — uma vez no wb-editor.js, uma no wb-rich.js, uma no campo-imagem.js e
uma nos módulos de shared/.

Versionar com `?v=` resolve por arquivo e obriga a lembrar de subir o número
em cada mexida — e esquecer é justamente o que acontece. Aqui a resposta é
`no-store` em tudo: o navegador nunca guarda, então o teste sempre roda o que
está no disco.

    python __check-server.py [porta]     # padrão 5412
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Só o que deu errado. O log de cada .css e .png afoga o terminal.
        if args and str(args[1]) != '200':
            super().log_message(fmt, *args)


if __name__ == '__main__':
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 5412
    print(f'harness sem cache em http://localhost:{porta}  (Ctrl+C para parar)')
    ThreadingHTTPServer(('', porta), SemCache).serve_forever()
