# AGENTS.md

## 運用ルール
- Codex を含むすべてのエージェントは、まず `CLAUDE.md` の内容を参照し、同じルールに従うこと。

## デバッグフラグ運用
- デバッグ状態は `src/constants/config.ts` の `ENABLE_DEBUG_CONTROLS` で制御する（Xcodeビルド種別では判定しない）。
- `ENABLE_DEBUG_CONTROLS` は **false のままコミットすること**。
- コミットに true が含まれていた場合は、必ず false に戻すこと。
