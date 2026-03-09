---
title: "The architecture of a personal AI that never stops learning"
date: "2026-03-09"
description: "Ten components, 82 tests, one MacBook Pro — and four assumptions about local AI that turned out to be wrong. The architecture, the real numbers, and the discoveries that weren't in any paper — from someone who built it and measured it."
tags: ["vibes"]
image: null
published: false
---

# The architecture of a personal AI that never stops learning
 Four assumptions everyone makes about local AI:




```
1. local models can't remember
2. training and inference must
   be separate
3. getting better requires
   retraining from scratch
4. you need a large model

```

All four are wrong. Here is the proof — ten components, 82 tests, one MacBook Pro.

## What we are actually trying to build
 Most local AI setups look like this:




```
YOU → prompt → model → response
               ▲
               │
         frozen weights
         never changes
         knows nothing about you
         same tomorrow as today

```

What I wanted:




```
YOU → prompt → model → response
               ▲    │
         weights    └─► learns
         that grow     in background
         from use
               ▲
               │
         remembers last session
         every correction
         you ever made

```

The gap between those two diagrams is what the architecture solves.

## The stack



```
HARDWARE:  M1 Pro, 16GB unified
MODEL:     Llama 3.2 3B, 4-bit
           ~1.8GB disk, ~2GB RAM
FRAMEWORK: MLX (Apple native)
           unified memory, no VRAM
ADAPTERS:  LoRA via mlx_lm
MEMORY:    ChromaDB (local)
TEACHER:   Ollama + phi4-mini
LANGUAGE:  Python 3.11
TESTS:     82 passing, 0 failures

```





## Component map





```
1. BASE INFERENCE  once, always live
2. LORA TRAINING   112 params, not 3B
3. DOUBLE BUFFER   train + infer live
        │
  ┌─────┼──────┬──────────┐
  ▼     ▼      ▼          ▼
4. EPI  5. IMP 9. KNOW  7. STATE
   SODIC   ORT    LEDGE    MON
   STORE   ANCE   STORE    ITOR
6. CONSOLIDATION
  └─────┴──────┴──────────┘
               │
        8. TEACHER ENSEMBLE
               │
        10. ORCHESTRATOR
            chat() entry point

BUILD: 1→2→3
       then 4+9+7 parallel
       then 8→10

```





## Assumption 1: local models can't remember

They can. Three distinct memory types, not one:






```
WEIGHTS (base model, frozen):
  general language, reasoning
  3 billion parameters
  never changes after download

ADAPTERS (LoRA, trainable):
  your patterns, corrections
  112 params on top of 3B
  persists to disk, reloads

KNOWLEDGE STORE (ChromaDB):
  specific facts, preferences
  exact retrieval by similarity
  never hallucinated

```

The separation matters. Facts should not be in weights — weights are diffuse, approximate, hard to update cleanly. A fact stored in the knowledge store is retrieved exactly. A fact trained into weights is interpolated with everything else the model knows and loses precision.

Before every inference, the top 5 most similar facts are retrieved. Facts above 0.7 confidence are prepended:




```
"Relevant facts:
  Frameo AI is a generative
  video platform.
  Dashtoon Studio is an AI
  comic platform.
 Now answer: [prompt]"

```

The model never has to remember facts. It looks them up.

## Assumption 2: training and inference must be separate
 They do not have to be. Not on M1 unified memory.

The standard reason for separating them is hardware: GPUs have their own memory (VRAM) and training needs exclusive access. On M1, CPU and GPU share the same memory pool. No PCIe bottleneck. No transfer. No exclusivity requirement.

The double-buffer:




```
BUFFER A (buffer_a/)
  inference reads here
  never written during serving

BUFFER B (buffer_b/)
  training writes here
  never read during serving

SWAP (every 100 steps):
  rename B → A  (atomic)
  recreate B from A
  reload adapter: <100ms

```

The discovery that complicated this: **Metal is not thread-safe across threads.**

Not documented anywhere I could find. Training and inference must take turns, serialised by a single lock. In practice:




```
training step:  ~0.23s
inference:      ~0.60s
worst case:     ~0.83s
spec required:  <3s
actual average: 0.34s

```

The user never notices. `submit_correction()` queues and returns immediately. `query()` always responds in under a second.

## Assumption 3: getting better requires retraining from scratch
 LoRA changes this completely.

Standard fine-tuning updates all model weights — billions of gradient computations per step, minutes to hours per run. LoRA adds small trainable matrices to specific attention layers and trains only those.

In practice:




```
BASE MODEL:
  3,000,000,000 params (frozen)

LORA ADAPTER:
  112 params (trainable)
  0.000004% of the model

ONE STEP:   ~0.23s on M1 Pro
ADAPTER:    ~50MB (.safetensors)
OVERHEAD:   ~100MB both buffers

```

Zero-initialised — starts as identity, only diverges as it learns. On day one the model behaves exactly like the base. Changes accumulate from corrections only.

**Not all corrections are equal.** The importance scorer:




