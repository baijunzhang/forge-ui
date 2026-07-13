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
