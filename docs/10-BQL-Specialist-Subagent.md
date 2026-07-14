# BQL Specialist Subagent 架构 — 完整实现规格(待交给实际代码库的 AI 执行)

> 这份文档是一份完整的、可直接粘贴给实际持有 Bloomberg connector/Main Agent 代码库的 AI
> agent 的实现指令。本追踪仓库(forge-ui)不包含该代码库本身,这里只做规格存档。
>
> 跟 [09-Bloomberg-Search-Fallback.md](09-Bloomberg-Search-Fallback.md) 是不同的工作线:
> 09 解决的是"BDP/BDH/BDIT/BDIB/BQL 报错时怎么用 Search 兜底找候选";这份解决的是
> "Main Agent 判断要用 BQL 时,怎么把复杂 BQL 生成/执行/修复工作委派给一个独立 context 的
> BQL Specialist Subagent",两者互不冲突,可能会在同一个代码库里共存。

## 目标

改进当前项目中的 Bloomberg BQL 能力。

项目已有一个 Main Agent,它能够自主判断调用 BDP、BDH、BQL、Bloomberg Search 等工具。BDP 和
BDH 已经经过优化,因此本次任务不要重新设计整个 Bloomberg tool-routing system,也不要用硬
编码规则强制 Main Agent 选择某个工具。

本次目标是:

1. 保留 Main Agent 自主选择工具的能力。
2. 当 Main Agent 判断需要使用 BQL 时,将任务委派给一个独立的 BQL Specialist Subagent。
3. BQL Subagent 使用独立 context,不占用 Main Agent 的主要 context window。
4. BQL Subagent 能够:
   - 理解用户的自然语言分析请求;
   - 制定结构化 BQL plan;
   - 检索相关 Bloomberg 官方 examples;
   - 生成符合当前执行环境的 BQL;
   - 执行并捕获 Bloomberg errors;
   - 对失败 query 进行定向修复;
   - 验证结果的完整性、单位、粒度和口径;
   - 向 Main Agent 返回简洁、结构化的结果。
5. 不要把所有 Bloomberg examples 永久塞进 Main Agent prompt。
6. 不要让 Main Agent 自己生成复杂 BQL,再交给 Subagent 检查。
7. 所有改动必须可测试、可回滚,并尽量复用现有代码。

请严格按照以下阶段执行。完成每个阶段后,先运行相关测试,确认没有破坏现有功能,再进入
下一阶段。

## Phase 0:安全审计和代码定位

先不要修改代码。

请检查当前 repository,定位并总结以下内容:

1. Main Agent 的入口文件。
2. Tool registration 或 tool schema 定义位置。
3. BDP、BDH、BQL、Bloomberg Search 的实现位置。
4. Main Agent 如何决定调用工具。
5. BQL 当前接收什么输入。
6. BQL 当前如何生成 query。
7. BQL 当前如何执行。
8. Bloomberg API 返回的错误目前如何处理。
9. 项目中是否已经存在:
   - subagent framework;
   - independent model call;
   - task delegation;
   - retrieval system;
   - vector database;
   - result cache;
   - session store;
   - structured response model。
10. 当前使用的 BQL 执行模式:
    - Raw BQL;
    - Excel-style BQL;
    - Python BQL Object Model;
    - BQuant;
    - 其他方式。

输出一份简短的 implementation audit,包括:

```text
Current Main Agent flow
Current BQL flow
Reusable components
Missing components
Files likely to change
Main risks
```

不要凭空创建一个全新 architecture。如果项目已经有可复用的 agent abstraction、model
client、tool executor、retrieval module 或 cache,请优先复用。

完成审计后,再开始 Phase 1。

## Phase 1:定义 BQL Subagent 的接口

创建一个清晰的 BQL Specialist 接口,但暂时不要加入复杂 retrieval 和 retry。

Main Agent 应该调用类似下面的接口:

```python
ask_bql_specialist(
    request: str,
    relevant_context: dict | None = None,
    previous_result_id: str | None = None,
    return_mode: str = "compact",
)
```

Main Agent 应传入:
- 用户当前的自然语言请求;
- 与当前查询直接相关的上下文;
- 可选的上一次 BQL result ID;
- 返回模式。

