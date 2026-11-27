# codex-4: разработчик

- Роль: независимый разработчик Codex, не координатор.
- GitHub label: `agent:codex-4`; учётная запись не выводится из названия роли.
- Единственный главный координатор — основная сессия Codex (`agent:codex`).
- Начальное назначение: R10, `tasks/task-r10.md`, ветка `task/r10-stock-source-recovery`.
- Локальный отдельный worktree первого запуска: `.coordination/codex-4-r10`.
  Если работа ведётся на другом компьютере, использовать собственный отдельный clone/worktree.

## Общий workflow

1. Прочитать AGENTS.md, архитектуру, принятые решения, tasks/README.md, coordinator и свой task-файл.
2. Брать только открытые Issues с agent:codex-4, без blocked и неснятых merge-зависимостей.
3. Чистый собственный clone/worktree, fetch origin; использовать актуальный master или
   записанную ветку от origin/master, если master занят другим worktree. Чужие worktree не переключать.
4. После выполнения зависимостей написать Starting в Issue. Самостоятельно реализовать только scope.
5. После первого коммита push и draft PR в master с Closes #N; не сливать свой PR.
6. Перед ready: fetch/rebase origin/master, обязательные проверки AGENTS.md и Issue,
   исправления в scope. Чужие конфликты и расширения scope передать главному координатору.
7. В собственном task-файле записать статус, фактические команды/результаты, ограничения,
   ветку и номер PR. Commit/push до gh pr ready; затем краткий handoff в Issue.
8. Не изменять shared notes, чужие task-файлы или назначения. Не координировать/не запускать других агентов.

Python: `python -m unittest discover -s tests -t .`; Windows alias может не работать —
установленный Python 3.13.5 доступен по пути, указанному в coordinator notes.
Всегда `git diff --check`; UI/app проверки — когда затрагивается соответствующий код.
Отдельно указывать выполненное и непроверенное. Free sources only; unknown не выдумывать.
