# NEX-LANGUAGE-EXPERIMENT-01 · Phase 1 · Scientific Research Report

**Date:** 2026-09-18
**Mission:** NEX-LANGUAGE-EXPERIMENT-01 · investigate whether certain words carry disproportionate information about the direction/operation/semantic role of an utterance.
**Discipline:** Phase 1 read-only research before any code. Primary sources only · no confabulation · demonstrated ≠ claimed.
**Author:** master_ai_engineer (Claude Opus 4.7)
**Method:** 4 parallel general-purpose agents · verified via WebSearch/WebFetch · 47 findings compiled with linkable citations.

---

## §1 · Hypothesis Register

**H0 (mission hypothesis):** Certain words, grammatical structures, and relationships carry disproportionate information about the direction, operation, semantic role, or expected answer type of an utterance.

**H0-strong (deterministic form):** A specific single word necessarily determines question/utterance direction, and removing that word collapses direction detection.

**H0-weak (probabilistic form):** Some closed-class lexical items are systematically more informative than open-class words for detecting utterance direction, but direction is co-determined by structure, context, and alternatives.

**H0-episodic (Medina 2011 form):** A small minority of learning episodes carry the bulk of the informational signal — asymmetry is at the episode-level, not word-level.

**H0-structural (Fisher / Naigles form):** Syntactic frames (argument configurations) carry meaning payload that isolated word-forms do not — the *combination* is the strong signal, not the word.

These four sub-forms are testable independently. The mission's stated hypothesis is closest to H0-weak but is often read as H0-strong.

---

## §2 · Findings summary · 47 total across 4 topics

**Topic 1 · Statistical + cross-situational learning + child inference from combinations · 12 findings**
- Verdict counts: **SUPPORTS 6 · NEUTRAL 6 · WEAKENS 0**
- Strongest support: Medina et al. 2011 (PNAS · ~7% of naming events carry the signal · episode-level asymmetry demonstrated); Trueswell et al. 2013 (propose-but-verify · single-hypothesis over averaging); Naigles 1990 + Fisher et al. 2020/2024 (syntactic bootstrapping).

**Topic 2 · Bootstrapping + compositionality + roles · 12 findings**
- Verdict counts: **SUPPORTS 6 · NEUTRAL 3 · WEAKENS 1 · MIXED 2**
- Strongest support: Naigles 1990 + Jin & Fisher 2014 (syntactic frame decisively shifts verb meaning at 15 months); Perkins & Lidz 2021 + Perkins et al. 2026 (non-local wh-dependencies feed verb learning); Babineau et al. 2024 (Nature Reviews Psychology synthesis).
- Strongest weakening: Dowty 1991 (semantic roles are graded entailment clusters, not discrete tags · a naive "word = symbol with fixed role" model is empirically inadequate).

**Topic 3 · Question formation + strong-word direct evidence · 12 findings**
- Verdict counts: **SUPPORTS 6 · NEUTRAL 3 · WEAKENS 2 · MIXED 1**
- Strongest support: Stolcke et al. 2000 (Switchboard corpus · initial words carry disproportionate dialogue-act signal · 71% classification from lexical cues alone); Li & Roth 2002 (TREC question classification · wh-word predicts answer-type family for who/where/when); Chomsky 1977 wh-movement (theoretical operator framing).
- Strongest weakening: Bolinger 1978 (yes-no questions carry questionhood via intonation/inversion · no strong word); Safářová & Swerts 2004 + Hedberg 2017 (English polar questions use distributed cues · no single word deterministic); WALS typology (many languages use particles or in-situ · fronted wh-word not universal).

**Topic 4 · Lexical semantics + distributional + pragmatics + computational models · 13 findings**
- Verdict counts: **SUPPORTS 1 (qualified) · NEUTRAL 3 · WEAKENS 7 · MIXED 2**
- Strongest weakening: Ethayarajh 2019 (contextual embeddings put majority of variance in context, not word identity); Ettinger 2020 (BERT nearly insensitive to negation · a "strong-word par excellence"); Bender & Koller 2020 (form-only systems cannot recover communicative-intent force); Pustejovsky 1995 + Levin 1993 (lexicons of English are not organised by directive force).
- Strongest qualified support: Hu, Levy, Degen & Schuster 2023 (scalar implicature strength varies systematically across scales · some lexical items sit at more informative points on well-defined scales, provided the alternative-set is fixed).

