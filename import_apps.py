import zipfile,json,re,posixpath
from pathlib import Path
root=Path(__file__).resolve().parent
source=Path(r'C:\Users\mrell\Downloads\seraph-main.zip')
titles={'ruffle':'Ruffle','emulatorjs':'EmulatorJS','fluidsim':'WebGL Fluids','thirtydollarwebsite':'Thirty Dollar Website','windows11':'Windows 11','turbowarp':'TurboWarp','turbowarppkg':'TurboWarp Packager','turbowarpunpkg':'TurboWarp Unpackager','weavesilk':'WeaveSilk','webretro':'WebRetro','htmlcoder':'HTML Coder','v86':'v86','calculator':'Calculator','etchasketch':'Etch a Sketch','zipopener':'ZIP Opener','godoblocks':'GodoBlocks'}
catalog=[]; count=0; size=0
with zipfile.ZipFile(source) as z:
    for slug,title in titles.items():
        entry='seraph-main/apps/'+slug+'/index.html'
        assert entry in z.namelist(),entry
        catalog.append({'id':'app-'+slug,'title':title,'url':'library/seraph-apps/apps/'+slug+'/index.html','kind':'app'})
    for e in z.infolist():
        n=e.filename
        allowed=any(n.startswith('seraph-main/apps/'+s+'/') for s in titles) or n.startswith(('seraph-main/storage/ruffle/','seraph-main/storage/emulatorjs/'))
        if e.is_dir() or not allowed or n.endswith('.DS_Store'):continue
        rel=n.split('/',1)[1]
        dest=(root/'library/seraph-apps'/rel).resolve()
        assert dest.is_relative_to(root/'library/seraph-apps')
        data=z.read(e)
        if n.endswith('.html'):
            text=data.decode('utf-8-sig',errors='replace')
            text=re.sub(r'<script\b[^>]*src=["\'][^"\']*(?:googletagmanager\.com|storage/js/cloak\.js|polyfill\.io)[^"\']*["\'][^>]*>\s*</script>','',text,flags=re.I)
            text=re.sub(r'<script\b[^>]*>\s*window\.dataLayer\s*=.*?</script>','',text,flags=re.I|re.S)
            text=re.sub(r'<link\b[^>]*(?:\.\./)+images/ico\.ico[^>]*>','',text,flags=re.I)
            text=text.replace('https://unpkg.com/@ruffle-rs/ruffle',posixpath.relpath('storage/ruffle/ruffle.js',posixpath.dirname(rel)))
            text=re.sub(r'(["\'])/(apps/[^"\']+|storage/[^"\']+)',lambda m:m[1]+posixpath.relpath(m[2],posixpath.dirname(rel)),text)
            data=text.encode('utf-8')
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        size+=len(data);count+=1
    (root/'licenses/seraph-apps-LICENSE.txt').write_bytes(z.read('seraph-main/LICENSE'))
(root/'apps.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
(root/'apps.js').write_text('window.WACKY_APPS = '+json.dumps(catalog)+';\n',encoding='utf-8')
print(json.dumps({'apps':len(catalog),'files':count,'bytes':size}))
