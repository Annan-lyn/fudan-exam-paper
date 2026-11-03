import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('snapshot', Path(__file__).resolve().parents[1] / 'scripts/snapshot-remote.py')
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


class SnapshotTest(unittest.TestCase):
    def test_commit_and_tree_are_distinct(self):
        commit_sha, tree_sha = 'a' * 40, 'b' * 40
        calls = []

        def fetch(url, token):
            calls.append(url)
            if '/commits/' in url:
                return {'sha': commit_sha, 'commit': {'tree': {'sha': tree_sha}}}
            return {'sha': tree_sha, 'truncated': False, 'tree': [
                {'path': '数学-线性代数/统考/2022.pdf', 'type': 'blob', 'size': 1024, 'url': 'ignored'}]}

        result = snapshot.get_snapshot('owner/repo', commit_sha, fetch=fetch)
        self.assertEqual(result['sha'], commit_sha)
        self.assertEqual(result['treeSha'], tree_sha)
        self.assertIn(tree_sha, calls[1])
        self.assertEqual(result['repository'], 'owner/repo')
        self.assertNotIn('url', result['tree'][0])

    def test_partial_tree_is_rejected(self):
        sha = 'a' * 40
        def fetch(url, token):
            if '/commits/' in url:
                return {'sha': sha, 'commit': {'tree': {'sha': sha}}}
            return {'sha': sha, 'truncated': True, 'tree': []}
        with self.assertRaises(ValueError):
            snapshot.get_snapshot('owner/repo', sha, fetch=fetch)

    def test_invalid_input_is_rejected_before_network(self):
        for repo, sha in [('invalid', 'a'*40), ('owner/repo', 'main')]:
            with self.assertRaises(ValueError):
                snapshot.get_snapshot(repo, sha, fetch=lambda *_: self.fail('No network expected'))


if __name__ == '__main__':
    unittest.main()
