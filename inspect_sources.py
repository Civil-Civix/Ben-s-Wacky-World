import zipfile, re, json, html, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent
SOURCES = [Path(r'C:\Users\mrell\Downloads\Noahs-Calculus-Tutor-master (1).zip'), Path(r'C:\Users\mrell\Downloads\seraph-main.zip')]
with zipfile.ZipFile(SOURCES[0]) as z:
    text = z.read('Noahs-Calculus-Tutor-master/games.js').decode('utf-8-sig')
    pairs = re.findall(r'title:\s*"((?:\\.|[^"\\])*)".*?url:\s*"([^"]+)"', text, re.S)
    noah = [{'title':json.loads('"'+t+'"'), 'entry':'Noahs-Calculus-Tutor-master/games/'+u.rsplit('/',1)[-1]} for t,u in pairs]
    noah = [g for g in noah if g['entry'] in z.namelist() and not z.getinfo(g['entry']).is_dir()]
with zipfile.ZipFile(SOURCES[1]) as z:
    text = z.read('seraph-main/games/index.html').decode('utf-8-sig')
    pairs = re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', text, re.S|re.I)
    seraph=[]
    for url,body in pairs:
        title=re.search(r'<h2[^>]*>(.*?)</h2>',body,re.S|re.I)
        if title and not url.startswith(('http','/','#')):
            entry='seraph-main/games/'+url
            if entry in z.namelist():
                seraph.append({'title':html.unescape(re.sub('<[^>]+>','',title[1])).strip(), 'entry':entry})
    print('Seraph game bytes:', sum(e.file_size for e in z.infolist() if e.filename.startswith('seraph-main/games/')))
    print('Shared runtime bytes:',sum(e.file_size for e in z.infolist() if '/storage/emulatorjs/' in e.filename or '/storage/ruffle/' in e.filename))
    print('Large files:',[(e.filename,e.file_size) for e in z.infolist() if e.file_size>100_000_000 and '/games/' in e.filename])
(ROOT/'source-inventory.json').write_text(json.dumps({'noah':noah,'seraph':seraph},ensure_ascii=False,indent=2),encoding='utf-8')
print('Catalog entries:',len(noah),len(seraph))
print('Noah titles:',[g['title'] for g in noah])
print('Seraph titles:',[g['title'] for g in seraph])
