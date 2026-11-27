# Координация Radar

## Команда и аудит
- Главный Codex (`agent:codex`) — единственный координатор. Claude-1/2/3 и новый
  codex-4 — разработчики с одинаковым AGENTS.md branch/testing/reporting/PR workflow.
  Реестр: [agents/README.md](agents/README.md); профиль [codex-4](agents/codex-4.md).
- codex-4 получает независимую R10 [#25](https://github.com/aintusing/my-project/issues/25):
  catalog/build_catalog.py, tests/test_catalog_sources.py, docs/CATALOG_SOURCES.md,
  tasks/task-r10.md. Нет пересечения с R02 catalog/db + radar/api, R03 graph/ или R01 app/.
- #25 ждёт только merge регистрации из task/register-codex-4. После merge снять blocked,
  создать отдельный worktree .coordination/codex-4-r10 и ветку task/r10-stock-source-recovery.
  Разработчик не координирует команду и не сливает свой PR.
- [Полный аудит](audits/2026-11-27.md): отдельная integration/audit-20261127,
  без merge-коммита и master merge. 38 Python + 59 Node прошли; дополнительные
  4 smoke-проверки дали 1 pass / 3 fail (HTTP-контракт #22). Интеграция не полностью зелёная.
- Локальный отдельный worktree claude-1 подтверждён: staged 10822 app-файла ещё не push.
  Для claude-2/3 отдельные remote branches подтверждены, физические clone/worktree запрошены
  в #10/#11; без ответа их изоляцию нельзя объявить проверенной.

## Решение по R03
- После комментария claude-3 по head 00b0ca5 выбран **один PR #13 с четырьмя блоками ревью**.
  Матрица и merge gates: [r03-review.md](r03-review.md).
- Основание: ядро импортирует данные/события, общий test/model.test.js проверяет связную сборку.
  Отдельные PR потребовали бы доработки импортов и промежуточных состояний. Код не переписывается.
- Предыдущее извлечение по #18/#19 опиралось на меньший head 10b8c0c и отменено.
  #18/#19 закрыты как not planned с объяснением; их файлы сохраняются историей.
  Новые отдельные R03a–R03d Issues не создаются.
- #11 разблокирован, scope: graph/ и собственный tasks/task-r03.md; другие scopes не пересекаются.
  Root ATTRIBUTION.md остаётся у R01. Свой task-файл обновляет только claude-3.
- Для уже написанного связанного объёма разрешено исключение из ориентира 300 строк.
  Это не разрешение на новые функции, принятие контрактов или ослабление приёмки.
- Порядок ревью: A ядро → B Земля/данные → C события/источники → D анализ → сквозная сборка.
  PR остаётся draft. Слияние одно после всех блоков; отдельные части не считаются принятыми.

## Состояние команды
- Проверено 2026-11-27 через GitHub. В master: bootstrap #12 (1419df4), очередь #17
  (4847f2c), предыдущее разбиение #21 (f77cd29); последнее отменено новым решением выше.
  Feature-части первой волны пока не слиты.
- #9 claude-1: draft #20, head 7426866; только task-файл, app/ ещё не закоммичен.
  Сеть даёт early EOF; разработчик использует batched blob fetch с повторами.
  Заявлены полный upstream commit/tree и manifest 10822 файлов. Копия ещё не подтверждена.
  Предварительное gh pr diff/review выполнено; #14 ждёт фактического merge #9.
- #10 claude-2: draft #22, audited head eeeb147 после rebase, backup refs сохранены.
  Полный diff прочитан; в общей тестовой сборке 38 Python прошли. Воспроизведены HEAD/OPTIONS
  501 вместо 405 и schema-unavailable 400 вместо 503; нужны in-scope fixes и regression tests.
  Реальные 12274 / synthetic 20500 явно разделены. Synthetic scale check допустим по исходному
  acceptance; полнота реального stock-снимка — отдельное ограничение, переданное R10 codex-4.
- #15 claude-2: draft #23, audited head a644804; ADR 0003 Proposed и SCORING.md.
  Полный diff прочитан; решение ещё не принято, реализация R05B не разрешена.
  Будущие observed_at/source не меняют API R02; freshness без timestamp — unknown.
- #11 claude-3: draft #13, audited head 66dbde1. Координатор воспроизвёл 59/59 graph tests,
  38 Python в совместной сборке и clean whitespace. Browser/FPS 74.3/54.1 — пока отчёт автора.
  По новому отчёту исправлены optional 404 и проверены keyboard/contrast/fallback; независимо
  эти browser-результаты не воспроизведены. Physical offline ещё не выполнен.
- Права на часть данных #13 не подтверждены. Решение: исключить такие наборы/заголовки
  из распространяемого snapshot, оставить код/synthetic/подтверждённые fixtures и проверить
  degraded/offline режим. Это in-scope; новые CN/EU источники оформляются отдельно от #11.
- API→graph не подключён: results→nodes, kind→group, scores/flags→meta и links нужны в R08.
  Пока два модуля совместно проходят suites, но не образуют готовый app/API/graph сценарий.

## Очередь и зависимости
- #14 R04A claude-1: docs/WM_AUDIT.md и свой task-файл. Опубликована, blocked до merge #9.
  Правок app/ нет; по аудиту назначается R04B с точными файлами и ATTRIBUTION.md.
- #15 R05A опубликована и начата; R05B позже ждёт merge #10 и принятого ADR.
- #16 R09A claude-3: docs/DEMO_PLAN.md и свой task-файл, доступна без зависимостей,
  Starting пока не сообщён. Резерв при ожидании основной задачи; graph/ не меняет.
- R06 ждёт R04/R02; R07 — R02/R05; R08 — R03/R04; снимок R09B — R06/R08.
  Shared app/config-файлы получают одного писателя. Не назначать перекрывающиеся scopes.

## Полномочия и проверки
- Владелец разрешил координатору обычные решения, ревью и merge проверенных PR в master,
  затем unblock по подтверждённому merge. Codex не пишет feature code и не заменяет Claude.
- Сохраняются AGENTS.md, архитектура, принятые 0001/0002. Существенные shared choices
  принимаются decision PR до реализации. Один большой PR не отменяет это требование.
- Проверять полный diff, scope, приёмку/тесты на точном head, master conflicts и лицензии;
  записывать gh pr review. Авторский review не выдавать за независимое approval.
- Координатор меняет общие заметки/матрицу. Существующие developer task-файлы,
  включая отменённые task-r03a/task-r03b, не редактируются параллельно владельцу.
- Последний запуск baseline Python: 26 tests, 0.087 s, OK, Python 3.13.5 из
  C:/Users/banan/AppData/Roaming/uv/python/cpython-3.13.5-windows-x86_64-none/python.exe.
  Для документов UI/GPU-проверки не запускались; feature PR проверяются отдельно.
- GitHub delete_branch_on_merge=false; ветки сохраняются. Ранее автоматически удалённые
  coordinator-ветки восстановлены: task/radar-wave-1 d64b22b, task/radar-next-wave 11c864e.
- Рабочая ветка координатора task/register-codex-4 создана от master 55ff19b.
  Другие worktrees не переключались; посторонний untracked my-project/ исключён из коммитов.
- AGPL notices/provenance сохраняются; данные unknown не выдумывать, платные источники
  и buy/sell советы исключены, threat-indicator адреса не открывать и не делать ссылками.
- Данные хакатона запрошены один раз, ответа нет. План 48 часов; после 33 ч 36 мин
  прекратить новые feature-назначения. При запрете prewritten code остановить затронутое.

## История
#2/#3/#4/#6 и PR #7 закрыты с явного согласия владельца; #7 не слит, база принята в #8.
task-001/task-002/task-003 остаются отменённой историей; replacement для #5 не нужен.
Сохраняются agent/claude-1/2-counter-html и 4453b2c. #18/#19 отменены новым решением по #13.