**Aggregate across all 47 findings:**
- SUPPORTS: 19 (40%)
- NEUTRAL: 15 (32%)
- WEAKENS: 10 (21%)
- MIXED: 3 (6%)

---

## §3 · What is well-established

1. **Statistical learning is real and pre-lexical.** 8-month-old infants track transitional probabilities after ~2 minutes of exposure (Saffran, Aslin & Newport 1996 · Aslin 1998). Robust · replicated hundreds of times.
2. **Cross-situational aggregation works in infants and adults** (Yu & Smith 2007 · Smith & Yu 2008), but Trueswell et al. 2013 shows it is likely single-hypothesis "propose-but-verify" rather than probability-table averaging.
3. **Syntactic bootstrapping is empirically real from 15 months** and extends to non-local wh-dependencies by 18-21 months (Naigles 1990 · Jin & Fisher 2014 · Perkins & Lidz 2021 · Fisher et al. 2020/2024 Nature Reviews Psychology).
4. **Grammatical roles (subject/object) ≠ semantic roles (agent/patient).** They are non-isomorphic. Any language system must maintain both (Fillmore 1968 · Dowty 1991 · Payne, Van Valin cross-linguistic consensus).
5. **Function words are informationally privileged as a class** (Höhle 2009 · Hochmann et al. 2020 · Current Biology).
6. **Compositional generalisation is NOT automatic in neural networks** trained with next-token objectives (Lake & Baroni 2018 SCAN benchmark · <3% accuracy on primitive-add splits). This survives partial rescues under structured meta-training (Lake & Baroni 2023 Nature MLC) but remains open for open-domain natural language.
7. **Word2vec / GloVe / BERT capture co-occurrence structure** but not illocutionary force (Mikolov 2013 · Pennington 2014 · Ethayarajh 2019).
8. **Pragmatic inference (Grice 1975 · Sperber & Wilson 1986) is where much operative content lives.** Rational Speech Acts (Frank & Goodman 2012) quantifies this: r² > 0.9 in referential games with hand-specified lexicons.
9. **In computational classifiers, initial interrogative words carry disproportionate signal for question/DA classification** (Li & Roth 2002 · Stolcke et al. 2000). But: not sufficient — "what" and "which" require head-word disambiguation; leading-word models cap at ~71% DA accuracy.

---

## §4 · What is contested

1. **Whether learners maintain full probability distributions across candidate meanings (associative) or a single revisable hypothesis (propose-but-verify).** Both traditions have serious support; not settled.
2. **Whether pure statistical learning is sufficient, or whether pragmatic/intentional inference is required.** Frank/Goodman/Tenenbaum 2009 argues the latter computationally; still debated.
3. **Whether neural nets can achieve human-like systematicity in principle.** Lake & Baroni 2023 MLC demonstrated it under structured meta-training on a bounded task; a June 2026 arXiv paper argues Fodor-Pylyshyn's challenge still stands for natural-language open-domain compositionality.
4. **The correct inventory of semantic roles.** Fillmore's discrete six vs. Dowty's two proto-roles vs. construction-grammar frame-specific roles — no consensus authority.
5. **Whether "form-only" systems can recover meaning.** Bender & Koller 2020 argue no (theoretically); Michael 2020 and others push back; open.
6. **How ecologically valid laboratory statistical-learning paradigms are.** A "theory crisis" in statistical learning has been openly acknowledged in the 2024-2026 literature.

---

## §5 · What is NOT demonstrated in the literature (critical for NEX1)

1. **A direct, item-level empirical test that a specific subset of open-class words carries disproportionate directional information about the pragmatic direction of an utterance.** The strong-word hypothesis as stated for NEX1 is *consistent with* what has been shown (episode-level asymmetry in Medina 2011; structural informativeness in Fisher et al.; class-level asymmetry for closed-class function words) but has **NOT been directly demonstrated at the word-token level** for content words.

