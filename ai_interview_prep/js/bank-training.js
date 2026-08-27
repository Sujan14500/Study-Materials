/* ============================================================
   Training & tuning — pretraining through GRPO and distillation.
   ============================================================ */
window.QB = (window.QB || []).concat([

{ id: 'tn01', topic: 'training', level: 1,
  q: 'How is an LLM trained, start to finish?',
  lay: 'Three stages. First it reads an enormous amount of text with the next word covered up, guessing it billions of times — that is where the knowledge and the grammar come from. Then it is shown examples of good answers to questions, so it learns that a question wants an answer rather than more questions. Finally it is shown pairs of answers with a human pointing at the better one, so it learns what "better" means.',
  tech: '<ol><li><b>Pretraining:</b> self-supervised next-token prediction on trillions of tokens. Updates every weight. Costs millions of dollars and weeks of cluster time. This is where knowledge and reasoning capability come from.</li><li><b>Supervised fine-tuning (SFT):</b> train on (instruction, ideal response) pairs, typically 10k–1M examples. Teaches the model to be an assistant rather than a completer.</li><li><b>Preference tuning:</b> RLHF (reward model + PPO) or, increasingly, DPO on (chosen, rejected) pairs. Teaches helpfulness, tone, safety and refusal behaviour.</li></ol>Some pipelines add continued pretraining on domain data between 1 and 2, and reasoning-focused RL (GRPO-style) after 3.',
  dgm: { nodes: [{ t: 'pretrain', s: 'trillions of tokens' }, { t: 'SFT', s: 'instruction pairs', k: 'alt' }, { t: 'preference', s: 'DPO / RLHF', k: 'alt' }, { t: 'reasoning RL', s: 'optional' }],
    cap: 'Capability comes from stage 1. Everything after it shapes behaviour.' },
  trap: '"Which stage adds knowledge?" Almost entirely the first. SFT and preference tuning change how the model behaves far more than what it knows — which is exactly why fine-tuning is a poor way to inject facts.',
  tags: ['pretraining', 'sft'], orig: 4 },

{ id: 'tn02', topic: 'training', level: 2,
  q: 'Explain next-token prediction as a training objective. Why is it enough?',
  lay: 'Cover the next word, ask the model to guess, measure how wrong it was, and nudge every knob a fraction in the direction that would have been less wrong. Do that a few trillion times. Guessing well eventually requires grammar, then facts, then something that looks like reasoning — because all of them make the next word more predictable.',
  tech: 'The loss is cross-entropy between the predicted distribution and the one-hot actual next token, averaged over positions: <span class="mono">L = −(1/n) Σ log P(x_t | x_&lt;t)</span>. Because the causal mask makes every position a valid training example at once, a 4k-token document produces 4k supervised signals in one forward pass — this data efficiency is why it scales. Perplexity is just exp(L), the effective number of equally-likely choices the model is deciding between.',
  code: `# the whole objective
logits = model(ids)                                # (B, T, V)
loss = F.cross_entropy(
    logits[:, :-1].reshape(-1, V),                 # prediction at position t
    ids[:, 1:].reshape(-1),                        # actual token at t+1
    ignore_index=PAD)
loss.backward(); opt.step(); opt.zero_grad()`,
  trap: 'Be ready for "is it enough?" — no, not on its own. A base model trained this way is a strong completer and a poor assistant. The capability is from pretraining; the usefulness is from the alignment stages afterwards.',
  tags: ['objective', 'pretraining'], orig: 4 },

{ id: 'tn03', topic: 'training', level: 1,
  q: 'What is fine-tuning, and what are its main types?',
  lay: 'Taking a model that already knows language and giving it extra, targeted practice so it behaves the way you need. You can do it the expensive way (rewire every connection), the cheap way (clip a small adapter on the side), or by showing it preferences instead of answers.',
  tech: '<ul><li><b>Full SFT</b> — update every weight on (prompt, response) pairs. Maximum capacity for change, maximum cost, real risk of catastrophic forgetting.</li><li><b>Parameter-efficient (PEFT)</b> — freeze the base and train a small number of new parameters: LoRA and QLoRA (low-rank adapters), prefix / prompt tuning (learned soft tokens), adapters (small bottleneck layers), IA³ (learned scaling vectors).</li><li><b>Preference / alignment</b> — DPO, RLHF, ORPO, KTO, GRPO. Trained on comparisons or rewards rather than gold answers.</li><li><b>Continued pretraining</b> — more next-token prediction on domain text. Used to add a new language or a very unusual domain.</li><li><b>Distillation</b> — train a small student on a large teacher\'s outputs.</li></ul>',
  trap: 'The rule that survives every follow-up: <b>fine-tuning teaches form, retrieval supplies facts.</b> If the complaint is "it does not know our products", that is retrieval. If it is "it will not stop writing bullet points", that is tuning.',
  tags: ['finetuning'], orig: 5 },

{ id: 'tn04', topic: 'training', level: 2,
  q: 'What is LoRA and why does it work?',
  lay: 'Instead of rewiring the brain, you clip on a small pair of specialist glasses. The original stays untouched and frozen; the glasses are tiny, trainable, and you can swap a different pair in for each customer.',
  tech: 'Low-Rank Adaptation. For a frozen weight matrix W ∈ ℝ^{d×k}, learn ΔW = BA where A ∈ ℝ^{r×k} and B ∈ ℝ^{d×r} with r ≪ min(d, k). The forward pass becomes <span class="mono">h = Wx + (α/r)·BAx</span>. A is initialised with small random values and B with zeros, so training starts exactly at the base model. It works because the update needed to adapt a pretrained model to a narrow task has low intrinsic rank — you are not teaching new capability, you are steering existing capability. Typical settings: r = 8–64, α = 2r, dropout 0.05, targeting attention projections and often the MLP.',
  code: `# exact parameter arithmetic — worth being able to do in your head
d, layers, r = 4096, 32, 16
per_matrix = r * (d + d)                   # A is r x d, B is d x r
qv         = 2 * per_matrix * layers       # adapting q_proj and v_proj only
print(qv / 1e6, "M trainable")             # ~8.4M
print(qv / 8.03e9 * 100, "% of an 8B model")   # ~0.10%
print(qv * 2 / 1024**2, "MB adapter (fp16)")   # ~16 MB, versus a 16 GB base`,
  trap: '"Does it slow inference?" No — merge BA back into W after training and you have an ordinary model. You only pay the extra matmuls if you keep adapters separate to hot-swap them, which is often worth it for multi-tenant serving.',
  tags: ['lora', 'peft'], orig: 6 },

{ id: 'tn05', topic: 'training', level: 2,
  q: 'LoRA vs QLoRA — what exactly is the difference?',
  lay: 'They are the same technique. QLoRA just compresses the frozen part so it fits in less memory. If the model already fits with LoRA, use LoRA. If it does not, QLoRA is the reason you can train at all.',
  tech: 'QLoRA = LoRA + a 4-bit NF4-quantised frozen base + double quantisation (quantising the quantisation constants) + paged optimisers (using unified memory to survive gradient spikes). Gradients flow through the de-quantised weights into full-precision adapters; the base itself never updates, so its quantisation error is a fixed bias rather than something that compounds.',
  compare: { cols: ['LoRA', 'QLoRA'],
    rows: [
      ['Frozen base precision', '16-bit', '4-bit NF4'],
      ['Adapter precision', '16-bit', '16-bit — unchanged'],
      ['VRAM, 7B model', '~16–20 GB', '~6–10 GB'],
      ['VRAM, 70B model', '~160 GB — multi-GPU node', '~46 GB — one 80 GB card'],
      ['Speed per step', 'baseline', '~25–40% slower (de-quantise on the fly)'],
      ['Quality', 'the reference', 'very close, usually within about a point'],
      ['Pick it when', 'you have the VRAM', 'the model would not fit otherwise']
    ] },
  trap: '"Is QLoRA a different algorithm?" No. That is the whole answer, and getting it right immediately signals you have actually run one.',
  tags: ['qlora', 'lora'], orig: 6, xref: [['LoRA/QLoRA calculator', '../genai_flow/index.html']] },

{ id: 'tn06', topic: 'training', level: 3,
  q: 'When would you choose full fine-tuning over LoRA?',
  lay: 'Almost never — but there is a real case: when you have a genuinely large, clean dataset and you need the model to change in a big way, like learning a language it barely saw in training.',
  tech: 'Full SFT wins when: (a) you have more than roughly 50k high-quality examples; (b) the target distribution is far from pretraining (a new language, a new modality, a highly unusual formalism); (c) you have a multi-GPU node and the budget; (d) you need one model rather than base-plus-adapters at serving time. Everywhere else LoRA matches it within noise at a fraction of the cost. Memory is the deciding constraint: full fine-tuning needs roughly 16 bytes per parameter (fp16 weights + fp16 gradients + two fp32 Adam moments) plus activations, so a 7B model needs well over 100 GB.',
  trap: 'Say you would run a LoRA baseline first regardless. It is a day of work, it frequently wins, and it gives you a number to beat. Jumping straight to full fine-tuning without that baseline is the answer that loses points.',
  tags: ['sft', 'lora'], orig: 6 },

{ id: 'tn07', topic: 'training', level: 2,
  q: 'What is DPO and why did it largely replace RLHF?',
  lay: 'RLHF is: hire judges, teach a robot to imitate the judges, then let the robot coach the model full time — three moving parts, any of which can go wrong. DPO skips the middle robot entirely. You show the model two answers and which one was preferred, and there is a direct formula that nudges it toward the better one.',
  tech: 'Direct Preference Optimisation reparameterises the RLHF objective so the optimal policy has a closed form in terms of the reward, letting you optimise the policy directly on (prompt, chosen, rejected) triples with a simple classification-style loss. No reward model, no rollouts, no PPO. The loss is <span class="mono">−log σ(β[log π(y_w|x)/π_ref(y_w|x) − log π(y_l|x)/π_ref(y_l|x)])</span> — you keep a frozen reference model and β controls how far you may drift from it. Simpler, more stable, far cheaper, and competitive on most alignment benchmarks.',
  compare: { cols: ['RLHF (PPO)', 'DPO'],
    rows: [
      ['Models in memory', 'policy, reference, reward, value — four', 'policy and reference — two'],
      ['Needs a reward model', 'yes', 'no'],
      ['Data', 'comparisons → reward model → rollouts', '(chosen, rejected) pairs directly'],
      ['Stability', 'finicky; reward hacking is real', 'much more stable'],
      ['Compute', 'high — online generation each step', 'low — offline, like supervised training'],
      ['Best at', 'squeezing out the last few points at frontier scale', 'almost everything a product team needs']
    ] },
  trap: '"When is PPO still better?" When you need online exploration against a live reward signal, or when your reward is a program rather than a preference. DPO is offline: it can only learn from the pairs you collected.',
  tags: ['dpo', 'rlhf'], orig: 49 },

{ id: 'tn08', topic: 'training', level: 3,
  q: 'What is RLHF, in detail?',
  lay: 'Three steps. Teach it to answer with examples. Then show humans pairs of answers and record which they preferred, and train a second model to imitate those preferences. Then let the main model practise, scored by that second model, with a leash stopping it wandering too far from where it started.',
  tech: '<ol><li><b>SFT</b> on demonstration data to get a reasonable starting policy.</li><li><b>Reward model:</b> collect human comparisons and train a model (usually the same architecture with a scalar head) with a Bradley-Terry loss to score responses.</li><li><b>PPO:</b> optimise the policy to maximise reward while penalising KL divergence from the SFT reference, so it does not degenerate into reward-hacking gibberish. The value network estimates the baseline for advantage computation.</li></ol>Failure modes: reward hacking (the policy finds inputs the reward model scores highly and humans do not), verbosity bias (reward models reward length), and mode collapse.',
  trap: 'The KL penalty is the part people forget. Without it, PPO reliably finds adversarial inputs to the reward model and quality collapses while the reward number rises. Mentioning it unprompted signals real familiarity.',
  tags: ['rlhf', 'ppo'], orig: 49 },

{ id: 'tn09', topic: 'training', level: 3,
  q: 'What is GRPO and what problem does it solve?',
  lay: 'Give the model the same maths problem eight times, mark all eight, and push it toward the attempts that beat the class average. Because you have the group to compare against, you no longer need a separate model whose job was to predict "how good is average here".',
  tech: 'Group Relative Policy Optimisation. For each prompt, sample a group of G completions, score them all with a reward function, and use the group\'s mean (and standard deviation) as the baseline for advantage estimation: <span class="mono">A_i = (r_i − mean(r)) / std(r)</span>. This removes the value/critic network that PPO needs, cutting memory substantially, at the cost of more inference (G rollouts per prompt). It shines with <b>verifiable</b> rewards — maths answers that can be checked, code that must pass tests, output that must parse — which is why it is the family behind recent reasoning models.',
  compare: { cols: ['PPO', 'GRPO'],
    rows: [
      ['Baseline for advantage', 'a learned value network', 'the mean reward of the sampled group'],
      ['Extra model in memory', 'yes — the critic', 'no'],
      ['Rollouts per prompt', '1', 'G (typically 4–16)'],
      ['Best reward type', 'a learned reward model', 'a programmatic, verifiable check'],
      ['Main cost', 'memory and instability', 'inference — you generate G times more'],
      ['Typical use', 'general alignment', 'maths, code, structured reasoning']
    ] },
  trap: '"What if there is no automatic scorer?" Then GRPO is the wrong tool and you want DPO. GRPO lives or dies on the reward function.',
  tags: ['grpo', 'rl'], orig: 49 },

{ id: 'tn10', topic: 'training', level: 2,
  q: 'What is knowledge distillation?',
  lay: 'The professor writes ten thousand worked solutions and the student learns from them. The student ends up much smaller and nearly as good on that specific syllabus — and inherits every one of the professor\'s mistakes.',
  tech: 'Train a small student to reproduce a large teacher\'s behaviour. Variants: <b>response distillation</b> (SFT on teacher outputs — by far the most common in practice), <b>logit distillation</b> (KL divergence against the teacher\'s full output distribution, richer signal but needs logit access), and <b>feature distillation</b> (matching intermediate representations). Practical wins are large: a 7B student distilled on a narrow task can approach a frontier model at 20–50× lower cost. Two constraints people forget: check the teacher\'s terms of service, and the student can never exceed the teacher on the distilled distribution.',
  trap: '"Is it a quality project or a cost project?" A cost project. If quality is your problem, distillation makes it worse. Reach for it when the pipeline already works and needs to be cheaper or faster.',
  tags: ['distillation'], orig: 49 },

{ id: 'tn11', topic: 'training', level: 2,
  q: 'When should you fine-tune versus use RAG versus just prompt better?',
  lay: 'If the model gets the facts wrong, give it the facts — that is retrieval. If it has the facts but gets the format, tone or behaviour wrong, that is tuning. If you have not yet tried writing better instructions with two examples, do that first, because it costs an afternoon.',
  tech: 'Decision order: <ol><li><b>Prompt + few-shot</b> — free, instant, reversible. Most "we need a fine-tune" tickets die here.</li><li><b>RAG</b> — the answer depends on facts that change, must be cited, or is permission-scoped.</li><li><b>LoRA</b> — the behaviour, format or style is consistently wrong and you have 500+ examples of right.</li><li><b>Preference tuning</b> — "better" is easier to judge than to write.</li><li><b>Full SFT / continued pretraining</b> — a genuinely new domain or language, and a lot of data.</li></ol>They compose: a fine-tuned model that follows your format, fed by retrieval that supplies your facts, is the standard production shape.',
  compare: { cols: ['Prompting', 'RAG', 'Fine-tuning'],
    rows: [
      ['Fixes', 'instructions, format, simple behaviour', 'wrong or missing facts', 'persistent style / behaviour'],
      ['Time to first result', 'minutes', 'days', 'days to weeks'],
      ['Knowledge freshness', 'whatever you paste', 'live — update the index', 'frozen at training time'],
      ['Citations', 'no', 'yes', 'no'],
      ['Per-request cost', 'low', 'medium (extra tokens)', 'low — no extra context'],
      ['Can you delete a fact', 'n/a', 'yes, instantly', 'not reliably'],
      ['Needs labelled data', 'a handful', 'no', 'hundreds to thousands']
    ] },
  trap: 'The single most common bad answer in this whole space is "we fine-tuned on our docs so the model would know them". Name that as an anti-pattern before they ask.',
  tags: ['rag', 'finetuning'], orig: 5 },

{ id: 'tn12', topic: 'training', level: 2,
  q: 'What is catastrophic forgetting and how do you avoid it?',
  lay: 'Teach it intensively about one narrow thing and it quietly gets worse at everything else — like a student who crams for one exam and forgets last term.',
  tech: 'When fine-tuning shifts weights far from the pretrained solution, capabilities not represented in the fine-tuning data degrade. Mitigations: <ul><li>Use PEFT — LoRA barely moves the base weights at all, which is a large part of why it is safe.</li><li>Mix in 5–20% general instruction data alongside your domain data.</li><li>Low learning rate (1e-5 to 5e-5 for full SFT; 1e-4 to 3e-4 for LoRA) and few epochs — often 1–3.</li><li>Keep a KL or L2 penalty toward the reference model.</li><li>Evaluate on a held-out GENERAL benchmark, not only your task. This is the step teams skip and then cannot explain why the model got worse.</li></ul>',
  trap: 'Always have a regression eval covering capabilities you are not training. "Our task metric went up 12 points" is not a result until you can show instruction-following and safety did not drop.',
  tags: ['forgetting', 'sft'] },

{ id: 'tn13', topic: 'training', level: 2,
  q: 'How much data do you need to fine-tune, and what does good data look like?',
  lay: 'Far less than people think, and quality matters far more than quantity. A thousand carefully-checked examples beat fifty thousand scraped ones, every time.',
  tech: 'Rough guidance: format or style changes, 100–500 examples with LoRA. Domain behaviour, 1k–10k. New capability or language, 50k+ with full fine-tuning. The LIMA result (1,000 curated examples) showed how far quality goes. What good data looks like: consistent formatting, real input distribution (not synthetic prompts you invented), correct and complete outputs, diverse coverage of the input space, deduplicated, and with a genuinely held-out test split created BEFORE any training. Include negative and edge cases — refusals, ambiguous inputs, malformed inputs — or the model will handle none of them.',
  trap: '"Where does your eval set come from?" It must be split off before training and never used for tuning decisions. Teams that split after generating examples leak the distribution and then cannot explain why production is worse than the eval.',
  tags: ['data', 'sft'] },

{ id: 'tn14', topic: 'training', level: 2,
  q: 'What hyperparameters matter for LoRA, and how do you set them?',
  lay: 'Rank is how much capacity the glasses have. Alpha is how strongly they are applied. Which layers you attach them to matters more than either. And the learning rate should be higher than you would use for full fine-tuning, because you are training so few parameters.',
  tech: '<ul><li><b>r (rank):</b> 8–16 for style and format; 32–64 for larger behaviour changes. Diminishing returns above 64 for most tasks.</li><li><b>alpha:</b> scaling is α/r. The common convention is α = 2r, which keeps effective scale constant as you change r.</li><li><b>target modules:</b> the biggest lever. q_proj + v_proj is the original paper. All attention projections is better. Attention + MLP (gate, up, down) is the QLoRA paper recommendation and usually the best quality.</li><li><b>learning rate:</b> 1e-4 to 3e-4 — roughly 10× a full fine-tune, because far fewer parameters are moving.</li><li><b>dropout:</b> 0.05–0.1 on small datasets.</li><li><b>epochs:</b> 1–3. More usually overfits; watch eval loss, not train loss.</li></ul>',
  trap: 'If someone reports poor LoRA results, the first two things to check are almost always target modules (attention-only on a task needing knowledge) and learning rate (using a full-fine-tune LR, so nothing moves).',
  tags: ['lora', 'hyperparameters'], orig: 6 },

{ id: 'tn15', topic: 'training', level: 3,
  q: 'What is instruction tuning, and how does it differ from ordinary SFT?',
  lay: 'Ordinary fine-tuning teaches one task. Instruction tuning teaches the meta-skill of following instructions in general, by training on hundreds of different tasks all phrased as instructions — so it can handle a task it never saw.',
  tech: 'SFT on a large, diverse mixture of tasks expressed in natural-language instruction format (FLAN, Natural Instructions, Alpaca-style data). The goal is generalisation to unseen instructions rather than performance on one task. Key findings: task diversity matters more than examples per task; including chain-of-thought data improves reasoning transfer; and there is a real trade-off where heavy instruction tuning on narrow formats can reduce flexibility.',
  trap: '"So instruct models are strictly better?" Not for every purpose. If you are fine-tuning for one narrow task with lots of data, starting from a base model sometimes gives cleaner results, because you are not fighting an existing instruction prior.',
  tags: ['instruction-tuning'] },

{ id: 'tn16', topic: 'training', level: 3,
  q: 'What is constitutional AI / RLAIF?',
  lay: 'Instead of paying humans to rank every pair of answers, you write down the principles you want and have a model apply them — critiquing and revising its own answers against the written rules, then learning from those preferences.',
  tech: 'Constitutional AI (Anthropic) has two phases: a supervised phase where the model critiques and revises its own responses against a written set of principles, and an RL phase where preference labels come from a model judging against the constitution rather than from humans (RLAIF). Advantages: scales far past human labelling throughput, and the values are written down and auditable rather than implicit in a labelling workforce. Risk: the AI labeller inherits and can amplify its own biases, so human oversight of the constitution and spot-checking of labels remain necessary.',
  trap: 'The interesting engineering point is auditability: with a constitution, "why did the model refuse this?" has a written answer you can point at and change. With a pure human-preference pipeline, the values live in a labelling guideline nobody outside the annotation team ever reads.',
  tags: ['alignment', 'rlaif'] },

{ id: 'tn17', topic: 'training', level: 2,
  q: 'What is a reward model, and what goes wrong with it?',
  lay: 'A model trained to imitate human taste, so it can score millions of answers without a human reading them. The failure is predictable: it is an imperfect imitation, and if you optimise hard against an imperfect judge, you find its blind spots rather than getting better.',
  tech: 'Trained on preference pairs with a Bradley-Terry loss: <span class="mono">−log σ(r(x, y_w) − r(x, y_l))</span>. Known pathologies: <b>length bias</b> (reward models systematically prefer longer answers, which is why RLHF models became verbose), <b>reward hacking</b> (the policy finds high-reward, low-quality regions), <b>distribution shift</b> (the reward model was trained on SFT-model outputs and is being asked to score a policy that has drifted away from them), and <b>overoptimisation</b> — the well-documented pattern where true quality peaks and then falls while measured reward keeps rising.',
  trap: 'Mitigations worth naming: the KL penalty toward the reference, length normalisation in the reward, ensembles of reward models, and periodically refreshing the reward model on data from the current policy.',
  tags: ['rlhf', 'reward'] },

{ id: 'tn18', topic: 'training', level: 2,
  q: 'What does the training data pipeline look like for a pretrained model?',
  lay: 'Scrape enormous amounts of text, throw away most of it, and be extremely careful about duplicates and about accidentally including your exam paper in the textbook.',
  tech: '<ol><li><b>Collection</b> — web crawls, books, code, papers, curated corpora.</li><li><b>Filtering</b> — language identification, quality classifiers, heuristics on punctuation and length, toxicity and PII filtering.</li><li><b>Deduplication</b> — exact and near-duplicate (MinHash / SimHash) at document and paragraph level. This measurably improves quality and reduces memorisation.</li><li><b>Decontamination</b> — remove anything overlapping benchmark test sets, or your evaluations are meaningless.</li><li><b>Mixing</b> — weight sources deliberately; code data improves reasoning even on non-code tasks.</li><li><b>Tokenisation and packing</b> — concatenate into fixed-length sequences to avoid wasting compute on padding.</li></ol>',
  trap: 'Benchmark contamination is the point interviewers care about most, because it also applies to your own evals. If any of your eval questions came from a public dataset, assume the model has seen them and your numbers are inflated.',
  tags: ['data', 'pretraining'] },

{ id: 'tn19', topic: 'training', level: 3,
  q: 'What are ORPO and KTO, and why would you use them over DPO?',
  lay: 'Both are attempts to make preference tuning simpler. ORPO merges the two training stages into one. KTO removes the need for matched pairs — it only needs a thumbs up or thumbs down on individual answers, which is the data you actually have.',
  tech: '<ul><li><b>ORPO</b> (Odds Ratio Preference Optimisation): combines SFT and preference optimisation into a single loss with an odds-ratio penalty on the rejected response. One stage instead of two, no reference model in memory.</li><li><b>KTO</b> (Kahneman-Tversky Optimisation): uses a prospect-theory-inspired utility so it can learn from unpaired binary feedback — just "good" or "bad" on individual outputs. Hugely practical, because production feedback is thumbs up/down, not matched pairs.</li></ul>',
  trap: 'The KTO point is the strong one in a product interview: your logs contain thumbs, not pairs. A method that consumes the data you actually collect beats a better method that needs data you would have to manufacture.',
  tags: ['dpo', 'alignment'] },

{ id: 'tn20', topic: 'training', level: 2,
  q: 'How do you evaluate a fine-tuned model before shipping it?',
  lay: 'Four checks: did it get better at the thing you trained it for, did it get worse at everything else, is it still safe, and does a human agree with the numbers on a sample.',
  tech: '<ol><li><b>Task metric</b> on a held-out split created before training — exact match, F1, or a rubric-based judge depending on the task.</li><li><b>Regression suite</b> on general capability — instruction-following, reasoning, and format compliance. This catches catastrophic forgetting.</li><li><b>Safety evaluation</b> — refusal behaviour, jailbreak resistance, PII leakage. Fine-tuning is well documented to weaken safety training, even on benign data.</li><li><b>Human review</b> of 50–100 samples, blind against the base model, to confirm the metrics mean what you think.</li><li><b>Shadow or A/B deployment</b> before full rollout, watching thumbs, escalation rate and latency.</li></ol>',
  trap: 'Point 3 is the one candidates miss. Fine-tuning on entirely benign data has been shown to degrade safety alignment. If you tune, you re-test safety — every time.',
  tags: ['eval', 'finetuning'] },

{ id: 'tn21', topic: 'training', level: 3,
  q: 'What is continued (domain-adaptive) pretraining, and when is it worth it?',
  lay: 'More reading, but only in your field — medical notes, legal filings, your own codebase. It changes what the model finds familiar rather than how it behaves.',
  tech: 'Continue next-token prediction on a large domain corpus (typically 1B+ tokens) before any instruction tuning. Worth it when: the domain vocabulary and structure are genuinely far from general web text; you have a lot of unlabelled domain text but few labelled pairs; or you need a base for many downstream fine-tunes. Practical notes: mix 5–15% general data to limit forgetting, use a low learning rate with warmup, and consider extending the tokenizer if your domain has many out-of-vocabulary terms — though that requires resizing and re-initialising embeddings carefully.',
  trap: '"Is this how we teach it our documents?" No. Continued pretraining teaches distribution and vocabulary, not retrievable facts. If you want the model to cite your document, retrieve the document.',
  tags: ['pretraining', 'domain'] },

{ id: 'tn22', topic: 'training', level: 2,
  q: 'What is the difference between an epoch, a step and a batch in LLM training?',
  lay: 'A batch is a handful of examples processed together. A step is one update to the weights after a batch. An epoch is one full pass through your dataset. For big pretraining runs, nobody talks in epochs — the data is seen roughly once.',
  tech: 'Batch size in LLM training is usually measured in TOKENS, not examples, because sequence lengths vary — global batch sizes of 1M–4M tokens are typical for pretraining. Gradient accumulation lets you reach a large effective batch on limited memory by summing gradients across micro-batches before stepping. Learning rate is coupled to batch size (larger batch tolerates a larger LR), and the schedule is typically linear warmup then cosine decay. For fine-tuning, 1–3 epochs is standard; beyond that you are usually memorising rather than learning.',
  trap: '"What effective batch size are you using?" is a real diagnostic question. Someone reporting instability at micro-batch 1 with no gradient accumulation has an obvious fix.',
  tags: ['training', 'basics'] },

{ id: 'tn23', topic: 'training', level: 3,
  q: 'What is ZeRO / FSDP, and how does it differ from the parallelism used at inference?',
  lay: 'A training-only trick. Every worker keeps only a slice of the optimiser state, then the gradients, then the weights themselves — borrowing back the parts it needs just before it needs them. It is what makes full fine-tuning of a large model possible at all.',
  tech: 'ZeRO shards the training state across data-parallel ranks in three stages: stage 1 shards optimiser state, stage 2 adds gradients, stage 3 adds the parameters themselves (this is what PyTorch FSDP implements). Memory per rank falls roughly by the number of ranks, at the cost of all-gathering parameters just in time and reduce-scattering gradients — so it needs fast interconnect. Crucially it is orthogonal to inference parallelism: tensor and pipeline parallelism split the model for serving; ZeRO splits the optimiser state for training and does nothing for inference.',
  trap: 'The memory arithmetic is the point. Adam needs two fp32 moments per parameter — that is 8 bytes on top of 2 bytes of fp16 weights and 2 of gradients, so about 16 bytes per parameter before activations. That is why a 7B full fine-tune needs over 100 GB.',
  tags: ['training', 'parallelism'] },

{ id: 'tn24', topic: 'training', level: 2,
  q: 'What is a chat template and why does it matter when self-hosting?',
  lay: 'The model was trained with specific invisible markers separating who said what. If you use different markers, it is like handing someone a script with the character names in the wrong places — it mostly still reads, but slightly wrong, and it never tells you.',
  tech: 'Each instruct model defines special tokens delimiting system, user and assistant turns. Using a mismatched format degrades instruction-following measurably, and produces no error. Always use <span class="mono">tokenizer.apply_chat_template</span> rather than hand-building strings. When fine-tuning, apply the SAME template you will use at inference and mask the loss so it only covers assistant tokens — otherwise you train the model to generate the user\'s turn as well.',
  code: `msgs = [{"role": "system", "content": "You are terse."},
        {"role": "user",   "content": "Why is the sky blue?"}]
text = tokenizer.apply_chat_template(msgs, tokenize=False,
                                     add_generation_prompt=True)
# add_generation_prompt appends the assistant header so the model
# continues as the assistant instead of predicting a new user turn.`,
  trap: 'Loss masking is the subtle one. If your fine-tuning script computes loss over the prompt as well as the response, you are teaching the model to write the user\'s questions — which quietly degrades everything.',
  tags: ['chat-template', 'sft'] },

{ id: 'tn25', topic: 'training', level: 3,
  q: 'How would you build a fine-tuning dataset from production traffic?',
  lay: 'Take the conversations that went well, clean them up, get a human to confirm they really did go well, and keep them separate from the ones you will test on.',
  tech: '<ol><li><b>Collect</b> with consent and a clear retention policy; strip or tokenise PII at ingestion, not later.</li><li><b>Filter to successful interactions</b> — thumbs up, no escalation, task completed, no retry within a short window.</li><li><b>Human-verify a sample</b> and measure inter-annotator agreement before trusting the rest.</li><li><b>Deduplicate</b> near-identical prompts, which are heavily over-represented in real traffic and will dominate training.</li><li><b>Rebalance</b> — production traffic is long-tailed; upsample rare intents or the model gets better only at the easy majority.</li><li><b>Split by time</b>, not randomly, and hold out the most recent slice. A random split leaks future distribution into training and inflates your eval.</li><li><b>Version the dataset</b> and record which model version produced which rows, or you will end up distilling your own mistakes in a loop.</li></ol>',
  trap: 'The self-distillation loop is the trap: if you train on your own model\'s outputs that users happened not to complain about, you reinforce your existing failure modes. Always mix in human-written gold data.',
  tags: ['data', 'production'] },

{ id: 'tn26', topic: 'training', level: 2,
  q: 'What is the difference between prompt tuning, prefix tuning and LoRA?',
  lay: 'All three add a small number of trainable things to a frozen model. Prompt tuning learns a few invisible words to stick at the front. Prefix tuning learns invisible entries in the model\'s memory at every layer. LoRA learns small side-matrices next to the real weights.',
  tech: '<ul><li><b>Prompt tuning:</b> learn k soft embedding vectors prepended to the input. Tiny (a few thousand parameters), only competitive at very large model scale, and it consumes context length.</li><li><b>Prefix tuning:</b> learn key/value prefixes injected at every layer\'s attention. More capacity than prompt tuning, still small.</li><li><b>LoRA:</b> low-rank updates to the weight matrices themselves. Most capacity of the three, mergeable at inference for zero added latency, and the de facto standard.</li></ul>',
  compare: { cols: ['Prompt tuning', 'Prefix tuning', 'LoRA'],
    rows: [
      ['Where it acts', 'input embeddings', 'attention K/V at every layer', 'weight matrices'],
      ['Trainable parameters', 'smallest', 'small', 'small but largest of the three'],
      ['Costs context length', 'yes', 'no', 'no'],
      ['Mergeable at inference', 'n/a', 'no', 'yes — zero added latency'],
      ['Practical use today', 'rare', 'rare', 'the default']
    ] },
  trap: 'The mergeability point is why LoRA won commercially. Zero inference overhead after merging, plus hot-swappable adapters if you do not merge, is a combination the others cannot offer.',
  tags: ['peft'], orig: 5 },

{ id: 'tn27', topic: 'training', level: 3,
  q: 'What is model merging, and does it actually work?',
  lay: 'Averaging two fine-tuned models together to get one that does both jobs. Surprisingly, it often works — because both started from the same base and did not wander far.',
  tech: 'Combining weights of models fine-tuned from a common base. Methods: linear interpolation, SLERP (spherical interpolation, better for two models), TIES (resolves sign conflicts and prunes small deltas), and DARE (randomly drops and rescales deltas before merging). It works because fine-tunes from the same initialisation stay in a connected low-loss region, so the average is often also low-loss. Practical uses: combining a domain fine-tune with an instruction fine-tune, or averaging several checkpoints from one run (model soup) to reduce variance.',
  trap: 'It does not work across different base models or different architectures. And "it works" means "often, and you must measure" — merging is empirical, not principled, and it can silently degrade a capability neither parent lost.',
  tags: ['merging'] },

{ id: 'tn28', topic: 'training', level: 2,
  q: 'What is overfitting in the context of fine-tuning an LLM, and how do you spot it?',
  lay: 'The model stops learning the pattern and starts memorising your examples. It looks brilliant on your training data and worse than the base model on anything new — including things that are only slightly different.',
  tech: 'Signs: training loss falls while eval loss rises; the model reproduces training examples verbatim; outputs become rigid and template-like; performance drops on inputs slightly outside the training distribution. Prevention: 1–3 epochs, early stopping on eval loss, LoRA rather than full fine-tuning, dropout, more diverse data, and a genuinely held-out set. A specific LLM symptom worth naming: format lock-in, where the model produces your training format even when asked for something else.',
  trap: 'Eval loss is necessary but not sufficient. A model can have flat eval loss and still have lost the ability to say "I do not know", because your training set contained no refusals. Always eval behaviours, not just loss.',
  tags: ['overfitting', 'sft'] },

{ id: 'tn29', topic: 'training', level: 3,
  q: 'How do reasoning models differ in how they are trained?',
  lay: 'Ordinary models are taught to give the answer. Reasoning models are additionally trained to think first, and rewarded when the thinking leads to a verifiably correct answer — which means the training only works on problems where a program can mark the work.',
  tech: 'On top of standard SFT and preference tuning, reasoning models add RL on verifiable rewards: sample many long chains of thought per problem, score with a programmatic checker (does the maths answer match, do the tests pass, does the output parse), and optimise with a group-relative method like GRPO. Two consequences: the technique needs verifiable domains, so gains concentrate in maths, code and logic; and inference cost rises substantially because the model generates far more tokens, most of which the user never sees. Test-time compute becomes a knob — more thinking tokens, better answers, higher latency and cost.',
  trap: '"When should you not use one?" Simple extraction, classification, formatting or retrieval-grounded answering. You pay several times the tokens and latency for reasoning the task does not need, and on trivial tasks the extra deliberation can make the answer worse.',
  tags: ['reasoning', 'grpo'] },

{ id: 'tn30', topic: 'training', level: 2,
  q: 'What is synthetic data, and when is it safe to use?',
  lay: 'Data a model wrote for you to train another model on. Extremely useful for coverage of rare cases, and dangerous if you let it become most of your dataset — the copy of a copy gets blurry.',
  tech: 'Uses: generating edge cases you have no real examples of, augmenting a small seed set, creating preference pairs, and self-instruct style bootstrapping. Safeguards: always filter with a verifier or a human sample; keep a substantial fraction of real data; measure diversity (not just volume) because generators collapse toward their own modes; and never evaluate on synthetic data generated by the same model family you are testing. Model-collapse research shows recursive training on generated data degrades tail behaviour first, which is exactly where your hard cases live.',
  trap: '"How do you know it is not just amplifying the teacher\'s bias?" You do not, unless you sample and check against real data. That answer — measurement rather than assertion — is what interviewers are listening for.',
  tags: ['synthetic-data'] },

{ id: 'tn31', topic: 'training', level: 2,
  q: 'What does it cost, roughly, to fine-tune a model?',
  lay: 'Far less than people fear. A LoRA fine-tune of a 7B model on ten thousand examples is a few hours on one rented GPU — tens of dollars, not thousands. Full fine-tuning of a large model is a different conversation entirely.',
  tech: 'Rough orders of magnitude: LoRA on 7B, 10k examples, one A100 — a few hours, roughly $10–50 of rental. QLoRA on 70B, one 80 GB card — 12–24 hours, roughly $50–200. Full SFT on 7B — a multi-GPU node for a day, hundreds of dollars. Pretraining from scratch — millions. The dominant real cost is almost never the GPU time; it is producing and verifying the dataset, and building the eval suite that tells you whether the result is better.',
  trap: 'Say the data cost out loud. Teams routinely budget for compute and not for the two weeks of annotation that determines whether any of it works.',
  tags: ['cost', 'finetuning'] },

{ id: 'tn32', topic: 'training', level: 3,
  q: 'Your fine-tuned model performs worse than the base model. How do you debug it?',
  lay: 'Work backwards through the obvious causes: is the recipe wrong, is the data wrong, or is the comparison wrong? In practice it is usually the data or the template.',
  tech: '<ol><li><b>Check the chat template</b> — is training using the same format as inference? This is the single most common cause and it produces no error.</li><li><b>Check loss masking</b> — are you computing loss over the prompt as well as the response?</li><li><b>Look at the data</b> — sample 50 rows and read them. Inconsistent formats, truncated responses and duplicated rows are all common and all invisible in the metrics.</li><li><b>Check learning rate and epochs</b> — too high destroys the base; too many epochs memorises.</li><li><b>Check the comparison</b> — same prompts, same decoding parameters, same template on both sides? A base model evaluated with an instruct template is being sabotaged.</li><li><b>Check for forgetting</b> — run the general regression suite.</li><li><b>Try LoRA at a lower rank</b> as a control. If a tiny adapter helps and a big one hurts, you were over-fitting.</li></ol>',
  trap: 'Lead with the template and the loss mask. Both are silent, both are extremely common, and naming them first shows you have debugged this before rather than read about it.',
  tags: ['debugging', 'finetuning'] },

{ id: 'tn33', topic: 'training', level: 2,
  q: 'What is few-shot learning and how is it different from fine-tuning?',
  lay: 'Few-shot is showing examples in the message. Fine-tuning is changing the model. The first is free and instant and lasts one request; the second costs time and money and lasts forever.',
  tech: 'In-context learning conditions on demonstrations in the prompt without any weight update — mechanistically believed to rely on induction-head circuits. Fine-tuning changes weights permanently. Trade-offs: few-shot costs input tokens on EVERY request (though prompt caching largely removes that cost), is instantly reversible, and needs no infrastructure; fine-tuning has zero per-request overhead, can encode far more examples than fit in a window, and requires a training and evaluation pipeline. A common production shape is to start few-shot, log what works, and fine-tune once the example block gets too long to be worth resending.',
  trap: '"When does few-shot stop scaling?" When the examples no longer fit, when you need behaviour reliable at temperature 0 across thousands of calls, or when the example block costs more per request than amortised training would.',
  tags: ['few-shot', 'icl'] },

{ id: 'tn34', topic: 'training', level: 3,
  q: 'How do you serve many fine-tuned models without paying for many GPUs?',
  lay: 'Keep one copy of the big frozen model in memory and swap the small clip-on adapters per request. A hundred customers, a hundred adapters, one model.',
  tech: 'Multi-LoRA serving: load the base once, keep adapters (10–200 MB each) in host or device memory, and apply the correct one per request. Frameworks like S-LoRA and vLLM\'s multi-LoRA support batch requests using DIFFERENT adapters together with batched low-rank matmuls. Costs: a small latency overhead versus a merged model, plus memory for resident adapters. The alternative — one merged model per customer — is simpler and does not scale past a handful of tenants.',
  trap: 'The economics are the point: this is what makes per-customer fine-tuning commercially viable at all. Without it you are provisioning a GPU per tenant.',
  tags: ['lora', 'serving'], orig: 6 },

{ id: 'tn35', topic: 'training', level: 2,
  q: 'What is gradient checkpointing and why would you use it?',
  lay: 'Instead of keeping every intermediate result so you can retrace your steps, you keep a few checkpoints and recompute the bits in between when you need them. You trade time for memory.',
  tech: 'During the backward pass you need activations from the forward pass. Storing them all costs memory linear in depth × batch × sequence. Gradient (activation) checkpointing stores only a subset and recomputes the rest during backward — typically cutting activation memory by a large factor for roughly 20–30% extra compute. It is one of the standard knobs (alongside batch size, sequence length, ZeRO stage and mixed precision) that you turn when a training run does not fit.',
  trap: 'Interviewers like the ordered list of what you turn first when you hit OOM in training: gradient accumulation, then checkpointing, then ZeRO stage, then LoRA instead of full, then quantise the base. Knowing the order matters more than knowing the names.',
  tags: ['memory', 'training'] },

{ id: 'tn36', topic: 'training', level: 3,
  q: 'What is mixed-precision training and what is bf16 for?',
  lay: 'Do most of the arithmetic with fewer decimal places so it goes faster and uses less memory, but keep a full-precision copy of the important running totals so the small updates do not vanish.',
  tech: 'fp16 mixed precision keeps an fp32 master copy of weights and uses loss scaling to stop small gradients underflowing fp16\'s narrow range. bf16 has the same exponent range as fp32 with fewer mantissa bits, so it needs no loss scaling and is much more robust — which is why it is the default on modern hardware. Roughly 2× memory saving on activations and gradients, and a large speedup on tensor cores.',
  trap: '"Why did bf16 win over fp16?" Range, not precision. Training instabilities in fp16 come from overflow and underflow in the exponent, which bf16 simply does not have. It trades mantissa bits, which gradient descent tolerates well.',
  tags: ['precision', 'training'] },

{ id: 'tn37', topic: 'training', level: 2,
  q: 'What is the difference between SFT and preference tuning, in terms of what each can teach?',
  lay: 'SFT teaches "here is a good answer, imitate it". Preference tuning teaches "this one is better than that one" — which is a much easier thing for a human to provide, and it teaches things you cannot easily write down.',
  tech: 'SFT needs a gold response per prompt, so it is limited by your ability to WRITE good answers, and it gives no signal about what to avoid. Preference tuning needs only a comparison, which is faster to collect and captures qualities like tone, hedging, appropriate refusal and conciseness that are easy to recognise and hard to specify. In practice SFT establishes the capability and format; preference tuning sharpens the behaviour. Skipping SFT and running DPO on a base model works poorly, because DPO assumes a reasonable starting policy.',
  trap: '"Can you do preference tuning without SFT first?" Technically yes, in practice badly. The reference model in DPO is the SFT model; without it, β is regularising toward something that does not follow instructions.',
  tags: ['sft', 'dpo'], orig: 49 },

{ id: 'tn38', topic: 'training', level: 3,
  q: 'What is the "alignment tax" and does it still exist?',
  lay: 'The observation that making a model safer and more helpful used to make it slightly worse at raw capability tasks — the price of politeness.',
  tech: 'Early RLHF work reported measurable regressions on benchmarks after alignment, attributed to distribution shift away from the pretrained distribution and to the KL constraint limiting exploration. Modern practice has largely closed the gap: better SFT data, mixing pretraining data into the alignment stage, and preference methods with tighter regularisation. Some cost remains in specific places — over-refusal on benign requests is the most visible, and it is a real product problem.',
  trap: 'Over-refusal is worth naming as the modern form of the tax. A model that refuses to help with a legitimate security question, or will not write a test that mentions a password, is failing users in a way that shows up in your escalation rate rather than your safety metric.',
  tags: ['alignment'] },

{ id: 'tn39', topic: 'training', level: 2,
  q: 'How do you decide between fine-tuning a small model and prompting a large one?',
  lay: 'Compare total cost of ownership, not headline price. A big model needs no training, no eval suite and no MLOps, but costs more per call forever. A small fine-tuned model costs weeks up front and pennies per call.',
  tech: 'The crossover is a volume calculation. Sketch it explicitly: (large model cost per request × requests) versus (small model cost per request × requests + training cost + engineering cost + ongoing eval and retraining). At a few thousand requests a day, prompting a large model almost always wins. At millions, a distilled small model wins decisively. Also weigh non-cost factors: latency (a small model is genuinely faster), data residency, vendor lock-in, and whether you have the team to own a training pipeline.',
  trap: 'The engineering cost is the term people leave out and then regret. A fine-tuned model needs an eval suite, a retraining trigger, a rollback plan and someone who owns it. That is a person, not a line item.',
  tags: ['cost', 'decision'], orig: 28 },

{ id: 'tn40', topic: 'training', level: 3,
  q: 'Your model needs to answer questions about documents that change weekly. Fine-tune or retrieve? Defend it.',
  lay: 'Retrieve. Weights are a terrible place for facts that change — you cannot update one, you cannot cite one, you cannot delete one, and you would be retraining every week to keep up.',
  tech: 'Retrieval, and the argument has five parts: <ol><li><b>Freshness</b> — an index update is seconds; a fine-tune is days and would need to be weekly forever.</li><li><b>Citations</b> — you know which chunk you sent, so the answer can be attributed and checked.</li><li><b>Deletion</b> — removing a document from an index is immediate; removing a fact from weights is not reliably possible.</li><li><b>Permissions</b> — retrieval can filter by the caller\'s access; weights cannot.</li><li><b>Debuggability</b> — you can inspect exactly what was retrieved and why. A wrong answer from weights has no trace.</li></ol>Fine-tuning still has a role here — teaching the model your citation format, your refusal behaviour and your tone — but not as the knowledge store.',
  trap: 'If the interviewer pushes ("but fine-tuning is cheaper per request"), agree on the token cost and reframe: you are not comparing costs, you are comparing a system that can be corrected with one that cannot.',
  tags: ['rag', 'finetuning'], orig: 5 }

]);
