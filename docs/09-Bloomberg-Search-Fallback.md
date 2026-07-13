# Bloomberg Search Fallback 功能 — 完整实现规格(待交给实际代码库的 AI 执行)

> 这份文档是一份完整的、可直接粘贴给实际持有 Bloomberg connector 代码库的 AI agent 的实现指令。
> 本追踪仓库(forge-ui)不包含 Bloomberg connector 代码本身,这里只做规格存档,方便随时复制粘贴、
> 追踪版本、以及后续在此基础上补充调整。

## Objective

Add a Bloomberg Search fallback capability to the existing Bloomberg functions:

* BDP
* BDH
* BDIT
* BDIB
* BQL

The key product requirement is:

> Do not run Bloomberg Search before every request. First execute the existing Bloomberg
> function normally. Only when the Bloomberg request fails because a Security or Field
> cannot be resolved, call Bloomberg Search and return candidate results for the user to
> select.

This should follow an **optimistic execution with search fallback** architecture.

The desired flow is:

```text
User request
    ↓
Existing AI parsing
    ↓
Existing BDP / BDH / BDIT / BDIB / BQL execution
    ↓
Success?
    ├── Yes → return data normally
    └── No
         ↓
    Inspect the Bloomberg error
         ↓
    Is it caused by an invalid/unresolved Security or Field?
         ├── No → return the original operational/data error
         └── Yes
              ↓
         Search Bloomberg for relevant candidates
              ↓
         Return candidates to the frontend/user
              ↓
         User selects candidate(s)
              ↓
         Resume the original Bloomberg request
              ↓
         Return data for visualization
```

## Important implementation rules

1. Inspect the existing repository before changing anything.
2. Reuse the existing Bloomberg session, authentication, request handling, parsers, and
   connector classes.
3. Do not rewrite the existing BDP, BDH, BDIT, BDIB, or BQL implementations unless
   necessary.
4. Add the search fallback as a wrapper or execution gateway around the existing
   functions.
5. Do not search before a normal Bloomberg request.
6. Do not trigger Search for every Bloomberg error.
7. Search should only be triggered for errors related to:
   * Invalid or unknown Security
   * Invalid or unknown Field
   * Field not applicable to the selected Security
8. Do not trigger Search for:
   * Missing entitlement
   * Session disconnection
   * Timeout
   * Invalid date range
   * Bloomberg service unavailable
   * Request limit exceeded
   * BQL syntax errors unrelated to an identifier
9. Never let the LLM invent Bloomberg Security identifiers or field mnemonics.
10. Security and Field candidates must come from Bloomberg services or verified Bloomberg
    metadata.
11. After the user selects a candidate, use the returned canonical Bloomberg value
    exactly as returned.
12. Preserve backward compatibility with all existing connector functions.
13. Add structured logging and tests.

## Phase 1: Inspect the existing codebase

Before writing code, inspect the repository and identify:

* Where the Bloomberg `blpapi.Session` is created
* Whether the session is synchronous or asynchronous
* Where `openService` is called
* Existing implementations of:
   * BDP
   * BDH
   * BDIT
   * BDIB
   * BQL
* Existing response parsers
* Existing error handling
* Existing API routes or agent tools
* Existing frontend response format
* Whether Redis, database storage, or another state store already exists
* Whether there is already a request ID or conversation state mechanism

Then provide a short implementation plan based on the actual codebase.

Do not create duplicate Bloomberg sessions unless the architecture requires it. Prefer to
reuse the existing connected session.

## Phase 2: Add Bloomberg Security and Field Search

Use Bloomberg lookup services:

```text
Security search:
Service: //blp/instruments
Request: instrumentListRequest

Field search:
Service: //blp/apiflds
Request: FieldSearchRequest
```

Create a search service adapted to the existing project structure.

A reference implementation is below. Modify it to match the existing session/event
architecture.

```python
from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from typing import Any

import blpapi


class BloombergSearchError(RuntimeError):
    """Raised when a Bloomberg lookup request fails."""


@dataclass(frozen=True)
class SecurityCandidate:
    security: str
    description: str
    rank: int


@dataclass(frozen=True)
class FieldCandidate:
    field_id: str
    mnemonic: str
    description: str
    rank: int


class BloombergSearchService:
    INSTRUMENT_SERVICE = "//blp/instruments"
    FIELD_SERVICE = "//blp/apiflds"

    def __init__(
        self,
        session: blpapi.Session,
        timeout_seconds: float = 15.0,
    ) -> None:
        self.session = session
        self.timeout_seconds = timeout_seconds
        self._opened_services: set[str] = set()

    def _get_service(self, service_name: str) -> blpapi.Service:
        if service_name not in self._opened_services:
            if not self.session.openService(service_name):
                raise BloombergSearchError(
                    f"Unable to open Bloomberg service: {service_name}"
                )

            self._opened_services.add(service_name)

        return self.session.getService(service_name)

    def _send_sync_request(
        self,
        request: blpapi.Request,
    ) -> list[blpapi.Message]:
        """
        Reference synchronous implementation.

        If the existing connector uses asynchronous event routing and
        correlation IDs, integrate with that existing mechanism instead of
        calling nextEvent directly.
        """
        correlation_id = self.session.sendRequest(request)
        messages: list[blpapi.Message] = []
        deadline = time.monotonic() + self.timeout_seconds

        while True:
            remaining = deadline - time.monotonic()

            if remaining <= 0:
                raise TimeoutError("Bloomberg search request timed out.")

            event = self.session.nextEvent(int(remaining * 1000))
            event_type = event.eventType()

            if event_type == blpapi.Event.TIMEOUT:
                raise TimeoutError("Bloomberg search request timed out.")

            if event_type == blpapi.Event.REQUEST_STATUS:
                for message in event:
                    if message.correlationIds():
                        message_correlation = message.correlationIds()[0]

                        if message_correlation != correlation_id:
                            continue

                    if message.messageType() == blpapi.Name("RequestFailure"):
                        raise BloombergSearchError(str(message))

            if event_type in (
                blpapi.Event.PARTIAL_RESPONSE,
                blpapi.Event.RESPONSE,
            ):
                for message in event:
                    if message.correlationIds():
                        message_correlation = message.correlationIds()[0]

                        if message_correlation != correlation_id:
                            continue

                    messages.append(message)

                if event_type == blpapi.Event.RESPONSE:
                    return messages

    def search_securities(
        self,
        query: str,
        max_results: int = 10,
        yellow_key_filter: str | None = None,
        language_override: str | None = None,
    ) -> list[dict[str, Any]]:
        query = query.strip()

        if not query:
            raise ValueError("Security search query cannot be empty.")

        service = self._get_service(self.INSTRUMENT_SERVICE)
        request = service.createRequest("instrumentListRequest")

        request.set("query", query)
        request.set("maxResults", max_results)

        if yellow_key_filter:
            request.set("yellowKeyFilter", yellow_key_filter)

        if language_override:
            request.set("languageOverride", language_override)

        candidates: list[SecurityCandidate] = []

        for message in self._send_sync_request(request):
            if not message.hasElement("results"):
                continue

            results = message.getElement("results")

            for index in range(results.numValues()):
                result = results.getValueAsElement(index)

                if not result.hasElement("security"):
                    continue

                security = result.getElementAsString("security")

                description = (
                    result.getElementAsString("description")
                    if result.hasElement("description")
                    else ""
                )

                candidates.append(
                    SecurityCandidate(
                        security=security,
                        description=description,
                        rank=len(candidates) + 1,
                    )
                )

        return [asdict(candidate) for candidate in candidates]

    def search_fields(
        self,
        query: str,
        max_results: int = 10,
        return_documentation: bool = False,
    ) -> list[dict[str, Any]]:
        query = query.strip()

        if not query:
            raise ValueError("Field search query cannot be empty.")

        service = self._get_service(self.FIELD_SERVICE)
        request = service.createRequest("FieldSearchRequest")

        request.set("searchSpec", query)
        request.set(
            "returnFieldDocumentation",
            return_documentation,
        )

        candidates: list[FieldCandidate] = []

        for message in self._send_sync_request(request):
            if not message.hasElement("fieldData"):
                continue

            field_data = message.getElement("fieldData")

            for index in range(field_data.numValues()):
                field = field_data.getValueAsElement(index)

                if not field.hasElement("fieldInfo"):
                    continue

                field_id = (
                    field.getElementAsString("id")
                    if field.hasElement("id")
                    else ""
                )

                field_info = field.getElement("fieldInfo")

                mnemonic = (
                    field_info.getElementAsString("mnemonic")
                    if field_info.hasElement("mnemonic")
                    else field_id
                )

                description = (
                    field_info.getElementAsString("description")
                    if field_info.hasElement("description")
                    else ""
                )

                candidates.append(
                    FieldCandidate(
                        field_id=field_id,
                        mnemonic=mnemonic,
                        description=description,
                        rank=len(candidates) + 1,
                    )
                )

                if len(candidates) >= max_results:
                    break

            if len(candidates) >= max_results:
                break

        return [asdict(candidate) for candidate in candidates]
```

Important:

* If the repository already has a generic Bloomberg request dispatcher, integrate search
  requests into that dispatcher.
* Do not use a second competing `nextEvent()` loop if the current application has one
  shared asynchronous event loop.
* If asynchronous, use correlation IDs and futures/promises in the same way as existing
  BDP/BDH requests.
* Bloomberg response schemas may differ slightly by API version. Inspect actual response
  elements and adapt safely using `hasElement`.

## Phase 3: Standardize Bloomberg errors

The fallback logic depends on correctly identifying why the initial request failed.

Find the current error parser and make it return structured errors.

Use a structure similar to:

