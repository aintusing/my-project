# R03: один PR, четыре блока ревью

Сохраняем #11 и PR #13; отдельные #18/#19 отменены. Основание — комментарий
claude-3 в #13 от 2026-11-27, head 00b0ca5: ядро импортирует данные/события,
общие тесты проверяют их вместе. Отвязка потребовала бы дополнительных изменений.

Scope: graph/ и собственный tasks/task-r03.md; точная приёмка в Issue #11.
Корневой ATTRIBUTION.md принадлежит R01. Файл ведёт Codex; task-файл владельца не меняет.
Исключение из ориентира 300 строк действует только для уже написанного связанного объёма;
новые функции без изменения Issue не добавляются. Проверки приёмки не ослаблены.

| Блок | Файлы внутри graph/ по отчёту автора | Проверка | Статус |
| --- | --- | --- | --- |
| A: ядро | model.js, views.js, scheme.js, radar-graph.js, palette.js, panel.js, browse.js, style.css, theme.css, index.html, demo.js, fixture.js, lib/, package.json, .gitattributes, README.md, tools/serve.py, test/model.test.js | Контракт, фильтры/поиск/соседи, lifecycle, vendor hash/лицензии, Windows checkout | Общие 59 automated tests на 66dbde1 подтверждены; полный block/browser review ещё не завершён |
| B: Земля и данные | earth.js, geo.js, fixtures/world.js, fixtures/snapshot.js, fixtures/layers.js, tools/build_snapshot.mjs, tools/build_layers.mjs, ATTRIBUTION.md, test/layers.test.js | Геометрия/связи, provenance/права, время снимка, synthetic/unknown | Часть прав не подтверждена автором |
| C: события и источники | activity.js, activity.css, newsroom.js, fixtures/events.js, fixtures/events-extra.js, fixtures/sources.js, tools/build_events*.py, tools/build_sources.py, ATTRIBUTION-events.md, ATTRIBUTION-events-extra.md, ATTRIBUTION-sources.md, тесты | Происхождение/права, экранирование, локальность, отсутствующие файлы | Автор сообщил об устранении 404 на 66dbde1; права ещё не подтверждены |
| D: анализ | analytics.js, analytics.css, METHODOLOGY.md, test/analytics.test.js | Расчёты/методология, unknown/stale, ограничения, принятые контракты | Ждёт ревью; ADR 0003 пока Proposed |

Порядок A → B → C → D, затем вся сборка. Прохождение блока не разрешает merge части PR.
Изменения общих контрактов всё ещё требуют принятого decision PR: scope графа его не заменяет.

## Доказательства и gates

Автор сообщил 59/59 тестов при свежем checkout с autocrlf=true, чистый diff --check,
26 Python-тестов, 74.3 FPS на 5000 узлах и 54.1 FPS на снимке 15451 узла.
Это исходный отчёт автора по 00b0ca5. В аудите 66dbde1 координатор подтвердил 59 graph tests,
38 Python и clean whitespace в отдельной тестовой интеграции; browser/FPS не воспроизводились.
Предыдущие 9 Node-тестов относятся к 10b8c0c и не подтверждают расширенную сборку.

- Нужна физически отключённая сеть; новый keyboard/focus/contrast отчёт автора пока независимо не воспроизведён.
- Автор повторил 2D fallback/375/1440; сохранить доказательства и проверить итоговый head перед merge.
- Нужна clean console/CSP во всех режимах; 404 optional-событий не считать чистой консолью.
- Подтвердить разрешённость включения библиотек, данных и заголовков в распространяемый снимок.
  До подтверждения данные можно исключить из распространяемого артефакта; право не предполагается.
- Перед ready: rebase current master, все graph tests, Python suite, diff --check,
  фактические команды/результаты на точном head и FPS с hardware, длительностью, режимом связей.
- PR остаётся draft. Одно итоговое слияние после всех блоков и сквозной приёмки.

claude-3 обновляет свой task-r03.md и PR; ветки сохраняются, код не переносится в новые PR
и не переписывается только ради структуры ревью. Независимый #16 остаётся доступным резервом.
