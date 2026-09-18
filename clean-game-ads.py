import json,re,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent
games=json.loads((root/'games.json').read_text(encoding='utf-8'))
guard=(root/'game-ad-guard.js').read_text(encoding='utf-8')
ads=r'(?:googlesyndication\.com|doubleclick\.net|googleadservices\.com|adsterra\.com|monetag\.com|popads\.net|popcash\.net|adinplay\.com)'
changes=[]
backup=root/'.audit-backups';backup.mkdir(exist_ok=True)
for g in games:
    p=root/g['url'];text=p.read_text(encoding='utf-8');old=text
    if 'id="wacky-ad-guard"' in text:continue
    original=backup/(g['id']+'.html')
    if not original.exists():original.write_text(old,encoding='utf-8')
    scripts=re.compile(r'<script\b[^>]*\bsrc\s*=\s*["\'][^"\']*'+ads+r'[^"\']*["\'][^>]*>.*?</script\s*>',re.I|re.S)
    text,n=scripts.subn('',text)
    text,m=re.subn(r'<ins\b[^>]*class\s*=\s*["\'][^"\']*\badsbygoogle\b[^"\']*["\'][^>]*>.*?</ins\s*>','',text,flags=re.I|re.S)
    block='<script id="wacky-ad-guard">'+guard+'</script>'
    match=re.search(r'<head\b[^>]*>',text,re.I)
    if match:text=text[:match.end()]+block+text[match.end():]
    else:text=block+text
    p.write_text(text,encoding='utf-8')
    changes.append({'id':g['id'],'title':g['title'],'removedAdScripts':n,'removedAdSlots':m,'popupGuard':True})
(root/'ad-cleanup-report.json').write_text(json.dumps(changes,indent=2),encoding='utf-8')
ignore=root/'.gitignore';content=ignore.read_text(encoding='utf-8')
if '.audit-backups/' not in content:ignore.write_text(content+'\n.audit-backups/\n',encoding='utf-8')
print(json.dumps({'protectedGames':len(changes),'removedAdScripts':sum(x['removedAdScripts'] for x in changes),'removedAdSlots':sum(x['removedAdSlots'] for x in changes)}))