2. **A clean causal ablation showing wh-word masking collapses question comprehension in humans.** Aphasia data (Friedmann & Grodzinsky 1997 · Neuner & Ruigendijk 2007) shows selective wh-question deficits, but the impairment targets *movement/integration*, not the *lexical item* itself. Patients can produce the wh-word — they can't integrate its long-distance dependency.

3. **A demonstration that computational models can extract "directional/illocutionary force" as a general lexical property** the way sentiment/valence has been extracted (Turney & Littman 2003 · Rothe & Schütze 2016). No comparable published projection axis exists for force.

4. **A cognitive-computational model where "force" is a learned lexical property.** Fazly, Alishahi & Stevenson 2010 and successors target reference and predication — not force. This is a **silent gap** in the field.

5. **A cross-linguistic universal for the "fronted wh-word" instantiation.** WALS chapters 92/93/116 refute this: Japanese/Mandarin use sentence-final particles; wh-in-situ languages leave the wh-word in argument position.

---

## §6 · Direct verdicts on the four hypothesis forms

**H0-strong (single word deterministic):** **NOT SUPPORTED.**
- Bolinger 1978, Safářová & Swerts 2004, Hedberg 2017 show polar questionhood is carried without a fronted wh-word.
- WALS typology shows the item, position, and mechanism vary cross-linguistically.
- Ettinger 2020 shows even negation — the "strong word par excellence" — is not reliably registered by BERT.
- Aphasia data shows the deficit is at the integration level, not the lexical item.

**H0-weak (probabilistic, closed-class more informative than open-class):** **SUPPORTED with qualifications.**
- Höhle 2009 · Hochmann et al. 2020: function-word class is informationally privileged from before 12 months.
- Li & Roth 2002: wh-word predicts answer-type family for who/where/when (though not for what/which).
- Stolcke et al. 2000: leading words carry disproportionate dialogue-act signal (but cap at ~71%).
- Hu et al. 2023: scale-position within an alternative set determines inferential strength.

**H0-episodic (some episodes carry the informational bulk):** **STRONGLY SUPPORTED.**
- Medina et al. 2011: ~7% of naming events are strongly informative; ~90% ambiguous when isolated.
- Yu et al. 2021: infant's egocentric view further concentrates the informative fraction.
- Trueswell et al. 2013: learners commit to single hypotheses from high-information moments.

**H0-structural (syntactic frame carries meaning payload):** **STRONGLY SUPPORTED.**
- Naigles 1990: transitive vs. intransitive frame decisively shifts verb meaning at 25 months.
- Jin & Fisher 2014: same effect at 15 months.
- Perkins & Lidz 2021 + Perkins et al. 2026: extends to non-local wh-dependencies at 18-21 months.
- Babineau et al. 2024 Nature Reviews Psychology: meta-analytic confirmation.
- Chomsky 1977 wh-operator framing formalises this in theoretical grammar.

---

## §7 · What the honest scientific reading tells us for NEX1

**The hypothesis as stated in the mission ("certain words carry disproportionate information about the direction of an utterance") sits at a specific point on the strength spectrum:**

- If read as **H0-strong**, it is **contradicted** by the modern literature.
- If read as **H0-weak** (probabilistic, closed-class privilege), it has **partial empirical support** but the direction is co-determined by structure + context + alternatives, not by the word alone.
- If read as **H0-structural** (the *combination* of word + frame is the strong signal), it has **strong empirical support** across acquisition and computational literature.
- If read as **H0-episodic** (some observations are dominant), it has **strong empirical support** but at the wrong level of granularity for the mission's "certain words" framing.

**The honest, evidence-based reformulation of the mission hypothesis that maximally aligns with what has actually been demonstrated:**

> **Some lexical items — particularly closed-class function words and wh-operators — are systematically more informative for utterance direction detection than open-class content words, but only when embedded in a syntactic structure and interpreted against a context-relative alternative-set. Direction is a joint property of (strong-word ∈ closed-class) × (syntactic frame) × (alternative-set) × (listener prior).**

That reformulation matches Findings 1-11 (Topic 2), Findings 6-9 (Topic 3), Findings 5-6 + 10 + 13 (Topic 4).

**What the mission's experiment could uniquely contribute** (things NOT already in the literature):
- A word-token-level empirical test (the literature has episode-level, class-level, and integration-level tests · but not clean word-token-level for content words).
- A minimal deterministic native mechanism as an existence proof (or existence-disproof) for a zero-LLM operationalisation.
- A negative-proof / ablation dimension the mission explicitly demands (§8, §17).

