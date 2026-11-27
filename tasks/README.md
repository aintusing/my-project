# Задачи Radar

База: **master**. Scope и приёмка задаются GitHub Issues; файлы задач хранят передачу работы.
Сначала читать [координатора](coordinator.md), [архитектуру](../docs/ARCHITECTURE.md)
и [принятые решения](../docs/decisions/).

Bootstrap [#12](https://github.com/aintusing/my-project/pull/12) слит squash в `1419df4`.
#9–#11 разблокированы; все три разработчика сообщили Starting.

| Задача | Роль | Issue | Scope реализации (плюс собственный task-файл) | Состояние | Ветка | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [R01: точная копия worldmonitor](task-r01.md) | claude-1 | [#9](https://github.com/aintusing/my-project/issues/9) | `app/`, `ATTRIBUTION.md` | Starting; PR пока не опубликован | `task/r01-worldmonitor-copy` | — |
| [R02: SQLite и API](task-r02.md) | claude-2 | [#10](https://github.com/aintusing/my-project/issues/10) | `catalog/db/`, `radar/api/`, `docs/API.md`, `tests/test_catalog_db.py`, `tests/test_api.py` | Starting; PR пока не опубликован | `task/r02-catalog-api` | — |
| [R03: интеграция графа](task-r03.md) | claude-3 | [#11](https://github.com/aintusing/my-project/issues/11) | UI/demo/vendor и integration-тесты; точные пути в #11 | Ждёт #18/#19; draft #13 сохраняется | `task/r03-offline-graph` | [#13](https://github.com/aintusing/my-project/pull/13) |
| [R03A: модель](task-r03a.md) | claude-3 | [#18](https://github.com/aintusing/my-project/issues/18) | `graph/model.js`, `graph/fixture.js`, `graph/package.json`, `graph/test/model.test.js` | Готова после публикации task-файла; извлечь существующий код | `task/r03a-model` | — |
| [R03B: рендереры](task-r03b.md) | claude-3 | [#19](https://github.com/aintusing/my-project/issues/19) | `graph/views.js`, `graph/test/views.test.js` | Ждёт #18 и публикацию task-файла | `task/r03b-renderers` | — |
| [R04A](task-r04a.md) | claude-1 | [#14](https://github.com/aintusing/my-project/issues/14) | `docs/WM_AUDIT.md` | Ждёт merge #9; task-файл опубликован | `task/r04a-startup-audit` | — |
| [R05A](task-r05a.md) | claude-2 | [#15](https://github.com/aintusing/my-project/issues/15) | `docs/decisions/0003-scoring-v2.md`, `docs/SCORING.md` | Starting; R02 API не меняется | `task/r05a-scoring-decision` | — |
| [R09A](task-r09a.md) | claude-3 | [#16](https://github.com/aintusing/my-project/issues/16) | `docs/DEMO_PLAN.md` | Готова; Starting пока не заявлен | `task/r09a-demo-plan` | — |

Очередь #14–#16 опубликована PR #17 (master `4847f2c`): #15/#16 разблокированы,
#14 ждёт merge #9. Новое разбиение R03 публикуется из `task/radar-graph-split`;
после merge этой публикации #18 доступна независимо от R01/R02, #19 ждёт #18,
а итоговый #11 ждёт #18/#19. Разделяется существующая реализация #13, не создаётся новая.
После каждого merge владелец делает rebase следующих веток и убирает уже принятые части из diff.
Старый task-r03.md обновляет только claude-3; актуальный точный scope задан в Issue #11.
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

Codex владеет сводкой, scope и ревью, не пишет feature code. Разработчики редактируют
только собственные task-файлы и разрешённые пути. Существующие task-r01/r02/r03
координатор не меняет; устаревшие conditional-статусы владельцы уточняют сами.
Назначения определяются одной agent-меткой, claude-4 зарезервирован.
Сессии Claude запускают их участники; текущий контроль ведётся через Issues/PR.

## История
С согласия владельца закрыты #2/#3/#4/#6 и PR #7. PR #7 не слит; правила уже в #8.
[task-001.md](task-001.md), [task-002.md](task-002.md), [task-003.md](task-003.md)
сохранены как отменённая история. PR #5 остаётся закрытым, replacement не нужен.
Все ветки, включая `agent/claude-1/2-counter-html`, сохраняются.
