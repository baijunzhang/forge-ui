# Weekly Update – Week 2 (condensed, table form)

**Subject: Weekly Update – Desk Learnings, Product Progress and AI Markets Opportunities**

Hi [Manager's Name],

Hope you are well. This week I focused on understanding desk workflows and product knowledge, translating desk feedback into AI Markets opportunities, and contributing to AI Markets Desktop and the Wealth Sales automation project. I spoke with several desks and joined a Wealth Sales client meeting with Futu.

## 1. Desk shadowing — key learnings and AI Markets opportunities

| Desk | Focus & Key Inputs | Pain Point / Need | AI Markets Opportunity |
|------|--------------------|--------------------|------------------------|
| **Wealth Retail** | Distribution chain MSS → WPB → retail; structured products & bonds; tokenisation to fractionalise bond exposure into smaller clips | High minimum denominations block retail access; needs full end-to-end (regulation, custody, settlement, suitability, documentation) | Support the tokenised distribution workflow end-to-end, not just the UI |
| **G10 Rates Trading** | Market making in G10 rates (govvies, swaps); macro views, client flows, position sizing, risk; eRisk client data | Wants stronger IT integration, capital efficiency and Macro synergy; client info embedded in voice trading / experience | Client-flow analysis, scenario tools, systematise voice-trading knowledge into decision support |
| **Corporate Sales** | FX forwards, FX swaps, cross-currency swaps linked to corporate flows (imports, exports, financing, balance-sheet exposures); combines Markets pricing with HSBC balance sheet, payments, trade finance | Manual RFQ handling; data quality, client classification and entity mapping must be reliable | Extract RFQ from Bloomberg, route to the right trader, return the price to Sales for review |
| **FX Structuring** | Converts a client view / hedging / yield-enhancement target into product parameters, payoff scenarios and a term sheet | Sales→Structuring handoff is manual across email/chat/screenshot/file; repetitive reformatting into Excel | Read varied formats, extract view/pair/tenor/objective/constraints, flag missing fields, output a standardised Excel/blotter for review |
| **Prime Sales** | Prime services — swaps (TRS), Delta One, financing, securities borrowing & lending (SBL), market access, onboarding; client models differ (quant vs long-short) | Platform adoption; understanding how a client allocates business across prime brokers | Client-activity dashboards, onboarding status, product usage, relationship intelligence |
| **Electronic Trading / Cash Equities Execution** | High-touch, low-touch, programme and algo execution; benchmarks (VWAP/TWAP/IS), connectivity, post-trade analytics, low-latency; HK/SEA market structure | Clients assess system stability and execution quality vs benchmark; abnormal performance is hard to spot | Recommend an execution method by objective, flag abnormal execution, explain slippage & benchmark results |
| **Global FX Services** | Portfolio exposures → hedge calc → execution → settlement → reporting; FX overlay, custody FX, transaction FX, algo execution | Large, repetitive FX workflow with operational risk | Read portfolio/transaction files, identify exposures, calculate hedges, detect exceptions, generate client reports |
| **Equity Derivatives** | Autocallables (retail) + bespoke solutions (HF/institutional); pricing depends on funding, borrow costs, client flows, concentration risk, hedging costs, vol surface and trader judgement — not just the model | Value and user adoption matter more than model sophistication | Assess AI by useful output + adoption; support the pricing/risk workflow |

## 2. Building trust through follow-up
After collecting desk feedback, I checked with Sarang, learned several requested capabilities were already in development (one API recently released), and followed up with the FX Options desk that had raised it. This small loop-closing reinforced that trust is built through consistent follow-up — users share more when they see their feedback is remembered and acted on. Trustworthiness comes not only from the model output, but from how the team communicates and closes the loop.

## 3. Team projects

| Project | Focus | Key learning |
|---------|-------|--------------|
| **AI Markets Desktop** | UI design & user-centred testing | Viewing it as a product I'd personally use made me attentive to findability, layout, wording and usability. Testing is not just final QC — it surfaces new product ideas and usability needs beyond the original requirements |
| **Wealth Sales automation** | Prompt engineering (with Sarang) | Effective prompting needs concrete, representative examples — which fields, what format, what to exclude, how to handle missing/ambiguous inputs, across realistic variation. Prompt design is iterative and must be grounded in business understanding |

## 4. Overall takeaways & next steps
A recurring theme: information is fragmented across Bloomberg chats, emails, screenshots, Excel and internal systems — the data and tools often already exist, but the steps around them are manual. **The strongest opportunity may be connecting existing tools and workflows, not building another standalone platform.** The most valuable solution may not automate the most complex decision, but remove a repeated friction point, fit naturally into an existing workflow, and produce output users can easily verify — so trust, data quality, human review and adoption must be considered from the start.

**Next week:** continue improving/testing AI Markets Desktop; refine Wealth Sales prompts with more representative examples; follow up with users on feedback and product updates; and narrow the project into a defined workflow with a specific user, measurable pain point, and realistic MVP (mapping current/proposed process, required systems/APIs, and where human review should remain).

Best,
Lisa
