"""Account-scoped achievement progress and review evidence."""
from collections import defaultdict
from contextlib import closing
from datetime import date
from functools import lru_cache
import json
import math
from pathlib import Path
import re

from accounts import JUDGE, AuthError, auth_response, current_token, read_same_origin_json, session_account

ROOT = Path(__file__).resolve().parent
DEFINITIONS = {row[0]: row[-1] for row in json.loads((ROOT/'badges.json').read_text())}
JURY_BADGES = ('first-light','blink-observer','beyond-visible','five-fields')
JURY_FAVORITE = 'five-fields'
TARGETS = json.loads((ROOT/'poc-targets.json').read_text())


def badge_tables(db):
    db.executescript("""
        CREATE TABLE IF NOT EXISTS badge_observations (
            account_id TEXT NOT NULL REFERENCES accounts(id), region TEXT NOT NULL,
            channel INTEGER NOT NULL, day TEXT NOT NULL,
            PRIMARY KEY(account_id,region,channel,day)
        );
        CREATE TABLE IF NOT EXISTS badge_flags (
            account_id TEXT NOT NULL REFERENCES accounts(id), flag TEXT NOT NULL,
            PRIMARY KEY(account_id,flag)
        );
        CREATE TABLE IF NOT EXISTS badge_rgb_views (
            account_id TEXT NOT NULL REFERENCES accounts(id), region TEXT NOT NULL,
            view TEXT NOT NULL, PRIMARY KEY(account_id,region)
        );
        CREATE TABLE IF NOT EXISTS badge_awards (
            account_id TEXT NOT NULL REFERENCES accounts(id), badge TEXT NOT NULL,
            awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(account_id,badge)
        );
        CREATE TABLE IF NOT EXISTS badge_favorites (
            account_id TEXT PRIMARY KEY REFERENCES accounts(id), badge TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS observation_evidence (
            post_id INTEGER PRIMARY KEY REFERENCES community_posts(id), kind TEXT NOT NULL,
            details TEXT NOT NULL
        );
    """)


def region_key(ra, dec):
    for target in TARGETS:
        lon, lat = target['center']
        east = ((ra-lon+540) % 360-180)*math.cos(math.radians(lat))
        if math.hypot(east,dec-lat) <= .008:
            return target['key']
    return f'{ra:.2f},{dec:.2f}'


@lru_cache(maxsize=5)
def prepared_dates(region):
    path = ROOT/'dist'/'poc-fields'/f'{region}.json'
    return json.loads(path.read_text())['dates'] if path.exists() else {}