```python
{
    "status": "error",
    "function": "BDP",
    "errors": [
        {
            "type": "security_error",
            "category": "BAD_SEC",
            "subcategory": None,
            "security": "HSBC",
            "field": None,
            "message": "Unknown/Invalid security"
        }
    ]
}
```

For Field errors:

```python
{
    "status": "error",
    "function": "BDP",
    "errors": [
        {
            "type": "field_error",
            "category": "BAD_FLD",
            "subcategory": None,
            "security": "5 HK Equity",
            "field": "share price",
            "message": "Unknown field"
        }
    ]
}
```

For a Security–Field compatibility error:

```python
{
    "status": "error",
    "function": "BDP",
    "errors": [
        {
            "type": "field_not_applicable",
            "category": "FIELD_NOT_APPLICABLE",
            "security": "5 HK Equity",
            "field": "SOME_FIELD",
            "message": "Field is not applicable to this security"
        }
    ]
}
```

Do not rely only on hardcoded category strings. Inspect the actual Bloomberg error
payloads already returned by the connector.

Create a central classifier:

```python
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ResolutionTarget(str, Enum):
    SECURITY = "security"
    FIELD = "field"
    SECURITY_FIELD_PAIR = "security_field_pair"


@dataclass(frozen=True)
class SearchFallbackDecision:
    should_search: bool
    search_security: bool
    search_field: bool
    reason: str


SECURITY_ERROR_CATEGORIES = {
    "BAD_SEC",
    "UNKNOWN_SECURITY",
    "INVALID_SECURITY",
    "SECURITY_NOT_FOUND",
}

FIELD_ERROR_CATEGORIES = {
    "BAD_FLD",
    "UNKNOWN_FIELD",
    "INVALID_FIELD",
    "FIELD_NOT_FOUND",
}

FIELD_COMPATIBILITY_CATEGORIES = {
    "FIELD_NOT_APPLICABLE",
    "NOT_APPLICABLE_TO_SECURITY",
    "INVALID_FIELD_FOR_SECURITY",
}

NON_SEARCHABLE_ERROR_CATEGORIES = {
    "NOT_ENTITLED",
    "NO_AUTH",
    "TIMEOUT",
    "SESSION_DISCONNECTED",
    "SERVICE_UNAVAILABLE",
    "INVALID_DATE",
    "LIMIT_EXCEEDED",
    "TOO_MANY_REQUESTS",
}


def classify_search_fallback(
    errors: list[dict[str, Any]],
) -> SearchFallbackDecision:
    search_security = False
    search_field = False
    reasons: list[str] = []

    for error in errors:
        category = str(error.get("category", "")).upper()
        error_type = str(error.get("type", "")).lower()
        message = str(error.get("message", "")).lower()

        if category in NON_SEARCHABLE_ERROR_CATEGORIES:
            continue

        is_security_error = (
            category in SECURITY_ERROR_CATEGORIES
            or error_type == "security_error"
            or "unknown security" in message
            or "invalid security" in message
        )

        is_field_error = (
            category in FIELD_ERROR_CATEGORIES
            or error_type == "field_error"
            or "unknown field" in message
            or "invalid field" in message
        )

        is_compatibility_error = (
            category in FIELD_COMPATIBILITY_CATEGORIES
            or error_type == "field_not_applicable"
            or "field not applicable" in message
        )

        if is_security_error:
            search_security = True
            reasons.append("security could not be resolved")

        if is_field_error or is_compatibility_error:
            search_field = True
            reasons.append("field could not be resolved or applied")

    should_search = search_security or search_field

    return SearchFallbackDecision(
        should_search=should_search,
        search_security=search_security,
        search_field=search_field,
        reason=", ".join(dict.fromkeys(reasons)),
    )
```

Adapt the categories and parser to actual errors observed in the repository.

Do not convert entitlement, network, timeout, date, or service errors into search
requests.

## Phase 4: Add an execution gateway

Create a wrapper around the existing Bloomberg functions.

The wrapper must:

1. Call the existing Bloomberg function first.
2. Inspect the returned result or raised structured exception.
3. Return normal data immediately if successful.
4. Trigger Security and/or Field Search only for resolvable identifier errors.
5. Save the original request so it can be resumed after selection.

Reference structure:

```python
from __future__ import annotations

from typing import Any


class BloombergExecutionGateway:
    def __init__(
        self,
        connector,
        search_service: BloombergSearchService,
        pending_store,
    ) -> None:
        self.connector = connector
        self.search_service = search_service
        self.pending_store = pending_store

    def execute(
        self,
        function_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        function_name = function_name.upper()

        try:
            result = self._execute_existing_function(
                function_name=function_name,
                arguments=arguments,
            )
        except Exception as exc:
            result = self._convert_exception_to_structured_result(
                function_name=function_name,
                arguments=arguments,
                exception=exc,
            )

        if self._is_success(result):
            return {
                "status": "success",
                "function": function_name,
                "resolved_arguments": arguments,
                "data": self._extract_data(result),
            }

        errors = self._extract_errors(result)
        decision = classify_search_fallback(errors)

        if not decision.should_search:
            return result

        return self._build_search_fallback(
            function_name=function_name,
            arguments=arguments,
            errors=errors,
            search_security=decision.search_security,
            search_field=decision.search_field,
        )

    def _execute_existing_function(
        self,
        function_name: str,
        arguments: dict[str, Any],
    ) -> Any:
        dispatch = {
            "BDP": self.connector.bdp,
            "BDH": self.connector.bdh,
            "BDIT": self.connector.bdit,
            "BDIB": self.connector.bdib,
            "BQL": self.connector.bql,
        }

        try:
            function = dispatch[function_name]
        except KeyError as exc:
            raise ValueError(
                f"Unsupported Bloomberg function: {function_name}"
            ) from exc

        return function(**arguments)

    def _build_search_fallback(
        self,
        function_name: str,
        arguments: dict[str, Any],
        errors: list[dict[str, Any]],
        search_security: bool,
        search_field: bool,
    ) -> dict[str, Any]:
        unresolved_securities = self._get_unresolved_securities(
            arguments=arguments,
            errors=errors,
            search_security=search_security,
        )

        unresolved_fields = self._get_unresolved_fields(
            arguments=arguments,
            errors=errors,
            search_field=search_field,
        )

        security_searches = []

        for item in unresolved_securities:
            candidates = self.search_service.search_securities(
                query=item["input"],
                max_results=10,
            )

            security_searches.append(
                {
                    "index": item.get("index"),
                    "input": item["input"],
                    "candidates": candidates,
                }
            )

        field_searches = []

        for item in unresolved_fields:
            candidates = self.search_service.search_fields(
                query=item["input"],
                max_results=10,
            )

            field_searches.append(
                {
                    "index": item.get("index"),
                    "input": item["input"],
                    "candidates": candidates,
                }
            )

        request_id = self.pending_store.create(
            {
                "function": function_name,
                "original_arguments": arguments,
                "unresolved": {
                    "securities": unresolved_securities,
                    "fields": unresolved_fields,
                },
            }
        )

        return {
            "status": "selection_required",
            "request_id": request_id,
            "function": function_name,
            "original_arguments": arguments,
            "errors": errors,
            "security_searches": security_searches,
            "field_searches": field_searches,
        }

    def _is_success(self, result: Any) -> bool:
        """
        Replace this with logic matching the existing connector's response
        structure.
        """
        if isinstance(result, dict):
            return result.get("status") in {"success", "ok"} or (
                "data" in result and not result.get("errors")
            )

        return result is not None

    def _extract_data(self, result: Any) -> Any:
        if isinstance(result, dict) and "data" in result:
            return result["data"]

        return result

    def _extract_errors(self, result: Any) -> list[dict[str, Any]]:
        if isinstance(result, dict):
            errors = result.get("errors", [])

            if isinstance(errors, list):
                return errors

        return []

    def _convert_exception_to_structured_result(
        self,
        function_name: str,
        arguments: dict[str, Any],
        exception: Exception,
    ) -> dict[str, Any]:
        """
        Replace this generic conversion with the project's existing Bloomberg
        exception classes and response parser.
        """
        return {
            "status": "error",
            "function": function_name,
            "arguments": arguments,
            "errors": [
                {
                    "type": "unknown_error",
                    "category": exception.__class__.__name__,
                    "message": str(exception),
                }
            ],
        }

    def _get_unresolved_securities(
        self,
        arguments: dict[str, Any],
        errors: list[dict[str, Any]],
        search_security: bool,
    ) -> list[dict[str, Any]]:
        if not search_security:
            return []

        securities = arguments.get("securities")

        if securities is None:
            single_security = arguments.get("security")
            securities = [single_security] if single_security else []

        unresolved: list[dict[str, Any]] = []

        for index, security in enumerate(securities):
            matches_error = any(
                error.get("security") == security
                and (
                    error.get("type") == "security_error"
                    or str(error.get("category", "")).upper()
                    in SECURITY_ERROR_CATEGORIES
                )
                for error in errors
            )

            if matches_error:
                unresolved.append(
                    {
                        "index": index,
                        "input": security,
                    }
                )

        if not unresolved and len(securities) == 1:
            unresolved.append(
                {
                    "index": 0,
                    "input": securities[0],
                }
            )

        return unresolved

    def _get_unresolved_fields(
        self,
        arguments: dict[str, Any],
        errors: list[dict[str, Any]],
        search_field: bool,
    ) -> list[dict[str, Any]]:
        if not search_field:
            return []

        fields = arguments.get("fields")

        if fields is None:
            single_field = arguments.get("field")
            fields = [single_field] if single_field else []

        unresolved: list[dict[str, Any]] = []

        for index, field in enumerate(fields):
            matches_error = any(
                error.get("field") == field
                and (
                    error.get("type")
                    in {"field_error", "field_not_applicable"}
                    or str(error.get("category", "")).upper()
                    in (
                        FIELD_ERROR_CATEGORIES
                        | FIELD_COMPATIBILITY_CATEGORIES
                    )
                )
                for error in errors
            )

            if matches_error:
                unresolved.append(
                    {
                        "index": index,
                        "input": field,
                    }
                )

        if not unresolved and len(fields) == 1:
            unresolved.append(
                {
                    "index": 0,
                    "input": fields[0],
                }
            )

        return unresolved
```

