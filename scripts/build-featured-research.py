"""Build factual/editorial discovery metadata from the preserved Claude review.
Usage: python3 scripts/build-featured-research.py --input /path/to/review-directory
No movie bytes, direct media URLs, local artwork or private paths are published.
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
 records.append({'id':r['id'],'rank':r['rank'],'title':r['title'],'year':r['year'],'creators':r['creators'],'synopsis':r['synopsisEn'],'hook':r['hookEn'],'languages':r['languages'],'genres':genres,'collections':[c['id'] for c in taxonomy['collections'] if r['id'] in c['titleIds']],'catalogIds':[i for i in r['catalogIds'] if i not in v['proposedUnlinks']],'sourceUrl':safe(source),'image':image,'contentNote':r.get('contentNoteEn'),'editionNote':editionNote,'rightsStatus':v['rights']['reviewStatus'],'rightsNote':v['rights']['reason'],'rightsSources':[u for u in v['rights']['evidenceUrls'] if safe(u)],'playbackApproved':False})
output={'schemaVersion':1,'generatedAt':'2026-09-22','kind':'editorial-discovery','territory':'international','sourcePackageSha256':read('intake-provenance.json')['sha256'],'collections':collections,'records':records}
path=pathlib.Path(__file__).resolve().parents[1]/'public/theatre/featured-research.json';path.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n');print(f'Wrote {len(records)} editorial records, {len(collections)} collections, {path.stat().st_size} bytes')
