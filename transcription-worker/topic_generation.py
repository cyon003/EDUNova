"""Deterministic segmentation and extractive titles; no generative model."""
import math
import re
from collections import Counter
import numpy as np

ALGORITHM_VERSION = 'semantic-windows-v2'
PARAMETERS = {'windowSeconds': 25, 'maxWindowWords': 90, 'minTopicSeconds': 60,
              'absoluteDistanceThreshold': 0.22, 'maxTopics': 50}
STOP = set('a an the and or but if then else to of in on at for from with as by is are was were be been being it its this that these those i we you they he she my our your their have has had do does did can could will would shall should may might must not no so just now here there let us see say said like okay ok yes also already only some any each all how what when where why which who than very more most such about into using use used get got going right one two three first next thing things time times value values um uh er hmm'.split())
# Discourse verbs otherwise outrank subject phrases in spoken lectures.
STOP.difference_update({'time', 'times', 'value', 'values'})
STOP.update("able cannot don't doesn't didn't it's that's there's let's i'm you're we're they're know knows want wants take takes taken taking much really simply suppose whatever whether means mean need needs understood understand tell shown show saying instead even again usually also doing done something purpose hope look looking".split())
STOP.update({'represent', 'represents', 'them', 'his', 'every', 'other'})
CONNECTORS = {'of', 'for', 'in', 'a', 'an', 'the'}
NOISE = re.compile(r'\[(?:music|applause|noise|silence|inaudible)[^\]]*\]|\((?:music|applause|noise|silence|inaudible)[^)]*\)', re.I)


class TranscriptError(ValueError):
    pass


def clean_text(text):
    return ' '.join(NOISE.sub(' ', text).split())


def windows_from_segments(segments):
    windows, bucket, words, previous = [], [], 0, 0.0
    for segment in segments:
        if not isinstance(segment, dict) or not isinstance(segment.get('text'), str):
            raise TranscriptError('invalid_transcript_text')
        start, end = segment.get('startTimeSeconds'), segment.get('endTimeSeconds')
        if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in (start, end)) or start < previous or end <= start or end > 86400:
            raise TranscriptError('invalid_transcript_ranges')
        previous = end
        text = clean_text(segment['text'])
        tokens = re.findall(r"[a-zA-Z][a-zA-Z'-]+", text.lower())
        if not any(word not in STOP for word in tokens):
            continue
        # Bound tokenizer truncation; preserve segment timing even if text is unusual.
        text = ' '.join(text.split()[:PARAMETERS['maxWindowWords']])
        if bucket and (end - bucket[0]['startTimeSeconds'] > PARAMETERS['windowSeconds'] or words + len(text.split()) > PARAMETERS['maxWindowWords']):
            windows.append({'start': bucket[0]['startTimeSeconds'], 'end': bucket[-1]['endTimeSeconds'], 'text': ' '.join(s['text'] for s in bucket)})
            bucket, words = [], 0
        bucket.append({**segment, 'text': text})
        words += len(text.split())
    if bucket:
        windows.append({'start': bucket[0]['startTimeSeconds'], 'end': bucket[-1]['endTimeSeconds'], 'text': ' '.join(s['text'] for s in bucket)})
    return windows


def phrases(text):
    tokens = re.findall(r"[a-zA-Z][a-zA-Z'-]*|[.!?,;:]", text.lower())
    counts = Counter()
    for offset in range(len(tokens)):
        for size in range(1, 6):
            phrase = tuple(tokens[offset:offset+size])
            if len(phrase) != size or phrase[0] in STOP or phrase[-1] in STOP:
                continue
            if any(not token[0].isalpha() or (token in STOP and token not in CONNECTORS) for token in phrase):
                continue
            content = [token for token in phrase if token not in CONNECTORS]
            if len(content) <= 3 and len(set(content)) == len(content):
                counts[phrase] += 1
    return counts


