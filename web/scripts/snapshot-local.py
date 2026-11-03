"""Run from the source repository root. Read Git metadata, never file bodies."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repository', default='Annan-lyn/fudan-exam-paper', help='GitHub owner/repo containing this commit; forks must pass their own repository')
args = parser.parse_args()
repo = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
sha = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
raw = subprocess.check_output(['git', '-C', str(repo), 'ls-tree', '-r', '-l', '-z', sha])
entries = []
for item in raw.split(b'\0'):
    if not item:
        continue
    meta, name = item.split(b'\t', 1)
    mode, kind, oid, size = meta.decode().split()
    name = name.decode('utf-8')
    if name.split('/')[0] in {'web', '.github'}:
        continue
    entries.append({'path': name, 'type': kind, 'size': int(size) if size != '-' else 0})
target = Path(__file__).resolve().parent.parent / 'data' / 'tree.json'
target.write_text(json.dumps({'repository': args.repository, 'sha': sha, 'truncated': False, 'tree': entries}, ensure_ascii=False), encoding='utf-8')
print(f'Written {len(entries)} Git entries at {sha[:7]} to {target}')
