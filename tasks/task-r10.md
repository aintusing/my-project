# R10: stock-source recovery

- Разработчик: codex-4; метка `agent:codex-4`.
- Issue: [#25](https://github.com/aintusing/my-project/issues/25).
- Ветка: `task/r10-stock-source-recovery`.
- Отдельный worktree: `.coordination/codex-4-r10`.
- PR: ещё нет.
- Статус: ждёт merge регистрации роли из `task/register-codex-4`.
- Зависимости: только публикация этой роли/task-файла; #9/#10/#11/#15 не блокируют.
- Владение после bootstrap: только codex-4 редактирует этот task-файл.

## Goal
Восстановить поведение stock-сборщика при отказе SEC, сохранив достоверность данных,
бесплатные источники и текущий CSV-контракт.

## Scope
- `catalog/build_catalog.py`: stock-путь и минимальные общие функции для его тестируемости.
- `tests/test_catalog_sources.py`
- `docs/CATALOG_SOURCES.md`
- `tasks/task-r10.md`
Не менять catalog/db/, radar/api/, docs/API.md, graph/, app/, scoring/ADR, root config
и чужие task-файлы. Данные генерировать только локально в собственном worktree, не коммитить.

## Acceptance criteria
- Воспроизвести SEC 403 и реализовать разрешённый бесплатный fallback/явную диагностику.
  Официальные условия источников проверить; не обходить запреты/лимиты и не выдумывать контактный email.
- Сохранить FIELDS и совместимость CSV для R02/R03. Не выдумывать CIK, страну,
  финансовое состояние и URL. Origin соответствует фактическому источнику.
- Не менять формулы scoring v2 и API; synthetic fixtures не выдавать за реальные активы.
- Offline-тесты: primary success, SEC failure + fallback, оба недоступны,
  пустой/повреждённый ответ, дубликаты, отсутствующие optional-поля.
- Документировать источники, ограничения, команду stock-only проверки и фактическое
  число записей. Сетевые ограничения сообщать; 20000 реальных записей без измерения не обещать.
- Python unittest suite и git diff --check; actual output и непроверенное в PR/task-файле.
  Ориентир до 300 handwritten строк, без unrelated refactor.

## Depends on
Merge PR регистрации codex-4 из task/register-codex-4. После него можно начинать независимо
от текущих PR Claude: write scopes не пересекаются, CSV-контракт сохраняется.

## Agent
`agent:codex-4` — разработчик. Главный координатор — основная сессия Codex.

## Workflow
Прочитать AGENTS.md, архитектуру, принятые решения, tasks/README.md, coordinator,
tasks/agents/codex-4.md и этот файл. Собственный чистый clone/worktree, fetch origin,
ветка от актуального master; не переключать чужие worktree. После зависимостей Starting.
Первый commit/push → draft PR в master с Closes #25. Перед ready — fetch/rebase,
проверки, commit/push своего task-файла с результатами/номером PR; gh pr ready и handoff в Issue.
Не сливать свой PR, не назначать работу другим агентам, расширение scope передать координатору.

## Передача
Работа ещё не начата. Разработчик фиксирует здесь фактические изменения, проверки,
ограничения, branch/PR и совместимость CSV для потребителей R02/R03.