Main Agent 不应该传入:
- 完整长期 conversation;
- 全部 Bloomberg examples;
- 无关用户历史;
- Main Agent 的完整 system prompt;
- Main Agent 的内部推理;
- 已经由 Main Agent 猜测出的复杂 BQL query。

定义结构化返回类型,例如:

```python
class BQLSpecialistResponse:
    status: Literal["success", "partial", "failed"]
    summary: str
    final_query: str | None
    result_preview: list[dict]
    result_id: str | None
    assumptions: list[str]
    warnings: list[str]
    coverage: dict
    suggested_follow_up_tools: list[dict]
```

要求:
1. 返回对象必须可序列化。
2. 不要默认返回完整中间推理。
3. 不要默认返回全部原始数据。
4. 不要返回检索到的所有 examples。
5. 不要返回失败的全部 query history。
6. Debug 信息只在 explicit debug mode 下返回。

为这个接口增加 unit tests。测试至少覆盖:
- Main Agent 可以调用 BQL Specialist;
- request 可以正常传递;
- compact response 可以正常返回;
- malformed response 会被安全处理;
- BQL Subagent failure 不会使 Main Agent 崩溃。

完成测试后进入 Phase 2。

## Phase 2:建立真正独立的 BQL Subagent context

BQL Specialist 必须是独立模型调用或独立 agent execution,不是 Main Agent context 中的
角色扮演。

错误示例:
```text
Main Agent prompt:
"You are now a BQL expert..."
```

正确方向:
```text
Main Agent model call
    ↓ delegate
Independent BQL Specialist model call
    ↓ structured response
Main Agent
```

请实现:
1. 独立的 BQL specialist system prompt。
2. 独立的 message history。
3. 独立的 token/context budget。
4. 独立的 tool permissions。
5. 明确的 timeout 和 retry limits。
6. 主 Agent 只接收 compact structured response。

BQL Subagent 的基础 system prompt 应包含以下原则:

```text
You are a Bloomberg BQL specialist subagent.

Your responsibility is to convert analytical requests into reliable Bloomberg BQL workflows.

You must:
- identify the requested universe;
- identify requested data items;
- identify parameters, dates and fiscal periods;
- identify calculations, filters, grouping, sorting and limits;
- state material assumptions;
- avoid inventing Bloomberg fields;
- use only the BQL syntax supported by the current project;
- validate queries before full execution;
- diagnose Bloomberg errors;
- make minimal targeted repairs;
- validate result coverage, units and granularity;
- return concise structured results to the Main Agent.

Do not:
- expose verbose internal reasoning;
- return all retrieved examples;
- retry indefinitely;
- silently change the user's analytical intent;
- claim success when the query executed but the result is semantically incomplete.
```

BQL Subagent 初期允许使用的工具建议限制为:
- BQL executor;
- Bloomberg security search;
- Bloomberg field search;
- example retriever;
- result store。

第一版不要允许它无限制调用项目中所有工具。

为独立 context 增加测试,确认 BQL prompt 和 examples 不会进入 Main Agent context。

完成后进入 Phase 3。

## Phase 3:加入 Structured BQL Planner

BQL Subagent 收到用户请求后,不要立即生成 BQL。先生成一个结构化 plan。

创建类似下面的数据模型:

```python
class BQLPlan:
    task_type: str
    asset_class: str | None
    universe: dict
    data_items: list[dict]
    filters: list[dict]
    calculations: list[dict]
    grouping: list[str]
    sorting: list[dict]
    limit: int | None
    date_parameters: dict
    fiscal_parameters: dict
    currency: str | None
    assumptions: list[str]
    ambiguities: list[str]
    expected_output_granularity: str
```

例如:

