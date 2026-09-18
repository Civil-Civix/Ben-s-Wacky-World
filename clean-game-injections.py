import re,json
from pathlib import Path
root=Path(__file__).resolve().parent
guard=(root/'game-ad-guard.js').read_text(encoding='utf-8')
games=json.loads((root/'games.json').read_text(encoding='utf-8'));changed=[]
loader="""<script>document.write('<script src="'+new URL('../../seraph-apps/storage/ruffle/ruffle.js',location.href).href+'"><\\/script>');</script>"""
for game in games:
    p=root/game['url'];s=p.read_text(encoding='utf-8')
    s=re.sub(r'<script id="wacky-ad-guard">.*?</script>',lambda m:'<script id="wacky-ad-guard">'+guard+'</script>',s,flags=re.S)
    removed=[0]
    def clean(m):
        body=m[2]
        if 'wacky-ad-guard' not in m[1] and 'sidebarad1' in body and 'sidebarad2' in body and '_0x' in body and len(body)<16000:
            removed[0]+=1;return ''
        return m[0]
    s=re.sub(r'<script\b([^>]*)>(.*?)</script>',clean,s,flags=re.I|re.S)
    s,n=re.subn(r'<script\b[^>]*src=["\'][^"\']*u-cvlassrom-y/google[^"\']*ruffle\.js[^"\']*["\'][^>]*>\s*</script>',lambda m:loader,s,flags=re.I)
    p.write_text(s,encoding='utf-8')
    if removed[0] or n:changed.append({'id':game['id'],'title':game['title'],'injectedAdScriptsRemoved':removed[0],'flashLoaderReplaced':bool(n)})
(root/'ad-injection-cleanup.json').write_text(json.dumps(changed,indent=2),encoding='utf-8')
print(json.dumps({'adInjectionCleanups':len(changed),'scriptsRemoved':sum(x['injectedAdScriptsRemoved'] for x in changed),'loadersReplaced':sum(x['flashLoaderReplaced'] for x in changed)}))
