# JLPT N5 → N4 Trainer

Offline study app for JLPT N5 and N4. Open `index.html` in any browser — no install,
no build step, no server, no internet. Progress lives in that browser's `localStorage`.

## What is in it

| Deck | N5 | N4 |
|---|---|---|
| Kana (hiragana, katakana, dakuten, youon, loanword combos) | 224 | — |
| Kanji (meaning, on-yomi, kun-yomi) | 103 | 194 |
| Vocabulary (word, reading, meaning, part of speech) | 487 | 460 |
| Grammar (pattern, meaning, Japanese + English example) | 79 | 80 |

1627 cards total.

## Screens

- **Kana** — full chart, tap a character for its reading, or drill the whole script as flashcards.
- **Kanji / Vocab** — two modes per deck, toggled by the Learn / Drill chips:
  - *Learn* (the default) lists the whole deck. Tap a kanji for its on-yomi, kun-yomi and the
    words in the vocab deck that use it; tap a word for its part of speech and a breakdown of
    every kanji inside it. Mastered entries are labelled.
  - *Drill* runs a spaced-repetition flashcard session of 20.
- **Grammar** — every pattern with a worked example sentence; also drillable as flashcards.
- **Quiz** — 10 multiple-choice questions from any deck and level.
- **Mock exam** — full timed papers in the official JLPT layout (see below).
- **Progress** — mastery ring, per-deck bars, streak, review counts.

Keyboard during a session: `space` flips the card, then `1` again, `2` good, `3` easy.

## Romaji

Every kana reading is shown with its romaji underneath — わるい / *warui* — on flashcards, in the
learn lists, in the kanji detail panes and on quiz prompts. It is generated at load time by
`romaji()` in `app.js`, which reads its table straight out of `data/kana.js`, so adding a kana row
teaches the converter too. It handles youon (きゃ → kya), sokuon (がっこう → gakkou, ちょっと →
chotto), long vowels (コーヒー → koohii) and syllabic n (きんえん → kin'en).

Particles are handled: を is always *o*, and は / へ become *wa* / *e* when a space follows, which
is how the readings in `data/` are written. Coverage is complete — every vocab word, every kanji
reading, every grammar pattern and every grammar example sentence.

Grammar example sentences contain kanji, which has no derivable reading, so their kana is stored
in `data/grammar-readings.js` as `pattern: [pattern reading, sentence reading]` and the romaji is
generated from that. Each grammar entry therefore shows four lines: kanji, kana, romaji, English.

## Kanji mnemonics

`data/mnemonics.js` holds one memory hook per kanji, keyed by the character — mostly component
breakdowns, so 校 reads as "tree 木 plus crossing 交: the wooden building where everyone crosses
paths". It shows in the kanji detail pane and on the back of every kanji flashcard.

The Kanji screen also opens with a **Tips for remembering kanji** panel: learning components rather
than pictures, when on-yomi beats kun-yomi, the radical-to-meaning map, phonetic components that
carry their reading across characters, the look-alike pairs worth drilling together, and stroke
order rules.

## Mock exams

Three papers per level, laid out in the real JLPT 問題 order with the official per-section time
limits. Each paper runs its sections one after another with a countdown that auto-submits at zero.

| | N5 | N4 |
|---|---|---|
| 言語知識（文字・語彙） | 20 min | 25 min |
| 言語知識（文法）・読解 | 40 min | 55 min |
| Questions per paper | 53 | 57 |

Parts covered: 漢字読み, 表記, 文脈規定, 言い換え類義, 用法 (N4), 文法形式の判断, 文の組み立て,
文章の文法, 内容理解（短文）, 内容理解（中文）, 情報検索.

**These are original practice papers, not copies of real past papers.** Past JLPT papers are
copyrighted by JEES and the Japan Foundation, so the questions here were written from scratch to
match the published format, question counts and difficulty.

**聴解 is not included** — it needs audio files this app does not ship. What a paper here covers is
exactly the half the real exam scores 0–120. The result panel scales your raw score to that 120,
checks it against the 38-point section minimum, and tells you how many of the 60 listening points
you would still need to reach the overall pass mark (80 for N5, 90 for N4).

漢字読み and 表記 are generated from the vocab deck at the start of every sitting, and all four
options are reshuffled per question, so retaking a paper is not the same paper twice. After
scoring you can review every question with the correct answer and an explanation in Japanese.
Your best scaled score per paper is saved.

## How the reviews are scheduled

Leitner boxes. A card sits in box 0–5; the next review is 0, 1, 2, 4, 8 or 16 days out.
`again` drops it to box 0 and re-queues it inside the same session, `good` moves it up one,
`easy` two. Box 4 or higher counts as **mastered** on the progress screen.

## Adding your own cards

Each data file is a plain array of arrays — append a line and reload.

```js
data/kana.js      ["あ","a","h"]                                    // char, romaji, h|k
data/kanji.js     ["日","sun, day","ニチ・ジツ","ひ・か","N5"]        // char, meaning, on, kun, level
data/vocab-n5.js  ["食べる","たべる","to eat","N5","verb"]           // word, reading, meaning, level, pos
data/vocab-n4.js  same shape, pushed onto the same array
data/grammar.js   ["〜てから","after doing","ごはんを食べてから、テレビを見ます。","After eating, I watch TV.","N5"]
```

A word listed at both levels keeps the lower one, so duplicates across the two vocab files
are harmless.

## Self-check

Open `test.html`. It asserts the data shape, that no two cards share an id, that the box
schedule behaves, and that every quiz gives four distinct options containing the answer.

## Is it enough to pass?

The grammar list covers the published N5 and N4 syllabus, and the kanji list covers both
levels in full. Vocabulary is the ~950 highest-frequency words rather than the full ~1500
N4 list — enough to sit both exams comfortably, and the file is trivial to extend if you
want the long tail.