```json
{
  "task_type": "cross_sectional_ranking",
  "asset_class": "equity",
  "universe": {
    "type": "index_members",
    "identifier": "Hang Seng Index",
    "membership": "current"
  },
  "data_items": [
    {
      "concept": "revenue",
      "period": "5Y"
    },
    {
      "concept": "EBITDA margin",
      "period": "5Y"
    }
  ],
  "calculations": [
    {
      "type": "CAGR",
      "input": "revenue"
    },
    {
      "type": "absolute_change",
      "input": "EBITDA margin"
    }
  ],
  "sorting": [
    {
      "field": "revenue_cagr",
      "direction": "descending"
    }
  ],
  "limit": 10,
  "assumptions": [
    "Margin expansion means percentage-point change.",
    "Use current index constituents."
  ],
  "expected_output_granularity": "one row per security"
}
```

增加 plan validation:
- 必须存在明确的 universe;
- 必须存在至少一个 data item;
- calculation 必须引用已定义的 input;
- sorting field 必须存在;
- limit 必须合理;
- 日期和 fiscal period 不可互相矛盾;
- expected output granularity 必须明确。

如果用户请求有歧义,但可以通过合理假设继续,则记录 assumption,不要阻塞流程。只有当歧义
会导致完全不同的分析结果,且无法通过安全默认值处理时,才返回 `partial` 或请求 Main Agent
获取澄清。

为 planner 建立 tests,覆盖:
- equity screening;
- index constituent ranking;
- historical CAGR;
- estimate revision;
- credit screening;
- grouping and aggregation;
- ambiguous date;
- missing fiscal period;
- invalid calculation dependency。

完成后进入 Phase 4。

## Phase 4:建立 Bloomberg BQL Example Library

不要把所有 examples 直接写入 BQL system prompt。建立独立、可维护的 example library。

每个 example 至少包含:

```json
{
  "id": "equity_index_cagr_rank_001",
  "user_question": "Rank index members by five-year revenue CAGR",
  "task_type": "ranking",
  "asset_class": "equity",
  "universe_type": "index_members",
  "operations": [
    "historical_data",
    "cagr",
    "filter_nulls",
    "sort",
    "top_n"
  ],
  "execution_mode": "CURRENT_PROJECT_BQL_MODE",
  "bql_query": "...",
  "expected_output_shape": "one row per security",
  "important_notes": [
    "Exclude securities without sufficient historical data."
  ],
  "source": "Bloomberg official example",
  "verified": true
}
```

请先建立两类 examples:

**A. Complete workflow examples**,例如:
- index members + fundamentals + ranking;
- bond screening + spread + rating;
- estimate revision + sector comparison;
- portfolio holdings + aggregation;
- historical percentile + current value。

**B. Atomic building blocks**,例如:
- retrieve index members;
- construct universe;
- retrieve historical fundamentals;
- retrieve estimates;
- calculate CAGR;
- calculate absolute change;
- calculate percentile;
- filter nulls;
- sort;
- top N;
- group by sector;
- currency conversion;
- fiscal period parameters。

Examples 必须标记:
- 是否经过真实执行验证;
- 使用哪种 BQL execution mode;
- 来源;
- 适用 asset class;
- 预期 output shape。

不要混用不同 execution mode 的 examples。先加入少量经过验证的高质量 examples,不要一次性
导入大量未经验证的内容。

完成后进入 Phase 5。

## Phase 5:实现动态 Example Retrieval

根据用户请求和 BQL plan,只检索最相关的 3–5 个 examples。

优先使用 hybrid retrieval:
```text
metadata filtering
+ keyword matching
+ semantic similarity
```

先过滤:
- execution_mode;
- asset_class;
- universe_type;
- task_type;
- operations;
- verified status。

然后进行 semantic ranking。示例:

```python
examples = retrieve_bql_examples(
    request=user_request,
    plan=bql_plan,
    top_k=5,
    verified_only=True,
)
```

要求:
1. 默认不超过 5 个 examples。
2. 优先 verified examples。
3. 如果没有完全匹配案例,可以组合 atomic building blocks。
4. 记录使用了哪些 example IDs,但不要默认返回给 Main Agent。
5. 对重复或高度相似的 examples 去重。
6. 不允许不同 BQL execution mode 混入 prompt。
7. 没有高质量 example 时,也必须能够继续,但要降低 confidence 或增加 validation。

增加 retrieval tests:
- 相同 asset class 优先;
- 相同 task type 优先;
- execution mode 严格匹配;
- unverified example 不应覆盖 verified example;
- top_k 限制有效;
- atomic building blocks 可以组合。

