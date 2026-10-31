# Validation tools

Scripts that re-check the claims in [research/validation.md](../research/validation.md) against
the corpus in the [research dump](https://github.com/blussyya/sldprt-research-dump). They use the
reader in [solidworks-converters](https://github.com/blussyya/solidworks-converters), cloned next
to this repo.

| script | what it checks |
|---|---|
| `resolve-sweep.js` | the exact B-rep resolves on every part given, and how far the fitted curves and surfaces are from it. Pass an earlier run with `--baseline` to list what got worse. |

```bash
node tools/resolve-sweep.js --baseline ../sldprt-research-dump/knowledge/evidence/scripts/EXP086/resolve-after.txt ../sldprt-research-dump/test\ files\ online/*/*.SLDPRT
```