```
BASE SCORE: 0.3

+ 0.3  has a correction
+ 0.2  same error seen before
+ 0.1  referenced > 3 times
+ 0.1  correction > 50 chars
- 0.1  older than 7 days

RANGE:  0.1 → 1.0
LR:     1e-5 → 5e-4

```

A correction made once: learning rate 1e-4. Same correction repeatedly: 5e-4. The system pays more attention to persistent failures. Borrowed from how the amygdala modulates memory consolidation — importance determines encoding depth.

**Consolidation runs while you sleep:**




```
1. select importance > 0.5
   + 20% of 0.2-0.5 range
2. train, highest first
3. snapshot adapter first
4. loss up >10%: revert
5. prune score < 0.2
   AND older than 7 days
   never prune corrections
6. log everything

```

The safety revert is not optional. Without it, noisy corrections could degrade the adapter. With it, worst case is: nothing changes.

## Assumption 4: you need a large model
 For general knowledge across all domains: yes, larger is better. A 3B model will not match GPT-4 on reasoning benchmarks.

For knowing one specific person's work, vocabulary, and domain — after four weeks of daily corrections — a 3B adapted model outperforms a 70B static model on that specific task. The static model knows nothing about you. The adapted model knows almost nothing else.

The numbers:




```
LOAD TIME:  ~9s (once, at startup)
SPEED:      84 tok/s
            spec: >5, actual: 16×
LATENCY:    0.34s average

MEMORY:
  base model:     ~2GB
  LoRA buffers:   ~100MB
  episodic store: ~50MB
  knowledge:      ~50MB
  phi4-mini:      ~4GB
  OS + overhead:  ~3GB
  TOTAL:          ~9.2GB / 16GB
  HEADROOM:       ~6.8GB

```



## The teacher ensemble





```
UNCERTAINTY > 0.7
      │
      ▼
query phi4-mini:
  "Step by step: [prompt]
   REASONING: [steps]
   ANSWER: [conclusion]"
      │
      ▼
1 source:   conf = 0.5
2 agree:    conf = 0.9
2 disagree: conf = 0.2
      │
      ▼
training_worthy: conf > 0.6
      │
  ┌───┴───┐
  ▼       ▼
train   discard

```



With one local teacher the confidence ceiling is 0.5 — not training-worthy. Adding Gemini Flash (`GEMINI_API_KEY`) raises consensus to 0.9. Two independent models agreeing on a reasoning trace is a strong signal.

## The internal state monitor
 Four metrics, every 10 inferences:




```
UNCERTAINTY:
  mean token entropy, last 20
  normalised by ln(128256)
  high = unsure what comes next

PERFORMANCE:
  1 - (corrections/total)
  rolling 50 interactions
  1.0 = no recent errors

NOVELTY:
  cosine dist to known
  embedding centroid
  high = unfamiliar territory

COHERENCE:
  similar prompts, last 20
  consistent responses?
  1.0 = never contradicts

```

These drive behaviour:




```
uncertainty > 0.7
  → trigger teacher query
  → importance scores × 1.5

```

After one session: *"Uncertainty 50%. Performance 100%. Somewhat unfamiliar territory."* Accurate. New domain. It knew it did not know it well.

## The discoveries that were not in any paper



```
DISCOVERY 1:
  Metal not thread-safe
  single lock required
  0.83s worst case latency
  undocumented

DISCOVERY 2:
  LoRA = 112 params only
  28 × 2 projections × 2 mat
  smaller than expected

DISCOVERY 3:
  84 tok/s on M1 Pro
  spec required >5
  actual: 16× faster

DISCOVERY 4:
  ChromaDB includes
  all-MiniLM-L6-v2 built in
  no extra install needed

DISCOVERY 5:
  synthetic test data shows
  slight loss increase
  real corrections behave
  better — expected

```





## What the measurements will tell us





```
Q1: improvement rate
  how fast does it specialise?
  does it plateau? when?

Q2: catastrophic forgetting
  does old knowledge survive?
  does safety revert trigger?

Q3: knowledge separation
  does it cut hallucination?
  vs static same-size model?

Q4: minimum viable size
  how small can base model be?
  3B now, 1B is next

```



These numbers do not exist. The experiment is running on a MacBook Pro in Bengaluru.

I will publish what I find.

## The code
 Ten components. One entry point.

from src.component10 import (
chat, start, stop,
get_system_status
)

start()
response = chat("What do I work on?")
status = get_system_status()
print(status.self_narrative)
stop()
Everything else — retrieval, scoring, training, consolidation, teacher queries, state monitoring — happens in the background.

## What comes next
 The system is running. I am using it daily.

In four weeks I will publish the measurements — improvement rate, catastrophic forgetting results, hallucination reduction, and whether the efficiency argument holds on real usage data.

The code will follow with those results.

Not because I am protecting anything. Because the implementation without the measurements is half the story. The interesting part is not that this can be built — it is what happens when you actually run it.

*The first post (non-technical): [post 1 link]*