def badge_state(db, account_id):
    progress = dict.fromkeys(DEFINITIONS, 0)
    if account_id == JUDGE['id']:
        progress.update({badge:DEFINITIONS[badge] for badge in JURY_BADGES})
        return {'progress':progress,'favorite':JURY_FAVORITE,'saved_rgb':[],'awarded':list(JURY_BADGES)}
    if not account_id:
        return {'progress':progress,'favorite':None,'saved_rgb':[],'awarded':[]}
    dates, channels = defaultdict(set), defaultdict(set)
    for region, channel, day in db.execute(
        'SELECT region,channel,day FROM badge_observations WHERE account_id=?', (account_id,)
    ):
        channels[region].add(channel)
        if day:
            dates[region,channel].add(day)
    progress['blink-observer'] = min(2, max((len(days) for days in dates.values()), default=0))
    progress['five-fields'] = sum(
        any(len(days & {day for day, frames in prepared_dates(target['key']).items() if str(channel) in frames}) >= 2
            for (region,channel),days in dates.items() if region == target['key'])
        for target in TARGETS
    )
    rgb = dict(db.execute('SELECT region,view FROM badge_rgb_views WHERE account_id=?', (account_id,)))
    progress['beyond-visible'] = max((min(3,len(channels[region]))+int(region in rgb)
                                       for region in channels.keys() | rgb.keys()),default=0)
    flags = {row[0] for row in db.execute('SELECT flag FROM badge_flags WHERE account_id=?', (account_id,))}
    progress['first-light'] = int('open' in flags)
    for kind, details in db.execute("""
        SELECT e.kind,e.details FROM observation_evidence e JOIN community_posts p ON p.id=e.post_id
        WHERE p.author_id=?
    """, (account_id,)):
        value = json.loads(details)
        if kind == 'crossmatch':
            progress[kind] = max(progress[kind],min(2,len(value['surveys'])))
        elif kind in ('motion-tracker','variable-watch'):
            progress[kind] = max(progress[kind],len(value['measurements']))
        else:
            progress[kind] = 1
        if value.get('peer_reply'):
            progress['second-look'] = 1
    progress['independent-check'] = int(db.execute("""
        SELECT EXISTS(SELECT 1 FROM community_posts p JOIN community_posts r ON r.parent_id=p.id
          JOIN observation_evidence e ON e.post_id=r.id
          WHERE p.author_id=? AND p.author_id<>r.author_id AND e.kind='independent-check')
    """, (account_id,)).fetchone()[0])
    # The verification badge belongs to the original observer, not to the reviewer.
    granted = [row[0] for row in db.execute(
        'SELECT badge FROM badge_awards WHERE account_id=? ORDER BY badge',(account_id,)
    ) if row[0] in DEFINITIONS and progress[row[0]] < DEFINITIONS[row[0]]]
    progress.update({badge:DEFINITIONS[badge] for badge in granted})
    favorite = db.execute('SELECT badge FROM badge_favorites WHERE account_id=?',(account_id,)).fetchone()
    return {'progress':progress,'favorite':favorite[0] if favorite else None,
            'saved_rgb':[json.loads(value) for value in rgb.values()],'awarded':granted}


def valid_number(value, low, high):
    return type(value) in (int,float) and low <= value <= high


def day_key(value):
    try:
        day = date.fromisoformat(value)
        if day.year < 2025 or day > date.today():
            raise ValueError()
        return day.isoformat()
    except (ValueError,TypeError):
        raise AuthError(400,'invalid') from None


def evidence_for(db, value, view, parent, account_id):
    if not isinstance(value,dict) or not view:
        raise AuthError(400,'invalid')
    kind = value.get('kind')
    peer = parent is not None and parent['author_id'] != account_id
    result = {'peer_reply':peer}
    if kind == 'candidate-scout':
        if parent or not re.fullmatch(r'(?:POC-|C03-|H-|L-)?[CA]\d{2,5}[a-z]?',str(value.get('candidate',''))):
            raise AuthError(400,'invalid')
        result['candidate'] = value['candidate']
    elif kind == 'second-look':
        if not peer:
            raise AuthError(400,'invalid')
    elif kind == 'crossmatch':
        surveys = value.get('surveys')
        if not isinstance(surveys,list) or not 1 <= len(surveys) <= 3 or any(
            survey not in ('SPHEREx','WISE','Gaia') for survey in surveys
        ):
            raise AuthError(400,'invalid')
        result['surveys'] = list(dict.fromkeys(surveys))
    elif kind in ('motion-tracker','variable-watch','independent-check'):
        measurements = value.get('measurements')
        if not isinstance(measurements,list) or not 1 <= len(measurements) <= 2:
            raise AuthError(400,'invalid')
        result['measurements'] = []
        if kind == 'variable-watch':
            target = region_key(view['ra'], view['dec'])
            if target not in ('rw-aur','r-dra'):
                raise AuthError(400,'invalid')
        for measurement in measurements:
            if not isinstance(measurement,dict):
                raise AuthError(400,'invalid')
            normalized = {'day':day_key(measurement.get('day'))}
            if kind == 'motion-tracker':
                for key,limits in {'ra':(0,360),'dec':(-90,90)}.items():
                    if not valid_number(measurement.get(key),*limits):
                        raise AuthError(400,'invalid')
                    normalized[key] = measurement[key]
            elif kind == 'variable-watch':
                if not valid_number(measurement.get('brightness'),-1e10,1e10):
                    raise AuthError(400,'invalid')
                normalized['brightness'] = measurement['brightness']
            result['measurements'].append(normalized)
        dates = {m['day'] for m in result['measurements']}
        if len(dates)!=len(measurements):
            raise AuthError(400,'invalid')
        if kind == 'independent-check':
            original = json.loads(parent['details'] or '{}') if peer else {}
            original_view = json.loads(parent['sky_view'] or '{}') if peer else {}
            original_days = {m['day'] for m in original.get('measurements',[])}
            if (not peer or len(dates)!=2 or dates!=original_days or
                original_view.get('canal')!=view['canal'] or not original_view or
                region_key(original_view['ra'],original_view['dec'])!=region_key(view['ra'],view['dec'])):
                raise AuthError(400,'invalid')
            seen = {row[0] for row in db.execute(
                'SELECT day FROM badge_observations WHERE account_id=? AND region=? AND channel=?',
                (account_id,region_key(view['ra'],view['dec']),view['canal'])
            )}
            if not dates <= seen:
                raise AuthError(400,'invalid')
    else:
        raise AuthError(400,'invalid')
    return kind, json.dumps(result)


