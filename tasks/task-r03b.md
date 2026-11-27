# R03B: часть существующего R03

- Роль: claude-3.
- Issue: [#19](https://github.com/aintusing/my-project/issues/19).
- Ветка: `task/r03b-renderers`.
- PR: ещё нет.
- Статус: ждёт публикации task-файла и merge #18; не начато.
- Источник существующего кода: PR #13, head `10b8c0c66c21b5861dcd031db60c24b05eeedbd6`.
- После публикации этот task-файл редактирует только claude-3.

## Goal
Выделить существующие рендереры графа из #13 во второй небольшой PR после модели. Сохранить текущий интерфейс show/mark/focus/spin/destroy, не дублировать UI.

## Scope
- `graph/views.js`
- `graph/test/views.test.js`
- `tasks/task-r03b.md`
Остальные файлы вне scope; в частности не менять graph/ UI/vendor, чужие task-файлы, app/ или radar/api/.

## Acceptance criteria
- Использовать существующий graph/views.js из #13; новый независимый renderer не писать. Чистая модель импортируется из слитого R03A.
- Сохранить 2D canvas и 3D factory с внедряемой библиотекой; не добавлять загрузку CDN, vendored bundle, UI toolbar или зависимость от app/API.
- Проверить осмысленными тестами поведение show/mark/focus и cleanup ResizeObserver/renderer при destroy, изоляцию входных данных от мутаций 3D-библиотеки и обработку пустого графа. Допустимы локальные mocks browser API в tests; тесты не объявлять GPU/FPS-проверкой.
- Приложить проверки синтаксиса и node --test graph/test/*.test.js на поддерживаемой версии Node, Python unittest suite и git diff --check; записать фактический результат и непроверенное.
- Ориентир до 300 handwritten строк с ограниченными тестами. Если необходимый объём выходит за него, сообщить координатору до ready; не расширять scope на module/UI/vendor самостоятельно.
- Браузерная приёмка 375/1440, offline, keyboard, WebGL fallback и FPS на 5000 узлах остаётся у итогового #11/#13. Доказательства изолированного теста renderer не подменяют эту приёмку.

## Depends on
Слияние R03A #18 (модель графа) и координационного PR из task/radar-graph-split. Финальная интеграция #11 не является зависимостью.

## Agent
`agent:claude-3`.

## Workflow
Сначала прочитать AGENTS.md, архитектуру, принятые решения, сводку tasks/ и `tasks/task-r03b.md`. После слияния зависимостей в своём чистом clone/worktree написать Starting и использовать `task/r03b-renderers`. Взять существующий код #13 в пределах scope; не переключать чужие worktrees и не делать destructive reset. После первого коммита открыть draft PR в master с Closes #<номер этого Issue>. Перед ready выполнить fetch/rebase origin/master, проверки, заполнить номер PR и handoff в своём task-файле. Не сливать свой PR. В #13 удалить выделенную часть из diff только после её принятого merge в master и rebase; финальные критерии #11 сохраняются.

## Передача и проверки
Разработчик записывает номер PR, фактические проверки, ограничения и интерфейсы для следующей части. Никакого дублирования кода R03; текущие файлы переносятся в отдельный PR в пределах scope.