完成后进入 Phase 6。

## Phase 6:实现 BQL Query Generator

Query generator 的输入应包括:
```text
Original user request
Validated BQL plan
Resolved fields and securities
Retrieved examples
Supported BQL execution syntax
Project-specific constraints
```

Query generator 不应只根据原始自然语言请求生成 query。生成时必须:
1. 遵循当前项目实际支持的 BQL syntax。
2. 不得编造 Bloomberg fields。
3. 使用已验证或已 resolve 的 fields。
4. 保留 plan 中的 universe、calculations、sorting 和 limit。
5. 明确 aliases。
6. 控制返回数据量。
7. 优先生成简单、可执行的 query。
8. 如果一个 query 过于复杂,允许拆分为多个 BQL steps。
9. 如果无法可靠完成整个请求,返回 partial plan,而不是伪造结果。

生成结果应包括:

```python
class GeneratedBQL:
    query: str
    query_steps: list[str]
    field_mapping: dict
    assumptions: list[str]
    expected_output_granularity: str
    estimated_complexity: str
```

完成后进入 Phase 7。

## Phase 7:加入 Field、Security 和 Universe Resolution

在生成或执行 BQL 前,对不确定的内容进行 resolution。需要处理:
- security identifiers;
- index identifiers;
- universe definitions;
- Bloomberg field names;
- estimate period;
- currency;
- units;
- current versus historical constituents;
- issuer country versus risk country;
- price return versus total return;
- reported versus adjusted values。

Resolver 应返回:

```json
{
  "user_concept": "forward P/E",
  "resolved_field": "...",
  "description": "...",
  "parameters": {
    "fiscal_period": "FY1"
  },
  "applicable_asset_classes": ["Equity"],
  "confidence": 0.93
}
```

当 confidence 低于阈值时:
```text
call Bloomberg field search
→ inspect candidates
→ select field
→ record mapping
```

不要只在 BQL 完全失败后才使用 Search。对明显不确定的 field 或 security,应在 execution
前 resolution。

为 resolver 添加 cache,避免同一 session 内重复搜索同一个 field。

完成后进入 Phase 8。

## Phase 8:实现 Preflight Validator

生成 BQL 后,不要立即执行完整查询。实现静态或半静态 validation,检查:
- query syntax 基本完整;
- 括号和 aliases;
- universe 是否存在;
- data items 是否定义;
- calculation 是否引用有效字段;
- sorting field 是否存在;
- fiscal period 是否缺失;
- historical date range 是否缺失;
- field 是否适用于 asset class;
- output granularity 是否符合 plan;
- universe 是否过大;
- query 是否可能返回过量数据;
- top N 是否发生在正确阶段;
- currency 和 units 是否明确;
- 是否有明显的 null-data risk。

返回:

```python
class BQLValidationResult:
    valid: bool
    errors: list[dict]
    warnings: list[dict]
    suggested_fixes: list[dict]
```

对于可以自动修复的问题,进行最小修改。不要因为一个小错误而完全重写 query。

完成后进入 Phase 9。

## Phase 9:加入 Small-Sample Execution

复杂 BQL 在完整执行前,先进行小范围测试。可以根据 query 类型采用:
- 只测试 3–5 个 securities;
- 缩短历史日期;
- 只测试核心 fields;
- 降低 output limit;
- 暂时移除非核心 aggregation。

小范围测试需要验证:
- query 是否可执行;
- fields 是否返回数据;
- output shape;
- output granularity;
- null rate;
- units;
- alias mapping;
- calculation 是否生效。

如果 small-sample test 失败,进入 repair loop。如果通过,再执行完整 query。简单低风险
query 可以跳过 small-sample execution,但要有明确判断条件。

完成后进入 Phase 10。

## Phase 10:实现 Error Classification 和 Targeted Repair

捕获真实 Bloomberg error,并分类。至少支持:

