"""Minimal ChatCut MCP client (OAuth 2.0 DCR + PKCE, streamable HTTP).

Usage:
  python3 chatcut_mcp.py login            -> prints the authorization URL
  python3 chatcut_mcp.py finish <url|code> -> exchanges the code for tokens
  python3 chatcut_mcp.py tools            -> lists tools
  python3 chatcut_mcp.py call <tool> '<json args>'
Tokens are stored outside the repo (CHATCUT_STATE, default ~/.chatcut_state.json).
"""
import base64, hashlib, json, os, secrets, sys, time, urllib.parse
import urllib.request

API = "https://api.chatcut.io"
MCP_URL = API + "/api/external-mcp/mcp"
REDIRECT = "http://localhost:53682/callback"
STATE_FILE = os.environ.get("CHATCUT_STATE", os.path.expanduser("~/.chatcut_state.json"))
HEADERS = {"x-chatcut-mcp-client": "claude_code", "x-chatcut-mcp-surface": "embedded-preview"}


def _load():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def _save(st):
    with open(STATE_FILE, "w") as f:
        json.dump(st, f, indent=1)
    os.chmod(STATE_FILE, 0o600)


def _post(url, data, headers=None, form=False):
    body = urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()
    h = {"content-type": "application/x-www-form-urlencoded" if form else "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=body, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode()


def login():
    st = _load()
    if "client_id" not in st:
        code, _, body = _post(API + "/auth/mcp/register", {
            "client_name": "Claude Code (ChatCut)",
            "redirect_uris": [REDIRECT],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
            "scope": "openid profile email offline_access",
        })
        if code >= 300:
            sys.exit(f"register failed {code}: {body}")
        st["client_id"] = json.loads(body)["client_id"]
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    st["verifier"], st["state"] = verifier, secrets.token_urlsafe(16)
    _save(st)
    q = {
        "response_type": "code", "client_id": st["client_id"], "redirect_uri": REDIRECT,
        "scope": "openid profile email offline_access", "state": st["state"],
        "code_challenge": challenge, "code_challenge_method": "S256", "resource": MCP_URL,
    }
    print(API + "/auth/mcp/authorize?" + urllib.parse.urlencode(q))


def _token_request(data):
    st = _load()
    data.update({"client_id": st["client_id"], "resource": MCP_URL})
    code, _, body = _post(API + "/auth/mcp/token", data, form=True)
    if code >= 300:
        sys.exit(f"token failed {code}: {body}")
    tok = json.loads(body)
    st["access_token"] = tok["access_token"]
    if tok.get("refresh_token"):
        st["refresh_token"] = tok["refresh_token"]
    st["expires_at"] = time.time() + int(tok.get("expires_in", 3600)) - 60
    _save(st)
    return st


def finish(arg):
    st = _load()
    code = arg
    if arg.startswith("http"):
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(arg).query)
        if qs.get("state", [st.get("state")])[0] != st.get("state"):
            sys.exit("state mismatch")
        code = qs["code"][0]
    _token_request({"grant_type": "authorization_code", "code": code,
                    "redirect_uri": REDIRECT, "code_verifier": st["verifier"]})
    print("authenticated")


def _auth_header():
    st = _load()
    if os.environ.get("CHATCUT_API_KEY"):
        return "Bearer " + os.environ["CHATCUT_API_KEY"]
    if st.get("expires_at", 0) < time.time() and st.get("refresh_token"):
        st = _token_request({"grant_type": "refresh_token", "refresh_token": st["refresh_token"]})
    return "Bearer " + st["access_token"]


class Session:
    def __init__(self):
        self.sid = None
        self.n = 0
        r = self.rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                    "clientInfo": {"name": "claude-code-chatcut", "version": "1.0"}})
        self.server = r
        self.notify("notifications/initialized")

    def _send(self, payload):
        h = {"authorization": _auth_header(), "accept": "application/json, text/event-stream",
             "mcp-protocol-version": "2025-06-18", **HEADERS}
        if self.sid:
            h["mcp-session-id"] = self.sid
        code, hdrs, body = _post(MCP_URL, payload, h)
        hdrs = {k.lower(): v for k, v in hdrs.items()}
        if "mcp-session-id" in hdrs:
            self.sid = hdrs["mcp-session-id"]
        if code >= 300 and code != 202:
            raise RuntimeError(f"HTTP {code}: {body[:2000]}")
        if "text/event-stream" in hdrs.get("content-type", ""):
            msgs = [json.loads(l[5:]) for l in body.splitlines() if l.startswith("data:") and l[5:].strip()]
            for m in msgs:
                if "id" in m and m.get("id") == payload.get("id"):
                    return m
            return msgs[-1] if msgs else None
        return json.loads(body) if body.strip() else None

    def rpc(self, method, params=None):
        self.n += 1
        m = self._send({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params or {}})
        if m and "error" in m:
            raise RuntimeError(json.dumps(m["error"]))
        return m.get("result") if m else None

    def notify(self, method, params=None):
        self._send({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def tools(self):
        out, cursor = [], None
        while True:
            r = self.rpc("tools/list", {"cursor": cursor} if cursor else {})
            out += r.get("tools", [])
            cursor = r.get("nextCursor")
            if not cursor:
                return out

    def call(self, name, args):
        return self.rpc("tools/call", {"name": name, "arguments": args})


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "login":
        login()
    elif cmd == "finish":
        finish(sys.argv[2])
    elif cmd == "tools":
        s = Session()
        for t in s.tools():
            print(json.dumps(t) if "-v" in sys.argv else f"{t['name']}: {t.get('description','')[:150]}")
    elif cmd == "call":
        s = Session()
        print(json.dumps(s.call(sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}), indent=1, ensure_ascii=False))