Adapt argument names to the existing connector. For example, the codebase may use:

```python
ticker
security
securities
field
fields
start_date
end_date
interval
event_type
```

Do not impose new names unnecessarily.

## Phase 5: Store pending requests

When Search candidates are returned, preserve the full original request.

Use an existing Redis or database mechanism if available.

If no state store exists, create an interface such as:

```python
from __future__ import annotations

import copy
import time
from threading import Lock
from typing import Any
from uuid import uuid4


class InMemoryPendingRequestStore:
    def __init__(self, ttl_seconds: int = 900) -> None:
        self.ttl_seconds = ttl_seconds
        self._items: dict[str, dict[str, Any]] = {}
        self._lock = Lock()

    def create(self, payload: dict[str, Any]) -> str:
        request_id = str(uuid4())

        with self._lock:
            self._items[request_id] = {
                "payload": copy.deepcopy(payload),
                "expires_at": time.time() + self.ttl_seconds,
            }

        return request_id

    def get(self, request_id: str) -> dict[str, Any]:
        with self._lock:
            item = self._items.get(request_id)

            if item is None:
                raise KeyError("Pending Bloomberg request was not found.")

            if item["expires_at"] < time.time():
                self._items.pop(request_id, None)
                raise KeyError("Pending Bloomberg request has expired.")

            return copy.deepcopy(item["payload"])

    def delete(self, request_id: str) -> None:
        with self._lock:
            self._items.pop(request_id, None)
```

If the application has multiple processes or containers, do not use the in-memory
implementation in production. Use Redis or another shared store.

Do not store Bloomberg credentials, session objects, or raw secrets in the pending
request.

## Phase 6: Resume execution after user selection

Add a method that takes a pending request ID and the user's selected candidates.

Example selection payload:

```json
{
  "request_id": "REQUEST_UUID",
  "security_selections": [
    {
      "index": 0,
      "selected_security": "5 HK Equity"
    }
  ],
  "field_selections": [
    {
      "index": 0,
      "selected_field": "PX_LAST"
    }
  ]
}
```

Implement a resume method:

```python
from __future__ import annotations

from copy import deepcopy
from typing import Any


class BloombergRequestResumer:
    def __init__(
        self,
        connector,
        pending_store,
    ) -> None:
        self.connector = connector
        self.pending_store = pending_store

    def resume(
        self,
        request_id: str,
        security_selections: list[dict[str, Any]] | None = None,
        field_selections: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        pending = self.pending_store.get(request_id)

        function_name = pending["function"]
        arguments = deepcopy(pending["original_arguments"])

        security_selections = security_selections or []
        field_selections = field_selections or []

        self._apply_security_selections(
            arguments,
            security_selections,
        )

        self._apply_field_selections(
            arguments,
            field_selections,
        )

        result = self._execute(
            function_name=function_name,
            arguments=arguments,
        )

        self.pending_store.delete(request_id)

        return {
            "status": "success",
            "function": function_name,
            "resolved_arguments": arguments,
            "data": result,
        }

    def _apply_security_selections(
        self,
        arguments: dict[str, Any],
        selections: list[dict[str, Any]],
    ) -> None:
        if not selections:
            return

        if "securities" in arguments:
            securities = list(arguments["securities"])

            for selection in selections:
                index = int(selection["index"])
                selected_security = selection["selected_security"]
                securities[index] = selected_security

            arguments["securities"] = securities
            return

        if "security" in arguments:
            arguments["security"] = selections[0]["selected_security"]

    def _apply_field_selections(
        self,
        arguments: dict[str, Any],
        selections: list[dict[str, Any]],
    ) -> None:
        if not selections:
            return

        if "fields" in arguments:
            fields = list(arguments["fields"])

            for selection in selections:
                index = int(selection["index"])
                selected_field = selection["selected_field"]
                fields[index] = selected_field

            arguments["fields"] = fields
            return

        if "field" in arguments:
            arguments["field"] = selections[0]["selected_field"]

    def _execute(
        self,
        function_name: str,
        arguments: dict[str, Any],
    ) -> Any:
        dispatch = {
            "BDP": self.connector.bdp,
            "BDH": self.connector.bdh,
            "BDIT": self.connector.bdit,
            "BDIB": self.connector.bdib,
            "BQL": self.connector.bql,
        }

        return dispatch[function_name](**arguments)
```

Before applying selections, validate that:

* The selected Security was present in the candidate list returned by Bloomberg.
* The selected Field mnemonic or ID was present in the candidate list returned by
  Bloomberg.
* The index exists in the original Security or Field list.
* The request has not expired.
* The request has not already been completed.

Do not allow arbitrary user-supplied identifiers to bypass candidate validation.

If the resumed request still fails with another resolvable identifier error, it is
acceptable to return another `selection_required` response. Add a maximum fallback
depth, such as 2 or 3 attempts, to prevent infinite loops.

## Phase 7: API or agent-tool interface

Integrate the gateway with the existing API or agent tools.

Prefer a simple interface:

Execute endpoint/tool

```text
POST /bloomberg/execute
```

Example request:

```json
{
  "function": "BDH",
  "arguments": {
    "securities": ["HSBC"],
    "fields": ["PX_LAST"],
    "start_date": "20250101",
    "end_date": "20260101"
  }
}
```

Possible success response:

```json
{
  "status": "success",
  "function": "BDH",
  "resolved_arguments": {
    "securities": ["HSBC"],
    "fields": ["PX_LAST"],
    "start_date": "20250101",
    "end_date": "20260101"
  },
  "data": []
}
```

Possible fallback response:

```json
{
  "status": "selection_required",
  "request_id": "REQUEST_UUID",
  "function": "BDH",
  "security_searches": [
    {
      "index": 0,
      "input": "HSBC",
      "candidates": [
        {
          "security": "5 HK Equity",
          "description": "HSBC Holdings PLC",
          "rank": 1
        },
        {
          "security": "HSBA LN Equity",
          "description": "HSBC Holdings PLC",
          "rank": 2
        }
      ]
    }
  ],
  "field_searches": []
}
```

Resume endpoint/tool

```text
POST /bloomberg/resume
```

Example request:

```json
{
  "request_id": "REQUEST_UUID",
  "security_selections": [
    {
      "index": 0,
      "selected_security": "5 HK Equity"
    }
  ],
  "field_selections": []
}
```

## Phase 8: Frontend behavior

When the backend returns:

```json
{
  "status": "selection_required"
}
```

the frontend should render candidate selectors.

For Security candidates, display:

* Canonical Bloomberg Security
* Description
* Bloomberg result rank
* Any available yellow key, exchange, currency, or asset-class metadata

For Field candidates, display:

* Field mnemonic
* Field ID
* Description
* Bloomberg result rank
* Any available documentation or datatype metadata

Do not label the first result as "recommended" unless there is explicit confidence or
ranking logic. Bloomberg result order can be retained.

After the user selects candidates, call the resume endpoint.

After the resumed request succeeds, pass the normalized Bloomberg data to the existing
visualization system.

## Phase 9: BQL handling

Do not automatically treat every BQL failure as a Search problem.

Only trigger Search if the BQL parser or Bloomberg response clearly identifies an
invalid:

* Security
* Universe identifier
* Field/item identifier

Do not trigger Search for:

* General BQL syntax errors
* Missing parentheses
* Invalid function usage
* Invalid grouping or aggregation
* Permission errors
* Query complexity limits

If the current BQL implementation accepts a complete raw BQL expression, first make
Search fallback work reliably for BDP and BDH. Then extend it to BQL only where invalid
identifiers can be extracted safely.

## Phase 10: Visualization-compatible output

Do not make visualization depend directly on raw Bloomberg response objects.

Normalize successful outputs into JSON-serializable structures.

Example historical response:

```json
{
  "status": "success",
  "function": "BDH",
  "resolved_arguments": {
    "securities": ["5 HK Equity"],
    "fields": ["PX_LAST"],
    "start_date": "20250101",
    "end_date": "20260101"
  },
  "schema": {
    "dimensions": ["date", "security"],
    "measures": ["PX_LAST"]
  },
  "rows": [
    {
      "date": "2025-01-02",
      "security": "5 HK Equity",
      "PX_LAST": 72.4
    }
  ]
}
```

Preserve field names, units, currencies, and metadata when they are available.

The visualization layer should only run after a Bloomberg request succeeds.

## Phase 11: Logging

Add structured logs for:

* Initial Bloomberg function execution
* Initial request success or failure
* Parsed Bloomberg error category
* Whether Search fallback was triggered
* Which inputs were searched
* Number of candidates returned
* Pending request creation
* User selection
* Resumed request success or failure

Do not log:

* Credentials
* Authentication tokens
* User secrets
* Full Bloomberg session configuration
* Sensitive request content beyond what is operationally necessary

## Phase 12: Tests

Add unit tests and integration-friendly tests covering at least:

**Successful fast path**

```text
Input:
A valid Security and valid Field

Expected:
Existing Bloomberg function is called once.
Search is never called.
Response status is success.
```

