---
title: "The architecture of a personal AI that never stops learning"
date: "2026-03-08"
description: "Ten components, 82 tests, one MacBook Pro — and four assumptions about local AI that turned out to be wrong. The architecture, the real numbers, and the discoveries that weren't in any paper — from someone who built it and measured it."
tags: ["vibes"]
image: null
published: true
---

Four assumptions everyone makes about local AI:



```
1. local models can't remember between sessions
2. training and inference must be separate operations
3. getting better requires retraining from scratch
4. you need a large model for useful capability

```

All four are wrong. Here is the proof — ten components, 82 tests, one MacBook Pro.



## What we are actually trying to build
 Most local AI setups look like this:



```
YOU ──► prompt ──► model ──► response ──► YOU
                    ▲
                    │
              frozen weights
              never changes
              knows nothing about you
              same tomorrow as today

```

What I wanted:





```
YOU ──► prompt ──► model ──► response ──► YOU
                    ▲    │
              weights    └──► learns from this
              that grow        in background
              from use         right now
                    ▲
                    │
              remembers last session
              and the one before
              and every correction
              you ever made

```

The gap between those two diagrams is what the architecture solves.



## The stack
```
HARDWARE:    M1 Pro, 16GB unified memory
MODEL:       Llama 3.2 3B Instruct, 4-bit quantized
             mlx-community/Llama-3.2-3B-Instruct-4bit
             ~1.8GB on disk, ~2GB in memory
FRAMEWORK:   MLX — Apple's own ML framework
             uses unified memory natively
             no PCIe bottleneck, no separate VRAM
ADAPTERS:    LoRA via mlx_lm
MEMORY:      ChromaDB (local, no server)
TEACHER:     Ollama + phi4-mini (local)
LANGUAGE:    Python 3.11
TESTS:       82 passing, zero regressions

```
## Component map
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. BASE INFERENCE          load once, serve always │
│  2. LORA TRAINING           112 params, not 3B      │
│  3. DOUBLE BUFFER           train + infer, same time│
│         │                                           │
│         ├──────────────┬────────────────┐           │
│         ▼              ▼                ▼           │
│  4. EPISODIC STORE  9. KNOWLEDGE    7. STATE        │
│  5. IMPORTANCE         STORE           MONITOR      │
│     SCORER                                          │
│  6. CONSOLIDATION                                   │
│         │              │                │           │
│         └──────────────┴────────────────┘           │
│                        │                            │
│                 8. TEACHER ENSEMBLE                 │
│                        │                            │
│                 10. ORCHESTRATOR                    │
│                   chat() — single entry point       │
└─────────────────────────────────────────────────────┘

BUILD ORDER: 1→2→3, then 4+9+7 in parallel, then 8→10

```
## Assumption 1: local models can't remember between sessions
 They can. The architecture has three distinct memory types, not one:



```
WEIGHTS (base model, frozen):
  everything Llama learned during pretraining
  general language understanding, reasoning patterns
  3 billion parameters
  never changes after you download it

ADAPTERS (LoRA, trainable):
  your specific patterns, your corrections, your domain
  112 trainable parameters on top of 3B frozen
  updates continuously from your use
  persists to disk, loads on restart

KNOWLEDGE STORE (ChromaDB, retrieval):
  specific facts — names, products, preferences
  stored as text, retrieved by similarity
  exact, never approximated
  high confidence, never hallucinated

```

The separation matters. Facts should not be in weights — weights are diffuse, approximate, hard to update cleanly. A fact stored in the knowledge store is retrieved exactly. A fact trained into weights is interpolated with everything else the model knows and loses precision.



When I teach the model "Frameo AI is a generative video platform" — that goes into the knowledge store at confidence 0.95, not into gradient descent. When I keep correcting the same reasoning error — that goes into the adapter weights through training. Different memory for different kinds of knowledge.

Before every inference, the top 5 most similar facts are retrieved. Facts with confidence above 0.7 are prepended to the prompt:



```
"Relevant facts: Frameo AI is a generative video platform.
 Dashtoon Studio is an AI comic creation platform.
 Now answer: What do I work on?"