def badge_post(handler, path, database):
    if path not in ('/api/badges/activity','/api/badges/favorite'):
        return False
    try:
        body = read_same_origin_json(handler)
        with closing(database()) as db, db:
            user = session_account(db,current_token(handler))
            if not user:
                raise AuthError(401,'login')
            if user['role']!='member':
                raise AuthError(403,'member')
            account_id = user['id']
            if path.endswith('/favorite'):
                favorite = body.get('badge')
                if favorite is None:
                    db.execute('DELETE FROM badge_favorites WHERE account_id=?',(account_id,))
                elif not isinstance(favorite,str) or favorite not in DEFINITIONS:
                    raise AuthError(400,'invalid')
                else:
                    progress = badge_state(db,account_id)['progress']
                    if progress[favorite] < DEFINITIONS[favorite]:
                        raise AuthError(409,'locked')
                    db.execute('INSERT OR REPLACE INTO badge_favorites VALUES (?,?)',(account_id,favorite))
            else:
                record_activity(db,account_id,body)
            result = badge_state(db,account_id)
        auth_response(handler,result)
    except AuthError as error:
        auth_response(handler,{'error':error.code},error.status)
    return True


def record_activity(db, account_id, body):
    action = body.get('action')
    if action == 'open':
        db.execute("INSERT OR IGNORE INTO badge_flags VALUES (?,'open')",(account_id,))
        return
    ra,dec = body.get('ra'),body.get('dec')
    if not valid_number(ra,0,360) or not valid_number(dec,-90,90):
        raise AuthError(400,'invalid')
    region = region_key(ra,dec)
    if action == 'observe':
        channel = body.get('channel')
        if type(channel) is not int or channel not in range(1,103) or channel in (51,52):
            raise AuthError(400,'invalid')
        day = day_key(body['day']) if body.get('day') else ''
        db.execute('INSERT OR IGNORE INTO badge_observations VALUES (?,?,?,?)',(account_id,region,channel,day))
    elif action == 'save-rgb':
        channels = body.get('channels')
        fov = body.get('fov')
        if (not isinstance(channels,list) or len(channels)!=3 or
            any(type(channel) is not int or channel not in range(1,103) or channel in (51,52) for channel in channels) or
            len(set(channels))!=3 or not valid_number(fov,.00001,360)):
            raise AuthError(400,'invalid')
        saved = json.dumps({'ra':ra,'dec':dec,'fov':fov,'rgb':','.join(map(str,channels))})
        db.execute('INSERT OR REPLACE INTO badge_rgb_views VALUES (?,?,?)',(account_id,region,saved))
    else:
        raise AuthError(400,'invalid')