**Invalid Security**

```text
Input:
Invalid Security + valid Field

Expected:
Initial Bloomberg function is called.
Security Search is called only after the failure.
Field Search is not called.
Response status is selection_required.
```

**Invalid Field**

```text
Input:
Valid Security + invalid Field

Expected:
Initial Bloomberg function is called.
Field Search is called only after the failure.
Security Search is not called.
```

**Invalid Security and Field**

```text
Expected:
Both Search functions are called after the initial failure.
```

**Not entitled**

```text
Expected:
No Search call.
Original entitlement error is returned.
```

**Timeout**

```text
Expected:
No Search call.
Timeout error is returned.
```

**User resumes request**

```text
Expected:
Original arguments are restored.
Only unresolved values are replaced.
Existing Bloomberg function is called with canonical selections.
Pending request is deleted after success.
```

**Multiple Securities**

```text
Expected:
Only the Security at the failed index is searched and replaced.
Valid Securities remain unchanged.
```

**Candidate validation**

```text
Expected:
A selected value not present in the stored Bloomberg candidates is rejected.
```

Mock the Bloomberg connector and Search service for unit tests. Do not require a live
Bloomberg Terminal for the main test suite.

## Deliverables

After inspecting the codebase:

1. Explain the existing Bloomberg connector architecture briefly.
2. List the files that need to be changed or created.
3. Implement the solution directly in the repository.
4. Show the final execution flow.
5. Add or update tests.
6. Run formatting, linting, type checking, and tests using the repository's existing
   tools.
7. Report:
   * Files changed
   * Tests run
   * Any assumptions
   * Any Bloomberg API schema details that could not be verified locally

## Final architectural requirement

The finished implementation must behave like this:

```python
result = gateway.execute(
    function_name="BDP",
    arguments={
        "securities": ["AAPL US Equity"],
        "fields": ["PX_LAST"],
    },
)
```

For a valid query:

```json
{
  "status": "success",
  "data": {}
}
```

For an unresolved Security or Field:

```json
{
  "status": "selection_required",
  "request_id": "...",
  "security_searches": [],
  "field_searches": []
}
```

The system must not call Search before the initial BDP, BDH, BDIT, BDIB, or BQL attempt.

Use the existing connector as the source of truth, make the smallest maintainable
changes, and do not invent Bloomberg identifiers.

---

## 批准:实现约束(发给持有实际 Bloomberg 代码库的 AI)

上面的规格已批准。下面这段是发给实际拿着 Bloomberg connector 代码库的 AI 的批准 + 实现约束
指令,把上面的规格收紧到这个具体项目的架构上(复用现有同步 `BBGClient` session 和锁、懒加载
两个查询服务、TTL 10 分钟、最大 resume 深度 2 等)。先实现 BDP/BDH/BDIB/BDIT,BQL 只保持向后
兼容、不强行接入宽泛的 Search fallback。

指令(发给 AI):
```text
Approved. Please implement the plan directly in the repository, with the following
constraints:

1. Preserve the existing public behavior and signatures of bdp, bdh, bdib, bdit, and bql.
2. Use optimistic execution:
   - Call the existing Bloomberg function first.
   - Only trigger Search after a genuine resolvable Security or Field error.
   - Never run Search as a preflight step.
3. Reuse the existing synchronous BBGClient session and lock. Do not create a competing
   Bloomberg session or a second independent nextEvent loop.
4. Open //blp/instruments and //blp/apiflds lazily only when Search fallback is needed.
5. Search fallback should apply only to:
   - invalid or unknown security
   - invalid or unknown field
   - field not applicable to security
6. Do not trigger Search for:
   - entitlement or authorization errors
   - timeout or connection errors
   - service unavailable errors
   - invalid dates
   - request limits
   - general BQL syntax errors
7. For the first implementation, fully support BDP, BDH, BDIB, and BDIT. Keep BQL
   backward compatible, but do not add broad BQL Search fallback unless invalid
   identifiers can be extracted safely.
8. Parse and preserve Bloomberg securityError and fieldExceptions as structured errors.
   Do not depend only on matching exception strings.
9. Use an in-memory TTL pending-request store appropriate for this desktop app:
   - TTL: 10 minutes
   - thread-safe
   - maximum fallback/resume depth: 2
10. Store the actual candidate values returned by Bloomberg and validate selections
    against the stored candidate set before resuming.
11. Never allow the LLM to invent or modify Bloomberg security identifiers or field
    mnemonics.
12. When resuming, replace only the unresolved Security or Field. Preserve all other
    original arguments such as dates, intervals, overrides, and event types.
13. Do not call BloombergHealth as a data preflight.
14. Do not modify unrelated files or perform broad refactoring.
15. Add structured logs without logging credentials or sensitive session information.
16. Add mocked tests covering:
    - successful fast path with no Search call
    - invalid Security only
    - invalid Field only
    - invalid Security and Field
    - field not applicable
    - entitlement error with no Search
    - timeout with no Search
    - multiple Securities/Fields where only failed indexes are replaced
    - candidate validation
    - pending request expiry
    - successful resume
    - maximum retry depth
17. Run the existing test suite plus the new tests.

Please implement now. After implementation, provide:
- files changed
- concise explanation of the final flow
- tests and commands run
- test results
- any assumptions about Bloomberg response schemas
- any areas that still require testing against a live Bloomberg Terminal

If the actual repository architecture conflicts materially with this plan, stop and
explain the conflict before making a large architectural change.
```

---

## 验收前:最终回归测试 + 代码审查(发给持有实际 Bloomberg 代码库的 AI)

实现完成后、正式验收前的把关指令——不止跑新增测试,要跑全量套件 + formatter/linter/
type checker,并且专门核对并发安全(同一把锁要覆盖 sendRequest+nextEvent 整个生命周期)、
"正常成功请求绝不该碰 //blp/instruments 或 //blp/apiflds"、BQL 语法错误和权限错误不能被
误判成 Search 触发条件等一系列具体正确性点。只修复由本次改动引入的回归,不做无关重构。

指令(发给 AI):
```text
Before I accept the implementation, please perform a final regression and code review.

1. Run the full existing test suite, not only:
   tests/test_bloomberg_search_fallback.py

2. Run the repository's existing formatter, linter, and type checker if configured.

3. Inspect all six changed files and specifically verify:
   - no second Bloomberg Session is created
   - the same BBGClient lock protects the full sendRequest + nextEvent lifecycle
   - normal successful requests never call //blp/instruments or //blp/apiflds
   - BQL syntax and entitlement errors cannot accidentally trigger Search
   - original direct Python bdp/bdh/bdib/bdit/bql return behavior is preserved
   - the registered agent tools receive JSON-serializable responses
   - BloombergResume validates selections against stored Bloomberg candidates
   - pending requests are deleted only after successful completion or expiry
   - a failed resume can return selection_required again without exceeding max depth
   - multiple securities and fields preserve their original indexes
   - empty Bloomberg results are not incorrectly treated as successful valid data

4. Show me any test failures and fix only regressions caused by this implementation.

5. Report:
   - the full test command
   - total passed/failed/skipped
   - lint/type-check results
   - any unresolved concerns

Do not perform unrelated refactoring.
```

## 真机 Bloomberg Terminal 冒烟测试(发给持有实际 Bloomberg 代码库的 AI)

回归和代码审查通过后,再拿真实 Bloomberg Terminal 跑一轮受限的冒烟测试,覆盖:正常快速路径
(A)、无效 Security(B)、无效 Field(C)、自然语言/模糊 Security 比如直接输入"HSBC"看能不能
返回真实候选(D)、自然语言 Field 比如"last price"、明确要求不能硬编码 PX_LAST 而要用 API
真实返回的候选(E)、resume 流程(F)、以及 BDH 场景下验证 resume 后日期/频率/overrides 等
其它参数原样保留(G)。明确要求:除非真实 Bloomberg 响应证明假设的 schema 有错,否则不要改
实现。

指令(发给 AI):
```text
Please now run a limited live Bloomberg Terminal smoke test.

Do not change the implementation unless a real Bloomberg response proves that
the assumed schema is incorrect.

Test cases:

A. Valid fast path
Function: BDP
Security: AAPL US Equity
Field: PX_LAST

Expected:
- success
- no instrument search
- no field search
- no pending request

B. Invalid Security
Function: BDP
Security: NOT_A_REAL_SECURITY_123 Equity
Field: PX_LAST

Expected:
- initial BDP attempt first
- Security Search fallback only
- selection_required response
- no Field Search

C. Invalid Field
Function: BDP
Security: AAPL US Equity
Field: NOT_A_REAL_FIELD_123

Expected:
- initial BDP attempt first
- Field Search fallback only
- no Security Search

D. Natural-language ambiguous Security
Function: BDP
Security: HSBC
Field: PX_LAST

Expected:
- direct BDP attempt first
- if unresolved, return actual Bloomberg Security candidates

E. Natural-language Field
Function: BDP
Security: AAPL US Equity
Field: last price

Expected:
- direct BDP attempt first
- if unresolved, return actual Bloomberg Field candidates such as the relevant
  Bloomberg field returned by the API; do not hardcode PX_LAST

F. Resume
Choose one candidate returned by case D or E and call BloombergResume.

Expected:
- only the unresolved value is replaced
- original function and other arguments remain unchanged
- the request is re-executed successfully
- pending request is removed after success

G. Historical request preservation
Function: BDH
Use one intentionally unresolved Security while supplying a valid Field,
start date, end date, periodicity, and overrides.

After selection, verify that all dates, periodicity, and overrides are unchanged.

For every case, report:
- initial request
- raw error category/subcategory
- whether Search was called
- candidate response shape
- final normalized response
- whether the behavior matched expectations

Redact any sensitive Bloomberg or internal information.
```

