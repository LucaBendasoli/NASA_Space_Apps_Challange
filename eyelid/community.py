"""Public discussions written by individual Eyelid accounts."""
from contextlib import closing
from datetime import date, datetime, timezone
import json
import re
from urllib.parse import parse_qs

from accounts import AuthError, auth_response, current_token, database, photo_url, read_same_origin_json, session_account

POSTS = '/api/community/posts'
POST_PATH = re.compile(r'/api/community/posts/([1-9][0-9]{0,17})')
LIMIT = 30

POST_FIELDS = """
    p.id, a.id AS author_id, a.name AS author, p.body, p.created_at, p.sky_view,
    (SELECT account_id FROM account_photos WHERE account_id=a.id) AS photo_id,
    COALESCE((SELECT sum(value) FROM community_votes WHERE post_id=p.id), 0) AS score,
    COALESCE((SELECT value FROM community_votes WHERE post_id=p.id AND account_id=:viewer), 0) AS vote,
    (SELECT count(*) FROM community_posts r WHERE r.parent_id=p.id) AS replies
"""


def open_community():
    db = database()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS community_posts (
            id INTEGER PRIMARY KEY, author_id TEXT NOT NULL REFERENCES accounts(id),
            parent_id INTEGER REFERENCES community_posts(id),
            body TEXT NOT NULL, created_at TEXT NOT NULL, sky_view TEXT
        );
        CREATE TABLE IF NOT EXISTS community_votes (
            post_id INTEGER REFERENCES community_posts(id), account_id TEXT REFERENCES accounts(id),
            value INTEGER NOT NULL CHECK(value IN (-1, 1)), PRIMARY KEY(post_id, account_id)
        );
        CREATE INDEX IF NOT EXISTS community_posts_parent ON community_posts(parent_id, id);
        CREATE INDEX IF NOT EXISTS community_posts_author ON community_posts(author_id, id);
    """)
    return db


def serialize(row):
    post = dict(row)
    account_id = post.pop('photo_id')
    post['avatar_url'] = photo_url(account_id) if account_id else None
    post['view'] = json.loads(post.pop('sky_view') or 'null')
    return post


def shared_view(value):
    if value is None:
        return None
    if not isinstance(value, dict):
        raise AuthError(400, 'invalid')
    bounds = {'ra': (0,360), 'dec': (-90,90), 'fov': (.00001,360), 'canal': (1,102)}
    for key, (low, high) in bounds.items():
        part = value.get(key)
        if type(part) not in (float,int) or not low <= part <= high:
            raise AuthError(400, 'invalid')
    if type(value['canal']) is not int:
        raise AuthError(400, 'invalid')
    fields = {key: value[key] for key in bounds}
    if day := value.get('data'):
        try:
            fields['data'] = date.fromisoformat(day).isoformat()
        except (ValueError, TypeError) as error:
            raise AuthError(400, 'invalid') from error
    return json.dumps(fields)


def profile_get(handler, path):
    match = re.fullmatch(r'/api/community/profile/(self|[0-9a-f]{32})', path)
    if not match:
        return False
    with closing(open_community()) as db:
        viewer = session_account(db, current_token(handler))
        account_id = viewer['id'] if match[1] == 'self' and viewer else match[1]
        own = bool(viewer and viewer['id'] == account_id)
        row = db.execute("""
            SELECT a.id, a.name, coalesce(p.bio,'') AS bio, p.cover IS NOT NULL AS has_cover,
                   f.account_id IS NOT NULL AS has_photo
            FROM accounts a LEFT JOIN account_profiles p ON p.account_id=a.id
            LEFT JOIN account_photos f ON f.account_id=a.id WHERE a.id=?
        """, (account_id,)).fetchone()
        if not row:
            if match[1] == 'self':
                auth_response(handler, {'profile': {'name': viewer['name'] if viewer else 'Visitante',
                                                                  'role': viewer['role'] if viewer else 'guest'},
                                        'own': True, 'editable': False, 'posts': [], 'replies': [], 'count': 0, 'post_count': 0})
            else:
                auth_response(handler, {'error': 'missing'}, 404)
            return True
        profile = dict(row)
        profile['avatar_url'] = photo_url(account_id) if profile.pop('has_photo') else None
        profile['cover_url'] = f'/api/auth/cover/{account_id}' if profile.pop('has_cover') else None
        counts = db.execute('SELECT count(*), count(*) FILTER (WHERE parent_id IS NULL) FROM community_posts WHERE author_id=?', (account_id,)).fetchone()
        activity = []
        for condition in ('IS NULL', 'IS NOT NULL'):
            rows = db.execute(f"""
                SELECT id, parent_id, body, created_at, sky_view FROM community_posts
                WHERE author_id=? AND parent_id {condition} ORDER BY id DESC LIMIT 30
            """, (account_id,))
            items = []
            for row in rows:
                item = dict(row)
                item['view'] = json.loads(item.pop('sky_view') or 'null')
                items.append(item)
            activity.append(items)
    auth_response(handler, {'profile': profile, 'own': own, 'editable': own,
                            'posts': activity[0], 'replies': activity[1], 'count': counts[0], 'post_count': counts[1]})
    return True


def community_get(handler, url):
    if profile_get(handler, url.path):
        return True
    match = POST_PATH.fullmatch(url.path)
    if url.path != POSTS and not match:
        return False
    query = parse_qs(url.query)
    with closing(open_community()) as db:
        account = session_account(db, current_token(handler))
        params = {'viewer': account['id'] if account else None}
        if match:
            post_id = int(match[1])
            post = db.execute(f"""
                SELECT {POST_FIELDS} FROM community_posts p JOIN accounts a ON a.id=p.author_id
                WHERE p.id=:post_id AND p.parent_id IS NULL
            """, dict(params, post_id=post_id)).fetchone()
            if not post:
                auth_response(handler, {'error': 'missing'}, 404)
                return True
            replies = db.execute(f"""
                SELECT {POST_FIELDS} FROM community_posts p JOIN accounts a ON a.id=p.author_id
                WHERE p.parent_id=:post_id ORDER BY p.id
            """, dict(params, post_id=post_id))
            result = {'post': serialize(post), 'replies': [serialize(row) for row in replies]}
        else:
            before = query.get('before', [''])[0]
            if before and not re.fullmatch(r'[1-9][0-9]{0,17}',before):
                auth_response(handler, {'error': 'invalid'},400)
                return True
            trending = query.get('sort') == ['trending']
            order = 'score DESC, replies DESC, p.id DESC' if trending else 'p.id DESC'
            cursor = db.execute(f"""
                SELECT {POST_FIELDS} FROM community_posts p JOIN accounts a ON a.id=p.author_id
                WHERE p.parent_id IS NULL AND (:before IS NULL OR p.id < :before)
                ORDER BY {order} LIMIT :limit
            """, dict(params, before=int(before) if before else None, limit=LIMIT+1))
            posts = [serialize(row) for row in cursor]
            contributors = db.execute('''
                SELECT a.id, a.name, count(*) AS contributions
                FROM community_posts p JOIN accounts a ON a.id=p.author_id
                GROUP BY a.id ORDER BY contributions DESC, a.name LIMIT 5
            ''')
            result = {'posts': posts[:LIMIT],
                      'next': posts[LIMIT-1]['id'] if len(posts)>LIMIT and not trending else None,
                      'contributors': [dict(row) for row in contributors]}
    auth_response(handler, result)
    return True


def community_vote(handler, post_id):
    try:
        body = read_same_origin_json(handler)
        vote = body.get('vote')
        if type(vote) is not int or vote not in (-1, 0, 1):
            raise AuthError(400, 'invalid')
        with closing(open_community()) as db, db:
            account = session_account(db, current_token(handler))
            if not account:
                raise AuthError(401, 'login')
            if account['role'] != 'member':
                raise AuthError(403, 'member')
            if not db.execute('SELECT 1 FROM community_posts WHERE id=?', (post_id,)).fetchone():
                raise AuthError(404, 'missing')
            if vote:
                db.execute('INSERT OR REPLACE INTO community_votes VALUES (?, ?, ?)', (post_id, account['id'], vote))
            else:
                db.execute('DELETE FROM community_votes WHERE post_id=? AND account_id=?', (post_id, account['id']))
            score = db.execute('SELECT COALESCE(sum(value), 0) FROM community_votes WHERE post_id=?', (post_id,)).fetchone()[0]
        auth_response(handler, {'score': score, 'vote': vote})
    except AuthError as error:
        auth_response(handler, {'error': error.code}, error.status)
    return True


def community_post(handler, path):
    if path.endswith('/vote') and (target := POST_PATH.fullmatch(path.removesuffix('/vote'))):
        return community_vote(handler, int(target[1]))
    match = POST_PATH.fullmatch(path)
    if path != POSTS and not match:
        return False
    try:
        body = read_same_origin_json(handler, 16384)
        message = body.get('body')
        if not isinstance(message, str) or not 1 <= len(message.strip()) <= 2000:
            raise AuthError(400, 'invalid')
        parent = int(match[1]) if match else None
        view = None if parent else shared_view(body.get('view'))
        with closing(open_community()) as db, db:
            author = session_account(db, current_token(handler))
            if not author:
                raise AuthError(401, 'login')
            if author['role'] != 'member':
                raise AuthError(403, 'member')
            if parent and not db.execute(
                'SELECT 1 FROM community_posts WHERE id=? AND parent_id IS NULL', (parent,)
            ).fetchone():
                raise AuthError(404, 'missing')
            post_id = db.execute("""
                INSERT INTO community_posts (author_id,parent_id,body,created_at,sky_view)
                VALUES (?,?,?,?,?)
            """, (author['id'],parent,message.strip(),datetime.now(timezone.utc).isoformat(),view)).lastrowid
        auth_response(handler, {'id': post_id},201)
    except AuthError as error:
        auth_response(handler, {'error': error.code},error.status)
    return True
