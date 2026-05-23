# Sample Context (rollup)

System boundary: sample-app API and persistence modules.

```mermaid
C4Context
title Sample App Context
Person(user, "Client")
System(sample, "Sample App")
Rel(user, sample, "Uses")
```
