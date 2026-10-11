"""THE COPIES OF THE BARNWRIGHT TERMS THIS DEALER CENTER HAS
(docs/legal/terms-sha256.json; docs/OFFICE.md, "Before the owner first signs in").

An owner agrees to the terms on the Control Room's sign-up page, which shows
docs/legal/terms.json; the Control Room keeps the SHA-256 of the exact bytes
it showed. Until the owner first signs in, their Dealer Center takes that
agreement for Barnwright's setup access only when it is to terms it has: the
version it ships, or one of the copies listed here.

  {"versions": {"2.2": ["<64 lowercase hex>", ...]}}

make-legal-pdfs.py calls add() each time it writes docs/legal/terms.json:
the SHA-256 of those bytes is added under their version when the version is
2.2 or later. Nothing is ever taken away, so an owner who signed up under an
earlier wording of the same version still counts.

Run on its own:  python3 tools/legal/terms_sha256.py
adds docs/legal/terms.json as it is now, the same as the script does.
Needs nothing but Python."""

import hashlib, json, os, re

FIRST = (2, 2)   # the first terms a sign-up agreement can count for


def version_at_least(version, need=FIRST):
    """"2.2" or later, numbers compared as numbers ("2.10" is later than "2.9")."""
    if not isinstance(version, str) or not re.fullmatch(r"\d{1,4}(\.\d{1,4}){0,3}", version):
        return False
    a = [int(x) for x in version.split(".")]
    n = max(len(a), len(need))
    a += [0] * (n - len(a))
    b = list(need) + [0] * (n - len(need))
    return a >= b


def add(sha_path, version, terms_bytes):
    """Add the SHA-256 of terms_bytes under version (2.2 or later only) and
    write sha_path again: versions in number order, each list in the order
    added, never anything removed. -> the file's value."""
    try:
        with open(sha_path, encoding="utf-8") as f:
            kept = json.load(f)
    except FileNotFoundError:
        kept = {"versions": {}}
    versions = kept.get("versions") if isinstance(kept, dict) else None
    versions = versions if isinstance(versions, dict) else {}
    if version_at_least(version):
        digest = hashlib.sha256(terms_bytes).hexdigest()
        copies = versions.setdefault(version, [])
        if digest not in copies:
            copies.append(digest)
    ordered = {v: versions[v] for v in sorted(versions, key=lambda v: [int(x) for x in v.split(".")])}
    value = {"versions": ordered}
    with open(sha_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    return value


if __name__ == "__main__":
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    terms_path = os.path.join(root, "docs", "legal", "terms.json")
    with open(terms_path, "rb") as f:
        terms_bytes = f.read()
    version = json.loads(terms_bytes.decode("utf-8"))["version"]
    print(json.dumps(add(os.path.join(root, "docs", "legal", "terms-sha256.json"), version, terms_bytes), indent=2))