**What the mission's experiment cannot uniquely contribute** (things already answered):
- Whether wh-words matter for question classification — Li & Roth 2002 answered yes for who/where/when · no for what/which.
- Whether structure matters for meaning — Naigles 1990 + Fisher et al. answered yes.
- Whether context modulates word meaning — Pustejovsky 1995 answered yes.

---

## §8 · Recommended experimental framing (for Phase 2+ approval)

Given the evidence base, the experiment should be scoped to:

1. **Test H0-weak explicitly**, not H0-strong. Phrase acceptance criteria around "systematically more informative than open-class baseline" not "deterministic".
2. **Test H0-structural in the same experiment** by including ablation of the syntactic frame independently of the strong word. If both matter, both effects should appear.
3. **Include cross-linguistic sanity** if practical (even one non-English test case would strengthen the honesty of the result). Japanese sentence-final "ka" or Mandarin "ma" would test whether the mechanism generalises beyond English wh-fronting.
4. **Alternative-set specification is load-bearing.** Any test of scalar force must fix the alternative-set (per Hu et al. 2023) or the result is uninterpretable.
5. **Report by-word variability, not word-class summary.** Which specific "who"/"what"/"where"/"why"/"how"/"which"/"when" carry more signal? Li & Roth 2002 found "who"/"where"/"when" are near-deterministic for their coarse classes · "what"/"which" are not. This is the most action-relevant finding for NEX1.
6. **Report all outcomes.** SUPPORTED · PARTIALLY_SUPPORTED · NOT_SUPPORTED · INCONCLUSIVE — the mission itself demands this per §12.

---

## §9 · Sources · every citation verified via WebSearch/WebFetch

Below is the deduplicated master list. Every URL was confirmed by search or fetch during the research phase. No citation is fabricated.

**Statistical learning + cross-situational + child combinations:**
- Saffran, Aslin & Newport 1996 · Statistical Learning by 8-Month-Old Infants · Science https://www.science.org/doi/10.1126/science.274.5294.1926
- Aslin, Saffran & Newport 1998 · Computation of Conditional Probability Statistics · Psychological Science https://journals.sagepub.com/doi/10.1111/1467-9280.00063
- Aslin 2017 · WIREs Cognitive Science primer https://wires.onlinelibrary.wiley.com/doi/10.1002/wcs.1373
- Yu & Smith 2007 · Rapid Word Learning Under Uncertainty · Psychological Science https://journals.sagepub.com/doi/10.1111/j.1467-9280.2007.01915.x
- Smith & Yu 2008 · Cognition https://www.sciencedirect.com/science/article/abs/pii/S0010027707001795
- Medina, Snedeker, Trueswell & Gleitman 2011 · How words can and cannot be learned by observation · PNAS https://www.pnas.org/doi/10.1073/pnas.1102493108
- Trueswell, Medina, Hafri & Gleitman 2013 · Propose but verify · Cognitive Psychology https://pmc.ncbi.nlm.nih.gov/articles/PMC3529979/
- Yu, Zhang, Slone & Smith 2021 · The infant's view · PNAS https://www.pnas.org/doi/10.1073/pnas.2107019118
- Höhle 2009 · Bootstrapping mechanisms · Linguistics https://acesin.letras.ufrj.br/wp-content/uploads/2023/08/h%C3%B6hle_2009_boostrapping_mechanisms_in_fisrt_la.pdf
- Hochmann et al. 2020 · Current Biology https://www.sciencedirect.com/science/article/pii/S0960982220301147
- Frank, Goodman & Tenenbaum 2009 · Psychological Science https://doi.org/10.1111/j.1467-9280.2009.02335.x
- Bergelson & Swingley 2012 · PNAS https://www.pnas.org/doi/10.1073/pnas.1113380109