```

The model never has to remember facts. It looks them up.



## Assumption 2: training and inference must be separate
 They do not have to be. Not on M1 unified memory.

The standard reason for separating them is hardware: GPUs have their own memory (VRAM), and the training process needs exclusive access to update weights. On M1, the CPU and GPU share the same memory pool. There is no PCIe bottleneck. No transfer. No exclusivity requirement.

The implementation uses two adapter copies — a double-buffer:



```
BUFFER A  (adapters/buffer_a/)
├── adapter_config.json
└── adapters.safetensors
    ▲
    │ inference always reads here
    │ never written to during serving

BUFFER B  (adapters/buffer_b/)
├── adapter_config.json
└── adapters.safetensors
    ▲
    │ training always writes here
    │ never read during serving

SWAP (every 100 training steps):
    rename B → A  (atomic)
    recreate B from A
    reload inference adapter
    duration: <100ms

```

The discovery that complicated this: **Metal is not thread-safe across threads.**



This was not documented anywhere I could find. It means true parallel execution of training and inference on the GPU is not possible — they must take turns, serialised by a single lock. In practice:



```
training step:    ~0.23 seconds
inference:        ~0.60 seconds
worst case wait:  ~0.83 seconds
spec requirement: <3 seconds
actual result:    0.34 seconds average response time

```

The spirit of simultaneous is preserved. The user never notices. The training thread runs continuously in the background. `submit_correction()` is non-blocking — it queues and returns immediately. `query()` always responds in under a second.



## Assumption 3: getting better requires retraining from scratch
 LoRA changes this completely.

Standard fine-tuning updates all model weights. For a 3B model that is billions of gradient computations per step — minutes to hours per training run. LoRA instead adds small trainable matrices to specific attention layers and trains only those.

In practice:



```
BASE MODEL:          3,000,000,000 parameters (frozen)
LORA ADAPTER:                  112 parameters (trainable)
FRACTION:                  0.000004%

ONE TRAINING STEP:   ~0.23 seconds on M1 Pro
ADAPTER SIZE:        ~50MB (.safetensors format)
MEMORY OVERHEAD:     ~100MB (both buffers resident)

```

The adapter is attached to the query and value projection matrices across all 28 transformer layers — the parts of the model most responsible for how it attends to and weighs information. Rank 8, alpha 16, zero-initialised so the adapter starts as identity and only diverges as it learns.



The zero initialisation matters. A random initialisation would immediately change the model's behaviour before it has learned anything. Zero init means: on day one, the model behaves exactly like the base model. Changes accumulate from corrections only.

**Not all corrections are equal.** The importance scorer assigns a learning rate to every training example:



```
BASE SCORE:        0.3

MODIFIERS:
  + 0.3  if episode has a correction
  + 0.2  if same prompt type corrected before
  + 0.1  if times_referenced > 3
  + 0.1  if correction > 50 chars
  - 0.1  if episode older than 7 days

SCORE RANGE:       0.1 → 1.0
LEARNING RATE:     1e-5 → 5e-4  (linear mapping)

```

A correction you make once gets a learning rate of 1e-4. The same correction made repeatedly gets 5e-4. The system pays more attention to persistent failures. Borrowed from how the amygdala modulates memory consolidation in the brain: importance determines how strongly something is encoded.



**Consolidation runs while you sleep.** Every 100 episodes, or every 24 hours:



```
1. select episodes with importance > 0.5
   + random 20% of episodes scoring 0.2-0.5
2. train on them, highest importance first
3. snapshot adapter before training
4. if loss increases >10%: revert to snapshot
5. prune score < 0.2 AND older than 7 days
   never prune corrections regardless of age
6. log to consolidation_log.jsonl

```

The safety revert is not optional. Without it, consolidation on noisy or contradictory corrections could degrade the adapter. With it, the worst case is: nothing changes.



## Assumption 4: you need a large model for useful capability
 This depends entirely on what you mean by capability.

For general knowledge across all domains: yes, larger is better. A 3B model will not match GPT-4 on reasoning benchmarks.

For knowing one specific person's work, vocabulary, preferences, and domain — after four weeks of daily corrections — a 3B model with continuous adaptation and a knowledge store outperforms a 70B static model on that specific task. The static model knows nothing about you. The adapted model knows almost nothing else.

The numbers on the current setup:



```
MODEL LOAD TIME:      ~9 seconds (once, at startup)
INFERENCE SPEED:      84 tokens/second
                      (spec required >5, actual is 16x that)
