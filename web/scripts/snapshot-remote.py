"""Fetch repository metadata for one commit, without downloading paper bodies."""
import json
import os
import re
import urllib.request
from pathlib import Path


def fetch_json(url, token):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'fudan-exam-index'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        return json.load(response)


def get_snapshot(repository, commit_sha, token='', fetch=fetch_json):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid repository')
    if not re.fullmatch(r'[a-f0-9]{40}', commit_sha):
        raise ValueError('Expected a full commit SHA')
    base = f'https://api.github.com/repos/{repository}'
    commit = fetch(f'{base}/commits/{commit_sha}', token)
    if commit['sha'] != commit_sha:
        raise ValueError('Resolved commit does not match the requested commit')
    tree_sha = commit['commit']['tree']['sha']
    tree = fetch(f'{base}/git/trees/{tree_sha}?recursive=1', token)
    if tree.get('sha') != tree_sha:
        raise ValueError('Tree does not match the requested commit')
    if tree.get('truncated') or not isinstance(tree.get('tree'), list):
        raise ValueError('Repository tree is incomplete; refusing to publish a partial index')
    # Git tree SHA is NOT a commit SHA. File links must use the resolved commit.
    return {'repository': repository, 'sha': commit['sha'], 'treeSha': tree['sha'],
                'truncated': False, 'tree': [
                    {k: entry[k] for k in ('path', 'type', 'size') if k in entry}
                    for entry in tree['tree']
                ]}


def main():
    snapshot = get_snapshot(os.environ['GITHUB_REPOSITORY'], os.environ['GITHUB_SHA'], os.environ.get('GH_TOKEN', ''))
    target = Path(__file__).resolve().parent.parent / 'data' / 'tree.json'
    target.write_text(json.dumps(snapshot, ensure_ascii=False), encoding='utf-8')
    print(f"Indexed {len(snapshot['tree'])} paths at {snapshot['repository']}@{snapshot['sha'][:7]}")


if __name__ == '__main__':
    main()
