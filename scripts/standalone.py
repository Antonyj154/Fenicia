# Deja cada página compilada como un HTML autónomo (CSS y JS incrustados) en la raíz del proyecto:
#   dist/juego/       → index.html        (el juego)
#   dist/laboratorio/ → laboratorio.html  (laboratorio económico)
# Las piezas de arte se cargan desde ./assets/ (carpeta en la raíz del repositorio).
import glob, re
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
PAGES = {
    'juego': ('index.html', 'FENICIA', 'IBM+Plex+Sans+Condensed:wght@400;500;600&family=Marcellus'),
}
for page, (out, title, fam) in PAGES.items():
    css = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(f'dist/{page}/assets/*.css'))
    js = [open(f, encoding='utf-8').read() for f in glob.glob(f'dist/{page}/assets/*.js')]
    assert len(js) == 1, f'{page}: se esperaba un solo JS, hay {len(js)}'
    assert '</script' not in js[0]
    html = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<title>{title}</title>
<meta name="theme-color" content="#1a1424">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FENICIA">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="icon" type="image/png" href="./assets/icons/favicon-64.png">
<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png">
{FONTS}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={fam}&display=swap">
<style>{css}</style>
</head>
<body>
<div id="{'game' if page == 'juego' else 'app'}"></div>
<script type="module">{js[0]}</script>
</body>
</html>
'''
    open(out, 'w', encoding='utf-8').write(html)
    print(f'{out}: {len(html):,} bytes')

# Service worker con la versión de esta compilación
import hashlib, time
ver = hashlib.sha1(open('index.html', 'rb').read()).hexdigest()[:10]
open('sw.js', 'w', encoding='utf-8').write(open('scripts/sw.template.js', encoding='utf-8').read().replace('__VERSION__', ver))
print('sw.js versión', ver)
