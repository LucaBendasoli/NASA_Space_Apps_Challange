"""Email accounts and sessions for the public Eyelid explorer."""
from contextlib import closing
import base64
import binascii
import hashlib
import hmac
from http.cookies import CookieError, SimpleCookie
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
from threading import BoundedSemaphore
import time
from urllib.parse import urlsplit

DATABASE = Path(os.environ.get('EYELID_ACCOUNTS_DB', Path(__file__).parent / '.eyelid' / 'accounts.sqlite3'))
COOKIE = 'eyelid_session'
LIFETIME = 7 * 86400
JUDGE = {'id': 'jury-demo', 'name': 'Jurado', 'role': 'judge'}
HASH_SLOTS = BoundedSemaphore(2)


class AuthError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


def database():
    DATABASE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.close(os.open(DATABASE, os.O_CREAT | os.O_WRONLY, 0o600))
    db = sqlite3.connect(DATABASE, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    db.executescript("""
        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
            salt BLOB NOT NULL, password_hash BLOB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS account_photos (
            account_id TEXT PRIMARY KEY REFERENCES accounts(id), jpeg BLOB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, account_id TEXT REFERENCES accounts(id),
            expires INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
        CREATE TABLE IF NOT EXISTS auth_attempts (
            action TEXT NOT NULL, email TEXT NOT NULL, window INTEGER NOT NULL,
            count INTEGER NOT NULL, PRIMARY KEY(action, email)
        );
    """)
    return db


def password_hash(password, salt):
    if not HASH_SLOTS.acquire(blocking=False):
        raise AuthError(429, 'retry')
    try:
        return hashlib.scrypt(password.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=160*1024**2)
    finally:
        HASH_SLOTS.release()


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current_token(handler):
    try:
        cookie = SimpleCookie(handler.headers.get('Cookie', ''))
        value = cookie.get(COOKIE)
    except CookieError:
        return None
    if value and re.fullmatch(r'[\w-]{43}', value.value, flags=re.ASCII):
        return token_hash(value.value)
    return None


def photo_url(account_id):
    return f'/api/auth/photo/{account_id}'


def public_account(db, row):
    account = {'id': row['id'], 'name': row['name'], 'email': row['email'], 'role': 'member'}
    if db.execute('SELECT 1 FROM account_photos WHERE account_id=?', (row['id'],)).fetchone():
        account['avatar_url'] = photo_url(row['id'])
    return account


def session_account(db, token):
    if not token:
        return None
    row = db.execute("""
        SELECT sessions.account_id, accounts.id, accounts.name, accounts.email
        FROM sessions LEFT JOIN accounts ON accounts.id = sessions.account_id
        WHERE token_hash = ? AND expires > ?
    """, (token, int(time.time()))).fetchone()
    if row:
        return public_account(db, row) if row['account_id'] else JUDGE
    return None


def start_session(db, account, previous):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    db.execute('DELETE FROM sessions WHERE expires <= ? OR token_hash = ?', (now, previous))
    account_id = account['id'] if account['role'] == 'member' else None
    db.execute('INSERT INTO sessions VALUES (?, ?, ?)', (token_hash(token), account_id, now + LIFETIME))
    return token


def throttle(db, action, email):
    window = int(time.time()) // 300
    with db:
        db.execute('DELETE FROM auth_attempts WHERE window < ?', (window,))
        db.execute("""
            INSERT INTO auth_attempts VALUES (?, ?, ?, 1)
            ON CONFLICT(action,email) DO UPDATE SET count=count+1
        """, (action, email, window))
        count = db.execute('SELECT count FROM auth_attempts WHERE action=? AND email=?', (action,email)).fetchone()[0]
    if count > 10:
        raise AuthError(429, 'retry')


def authenticate(db, action, body):
    email = body.get('email')
    password = body.get('password')
    if not isinstance(email, str) or not isinstance(password, str):
        raise AuthError(400, 'invalid')
    email = email.strip().casefold()
    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or not 1 <= len(password) <= 128:
        raise AuthError(400, 'invalid')
    throttle(db, action, email)
    if action == 'register':
        name = body.get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60 or len(password) < 8:
            raise AuthError(400, 'invalid')
        salt = secrets.token_bytes(16)
        digest = password_hash(password, salt)
        account = {'id': secrets.token_hex(16), 'name': name.strip(), 'email': email, 'role': 'member'}
        try:
            db.execute('INSERT INTO accounts VALUES (?, ?, ?, ?, ?)',
                       (account['id'], account['name'], email, salt, digest))
        except sqlite3.IntegrityError as error:
            raise AuthError(409, 'exists') from error
        return account
    row = db.execute('SELECT * FROM accounts WHERE email = ?', (email,)).fetchone()
    digest = password_hash(password, row['salt'] if row else bytes(16))
    if not row or not hmac.compare_digest(row['password_hash'], digest):
        raise AuthError(401, 'credentials')
    return public_account(db, row)


def auth_response(handler, body, status=200, token=None):
    content = json.dumps(body, ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header('Cache-Control', 'no-store')
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(content)))
    if token is not None:
        secure = '' if re.fullmatch(r'(localhost|127\.0\.0\.1|\[::1\])(:\d+)?',
                                    handler.headers.get('Host', '')) else '; Secure'
        handler.send_header('Set-Cookie', f'{COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={LIFETIME if token else 0}{secure}')
    handler.end_headers()
    handler.wfile.write(content)