def titles_for(texts, model=None, topic_vectors=None):
    bags = [phrases(text) for text in texts]
    frequency = Counter(phrase for bag in bags for phrase in bag)
    titles = []
    for bag in bags:
        ranked = sorted(bag, key=lambda phrase: (
            -(1 + math.log(bag[phrase])) * len(phrase) ** 0.7 * (1 + math.log((len(bags)+1)/(frequency[phrase]+1))),
            -len(phrase), phrase))
        if model is not None and ranked:
            # Bounded, extractive reranking with the same local encoder. This
            # favors phrases representative of the entire topic over speech filler.
            ranked = ranked[:64]
            encoded = np.asarray(model.encode([' '.join(p) for p in ranked], batch_size=16,
                normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False), dtype=float)
            if encoded.shape != (len(ranked), len(topic_vectors[len(titles)])) or not np.isfinite(encoded).all():
                raise RuntimeError('invalid_title_embeddings')
            norms = np.linalg.norm(encoded, axis=1)
            if np.any(norms == 0):
                raise RuntimeError('zero_title_embedding')
            encoded = encoded / norms[:, None]
            scores = encoded @ topic_vectors[len(titles)]
            relevance = dict(zip(ranked, scores))
            ranked.sort(key=lambda p: (-(relevance[p] + 0.06*math.log(bag[p]) + 0.02*min(2, len(p))), p))
        selected = []
        for phrase in ranked:
            if not selected or not set(phrase).intersection(selected[0]):
                selected.append(phrase)
            if len(selected) == 2:
                break
        titles.append(' — '.join(' '.join(p).capitalize() for p in selected)[:200] or 'Lecture overview')
    return titles


def generate_topics(segments, model):
    windows = windows_from_segments(segments)
    if not windows:
        return [], {'reason': 'no_usable_speech', 'windowCount': 0}
    embeddings = np.asarray(model.encode([w['text'] for w in windows], batch_size=16,
        normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False), dtype=float)
    if embeddings.ndim != 2 or embeddings.shape[0] != len(windows) or embeddings.shape[1] == 0 or not np.isfinite(embeddings).all():
        raise RuntimeError('invalid_embeddings')
    norms = np.linalg.norm(embeddings, axis=1)
    if np.any(norms == 0):
        raise RuntimeError('zero_embedding')
    embeddings = embeddings / norms[:, None]
    def center(items):
        value = items.mean(axis=0)
        norm = np.linalg.norm(value)
        if norm == 0:
            raise RuntimeError('zero_embedding')
        return value / norm
    distances = [float(1 - np.clip(np.dot(center(embeddings[max(0, i-2):i]), center(embeddings[i:i+2])), -1, 1)) for i in range(1, len(windows))]
    threshold = max(PARAMETERS['absoluteDistanceThreshold'], float(np.median(distances) + 0.5*np.std(distances))) if distances else 1
    duration = windows[-1]['end'] - windows[0]['start']
    max_topics = min(PARAMETERS['maxTopics'], max(1, int(duration // PARAMETERS['minTopicSeconds'])))
    candidates = [i for i in range(1, len(windows)) if distances[i-1] > threshold and distances[i-1] >= max(distances[max(0, i-2):min(len(distances), i+1)])]
    cuts = [0, len(windows)]
    # Strongest transitions win; minimum duration on BOTH sides prevents fragments.
    for i in sorted(candidates, key=lambda i: (-distances[i-1], i)):
        if len(cuts)-1 >= max_topics:
            break
        left = max(c for c in cuts if c < i)
        right = min(c for c in cuts if c > i)
        start = windows[left]['start']
        end = windows[right]['start'] if right < len(windows) else windows[-1]['end']
        if min(windows[i]['start']-start, end-windows[i]['start']) >= PARAMETERS['minTopicSeconds']:
            cuts.append(i)
    cuts.sort()
    texts = [' '.join(w['text'] for w in windows[a:b]) for a, b in zip(cuts, cuts[1:])]
    titles = titles_for(texts, model, [center(embeddings[a:b]) for a, b in zip(cuts, cuts[1:])])
    topics = [{'title': title, 'startTimeSeconds': windows[a]['start'],
               'endTimeSeconds': windows[b]['start'] if b < len(windows) else windows[-1]['end']}
              for title, a, b in zip(titles, cuts, cuts[1:])]
    return topics, {'windowCount': len(windows), 'threshold': threshold,
                    'boundaries': [{'time': windows[i]['start'], 'distance': distances[i-1]} for i in cuts[1:-1]]}