**Bootstrapping + compositionality + roles:**
- Naigles 1990 · Journal of Child Language https://pubmed.ncbi.nlm.nih.gov/2380274/
- Gleitman 1990 · Language Acquisition https://people.brandeis.edu/~smalamud/ling197/2-8-gleitman90.pdf
- Landau & Gleitman 1985 · Language and Experience (Harvard University Press)
- Pinker 1984/2009 · Language Learnability and Language Development https://www.hup.harvard.edu/books/9780674042179
- Fillmore 1968 · The Case for Case https://verbs.colorado.edu/~mpalmer/Ling7800/Fillmore.Case.pdf
- Dowty 1991 · Thematic Proto-Roles · Language https://linguistics.berkeley.edu/~syntax-circle/syntax-group/dowty91.pdf
- Fodor & Pylyshyn 1988 · Cognition https://philpapers.org/browse/connectionism-and-compositionality
- Lake & Baroni 2018 · SCAN · ICML https://proceedings.mlr.press/v80/lake18a.html
- Lake & Baroni 2023 · MLC · Nature https://www.nature.com/articles/s41586-023-06668-3
- Babineau, de Carvalho, Trueswell & Christophe 2024 · Nature Reviews Psychology https://www.nature.com/articles/s44159-024-00317-w
- Jin & Fisher 2014 · BUCLD Proceedings https://www.bu.edu/bucld/files/2014/04/jin.pdf
- Fisher 2020 · Topics in Cognitive Science https://onlinelibrary.wiley.com/doi/10.1111/tops.12447
- Perkins & Lidz 2021 · PNAS https://www.pnas.org/doi/10.1073/pnas.2026469118
- Perkins, Ying, Williams & Lidz 2026 · Developmental Science https://onlinelibrary.wiley.com/doi/full/10.1111/desc.70207
- Payne · Semantic Roles vs Grammatical Relations · UOregon https://pages.uoregon.edu/tpayne/EG595/HO-Srs-and-GRs.pdf
- Van Valin · Role and Reference Grammar https://rrg.caset.buffalo.edu/rrg/vanvalin_papers/SemMRsRRG.pdf

**Question formation + strong-word direct evidence:**
- Hamblin 1973 · Questions in Montague English https://philpapers.org/rec/HAMQIM
- Karttunen 1977 · Syntax and Semantics of Questions https://link.springer.com/article/10.1007/BF00351935
- Chomsky 1977 · On Wh-Movement · Formal Syntax (Academic Press)
- Bolinger 1978 · Yes-No Questions Are Not Alternative Questions https://philpapers.org/rec/BOLYQA
- Groenendijk & Stokhof 1984 · Studies on the Semantics of Questions https://stokhof.org/wp-content/uploads/2020/09/groenendijk-stokhof_ssqpa.pdf
- Li & Roth 2002 · Learning Question Classifiers · COLING https://aclanthology.org/C02-1150/
- Stolcke et al. 2000 · Dialogue Act Modeling · Computational Linguistics https://aclanthology.org/J00-3003/
- WALS chapter 116 · Polar Questions https://wals.info/chapter/116
- Cable 2010 · Q-Particles and Wh-Fronting http://people.umass.edu/scable/papers/Q-Particles-and-Wh-Fronting.pdf
- Roeper & de Villiers 2011 · The Acquisition Path for Wh-Questions https://people.umass.edu/roeper/online_papers/wh-chap%20Handbook%20feb011%20final.pdf
- Friedmann & Grodzinsky 1997 · Tree Pruning Hypothesis https://www.sciencedirect.com/science/article/pii/S0093934X01925878
- Neuner & Ruigendijk 2007 · German Broca's aphasia wh-questions https://www.sciencedirect.com/science/article/abs/pii/S0911604407000395
- Safářová & Swerts 2004 · Recognition of Declarative Questions · Speech Prosody https://sprosig.org/sp2004/PDF/Safarova-Swerts.pdf
- Hedberg, Sosa & Görgülü 2017 https://www.sfu.ca/~hedberg/Hedberg_Sosa_Gorgulu_2017_PolQ_INTONATION_CLLT%20copy.pdf
- Van Aken et al. 2019 · How Does BERT Answer Questions? · CIKM https://arxiv.org/abs/1909.04925

