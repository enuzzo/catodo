"""Build the editorial playback catalog from the preserved Claude review.
Usage: python3 scripts/build-featured-research.py --input /path/to/review-directory
Publishes source URLs, never movie bytes, local artwork or private paths.
"""
import argparse, hashlib, json, pathlib, urllib.parse
parser=argparse.ArgumentParser();parser.add_argument('--input',type=pathlib.Path,required=True);args=parser.parse_args()
read=lambda name:json.loads((args.input/name).read_text())
rows=read('ranked-records.json');review={r['id']:r for r in map(json.loads,(args.input/'review-ledger.jsonl').read_text().splitlines())};taxonomy=read('taxonomy-review.json');notes=read('review-notes.json');posters={r['id']:r for r in read('artwork/poster-review.json')}
assert len(rows)==305 and len(review)==305
collections=[{'id':c['id'],'title':c['title'],'description':next(x['description'] for x in read('original/collections.json')['proposedCollections'] if x['id']==c['id'])} for c in taxonomy['collections']]
def safe(url):
 if not isinstance(url,str):return None
 u=urllib.parse.urlsplit(url)
 return url if u.scheme=='https' and u.hostname and not u.username and not u.password else None
records=[]
overrides=json.loads((pathlib.Path(__file__).resolve().parents[1]/'src/data/theatre-featured-editions.json').read_text())
for r in rows:
 v=review[r['id']];candidate=v.get('replacementCandidate');source=r['edition']['pageUrl']
 if candidate:source='https://archive.org/details/'+urllib.parse.urlsplit(candidate['mediaUrl']).path.split('/')[2]
 if r['id']=='the-kid':source='https://www.charliechaplin.com/en/films/1'
 if r['id']=='mickey-mouse-in-vietnam':source=notes['extraEvidence'][r['id']][0]
 if r['id']=='the-cut-ups':source=next((s['url'] for s in r['sources'] if s['role']=='curator'),None)
 image=None
 poster=next((a for a in r['artwork'] if a['kind']=='poster'),None)
 verdict=posters.get(r['id'],{}).get('verdict','visually-suitable')
 if poster and verdict=='visually-suitable' and safe(poster['url']):image={'url':poster['url'],'sourceUrl':poster['sourceUrl'],'credit':poster['credit']}
 elif source and urllib.parse.urlsplit(source).hostname=='archive.org':image={'url':'https://archive.org/services/img/'+urllib.parse.urlsplit(source).path.split('/')[2],'sourceUrl':source,'credit':'Internet Archive'}
 genres=list(r['theatreGenres'])
 for g in taxonomy['genres']:
  if r['id'] in g['proposedTitleIds'] and g['id'] not in genres:genres.append(g['id'])
 editionNote='The source edition and international rights are still being reviewed.'
 if r['id'] in notes['wrongEditionIds']:editionNote='The originally supplied file was a different film. This link points to a replacement candidate or the official work page; it is not yet approved for in-app playback.'
 elif r['id'] in notes['partialEditionIds'] or r['id'] in notes.get('shortenedEditionEvidence',{}):editionNote='The supplied copy was only part of the film or an abridged version. '+('A longer replacement candidate is linked here.' if candidate else 'Check the available edition on the source site.')
 elif r['id'] in notes['mixedProgramIds']:editionNote='The supplied file mixed this work with an unrelated short. This link opens the institutional page for the intended film.'
 elif r['id']=='the-cut-ups':editionNote='The supplied item and filename identify different films. Follow the curator page while the exact edition is resolved.'
 elif r['id']=='story-kelly-gang':editionNote='Only fragments of the original film survive. Available restorations reconstruct those fragments.'
 elif r['id'] in notes['editorialHoldIds']:editionNote='A collection of commercials rather than a single film; its editorial scope is under review.'
 chosen=overrides.get(r['id'])
 technical=(candidate or {}).get('technical') or v['technical']
 url=chosen['url'] if chosen else candidate['mediaUrl'] if candidate else r['edition']['mediaUrl']
 source=chosen['sourceUrl'] if chosen else 'https://archive.org/details/'+urllib.parse.urlsplit(url).path.split('/')[2]
 duration=chosen['duration'] if chosen else technical.get('measuredDurationSeconds') or r['durationSeconds']
 audio=chosen.get('audio','unverified') if chosen else 'present' if technical.get('audioTrackPresent') else 'silent'
 editionNote=chosen['note'] if chosen else ('Browser-compatible replacement of the originally supplied edition.' if candidate else 'Source edition. Running time and available audio were sampled; the entire film has not been watched end to end.')
 if r['id']=='story-kelly-gang':editionNote='Surviving fragments: the full original film is lost. This source presents the material that remains.'
 if audio=='silent':editionNote+=' This edition has no audio track.'
 if not poster or verdict!='visually-suitable':
  if urllib.parse.urlsplit(source).hostname=='archive.org':image={'url':'https://archive.org/services/img/'+urllib.parse.urlsplit(source).path.split('/')[2],'sourceUrl':source,'credit':'Internet Archive'}
 rightsSources=list(dict.fromkeys([u for u in v['rights']['evidenceUrls'] if safe(u)]+[source]))
 records.append({'id':r['id'],'rank':r['rank'],'title':r['title'],'year':r['year'],'creators':r['creators'],'synopsis':r['synopsisEn'],'hook':r['hookEn'],'languages':r['languages'],'genres':genres,'collections':[c['id'] for c in taxonomy['collections'] if r['id'] in c['titleIds']],'catalogIds':[i for i in r['catalogIds'] if i not in v['proposedUnlinks']],'sourceUrl':safe(source),'image':image,'contentNote':r.get('contentNoteEn'),'editionNote':editionNote,'rightsStatus':v['rights']['reviewStatus'],'rightsNote':('Original delivery review: ' if candidate or chosen else '')+v['rights']['reason'],'rightsSources':rightsSources,'worldwideRightsVerified':False,'license':('Original dossier declaration: ' if candidate or chosen else '')+(r['rights'].get('license') or 'No license declared by source'),'licenseUrl':safe(r['rights'].get('licenseUrl')),'attribution':'; '.join(r['creators'])+' · '+r['title']+' ('+str(r['year'])+'). Film, restoration and soundtrack rights remain with their respective holders.','editions':[{'url':safe(url),'sourceUrl':safe(source),'duration':duration,'audio':audio,'label':chosen.get('label','Source edition') if chosen else 'Source edition'}]})
output={'schemaVersion':2,'generatedAt':'2026-09-22','kind':'editorial-playback','territory':'international','sourcePackageSha256':read('intake-provenance.json')['sha256'],'collections':collections,'records':records}
path=pathlib.Path(__file__).resolve().parents[1]/'public/theatre/featured-research.json';path.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');print(f'Wrote {len(records)} editorial records, {len(collections)} collections, {path.stat().st_size} bytes')
