# Задачи Radar

База: **master**. Scope и приёмка задаются GitHub Issues; файлы задач хранят передачу работы.
Сначала читать [координатора](coordinator.md), [архитектуру](../docs/ARCHITECTURE.md)
и [принятые решения](../docs/decisions/).

[Реестр команды](agents/README.md): основной Codex — единственный координатор;
claude-1/2/3 и codex-4 — разработчики с независимыми ветками и worktree/clone.
[Профиль codex-4](agents/codex-4.md) использует тот же testing/reporting/PR workflow.

Bootstrap [#12](https://github.com/aintusing/my-project/pull/12) слит squash в `1419df4`.
#9–#11 разблокированы; все три разработчика сообщили Starting.

| Задача | Роль | Issue | Scope реализации (плюс собственный task-файл) | Состояние | Ветка | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [R01: точная копия worldmonitor](task-r01.md) | claude-1 | [#9](https://github.com/aintusing/my-project/issues/9) | `app/`, `ATTRIBUTION.md` | Draft; загрузка upstream objects, копия ещё не закоммичена | `task/r01-worldmonitor-copy` | [#20](https://github.com/aintusing/my-project/pull/20) |
| [R02: SQLite и API](task-r02.md) | claude-2 | [#10](https://github.com/aintusing/my-project/issues/10) | `catalog/db/`, `radar/api/`, `docs/API.md`, `tests/test_catalog_db.py`, `tests/test_api.py` | Draft; приёмка не завершена | `task/r02-catalog-api` | [#22](https://github.com/aintusing/my-project/pull/22) |
| [R03: граф](task-r03.md) | claude-3 | [#11](https://github.com/aintusing/my-project/issues/11) | `graph/` и собственный task-файл | Один draft PR; ревью четырёх блоков | `task/r03-offline-graph` | [#13](https://github.com/aintusing/my-project/pull/13) |
| [R04A](task-r04a.md) | claude-1 | [#14](https://github.com/aintusing/my-project/issues/14) | `docs/WM_AUDIT.md` | Ждёт merge #9; task-файл опубликован | `task/r04a-startup-audit` | — |
| [R05A](task-r05a.md) | claude-2 | [#15](https://github.com/aintusing/my-project/issues/15) | `docs/decisions/0003-scoring-v2.md`, `docs/SCORING.md` | Draft; ADR Proposed, не принят | `task/r05a-scoring-decision` | [#23](https://github.com/aintusing/my-project/pull/23) |
| [R09A](task-r09a.md) | claude-3 | [#16](https://github.com/aintusing/my-project/issues/16) | `docs/DEMO_PLAN.md` | Готова; Starting пока не заявлен | `task/r09a-demo-plan` | — |
| [R10: stock-source recovery](task-r10.md) | codex-4 | [#25](https://github.com/aintusing/my-project/issues/25) | `catalog/build_catalog.py`, `tests/test_catalog_sources.py`, `docs/CATALOG_SOURCES.md` | Ждёт публикации роли/task-файла | `task/r10-stock-source-recovery` | — |

Очередь #14–#16 опубликована PR #17 (master `4847f2c`): #15/#16 разблокированы,
#14 ждёт merge #9. По последнему комментарию claude-3 выбран один PR #13 с
[ревью четырёх блоков](r03-review.md). Извлечение #18/#19 отменено, эти Issues
закрыты и не являются зависимостями #11. Их task-файлы сохранены как история;
отдельную работу по ним не начинать. Новые R03a–R03d Issues не создаются.
Свой task-r03.md обновляет только claude-3; актуальный scope задан в Issue #11.
Текущая первая волна имеет приоритет.
Не выдавать дополнительную задачу за уже начатую и не делать её реализацию вместо владельца.

## Параллельная работа и очередь
- R01/R02/R03 не зависят друг от друга и могут сливаться в любом порядке после проверок.
- R04 разделена: R04A — аудит без изменения app/; R04B — конкретные исправления
  с точным списком файлов после аудита. Готовность UI R04 подтверждается только после исправлений.
- R05 разделена: R05A — ADR и контракт; R05B — реализация после #10 и принятого ADR.
  Документы R05A не меняют API R02 и не мешают завершать #10.
- R09A — независимый план. Реальный offline-снимок и прогон R09B ждут R06/R08.
- R06 ждёт R04 и R02; R07 — R02/R05; R08 — R03/R04.
  Для регистрации панелей и общей конфигурации app/ назначается только один писатель.
- Следующие implementation Issues создаются с точным scope после появления контрактов.
  Большие задачи делятся до начала работы; обычный ориентир — 300 строк.
- Значимые технические решения принимаются отдельным PR до реализации.
  ADR 0003 в R05A остаётся Proposed до принятого слияния.
- R10 независима от R01/R02/R03: исправляет stock-сборщик при SEC 403 без изменения
  CSV-полей, API или графа. codex-4 не дублирует R02 и не исправляет его HTTP-код.

Codex владеет сводкой, scope и ревью, не пишет feature code. Разработчики редактируют
только собственные task-файлы и разрешённые пути. Существующие task-r01/r02/r03
координатор не меняет; устаревшие conditional-статусы владельцы уточняют сами.
Назначения определяются одной agent-меткой, claude-4 зарезервирован.
Сессии Claude запускают их участники; текущий контроль ведётся через Issues/PR.
codex-4 работает в отдельном worktree `.coordination/codex-4-r10`, после merge роли
и снятия blocked с #25. Сводку/назначения продолжает вести только главный Codex.

Интеграционный аудит: [отчёт 2026-11-27](audits/2026-11-27.md).

## История
С согласия владельца закрыты #2/#3/#4/#6 и PR #7. PR #7 не слит; правила уже в #8.
[task-001.md](task-001.md), [task-002.md](task-002.md), [task-003.md](task-003.md)
сохранены как отменённая история. PR #5 остаётся закрытым, replacement не нужен.
Все ветки, включая `agent/claude-1/2-counter-html`, сохраняются.
