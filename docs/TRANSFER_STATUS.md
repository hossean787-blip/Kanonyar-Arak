# Source migration status — v0.11

- The complete v0.11 source archive has 45 source/docs/config files.
- GitHub currently contains only scaffolding, docs, and CI. Backend and Android Activity source files have **not** been imported.
- The 0.11 archive exists locally in the conversation workspace and was ZIP-inspected.
- The container cannot resolve github.com; the GitHub connector cannot directly read container file bytes.
- Do **not** interpret the CI workflow as evidence that both APKs build until the source upload is complete and the jobs pass.
- Never publish signing keys, secrets, student records or real payment data in this public repository.
- To finish migration: upload the 45 archive entries (without duplicate existing files), verify tree and run CI builds for both APKs.
