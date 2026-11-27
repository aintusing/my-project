# Реестр ролей

Реестр ведёт главный координатор Codex. Labels обозначают роли, не GitHub-аккаунты.

| Роль | Метка | Полномочия | Текущая область |
| --- | --- | --- | --- |
| Главный Codex | agent:codex | Единственный координатор, scope/review/integration; без feature code | Общие notes, назначения, аудит |
| claude-1 | agent:claude-1 | Разработчик | R01 app/ + root ATTRIBUTION; R04A после merge R01 |
| claude-2 | agent:claude-2 | Разработчик | R02 catalog/db + radar/api; R05A Proposed decision/docs |
| claude-3 | agent:claude-3 | Разработчик | R03 graph/ и собственный task-файл; R09A docs-план отдельно |
| [codex-4](codex-4.md) | agent:codex-4 | Разработчик, не координатор | [R10](../task-r10.md): stock-source recovery в catalog/build_catalog.py |

claude-4 зарезервирован. Все четыре активных разработчика используют одинаковый
AGENTS.md workflow: собственные branch/clone/worktree, Starting после зависимостей,
draft PR после первого commit/push, фактические тесты и task-handoff, rebase перед ready,
свой PR не сливать. Ни один разработчик не изменяет чужие task-файлы и назначения.

R10 не пересекается с R02: catalog/build_catalog.py и catalog/db/ принадлежат разным
задачам; CSV FIELDS сохраняются. Ни root API/config, ни graph/, ни app/ codex-4 не меняет.