## Agent 层交互核查:selection_required 状态下的用户对话流程(发给持有实际 Bloomberg 代码库的 AI)

最后一步核查的是"人"这一层——当后端返回 `selection_required` 时,AI agent 是否真的会把候选
清楚地列给用户(带 index、canonical Bloomberg 值、description)、让用户选而不是替用户猜、
内部保留 request_id、把用户的选择转换成精确的 BloombergResume schema、严格使用 Bloomberg
返回的 canonical 候选值、resume 后继续走完原请求、成功结果送入现有可视化流程。如果这一层
现在还没接好,只做最小的 agent 层改动,不需要为此新建前端组件(除非现有 UI 架构本来就要求)。
另外要求给一段完整的示例对话,从用户提交一个模糊的 BDP 请求、直接请求失败、展示候选、用户
选择、调用 BloombergResume、到成功结果送去可视化,走完整个闭环。

指令(发给 AI):
```text
Please inspect the agent-facing interaction for status="selection_required".

Verify that the AI agent will:

1. Present the Security and/or Field candidates clearly to the user.
2. Include candidate index, canonical Bloomberg value, and description.
3. Ask the user to select rather than guessing.
4. Preserve the request_id internally.
5. Convert the user's selection into the exact BloombergResume schema.
6. Use the canonical candidate exactly as returned by Bloomberg.
7. Continue the original request after resume.
8. Pass successful results into the existing visualization flow.

If this interaction is not currently implemented, add the smallest possible
agent-layer change. Do not build a new frontend component unless the existing
UI architecture requires one.

Also provide one complete example conversation:
- user submits ambiguous BDP request
- direct request fails
- candidates are shown
- user selects
- BloombergResume is called
- successful result is returned for visualization
```

## 真机拼写错误用例:Security 拼写错误 / Field 拼写错误(发给持有实际 Bloomberg 代码库的 AI)

两个针对性的真机测试用例,专门验证"LLM 不许自作主张纠正拼写错误"这条硬约束——故意把
`AAPL US Equity` 打错成 `AAPL US Equit`、把 `PX_LAST` 打错成 `PX_LSAT`,要求原样传给 BDP,
不许在调用前被模型悄悄"修正"掉,只能等 BDP 真的因为无法解析而报错后,才走已实现的 Search
fallback 去找真实候选。

指令(发给 AI,共两条,分别测试):

```text
Call Bloomberg BDP with the exact raw arguments below.

Security: AAPL US Equit
Field: PX_LAST

Do not correct, normalize, infer, or replace the Security before calling BDP.
Pass the Security string exactly as written.
If BDP fails with a Security resolution error, use the implemented Search fallback.
```

```text
Call Bloomberg BDP with the exact raw arguments below.

Security: AAPL US Equity
Field: PX_LSAT

Do not correct, normalize, infer, or replace the Field before calling BDP.
Pass the Field string exactly as written.
If BDP fails with a Field resolution error, use the implemented Search fallback.
```

## 自然语言解析规则:语义歧义预判 + 事后错误兜底,两条路径都能触发 Search(发给持有实际 Bloomberg 代码库的 AI)

之前的实现只在 Bloomberg 请求真正失败(报错)之后才触发 Search。这条补充规则扩展了触发时机:
除了"执行后报错触发"这条已有路径,再加一条"执行前语义判断触发"——比如用户说的公司有多个
主要上市地、债券没指定到期/票息/币种、泛指的基准名称可能对应指数/现券/期货、字段有多种材质
上不同的定义、期权/波动率请求缺少 tenor/delta/strike 等关键要素——这些情况即使 Bloomberg
函数本身"能跑",也不该让模型悄悄挑一个解释就执行,而是要主动走 Search 让用户选。核心边界仍
是"清晰、高置信度的请求走原来的快路径,不是每个请求都要 Search",只是把"该不该 Search"的
判断点从"只能等报错"扩展成了"执行前+执行后都能判断"。

指令(发给 AI):
```text
When translating a user's natural-language request into Bloomberg arguments:

1. Use the existing Bloomberg functions directly when the intended Security,
   Field, and function are unambiguous.

2. Do not ask users to provide Bloomberg Security identifiers or field
   mnemonics. Users should be able to describe their data need naturally.

3. You may resolve widely recognized, high-confidence requests directly.
   Example:
   "AAPL stock price for the past month"
   → BDH
   → AAPL US Equity
   → PX_LAST

4. Do not silently select among multiple materially different valid
   interpretations.

5. Treat the following as ambiguous and use Bloomberg Search:
   - a company with multiple major listings and no market specified
   - bonds without a unique maturity/coupon/currency/security
   - generic benchmark names that may refer to an index, cash security, or
     futures contract
   - fields with multiple materially different definitions
   - options or volatility requests without sufficient tenor/delta/strike
   - any low-confidence Security or Field resolution

6. Search can be triggered in two situations:
   a. Semantic ambiguity is detected before execution.
   b. The initial Bloomberg function fails with a resolvable Security or Field
      error.

7. Do not run Search for every request. Preserve the fast path for clear,
   high-confidence requests.

8. When Search returns multiple reasonable candidates:
   - present canonical identifier and description
   - explain the material difference
   - wait for the user's selection
   - never choose automatically

9. After selection, call BloombergResume or execute the preserved original
   request with only the unresolved identifier replaced.

10. Preserve the user's original dates, periodicity, overrides, comparison
    intent, and visualization request.
```

## 收紧为严格"先执行、后 Search"模型,推翻上一条的语义歧义预判(发给持有实际 Bloomberg 代码库的 AI)