```text
UNKNOWN_FIELD
INVALID_SECURITY
INVALID_UNIVERSE
MISSING_PARAMETER
UNSUPPORTED_PARAMETER
FIELD_NOT_APPLICABLE
INVALID_DATE_RANGE
TOO_MUCH_DATA
EMPTY_RESULT
ENTITLEMENT_ERROR
SYNTAX_ERROR
TIMEOUT
UNKNOWN_ERROR
```

针对不同 error 使用不同处理:

```python
if error_type == "UNKNOWN_FIELD":
    resolve_field()
elif error_type == "INVALID_SECURITY":
    search_security()
elif error_type == "INVALID_UNIVERSE":
    repair_universe()
elif error_type == "MISSING_PARAMETER":
    add_required_parameter()
elif error_type == "FIELD_NOT_APPLICABLE":
    find_asset_class_specific_field()
elif error_type == "TOO_MUCH_DATA":
    reduce_universe_or_aggregate()
elif error_type == "EMPTY_RESULT":
    inspect_universe_dates_and_coverage()
elif error_type == "SYNTAX_ERROR":
    repair_only_the_invalid_section()
elif error_type == "ENTITLEMENT_ERROR":
    stop_retrying_and_return_warning()
```

Repair model 应接收:
```text
Original user request
Validated BQL plan
Current query
Field mappings
Bloomberg error
Relevant examples
```

Repair prompt 要求:
```text
Identify the smallest incorrect component.
Preserve the original analytical intent.
Do not rewrite the entire query unless necessary.
Do not invent fields.
Return the repaired query and a concise repair summary.
```

限制:

```python
MAX_BQL_EXECUTION_ATTEMPTS = 3
MAX_FIELD_SEARCH_ATTEMPTS = 3
MAX_REPAIR_ATTEMPTS = 2
```

达到上限后停止,并返回真实 failure 或 partial result。

完成后进入 Phase 11。

## Phase 11:实现 Result Validation

BQL 成功执行后,不要立即认为任务成功。检查:
- 返回行数;
- universe size;
- excluded rows;
- missing-data rate;
- units;
- currencies;
- date coverage;
- fiscal coverage;
- output granularity;
- duplicate rows;
- security identifiers;
- calculation output;
- current versus historical constituent basis;
- reported versus estimate basis。

生成 coverage:

```json
{
  "universe_size": 214,
  "returned_rows": 15,
  "excluded_missing_data": 18,
  "null_rate": 0.07,
  "date_coverage": "2021-01-01 to 2026-01-01",
  "output_granularity": "one row per security"
}
```

如果 query 执行成功但结果明显不完整:
- status 不应为完全 success;
- 返回 `partial`;
- 明确 warnings;
- 不要隐藏缺失数据。

对于关键字段,可选地抽取少数 securities,通过 BDP 或 BDH 做交叉验证。但第一版不要让 BQL
Subagent 无限调用其他 tools。

完成后进入 Phase 12。

## Phase 12:实现 Compact Result 和 Result Store

为了避免 Main Agent context 膨胀,大结果不要完整返回。将完整结果保存到 result store:

```text
result_id = "bql_result_..."
```

返回给 Main Agent:

```json
{
  "status": "success",
  "summary": "Returned the top 15 securities ranked by relative spread cheapness.",
  "final_query": "...",
  "result_preview": [],
  "result_id": "bql_result_12345",
  "assumptions": [],
  "warnings": [],
  "coverage": {},
  "suggested_follow_up_tools": []
}
```

默认 compact mode 只包含:
- 一段 summary;
- 少量 preview rows;
- final query;
- assumptions;
- warnings;
- coverage;
- result ID。

不要默认返回:
- 完整数据表;
- 全部 examples;
- 全部失败 queries;
- 原始 stack traces;
- 内部推理;
- 每次 repair history。

实现以下辅助接口:

```python
get_bql_result(
    result_id: str,
    offset: int = 0,
    limit: int = 50,
)
```

以及可选的:

```python
continue_bql_analysis(
    previous_result_id: str,
    request: str,
)
```

这样用户追问:
```text
Now exclude Chinese property issuers.
```

Main Agent 可以传入 previous result ID,而不需要把完整历史重新放入 context。

完成后进入 Phase 13。

## Phase 13:接入 Main Agent