def auth_get(handler, path):
    if path in ('/jurados', '/jurados/'):
        handler.send_response(303)
        handler.send_header('Location', '/?acesso=jurados')
        handler.send_header('Cache-Control', 'no-store')
        handler.send_header('Content-Length', '0')
        handler.end_headers()
        return True
    if match := re.fullmatch(r'/api/auth/photo/([0-9a-f]{32})', path):
        with closing(database()) as db:
            row = db.execute('SELECT jpeg FROM account_photos WHERE account_id=?', (match[1],)).fetchone()
        if not row:
            auth_response(handler, {'error': 'missing'}, 404)
            return True
        jpeg = row['jpeg']
        handler.send_response(200)
        handler.send_header('Content-Type', 'image/jpeg')
        handler.send_header('X-Content-Type-Options', 'nosniff')
        handler.send_header('Cache-Control', 'no-cache')
        handler.send_header('Content-Length', str(len(jpeg)))
        handler.end_headers()
        handler.wfile.write(jpeg)
        return True
    if path != '/api/auth/session':
        return False
    token = current_token(handler)
    if not token:
        auth_response(handler, {'user': None})
    else:
        with closing(database()) as db:
            auth_response(handler, {'user': session_account(db, token)})
    return True


def read_same_origin_json(handler, max_bytes=4096):
    try:
        origin = urlsplit(handler.headers.get('Origin', ''))
    except ValueError as error:
        raise AuthError(403, 'origin') from error
    if origin.scheme not in ('http', 'https') or origin.netloc != handler.headers.get('Host'):
        raise AuthError(403, 'origin')
    try:
        length = int(handler.headers.get('Content-Length', '0'))
        if not 0 < length <= max_bytes or handler.headers.get_content_type() != 'application/json':
            raise ValueError()
        body = json.loads(handler.rfile.read(length))
        if not isinstance(body, dict):
            raise ValueError()
    except (ValueError, UnicodeError) as error:
        raise AuthError(400, 'invalid') from error
    return body


def update_photo(db, account, body):
    if not account:
        raise AuthError(401, 'login')
    if account['role'] != 'member':
        raise AuthError(403, 'member')
    photo = body.get('photo')
    if photo is None:
        db.execute('DELETE FROM account_photos WHERE account_id=?', (account['id'],))
        account.pop('avatar_url', None)
        return
    try:
        jpeg = base64.b64decode(photo, validate=True)
    except (ValueError, TypeError, binascii.Error) as error:
        raise AuthError(400, 'invalid') from error
    if not 4 < len(jpeg) <= 32768 or not jpeg.startswith(b'\xff\xd8\xff') or not jpeg.endswith(b'\xff\xd9'):
        raise AuthError(400, 'invalid')
    db.execute('INSERT OR REPLACE INTO account_photos VALUES (?, ?)', (account['id'], jpeg))
    account['avatar_url'] = photo_url(account['id'])


def auth_post(handler, path):
    action = path.removeprefix('/api/auth/')
    if action not in ('register', 'login', 'judge', 'logout', 'photo') or path != '/api/auth/' + action:
        return False
    try:
        body = read_same_origin_json(handler, 45000 if action == 'photo' else 4096)
        previous = current_token(handler)
        with closing(database()) as db, db:
            if action == 'logout':
                db.execute('DELETE FROM sessions WHERE token_hash = ?', (previous,))
                account, token = None, ''
            elif action == 'photo':
                account, token = session_account(db, previous), None
                update_photo(db, account, body)
            else:
                account = JUDGE if action == 'judge' else authenticate(db, action, body)
                token = start_session(db, account, previous)
        auth_response(handler, {'user': account}, 201 if action == 'register' else 200, token)
    except AuthError as error:
        auth_response(handler, {'error': error.code}, error.status)
    return True