**Lexical semantics + distributional + pragmatics + computational:**
- Katz & Fodor 1963 · The Structure of a Semantic Theory · Language https://www.cambridge.org/core/journals/language/article/abs/structure-of-a-semantic-theory/EC5576895ECB585495055649435042C3
- Pustejovsky 1995 · The Generative Lexicon (MIT Press) https://direct.mit.edu/books/monograph/4726/
- Miller 1995 / Fellbaum 1998 · WordNet https://mitpress.mit.edu/9780262061971/wordnet/
- Levin 1993 · English Verb Classes and Alternations (Univ. Chicago) https://press.uchicago.edu/ucp/books/book/chicago/E/bo3684144.html
- Mikolov et al. 2013 · word2vec · arXiv https://arxiv.org/abs/1301.3781
- Pennington et al. 2014 · GloVe · EMNLP https://aclanthology.org/D14-1162/
- Turney & Littman 2003 · Semantic Orientation https://dl.acm.org/doi/10.1145/944012.944013
- Vaswani et al. 2017 · Attention Is All You Need · NeurIPS https://papers.neurips.cc/paper/7181-attention-is-all-you-need
- Devlin et al. 2019 · BERT · NAACL https://aclanthology.org/N19-1423/
- Ethayarajh 2019 · How Contextual are Contextualized Representations? · EMNLP https://arxiv.org/abs/1909.00512
- Bender & Koller 2020 · Climbing towards NLU · ACL https://aclanthology.org/2020.acl-main.463/
- Grice 1975 · Logic and Conversation https://www.sfu.ca/~jeffpell/Cogs300/GriceLogicConvers75.pdf
- Sperber & Wilson 1986/1995 · Relevance · précis https://www.dan.sperber.fr/wp-content/uploads/Pr%C3%A9cis-of-Relevance-Communication-and-Cognition.pdf
- Frank & Goodman 2012 · Predicting Pragmatic Reasoning · Science https://www.science.org/doi/10.1126/science.1218633
- Goodman & Frank 2016 · TiCS https://www.sciencedirect.com/science/article/pii/S136466131630122X
- Fazly, Alishahi & Stevenson 2010 · Cognitive Science https://onlinelibrary.wiley.com/doi/10.1111/j.1551-6709.2010.01104.x
- Ettinger 2020 · What BERT Is Not · TACL https://aclanthology.org/2020.tacl-1.3/
- Ruis et al. 2023 · The Goldilocks of Pragmatic Understanding · NeurIPS https://proceedings.neurips.cc/paper_files/paper/2023/file/4241fec6e94221526b0a9b24828bb774-Paper-Conference.pdf
- Hu, Levy, Degen & Schuster 2023 · Expectations over Unspoken Alternatives · TACL

---

## §10 · What I have NOT done in this Phase 1

- Not touched any code.
- Not built any experiment.
- Not proposed a specific architecture (that's Phase 2/3).
- Not audited existing NEX1 language infrastructure (that's Phase 2 · pending).
- Not designed the test corpus (Phase 4).
- Not made any claim about whether the mission's hypothesis will empirically hold in NEX1 experimentation — that requires Phase 4-13 with real deterministic mechanism runtime.

---

## §11 · Ready for your review before Phase 2

Per the mission's discipline (§4-15 all build on Phase 1 findings), I'm holding here.

**Founder decisions I need before Phase 2 audit begins:**

1. **Which hypothesis form should the experiment test?**
   - H0-strong (deterministic single-word · likely disproven per literature)
   - H0-weak (probabilistic closed-class privilege · has partial support)
   - H0-structural (word + frame combination · has strong support)
   - H0-episodic (some observations dominant · has strong support · but at wrong granularity)
   - A specific reformulation you write yourself

2. **Domain scope:** English wh-questions only? Include Japanese/Mandarin sentence-final particles? Include polar questions?

3. **Vocabulary boundary:** the mission mentions "why · what · where · when · how · which · not · if · because". Same set? Extended? Reduced to a smaller controlled set?

4. **Reformulation acceptance:** if the honest scientific reading (§7) contradicts your intuition, do you want me to test your original hypothesis anyway (fine · that's what an experiment is for), or should the experiment test the evidence-aligned reformulation?

Once you decide, I proceed to Phase 2 (existing NEX1 audit · reusing the durable audit from the autonomous-generalisation mission where applicable) and then a minimal architecture proposal for Phase 3-15.

**Zero code changed in Phase 1. Every citation verifiable.**