⚠️ **与上一条("自然语言解析规则:语义歧义预判 + 事后错误兜底")直接冲突**:这条明确要求
第 15 点"Do not add a semantic-ambiguity pre-search step"——不允许执行前的语义歧义预判,
Search 的唯一触发路径必须是"先执行、失败后再看错误类型",回到最初 P0 spec 的严格版本。
两条指令都已存档在本文档里,如果要交给实现方,请自行决定采用哪一版(或者明确告知"以这条
为准,忽略上一条"),避免实现方看到文档里两条互相矛盾的规则不知道听哪个。

除了这条覆盖关系,这次新增的实质内容还有:①明确要求把整个 Bloomberg/Search 内部流程对
用户完全隐藏(除非显式开启 debug 模式),给了具体的用户可见文案范例("I couldn't identify
the exact HSBC security. Please choose one: ...");②明确"空结果/N/A 本身不能单独作为触发
Search 的证据",除非连接器能确认空结果确实是因为标识符无法解析导致的——这是为了防止"周末
没交易、字段合法但确实是 N/A"这类正常空数据被误判成需要 Search。

指令(发给 AI):
```text
Please adjust the Bloomberg agent workflow to use a strict execution-first
Search fallback model.

The user should interact only through natural-language requests, for example:

"Please give me AAPL stock price for the past month."

The user should not need to provide or understand Bloomberg Security identifiers,
Field mnemonics, or function names.

Required internal workflow:

1. Parse the natural-language request into:
   - Bloomberg function: BDP / BDH / BDIT / BDIB / BQL
   - Security
   - Field
   - dates and other required arguments

2. Call the selected existing Bloomberg function immediately.

3. If the call succeeds and returns usable data:
   - return the data
   - continue to the existing visualization workflow
   - do not call Search
   - do not mention Search or Bloomberg resolution to the user

4. If the call fails:
   - inspect structured Bloomberg errors
   - trigger Search only when the error indicates that a Security or Field
     cannot be resolved, or that the Field is not applicable to the Security

5. Search-triggering cases include:
   - securityError
   - BAD_SEC
   - UNKNOWN_SECURITY
   - INVALID_SECURITY
   - fieldExceptions
   - BAD_FLD
   - UNKNOWN_FIELD
   - INVALID_FIELD
   - field not applicable to Security

6. Do not trigger Search for:
   - entitlement or authorization errors
   - timeout or connection errors
   - service unavailable errors
   - invalid dates or time ranges
   - request limits
   - general BQL syntax errors
   - weekends or holidays
   - no trading activity
   - a valid Field whose value is genuinely N/A
   - a valid Security with no observations in the requested period

7. Do not use `no value`, an empty list, or null alone as sufficient evidence to
   trigger Search. Search should require identifier-resolution evidence from the
   Bloomberg response, unless the connector can reliably prove that the empty
   result was caused by an unresolved identifier.

8. If only the Security failed:
   - run Security Search only

9. If only the Field failed:
   - run Field Search only

10. If both failed:
    - run both searches

11. When Search returns candidates:
    - return a concise `selection_required` response
    - show only the information needed for selection
    - do not explain the internal workflow to the user
    - do not automatically select a candidate

Example user-facing response:

"I couldn't identify the exact HSBC security. Please choose one:

1. 5 HK Equity — HSBC Holdings, Hong Kong listing
2. HSBA LN Equity — HSBC Holdings, London listing
3. HSBC US Equity — HSBC Holdings ADR, US listing"

12. Preserve the original request internally, including:
    - Bloomberg function
    - dates
    - periodicity
    - interval
    - event type
    - overrides
    - comparison and visualization intent

13. After the user selects a candidate:
    - call BloombergResume
    - replace only the unresolved identifier
    - preserve all other original arguments
    - execute the original Bloomberg request
    - continue automatically to visualization

14. Keep all internal tool and error details hidden from the user unless debug
    mode is explicitly enabled.

15. Do not add a semantic-ambiguity pre-search step. The default path must always
    be:
    execute first → Search only after a resolvable Bloomberg error.

Please inspect the current implementation and make only the smallest changes
needed to enforce this behavior. Add tests for empty-data cases to ensure that
legitimate empty or N/A results do not incorrectly trigger Search.
```

### 真机进展:AI Markets Desktop 已进入 Plan Mode 并给出检查结论(真机截图确认,尚未看具体 diff)

- 这是在实际持有 Bloomberg 代码库的 AI Markets Desktop app 里(不是本追踪仓库)看到的真机
  截图,对应上面"收紧为严格先执行、后 Search 模型"那条指令的执行进展。
- **关键发现,跟本文档的判断一致**:现有后端架构已经基本对了——`BloombergExecutionGateway`
  已经是"先执行选中的 Bloomberg 函数,只有报错后才跑 fallback 逻辑"的模式,不需要推倒重来。
  它总结的主要修改点:①收紧 classifier 的判断行为;②把指令文本改成让模型不再做"语义预判"
  (呼应上一条指令第 15 点的收紧);③加空结果/N/A 不误触发 Search 的测试。跟前面已批准的
  方案方向一致。
- **额外确认了一条相关但不完全同一件事的规则**(Bloomberg 数据请求的调用顺序,不是 Search
  fallback 本身):
  - 先调用 `BloombergInstructions`;
  - **不要**把 `BloombergHealth` 当作数据请求的 preflight 检查来调用;
  - 需要数据时再调用对应的 Bloomberg 数据端点;
  - 只有用户明确要求检查连通性时才调用 `BloombergHealth`。
  这跟之前 docs/07 里"不要把 BloombergHealth 当数据 preflight"的原则(见 P13 那条实现约束
  第 13 点)是同一条规则在真机里被再次确认执行,不是新规则。
- **尚未审查的部分**:截图显示 `default.md` 这个文件被改动了 +102 / −79 行,但截图没有展开
  具体 diff 内容,所以这条改动本身是否符合上面存档的所有规则(尤其是刚推翻的语义预判那条)
  还没有核实,只是记录"它确实在往这个方向推进",不代表已验收。下次如果能拿到 `default.md`
  的具体 diff 内容,应该核对它是否已经把"语义预判"相关的措辞从指令文本里删掉了。

## 批准实现:收紧 classifier + 空结果不触发 Search + 隐藏内部步骤(发给持有实际 Bloomberg 代码库的 AI)

对上面 Plan Mode 给出的方案正式批准实现。这条把"严格先执行、后 Search"模型落到具体的
实现清单上:①收紧 fallback classifier,只有结构化的 Security/Field 解析错误才触发 Search;
②明确"结果为空/null/N/A/没有观测值"本身不能单独作为触发 Search 的证据(呼应前面"周末/
假日没有交易"那类合法空结果的场景);③补充具体测试用例(合法空历史区间、合法 Security 但
Field 是 N/A、周末/假日无观测值都不触发 Search;无效 Security/Field/字段不适用这三种才触发
对应的 Search);④用户可见的回复要保持简洁,`BloombergInstructions`、错误分类、pending
request ID、`BloombergResume` 这些内部实现细节除非显式开 debug 模式,否则不能暴露给用户;
⑤再次重申不加语义预判、不向用户要 Security/Field 参数;⑥保持所有现有函数签名和行为不变。

指令(发给 AI):
```text
Approved. Please implement the minimal-change plan now.

The intended workflow is strictly:

natural-language request
→ select and call BDP / BDH / BDIT / BDIB / BQL first
→ if successful, return data and continue to visualization
→ if the Bloomberg response contains a resolvable Security or Field error,
  trigger Search
→ show concise candidates
→ wait for the user's selection
→ resume the original request

Please complete the remaining work:

1. Tighten the backend fallback classifier so Search is triggered only by
   structured Security/Field resolution errors.

2. Do not trigger Search solely because the result is empty, null, N/A, or has
   no observations.

3. Add tests covering:
   - valid empty historical period: no Search
   - valid Security with N/A Field value: no Search
   - weekend/holiday with no observations: no Search
   - invalid Security: Security Search
   - invalid Field: Field Search
   - field not applicable: Field Search

4. Keep the user-facing response concise. Do not expose internal steps such as
   BloombergInstructions, error classification, pending request IDs, or
   BloombergResume unless debug mode is enabled.

5. Do not add semantic pre-search or ask users for Security/Field parameters.

6. Preserve all existing BDP, BDH, BDIT, BDIB, and BQL behavior and signatures.

Implement the code and tests now, then report:
- files changed
- tests run and results
- exact Search-triggering conditions
- any remaining live Bloomberg verification needed
```

## 新增能力:通用"发现型空结果"Fallback 框架 + 资产类别适配器架构(发给持有实际 Bloomberg 代码库的 AI)

这是在已批准的 Search fallback 之上新增的一类触发原因,不是之前那些"结构化 Security/Field
解析错误"的替代,而是补充第三种场景:用户用自然语言描述了一组特征(比如"某发行人的某类
债券"),没有一个具体的 canonical Security 被解析出来,初始查询返回空结果——这种"空"跟
"已经解析出具体 Security、但这个 Security 本身没有观测值/是 N/A/赶上周末假日"是两回事,
后者依然不该触发 Search(前面几条指令已经反复强调这条边界),但前者(尚未定位到任何具体
证券、结果为空是因为"发现"这一步就没找到东西)应该走 Search。新触发原因命名为
`discovery_universe_empty`。

架构上要求做成通用框架而不是"只为债券写死"的特例:通用 resolver 负责 fallback 分类、
调 Search、pending request 存储、候选校验、resume、保留原始请求和可视化意图这些跟资产类别
无关的部分;每个资产类别的 adapter(Equity / Bond / Rates-Index / FX / Options-Volatility)
只负责 Search query 怎么构造、候选怎么丰富/排序/过滤、给用户看的简洁 metadata 长什么样。
明确要求:不需要为每个资产类别现在就写全,只需要实现通用接口 + 完整实现 Bond adapter(当前
实际用例),其余 adapter 允许后续再补,不改动通用 fallback gateway。

指令(发给 AI):
```text
Please implement the empty-discovery fallback as a general framework, not as a
bond-only special case.

Add a generic fallback reason:

discovery_universe_empty

It should apply when:

1. The user described a security or set of securities using natural-language
   attributes.
2. No canonical Bloomberg Security was successfully resolved.
3. The initially selected Bloomberg query returned no securities or rows.
4. The request contains useful constraints from which a Search query can be
   constructed.
5. The empty result is from security discovery, not from a resolved security
   having no market observations.

Create an asset-class-aware resolver architecture:

- Generic candidate resolver
- Equity candidate adapter
- Bond candidate adapter
- Rates/index candidate adapter
- FX candidate adapter
- Options/volatility candidate adapter

Do not build full implementations for every asset class if the current codebase
does not need them yet. Implement the generic interface and fully implement the
Bond adapter for the current use case, while allowing other adapters to be
added without changing the fallback gateway.

The common resolver should handle:

- fallback classification
- Search invocation
- pending request storage
- candidate validation
- resume
- preservation of the original request and visualization intent

The asset-class adapter should handle only:

- Search-query construction
- candidate enrichment
- candidate ranking/filtering
- concise user-facing metadata

For bonds, enrich candidates with available:

- issuer
- coupon
- maturity
- currency
- seniority
- callable status
- canonical Bloomberg Security

For equities, use available:

- company
- exchange
- country
- currency
- canonical Bloomberg Security

For rates/index products, distinguish where possible:

- cash security
- benchmark index
- futures contract
- tenor

Do not trigger discovery fallback for an already resolved canonical Security
that simply has no observations, an N/A value, a weekend/holiday, or no trades.

Add tests proving that:

- a fuzzy bond discovery request returning empty triggers the generic
  discovery_universe_empty path and Bond adapter
- a fuzzy equity discovery request can use the same generic path
- a resolved Security with empty data does not trigger Search
- adapters do not duplicate pending-request or resume logic
```

## 收缩范围:撤回上一条的 resolver/adapter 架构,只加一个最小判断条件(发给持有实际 Bloomberg 代码库的 AI)

⚠️ **收缩上一条("新增能力:通用发现型空结果 Fallback 框架 + 资产类别适配器架构")**:上一条
提出的通用 resolver + Equity/Bond/Rates-Index/FX/Options adapter 架构被明确叫停——用户认可
这套架构未来可能有用,但不是当前目标。当前目标依然只是最开始批准的那条窄流程(先执行→
结构化 Security/Field 错误才 Search→展示候选→用户选→resume→可视化),只多加一种触发条件:
`is_security_discovery == true` 且没有解析出任何 canonical Security 且初始 BQL 结果为空时,
复用**已有的** Security Search,不新建 resolver 层、不新建 adapter、不新建 metadata 架构。
明确要求先给出收缩后的方案,批准了再实现,不要直接动手写代码。

指令(发给 AI):
```text
I understand that the proposed resolver/adapters architecture may support more
asset classes in the future, but that is not the current objective.

My current objective is only to complete the previously agreed workflow:

natural-language request
→ call the existing Bloomberg function first
→ if successful, return data and visualize
→ if there is a structured Security/Field resolution error, call Search
→ if a security-discovery BQL request returns empty before any canonical
  Security is resolved, call Security Search
→ show concise candidates
→ user selects
→ resume the original request
→ visualize

Please do not introduce resolver layers, asset-class adapters, or a new metadata
architecture at this stage.

Revise the plan to the smallest implementation using the existing:
- BloombergExecutionGateway
- Search functions
- pending request store
- candidate validation
- BloombergResume

The only additional case should be:

is_security_discovery == true
AND no canonical Security has been resolved
AND the initial BQL result is empty
→ trigger existing Security Search using a concise query derived from the
original request.

Please show the revised narrow plan before implementing.
```

## 批准实现:窄版 BQL 发现型空结果 fallback(发给持有实际 Bloomberg 代码库的 AI)

对上一条收缩后的窄方案正式批准实现——不加 resolver 层、不加 adapter、不加新的 metadata
架构,完全复用现有的 `BloombergExecutionGateway`、Security Search、pending request store、
candidate validation、`BloombergResume`。新的触发条件收紧为三个同时成立才生效:①原始请求
本身就是在尝试发现一个或多个证券;②没有解析出任何 canonical Bloomberg Security;③BQL
discovery 结果为空。同时再次重申一遍已经反复确认过的边界:已解析出的 Security 没有观测值、
周末/假日空数据、无成交、合法 N/A、已解析的 canonical BQL universe 返回空,这些都不触发
Search。测试范围也收紧为只加三个针对性用例,不铺开测。

指令(发给 AI):
```text
Approved. Please implement the revised narrow plan exactly as described.

Important constraints:

1. Do not add resolver layers, asset-class adapters, or a new metadata architecture.
2. Reuse the existing BloombergExecutionGateway, Security Search, pending request store, candidate validation, and BloombergResume.
3. Preserve the execution-first workflow:
   natural-language request
   → existing Bloomberg function first
   → success: return data and visualize
   → structured Security/Field error: existing Search fallback
   → unresolved security-discovery BQL returns empty: Security Search
   → user selects
   → resume the original request
   → visualize
4. The new BQL-empty fallback must run only when:
   - the original request was trying to discover one or more securities,
   - no canonical Bloomberg Security was resolved,
   - and the BQL discovery result is empty.
5. Do not trigger Search for:
   - a resolved Security with no observations,
   - weekend or holiday empty data,
   - no trades,
   - valid N/A values,
   - an already resolved canonical BQL universe returning empty.
6. Preserve the original dates, fields, periodicity, overrides, and visualization intent after the user selects a candidate.
7. Keep user-facing candidate messages concise and hide internal BQL expressions, request IDs, classifiers, and resume details.
8. Add only focused tests for:
   - unresolved discovery BQL empty → Security Search
   - resolved canonical Security empty → no Search
   - candidate selection → original request resumes with dates and visualization intent preserved

Implement now, run the relevant tests, and report:
- files changed
- tests run and results
- the exact new fallback condition
- remaining live Bloomberg verification needed
```

## 真机测试发现新问题:Agent 没有走 Search fallback,而是自己连续重试了 5 次 BQL(真机截图确认,窄方案实现后的首次真机验证)

- **现象**:上一条窄方案实现后拿真机测试,预期是"第一次 BQL 发现结果为空 → 立刻走已有的
  Security Search fallback → 返回 `selection_required` → 展示候选 → 等用户选"。但实际观察到
  的是 agent 连续发起了 **5 次** `BloombergBQL` 调用——每次空结果后自己改写 issuer/security
  的描述文字再试一次 BQL,始终没有触发 `selection_required`,也没有展示 Bloomberg Security
  Search 候选,最后绕过 Search 直接问用户"能不能提供 ticker、ISIN 或 CUSIP"。
- **问题定位**:这不是"该不该触发 Search"判断错了,而是控制流层面没有在第一次空结果后就
  停下来交给 Search——模型把"结果为空"当成了"换个说法再查一次"的信号,而不是"进入既定
  fallback 流程"的信号,导致本该一次性触发的 Search 被绕过,退化成了模型自己瞎猜 5 轮
  自然语言变体、猜不出来才甩锅问用户要 ticker/ISIN/CUSIP——这恰恰是这整套 Search fallback
  机制原本要避免的行为(不该让用户自己提供 Bloomberg 标识符)。
- 修复要求很聚焦:**第一次 BQL 发现请求为空后就必须停,不允许再用改写过的说法重试 BQL**,
  直接复用原始的内部 search query(不是让模型重新造一个)进入既有的 Security Search
  fallback;如果 Search 本身返回零候选,才允许问用户*一个*聚焦的业务澄清问题(问到期日/
  发行主体/币种/优先级这类有用约束,依然不能直接问 ticker/ISIN/CUSIP)。同时要求实现方
  报告清楚"之前为什么会连续发 5 次 BQL"的根因,以及这次具体是靠什么控制流改动堵住的。

指令(发给 AI):
```text
The live test did not follow the intended workflow.

Observed behavior:

- The agent made five consecutive BloombergBQL calls.
- After each empty result, it rewrote the issuer/security description and tried
  BQL again.
- It did not return `selection_required`.
- It did not show Bloomberg Security Search candidates.
- It eventually asked the user to provide a ticker, ISIN, or CUSIP.

This is not the required behavior.

Please make the smallest orchestration change needed.

Required behavior:

1. The agent may make only one initial Bloomberg data-function attempt for this
   request.

2. For a BQL security-discovery request where:

   - is_security_discovery == true
   - canonical_security_resolved == false
   - the first BQL result is empty

   immediately enter the existing Security Search fallback.

3. Do not retry BQL with rewritten issuer names, ticker guesses, or alternative
   expressions after the first empty discovery result.

4. Reuse the original internal search query, for example:

   "HSBC USD bond 2030"

5. The existing gateway should then:

   - call the existing Bloomberg Security Search
   - store the original request
   - return `selection_required`
   - return concise candidates
   - stop and wait for the user's selection

6. If Search finds candidates, the user-facing response should contain only a
   concise choice list. Do not mention the BQL expression, empty tables,
   internal hints, request ID, or retry attempts.

7. After selection:

   - call BloombergResume
   - replace only the unresolved Security
   - preserve the one-month date range, price field, periodicity, overrides,
     and visualization intent
   - execute BDH
   - continue to visualization

8. Only if the actual Bloomberg Security Search itself returns zero candidates
   may the agent ask one concise clarification question.

   Do not immediately ask the user for ticker, ISIN, or CUSIP. First ask for a
   useful business constraint such as exact maturity, issuer entity, currency,
   or seniority.

9. Prevent the agent from issuing additional BloombergBQL calls after:

   - a discovery-empty result, or
   - a `selection_required` response.

10. Add a focused test that simulates this live request and verifies:

   - BloombergBQL call count == 1
   - Security Search call count == 1
   - additional BloombergBQL call count == 0
   - result status == `selection_required`
   - original date range and visualization intent are stored
   - after selection, BloombergResume executes BDH

Do not add new resolver layers or asset-class adapters.
Do not refactor unrelated code.

After implementing, report exactly why the agent previously issued five BQL
calls and which instruction or control-flow change now prevents that loop.
```

## 暂停继续改编排,先诊断 Search 能力本身是否真的能用(真机截图确认,控制流问题修好了但 Search 本身没验证过)

- **最新真机测试结果**:上一条的控制流问题确实修好了——`BloombergBQL` 这次只调用了一次,
  没有再重试。但整体结果依然没达到预期:发现结果为空后,fallback 报告"Security Search
  返回零候选",于是又退回到问用户要 ticker/ISIN/CUSIP。也就是说,循环重试这个 bug 修好了,
  但真正的问题浮出水面了——**Search 这个能力本身,到目前为止其实从没被真机验证过是否真的
  能查到东西**,之前几轮全部在改"什么时候该不该触发 Search"这个编排逻辑,从没人确认过
  Search 被触发之后,底层查询和解析是不是对的。
- 这条明确要求**先停下来诊断,不要再改编排代码**:先搞清楚空 BQL 结果之后 Security Search
  到底有没有被真的调用、用的是哪个 Bloomberg 服务/请求(`//blp/instruments`
  `instrumentListRequest`?还是 BQL?还是别的机制)、传进去的具体 query 和 filter 是什么、
  Bloomberg 原始返回是什么、是真的零结果、解析报错,还是返回了东西但被现有 parser 丢弃了。
- 诊断之后要求把 Search 重新设计成两种明确区分的模式,而不是含混地共用一套:**A. Identifier
  lookup**(名字/ticker/标识符解析不出来,比如"HSBC"、拼错的"AAPL US Equit"、无效 Field)
  和 **B. Security discovery**(用户用一组约束描述一批证券,比如发行人=HSBC、资产类别=
  公司债、币种=USD、到期日大约 2030)。给了一个具体的最小接口签名
  `search_security(query, mode, asset_class, issuer, currency, maturity_start,
  maturity_end, max_results)`。明确要求 discovery 模式要用结构化的 Bloomberg/BQL 过滤条件
  去查,**不能直接把历史价格查询本身当成 discovery 查询去用**——这可能正是 HSBC 债券例子
  一直查不到东西的根因之一。再次重申不要加 asset-class adapter 层或宽泛的 resolver 架构
  (呼应之前已经撤回过一次的那条)。
- 要求在重新接回 fallback 主流程之前,先独立跑 4 个 Search 自测(AAPL lookup、HSBC lookup、
  "last price" field lookup、HSBC USD corporate bond 2029-2031 discovery),确认 Search
  本身真的能返回候选,再考虑要不要改动现有的 execution-first gateway。诊断阶段明确禁止再
  问用户 ticker/ISIN/CUSIP。

指令(发给 AI):
```text
We need to pause further fallback/orchestration changes and re-plan around the
actual Search capability.

The latest live test still did not achieve the intended outcome:

User:
"Please show me the price performance of HSBC USD bonds maturing around 2030
over the past month."

Observed:
- BloombergBQL was called once.
- The discovery result was empty.
- The fallback reported that Security Search returned no candidates.
- The user was asked to provide a ticker, ISIN, or CUSIP.

The control-flow loop has been reduced, but the core Search capability has not
been proven to work.

Do not modify code yet.

First inspect and report:

1. After the empty BQL result, was the existing Security Search actually called?
2. Which Bloomberg service/request was used?
3. What exact query and filters were passed?
4. What was the raw Bloomberg Search response?
5. Did Bloomberg return zero results, a parsing error, or results that the
   current parser discarded?
6. Was Search using:
   - //blp/instruments instrumentListRequest
   - BQL
   - or another mechanism?

Then revise the design around two narrowly defined Search modes:

A. Identifier lookup
Use when a name, ticker, or identifier cannot be resolved, for example:
- "HSBC"
- "AAPL US Equit"
- an invalid Bloomberg Field

B. Security discovery
Use when the user describes a set of securities using constraints, for example:
- issuer = HSBC
- asset class = corporate bond
- currency = USD
- maturity approximately 2030

Do not add asset-class adapter layers or a broad resolver architecture.

The Search tool may have a minimal interface such as:

search_security(
    query: str,
    mode: "lookup" | "discovery",
    asset_class: str | None = None,
    issuer: str | None = None,
    currency: str | None = None,
    maturity_start: str | None = None,
    maturity_end: str | None = None,
    max_results: int = 10
)

For lookup mode:
- reuse Bloomberg instrument lookup
- return canonical Bloomberg securities and descriptions

For discovery mode:
- use structured Bloomberg/BQL filtering to return actual securities
- do not use the historical-price query itself as the discovery query
- return canonical identifiers plus useful metadata

For the HSBC example, the discovery request should be structurally equivalent to:

asset_class = corporate bond
issuer = HSBC
currency = USD
maturity_start = 2029-01-01
maturity_end = 2031-12-31

It should return a list of securities with available:
- canonical Bloomberg identifier
- name/description
- coupon
- maturity
- currency

Before reconnecting this to the fallback workflow, run live Search tests
independently:

Test 1:
Lookup query = "AAPL"
Expected: at least one equity candidate.

Test 2:
Lookup query = "HSBC"
Expected: multiple relevant HSBC candidates.

Test 3:
Field query = "last price"
Expected: relevant Bloomberg Field candidates.

Test 4:
Discovery:
issuer = HSBC
asset class = corporate bond
currency = USD
maturity between 2029 and 2031
Expected: matching bond candidates, or a clear raw Bloomberg explanation for
why none are returned.

Do not change the existing execution-first gateway until these standalone Search
tests work.

After investigation, report:
- why the current Search returned no candidates
- whether the problem is query construction, Bloomberg service limitations, or
  response parsing
- the smallest files/functions that need to change
- the proposed live validation steps

Do not ask the end user for ticker, ISIN, or CUSIP while Search capability is
still being diagnosed.
```

## 设计收敛:identifier_lookup / security_discovery 两种模式 + 轻量 query-builder 分发(不是 adapter 类)(发给持有实际 Bloomberg 代码库的 AI)

这条是在上一条"先诊断 Search 本身"的基础上,把讨论中定下的方向正式落成实现指令,处于之前
两个极端之间的折中方案:既不是被撤回的那套通用 resolver + 每资产类别一个 adapter 类的重
架构,也不是收得过窄、只覆盖债券一种场景的单一条件判断。核心变化:

- **明确两种 Search 模式**,而不是含混共用一套:`identifier_lookup`(名字/ticker/标识符/
  Field 解析不出来,比如"HSBC"、"AAPL US Equit"、无效 Field)和 `security_discovery`(用户
  用自然语言约束描述一批证券,不止债券,还包括股票、基金/ETF、利率产品、FX、期权/波动率等
  例子:"HSBC USD bonds maturing around 2030"、"Hong Kong-listed HSBC shares"、"China
  high-dividend ETFs"、"US 5–7 year government bonds"、"EURUSD three-month forward"、
  "AAPL one-month ATM implied volatility")。
- 用**一个通用 Search 接口** `search_security(mode, query, asset_class, constraints,
  max_results)`,不是每个资产类别单开一个 adapter 类;`constraints` 是一个通用字典,
  收纳 company/issuer/asset_class/country/region/market/exchange/currency/
  maturity_start/maturity_end/tenor/coupon/seniority/sector/strategy/currency_pair/
  underlying/expiry/strike/delta/moneyness/instrument_type 这些 key,不强制要求全支持。
- **允许有一个小的 query-builder 分发**(`build_bond_discovery_query()` /
  `build_equity_discovery_query()` / `build_fund_discovery_query()` /
  `build_rates_discovery_query()` / `build_fx_discovery_query()` /
  `build_option_discovery_query()` / `build_generic_discovery_query()`),但明确这是
  "函数分发",不是"resolver 类 + adapter 类"那套被撤回的架构——只实现当前 Bloomberg
  connector 能可靠支持的资产类别,支持不了的直接给一句简洁澄清,不硬造标识符。
- **统一的结果归一化格式**:`{security, name, description, asset_class, metadata}`,
  资产类别专属的细节(coupon/maturity/seniority、exchange/country、tenor/instrument_type、
  currency_pair、underlying/expiry/strike/delta/moneyness 等)全部收进 `metadata` 里,
  不污染顶层结构——这样上层 fallback gateway 处理候选时不需要关心资产类别差异。
- 同样要求**先只做独立验证**(7 个用例:AAPL lookup、HSBC lookup、HSBC 港股 equity
  discovery、HSBC USD bond discovery、中国高股息基金 discovery、美国 10Y 利率 discovery、
  已解析 Security 空观测值不触发 Search),验证过、方案审过之后才接回正常的 agent 工作流。
  实现前先报告:现有 Bloomberg 服务和 BQL 能可靠支持哪些资产类别、哪些 query builder 真的
  有必要现在就写、改动面最小的文件是哪些——不批准不动代码。

指令(发给 AI):
```text
Please revise the Bloomberg Search capability so it supports security discovery
beyond bonds, while keeping the existing execution-first workflow and avoiding
a large resolver/adapter architecture.

The system should support two Search modes:

1. identifier_lookup
   Used when a security name, ticker, identifier, or field cannot be resolved.

   Examples:
   - "HSBC"
   - "Apple stock"
   - "AAPL US Equit"
   - an invalid Bloomberg ticker

2. security_discovery
   Used when the user describes one or more securities using natural-language
   constraints.

   Examples:
   - HSBC USD bonds maturing around 2030
   - Hong Kong-listed HSBC shares
   - China high-dividend ETFs
   - US 5–7 year government bonds
   - EURUSD three-month forward
   - AAPL one-month ATM implied volatility

Use one common Search interface, for example:

search_security(
    mode: "identifier_lookup" | "security_discovery",
    query: str | None = None,
    asset_class: str | None = None,
    constraints: dict | None = None,
    max_results: int = 10
)

Do not ask the user to supply these parameters. The agent should derive them
internally from the natural-language request.

Required workflow:

1. Parse the user's natural-language request.
2. Call the existing Bloomberg function first:
   BDP / BDH / BDIT / BDIB / BQL.
3. If successful, return data and continue to visualization.
4. If there is a structured Security/Field resolution error, use
   identifier_lookup.
5. If the request is a security-discovery request, no canonical Security has
   been resolved, and the first discovery query returns empty, use
   security_discovery.
6. Do not retry the original BQL query repeatedly with rewritten descriptions.
7. Run at most one initial data-function attempt before entering Search fallback.
8. Return concise candidates and wait for user selection.
9. Resume the original request after selection while preserving dates, fields,
   periodicity, overrides, and visualization intent.

Keep Field Search separate and unchanged.

For security_discovery, support a common constraints dictionary. Recognized
constraint keys may include:

- company
- issuer
- asset_class
- country
- region
- market
- exchange
- currency
- maturity_start
- maturity_end
- tenor
- coupon
- seniority
- sector
- strategy
- currency_pair
- underlying
- expiry
- strike
- delta
- moneyness
- instrument_type

Do not create separate resolver classes or adapter layers.

A small query-builder dispatch is acceptable:

- build_bond_discovery_query()
- build_equity_discovery_query()
- build_fund_discovery_query()
- build_rates_discovery_query()
- build_fx_discovery_query()
- build_option_discovery_query()
- build_generic_discovery_query()

Only implement the asset classes that can be supported reliably with the
current Bloomberg connector. For unsupported classes, return one concise
clarification instead of inventing identifiers.

Normalize all Search results into:

{
  "security": "canonical Bloomberg identifier",
  "name": "display name",
  "description": "description",
  "asset_class": "asset class",
  "metadata": {}
}

Asset-specific details should be stored only inside metadata.

Examples:

Equity metadata:
- exchange
- country
- currency

Bond metadata:
- coupon
- maturity
- currency
- seniority

Rates metadata:
- country
- tenor
- instrument_type

FX metadata:
- currency_pair
- tenor
- instrument_type

Options metadata:
- underlying
- expiry
- strike
- delta
- moneyness

Before reconnecting discovery Search to the normal agent workflow, add
standalone live or mocked validation for:

1. Identifier lookup: "AAPL"
2. Identifier lookup: "HSBC"
3. Equity discovery:
   company = HSBC
   market = Hong Kong
4. Bond discovery:
   issuer = HSBC
   currency = USD
   maturity between 2029 and 2031
5. Fund discovery:
   region = China
   strategy = high dividend
6. Rates discovery:
   country = United States
   tenor = 10Y
7. Resolved canonical Security with empty observations:
   must not trigger Search

First inspect the current code and report:
- which asset classes can be reliably supported with the current Bloomberg
  services and BQL implementation
- which query builders are actually necessary
- the smallest files that need modification

Do not modify code until presenting this narrow plan.
```