更新 Main Agent 的 BQL tool description。保持描述简洁,不放入大量 examples。建议:

```text
Use the BQL Specialist for complex Bloomberg analysis involving dynamic or constructed universes, screening, cross-sectional comparison, ranking, grouping, aggregation, historical calculations, derived metrics, or multi-field analytical workflows.

Pass the user's analytical request in natural language. Do not generate the final BQL query yourself. The specialist will plan, retrieve relevant verified examples, resolve Bloomberg fields and universes, generate and execute BQL, repair errors, validate the result and return a compact structured response.

Use BDP for straightforward current or reference data and BDH for straightforward historical time series when those tools are sufficient.
```

Main Agent integration rules:
1. Main Agent 自己决定是否调用 BQL Specialist。
2. 不要增加大量硬编码关键词 routing。
3. 不要让 Main Agent 先生成 BQL。
4. 不要把所有 conversation 发给 Subagent。
5. 只传当前 query 所需上下文。
6. Main Agent 收到 compact response 后负责最终自然语言呈现。
7. 如果 specialist 返回 `suggested_follow_up_tools`,Main Agent 再决定是否调用其他 tools。
8. Main Agent 不应把 subagent 的内部错误全部展示给用户。
9. assumptions 和 warnings 必须在最终回答中保留。
10. result ID 应支持后续追问。

完成后运行 regression tests,确认:
- BDP 行为没有变化;
- BDH 行为没有变化;
- Search 行为没有变化;
- 简单请求不会被不必要地送入 BQL;
- 复杂 BQL 请求能够进入 Subagent;
- Main Agent context 没有包含大段 BQL examples;
- Subagent failure 不会破坏主对话。

## Phase 14:建立 Evaluation Suite

建立一套 BQL benchmark。先加入 30–50 个测试问题,覆盖:

```text
Equity index constituents
Equity screening
Fundamental ranking
Historical CAGR
Estimate revisions
Sector aggregation
Credit bond screening
Spread ranking
Historical percentile
Rates universe
Portfolio holdings
Missing data
Ambiguous fiscal period
Invalid field
Invalid security
Large universe
Entitlement failure
Follow-up query using previous_result_id
```

每个 test case 应包含:

```json
{
  "id": "...",
  "question": "...",
  "expected_tool": "BQL",
  "expected_task_type": "...",
  "required_concepts": [],
  "forbidden_behaviors": [],
  "expected_assumptions": [],
  "expected_output_granularity": "...",
  "gold_query": null
}
```

评估指标:

```text
Tool selection accuracy
Plan correctness
Field resolution success
Syntax validity
Execution success
Semantic correctness
Hallucinated field rate
Repair success rate
Result completeness
Assumption transparency
Context usage
Latency
Average retry count
```

最重要的指标是 semantic correctness,而不仅是 query 是否成功执行。

加入 regression test,防止后续增加 examples 后反而降低效果。

## Phase 15:Logging 和持续改进

为每次 BQL 请求记录:

```json
{
  "request": "...",
  "plan": {},
  "retrieved_example_ids": [],
  "resolved_fields": {},
  "generated_query": "...",
  "execution_attempts": 0,
  "errors": [],
  "final_status": "...",
  "coverage": {},
  "result_id": "...",
  "latency_ms": 0
}
```

注意:
- 不记录不必要的敏感用户内容;
- 不记录完整长期 conversation;
- 对日志进行权限控制;
- 对 Bloomberg 数据和 query 结果遵循现有内部安全规则。

以后人工修正后的成功 query 可以进入 review queue。只有经过人工或自动测试验证后,才能加入
verified example library。

## 最终代码结构建议

在不破坏现有项目结构的前提下,可以参考:

```text
bloomberg/
├── tools/
│   ├── bdp_tool.py
│   ├── bdh_tool.py
│   ├── bql_tool.py
│   └── search_tool.py
│
├── bql/
│   ├── specialist.py
│   ├── models.py
│   ├── planner.py
│   ├── example_retriever.py
│   ├── field_resolver.py
│   ├── query_generator.py
│   ├── validator.py
│   ├── executor.py
│   ├── error_classifier.py
│   ├── repair.py
│   ├── result_validator.py
│   └── result_store.py
│
├── examples/
│   ├── equity.json
│   ├── credit.json
│   ├── rates.json
│   ├── portfolio.json
│   └── building_blocks.json
│
└── evaluation/
    ├── bql_test_cases.json
    └── evaluate_bql.py
```

