"""Import only game folders and shared game runtimes from the supplied archives."""
import zipfile, re, json, html, unicodedata, posixpath, hashlib, sys
from pathlib import Path
SOURCES = [Path(r'C:\Users\mrell\Downloads\Noahs-Calculus-Tutor-master (1).zip'), Path(r'C:\Users\mrell\Downloads\seraph-main.zip')]

ROOT = Path(__file__).resolve().parent
ACTIVE_SOURCES = ('noah','seraph') if '--include-seraph' in sys.argv else ('noah',)
inventory = json.loads((ROOT/'source-inventory.json').read_text(encoding='utf-8'))
ALIASES = {
 'aceattorny':'aceattorney','adventurecaptialist':'adventurecapitalist',
 'papaspizzaria':'papaspizzeria','bloxors':'bloxorz','chromedinogame':'chromedino',
 'fnaf':'fnaf1','adofai':'adanceoffireandice',
 'fireboyandwatergirlforesttemple':'fireboyandwatergirl',
 'streetfighterii':'streetfighter2','legendofzeldamajorasmask':'majorasmask',
 'totallyaccuratebattlesim':'totallyaccuratebattlesimulator',
 'timeshooter':'timeshooter1','timeshooter3swat':'timeshooter3',
 'minesweeperclassic':'minesweeper','slendytubbies1':'slendytubbies',
 'strangeropepolice':'amazingropepolice',
 'hoboprisonbrawl':'hobo2','hobo2prisonbrawl':'hobo2','hobo3wanted':'hobo3',
 'hobo4totalwar':'hobo4','hobo5spacebrawls':'hobo5',
}
def key(title):
    title=unicodedata.normalize('NFKD',html.unescape(title)).lower().strip()
    title=re.sub(r'^the\s+','',title)
    title=re.sub(r'[^a-z0-9]','',title)
    title=re.sub(r'^(bloonstowerdefense|bloonstd|btd)(\d*)$',lambda m:'bloonstd'+(m[2] or '1'),title)
    return ALIASES.get(title,title)

catalog=[]; skipped=[]; seen={}; seen_paths=set(); selected={'noah':[],'seraph':[]}
for source in ACTIVE_SOURCES:
    for game in inventory[source]:
        if game['entry'].endswith('/'): continue
        k=key(game['title'])
        if k in seen or game['entry'] in seen_paths:
            skipped.append({'title':game['title'],'source':source,'kept':seen.get(k,'same launch file')})
            continue
        seen[k]=game['title']; seen_paths.add(game['entry']); selected[source].append(game)
        relative=game['entry'].split('/',1)[1]
        catalog.append({'id':k,'title':game['title'] if source=='noah' else game['title'].title(), 'url':f'library/{source}/{relative}','source':source})

def save(relative,data):
    dest=(ROOT/relative).resolve()
    if not dest.is_relative_to(ROOT): raise ValueError('Unsafe archive path')
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(data)

bytes_written=0; files_written=0; external=[]; missing=[]
for source,zip_path in zip(('noah','seraph'),SOURCES):
    if source not in ACTIVE_SOURCES: continue
    with zipfile.ZipFile(zip_path) as z:
        prefixes=[g['entry'].rsplit('/',1)[0]+'/' for g in selected[source]] if source=='seraph' else []
        exact={g['entry'] for g in selected[source]}
        for entry in z.infolist():
            name=entry.filename
            if entry.is_dir() or name.endswith('.DS_Store'): continue
            shared=source=='seraph' and ('/storage/emulatorjs/' in name or '/storage/ruffle/' in name)
            if name not in exact and not shared and not any(name.startswith(p) for p in prefixes): continue
            relative=name.split('/',1)[1]
            data=z.read(entry)
            if name in exact:
                text=data.decode('utf-8-sig',errors='replace')
                # Remove the source site's tracking, tab cloaking, and site favicon.
                text=re.sub(r'<script\b[^>]*src=["\'][^"\']*(?:googletagmanager\.com|storage/js/cloak\.js|/js/main\.js)[^"\']*["\'][^>]*>\s*</script>','',text,flags=re.I)
                text=re.sub(r'<script\b[^>]*>\s*window\.dataLayer\s*=.*?</script>','',text,flags=re.I|re.S)
                text=re.sub(r'<link\b[^>]*(?:\.\./)+images/ico\.ico[^>]*>','',text,flags=re.I)
                # Keep source-root game/runtime URLs working under GitHub project subpaths.
                def relative_url(m):
                    return m[1]+posixpath.relpath(m[2],posixpath.dirname(relative))
                text=re.sub(r'(["\'])/(storage/[^"\']+|games/[^"\']+)',relative_url,text)
                if source=='seraph':
                    text=text.replace('https://unpkg.com/@ruffle-rs/ruffle',posixpath.relpath('storage/ruffle/ruffle.js',posixpath.dirname(relative)))
                if re.search(r'(?:src|href)\s*=\s*["\']https?://|https?://.*\.(?:wasm|data|zip|js)',text,re.I): external.append(relative)
                if not re.search(r'<base\b',text,re.I):
                    for ref in re.findall(r'(?:src|href)\s*=\s*["\']([^"\']+)',text,re.I):
                        if ref.startswith(('http:','https:','//','data:','blob:','#','javascript:')): continue
                        resolved=posixpath.normpath(posixpath.join(posixpath.dirname(name),ref.split('?')[0].split('#')[0]))
                        if resolved not in z.namelist(): missing.append({'entry':relative,'reference':ref})
                data=text.encode('utf-8')
            save('library/'+source+'/'+relative,data)
            files_written+=1; bytes_written+=len(data)
        license_name=zip_path.stem.replace(' (1)','')+'/LICENSE'
        if license_name in z.namelist(): save('licenses/'+source+'-LICENSE.txt',z.read(license_name))
    print(source,'import complete:',len(selected[source]),'games',flush=True)

(ROOT/'games.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'games.js').write_text('window.WACKY_GAMES = '+json.dumps(catalog,ensure_ascii=False)+';\n',encoding='utf-8')
report={'games':len(catalog),'duplicatesSkipped':len(skipped),'skipped':skipped,'files':files_written,'bytes':bytes_written,'externalReferences':external,'missingSourceReferences':missing}
(ROOT/'import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('skipped','externalReferences','missingSourceReferences')}))
print('Missing references:',json.dumps(missing)[:6500])
