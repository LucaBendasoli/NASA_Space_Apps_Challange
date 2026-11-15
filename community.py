"""Public discussions written by individual Eyelid accounts."""
from contextlib import closing
from datetime import date, datetime, timezone
import json
import re
from urllib.parse import parse_qs

from accounts import AuthError, auth_response, current_token, database, read_same_origin_json, session_account

POSTS = '/api/community/posts'
POST_PATH = re.compile(r'/api/community/posts/([1-9][0-9]{0,17})')
LIMIT = 30

POST_FIELDS = """
    p.id, a.name AS author, p.body, p.created_at, p.sky_view,
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
        CREATE INDEX IF NOT EXISTS community_posts_parent ON community_posts(parent_id, id);
    """)
    return db


def serialize(row):
    post = dict(row)
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


def community_get(handler, url):
    match = POST_PATH.fullmatch(url.path)
    if url.path != POSTS and not match:
        return False
    query = parse_qs(url.query)
    with closing(open_community()) as db:
        if match:
            post_id = int(match[1])
            post = db.execute(f"""
                SELECT {POST_FIELDS} FROM community_posts p JOIN accounts a ON a.id=p.author_id
                WHERE p.id=? AND p.parent_id IS NULL
            """, (post_id,)).fetchone()
            if not post:
                auth_response(handler, {'error': 'missing'}, 404)
                return True
            replies = db.execute(f"""
                SELECT {POST_FIELDS} FROM community_posts p JOIN accounts a ON a.id=p.author_id
                WHERE p.parent_id=? ORDER BY p.id
            """, (post_id,))
            result = {'post': serialize(post), 'replies': [serialize(row) for row in replies]}
        else:
            before = query.get('before', [''])[0]
            if before and not re.fullmatch(r'[1-9][0-9]{0,17}',before):
                auth_response(handler, {'error': 'invalid'},400)
                return True
            trending = query.get('sort') == ['trending']
            order = 'replies DESC, p.id DESC' if trending else 'p.id DESC'
            cursor = db.execute(f"""
                SELECT {POST_FIELDS} FROM community_posts p JOIN accounts a ON a.id=p.author_id
                WHERE p.parent_id IS NULL AND (? IS NULL OR p.id < ?)
                ORDER BY {order} LIMIT ?
            """, (int(before) if before else None, int(before) if before else None, LIMIT+1))
            posts = [serialize(row) for row in cursor]
            contributors = db.execute('''
                SELECT a.name, count(*) AS contributions
                FROM community_posts p JOIN accounts a ON a.id=p.author_id
                GROUP BY a.id ORDER BY contributions DESC, a.name LIMIT 5
            ''')
            result = {'posts': posts[:LIMIT],
                      'next': posts[LIMIT-1]['id'] if len(posts)>LIMIT and not trending else None,
                      'contributors': [dict(row) for row in contributors]}
    auth_response(handler, result)
    return True


def community_post(handler, path):
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