不要为了匹配这个结构而强行移动所有现有文件。优先适配当前 repository。

## 执行原则

请遵守以下原则:

1. 先审计,再修改。
2. 每个 phase 都要有测试。
3. 不要一次性重写整个系统。
4. 不要破坏已优化的 BDP 和 BDH。
5. 不要硬编码大量 routing keywords。
6. 不要把所有 examples 放入 Main Agent prompt。
7. 不要让 Main Agent 生成复杂 BQL。
8. BQL Specialist 必须使用独立 context。
9. Subagent 默认返回 compact structured response。
10. 所有 retries 必须有上限。
11. 不要隐藏 assumptions、coverage 和 warnings。
12. Query 成功执行不等于语义正确。
13. 优先复用现有 agent、retrieval、cache 和 execution infrastructure。
14. 每次修改后运行现有 tests 和新增 tests。
15. 如果发现当前架构与以上建议冲突,选择最小侵入式方案,并在 implementation report 中
    解释。

## 每个 Phase 完成后的输出格式

每完成一个阶段,请输出:

```text
Phase completed:
Files changed:
What was implemented:
Tests added:
Tests run:
Test results:
Known limitations:
Next phase:
```

如果测试失败:
1. 不要继续下一阶段;
2. 定位 failure;
3. 修复;
4. 重新运行;
5. 确认通过后再继续。

## 最终交付要求

完成全部实施后,请提供:

1. Architecture summary。
2. Main Agent 到 BQL Subagent 的完整调用流程。
3. 修改过的文件列表。
4. 新增的配置项。
5. 新增的 tests。
6. Benchmark results。
7. 已知限制。
8. 回滚方法。
9. 如何新增 Bloomberg example。
10. 如何查看 BQL execution logs。
11. 如何通过 previous_result_id 继续分析。
12. 一组实际示例,展示:
    - Main Agent 调用请求;
    - BQL Subagent compact response;
    - Main Agent 最终回答;
    - 一次 error repair;
    - 一次 follow-up query。

---

指令(发给 AI,完整粘贴即可):
```text
你现在需要改进当前项目中的 Bloomberg BQL 能力。

项目已有一个 Main Agent,它能够自主判断调用 BDP、BDH、BQL、Bloomberg Search 等工具。BDP 和
BDH 已经经过优化,因此本次任务不要重新设计整个 Bloomberg tool-routing system,也不要用硬
编码规则强制 Main Agent 选择某个工具。

本次目标是:

1. 保留 Main Agent 自主选择工具的能力。
2. 当 Main Agent 判断需要使用 BQL 时,将任务委派给一个独立的 BQL Specialist Subagent。
3. BQL Subagent 使用独立 context,不占用 Main Agent 的主要 context window。
4. BQL Subagent 能够:
   * 理解用户的自然语言分析请求;
   * 制定结构化 BQL plan;
   * 检索相关 Bloomberg 官方 examples;
   * 生成符合当前执行环境的 BQL;
   * 执行并捕获 Bloomberg errors;
   * 对失败 query 进行定向修复;
   * 验证结果的完整性、单位、粒度和口径;
   * 向 Main Agent 返回简洁、结构化的结果。
5. 不要把所有 Bloomberg examples 永久塞进 Main Agent prompt。
6. 不要让 Main Agent 自己生成复杂 BQL,再交给 Subagent 检查。
7. 所有改动必须可测试、可回滚,并尽量复用现有代码。

请严格按照本文档 [10-BQL-Specialist-Subagent.md] 里 Phase 0 到 Phase 15 的完整规格执行。
完成每个阶段后,先运行相关测试,确认没有破坏现有功能,再进入下一阶段。测试失败时不要继续
下一阶段,先定位、修复、重新运行、确认通过后再继续。

现在从 Phase 0 开始。先检查 repository 和现有 BQL implementation,不要立即重写代码。
```