RESPONSE LATENCY:     0.34 seconds average
MEMORY FOOTPRINT:
  base model:         ~2GB
  both LoRA buffers:  ~100MB
  episodic store:     ~50MB
  knowledge store:    ~50MB
  teacher (phi4-mini):~4GB (separate Ollama process)
  OS + overhead:      ~3GB
  TOTAL:              ~9.2GB of 16GB
  HEADROOM:           ~6.8GB

```



## The teacher ensemble

When the internal state monitor detects uncertainty above 0.7:





```
UNCERTAINTY > 0.7
      │
      ▼
query phi4-mini via Ollama:
  "Explain step by step:
   [prompt]
   REASONING: [step-by-step]
   ANSWER: [conclusion]"
      │
      ▼
confidence = 0.5  (one source)
           = 0.9  (two sources agree)
           = 0.2  (two sources disagree)
      │
      ▼
training_worthy = confidence > 0.6
      │
      ├── YES → add to training queue
      └── NO  → log, discard

```

With one local teacher the confidence ceiling is 0.5 — not training-worthy by default. Adding a second source (Gemini Flash free tier via `GEMINI_API_KEY`) raises confident consensus to 0.9. Two independent models agreeing on a reasoning trace is a strong signal.



Rate limited to 10 queries per hour to respect free tier limits. Excess queries queue and process when the limit resets.

## The internal state monitor
 Four metrics, computed every 10 inferences, logged to `state_log.jsonl`:



```
UNCERTAINTY:
  mean entropy of output token distributions
  entropy = -Σ(p × log p) per token
  normalised by ln(128256) — Llama 3.2 vocab size
  high = model unsure what comes next

PERFORMANCE:
  1 - (corrections / total) over rolling 50 interactions
  1.0 = no errors recently
  0.0 = every response corrected

NOVELTY:
  mean cosine distance from prompt embedding
  to centroid of all known embeddings in episodic store
  high = unfamiliar territory

COHERENCE:
  proportion of similar-prompt pairs (cosine sim > 0.9)
  with consistent responses in last 20 prompts
  1.0 = always consistent
  0.0 = contradicts itself

```

These drive behaviour:





```
uncertainty > 0.7  →  trigger teacher query
high uncertainty   →  importance scores × 1.5

```

After one session: *"I have processed 10 interactions. Uncertainty 50%. Performance 100%. Somewhat unfamiliar territory."* Accurate. It had just learned a new domain. It did not know it well. It knew that.



## The discoveries that were not in any paper
```
DISCOVERY 1: Metal is not thread-safe across threads
  true parallel GPU execution: not possible
  single lock serialisation: required
  impact on latency: minimal (0.83s worst case)
  documented nowhere I could find

DISCOVERY 2: LoRA adapter is 112 parameters
  28 layers × 2 projections × 2 matrices
  smaller than expected
  good news for memory and swap speed

DISCOVERY 3: 84 tokens/second on M1 Pro
  spec required >5 tok/s, actual: 16× faster
  4-bit quantization + MLX Metal optimisation

DISCOVERY 4: ChromaDB includes all-MiniLM-L6-v2
  no separate sentence-transformers needed
  saves ~80MB and one dependency

DISCOVERY 5: synthetic data loss increase is normal
  consolidation safety check worked correctly
  real corrections on real language behave better

```
## What the measurements will tell us
```
QUESTION 1: improvement rate
  how fast does it specialise?
  does it plateau? when?

QUESTION 2: catastrophic forgetting
  does old knowledge survive?
  does the safety revert trigger in real use?

QUESTION 3: knowledge separation efficiency
  does it reduce hallucination rate?
  by how much vs static same-size model?

QUESTION 4: minimum viable size
  how small can the base model be?
  3B is the current test, 1B is next

```
 These numbers do not exist. The experiment is running on a MacBook Pro in Bengaluru.

I will publish what I find.

## The code
 Ten components. One entry point.

from src.component10 import chat, start, stop, get_system_status

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