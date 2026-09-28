"""Explicit online provisioning only; never imported by an inference worker."""
import argparse
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--revision', default='main')
    args = parser.parse_args()
    repo = 'sentence-transformers/all-MiniLM-L6-v2'
    revision = HfApi().model_info(repo, revision=args.revision).sha
    folder = args.directory.resolve()
    snapshot_download(repo_id=repo, revision=revision, local_dir=str(folder),
                      allow_patterns=['*.json', '*.txt', 'model.safetensors', '1_Pooling/*'])
    (folder / 'REVISION').write_text(revision + '\n')
    print(f'Provisioned {folder} at {revision}')


if __name__ == '__main__':
    main()
