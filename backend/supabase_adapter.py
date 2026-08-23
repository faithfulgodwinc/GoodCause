import json
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
import supabase_db

def _to_db_val(k: str, val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    if isinstance(val, str) and (k.endswith("_at") or k in ("deadline", "date")):
        try:
            return datetime.fromisoformat(val)
        except Exception:
            pass
    return val

def _from_row(table_name: str, row: Dict[str, Any]) -> Dict[str, Any]:
    if not row:
        return row
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
        elif k in ("location", "beneficiary", "verification", "gallery", "budget", "milestones_reached", "metadata", "props"):
            if isinstance(v, str):
                try:
                    d[k] = json.loads(v)
                except Exception:
                    pass
    return d

class AsyncCursor:
    def __init__(self, table: "SupabaseCollection", filter_dict: Optional[Dict] = None, projection: Optional[Dict] = None):
        self.table = table
        self.filter_dict = filter_dict or {}
        self._sort: Optional[List[tuple]] = None
        self._skip: int = 0
        self._limit: Optional[int] = None

    def sort(self, key_or_list: Union[str, List[tuple]], direction: int = 1) -> "AsyncCursor":
        if isinstance(key_or_list, str):
            self._sort = [(key_or_list, direction)]
        else:
            self._sort = key_or_list
        return self

    def skip(self, n: int) -> "AsyncCursor":
        self._skip = n
        return self

    def limit(self, n: int) -> "AsyncCursor":
        self._limit = n
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        limit = length if length is not None else self._limit
        return await self.table._fetch_all(self.filter_dict, sort=self._sort, skip=self._skip, limit=limit)

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not hasattr(self, "_cached_items"):
            self._cached_items = await self.to_list()
            self._idx = 0
        if self._idx < len(self._cached_items):
            item = self._cached_items[self._idx]
            self._idx += 1
            return item
        raise StopAsyncIteration

class SupabaseCollection:
    def __init__(self, name: str):
        self.name = name

    def _build_where(self, filter_dict: Optional[Dict[str, Any]], offset: int = 0) -> tuple[str, list]:
        if not filter_dict:
            return "", []
        clauses = []
        params = []
        for k, v in filter_dict.items():
            if k == "$or" and isinstance(v, list):
                or_parts = []
                or_clauses = []
                for sub in v:
                    for sk, sv in sub.items():
                        if isinstance(sv, dict) and "$regex" in sv:
                            params.append(f"%{sv['$regex']}%")
                            idx = offset + len(params)
                            or_clauses.append(f"{sk} ILIKE ${idx}")
                if or_clauses:
                    clauses.append("(" + " OR ".join(or_clauses) + ")")
                continue

            if isinstance(v, dict):
                for op, op_val in v.items():
                    if op == "$in":
                        params.append(list(op_val))
                        idx = offset + len(params)
                        clauses.append(f"{k} = ANY(${idx})")
                    elif op == "$ne":
                        params.append(op_val)
                        idx = offset + len(params)
                        clauses.append(f"{k} != ${idx}")
                    elif op == "$gte":
                        params.append(op_val)
                        idx = offset + len(params)
                        clauses.append(f"{k} >= ${idx}")
                    elif op == "$lte":
                        params.append(op_val)
                        idx = offset + len(params)
                        clauses.append(f"{k} <= ${idx}")
                    elif op == "$regex":
                        params.append(f"%{op_val}%")
                        idx = offset + len(params)
                        clauses.append(f"{k} ILIKE ${idx}")
                continue

            params.append(v)
            idx = offset + len(params)
            clauses.append(f"{k} = ${idx}")

        where_str = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        return where_str, params

    async def find_one(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        where_str, params = self._build_where(filter_dict)
        sql = f"SELECT * FROM {self.name} {where_str} LIMIT 1"
        try:
            row = await supabase_db.query_one(sql, *params)
            return _from_row(self.name, row) if row else None
        except Exception:
            return None

    def find(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict] = None) -> AsyncCursor:
        return AsyncCursor(self, filter_dict, projection)

    async def _fetch_all(self, filter_dict: Optional[Dict[str, Any]], sort: Optional[List[tuple]] = None, skip: int = 0, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        where_str, params = self._build_where(filter_dict)
        order_clause = ""
        if sort:
            order_parts = []
            for col, direction in sort:
                dir_str = "DESC" if direction == -1 else "ASC"
                col_name = f'"{col}"' if col in ("order", "user", "group", "check") else col
                order_parts.append(f"{col_name} {dir_str}")
            order_clause = "ORDER BY " + ", ".join(order_parts)

        limit_clause = f"LIMIT {limit}" if limit is not None else ""
        skip_clause = f"OFFSET {skip}" if skip > 0 else ""

        sql = f"SELECT * FROM {self.name} {where_str} {order_clause} {limit_clause} {skip_clause}".strip()
        try:
            rows = await supabase_db.query(sql, *params)
            return [_from_row(self.name, r) for r in rows]
        except Exception:
            return []

    async def insert_one(self, doc: Dict[str, Any]) -> Any:
        cols = []
        placeholders = []
        vals = []
        for k, v in doc.items():
            if k == "_id":
                continue
            col_name = f'"{k}"' if k in ("order", "user", "group", "check") else k
            cols.append(col_name)
            vals.append(_to_db_val(k, v))
            placeholders.append(f"${len(vals)}")
        conflict_clause = ""
        if "id" in doc:
            conflict_clause = "ON CONFLICT (id) DO NOTHING"
        elif "session_token" in doc:
            conflict_clause = "ON CONFLICT (session_token) DO NOTHING"
        elif "reference" in doc:
            conflict_clause = "ON CONFLICT (reference) DO NOTHING"
        sql = f"INSERT INTO {self.name} ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) {conflict_clause}".strip()
        await supabase_db.execute(sql, *vals)
        class InsertResult:
            inserted_id = doc.get("id") or doc.get("session_token")
        return InsertResult()

    async def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any], upsert: bool = False) -> Any:
        set_dict = update_dict.get("$set", {})
        if "$set" not in update_dict and "$setOnInsert" not in update_dict and "$inc" not in update_dict:
            set_dict = update_dict
        inc_dict = update_dict.get("$inc", {})
        set_on_insert = update_dict.get("$setOnInsert", {})

        if upsert:
            existing = await self.find_one(filter_dict)
            if not existing:
                insert_doc = {**filter_dict, **set_on_insert, **set_dict}
                return await self.insert_one(insert_doc)

        set_params = []
        set_clauses = []
        for k, v in set_dict.items():
            set_params.append(_to_db_val(k, v))
            col_name = f'"{k}"' if k in ("order", "user", "group", "check") else k
            set_clauses.append(f"{col_name} = ${len(set_params)}")

        for k, v in inc_dict.items():
            set_params.append(v)
            col_name = f'"{k}"' if k in ("order", "user", "group", "check") else k
            set_clauses.append(f"{col_name} = COALESCE({col_name}, 0) + ${len(set_params)}")

        if not set_clauses:
            return

        where_str, where_params = self._build_where(filter_dict, offset=len(set_params))
        all_params = set_params + where_params
        sql = f"UPDATE {self.name} SET {', '.join(set_clauses)} {where_str}"
        await supabase_db.execute(sql, *all_params)

    async def delete_one(self, filter_dict: Dict[str, Any]) -> Any:
        where_str, params = self._build_where(filter_dict)
        sql = f"DELETE FROM {self.name} {where_str}"
        await supabase_db.execute(sql, *params)

    async def delete_many(self, filter_dict: Dict[str, Any]) -> Any:
        where_str, params = self._build_where(filter_dict)
        sql = f"DELETE FROM {self.name} {where_str}"
        await supabase_db.execute(sql, *params)

    async def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        where_str, params = self._build_where(filter_dict)
        sql = f"SELECT count(*) as count FROM {self.name} {where_str}"
        row = await supabase_db.query_one(sql, *params)
        return int(row["count"]) if row else 0

    async def create_index(self, *args, **kwargs):
        pass

class SupabaseClientProxy:
    def __init__(self):
        self._collections: Dict[str, SupabaseCollection] = {}

    def __getattr__(self, name: str) -> SupabaseCollection:
        if name not in self._collections:
            self._collections[name] = SupabaseCollection(name)
        return self._collections[name]

    def __getitem__(self, name: str) -> SupabaseCollection:
        return self.__getattr__(name)

    def close(self):
        pass

db = SupabaseClientProxy()
