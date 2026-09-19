# Milestone 015 — General task output decoding

Run `8220d638-f662-44ff-b17b-0579f4adfa33` failed at step zero while decoding a response. The raw response/task identifier was not persisted, so its exact payload cannot be reconstructed without another external request. Do not rerun automatically.

The decoder only reads task artifacts, ignoring completed-task status messages. Add a regression test and support agent-authored status output when artifacts are absent, while preserving file rejection and avoiding echoes of user input. Improve empty/file diagnostics. This is a confirmed parser gap, not proof of the original response shape.
