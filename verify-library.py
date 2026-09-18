import json,re,posixpath
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parent
games=json.loads((ROOT/'games.json').read_text(encoding='utf-8'))
invalid=[g for g in games if not (ROOT/g['url']).is_file()]
games=[g for g in games if (ROOT/g['url']).is_file()]
if invalid:
    (ROOT/'games.json').write_text(json.dumps(games,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'games.js').write_text('window.WACKY_GAMES = '+json.dumps(games,ensure_ascii=False)+';\n',encoding='utf-8')
    (ROOT/'invalid-source-entries.json').write_text(json.dumps(invalid,indent=2),encoding='utf-8')
assert len({g['id'] for g in games})==len(games)
assert len({g['url'] for g in games})==len(games)
issues=[]; fixes=[]
class Refs(HTMLParser):
    def __init__(self):super().__init__();self.refs=[];self.base=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='base':self.base=True
        if tag=='script' and a.get('src'):self.refs.append(a['src'])
        if tag=='link' and a.get('rel')=='stylesheet':self.refs.append(a.get('href',''))
for game in games:
    p=ROOT/game['url'];assert p.is_file(),game['url']
    text=p.read_text(encoding='utf-8',errors='replace');original=text
    if game['source']=='seraph':
        runtime=posixpath.relpath('library/seraph/storage/ruffle/ruffle.js',posixpath.dirname(game['url']))
        text=text.replace("'../../storage/ruffle/ruffle.js'",repr(runtime))
        text=re.sub(r'<script\b[^>]*src=["\']/js/tab_cloak\.js["\'][^>]*>\s*</script>','',text,flags=re.I)
    if text!=original:p.write_text(text,encoding='utf-8');fixes.append(game['title'])
    parser=Refs();parser.feed(text)
    if parser.base:continue
    for ref in parser.refs:
        if not ref or ref.startswith(('http:','https:','//','data:','blob:')):continue
        target=(ROOT/ref.lstrip('/')) if ref.startswith('/') else p.parent/ref.split('?')[0]
        if not target.is_file():issues.append({'game':game['title'],'entry':game['url'],'missing':ref})
(ROOT/'source-issues.json').write_text(json.dumps(issues,indent=2),encoding='utf-8')
print(json.dumps({'uniqueGames':len(games),'allLaunchFilesExist':True,'fixedPaths':fixes,'missingRuntimeReferences':issues},indent=2))
